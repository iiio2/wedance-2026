/**
 * The event RSVP as the organiser's poll (RAZ-718). A tap counts at once: a
 * signed-out answer is stored against an anonymous browser token, unconfirmed,
 * and the magic link (auth.requestMagicLink with redirect + do + guest) brings
 * the dancer back to answer again signed in, which confirms it and drops the
 * guest row. Answers, option sets and the summary: shared/utils/rsvp.ts.
 *
 * A confirmed "yes" answer also keeps the dancer's plan in step (plan_items +
 * attendances, like Going! did); "Next time" takes the event off the plan and
 * follows the organiser for the next date.
 */
import { z } from 'zod'
import { and, eq, gt, inArray, isNotNull, isNull, ne, or, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { attendances, dancers, eventRsvps, events, festivalWaves, follows, planItems, profiles } from '../../database/schema'
import { publicEventWhere } from '../../utils/eventLookup'
import { eventGroup, trackServer } from '../../utils/posthog'
import { requireEventManager } from './businessEvents'
import {
  RSVP_ANSWERS, UNCONFIRMED_TTL_HOURS, isPartnerEvent, pairingAnswer, rsvpSummaryLine, summarizeRsvps,
  type RsvpAnswer,
} from '../../../shared/utils/rsvp'

const eventParam = z.string().min(1).max(160)
const guestToken = z.string().uuid()

type Ev = { id: string; styles: string[] | null; organizerUsername: string | null; venueUsername: string | null }

async function findEvent(db: any, param: string): Promise<Ev> {
  for (const where of publicEventWhere(param)) {
    const [row] = await db
      .select({ id: events.id, styles: events.styles, organizerUsername: events.organizerUsername, venueUsername: events.venueUsername })
      .from(events).where(where).limit(1)
    if (row) return row
  }
  throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' })
}

/** Answers that count: every confirmed one, plus unconfirmed ones younger than the TTL. */
function countedWhere(eventId: string) {
  const fresh = new Date(Date.now() - UNCONFIRMED_TTL_HOURS * 3600_000)
  return and(eq(eventRsvps.eventId, eventId), or(isNotNull(eventRsvps.confirmedAt), gt(eventRsvps.updatedAt, fresh)))
}

async function summary(db: any, eventId: string) {
  const rows = await db
    .select({ answer: eventRsvps.answer, confirmedAt: eventRsvps.confirmedAt })
    .from(eventRsvps).where(countedWhere(eventId))
  return summarizeRsvps(rows.map((r: any) => ({ answer: r.answer, confirmed: !!r.confirmedAt })))
}

/** The poll as one viewer sees it: counts, their own answer, and who pairs with them. */
async function pollFor(db: any, ev: Ev, viewer: { dancerId: string | null; guestToken?: string }) {
  const s = await summary(db, ev.id)
  const mineWhere = viewer.dancerId
    ? eq(eventRsvps.dancerId, viewer.dancerId)
    : viewer.guestToken ? and(isNull(eventRsvps.dancerId), eq(eventRsvps.guestToken, viewer.guestToken)) : null
  const [mine] = mineWhere
    ? await db.select({ answer: eventRsvps.answer, confirmedAt: eventRsvps.confirmedAt })
        .from(eventRsvps).where(and(eq(eventRsvps.eventId, ev.id), mineWhere)).limit(1)
    : []

  // Pairing: a confirmed "I need a leader" sees the confirmed "I need a follower"s (and back).
  let matches: { dancerId: string; name: string; photo: string | null; username: string | null; waved: boolean }[] = []
  const want = mine?.confirmedAt ? pairingAnswer(mine.answer) : null
  if (want && viewer.dancerId) {
    const rows = await db
      .select({ dancerId: dancers.id, name: dancers.name, photo: dancers.photo, username: dancers.username })
      .from(eventRsvps)
      .innerJoin(dancers, eq(eventRsvps.dancerId, dancers.id))
      .where(and(
        eq(eventRsvps.eventId, ev.id),
        eq(eventRsvps.answer, want),
        isNotNull(eventRsvps.confirmedAt),
        ne(dancers.id, viewer.dancerId),
        eq(dancers.profilePublic, true),
      ))
      .limit(12)
    const ids = rows.map((r: any) => r.dancerId)
    const waved = ids.length
      ? new Set((await db.select({ id: festivalWaves.targetDancerId }).from(festivalWaves).where(and(
          eq(festivalWaves.festivalSlug, ev.id),
          eq(festivalWaves.dancerId, viewer.dancerId),
          inArray(festivalWaves.targetDancerId, ids),
        ))).map((w: any) => w.id))
      : new Set()
    // First name only: they answered a class poll, not published a profile.
    matches = rows.map((r: any) => ({ dancerId: r.dancerId, name: String(r.name || '').split(' ')[0], photo: r.photo, username: r.username, waved: waved.has(r.dancerId) }))
  }

  return {
    eventId: ev.id,
    partner: isPartnerEvent(ev.styles),
    counts: s.counts,
    unconfirmed: s.unconfirmed,
    coming: s.coming,
    mine: mine ? { answer: mine.answer as RsvpAnswer, confirmed: !!mine.confirmedAt } : null,
    matches,
  }
}

/** A dancer's answer also keeps their plan in step: yes → on the plan, next → off it + follow the organiser. */
async function syncPlan(db: any, dancerId: string, ev: Ev, answer: RsvpAnswer) {
  try {
    if (answer === 'next') {
      await db.delete(planItems).where(and(eq(planItems.dancerId, dancerId), eq(planItems.itemType, 'event'), eq(planItems.itemId, ev.id)))
      await db.delete(attendances).where(and(eq(attendances.eventId, ev.id), eq(attendances.dancerId, dancerId), ne(attendances.status, 'ticket_holder')))
      if (ev.organizerUsername) {
        const [org] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, ev.organizerUsername)).limit(1)
        if (org) await db.insert(follows).values({ dancerId, profileId: org.id }).onConflictDoNothing()
      }
    } else {
      await db.insert(planItems).values({ dancerId, itemType: 'event', itemId: ev.id }).onConflictDoNothing()
      await db.insert(attendances).values({ eventId: ev.id, dancerId, status: 'going', source: 'click', visibility: 'hidden' }).onConflictDoNothing()
    }
  } catch (e) {
    // The answer itself is saved; the plan mirror is best-effort.
    console.warn('[rsvp] plan sync failed', (e as Error)?.message ?? e)
  }
}

export const rsvpRouter = router({
  /** Counts (visible before you answer), my answer, and who pairs with me. */
  poll: publicProcedure
    .input(z.object({ event: eventParam, guestToken: guestToken.optional() }))
    .query(async ({ ctx, input }) => {
      const ev = await findEvent(ctx.db, input.event)
      return pollFor(ctx.db, ev, { dancerId: ctx.dancerId ?? null, guestToken: input.guestToken })
    }),

  /**
   * Answer the poll. Signed in: saved confirmed (and any answer this browser
   * gave before signing in is folded in — that is the magic-link confirmation).
   * Signed out: saved against `guestToken`, unconfirmed.
   */
  answer: publicProcedure
    .input(z.object({ event: eventParam, answer: z.enum(RSVP_ANSWERS), guestToken: guestToken.optional() }))
    .mutation(async ({ ctx, input }) => {
      const ev = await findEvent(ctx.db, input.event)
      const now = new Date()
      const dancerId = ctx.dancerId ?? null

      if (!dancerId) {
        if (!input.guestToken) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Missing guest token' })
        await ctx.db.insert(eventRsvps)
          .values({ eventId: ev.id, guestToken: input.guestToken, answer: input.answer })
          .onConflictDoUpdate({ target: [eventRsvps.eventId, eventRsvps.guestToken], set: { answer: input.answer, updatedAt: now } })
        trackServer(ctx, 'rsvp_answered', { event_id: ev.id, answer: input.answer, signed_in: false, confirmed: false, ...eventGroup(ev) })
        return pollFor(ctx.db, ev, { dancerId: null, guestToken: input.guestToken })
      }

      // The unconfirmed answer this browser (or this magic link) gave before signing in.
      const [guest] = input.guestToken
        ? await ctx.db.select({ id: eventRsvps.id, createdAt: eventRsvps.createdAt }).from(eventRsvps)
            .where(and(eq(eventRsvps.eventId, ev.id), eq(eventRsvps.guestToken, input.guestToken), isNull(eventRsvps.dancerId))).limit(1)
        : []
      if (guest) await ctx.db.delete(eventRsvps).where(eq(eventRsvps.id, guest.id))

      await ctx.db.insert(eventRsvps)
        .values({ eventId: ev.id, dancerId, answer: input.answer, confirmedAt: now })
        .onConflictDoUpdate({
          target: [eventRsvps.eventId, eventRsvps.dancerId],
          set: { answer: input.answer, updatedAt: now, confirmedAt: sql`coalesce(${eventRsvps.confirmedAt}, ${now})` },
        })
      await syncPlan(ctx.db, dancerId, ev, input.answer)

      if (guest) {
        const hours = guest.createdAt ? Math.round((now.getTime() - new Date(guest.createdAt).getTime()) / 360_000) / 10 : null
        trackServer(ctx, 'rsvp_confirmed', { event_id: ev.id, answer: input.answer, hours_to_confirm: hours, ...eventGroup(ev) })
      } else {
        trackServer(ctx, 'rsvp_answered', { event_id: ev.id, answer: input.answer, signed_in: true, confirmed: true, ...eventGroup(ev) })
      }
      return pollFor(ctx.db, ev, { dancerId })
    }),

  /** The organiser's view: the same buckets plus a one-line read. Event managers only. */
  summary: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      const s = await summary(ctx.db, ev.id)
      const partner = isPartnerEvent(ev.styles)
      // Festivals keep their ticket flow; the poll is for dated events.
      return { ...s, partner, festival: !!ev.isFestival, line: rsvpSummaryLine(s, partner) }
    }),
})
