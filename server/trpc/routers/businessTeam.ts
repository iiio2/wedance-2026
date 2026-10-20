import { z } from 'zod'
import { eq, and, desc, inArray, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure, adminProcedure } from '../trpc'
import { profiles, profileMembers, profileClaims, profileAccessLog, dancers } from '../../database/schema'
import { profileByHandle, membershipOf, requireOwner, keepAnOwner, grant, logAccess, assertProfileGranted } from '../../utils/profileAccess'
import { sendAccessDecisionEmail, sendInfoRequiredEmail } from '../../utils/email'
import { trackServer } from '../../utils/posthog'

/**
 * Business mode — teams. Who may join a profile, with which role, and who decides:
 *
 *   claim    nobody manages it          → WeDance admin   (business.decideClaim)
 *   join     ask the owners for a role  → the owners      (decideJoin here; admins too)
 *   reclaim  "it's mine, someone else has it" → WeDance admin, never the owners
 *
 * Roles: owner (edit + team) · editor (edit). A title ("Promoter") is display only.
 */

const role = z.enum(['owner', 'editor'])
const title = z.string().trim().max(60).nullable().optional()

// Best-effort: a failed email (or no Nuxt runtime, in tests) never undoes a decision.
export async function notifyDecision(db: any, requesterId: string, profile: { name: string; username: string }, approved: boolean, r: 'owner' | 'editor') {
  try {
    const [d] = await db.select({ email: dancers.email, name: dancers.name }).from(dancers).where(eq(dancers.id, requesterId))
    if (!d) return
    const siteUrl = useRuntimeConfig().siteUrl || 'http://localhost:3000'
    await sendAccessDecisionEmail({
      to: d.email, name: d.name || 'there', profileName: profile.name, approved, role: r,
      link: `${siteUrl}/business/network/${profile.username}`,
    })
  } catch (e: any) {
    console.warn('access decision email not sent:', e?.message)
  }
}

// Best-effort: ask the claimant for more info. Never undoes a decision on failure.
export async function notifyInfoRequired(db: any, requesterId: string, profile: { name: string; username: string }, reviewerNote: string) {
  try {
    const [d] = await db.select({ email: dancers.email, name: dancers.name }).from(dancers).where(eq(dancers.id, requesterId))
    if (!d) return
    const siteUrl = useRuntimeConfig().siteUrl || 'http://localhost:3000'
    await sendInfoRequiredEmail({
      to: d.email, name: d.name || 'there', profileName: profile.name,
      reviewerNote, link: `${siteUrl}/business/claim?profile=${profile.username}`,
    })
  } catch (e: any) {
    console.warn('info-required email not sent:', e?.message)
  }
}

/** Pending join requests on profiles I own — for the /business home inbox. */
export async function joinRequestsForOwner(db: any, dancerId: string) {
  const owned = await db.select({ profileId: profileMembers.profileId }).from(profileMembers)
    .where(and(eq(profileMembers.dancerId, dancerId), eq(profileMembers.role, 'owner')))
  if (!owned.length) return []
  return db.select({
    id: profileClaims.id, profileId: profiles.id, profileName: profiles.name, profileUsername: profiles.username,
    dancerName: dancers.name, requestedRole: profileClaims.requestedRole, title: profileClaims.title,
  })
    .from(profileClaims)
    .innerJoin(profiles, eq(profiles.id, profileClaims.profileId))
    .innerJoin(dancers, eq(dancers.id, profileClaims.dancerId))
    .where(and(
      inArray(profileClaims.profileId, owned.map((o: any) => o.profileId)),
      eq(profileClaims.kind, 'join'), eq(profileClaims.status, 'pending'),
    ))
}

export const businessTeamRouter = router({
  // One entry point for "let me in". Unmanaged profiles always become a claim.
  requestAccess: protectedProcedure
    .input(z.object({
      username: z.string().min(1),
      kind: z.enum(['claim', 'join', 'reclaim']),
      role: role.default('editor'),
      title,
      message: z.string().trim().min(3, 'Tell us who you are and how we can check it.').max(1000),
      evidence: z.string().trim().max(2000).default(''),
      evidenceType: z.enum(['domain_email', 'social_media', 'website_link', 'documentation', 'other']).default('other'),
    }))
    .mutation(async ({ ctx, input }) => {
      const p = await profileByHandle(ctx.db, input.username)
      if (await membershipOf(ctx.db, p.id, ctx.dancerId)) {
        throw new TRPCError({ code: 'CONFLICT', message: 'You’re already on this team.' })
      }
      const [anyMember] = await ctx.db.select({ id: profileMembers.id }).from(profileMembers).where(eq(profileMembers.profileId, p.id)).limit(1)
      const kind = anyMember ? input.kind : 'claim'
      if (anyMember && kind === 'claim') {
        throw new TRPCError({ code: 'CONFLICT', message: 'Someone already manages this profile. Ask to join the team, or tell us it’s yours.' })
      }
      const requestedRole = kind === 'join' ? input.role : 'owner'
      const values = {
        kind, requestedRole, title: input.title ?? null, message: input.message,
        evidence: input.evidence, evidenceType: input.evidenceType,
        status: 'pending' as const, reviewerNote: '', createdAt: new Date(), decidedAt: null, decidedBy: null,
      }
      await ctx.db.insert(profileClaims)
        .values({ profileId: p.id, dancerId: ctx.dancerId, ...values })
        .onConflictDoUpdate({ target: [profileClaims.profileId, profileClaims.dancerId], set: values })
      await logAccess(ctx.db, { profileId: p.id, actorId: ctx.dancerId, subjectId: ctx.dancerId, action: 'requested', role: requestedRole, note: kind })
      trackServer(ctx, kind === 'join' ? 'team_join_requested' : 'profile_claim_requested', { profile: p.username, profile_type: p.type, kind, evidence_type: input.evidenceType })
      return { requested: true, kind, reviewer: kind === 'join' ? 'owners' as const : 'wedance' as const }
    }),

  // The team of a profile I'm on. Owners also get pending join requests.
  team: protectedProcedure
    .input(z.object({ username: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const p = await profileByHandle(ctx.db, input.username)
      const me = await membershipOf(ctx.db, p.id, ctx.dancerId)
      if (!me && !ctx.isAdmin) throw new TRPCError({ code: 'FORBIDDEN', message: 'You don’t manage this profile.' })
      assertProfileGranted(ctx, p.id)
      const isOwner = me?.role === 'owner' || !!ctx.isAdmin
      const members = await ctx.db
        .select({ dancerId: profileMembers.dancerId, role: profileMembers.role, title: profileMembers.title, name: dancers.name, username: dancers.username, photo: dancers.photo, since: profileMembers.createdAt })
        .from(profileMembers).innerJoin(dancers, eq(dancers.id, profileMembers.dancerId))
        .where(eq(profileMembers.profileId, p.id))
        .orderBy(sql`case when ${profileMembers.role} = 'owner' then 0 else 1 end`, profileMembers.createdAt)
      const requests = isOwner
        ? await ctx.db
          .select({ id: profileClaims.id, requestedRole: profileClaims.requestedRole, title: profileClaims.title, message: profileClaims.message, createdAt: profileClaims.createdAt, name: dancers.name, username: dancers.username })
          .from(profileClaims).innerJoin(dancers, eq(dancers.id, profileClaims.dancerId))
          .where(and(eq(profileClaims.profileId, p.id), eq(profileClaims.kind, 'join'), eq(profileClaims.status, 'pending')))
          .orderBy(profileClaims.createdAt)
        : []
      return {
        profile: { username: p.username, name: p.name, type: p.type },
        myRole: (me?.role ?? (ctx.isAdmin ? 'owner' : null)) as 'owner' | 'editor' | null,
        myId: ctx.dancerId,
        members: members.map((m: any) => ({ ...m, me: m.dancerId === ctx.dancerId })),
        requests,
      }
    }),

  decideJoin: protectedProcedure
    .input(z.object({ requestId: z.string().uuid(), approve: z.boolean(), role: role.optional(), title }))
    .mutation(async ({ ctx, input }) => {
      const [r] = await ctx.db.select().from(profileClaims).where(eq(profileClaims.id, input.requestId))
      if (!r || r.kind !== 'join') throw new TRPCError({ code: 'NOT_FOUND', message: 'Request not found.' })
      if (r.status !== 'pending') throw new TRPCError({ code: 'CONFLICT', message: 'This request was already decided.' })
      const [p] = await ctx.db.select().from(profiles).where(eq(profiles.id, r.profileId))
      await requireOwner(ctx, p.username)
      const finalRole = input.role ?? r.requestedRole
      await ctx.db.update(profileClaims)
        .set({ status: input.approve ? 'approved' : 'rejected', decidedAt: new Date(), decidedBy: ctx.dancerId })
        .where(eq(profileClaims.id, r.id))
      if (input.approve) await grant(ctx.db, p.id, r.dancerId, finalRole, { title: input.title ?? r.title, by: ctx.dancerId })
      await logAccess(ctx.db, { profileId: p.id, actorId: ctx.dancerId, subjectId: r.dancerId, action: input.approve ? 'approved' : 'rejected', role: finalRole, note: 'join' })
      await notifyDecision(ctx.db, r.dancerId, p, input.approve, finalRole)
      return { status: input.approve ? 'approved' : 'rejected' }
    }),

  setRole: protectedProcedure
    .input(z.object({ username: z.string().min(1), dancerId: z.string().uuid(), role, title }))
    .mutation(async ({ ctx, input }) => {
      const p = await requireOwner(ctx, input.username)
      const m = await membershipOf(ctx.db, p.id, input.dancerId)
      if (!m) throw new TRPCError({ code: 'NOT_FOUND', message: 'They’re not on this team.' })
      if (m.role === 'owner' && input.role !== 'owner') await keepAnOwner(ctx.db, p.id, input.dancerId)
      await ctx.db.update(profileMembers)
        .set({ role: input.role, ...(input.title !== undefined ? { title: input.title } : {}) })
        .where(eq(profileMembers.id, m.id))
      if (m.role !== input.role) {
        await logAccess(ctx.db, { profileId: p.id, actorId: ctx.dancerId, subjectId: input.dancerId, action: 'role_changed', role: input.role, note: `${m.role} → ${input.role}` })
      }
      return { saved: true }
    }),

  // Owners remove anyone; anyone may remove themselves (leave). Never the last owner.
  removeMember: protectedProcedure
    .input(z.object({ username: z.string().min(1), dancerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const leaving = input.dancerId === ctx.dancerId
      const p = leaving ? await profileByHandle(ctx.db, input.username) : await requireOwner(ctx, input.username)
      const m = await membershipOf(ctx.db, p.id, input.dancerId)
      if (!m) throw new TRPCError({ code: 'NOT_FOUND', message: 'They’re not on this team.' })
      await keepAnOwner(ctx.db, p.id, input.dancerId)
      await ctx.db.delete(profileMembers).where(eq(profileMembers.id, m.id))
      await logAccess(ctx.db, { profileId: p.id, actorId: ctx.dancerId, subjectId: input.dancerId, action: leaving ? 'left' : 'removed', role: m.role })
      return { removed: true }
    }),

  // Admins: release the page — everyone leaves its team, so its owner (an
  // artist, a venue) can take it over from an invite link or a claim. For pages
  // a WeDance admin set up while testing or on their behalf. Each removal is
  // logged. `claimed` stays true so the v3 sync still leaves the details alone.
  release: adminProcedure
    .input(z.object({ username: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const p = await profileByHandle(ctx.db, input.username)
      const members = await ctx.db.select({ id: profileMembers.id, dancerId: profileMembers.dancerId, role: profileMembers.role })
        .from(profileMembers).where(eq(profileMembers.profileId, p.id))
      for (const m of members) {
        await ctx.db.delete(profileMembers).where(eq(profileMembers.id, m.id))
        await logAccess(ctx.db, { profileId: p.id, actorId: ctx.dancerId, subjectId: m.dancerId, action: 'removed', role: m.role, note: 'Page released by WeDance for its owner to claim.' })
      }
      return { released: members.length }
    }),

  // Who got, lost or changed access, newest first. Owners and admins only.
  history: protectedProcedure
    .input(z.object({ username: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const p = await requireOwner(ctx, input.username)
      const actor = alias(dancers, 'actor')
      const subject = alias(dancers, 'subject')
      return ctx.db
        .select({ id: profileAccessLog.id, action: profileAccessLog.action, role: profileAccessLog.role, note: profileAccessLog.note, createdAt: profileAccessLog.createdAt, actorName: actor.name, subjectName: subject.name })
        .from(profileAccessLog)
        .leftJoin(actor, eq(actor.id, profileAccessLog.actorId))
        .leftJoin(subject, eq(subject.id, profileAccessLog.subjectId))
        .where(eq(profileAccessLog.profileId, p.id))
        .orderBy(desc(profileAccessLog.createdAt))
        .limit(100)
    }),
})
