import { z } from 'zod'
import { eq, and, desc, gte, lt, asc, inArray, isNull, isNotNull, or, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { hangouts, hangoutRsvps, dancers, cities, events, planItems } from '../../database/schema'
import { resolveTimezone } from '../../utils/v3EventSync'
import { citySlugFor } from '../../utils/myPlanFeeds'
import { createPlacesClient, type PlacesClient } from '../../utils/cities/google'
import { nightStart } from '../../../shared/utils/eventTime'

const hangoutKind = z.enum(['dinner', 'bar', 'ride', 'floor', 'coffee'])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DAY = 86400_000
const sessionToken = z.string().regex(/^[\w-]{8,64}$/).optional()

type Db = any

/** A city slug as stored on events/hangouts, from a slug or a typed city name ("München" → "munich"). */
async function resolveCity(db: Db, cityOrSlug: string) {
  const raw = cityOrSlug.trim()
  let [city] = await db
    .select({ slug: cities.slug, countryCode: cities.countryCode, lat: cities.lat, lng: cities.lng })
    .from(cities)
    .where(eq(cities.slug, raw.toLowerCase()))
    .limit(1)
  if (!city) {
    const slug = await citySlugFor(db, raw)
    ;[city] = await db
      .select({ slug: cities.slug, countryCode: cities.countryCode, lat: cities.lat, lng: cities.lng })
      .from(cities)
      .where(eq(cities.slug, slug))
      .limit(1)
    if (!city) return { slug, tz: undefined as string | undefined, lat: null as number | null, lng: null as number | null }
  }
  return { slug: city.slug as string, tz: resolveTimezone(city.countryCode, city.lng) as string | undefined, lat: city.lat as number | null, lng: city.lng as number | null }
}

/** Tonight = from today's 06:00 in the city to tomorrow's 06:00 (after midnight still counts as tonight). */
function tonightWindow(tz: string | undefined, now = new Date()) {
  const since = nightStart(now, tz)
  return { since, until: new Date(since.getTime() + DAY) }
}

/** The dancer's planned events (plan items of type 'event') starting inside a window. */
async function plannedEventIdsIn(db: Db, dancerId: string | null, since: Date, until: Date): Promise<string[]> {
  if (!dancerId) return []
  const rows = await db
    .select({ itemId: planItems.itemId })
    .from(planItems)
    .where(and(eq(planItems.dancerId, dancerId), eq(planItems.itemType, 'event')))
  const ids = rows.map((r: any) => r.itemId as string).filter((id: string) => UUID_RE.test(id))
  if (!ids.length) return []
  const inWindow = await db
    .select({ id: events.id })
    .from(events)
    .where(and(inArray(events.id, ids), gte(events.startDate, since), lt(events.startDate, until)))
  return inWindow.map((r: any) => r.id)
}

/** "HH:MM" → minutes into the night; times before 06:00 belong after midnight. */
export function nightMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  const mins = (h || 0) * 60 + (m || 0)
  return mins < 6 * 60 ? mins + 24 * 60 : mins
}

/** Hangouts linked to an event in the dancer's plan first, then by time of night. Pure — unit-tested. */
export function sortHangouts<T extends { inMyPlan: boolean; time: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => (Number(b.inMyPlan) - Number(a.inMyPlan)) || (nightMinutes(a.time) - nightMinutes(b.time)))
}

const hangoutColumns = {
  id: hangouts.id,
  kind: hangouts.kind,
  title: hangouts.title,
  time: hangouts.time,
  venue: hangouts.venue,
  placeId: hangouts.placeId,
  placeAddress: hangouts.placeAddress,
  placeLat: hangouts.placeLat,
  placeLng: hangouts.placeLng,
  host: hangouts.host,
  peopleCount: hangouts.peopleCount,
  status: hangouts.status,
  dancerId: hangouts.dancerId,
  eventId: hangouts.eventId,
  createdAt: hangouts.createdAt,
}

const eventColumns = {
  eventName: events.name,
  eventStartDate: events.startDate,
  eventTimezone: events.timezone,
  eventVenueName: events.venueName,
}

/** RSVPs for many hangouts in one query. */
async function withRsvps<T extends { id: string }>(db: Db, rows: T[]) {
  const ids = rows.map(r => r.id)
  const rsvps = ids.length
    ? await db.select({ hangoutId: hangoutRsvps.hangoutId, dancerId: hangoutRsvps.dancerId }).from(hangoutRsvps).where(inArray(hangoutRsvps.hangoutId, ids))
    : []
  const by = new Map<string, string[]>()
  for (const r of rsvps) by.set(r.hangoutId, [...(by.get(r.hangoutId) ?? []), r.dancerId])
  return rows.map(r => ({ ...r, rsvpCount: (by.get(r.id) ?? []).length, rsvps: by.get(r.id) ?? [] }))
}

/** Shape the linked event for the client (null when the hangout has none). */
function eventOf(r: any) {
  if (!r.eventId || !r.eventName) return null
  return {
    id: r.eventId as string,
    name: r.eventName as string,
    startDate: r.eventStartDate ? new Date(r.eventStartDate).toISOString() : null,
    timezone: (r.eventTimezone as string | null) ?? null,
    venueName: (r.eventVenueName as string | null) ?? null,
  }
}

let places: PlacesClient | null | undefined
function usePlaces(): PlacesClient | null {
  if (places !== undefined) return places
  // Read at request time, never via runtimeConfig (the key must not be in a build artefact).
  const key = process.env.GOOGLE_MAPS_API_KEY ?? ''
  places = key ? createPlacesClient(key) : null
  return places
}

/**
 * Hangouts — spontaneous activities where dancers can mark they're out.
 * A hangout belongs to a night: the night of the dance event it's linked to
 * (dinner before La Rumba shows on La Rumba's night), or — when it has no
 * event — the night it was posted. Nights run until 06:00 local time.
 */
export const hangoutsRouter = router({
  /**
   * Tonight's active hangouts for a city, plus any linked to an event in the
   * caller's plan tonight (wherever it is). Those come first; then by time.
   * `citySlug` may also be a typed city name ("München").
   */
  listTonight: publicProcedure
    .input(z.object({
      citySlug: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const city = await resolveCity(ctx.db, input.citySlug)
      const { since, until } = tonightWindow(city.tz)
      const myTonight = await plannedEventIdsIn(ctx.db, ctx.dancerId, since, until)

      const onTonight = and(isNotNull(hangouts.eventId), gte(events.startDate, since), lt(events.startDate, until))
      const rows = await ctx.db
        .select({ ...hangoutColumns, ...eventColumns })
        .from(hangouts)
        .leftJoin(events, eq(hangouts.eventId, events.id))
        .where(and(
          eq(hangouts.status, 'active'),
          or(
            and(
              eq(hangouts.citySlug, city.slug),
              or(and(isNull(hangouts.eventId), gte(hangouts.createdAt, since)), onTonight),
            ),
            myTonight.length ? and(inArray(hangouts.eventId, myTonight), onTonight) : sql`false`,
          ),
        ))
        .orderBy(desc(hangouts.createdAt))

      const mine = new Set(myTonight)
      const shaped = rows.map((r: any) => {
        const { eventName, eventStartDate, eventTimezone, eventVenueName, ...h } = r
        return { ...h, event: eventOf(r), inMyPlan: !!r.eventId && mine.has(r.eventId) }
      })
      return sortHangouts(await withRsvps(ctx.db, shaped))
    }),

  // List active hangouts linked to a specific event
  listByEvent: publicProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select(hangoutColumns)
        .from(hangouts)
        .where(
          and(
            eq(hangouts.eventId, input.eventId),
            eq(hangouts.status, 'active'),
          ),
        )
        .orderBy(desc(hangouts.createdAt))

      return withRsvps(ctx.db, rows)
    }),

  /**
   * Events a new hangout can belong to: the caller's planned events tonight
   * first (any city), then the rest of tonight's events in their city.
   */
  eventOptions: protectedProcedure
    .input(z.object({ citySlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const city = await resolveCity(ctx.db, input.citySlug)
      const { since, until } = tonightWindow(city.tz)
      const myTonight = await plannedEventIdsIn(ctx.db, ctx.dancerId, since, until)
      const cols = { id: events.id, name: events.name, startDate: events.startDate, timezone: events.timezone, venueName: events.venueName, venueAddress: events.venueAddress }
      const shape = (r: any) => ({ ...r, startDate: r.startDate ? new Date(r.startDate).toISOString() : null })
      const live = and(eq(events.published, true), eq(events.archived, false))
      const inPlan = myTonight.length
        ? await ctx.db.select(cols).from(events).where(inArray(events.id, myTonight)).orderBy(asc(events.startDate))
        : []
      const others = await ctx.db
        .select(cols)
        .from(events)
        .where(and(live, eq(events.citySlug, city.slug), gte(events.startDate, since), lt(events.startDate, until)))
        .orderBy(asc(events.startDate))
        .limit(40)
      const planned = new Set(myTonight)
      return {
        inPlan: inPlan.map(shape),
        others: others.filter((e: any) => !planned.has(e.id)).map(shape),
      }
    }),

  /**
   * Google Places venue autocomplete for the "Where?" field, biased to the
   * city. Signed-in only (each call is billed). [] without an API key.
   */
  placeSearch: protectedProcedure
    .input(z.object({ q: z.string().trim().min(2).max(100), citySlug: z.string(), session: sessionToken }))
    .query(async ({ ctx, input }) => {
      const client = usePlaces()
      if (!client) return []
      const city = await resolveCity(ctx.db, input.citySlug)
      try {
        const preds = await client.autocomplete(input.q, {
          sessionToken: input.session,
          types: 'establishment',
          near: city.lat != null && city.lng != null ? { lat: city.lat, lng: city.lng, radius: 30_000 } : undefined,
        })
        return preds.slice(0, 6).map(p => ({ placeId: p.placeId, name: p.mainText, address: p.secondaryText }))
      } catch (err) {
        console.error('[hangouts.placeSearch]', (err as Error).message)
        return []
      }
    }),

  /** The picked place's name, address and coordinates (closes the billed session). */
  placeDetails: protectedProcedure
    .input(z.object({ placeId: z.string().min(1).max(300), session: sessionToken }))
    .query(async ({ input }) => {
      const client = usePlaces()
      if (!client) return null
      try {
        const d = await client.details(input.placeId, { sessionToken: input.session })
        if (!d) return null
        return { placeId: d.placeId, name: d.name, address: d.formattedAddress ?? '', lat: d.lat, lng: d.lng }
      } catch (err) {
        console.error('[hangouts.placeDetails]', (err as Error).message)
        return null
      }
    }),

  // Create a new hangout (authenticated only)
  create: protectedProcedure
    .input(z.object({
      kind: hangoutKind,
      title: z.string().min(1),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      venue: z.string().optional(),
      placeId: z.string().max(300).optional(),
      placeAddress: z.string().max(500).optional(),
      placeLat: z.number().min(-90).max(90).optional(),
      placeLng: z.number().min(-180).max(180).optional(),
      host: z.string().optional(),
      citySlug: z.string().min(1),
      eventId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Resolve host name from the creator's profile when not supplied
      let host = input.host
      if (!host) {
        const [dancer] = await ctx.db
          .select({ name: dancers.name })
          .from(dancers)
          .where(eq(dancers.id, ctx.dancerId))
        host = dancer?.name ?? undefined
      }

      // A hangout tied to an event lives in that event's city; with no place
      // given it meets at the event's venue.
      let citySlug = (await resolveCity(ctx.db, input.citySlug)).slug
      let venue = input.venue?.trim() || undefined
      let place = { placeId: input.placeId, placeAddress: input.placeAddress, placeLat: input.placeLat, placeLng: input.placeLng }
      if (!venue) place = { placeId: undefined, placeAddress: undefined, placeLat: undefined, placeLng: undefined }
      if (input.eventId) {
        const [ev] = await ctx.db
          .select({ citySlug: events.citySlug, venueName: events.venueName, venueAddress: events.venueAddress, venueLat: events.venueLat, venueLng: events.venueLng })
          .from(events)
          .where(eq(events.id, input.eventId))
          .limit(1)
        if (!ev) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' })
        if (ev.citySlug) citySlug = ev.citySlug
        if (!venue && ev.venueName) {
          venue = ev.venueName
          place = { placeId: undefined, placeAddress: ev.venueAddress ?? undefined, placeLat: ev.venueLat ?? undefined, placeLng: ev.venueLng ?? undefined }
        }
      }

      let result: typeof hangouts.$inferSelect
      try {
        const [row] = await ctx.db
          .insert(hangouts)
          .values({
            kind: input.kind,
            title: input.title,
            time: input.time,
            venue,
            ...place,
            host,
            citySlug,
            eventId: input.eventId,
            peopleCount: 1,
            dancerId: ctx.dancerId,
            status: 'active',
          })
          .returning()

        if (!row) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create hangout' })
        }
        result = row
      } catch (e: any) {
        if (e instanceof TRPCError) throw e
        const dbMessage = e?.cause?.message || e?.message || 'unknown'
        console.error('[hangouts.create] DB error:', dbMessage, e)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not create hangout. Please try again later.',
        })
      }

      // Auto-RSVP the creator so "1 in" shows immediately
      try {
        await ctx.db
          .insert(hangoutRsvps)
          .values({ hangoutId: result.id, dancerId: ctx.dancerId })
      } catch (e: any) {
        const dbMessage = e?.cause?.message || e?.message || 'unknown'
        console.error('[hangouts.create] RSVP error:', dbMessage, e)
        // Hangout was created — don't fail the whole request for RSVP
      }

      return result
    }),

  // Toggle RSVP for current user
  toggleRsvp: protectedProcedure
    .input(z.object({ hangoutId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check if hangout exists
      const [hangout] = await ctx.db
        .select()
        .from(hangouts)
        .where(eq(hangouts.id, input.hangoutId))

      if (!hangout) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Hangout not found' })
      }

      // Check if RSVP already exists
      const [existing] = await ctx.db
        .select()
        .from(hangoutRsvps)
        .where(
          and(
            eq(hangoutRsvps.hangoutId, input.hangoutId),
            eq(hangoutRsvps.dancerId, ctx.dancerId),
          ),
        )

      if (existing) {
        // Remove RSVP
        await ctx.db
          .delete(hangoutRsvps)
          .where(
            and(
              eq(hangoutRsvps.hangoutId, input.hangoutId),
              eq(hangoutRsvps.dancerId, ctx.dancerId),
            ),
          )

        return { rsvpd: false }
      } else {
        // Add RSVP
        await ctx.db
          .insert(hangoutRsvps)
          .values({
            hangoutId: input.hangoutId,
            dancerId: ctx.dancerId,
          })

        return { rsvpd: true }
      }
    }),

  // Close a hangout (authenticated owner only)
  close: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [hangout] = await ctx.db
        .select()
        .from(hangouts)
        .where(eq(hangouts.id, input.id))

      if (!hangout) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Hangout not found' })
      }

      if (hangout.dancerId !== ctx.dancerId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only close your own hangouts' })
      }

      await ctx.db
        .update(hangouts)
        .set({ status: 'closed', updatedAt: new Date() })
        .where(eq(hangouts.id, input.id))

      return { success: true }
    }),
})
