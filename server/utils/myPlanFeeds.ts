/**
 * Data behind two /my-plan sections that used to be prototype-only:
 *
 *  - "This week · socials" (`weekSocials`): the real events in the dancer's
 *    city over the next 7 days, matched to their styles, with their own RSVPs
 *    (plan_items rows of type 'event') marked as going.
 *  - "Widen your year · discover" (`discoverDeck`): people and places the
 *    dancer hasn't decided on yet. Every Yes / Skip lands in discover_swipes
 *    and is excluded here, so a decided card never comes back.
 *
 * "Friends" = mutual dancer follows (RAZ-319). Counts are real or absent —
 * never a placeholder number.
 */
import { and, asc, eq, gte, inArray, isNotNull, lt, ne, notInArray, or, sql, ilike } from 'drizzle-orm'
import { cities, dancers, discoverSwipes, events, festivals, follows, planItems } from '../database/schema'
import { relatedDanceStyles } from '../../shared/dance-styles'
import { eventLocalDate } from '../../shared/utils/eventTime'

type Db = any

const DAY = 86400_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Event types that are not a social night: classes, workshops, multi-day festivals. */
export const NON_SOCIAL_TYPES = ['Course', 'Workshop', 'Festival', 'Congress', 'Weekender']

const live = () => and(eq(events.published, true), eq(events.archived, false))

/** A swipe card is a photo: dancers without one never enter the deck (same rule as wave.discoverPool). */
const hasPhoto = () => [isNotNull(dancers.photo), ne(dancers.photo, '')]

export function slugifyCity(city: string): string {
  return city.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

/** The events.city_slug for a dancer's free-text city ("München" → "munich"). */
export async function citySlugFor(db: Db, city: string | null | undefined): Promise<string> {
  const name = (city ?? '').trim()
  if (!name) return ''
  try {
    const [c] = await db
      .select({ slug: cities.slug })
      .from(cities)
      .where(sql`lower(${cities.name}) = lower(${name}) or lower(${cities.localName}) = lower(${name}) or ${cities.altNames} @> ${JSON.stringify([name])}::jsonb`)
      .limit(1)
    if (c?.slug) return c.slug
  } catch { /* cities table missing → slugify */ }
  return slugifyCity(name)
}

/** True when any of an event's styles is the same as, or a variant of, one of the dancer's. */
export function stylesMatch(eventStyles: readonly string[], myStyles: readonly string[]): boolean {
  return eventStyles.some(e => myStyles.some(m => relatedDanceStyles(e, m)))
}

/** Mutual follows of a dancer — their friends. Best-effort: [] on any error. */
export async function friendIdsOf(db: Db, dancerId: string): Promise<string[]> {
  try {
    return await mutualFollowIds(db, dancerId)
  } catch {
    return []
  }
}

async function mutualFollowIds(db: Db, dancerId: string): Promise<string[]> {
  const outgoing = await db
    .select({ id: follows.targetDancerId })
    .from(follows)
    .where(and(eq(follows.dancerId, dancerId), isNotNull(follows.targetDancerId)))
  const targets = outgoing.map((r: any) => r.id).filter(Boolean) as string[]
  if (!targets.length) return []
  const back = await db
    .select({ id: follows.dancerId })
    .from(follows)
    .where(and(eq(follows.targetDancerId, dancerId), inArray(follows.dancerId, targets)))
  return back.map((r: any) => r.id)
}

/** How many of `friendIds` have each item in their plan. Missing key = 0. */
export async function friendsGoingCounts(
  db: Db,
  friendIds: string[],
  itemType: 'event' | 'festival',
  itemIds: string[],
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!friendIds.length || !itemIds.length) return out
  const rows = await db
    .select({ itemId: planItems.itemId, count: sql<number>`count(*)::int` })
    .from(planItems)
    .where(and(eq(planItems.itemType, itemType), inArray(planItems.itemId, itemIds), inArray(planItems.dancerId, friendIds)))
    .groupBy(planItems.itemId)
  for (const r of rows) out.set(r.itemId, Number(r.count) || 0)
  return out
}

// ---------------------------------------------------------------------------
// This week · socials
// ---------------------------------------------------------------------------

export type WeekSocial = {
  id: string
  name: string
  type: string | null
  styles: string[]
  startDate: string
  endDate: string | null
  timezone: string | null
  venueName: string
  city: string
  going: boolean
  friendsGoing: number
  styleMatch: boolean
}

/** Up to this many socials per day, so the list covers the whole week, not just its first nights. */
export const WEEK_SOCIALS_PER_DAY = 3

/**
 * Pick the list from the week's socials: the dancer's RSVPs always, then the
 * ones in their styles (or everything when no style matches / none are set),
 * at most `perDay` per local day, soonest first. Pure — unit-tested without a
 * database.
 */
export function pickWeekSocials(rows: WeekSocial[], hasStyles: boolean, perDay = WEEK_SOCIALS_PER_DAY): WeekSocial[] {
  const anyMatch = rows.some(r => !r.going && r.styleMatch)
  const dayOf = (r: WeekSocial) => eventLocalDate(r.startDate, r.timezone || undefined)
  const perDayCount = new Map<string, number>()
  for (const r of rows) if (r.going) perDayCount.set(dayOf(r), (perDayCount.get(dayOf(r)) ?? 0) + 1)
  const picked = rows.filter((r) => {
    if (r.going) return true
    if (hasStyles && anyMatch && !r.styleMatch) return false
    const day = dayOf(r)
    const n = perDayCount.get(day) ?? 0
    if (n >= perDay) return false
    perDayCount.set(day, n + 1)
    return true
  })
  return picked.sort((a, b) => a.startDate.localeCompare(b.startDate))
}

/** The event's styles with the ones the dancer dances first (the list shows the first). */
export function stylesForDancer(eventStyles: string[], myStyles: readonly string[]): string[] {
  if (!myStyles.length) return eventStyles
  const mine = eventStyles.filter(e => myStyles.some(m => relatedDanceStyles(e, m)))
  return [...mine, ...eventStyles.filter(e => !mine.includes(e))]
}

export async function weekSocials(db: Db, dancerId: string, now = new Date(), days = 7): Promise<{ citySlug: string; socials: WeekSocial[] }> {
  const [me] = await db
    .select({ city: dancers.city, danceStyles: dancers.danceStyles })
    .from(dancers)
    .where(eq(dancers.id, dancerId))
  if (!me) return { citySlug: '', socials: [] }

  const citySlug = await citySlugFor(db, me.city)
  const myStyles = (me.danceStyles as string[] | null) ?? []

  const myEventRows = await db
    .select({ itemId: planItems.itemId })
    .from(planItems)
    .where(and(eq(planItems.dancerId, dancerId), eq(planItems.itemType, 'event')))
  const myEventIds = myEventRows.map((r: any) => r.itemId as string).filter((id: string) => UUID_RE.test(id))
  const goingSet = new Set(myEventIds)

  if (!citySlug && !myEventIds.length) return { citySlug, socials: [] }

  const until = new Date(now.getTime() + days * DAY)
  const where = and(
    live(),
    gte(sql`coalesce(${events.endDate}, ${events.startDate})`, now),
    lt(events.startDate, until),
    or(
      // Socials in the city…
      citySlug
        ? and(
            eq(events.citySlug, citySlug),
            sql`coalesce(${events.isFestival}, false) = false`,
            sql`coalesce(${events.type}, '') not in (${sql.join(NON_SOCIAL_TYPES.map(t => sql`${t}`), sql`, `)})`,
          )
        : sql`false`,
      // …plus anything this week the dancer already said they're going to.
      myEventIds.length ? inArray(events.id, myEventIds) : sql`false`,
    ),
  )

  const rows = await db
    .select({
      id: events.id,
      name: events.name,
      type: events.type,
      styles: events.styles,
      startDate: events.startDate,
      endDate: events.endDate,
      timezone: events.timezone,
      venueName: events.venueName,
      city: events.city,
    })
    .from(events)
    .where(where)
    .orderBy(asc(events.startDate))
    .limit(200)

  const friendIds = await friendIdsOf(db, dancerId)
  const counts = await friendsGoingCounts(db, friendIds, 'event', rows.map((r: any) => r.id))

  const all: WeekSocial[] = rows
    .filter((r: any) => r.startDate)
    .map((r: any) => {
      const styles = stylesForDancer((r.styles as string[] | null) ?? [], myStyles)
      return {
        id: r.id,
        name: r.name || 'Social',
        type: r.type ?? null,
        styles,
        startDate: new Date(r.startDate).toISOString(),
        endDate: r.endDate ? new Date(r.endDate).toISOString() : null,
        timezone: r.timezone ?? null,
        venueName: r.venueName ?? '',
        city: r.city ?? '',
        going: goingSet.has(r.id),
        friendsGoing: counts.get(r.id) ?? 0,
        styleMatch: myStyles.length ? stylesMatch(styles, myStyles) : false,
      }
    })

  return { citySlug, socials: pickWeekSocials(all, myStyles.length > 0) }
}

// ---------------------------------------------------------------------------
// Widen your year · discover
// ---------------------------------------------------------------------------

export type DiscoverCard =
  | { kind: 'dancer-local' | 'dancer-your-fest' | 'dancer-new-fest'; targetKind: 'dancer'; targetId: string; dancerName: string; dancerPhoto: string; dancerCity: string; dancerStyles: string[]; festivalSlug?: string; festivalName?: string; festivalColor?: string }
  | { kind: 'event-festival'; targetKind: 'festival'; targetId: string; eventName: string; eventSlug: string; eventDateISO: string; eventTimezone: string | null; eventVenue: string; eventCity: string; friendsGoing: number; color: string }
  | { kind: 'event-social'; targetKind: 'event'; targetId: string; eventName: string; eventDateISO: string; eventTimezone: string | null; eventVenue: string; eventCity: string; eventStyle: string; friendsGoing: number; color: string }

export type DiscoverNudge = { festivalSlug: string; festivalName: string; festivalColor: string; dancerNames: string[] }

const STYLE_COLORS: Record<string, string> = {
  Salsa: '#f59e0b', Bachata: '#a855f7', Kizomba: '#0ea5e9', Cuban: '#dc2626', Timba: '#dc2626', Zouk: '#16a34a',
}

export const DISCOVER_CAP = 20

/** Fisher–Yates, in place. */
function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

export async function discoverDeck(db: Db, dancerId: string, now = new Date()): Promise<{ cards: DiscoverCard[]; nudges: DiscoverNudge[] }> {
  const [me] = await db
    .select({ id: dancers.id, city: dancers.city, danceStyles: dancers.danceStyles })
    .from(dancers)
    .where(eq(dancers.id, dancerId))
  if (!me) return { cards: [], nudges: [] }

  const myCity = (me.city ?? '').trim()
  const myStyles = (me.danceStyles as string[] | null) ?? []
  const citySlug = await citySlugFor(db, myCity)

  // Decisions already made — none of these come back.
  const swipes: Array<{ targetKind: string; targetId: string; decision: string; festivalSlug: string | null }> = await db
    .select({ targetKind: discoverSwipes.targetKind, targetId: discoverSwipes.targetId, decision: discoverSwipes.decision, festivalSlug: discoverSwipes.festivalSlug })
    .from(discoverSwipes)
    .where(eq(discoverSwipes.dancerId, dancerId))
  const swiped = { dancer: new Set<string>(), event: new Set<string>(), festival: new Set<string>() }
  for (const s of swipes) swiped[s.targetKind as keyof typeof swiped]?.add(s.targetId)
  const swipedDancerIds = [...swiped.dancer].filter(id => UUID_RE.test(id))

  // What's already in the plan.
  const myPlan = await db
    .select({ itemType: planItems.itemType, itemId: planItems.itemId })
    .from(planItems)
    .where(eq(planItems.dancerId, dancerId))
  const myFestivalSlugs = new Set<string>(myPlan.filter((r: any) => r.itemType === 'festival').map((r: any) => r.itemId))
  const myEventIds = new Set<string>(myPlan.filter((r: any) => r.itemType === 'event').map((r: any) => r.itemId))

  const notSwipedDancer = swipedDancerIds.length ? [notInArray(dancers.id, swipedDancerIds)] : []
  const usedDancers = new Set<string>()
  const dancerCards: DiscoverCard[] = []

  // 1. Dancers heading to festivals — the same ones as mine, or ones I haven't picked.
  try {
    const otherPlans = await db
      .select({ dancerId: planItems.dancerId, itemId: planItems.itemId })
      .from(planItems)
      .innerJoin(dancers, eq(planItems.dancerId, dancers.id))
      .where(and(
        eq(planItems.itemType, 'festival'),
        ne(planItems.dancerId, dancerId),
        eq(dancers.profilePublic, true),
        ...hasPhoto(),
        ...notSwipedDancer,
      ))
      .limit(200)

    const slugs = [...new Set<string>(otherPlans.map((p: any) => p.itemId))].filter(s => !swiped.festival.has(s) || myFestivalSlugs.has(s))
    const ids = [...new Set<string>(otherPlans.map((p: any) => p.dancerId))]
    if (slugs.length && ids.length) {
      const [festRows, people] = await Promise.all([
        db.select({ slug: festivals.slug, name: festivals.name, accentColor: festivals.accentColor }).from(festivals).where(inArray(festivals.slug, slugs)),
        db.select({ id: dancers.id, name: dancers.name, photo: dancers.photo, city: dancers.city, danceStyles: dancers.danceStyles }).from(dancers).where(inArray(dancers.id, ids)),
      ])
      const festMap = new Map<string, any>(festRows.map((f: any) => [f.slug, f]))
      const peopleMap = new Map<string, any>(people.map((d: any) => [d.id, d]))
      for (const p of otherPlans) {
        if (usedDancers.has(p.dancerId)) continue
        const d = peopleMap.get(p.dancerId)
        const fest = festMap.get(p.itemId)
        if (!d || !fest || !d.photo) continue
        usedDancers.add(d.id)
        const mine = myFestivalSlugs.has(p.itemId)
        dancerCards.push({
          kind: mine ? 'dancer-your-fest' : 'dancer-new-fest',
          targetKind: 'dancer',
          targetId: d.id,
          dancerName: d.name,
          dancerPhoto: d.photo,
          dancerCity: d.city ?? '',
          dancerStyles: (d.danceStyles as string[] | null) ?? [],
          festivalSlug: p.itemId,
          festivalName: fest.name,
          festivalColor: fest.accentColor ?? (mine ? '#7c3aed' : '#0ea5e9'),
        })
      }
    }
  } catch { /* non-critical */ }

  // 2. Dancers in my city, shared styles first. Falls back to anyone when the
  //    city is unknown or has nobody left to show.
  const peopleQuery = (cityFilter: boolean) => db
    .select({ id: dancers.id, name: dancers.name, photo: dancers.photo, city: dancers.city, danceStyles: dancers.danceStyles })
    .from(dancers)
    .where(and(
      ...(cityFilter ? [ilike(dancers.city, myCity)] : []),
      ne(dancers.id, dancerId),
      eq(dancers.profilePublic, true),
      ...hasPhoto(),
      ...notSwipedDancer,
    ))
    .limit(30)
  try {
    let locals: any[] = myCity ? await peopleQuery(true) : []
    if (!locals.length && !dancerCards.length) locals = await peopleQuery(false)
    const scored = locals
      .filter(d => !usedDancers.has(d.id) && d.photo)
      .map(d => {
        const styles = (d.danceStyles as string[] | null) ?? []
        return { d, styles, shared: myStyles.length ? styles.filter(s => myStyles.some(m => relatedDanceStyles(s, m))).length : 0 }
      })
      .sort((a, b) => b.shared - a.shared)
    for (const { d, styles } of scored) {
      usedDancers.add(d.id)
      dancerCards.push({
        kind: 'dancer-local',
        targetKind: 'dancer',
        targetId: d.id,
        dancerName: d.name,
        dancerPhoto: d.photo,
        dancerCity: d.city ?? '',
        dancerStyles: styles,
      })
    }
  } catch { /* non-critical */ }

  // 3. Upcoming events in my city (90 days): socials and festivals not decided yet.
  const eventCards: DiscoverCard[] = []
  if (citySlug) {
    try {
      const upcoming = await db
        .select({
          id: events.id, name: events.name, slug: events.slug, type: events.type, startDate: events.startDate,
          timezone: events.timezone, isFestival: events.isFestival, venueName: events.venueName, city: events.city, styles: events.styles,
        })
        .from(events)
        .where(and(
          eq(events.citySlug, citySlug),
          live(),
          gte(sql`coalesce(${events.endDate}, ${events.startDate})`, now),
          lt(events.startDate, new Date(now.getTime() + 90 * DAY)),
        ))
        .orderBy(asc(events.startDate))
        .limit(60)

      const friendIds = await friendIdsOf(db, dancerId)
      const festSlugs = upcoming.filter((e: any) => e.isFestival).map((e: any) => e.slug ?? e.id)
      const socialIds = upcoming.filter((e: any) => !e.isFestival).map((e: any) => e.id)
      const [festCounts, socialCounts] = await Promise.all([
        friendsGoingCounts(db, friendIds, 'festival', festSlugs),
        friendsGoingCounts(db, friendIds, 'event', socialIds),
      ])

      for (const ev of upcoming) {
        if (!ev.startDate) continue
        const styles = stylesForDancer((ev.styles as string[] | null) ?? [], myStyles)
        const mainStyle = styles[0] ?? ev.type ?? ''
        if (ev.isFestival) {
          const slug = ev.slug ?? ev.id
          if (myFestivalSlugs.has(slug) || swiped.festival.has(slug)) continue
          eventCards.push({
            kind: 'event-festival', targetKind: 'festival', targetId: slug,
            eventName: ev.name ?? '', eventSlug: slug,
            eventDateISO: new Date(ev.startDate).toISOString(), eventTimezone: ev.timezone ?? null,
            eventVenue: ev.venueName ?? '', eventCity: ev.city ?? '',
            friendsGoing: festCounts.get(slug) ?? 0,
            color: STYLE_COLORS[mainStyle] ?? '#a855f7',
          })
        } else {
          if (NON_SOCIAL_TYPES.includes(ev.type ?? '')) continue
          if (myEventIds.has(ev.id) || swiped.event.has(ev.id)) continue
          if (myStyles.length && styles.length && !stylesMatch(styles, myStyles)) continue
          eventCards.push({
            kind: 'event-social', targetKind: 'event', targetId: ev.id,
            eventName: ev.name ?? '', eventDateISO: new Date(ev.startDate).toISOString(), eventTimezone: ev.timezone ?? null,
            eventVenue: ev.venueName ?? '', eventCity: ev.city ?? '', eventStyle: mainStyle,
            friendsGoing: socialCounts.get(ev.id) ?? 0,
            color: STYLE_COLORS[mainStyle] ?? '#f59e0b',
          })
        }
      }
    } catch { /* non-critical */ }
  }

  // Mix: up to 14 people — festival-goers (same festival first) and locals
  // share the slots, so neither crowds the other out — and 6 events, then shuffle.
  const festGoers = [
    ...dancerCards.filter(c => c.kind === 'dancer-your-fest'),
    ...dancerCards.filter(c => c.kind === 'dancer-new-fest'),
  ]
  const locals = dancerCards.filter(c => c.kind === 'dancer-local')
  const peopleCap = DISCOVER_CAP - Math.min(6, eventCards.length)
  const half = Math.ceil(peopleCap / 2)
  const people = [...festGoers.slice(0, half), ...locals, ...festGoers.slice(half)].slice(0, peopleCap)
  const places = eventCards.slice(0, DISCOVER_CAP - people.length)
  const cards = shuffle([...people, ...places])

  // Nudges: Yes on dancers heading to a festival I haven't picked (or turned down).
  const nudges: DiscoverNudge[] = []
  try {
    const byFest = new Map<string, string[]>()
    for (const s of swipes) {
      if (s.targetKind !== 'dancer' || s.decision !== 'yes' || !s.festivalSlug) continue
      if (myFestivalSlugs.has(s.festivalSlug) || swiped.festival.has(s.festivalSlug)) continue
      byFest.set(s.festivalSlug, [...(byFest.get(s.festivalSlug) ?? []), s.targetId])
    }
    if (byFest.size) {
      const ids = [...new Set([...byFest.values()].flat())].filter(id => UUID_RE.test(id))
      const [names, fests] = await Promise.all([
        ids.length ? db.select({ id: dancers.id, name: dancers.name }).from(dancers).where(and(inArray(dancers.id, ids), eq(dancers.profilePublic, true))) : [],
        db.select({ slug: festivals.slug, name: festivals.name, accentColor: festivals.accentColor }).from(festivals).where(inArray(festivals.slug, [...byFest.keys()])),
      ])
      const nameMap = new Map<string, string>(names.map((n: any) => [n.id, n.name]))
      for (const f of fests) {
        const dancerNames = (byFest.get(f.slug) ?? []).map(id => nameMap.get(id)).filter(Boolean) as string[]
        if (dancerNames.length) nudges.push({ festivalSlug: f.slug, festivalName: f.name, festivalColor: f.accentColor ?? '#0ea5e9', dancerNames })
      }
    }
  } catch { /* non-critical */ }

  return { cards, nudges }
}

/** Record a Yes / Skip. Re-deciding the same card overwrites the old decision. */
export async function recordSwipe(db: Db, dancerId: string, input: { targetKind: 'dancer' | 'event' | 'festival'; targetId: string; decision: 'yes' | 'skip'; festivalSlug?: string | null }) {
  if (input.targetKind === 'dancer' && input.targetId === dancerId) return
  await db
    .insert(discoverSwipes)
    .values({ dancerId, targetKind: input.targetKind, targetId: input.targetId, decision: input.decision, festivalSlug: input.festivalSlug ?? null })
    .onConflictDoUpdate({
      target: [discoverSwipes.dancerId, discoverSwipes.targetKind, discoverSwipes.targetId],
      set: { decision: input.decision, festivalSlug: input.festivalSlug ?? null, createdAt: new Date() },
    })
}

/** Undo a decision — the card can come back. */
export async function removeSwipe(db: Db, dancerId: string, input: { targetKind: 'dancer' | 'event' | 'festival'; targetId: string }) {
  await db
    .delete(discoverSwipes)
    .where(and(eq(discoverSwipes.dancerId, dancerId), eq(discoverSwipes.targetKind, input.targetKind), eq(discoverSwipes.targetId, input.targetId)))
}
