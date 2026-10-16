import { and, asc, eq, gte, inArray, or, sql } from 'drizzle-orm'
import { useDb } from '../../../utils/db'
import { events, profiles } from '../../../database/schema'
import { eventPath } from '../../../../shared/utils/eventSlug'

export type ProfileFeedEvent = {
  id: string
  name: string
  type: string | null
  startDate: string
  endDate: string | null
  timezone: string | null
  venueName: string | null
  venueAddress: string | null
  price: string
  cover: string | null
  styles: string[]
  artists: { handle: string; name: string }[]
  /** The event on WeDance: where people sign up ("Going") or buy a ticket. */
  url: string
}

/**
 * Public feed of a profile's upcoming events, for the profile's own website
 * (e.g. montuno.club reads /api/profiles/montunoclub/events). The events a
 * profile runs (host) or organizes, published and not over, soonest first —
 * so the website shows exactly what the profile shows on WeDance, and every
 * row links back to WeDance for sign-up.
 *
 * Query: ?days=60 (1–180) limits how far ahead.
 */
export default defineEventHandler(async (event): Promise<{ profile: { username: string; name: string; url: string }; events: ProfileFeedEvent[] }> => {
  const username = String(getRouterParam(event, 'username') ?? '').toLowerCase()
  const days = Math.min(180, Math.max(1, Number(getQuery(event).days) || 60))
  const db = useDb()
  const [profile] = await db.select({ id: profiles.id, username: profiles.username, name: profiles.name })
    .from(profiles).where(eq(sql`lower(${profiles.username})`, username))
  if (!profile) throw createError({ statusCode: 404, statusMessage: 'Profile not found' })

  const now = new Date()
  const rows = await db.select({
    id: events.id, name: events.name, type: events.type, startDate: events.startDate, endDate: events.endDate,
    timezone: events.timezone, venueName: events.venueName, venueAddress: events.venueAddress, price: events.price,
    cover: events.cover, styles: events.styles, artists: events.artists,
  })
    .from(events)
    .where(and(
      eq(events.published, true),
      eq(events.archived, false),
      gte(sql`coalesce(${events.endDate}, ${events.startDate})`, now),
      sql`${events.startDate} < ${new Date(now.getTime() + days * 86400_000)}`,
      or(eq(events.hostProfileId, profile.id), eq(sql`lower(${events.organizerUsername})`, username)),
    ))
    .orderBy(asc(events.startDate))
    .limit(200)

  const handles = [...new Set(rows.flatMap(r => r.artists ?? []))]
  const names = new Map(handles.length
    ? (await db.select({ username: profiles.username, name: profiles.name }).from(profiles).where(inArray(profiles.username, handles))).map(p => [p.username, p.name])
    : [])

  const site = (useRuntimeConfig().siteUrl as string | undefined) || 'https://2026.wedance.vip'
  setResponseHeaders(event, {
    'access-control-allow-origin': '*',
    'cache-control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600',
  })
  return {
    profile: { username: profile.username, name: profile.name, url: `${site}/@${profile.username}` },
    events: rows.map(r => ({
      id: r.id,
      name: r.name ?? '',
      type: r.type,
      startDate: new Date(r.startDate!).toISOString(),
      endDate: r.endDate ? new Date(r.endDate).toISOString() : null,
      timezone: r.timezone,
      venueName: r.venueName,
      venueAddress: r.venueAddress,
      price: r.price ?? '',
      cover: r.cover || null,
      styles: r.styles ?? [],
      artists: (r.artists ?? []).map(h => ({ handle: h, name: names.get(h) ?? h })),
      url: `${site}${eventPath(r)}`,
    })),
  }
})
