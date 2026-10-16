import type { FestivalDetails } from '../../shared/types/festivalDetails'
import { eventLocalDate } from '../../shared/utils/eventTime'
import { eventPath } from '../../shared/utils/eventSlug'

/**
 * The /festivals listing (server/api/festivals.get.ts) is built from festival
 * events (ADR-006): the wedance.vip mirror, festivals organisers list on
 * WeDance, and imported festivals once a person has checked them.
 */

/** An `events` row as the listing query selects it. */
export type FestivalEventRow = {
  id: string
  name: string | null
  startDate: Date | null
  endDate: Date | null
  timezone: string | null
  city: string | null
  country: string | null
  styles: string[] | null
  ticketUrl: string | null
  festival: FestivalDetails | null
}

export type GoingAvatar = {
  name: string
  photo: string | null
}

export type FestivalRow = {
  /** What a dancer's "Going?" stores: a festival with details is planned by its
   * permanent key (year plan), any other festival event by its id (week plan) —
   * the same as on its event page. */
  planType: 'festival' | 'event'
  planId: string
  href: string
  name: string
  /** Local dates (yyyy-mm-dd) in the event's time zone. */
  startDate: string | null
  endDate: string | null
  city: string | null
  country: string | null
  styles: string[]
  logo: string | null
  accentColor: string | null
  ticketUrl: string | null
  signupCount: number
  publicGoingCount: number
  goingAvatars: GoingAvatar[]
}

export const planRef = (e: Pick<FestivalEventRow, 'id' | 'festival'>) =>
  e.festival?.key
    ? { planType: 'festival' as const, planId: e.festival.key }
    : { planType: 'event' as const, planId: e.id }

/**
 * wedance.vip lists some festivals twice (two organisers posting the same
 * weekend). Same name, same first day, same city = one festival; the copy with
 * festival details wins, else the first (rows arrive soonest first).
 */
export function dedupeFestivals<T extends FestivalEventRow>(rows: T[]): T[] {
  const byKey = new Map<string, T>()
  for (const r of rows) {
    const day = r.startDate ? eventLocalDate(r.startDate, r.timezone || undefined) : ''
    const k = `${(r.name ?? '').trim().toLowerCase()}|${day}|${(r.city ?? '').trim().toLowerCase()}`
    const seen = byKey.get(k)
    if (!seen || (!seen.festival && r.festival)) byKey.set(k, r)
  }
  // Map keeps first-insertion order, so the listing stays soonest first.
  return [...byKey.values()]
}

export function toFestivalRow(
  e: FestivalEventRow,
  going: { signupCount: number, publicGoingCount: number, goingAvatars: GoingAvatar[] },
): FestivalRow {
  const tz = e.timezone || undefined
  return {
    ...planRef(e),
    href: eventPath({ id: e.id, name: e.name }),
    name: e.name ?? 'Festival',
    startDate: e.startDate ? eventLocalDate(e.startDate, tz) : null,
    endDate: e.endDate ? eventLocalDate(e.endDate, tz) : e.startDate ? eventLocalDate(e.startDate, tz) : null,
    city: e.city,
    country: e.country,
    styles: e.styles ?? [],
    logo: e.festival?.logo || null,
    accentColor: e.festival?.accentColor || null,
    ticketUrl: e.ticketUrl,
    ...going,
  }
}
