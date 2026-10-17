import { and, asc, eq, gte, inArray, or, sql } from 'drizzle-orm'
import { events, profiles } from '../database/schema'
import { eventPath } from '../../shared/utils/eventSlug'

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

export type FeedProfile = { id: string; username: string; name: string }

export const siteUrl = () => ((useRuntimeConfig().siteUrl as string | undefined) || 'https://2026.wedance.vip').replace(/\/$/, '')

/** A profile by handle, any case; null when there's none. */
export async function profileByHandle(db: any, handle: string): Promise<FeedProfile | null> {
  const [p] = await db.select({ id: profiles.id, username: profiles.username, name: profiles.name })
    .from(profiles).where(eq(sql`lower(${profiles.username})`, handle.toLowerCase()))
  return p ?? null
}

/**
 * A profile's upcoming events: the ones it runs (host) or organizes, published
 * and not over, soonest first, starting within `days`.
 */
export async function profileFeedEvents(db: any, profile: FeedProfile, days = 60): Promise<ProfileFeedEvent[]> {
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
      or(eq(events.hostProfileId, profile.id), eq(sql`lower(${events.organizerUsername})`, profile.username.toLowerCase())),
    ))
    .orderBy(asc(events.startDate))
    .limit(200)

  const handles = [...new Set(rows.flatMap((r: any) => r.artists ?? []))] as string[]
  const names = new Map<string, string>(handles.length
    ? (await db.select({ username: profiles.username, name: profiles.name }).from(profiles).where(inArray(profiles.username, handles))).map((p: any) => [p.username, p.name])
    : [])
  const site = siteUrl()
  return rows.map((r: any) => ({
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
    artists: (r.artists ?? []).map((h: string) => ({ handle: h, name: names.get(h) ?? h })),
    url: `${site}${eventPath(r)}`,
  }))
}
