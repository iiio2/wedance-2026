import { z } from 'zod'
import { eq, and, gte, lte, desc, inArray } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, adminProcedure, protectedProcedure } from '../trpc'
import { events, giveaways, giveawayEntries, giveawayProposals, profileMembers, profiles, trackedLinks } from '../../database/schema'
import { requireMember } from './business'
import { requireEventManager } from './businessEvents'
import { onlyGranted } from '../../utils/profileAccess'
import { assertScope } from '../scopes'
import { siteOrigin } from '../../oauth/config'
import { eventPath } from '../../../shared/utils/eventSlug'
import { linkUrl } from '../../utils/trackedLinks'
import { eventLocalDate } from '../../../shared/utils/eventTime'

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

/** A proposal with what the organizer needs to decide. */
const proposalColumns = {
  id: giveawayProposals.id, eventId: giveawayProposals.eventId, prize: giveawayProposals.prize, description: giveawayProposals.description,
  sponsorName: giveawayProposals.sponsorName, endsAt: giveawayProposals.endsAt, status: giveawayProposals.status, note: giveawayProposals.note,
  giveawayId: giveawayProposals.giveawayId, createdAt: giveawayProposals.createdAt,
  page: { username: profiles.username, name: profiles.name, type: profiles.type, roles: profiles.roles },
  event: { name: events.name, startDate: events.startDate, timezone: events.timezone, city: events.city },
}
const shapeProposal = (r: any) => ({
  ...r,
  page: { username: r.page.username, name: r.page.name, influencer: (r.page.roles ?? []).includes('influencer') },
  event: { id: r.eventId, name: r.event.name, date: r.event.startDate ? eventLocalDate(r.event.startDate, r.event.timezone || 'Europe/Berlin') : null, city: r.event.city },
})

export const giveawayRouter = router({
  // Admin: every giveaway across cities, newest first (moderation dashboard).
  listAll: adminProcedure
    .input(z.object({ citySlug: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select()
        .from(giveaways)
        .where(input?.citySlug ? eq(giveaways.citySlug, input.citySlug) : undefined)
        .orderBy(desc(giveaways.createdAt))
      return rows
    }),

  // Active giveaways for a city: status='active' AND now within [startsAt, endsAt].
  // Returns [] (never a fabricated sponsor) when the city has none.
  listActive: publicProcedure
    .input(z.object({ citySlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const now = new Date()
      return ctx.db
        .select({
          id: giveaways.id,
          sponsorName: giveaways.sponsorName,
          title: giveaways.title,
          description: giveaways.description,
          prizeDescription: giveaways.prizeDescription,
          ctaUrl: giveaways.ctaUrl,
          imageUrl: giveaways.imageUrl,
          termsUrl: giveaways.termsUrl,
          startsAt: giveaways.startsAt,
          endsAt: giveaways.endsAt,
        })
        .from(giveaways)
        .where(and(
          eq(giveaways.citySlug, input.citySlug),
          eq(giveaways.status, 'active'),
          lte(giveaways.startsAt, now),
          gte(giveaways.endsAt, now),
        ))
        .orderBy(desc(giveaways.endsAt))
    }),

  // Free-entry (no purchase). One entry per email per giveaway — a duplicate
  // is reported as `alreadyEntered`, not an error.
  enter: publicProcedure
    .input(z.object({
      giveawayId: z.string().uuid(),
      email: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      const now = new Date()
      const [g] = await ctx.db
        .select({ id: giveaways.id, status: giveaways.status, startsAt: giveaways.startsAt, endsAt: giveaways.endsAt })
        .from(giveaways)
        .where(eq(giveaways.id, input.giveawayId))

      if (!g) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Giveaway not found.' })
      }
      if (g.status !== 'active' || g.startsAt > now || g.endsAt < now) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This giveaway is not currently open.' })
      }

      try {
        await ctx.db.insert(giveawayEntries).values({
          giveawayId: input.giveawayId,
          dancerId: ctx.dancerId,
          email: input.email,
        })
      } catch (e: any) {
        const msg = (e?.message || '') + (e?.cause?.message || '')
        const code = e?.cause?.code || ''
        if (msg.includes('unique') || msg.includes('duplicate') || code === '23505') {
          return { entered: true, alreadyEntered: true }
        }
        throw e
      }

      return { entered: true, alreadyEntered: false }
    }),

  // ---- proposals (MCP phase 2): promoters/influencers propose, organizers approve ----

  // A promoter or influencer page proposes a giveaway for a published event.
  // Nothing goes public until the event's team approves it.
  propose: protectedProcedure
    .input(z.object({
      eventId: z.string().uuid(),
      profile: z.string().min(1).max(200),
      prize: z.string().trim().min(3).max(200),
      description: z.string().trim().max(1000).default(''),
      sponsorName: z.string().trim().max(120).optional(),
      endsOn: ymd.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const page = await requireMember(ctx, input.profile)
      const [ev] = await ctx.db.select().from(events).where(eq(events.id, input.eventId))
      if (!ev || !ev.published || ev.archived) throw new TRPCError({ code: 'NOT_FOUND', message: 'No published event with that id.' })
      if (!ev.startDate || new Date(ev.startDate).getTime() < Date.now()) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This event has started already.' })
      const [open] = await ctx.db.select({ id: giveawayProposals.id }).from(giveawayProposals)
        .where(and(eq(giveawayProposals.eventId, ev.id), eq(giveawayProposals.profileId, page.id), eq(giveawayProposals.status, 'pending')))
      if (open) throw new TRPCError({ code: 'CONFLICT', message: 'This page already has a giveaway proposal waiting for this event.' })
      const endsAt = input.endsOn ? new Date(`${input.endsOn}T22:00:00Z`) : null
      if (endsAt && endsAt.getTime() < Date.now()) throw new TRPCError({ code: 'BAD_REQUEST', message: 'The end date is in the past.' })
      const [row] = await ctx.db.insert(giveawayProposals).values({
        eventId: ev.id, proposedBy: ctx.dancerId, profileId: page.id, prize: input.prize, description: input.description,
        sponsorName: input.sponsorName || null, endsAt,
      }).returning({ id: giveawayProposals.id, status: giveawayProposals.status })
      return { id: row!.id, status: row!.status, next: 'The event’s organizer decides. It shows in their giveaway proposals.' }
    }),

  // Proposals for the events I run (one event, or all my pages' events).
  proposals: protectedProcedure
    .input(z.object({ eventId: z.string().uuid().optional(), status: z.enum(['pending', 'approved', 'declined']).optional() }).optional())
    .query(async ({ ctx, input }) => {
      let eventIds: string[]
      if (input?.eventId) {
        await requireEventManager(ctx, input.eventId)
        eventIds = [input.eventId]
      } else {
        const pages = await ctx.db.select({ id: profileMembers.profileId }).from(profileMembers).where(eq(profileMembers.dancerId, ctx.dancerId))
        const pageIds = onlyGranted(ctx, pages, (p: any) => p.id).map((p: any) => p.id)
        if (!pageIds.length) return []
        eventIds = (await ctx.db.select({ id: events.id }).from(events).where(inArray(events.hostProfileId, pageIds))).map((e: any) => e.id)
      }
      if (!eventIds.length) return []
      const rows = await ctx.db.select(proposalColumns).from(giveawayProposals)
        .innerJoin(profiles, eq(profiles.id, giveawayProposals.profileId))
        .innerJoin(events, eq(events.id, giveawayProposals.eventId))
        .where(and(inArray(giveawayProposals.eventId, eventIds), input?.status ? eq(giveawayProposals.status, input.status) : undefined))
        .orderBy(desc(giveawayProposals.createdAt)).limit(100)
      return rows.map(shapeProposal)
    }),

  // The event's team approves (it becomes a live giveaway in the event's city,
  // pointing at the event through the proposer's tracked link) or declines.
  decideProposal: protectedProcedure
    .input(z.object({ proposalId: z.string().uuid(), approve: z.boolean(), endsOn: ymd.optional(), note: z.string().trim().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      assertScope(ctx, 'business:publish')
      const [p] = await ctx.db.select().from(giveawayProposals).where(eq(giveawayProposals.id, input.proposalId))
      if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal not found.' })
      const ev = await requireEventManager(ctx, p.eventId)
      if (p.status !== 'pending') throw new TRPCError({ code: 'BAD_REQUEST', message: `This proposal was ${p.status} already.` })
      const decided = { decidedBy: ctx.dancerId, decidedAt: new Date(), note: input.note ?? null }
      if (!input.approve) {
        await ctx.db.update(giveawayProposals).set({ ...decided, status: 'declined' }).where(eq(giveawayProposals.id, p.id))
        return { status: 'declined' as const, giveawayId: null }
      }
      const [page] = await ctx.db.select({ name: profiles.name }).from(profiles).where(eq(profiles.id, p.profileId))
      const [link] = await ctx.db.select({ code: trackedLinks.code }).from(trackedLinks).where(and(eq(trackedLinks.eventId, ev.id), eq(trackedLinks.profileId, p.profileId)))
      const origin = ctx.origin || siteOrigin()
      const endsAt = input.endsOn ? new Date(`${input.endsOn}T22:00:00Z`) : (p.endsAt ?? new Date(ev.startDate ?? Date.now()))
      if (endsAt.getTime() <= Date.now()) throw new TRPCError({ code: 'BAD_REQUEST', message: 'The giveaway would already be over: give an end date.' })
      const [g] = await ctx.db.insert(giveaways).values({
        citySlug: ev.citySlug ?? 'online', sponsorName: p.sponsorName || page?.name || 'WeDance',
        title: `Win: ${p.prize}`, description: p.description || `${p.prize} for ${ev.name}.`, prizeDescription: p.prize,
        ctaUrl: link ? linkUrl(origin, ev, link.code) : `${origin}${eventPath(ev)}`,
        imageUrl: ev.cover || null, startsAt: new Date(), endsAt, status: 'active',
      }).returning({ id: giveaways.id })
      await ctx.db.update(giveawayProposals).set({ ...decided, status: 'approved', giveawayId: g!.id }).where(eq(giveawayProposals.id, p.id))
      return { status: 'approved' as const, giveawayId: g!.id, endsAt }
    }),

  // ---- admin ----

  create: adminProcedure
    .input(z.object({
      citySlug: z.string().min(1),
      sponsorName: z.string().min(1),
      title: z.string().min(1),
      description: z.string().min(1),
      prizeDescription: z.string().min(1),
      ctaUrl: z.string().url(),
      imageUrl: z.string().url().optional(),
      termsUrl: z.string().url().optional(),
      startsAt: z.coerce.date(),
      endsAt: z.coerce.date(),
      status: z.enum(['active', 'ended', 'draft']).default('active'),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.endsAt <= input.startsAt) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'endsAt must be after startsAt.' })
      }
      const [row] = await ctx.db
        .insert(giveaways)
        .values({
          citySlug: input.citySlug,
          sponsorName: input.sponsorName,
          title: input.title,
          description: input.description,
          prizeDescription: input.prizeDescription,
          ctaUrl: input.ctaUrl,
          imageUrl: input.imageUrl ?? null,
          termsUrl: input.termsUrl ?? null,
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          status: input.status,
        })
        .returning({ id: giveaways.id })

      return { id: row!.id }
    }),
})
