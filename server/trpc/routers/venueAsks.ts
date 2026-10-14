import { z } from 'zod'
import { eq, and, ne, desc, inArray, gte } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { profiles, profileMembers, profileInvites, events } from '../../database/schema'
import { requireEventManager } from './businessEvents'
import type { VenueRequest, VenueTerms } from '../../../shared/types/venueAsk'
import { contactsFor } from '../../../shared/utils/contacts'

/**
 * Asking venues through WeDance — the venue twin of the artist link. The
 * organizer asks one or more venues for an event (what they need, how many
 * guests); each venue gets a personal link (/confirm/<token>, the same page as
 * artists) and answers: can host it, another date, or no — with its terms.
 * The organizer compares the answers and books one; the others' links then say
 * it was booked elsewhere. A venue whose page someone runs here also gets the
 * ask under "Needs you" on its Business home (no notification is sent).
 *
 * Terms are only for the organizer who asked (and the venue).
 */

const token = () => crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').slice(0, 8)
const requestInput = z.object({
  guests: z.number().int().min(1).max(100_000).nullable().optional(),
  needs: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  note: z.string().trim().max(1000).default(''),
})

async function hasTeam(db: any, profileId: string) {
  const [m] = await db.select({ id: profileMembers.id }).from(profileMembers).where(eq(profileMembers.profileId, profileId)).limit(1)
  return !!m
}

export const venueAsksRouter = router({
  // Ask a venue (or update what was asked): returns its link and a message to paste.
  ask: protectedProcedure
    .input(z.object({ eventId: z.string().uuid(), venue: z.string().min(1).max(200), request: requestInput }))
    .mutation(async ({ ctx, input }) => {
      await requireEventManager(ctx, input.eventId)
      const [v] = await ctx.db.select({ id: profiles.id, type: profiles.type, name: profiles.name, username: profiles.username, city: profiles.city, socials: profiles.socials, contact: profiles.contact, mapUrl: profiles.mapUrl }).from(profiles).where(eq(profiles.username, input.venue))
      if (!v || v.type !== 'venue') throw new TRPCError({ code: 'NOT_FOUND', message: 'That venue isn’t on WeDance.' })
      const request: VenueRequest = { guests: input.request.guests ?? null, needs: input.request.needs, note: input.request.note }
      const [existing] = await ctx.db.select({ id: profileInvites.id, token: profileInvites.token, status: profileInvites.status, notifiedAt: profileInvites.notifiedAt }).from(profileInvites)
        .where(and(eq(profileInvites.eventId, input.eventId), eq(profileInvites.profileId, v.id)))
      const t = existing?.token ?? token()
      if (existing) await ctx.db.update(profileInvites).set({ kind: 'venue', request }).where(eq(profileInvites.id, existing.id))
      else await ctx.db.insert(profileInvites).values({ token: t, profileId: v.id, eventId: input.eventId, createdBy: ctx.dancerId, kind: 'venue', request })
      const site = (useRuntimeConfig().siteUrl || 'https://2026.wedance.vip').replace(/\/$/, '')
      const [e] = await ctx.db.select({ name: events.name, hostProfileId: events.hostProfileId }).from(events).where(eq(events.id, input.eventId))
      const [h] = e?.hostProfileId ? await ctx.db.select({ name: profiles.name }).from(profiles).where(eq(profiles.id, e.hostProfileId)) : [null]
      return { url: `${site}/confirm/${t}`, eventName: e?.name ?? '', host: h?.name ?? null, venueName: v.name, managed: await hasTeam(ctx.db, v.id), answered: !!existing && existing.status !== 'invited', notifiedAt: existing?.notifiedAt ?? null, contacts: contactsFor(v), handle: v.username }
    }),

  // The venues asked for this event and their answers, for the editor.
  list: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireEventManager(ctx, input.eventId)
      const rows = await ctx.db.select({
        username: profiles.username, name: profiles.name, photo: profiles.photo, address: profiles.address,
        status: profileInvites.status, request: profileInvites.request, terms: profileInvites.terms, alternative: profileInvites.alternative,
        message: profileInvites.message, outcome: profileInvites.outcome, respondedAt: profileInvites.respondedAt, createdAt: profileInvites.createdAt,
      }).from(profileInvites).innerJoin(profiles, eq(profiles.id, profileInvites.profileId))
        .where(and(eq(profileInvites.eventId, input.eventId), eq(profileInvites.kind, 'venue')))
        .orderBy(desc(profileInvites.createdAt))
      return rows.map((r: any) => ({
        ...r,
        status: r.status as 'invited' | 'confirmed' | 'proposed' | 'declined',
        request: (r.request ?? {}) as VenueRequest,
        terms: (r.terms ?? null) as VenueTerms | null,
      }))
    }),

  // Book one of the venues asked: it becomes the event's venue; the others'
  // links say it was booked elsewhere.
  book: protectedProcedure
    .input(z.object({ eventId: z.string().uuid(), venue: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      await requireEventManager(ctx, input.eventId)
      const [v] = await ctx.db.select({ id: profiles.id, username: profiles.username, name: profiles.name, address: profiles.address }).from(profiles).where(eq(profiles.username, input.venue))
      if (!v) throw new TRPCError({ code: 'NOT_FOUND', message: 'That venue isn’t on WeDance.' })
      const [mine] = await ctx.db.select({ id: profileInvites.id }).from(profileInvites)
        .where(and(eq(profileInvites.eventId, input.eventId), eq(profileInvites.profileId, v.id), eq(profileInvites.kind, 'venue')))
      if (!mine) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ask this venue first.' })
      await ctx.db.update(profileInvites).set({ outcome: 'booked' }).where(eq(profileInvites.id, mine.id))
      await ctx.db.update(profileInvites).set({ outcome: 'elsewhere' })
        .where(and(eq(profileInvites.eventId, input.eventId), eq(profileInvites.kind, 'venue'), ne(profileInvites.id, mine.id)))
      // The event's venue, as saving the editor with this venue would set it.
      await ctx.db.update(events).set({ venueUsername: v.username, venueName: v.name, venueAddress: v.address ?? null, updatedAt: new Date() }).where(eq(events.id, input.eventId))
      return { username: v.username, name: v.name }
    }),

  // Undo a booking: every venue asked is open again.
  unbook: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await requireEventManager(ctx, input.eventId)
      await ctx.db.update(profileInvites).set({ outcome: null })
        .where(and(eq(profileInvites.eventId, input.eventId), eq(profileInvites.kind, 'venue')))
      return { ok: true }
    }),
})

/**
 * Links waiting for an answer on pages I manage, for "Needs you" on the
 * Business home: venues asked to host an event, artists asked to confirm
 * they're in a line-up. Answered ones leave the list.
 */
export async function asksWaitingFor(db: any, profileIds: string[]) {
  if (!profileIds.length) return []
  return db.select({ token: profileInvites.token, kind: profileInvites.kind, profileName: profiles.name, eventName: events.name, startDate: events.startDate, timezone: events.timezone })
    .from(profileInvites).innerJoin(profiles, eq(profiles.id, profileInvites.profileId)).innerJoin(events, eq(events.id, profileInvites.eventId))
    .where(and(inArray(profileInvites.profileId, profileIds), eq(profileInvites.status, 'invited'), gte(events.endDate, new Date())))
}
