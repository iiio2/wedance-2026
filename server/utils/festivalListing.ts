import { and, asc, eq, gte, inArray, isNotNull, or, sql } from 'drizzle-orm'
import { events, festivals, festivalSignups, dancers, planItems } from '../database/schema'
import type { useDb } from './db'
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

/**
 * Published festival, congress and weekender events that haven't ended, soonest
 * first, with going counts — the /festivals directory (server/api/festivals.get.ts)
 * and the events.festivals procedure share it.
 */
export async function listFestivals(db: ReturnType<typeof useDb>): Promise<FestivalRow[]> {
  const now = new Date()

  const rows = dedupeFestivals(await db
    .select({
      id: events.id,
      name: events.name,
      startDate: events.startDate,
      endDate: events.endDate,
      timezone: events.timezone,
      city: events.city,
      country: events.country,
      styles: events.styles,
      ticketUrl: events.ticketUrl,
      festival: events.festival,
    })
    .from(events)
    .where(and(
      eq(events.published, true),
      eq(events.archived, false),
      gte(sql`coalesce(${events.endDate}, ${events.startDate})`, now),
      or(eq(events.isFestival, true), isNotNull(events.festival), inArray(events.type, ['Festival', 'Weekender', 'Congress'])),
      // The mock festivals scripts/import-festivals.ts brought in from app/data
      // carry invented dates — listed only once a person has checked one.
      or(sql`${events.source} is distinct from 'wedance-festival'`, isNotNull(events.editedAt)),
    ))
    .orderBy(asc(events.startDate)))

  const refs = rows.map(planRef)
  const ids = (type: 'festival' | 'event') => refs.filter(r => r.planType === type).map(r => r.planId)
  const festivalKeys = ids('festival')
  const eventIds = ids('event')

  // "Going" clicks per plan reference.
  const signups = new Map<string, number>()
  const planned = [
    festivalKeys.length ? and(eq(planItems.itemType, 'festival'), inArray(planItems.itemId, festivalKeys)) : undefined,
    eventIds.length ? and(eq(planItems.itemType, 'event'), inArray(planItems.itemId, eventIds)) : undefined,
  ].filter(Boolean)
  if (planned.length) {
    const countRows = await db
      .select({ itemType: planItems.itemType, itemId: planItems.itemId, cnt: sql<number>`count(*)::int` })
      .from(planItems)
      .where(or(...planned))
      .groupBy(planItems.itemType, planItems.itemId)
    for (const r of countRows) signups.set(`${r.itemType}:${r.itemId}`, Number(r.cnt) || 0)
  }

  // Verified ticket holders hang on the legacy festivals row with the same key.
  const avatarsByKey = new Map<string, GoingAvatar[]>()
  const publicCountByKey = new Map<string, number>()
  const legacy = festivalKeys.length
    ? await db.select({ id: festivals.id, slug: festivals.slug }).from(festivals).where(inArray(festivals.slug, festivalKeys))
    : []

  if (legacy.length > 0) {
    const festivalIds = legacy.map(r => r.id)
    const keyById = new Map(legacy.map(r => [r.id, r.slug]))

    // Count verified ticket holders with public profiles per festival.
    const countRows = await db
      .select({
        festivalId: festivalSignups.festivalId,
        cnt: sql<number>`count(*)::int`,
      })
      .from(festivalSignups)
      .innerJoin(dancers, eq(festivalSignups.dancerId, dancers.id))
      .where(
        and(
          inArray(festivalSignups.festivalId, festivalIds),
          eq(festivalSignups.verifiedTicketHolder, true),
          eq(dancers.profilePublic, true),
        ),
      )
      .groupBy(festivalSignups.festivalId)

    for (const row of countRows) {
      const key = keyById.get(row.festivalId)
      if (key) publicCountByKey.set(key, Number(row.cnt) || 0)
    }

    // First 5 verified-ticket-holder avatars per festival via row_number
    // window — avoids fetching every row and capping in JS.
    type AvatarRow = { festival_id: string, name: string, photo: string | null }
    const avatarResult = await db.execute<AvatarRow>(sql`
      select festival_id, name, photo from (
        select
          fs.festival_id,
          d.name,
          d.photo,
          row_number() over (partition by fs.festival_id order by fs.created_at) as rn
        from festival_signups fs
        inner join dancers d on d.id = fs.dancer_id
        where fs.verified_ticket_holder = true
          and fs.roster_visibility <> 'hidden'
          and fs.festival_id in (${sql.join(festivalIds.map(id => sql`${id}`), sql`, `)})
          and d.profile_public = true
      ) sub
      where rn <= 5
    `)
    // neon-http returns { rows }, not an array (RAZ-297).
    const avatarRows = (avatarResult as unknown as { rows?: AvatarRow[] }).rows ?? (avatarResult as unknown as AvatarRow[])

    for (const row of avatarRows) {
      const key = keyById.get(row.festival_id)
      if (!key) continue
      const list = avatarsByKey.get(key) ?? []
      list.push({ name: row.name, photo: row.photo })
      avatarsByKey.set(key, list)
    }
  }

  return rows.map((e, i) => {
    const { planType, planId } = refs[i]!
    const legacyKey = planType === 'festival' ? planId : ''
    return toFestivalRow(e, {
      signupCount: signups.get(`${planType}:${planId}`) ?? 0,
      publicGoingCount: publicCountByKey.get(legacyKey) ?? 0,
      goingAvatars: avatarsByKey.get(legacyKey) ?? [],
    })
  })
}
