import { z } from 'zod'
import { and, asc, eq, gte, lt, ne, or, sql, type SQL } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure } from '../trpc'
import { events, cities } from '../../database/schema'
import { festivalView } from '../../utils/festivalView'
import { listFestivals } from '../../utils/festivalListing'
import { publicEventWhere } from '../../utils/eventLookup'

/**
 * Public dated events from the `events` table — today the live mirror of
 * wedance.vip (v3) events written by scripts/sync-v3-events.ts. Only rows that
 * are published and not archived are listed; the 9,580 historical v4 imports
 * stay archived/unpublished and never surface here.
 *
 * Dates go out as ISO instants plus the event's IANA `timezone`; the client
 * renders wall-clock times in that zone (shared/utils/eventTime.ts).
 */
const cardColumns = {
  id: events.id,
  name: events.name,
  type: events.type,
  styles: events.styles,
  startDate: events.startDate,
  endDate: events.endDate,
  timezone: events.timezone,
  isFestival: events.isFestival,
  cover: events.cover,
  price: events.price,
  venueName: events.venueName,
  venueAddress: events.venueAddress,
  venueUsername: events.venueUsername,
  organizerName: events.organizerName,
  organizerUsername: events.organizerUsername,
  city: events.city,
  citySlug: events.citySlug,
}

/** Card rows for a filter, soonest first. */
async function selectCards(db: any, where: SQL | undefined, limit = 1000, extra: Record<string, any> = {}) {
  return db.select({ ...cardColumns, ...extra, artists: events.artists }).from(events).where(where).orderBy(asc(events.startDate)).limit(limit)
}

const live = () => and(eq(events.published, true), eq(events.archived, false))

export const eventsRouter = router({
  // Upcoming + ongoing events in a city, soonest first.
  byCity: publicProcedure
    .input(z.object({ citySlug: z.string().min(1), days: z.number().int().min(1).max(366).default(90) }))
    .query(async ({ ctx, input }) => {
      const now = new Date()
      const until = new Date(now.getTime() + input.days * 86400_000)
      return selectCards(ctx.db, and(eq(events.citySlug, input.citySlug), live(), gte(events.endDate, now), lt(events.startDate, until)))
    }),

  // What else is on those days, for an organizer picking a date: events in the
  // same city, and festivals (and weekenders, congresses) in the same country.
  // Days are local dates; a night that runs past midnight still counts.
  sameDays: publicProcedure
    .input(z.object({
      city: z.string().trim().min(1).max(120),
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      /** The event being edited, left out of its own competition. */
      exceptId: z.string().uuid().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const [c] = await ctx.db.select({ slug: cities.slug, name: cities.name, country: cities.country }).from(cities)
        .where(sql`lower(${cities.name}) = lower(${input.city})`).limit(1)
      const citySlug = c?.slug ?? input.city.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      // Local day bounds, with a few hours' slack for time zones.
      const start = new Date(`${input.from}T00:00:00Z`)
      const end = new Date(new Date(`${input.to && input.to >= input.from ? input.to : input.from}T00:00:00Z`).getTime() + 86400_000)
      const overlaps = and(lt(events.startDate, new Date(end.getTime() + 2 * 3600_000)), gte(sql`coalesce(${events.endDate}, ${events.startDate})`, new Date(start.getTime() + 4 * 3600_000)))
      const except = input.exceptId ? ne(events.id, input.exceptId) : undefined
      const multiDay = or(eq(events.isFestival, true), sql`${events.festival} is not null`, sql`${events.type} in ('Festival', 'Weekender', 'Congress')`)
      const [inCity, festivals] = await Promise.all([
        selectCards(ctx.db, and(live(), overlaps, eq(events.citySlug, citySlug), except), 50),
        c?.country ? selectCards(ctx.db, and(live(), overlaps, eq(events.country, c.country), multiDay, sql`${events.citySlug} is distinct from ${citySlug}`, except), 30) : [],
      ])
      return { city: c?.name ?? input.city, country: c?.country ?? null, inCity, festivals }
    }),

  // Live counts for the pages that pitch WeDance (/for-organizers): never a
  // number typed into the copy, so it can't go stale.
  stats: publicProcedure.query(async ({ ctx }) => {
    const now = new Date()
    const res: any = await ctx.db.execute(sql`select count(*)::int as events, count(distinct ${events.citySlug})::int as cities
      from ${events} where ${events.published} and not ${events.archived} and ${events.startDate} > ${now}`)
    const r = (res.rows ?? res)[0] ?? { events: 0, cities: 0 }
    return { upcomingEvents: Number(r.events) || 0, cities: Number(r.cities) || 0 }
  }),

  // Upcoming events a venue hosts, an organiser runs or an artist plays — for /@handle.
  // Optional `name` lets artist profiles also match events that list the artist
  // by display name instead of @handle (name fallback).
  byProfile: publicProcedure
    .input(z.object({
      username: z.string().min(1).max(200),
      name: z.string().max(200).optional(),
      days: z.number().int().min(1).max(366).default(120),
    }))
    .query(async ({ ctx, input }) => {
      const now = new Date()
      const until = new Date(now.getTime() + input.days * 86400_000)
      const who = or(
        eq(events.venueUsername, input.username),
        eq(events.organizerUsername, input.username),
        sql`${events.artists} @> ${JSON.stringify([input.username])}::jsonb`,
        ...(input.name ? [sql`${events.artists} @> ${JSON.stringify([input.name])}::jsonb`] : []),
      )
      const window = and(live(), gte(events.endDate, now), lt(events.startDate, until))
      return selectCards(ctx.db, and(window, who), 200)
    }),

  // By id; by a festival's key or a stored slug (/events/meneate-viena-2026, the
  // links festival cards and old plans make); or by the URL /events/<name>-<short
  // id> (the 8 characters at the end are the start of the id).
  get: publicProcedure
    .input(z.object({ id: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const extra = {
        description: events.description,
        link: events.link,
        ticketUrl: events.ticketUrl,
        country: events.country,
        venueLat: events.venueLat,
        venueLng: events.venueLng,
        archived: events.archived,
        source: events.source,
        // "Checked by …": who last edited it on WeDance — the host profile when
        // the editor is on its team, else WeDance (an admin checked it).
        editedAt: events.editedAt,
        checkedBy: sql<string | null>`case
          when ${events.editedAt} is null then null
          when exists (select 1 from profile_members m where m.profile_id = ${events.hostProfileId} and m.dancer_id = ${events.editedBy})
            then (select p.name from profiles p where p.id = ${events.hostProfileId})
          else 'WeDance' end`,
        agenda: events.agenda,
        festival: events.festival,
      }
      let ev: any
      for (const where of publicEventWhere(input.id)) {
        ;[ev] = await selectCards(ctx.db, where, 1, extra)
        if (ev) break
      }
      if (!ev) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found.' })
      return ev
    }),

  // Upcoming festivals, congresses and weekenders, soonest first (the
  // /festivals directory, same query as /api/festivals).
  festivals: publicProcedure.query(async ({ ctx }) => listFestivals(ctx.db)),

  // A festival event in the shape the festival page renders (Festival,
  // workshops, teachers — app/types/festival.ts), built from the event, its
  // festival details and its line-up's profiles.
  festival: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [ev] = await ctx.db.select().from(events).where(and(eq(events.id, input.id), eq(events.published, true)))
      if (!ev?.festival) throw new TRPCError({ code: 'NOT_FOUND', message: 'Festival not found.' })
      return festivalView(ctx.db, ev)
    }),
})
