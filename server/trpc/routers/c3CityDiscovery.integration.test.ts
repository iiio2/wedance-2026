/**
 * C3 — finding a floor in a city, against a real Postgres (RAZ-682): city
 * directory counts, who is active this week per role, the merged weekly +
 * dated feed, filters and paging, recurring series, event details and the
 * schedules on /@handle.
 *
 * Local database only (server/test-setup.ts drops a remote DATABASE_URL). All
 * fixtures are synthetic, live in throwaway cities named after this run, and are
 * removed in afterAll. The city page's own logic is exercised through
 * app/lib/cityWeek.ts (the functions /cities/[city] calls) on the rows the real
 * procedures return. The clock is pinned: "this week" is computed for a fixed
 * instant shortly after the fixtures are written, in Europe/Berlin.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { inArray, like, or } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { appRouter } from '../index'
import { eventPath } from '../../../shared/utils/eventSlug'
import { eventLocalDate, eventLocalTime } from '../../../shared/utils/eventTime'
import { weekDateKeys, cityFeed, activeThisWeek, isActiveThisWeek, groupUpcoming, type PeopleTab } from '../../../app/lib/cityWeek'

// The Nitro handlers read the db through useDb(); point it at the test database,
// and give them the two h3 auto-imports they use.
vi.mock('../../utils/db', () => ({ useDb: () => (globalThis as any).__c3CityDb }))
;(globalThis as any).defineEventHandler ??= (fn: any) => fn
;(globalThis as any).getRouterParam ??= (event: any, key: string) => event.context.params[key]

const DATABASE_URL = process.env.DATABASE_URL
const db: any = DATABASE_URL ? drizzle(neon(DATABASE_URL), { schema }) : null
;(globalThis as any).__c3CityDb = db

const RUN = Math.random().toString(36).slice(2, 8)
const CITY = `c3city-${RUN}` // the city under test
const CITY2 = `c3city2-${RUN}` // a smaller city
const CITY0 = `c3city0-${RUN}` // only a hidden profile → zero community
const CITYP = `c3paging-${RUN}` // filters + paging
const DAY = 86400_000
const TZ = 'Europe/Berlin'
const ids: Record<string, string> = {}
const handle = (k: string) => `c3-${k.toLowerCase()}-${RUN}`
const anon = () => appRouter.createCaller({ db, dancerId: null, isAdmin: false } as any)
const caller = (dancerId: string) => appRouter.createCaller({ db, dancerId, isAdmin: false } as any)

// Pinned clock: 30 min from now, nudged off the last minutes of a local day so
// "this week" fixtures can't straddle midnight.
let clock: Date
let week: Set<string>
const at = (offsetMs: number) => new Date(clock.getTime() + offsetMs)
const localDate = (d: Date) => eventLocalDate(d, TZ)

async function addProfile(key: string, type: 'venue' | 'artist' | 'organizer', city: string, values: Partial<typeof schema.profiles.$inferInsert> = {}) {
  const [row] = await db.insert(schema.profiles).values({
    username: handle(key), type, name: `${key} ${RUN}`, city: `City ${city}`, citySlug: city, status: 'visible', styles: ['Salsa'], ...values,
  }).returning({ id: schema.profiles.id })
  ids[key] = row.id
}

async function addEvent(key: string, start: Date, values: Partial<typeof schema.events.$inferInsert> = {}) {
  const [row] = await db.insert(schema.events).values({
    name: `${key} ${RUN}`, type: 'Party', citySlug: CITY, city: `City ${CITY}`, timezone: TZ, styles: ['Salsa'],
    startDate: start, endDate: new Date(start.getTime() + 3 * 3600_000), published: true, archived: false, ...values,
  }).returning({ id: schema.events.id })
  ids[key] = row.id
  return row.id as string
}

async function addBooking(key: string, venueKey: string, eventDate: string, values: Partial<typeof schema.bookingRequests.$inferInsert> = {}) {
  const [row] = await db.insert(schema.bookingRequests).values({
    spaceId: ids[`${venueKey}Space`], profileId: ids[venueKey], requesterEmail: `${key}-${RUN}@test.wedance.local`,
    title: `${key} ${RUN}`, eventType: 'Social', styles: ['Salsa'], eventDate, startTime: '21:00', status: 'accepted', ...values,
  }).returning({ id: schema.bookingRequests.id })
  ids[key] = row.id
}

// What the city page does with the two feeds (pages/cities/[city]/index.vue).
async function cityPage(city: string, style = '') {
  const [booked, synced] = await Promise.all([anon().booking.upcomingByCity({ citySlug: city }), anon().events.byCity({ citySlug: city })])
  const feed = cityFeed(booked as any[], synced as any[], week, style)
  const syncedThisWeek = feed.syncedThisWeek.map((e: any) => ({ ...e, venueId: e.venueUsername || undefined, organizerId: e.organizerUsername || undefined, artists: e.artists || [] }))
  return { booked, synced, feed, active: activeThisWeek(feed.bookedThisWeek as any[], syncedThisWeek) }
}

const ORIGINAL_TZ = process.env.TZ

describe.skipIf(!DATABASE_URL)('C3 city discovery — integration', () => {
  beforeAll(async () => {
    process.env.TZ = TZ
    clock = new Date(Date.now() + 30 * 60_000)
    const hhmm = eventLocalTime(clock, TZ)
    if (hhmm >= '23:40') clock = new Date(clock.getTime() + 25 * 60_000)
    week = weekDateKeys(clock)

    // People and places. venueV's handle has nothing to do with its name (RAZ-702).
    await addProfile('venueV', 'venue', CITY, { name: `Café Mañana Tanzhaus ${RUN}`, address: 'Tanzstraße 1, München' })
    await addProfile('venueIdle', 'venue', CITY)
    await addProfile('crossVenue', 'venue', CITY) // a venue-typed school that runs events as organiser
    await addProfile('orgO', 'organizer', CITY)
    await addProfile('orgIdle', 'organizer', CITY)
    await addProfile('schoolOrg', 'organizer', CITY) // an organiser hosting at its own place (event venue)
    await addProfile('artistR', 'artist', CITY) // named on events by handle
    await addProfile('artistN', 'artist', CITY, { name: `Nina ${RUN}` }) // named on events by display name
    await addProfile('artistIdle', 'artist', CITY)
    await addProfile('hiddenP', 'artist', CITY, { status: 'hidden' })
    await addProfile('city2Artist', 'artist', CITY2)
    await addProfile('city0Hidden', 'venue', CITY0, { status: 'hidden' })
    await addProfile('pagingVenue', 'venue', CITYP)
    const [space] = await db.insert(schema.bookableSpaces).values({ profileId: ids.venueV, name: `Main hall ${RUN}` }).returning({ id: schema.bookableSpaces.id })
    ids.venueVSpace = space.id

    // This week (dated, synced-style rows).
    await addEvent('syncThis', at(0), {
      venueUsername: handle('venueV'), venueName: `Café Mañana Tanzhaus ${RUN}`, venueAddress: 'Tanzstraße 1, München',
      organizerUsername: handle('crossVenue'), organizerName: `crossVenue ${RUN}`,
      artists: [handle('artistR'), `Nina ${RUN}`], price: '10 € at the door', link: `https://example.com/c3-${RUN}`, slug: `c3-sync-this-${RUN}`,
    })
    await addEvent('syncSchool', at(2 * 60_000), { venueUsername: handle('schoolOrg'), venueName: `schoolOrg ${RUN}` })
    // A weekly social: this week's date plus the next two (series rows, as createSeries / the v3 sync write them).
    for (const [i, k] of ['weekly1', 'weekly2', 'weekly3'].entries()) {
      await addEvent(k, at(3 * 60_000 + i * 7 * DAY), { name: `Weekly Practica ${RUN}`, type: 'Practica', seriesId: `c3-series-${RUN}`, venueUsername: handle('venueV') })
    }
    await addEvent('festThis', at(4 * 60_000), { isFestival: true, type: 'Festival' })
    await addEvent('otherCity', at(5 * 60_000), { citySlug: CITY2 })
    // Later only.
    await addEvent('syncLaterIdle', at(15 * DAY), { venueUsername: handle('venueIdle'), organizerUsername: handle('orgIdle'), artists: [handle('artistIdle')] })
    // Bookings: this week and beyond.
    await addBooking('bookThis', 'venueV', localDate(clock), { organizerId: ids.orgO })
    await addBooking('bookLater', 'venueV', localDate(at(10 * DAY)), { organizerId: ids.orgO })
    // Status contract fixtures (RAZ-701).
    await addEvent('unpublished', at(DAY), { published: false, slug: `c3-unpublished-${RUN}` })
    await addEvent('archivedEv', at(DAY), { archived: true, slug: `c3-archived-${RUN}` })
  })

  afterAll(async () => {
    process.env.TZ = ORIGINAL_TZ
    await db.delete(schema.planItems).where(inArray(schema.planItems.itemId, Object.values(ids)))
    await db.delete(schema.bookingRequests).where(like(schema.bookingRequests.requesterEmail, `%-${RUN}@test.wedance.local`))
    await db.delete(schema.bookableSpaces).where(like(schema.bookableSpaces.name, `% ${RUN}`))
    await db.delete(schema.events).where(or(like(schema.events.name, `% ${RUN}`), like(schema.events.citySlug, `%-${RUN}`)))
    await db.delete(schema.profileMembers).where(inArray(schema.profileMembers.profileId, (await db.select({ id: schema.profiles.id }).from(schema.profiles).where(like(schema.profiles.username, `%-${RUN}`))).map((r: any) => r.id).concat(['00000000-0000-4000-8000-000000000000'])))
    await db.delete(schema.profiles).where(like(schema.profiles.username, `%-${RUN}`))
    await db.delete(schema.dancers).where(like(schema.dancers.email, `%-${RUN}@test.wedance.local`))
  })

  // ── RAZ-692 ──────────────────────────────────────────────────────────────
  describe('RAZ-692 city directory shows real community counts', () => {
    it('counts visible profiles per city and per role, and links each to its own city', async () => {
      const list = (await import('../../api/cities.get')).default as any
      const rows: any[] = await list({})
      const c1 = rows.find(r => r.citySlug === CITY)
      const c2 = rows.find(r => r.citySlug === CITY2)
      // 3 venues, 3 organisers, 3 visible artists; the hidden artist doesn't count.
      expect(c1).toMatchObject({ city: `City ${CITY}`, venues: 3, organizers: 3, artists: 3, total: 9 })
      expect(c2).toMatchObject({ city: `City ${CITY2}`, venues: 0, organizers: 0, artists: 1, total: 1 })
      expect(rows.indexOf(c1)).toBeLessThan(rows.indexOf(c2)) // comparable: bigger community first
    })

    it('a city with no visible community is not listed with a placeholder count', async () => {
      const rows: any[] = await ((await import('../../api/cities.get')).default as any)({})
      expect(rows.find(r => r.citySlug === CITY0)).toBeUndefined()
      expect(rows.every(r => r.total > 0)).toBe(true)
    })
  })

  // ── RAZ-693 ──────────────────────────────────────────────────────────────
  describe('RAZ-693 active profiles appear under the role their event names', () => {
    const tabPeople = async (tab: PeopleTab) => {
      const dir = await ((await import('../../api/cities/[slug].get')).default as any)({ context: { params: { slug: CITY } } })
      const list = tab === 'venues' ? dir.venues : tab === 'organisers' ? dir.organizers : dir.artists
      const { active } = await cityPage(CITY)
      return list.filter((p: any) => isActiveThisWeek(tab, { id: p.username, name: p.name }, active)).map((p: any) => p.username).sort()
    }

    it('Venues: the venue with a booking + synced dates this week, plus the venue-typed school running one', async () => {
      expect(await tabPeople('venues')).toEqual([handle('crossVenue'), handle('venueV')].sort())
    })

    it('Organisers: the booking\'s organiser and the organiser hosting at its own place', async () => {
      expect(await tabPeople('organisers')).toEqual([handle('orgO'), handle('schoolOrg')].sort())
    })

    it('Artists: matched by @handle or by display name; idle and hidden artists stay out', async () => {
      expect(await tabPeople('teachers')).toEqual([handle('artistN'), handle('artistR')].sort())
    })

    it('profiles active only later (next weeks) are outside the weekly slice', async () => {
      const { active } = await cityPage(CITY)
      for (const k of ['venueIdle', 'orgIdle']) {
        expect(isActiveThisWeek('venues', { id: handle(k), name: `${k} ${RUN}` }, active)).toBe(false)
        expect(isActiveThisWeek('organisers', { id: handle(k), name: `${k} ${RUN}` }, active)).toBe(false)
      }
      expect(isActiveThisWeek('teachers', { id: handle('artistIdle'), name: `artistIdle ${RUN}` }, active)).toBe(false)
    })
  })

  // ── RAZ-694 ──────────────────────────────────────────────────────────────
  describe('RAZ-694 weekly and dated events form one feed without duplicates', () => {
    it('this week holds the weekly social, the dated event and the booking — once each', async () => {
      const { feed } = await cityPage(CITY)
      const thisWeek = [...feed.bookedThisWeek.map((b: any) => b.id), ...feed.syncedThisWeek.map((e: any) => e.id)]
      expect(thisWeek.sort()).toEqual([ids.bookThis, ids.syncThis, ids.syncSchool, ids.weekly1].sort())
      expect(new Set(thisWeek).size).toBe(thisWeek.length)
    })

    it('dates beyond this week stay reachable under "Coming up", none repeated from this week', async () => {
      const { feed } = await cityPage(CITY)
      const later = [
        ...feed.syncedLater.map((e: any) => ({ id: e.id, date: localDate(new Date(e.startDate)), time: eventLocalTime(e.startDate, TZ) })),
        ...feed.bookedLater.map((b: any) => ({ id: b.id, date: String(b.eventDate).slice(0, 10), time: b.startTime })),
      ]
      const groups = groupUpcoming(later, 24)
      const shown = groups.flatMap(g => g.items.map(i => i.id))
      expect(shown.sort()).toEqual([ids.weekly2, ids.weekly3, ids.syncLaterIdle, ids.bookLater].sort())
      expect(new Set(shown).size).toBe(shown.length)
      const thisWeek = new Set([...feed.syncedThisWeek.map((e: any) => e.id), ...feed.bookedThisWeek.map((b: any) => b.id)])
      expect(shown.some(id => thisWeek.has(id))).toBe(false)
      // Grouped by date, in date order.
      expect(groups.map(g => g.date)).toEqual([...groups.map(g => g.date)].sort())
    })

    it('festivals and other cities stay out of the weekly feed', async () => {
      const { feed } = await cityPage(CITY)
      const all = [...feed.syncedThisWeek, ...feed.syncedLater].map((e: any) => e.id)
      expect(all).not.toContain(ids.festThis)
      expect(all).not.toContain(ids.otherCity)
    })
  })

  // ── RAZ-695 ──────────────────────────────────────────────────────────────
  describe('RAZ-695 city, style and profile filters over several pages', () => {
    beforeAll(async () => {
      for (let i = 0; i < 26; i++) await addEvent(`pSalsa${i}`, at((8 + i) * DAY), { citySlug: CITYP, venueUsername: handle('pagingVenue') })
      await addEvent('pBachata40', at(40 * DAY), { citySlug: CITYP, styles: ['Bachata'] })
      await addEvent('pBachata60', at(60 * DAY), { citySlug: CITYP, styles: ['bachata'] })
      await addEvent('pOtherCityBachata', at(41 * DAY), { citySlug: CITY2, styles: ['Bachata'] })
      await addEvent('pBeyondWindow', at(100 * DAY), { citySlug: CITYP, styles: ['Bachata'] })
    })

    const laterItems = (feed: ReturnType<typeof cityFeed>) => feed.syncedLater.map((e: any) => ({ id: e.id, date: localDate(new Date(e.startDate)), time: eventLocalTime(e.startDate, TZ) }))

    it('the city feed holds only that city\'s events', async () => {
      const { synced } = await cityPage(CITYP)
      expect(synced.length).toBe(28)
      expect(synced.every((e: any) => e.citySlug === CITYP)).toBe(true)
      expect(synced.map((e: any) => e.id)).not.toContain(ids.pOtherCityBachata)
    })

    it('"Coming up" pages by 24; "show more" reaches the later dates', async () => {
      const { feed } = await cityPage(CITYP)
      const page1 = groupUpcoming(laterItems(feed), 24).flatMap(g => g.items.map(i => i.id))
      expect(page1).toHaveLength(24)
      expect(page1).not.toContain(ids.pBachata60)
      const page2 = groupUpcoming(laterItems(feed), 48).flatMap(g => g.items.map(i => i.id))
      expect(page2).toHaveLength(28)
      expect(page2).toContain(ids.pBachata60)
    })

    it('a style filter keeps later matching dates (aliases included) and drops the rest', async () => {
      const { feed } = await cityPage(CITYP, 'Bachata')
      expect(feed.syncedLater.map((e: any) => e.id).sort()).toEqual([ids.pBachata40, ids.pBachata60].sort())
    })

    it('a profile filter (/@handle schedule) returns that profile\'s events only', async () => {
      const rows = await anon().events.byProfile({ username: handle('pagingVenue') })
      expect(rows).toHaveLength(26)
      expect(rows.every((e: any) => e.venueUsername === handle('pagingVenue'))).toBe(true)
    })

    it('documents the current window: the city feed looks 90 days ahead', async () => {
      const { synced } = await cityPage(CITYP)
      expect(synced.map((e: any) => e.id)).not.toContain(ids.pBeyondWindow)
      const wider = await anon().events.byCity({ citySlug: CITYP, days: 120 })
      expect(wider.map((e: any) => e.id)).toContain(ids.pBeyondWindow)
    })
  })

  // ── RAZ-696 ──────────────────────────────────────────────────────────────
  describe('RAZ-696 recurring weekly options stay discoverable next to one-off dates', () => {
    it('a weekly series made by createSeries lists every date as its own event in the city feed', async () => {
      // The current recurrence source: createSeries materialises each date as an
      // events row sharing series_id (no recurrence engine at read time). Business
      // events have no "Practica" type, so a weekly practica is a Party.
      const [owner] = await db.insert(schema.dancers).values({ email: `owner-${RUN}@test.wedance.local`, name: `Owner ${RUN}` }).returning({ id: schema.dancers.id })
      await addProfile('seriesHost', 'organizer', CITY)
      await db.insert(schema.profileMembers).values({ profileId: ids.seriesHost, dancerId: owner.id, role: 'owner' })
      const res = await caller(owner.id).businessEvents.createSeries({
        hostUsername: handle('seriesHost'), name: `Sunday Practica ${RUN}`, type: 'Party', date: localDate(clock), startTime: eventLocalTime(at(5 * 60_000), TZ),
        city: `City ${CITY}`, styles: ['Salsa'], every: 'week', count: 3, published: true,
      } as any)
      expect(res.created).toHaveLength(3)

      const { synced, feed } = await cityPage(`city-${CITY}`)
      const series = synced.filter((e: any) => e.name === `Sunday Practica ${RUN}`)
      expect(series.map((e: any) => e.id).sort()).toEqual(res.created.map((c: any) => c.id).sort())
      // Same wall-clock time, 7 days apart.
      const dates = series.map((e: any) => localDate(new Date(e.startDate)))
      expect(new Set(series.map((e: any) => eventLocalTime(e.startDate, TZ))).size).toBe(1)
      expect((Date.parse(dates[1]) - Date.parse(dates[0])) / DAY).toBe(7)
      expect((Date.parse(dates[2]) - Date.parse(dates[1])) / DAY).toBe(7)
      // One this week, the next ones under "Coming up".
      expect(feed.syncedThisWeek.filter((e: any) => e.name === `Sunday Practica ${RUN}`)).toHaveLength(1)
      expect(feed.syncedLater.filter((e: any) => e.name === `Sunday Practica ${RUN}`)).toHaveLength(2)
    })

    it('series rows and one-off dated rows sit side by side in one city feed', async () => {
      const { feed } = await cityPage(CITY)
      const thisWeek = feed.syncedThisWeek.map((e: any) => e.id)
      expect(thisWeek).toContain(ids.weekly1) // recurring (series_id)
      expect(thisWeek).toContain(ids.syncThis) // one-off
      expect(feed.syncedLater.map((e: any) => e.id)).toEqual(expect.arrayContaining([ids.weekly2, ids.weekly3]))
    })
  })

  // ── RAZ-701 ──────────────────────────────────────────────────────────────
  describe('RAZ-701 event details and one canonical identity', () => {
    it('id, slug and /events/<name>-<short id> resolve the same event with its details', async () => {
      const card = (await anon().events.byCity({ citySlug: CITY })).find((e: any) => e.id === ids.syncThis)!
      const urls = [ids.syncThis!, `c3-sync-this-${RUN}`, eventPath({ id: ids.syncThis!, name: `syncThis ${RUN}` }).replace('/events/', '')]
      for (const param of urls) {
        const ev = await anon().events.get({ id: param })
        expect(ev.id).toBe(ids.syncThis)
        expect(ev).toMatchObject({
          timezone: TZ, venueName: `Café Mañana Tanzhaus ${RUN}`, venueAddress: 'Tanzstraße 1, München',
          styles: ['Salsa'], price: '10 € at the door', link: `https://example.com/c3-${RUN}`, ticketUrl: null, archived: false,
        })
        expect(new Date(ev.startDate).getTime()).toBe(new Date(card.startDate).getTime())
      }
    })

    it('Going and its count use the event id whichever URL was opened', async () => {
      const [d] = await db.insert(schema.dancers).values({ email: `going-${RUN}@test.wedance.local`, name: `Going ${RUN}` }).returning({ id: schema.dancers.id })
      ids.goingDancer = d.id
      const viaSlug = await anon().events.get({ id: `c3-sync-this-${RUN}` })
      await caller(d.id).plan.add({ itemType: 'event', itemId: viaSlug.id })
      const viaShort = await anon().events.get({ id: eventPath({ id: ids.syncThis!, name: `syncThis ${RUN}` }).replace('/events/', '') })
      expect(await anon().plan.count({ itemType: 'event', itemId: viaShort.id })).toBe(1)
      expect(await anon().plan.countBatch({ itemType: 'event', itemIds: [ids.syncThis!] })).toEqual({ [ids.syncThis!]: 1 })
      await caller(d.id).plan.remove({ itemType: 'event', itemId: ids.syncThis! })
    })

    it('missing and unpublished events are NOT_FOUND; an archived one still resolves, flagged archived', async () => {
      await expect(anon().events.get({ id: `c3-no-such-${RUN}` })).rejects.toMatchObject({ code: 'NOT_FOUND' })
      await expect(anon().events.get({ id: ids.unpublished! })).rejects.toMatchObject({ code: 'NOT_FOUND' })
      await expect(anon().events.get({ id: `c3-unpublished-${RUN}` })).rejects.toMatchObject({ code: 'NOT_FOUND' })
      expect(await anon().events.get({ id: ids.archivedEv! })).toMatchObject({ id: ids.archivedEv, archived: true })
      // …but never in the city feed.
      expect((await anon().events.byCity({ citySlug: CITY })).map((e: any) => e.id)).not.toContain(ids.archivedEv)
    })

    it('a booked event resolves by its id with its venue; an unknown id is NOT_FOUND', async () => {
      expect(await anon().booking.getEvent({ id: ids.bookThis! })).toMatchObject({ id: ids.bookThis, venueHandle: handle('venueV'), startTime: '21:00' })
      await expect(anon().booking.getEvent({ id: '00000000-0000-4000-8000-000000000682' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })
  })

  // ── RAZ-702 ──────────────────────────────────────────────────────────────
  describe('RAZ-702 city events and profile schedules agree, linked by real handles', () => {
    const byProfile = (username: string, name?: string) => anon().events.byProfile({ username, ...(name ? { name } : {}) }).then((r: any[]) => r.map(e => e.id))

    it('venue, organiser and artist schedules list the event that names them', async () => {
      expect(await byProfile(handle('venueV'))).toEqual(expect.arrayContaining([ids.syncThis, ids.weekly1, ids.weekly2, ids.weekly3]))
      expect(await byProfile(handle('crossVenue'))).toContain(ids.syncThis) // as organiser
      expect(await byProfile(handle('artistR'))).toContain(ids.syncThis) // by @handle
      expect(await byProfile(handle('artistN'), `Nina ${RUN}`)).toContain(ids.syncThis) // by display name (artist pages)
      expect(await byProfile(handle('artistIdle'))).not.toContain(ids.syncThis)
      expect(await byProfile(handle('venueIdle'))).toEqual([ids.syncLaterIdle])
    })

    it('the venue\'s booking schedule holds its bookings, and each booking resolves to that venue', async () => {
      const sched = await anon().booking.scheduleForProfile({ profileId: ids.venueV! })
      expect(sched.map((b: any) => b.id).sort()).toEqual([ids.bookThis, ids.bookLater].sort())
      for (const id of [ids.bookThis!, ids.bookLater!]) expect((await anon().booking.getEvent({ id })).venueHandle).toBe(handle('venueV'))
    })

    it('feed links carry the stored @handles, never a slug guessed from the name', async () => {
      const { booked, synced } = await cityPage(CITY)
      const b = booked.find((x: any) => x.id === ids.bookThis)!
      expect(b).toMatchObject({ venueHandle: handle('venueV'), organizerHandle: handle('orgO') })
      const e = synced.find((x: any) => x.id === ids.syncThis)!
      expect(e.venueUsername).toBe(handle('venueV'))
      const guessed = `cafe-manana-tanzhaus-${RUN}`
      expect([b.venueHandle, e.venueUsername]).not.toContain(guessed)
      // and each handle resolves to a real profile
      const found = await db.select({ u: schema.profiles.username }).from(schema.profiles).where(inArray(schema.profiles.username, [b.venueHandle, b.organizerHandle, e.venueUsername, e.organizerUsername]))
      expect(found.map((r: any) => r.u).sort()).toEqual([...new Set([handle('venueV'), handle('orgO'), handle('crossVenue')])].sort())
    })
  })
})
