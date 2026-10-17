/**
 * hangouts router — which hangouts show tonight (event-linked ones on their
 * event's night, my planned events first), the event picker, and create
 * (event venue default, Google place fields).
 *
 * Postgres only (see server/test-setup.ts); fixtures live in a throwaway city
 * and are removed in afterAll. The pure helpers run without a database.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { inArray, like } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { appRouter } from '../index'
import { nightMinutes, sortHangouts } from './hangouts'
import { nightStart } from '../../../shared/utils/eventTime'

describe('nightMinutes / sortHangouts', () => {
  it('puts after-midnight times at the end of the night', () => {
    expect(nightMinutes('02:30')).toBeGreaterThan(nightMinutes('23:00'))
    expect(nightMinutes('19:00')).toBeLessThan(nightMinutes('22:00'))
  })
  it('sorts hangouts for my planned events first, then by time of night', () => {
    const out = sortHangouts([
      { id: 'late', time: '02:00', inMyPlan: false },
      { id: 'early', time: '19:00', inMyPlan: false },
      { id: 'mine', time: '23:00', inMyPlan: true },
    ])
    expect(out.map(h => h.id)).toEqual(['mine', 'early', 'late'])
  })
})

const DATABASE_URL = process.env.DATABASE_URL
const db: any = DATABASE_URL ? drizzle(neon(DATABASE_URL), { schema }) : null

const RUN = Math.random().toString(36).slice(2, 8)
const CITY = `testville-${RUN}`
const OTHER_CITY = `elsewhere-${RUN}`
const HOUR = 3600_000
const ids: Record<string, string> = {}
const caller = (dancerId: string | null) => appRouter.createCaller({ db, dancerId, isAdmin: false } as any)

describe.skipIf(!DATABASE_URL)('hangouts router', () => {
  // Tonight in Berlin time (the default zone for a city with no cities row).
  const since = nightStart(new Date(), 'Europe/Berlin')
  const tonight = (h: number) => new Date(since.getTime() + h * HOUR)

  async function addEvent(key: string, values: Partial<typeof schema.events.$inferInsert>) {
    const [row] = await db.insert(schema.events).values({
      name: `${key} ${RUN}`, type: 'Party', citySlug: CITY, city: CITY, timezone: 'Europe/Berlin',
      published: true, archived: false, venueName: `${key} venue`, venueAddress: `${key} street 1`, venueLat: 48.1, venueLng: 11.5,
      ...values,
    }).returning({ id: schema.events.id })
    ids[key] = row.id
  }

  beforeAll(async () => {
    for (const key of ['me', 'host']) {
      const [d] = await db.insert(schema.dancers).values({ email: `${key}-${RUN}@test.wedance.local`, name: `${key} ${RUN}`, city: CITY }).returning({ id: schema.dancers.id })
      ids[key] = d.id
    }
    await addEvent('tonightSocial', { startDate: tonight(14), endDate: tonight(18) })
    await addEvent('nextWeek', { startDate: tonight(14 + 7 * 24), endDate: tonight(18 + 7 * 24) })
    await addEvent('myOtherCity', { citySlug: OTHER_CITY, city: OTHER_CITY, startDate: tonight(15), endDate: tonight(19) })
    await db.insert(schema.planItems).values({ dancerId: ids.me, itemType: 'event', itemId: ids.myOtherCity })

    const host = caller(ids.host!)
    ids.loose = (await host.hangouts.create({ kind: 'bar', title: `loose ${RUN}`, time: '23:00', citySlug: CITY })).id
    ids.forTonight = (await host.hangouts.create({ kind: 'dinner', title: `dinner ${RUN}`, time: '19:00', citySlug: CITY, eventId: ids.tonightSocial })).id
    ids.forNextWeek = (await host.hangouts.create({ kind: 'ride', title: `ride ${RUN}`, time: '19:30', citySlug: CITY, eventId: ids.nextWeek })).id
    ids.forMine = (await host.hangouts.create({ kind: 'coffee', title: `coffee ${RUN}`, time: '21:00', citySlug: OTHER_CITY, eventId: ids.myOtherCity })).id
  })

  afterAll(async () => {
    const dancerIds = [ids.me, ids.host].filter((x): x is string => !!x)
    const hangoutIds = [ids.loose, ids.forTonight, ids.forNextWeek, ids.forMine, ids.placed].filter((x): x is string => !!x)
    if (hangoutIds.length) {
      await db.delete(schema.hangoutRsvps).where(inArray(schema.hangoutRsvps.hangoutId, hangoutIds))
      await db.delete(schema.hangouts).where(inArray(schema.hangouts.id, hangoutIds))
    }
    await db.delete(schema.planItems).where(inArray(schema.planItems.dancerId, dancerIds))
    await db.delete(schema.attendances).where(inArray(schema.attendances.dancerId, dancerIds)).catch(() => {})
    await db.delete(schema.events).where(like(schema.events.name, `% ${RUN}`))
    await db.delete(schema.dancers).where(like(schema.dancers.email, `%-${RUN}@test.wedance.local`))
  })

  describe('listTonight', () => {
    it('shows tonight\'s hangouts with their event; an event hangout shows on its event\'s night, not the night it was posted', async () => {
      const list = await caller(null).hangouts.listTonight({ citySlug: CITY })
      const titles = list.map(h => h.title)
      expect(titles).toContain(`loose ${RUN}`)
      expect(titles).toContain(`dinner ${RUN}`)
      expect(titles).not.toContain(`ride ${RUN}`)
      const dinner = list.find(h => h.id === ids.forTonight)!
      expect(dinner.event?.id).toBe(ids.tonightSocial)
      expect(dinner.event?.name).toBe(`tonightSocial ${RUN}`)
      expect(list.find(h => h.id === ids.loose)!.event).toBeNull()
    })

    it('adds hangouts for events in my plan tonight (any city) and puts them first', async () => {
      const list = await caller(ids.me!).hangouts.listTonight({ citySlug: CITY })
      expect(list[0]!.id).toBe(ids.forMine)
      expect(list[0]!.inMyPlan).toBe(true)
      expect(list.filter(h => h.id !== ids.forMine).every(h => !h.inMyPlan)).toBe(true)
      // Signed out, the other city's hangout isn't part of this city's night.
      expect((await caller(null).hangouts.listTonight({ citySlug: CITY })).map(h => h.id)).not.toContain(ids.forMine)
    })

    it('sorts the rest by time of night', async () => {
      const list = await caller(null).hangouts.listTonight({ citySlug: CITY })
      const mine = list.filter(h => [ids.loose, ids.forTonight].includes(h.id)).map(h => h.time)
      expect(mine).toEqual(['19:00', '23:00'])
    })
  })

  describe('create', () => {
    it('defaults an event hangout with no place to the event\'s venue and city', async () => {
      const list = await caller(null).hangouts.listTonight({ citySlug: CITY })
      const dinner = list.find(h => h.id === ids.forTonight)!
      expect(dinner.venue).toBe('tonightSocial venue')
      expect(dinner.placeAddress).toBe('tonightSocial street 1')
      expect(dinner.placeLat).toBe(48.1)
    })

    it('stores the Google place picked for "Where?"', async () => {
      const row = await caller(ids.host!).hangouts.create({
        kind: 'bar', title: `placed ${RUN}`, time: '22:00', citySlug: CITY,
        venue: 'Café Kosmos', placeId: 'ChIJtest', placeAddress: 'Dachauer Str. 7, München', placeLat: 48.14, placeLng: 11.56,
        eventId: ids.tonightSocial,
      })
      ids.placed = row.id
      expect(row.venue).toBe('Café Kosmos')
      expect(row.placeId).toBe('ChIJtest')
      expect(row.placeAddress).toBe('Dachauer Str. 7, München')
      expect(row.placeLng).toBe(11.56)
    })

    it('rejects an unknown event', async () => {
      await expect(caller(ids.host!).hangouts.create({ kind: 'bar', title: 'x', time: '22:00', citySlug: CITY, eventId: '00000000-0000-4000-8000-000000000000' })).rejects.toThrow(/Event not found/)
    })
  })

  describe('eventOptions', () => {
    it('lists my planned events tonight first, then the rest of tonight in my city', async () => {
      const opts = await caller(ids.me!).hangouts.eventOptions({ citySlug: CITY })
      expect(opts.inPlan.map(e => e.id)).toEqual([ids.myOtherCity])
      expect(opts.others.map(e => e.id)).toContain(ids.tonightSocial)
      expect(opts.others.map(e => e.id)).not.toContain(ids.nextWeek)
      expect(opts.others.map(e => e.id)).not.toContain(ids.myOtherCity)
    })

    it('is signed-in only', async () => {
      await expect(caller(null).hangouts.eventOptions({ citySlug: CITY })).rejects.toThrow()
    })
  })
})
