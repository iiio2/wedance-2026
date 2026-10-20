import { z } from 'zod'
import { eq, and, or, desc, inArray } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { dancers, gigApplications, gigs, profileMembers, profiles } from '../../database/schema'
import { requireMember } from './business'
import { onlyGranted } from '../../utils/profileAccess'
import { assertScope } from '../scopes'
import { siteOrigin } from '../../oauth/config'
import { sendGigApplicationEmail, sendGigDecisionEmail } from '../../utils/email'
import { hoursBetween, profileGroup, trackServer } from '../../utils/posthog'

/** Gigs this dancer answers for: posted by them, or by a page they run (and the app may use). */
async function gigsIManage(ctx: any, gigIds?: string[]) {
  const pages = await ctx.db.select({ id: profileMembers.profileId }).from(profileMembers).where(eq(profileMembers.dancerId, ctx.dancerId))
  const pageIds = onlyGranted(ctx, pages, (p: any) => p.id).map((p: any) => p.id)
  const mine = or(eq(gigs.dancerId, ctx.dancerId), pageIds.length ? inArray(gigs.posterProfileId, pageIds) : undefined)
  return ctx.db.select().from(gigs).where(gigIds ? and(inArray(gigs.id, gigIds), mine) : mine).orderBy(desc(gigs.createdAt))
}

const today = () => new Date().toISOString().slice(0, 10)

/**
 * Gigs — the dance scene's opportunity board.
 * Organizers post open roles; artists post service offerings.
 * Public listing; authenticated users can post their own gigs.
 */
export const gigsRouter = router({
  // List all gigs, optionally filtered by kind and/or category
  list: publicProcedure
    .input(z.object({
      kind: z.enum(['role', 'offer']).optional(),
      category: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .select()
        .from(gigs)
        .where(eq(gigs.status, 'open'))

      const conditions: any[] = [eq(gigs.status, 'open')]

      if (input.kind) {
        conditions.push(eq(gigs.kind, input.kind))
      }

      if (input.category) {
        conditions.push(eq(gigs.category, input.category))
      }

      const rows = await ctx.db
        .select()
        .from(gigs)
        .where(and(...conditions))
        .orderBy(desc(gigs.createdAt))

      return rows
    }),

  // Get a single gig by ID
  getById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select()
        .from(gigs)
        .where(eq(gigs.id, input.id))

      if (!row) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Gig not found' })
      }

      return row
    }),

  // Create a new gig (authenticated users only)
  create: protectedProcedure
    .input(z.object({
      kind: z.enum(['role', 'offer']),
      category: z.string().min(1),
      title: z.string().min(1),
      posterName: z.string().min(1),
      posterType: z.string().min(1),
      location: z.string().min(1),
      styles: z.array(z.string()).default([]),
      when: z.string().min(1),
      compensation: z.string().min(1),
      deadline: z.string().optional(),
      contactEmail: z.string().email(),
      contactUrl: z.string().url().refine(u => /^https?:\/\//i.test(u), { message: 'Only http or https URLs allowed' }).optional(),
      entityUrl: z.string().url().refine(u => /^https?:\/\//i.test(u), { message: 'Only http or https URLs allowed' }).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.db
        .insert(gigs)
        .values({
          kind: input.kind,
          category: input.category,
          title: input.title,
          posterName: input.posterName,
          posterType: input.posterType,
          location: input.location,
          styles: input.styles,
          when: input.when,
          compensation: input.compensation,
          deadline: input.deadline ? new Date(input.deadline) : undefined,
          contactEmail: input.contactEmail,
          contactUrl: input.contactUrl,
          entityUrl: input.entityUrl,
          dancerId: ctx.dancerId,
          status: 'open',
        })
        .returning()

      if (!result) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create gig' })
      }

      return result
    }),

  // ── Applications (MCP phase 2) ──────────────────────────────────────────

  // An artist applies to a role. The poster gets an email with the message and
  // the applicant's account email (to reply to), and sees it under their gigs.
  applyTo: protectedProcedure
    .input(z.object({
      gigId: z.string().uuid(),
      message: z.string().trim().min(10, 'Say a few words about yourself.').max(2000),
      // The artist page to apply as (one you run).
      profile: z.string().min(1).max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [gig] = await ctx.db.select().from(gigs).where(eq(gigs.id, input.gigId))
      if (!gig) throw new TRPCError({ code: 'NOT_FOUND', message: 'Gig not found.' })
      if (gig.kind !== 'role') throw new TRPCError({ code: 'BAD_REQUEST', message: 'This gig is an artist’s offer, not a role: contact them instead.' })
      const deadline = gig.deadline ? String(gig.deadline).slice(0, 10) : null
      if (gig.status !== 'open' || (deadline && deadline < today())) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This gig is closed.' })
      if (gig.dancerId === ctx.dancerId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'That’s your own gig.' })
      const page = input.profile ? await requireMember(ctx, input.profile) : null

      const [existing] = await ctx.db.select().from(gigApplications).where(and(eq(gigApplications.gigId, gig.id), eq(gigApplications.dancerId, ctx.dancerId)))
      if (existing && existing.status !== 'withdrawn') throw new TRPCError({ code: 'CONFLICT', message: `You already applied (${existing.status}).` })
      const values = { message: input.message, profileId: page?.id ?? null, status: 'pending' as const, decidedBy: null, decidedAt: null, updatedAt: new Date() }
      const [app] = existing
        ? await ctx.db.update(gigApplications).set(values).where(eq(gigApplications.id, existing.id)).returning()
        : await ctx.db.insert(gigApplications).values({ ...values, gigId: gig.id, dancerId: ctx.dancerId }).returning()

      const origin = ctx.origin || siteOrigin()
      try {
        const [me] = await ctx.db.select({ name: dancers.name, email: dancers.email }).from(dancers).where(eq(dancers.id, ctx.dancerId))
        if (me) await sendGigApplicationEmail({
          to: gig.contactEmail, gigTitle: gig.title, message: input.message, link: `${origin}/gigs?mine=1`,
          applicant: { name: page?.name ?? me.name, email: me.email, page: page ? `${origin}/@${page.username}` : null },
        })
      } catch (e) { console.error('[gigs.applyTo] email failed', (e as Error).message) }
      trackServer(ctx, 'gig_applied', { gig_id: gig.id, category: gig.category, as_profile: !!page, reapplied: !!existing, ...profileGroup(page?.username) })
      return { applied: true, id: app!.id, status: app!.status, gig: gig.title }
    }),

  // My applications and where they stand.
  myApplications: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.select({
      id: gigApplications.id, status: gigApplications.status, message: gigApplications.message, createdAt: gigApplications.createdAt, decidedAt: gigApplications.decidedAt,
      gig: { id: gigs.id, title: gigs.title, posterName: gigs.posterName, location: gigs.location, when: gigs.when, status: gigs.status },
    }).from(gigApplications).innerJoin(gigs, eq(gigs.id, gigApplications.gigId))
      .where(eq(gigApplications.dancerId, ctx.dancerId)).orderBy(desc(gigApplications.createdAt))
  }),

  // For whoever posted gigs: each gig with its applications (applicant name,
  // page and email: applying shares the email with the poster).
  applications: protectedProcedure
    .input(z.object({ gigId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const mine = await gigsIManage(ctx, input?.gigId ? [input.gigId] : undefined)
      if (input?.gigId && !mine.length) throw new TRPCError({ code: 'FORBIDDEN', message: 'You didn’t post this gig.' })
      const apps = mine.length
        ? await ctx.db.select({
            id: gigApplications.id, gigId: gigApplications.gigId, status: gigApplications.status, message: gigApplications.message, createdAt: gigApplications.createdAt,
            applicant: { name: dancers.name, handle: dancers.username, email: dancers.email, city: dancers.city },
            page: { username: profiles.username, name: profiles.name, type: profiles.type },
          }).from(gigApplications)
            .innerJoin(dancers, eq(dancers.id, gigApplications.dancerId))
            .leftJoin(profiles, eq(profiles.id, gigApplications.profileId))
            .where(and(inArray(gigApplications.gigId, mine.map((g: any) => g.id)), or(eq(gigApplications.status, 'pending'), eq(gigApplications.status, 'accepted'), eq(gigApplications.status, 'declined'))))
            .orderBy(desc(gigApplications.createdAt))
        : []
      return mine.map((g: any) => ({
        id: g.id, title: g.title, kind: g.kind, status: g.status, when: g.when, location: g.location,
        applications: apps.filter((a: any) => a.gigId === g.id).map(({ gigId: _g, page, ...a }: any) => ({ ...a, page: page?.username ? page : null })),
      }))
    }),

  // Accept or decline an application; the applicant gets an email.
  decideApplication: protectedProcedure
    .input(z.object({ applicationId: z.string().uuid(), decision: z.enum(['accepted', 'declined']) }))
    .mutation(async ({ ctx, input }) => {
      assertScope(ctx, 'business:publish')
      const [app] = await ctx.db.select().from(gigApplications).where(eq(gigApplications.id, input.applicationId))
      if (!app || app.status === 'withdrawn') throw new TRPCError({ code: 'NOT_FOUND', message: 'Application not found.' })
      const [gig] = await gigsIManage(ctx, [app.gigId])
      if (!gig) throw new TRPCError({ code: 'FORBIDDEN', message: 'Only whoever posted the gig can answer its applications.' })
      await ctx.db.update(gigApplications).set({ status: input.decision, decidedBy: ctx.dancerId, decidedAt: new Date(), updatedAt: new Date() }).where(eq(gigApplications.id, app.id))
      try {
        const [who] = await ctx.db.select({ name: dancers.name, email: dancers.email }).from(dancers).where(eq(dancers.id, app.dancerId))
        if (who) await sendGigDecisionEmail({ to: who.email, name: who.name, gigTitle: gig.title, accepted: input.decision === 'accepted', poster: { name: gig.posterName, email: gig.contactEmail }, link: `${ctx.origin || siteOrigin()}/gigs` })
      } catch (e) { console.error('[gigs.decideApplication] email failed', (e as Error).message) }
      trackServer(ctx, 'gig_application_decided', { gig_id: gig.id, category: gig.category, decision: input.decision, hours_to_decide: hoursBetween(app.createdAt) })
      return { id: app.id, status: input.decision }
    }),

  // Close a gig (authenticated owner only)
  close: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [gig] = await ctx.db
        .select()
        .from(gigs)
        .where(eq(gigs.id, input.id))

      if (!gig) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Gig not found' })
      }

      if (gig.dancerId !== ctx.dancerId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only close your own gigs' })
      }

      await ctx.db
        .update(gigs)
        .set({ status: 'closed', updatedAt: new Date() })
        .where(eq(gigs.id, input.id))

      return { success: true }
    }),
})
