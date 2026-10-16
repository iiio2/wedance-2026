/**
 * Rides and roommates on a festival that exists only as an event
 * (events.festival), not in the legacy `festivals` table — RAZ-437 / RAZ-438.
 * Before the fix both mutations answered NOT_FOUND for every such festival.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, sql } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { appRouter } from '../index'

const DATABASE_URL = process.env.DATABASE_URL
const db: any = DATABASE_URL ? drizzle(neon(DATABASE_URL), { schema }) : null
const caller = (dancerId: string | null) => appRouter.createCaller({ db, dancerId, isAdmin: false } as any)

const KEY = `test-event-festival-${Date.now()}`
let eventId = ''
let dancerId = ''

describe.skipIf(!DATABASE_URL)('festival side tables on an event-only festival', () => {
  beforeAll(async () => {
    const [d] = await db.select({ id: schema.dancers.id }).from(schema.dancers).limit(1)
    dancerId = d.id
    const [ev] = await db.insert(schema.events).values({
      name: 'Test Event Festival',
      type: 'Festival',
      isFestival: true,
      startDate: new Date('2027-05-01T16:00:00Z'),
      endDate: new Date('2027-05-03T15:00:00Z'),
      city: 'Dachau',
      archived: false,
      published: true,
      festival: { key: KEY } as any,
    }).returning({ id: schema.events.id })
    eventId = ev.id
  })

  afterAll(async () => {
    const [f] = await db.select({ id: schema.festivals.id }).from(schema.festivals).where(eq(schema.festivals.slug, KEY))
    if (f) {
      await db.delete(schema.festivalRideShares).where(eq(schema.festivalRideShares.festivalId, f.id))
      await db.delete(schema.festivalRoommateLookups).where(eq(schema.festivalRoommateLookups.festivalId, f.id))
      await db.delete(schema.festivals).where(eq(schema.festivals.id, f.id))
    }
    await db.delete(schema.events).where(eq(schema.events.id, eventId))
  })

  it('lists nothing and creates no festivals row on read', async () => {
    expect(await caller(null).rideShare.list({ festivalSlug: KEY })).toEqual([])
    expect(await caller(null).roommate.list({ festivalSlug: KEY })).toEqual({ looking: false, others: [] })
    const rows = await db.select().from(schema.festivals).where(eq(schema.festivals.slug, KEY))
    expect(rows).toHaveLength(0)
  })

  it('posts a ride and lists it (RAZ-437)', async () => {
    await caller(dancerId).rideShare.create({ festivalSlug: KEY, type: 'looking', originCity: 'Munich', date: '2027-05-01' })
    const rides = await caller(dancerId).rideShare.list({ festivalSlug: KEY })
    expect(rides).toHaveLength(1)
    expect(rides[0]).toMatchObject({ type: 'looking', originCity: 'Munich', isOwn: true })

    // The festivals row was made from the event, under the same key.
    const [f] = await db.select().from(schema.festivals).where(eq(schema.festivals.slug, KEY))
    expect(f).toMatchObject({ name: 'Test Event Festival', startDate: '2027-05-01', endDate: '2027-05-03', city: 'Dachau' })
  })

  it('toggles looking for a roommate (RAZ-438)', async () => {
    expect(await caller(dancerId).roommate.toggle({ festivalSlug: KEY })).toEqual({ looking: true })
    expect((await caller(dancerId).roommate.list({ festivalSlug: KEY })).looking).toBe(true)
    expect(await caller(dancerId).roommate.toggle({ festivalSlug: KEY })).toEqual({ looking: false })
  })

  it('reuses one festivals row across calls', async () => {
    await caller(dancerId).rideShare.create({ festivalSlug: KEY, type: 'offering', originCity: 'Munich', date: '2027-05-01', seatsAvailable: 3 })
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.festivals).where(eq(schema.festivals.slug, KEY))
    expect(n).toBe(1)
  })

  it('still rejects an unknown festival', async () => {
    await expect(caller(dancerId).rideShare.create({ festivalSlug: 'no-such-festival-xyz', type: 'looking', originCity: 'Munich', date: '2027-05-01' }))
      .rejects.toThrow(/not found/i)
    await expect(caller(dancerId).roommate.toggle({ festivalSlug: 'no-such-festival-xyz' })).rejects.toThrow(/not found/i)
  })
})
