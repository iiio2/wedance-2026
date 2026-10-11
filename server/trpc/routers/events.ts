import { z } from 'zod'
import { and, asc, eq, gte, lt, or, sql, type SQL } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure } from '../trpc'
import { events } from '../../database/schema'

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

const missingColumn = (e: any) => e?.code === '42703' || /column .* does not exist/.test(String(e?.message ?? e?.cause?.message))

/**
 * Card rows for a filter. `events.artists` arrives with migration 0022; until a
 * DB has it the query retries without (artists = []), and before 0021 it
 * returns [] — so a deploy that runs ahead of the migration never blanks a page.
 */
async function selectCards(db: any, where: SQL | undefined, limit = 1000, extra: Record<string, any> = {}) {
  const run = (cols: Record<string, any>) => db.select(cols).from(events).where(where).orderBy(asc(events.startDate)).limit(limit)
  try {
    return await run({ ...cardColumns, ...extra, artists: events.artists })
  } catch (e: any) {
    if (!missingColumn(e)) throw e
    // Retry without the `artists` SELECT column. If this still fails (e.g. the
    // WHERE clause references a missing column), let it throw so the caller can
    // handle it (byProfile retries with who(false)).
    return (await run({ ...cardColumns, ...extra })).map((r: any) => ({ ...r, artists: [] as string[] }))
  }
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
      const who = (withArtists: boolean) => or(
        eq(events.venueUsername, input.username),
        eq(events.organizerUsername, input.username),
        ...(withArtists ? [
          sql`${events.artists} @> ${JSON.stringify([input.username])}::jsonb`,
          ...(input.name ? [sql`${events.artists} @> ${JSON.stringify([input.name])}::jsonb`] : []),
        ] : []),
      )
      const window = and(live(), gte(events.endDate, now), lt(events.startDate, until))
      try {
        return await selectCards(ctx.db, and(window, who(true)), 200)
      } catch (e: any) {
        if (!missingColumn(e)) throw e
        return selectCards(ctx.db, and(window, who(false)), 200)
      }
    }),

  get: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [ev] = await selectCards(ctx.db, and(eq(events.id, input.id), eq(events.published, true)), 1, {
        description: events.description,
        link: events.link,
        ticketUrl: events.ticketUrl,
        country: events.country,
        venueLat: events.venueLat,
        venueLng: events.venueLng,
        archived: events.archived,
        source: events.source,
      })
      if (!ev) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found.' })
      return ev
    }),
})
