/**
 * Hermetic tests for the entity (pro profiles) + booking routers.
 */
import { describe, it, expect, vi } from 'vitest'
import { profiles, profileMembers, bookableSpaces, bookingRequests, availabilitySlots, dancers } from '../../database/schema'

type FilterFn = (row: Record<string, any>) => boolean

vi.mock('drizzle-orm', async () => {
  const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())
  const resolveKey = (col: any): string | undefined => (col?.name ? snakeToCamel(col.name) : undefined)
  const eq = (col: any, val: any): FilterFn => { const k = resolveKey(col); return (r) => (k ? r[k] === val : false) }
  const and = (...p: FilterFn[]): FilterFn => (r) => p.every(f => f(r))
  const inArray = (col: any, vals: any[]): FilterFn => { const k = resolveKey(col); return (r) => (k ? vals.includes(r[k]) : false) }
  return { eq, and, inArray, gt: () => () => false, sql: (..._a: any[]) => ({}) }
})

import { appRouter } from '../index'

interface Row { [k: string]: any }
class FakeDb {
  profiles: Row[] = []
  profileMembers: Row[] = []
  bookableSpaces: Row[] = []
  bookingRequests: Row[] = []
  availabilitySlots: Row[] = []
  dancers: Row[] = []
  select(_c: any) { return { from: (t: any) => ({ where: (f: FilterFn) => Promise.resolve(this.tableFor(t).filter(f)) }) } }
  insert(t: any) {
    return { values: (rows: Row | Row[]) => {
      const arr = Array.isArray(rows) ? rows : [rows]
      const inserted = arr.map((row, i) => {
        const id = row.id ?? 'row-' + (this.tableFor(t).length + i)
        const ins = { id, status: row.status ?? 'pending', ...row }
        this.tableFor(t).push(ins)
        return ins
      })
      const chain: any = Promise.resolve(undefined)
      chain.returning = () => Promise.resolve(inserted)
      return chain
    } }
  }
  delete(t: any) {
    return { where: (f: FilterFn) => {
      const tbl = this.tableFor(t)
      const keep = tbl.filter(r => !f(r))
      tbl.length = 0
      keep.forEach(r => tbl.push(r))
      return Promise.resolve(undefined)
    } }
  }
  transaction(fn: (tx: FakeDb) => Promise<void>) { return fn(this) }
  private tableFor(t: any): Row[] {
    if (t === profiles) return this.profiles
    if (t === profileMembers) return this.profileMembers
    if (t === bookableSpaces) return this.bookableSpaces
    if (t === bookingRequests) return this.bookingRequests
    if (t === availabilitySlots) return this.availabilitySlots
    if (t === dancers) return this.dancers
    throw new Error('unexpected table')
  }
}
function caller(db: any, opts: { dancerId?: string | null; isAdmin?: boolean } = {}) {
  return appRouter.createCaller({ db, dancerId: opts.dancerId ?? null, isAdmin: opts.isAdmin ?? false })
}

describe('entity.getByHandle', () => {
  it('returns a visible profile with its spaces sorted by sortOrder', async () => {
    const db = new FakeDb()
    db.profiles.push({ id: 'p1', username: 'pina', type: 'venue', name: 'Pina', status: 'visible', city: 'Munich', citySlug: 'munich' })
    db.bookableSpaces.push({ id: 's2', profileId: 'p1', name: 'B', sortOrder: 20 })
    db.bookableSpaces.push({ id: 's1', profileId: 'p1', name: 'A', sortOrder: 10 })
    const res = await caller(db).entity.getByHandle({ handle: 'pina' })
    expect(res?.profile.name).toBe('Pina')
    expect(res?.spaces.map((s: any) => s.name)).toEqual(['A', 'B'])
  })

  it('returns null for an unknown handle', async () => {
    const db = new FakeDb()
    expect(await caller(db).entity.getByHandle({ handle: 'nope' })).toBeNull()
  })

  it('returns only seeded areas after partial seeding, exposing the gap', async () => {
    const db = new FakeDb()
    db.profiles.push({ id: 'v1', username: 'test-venue', type: 'venue', name: 'Test Venue', status: 'visible', city: 'TestCity', citySlug: 'testcity' })
    // Simulate partial seed: 3 of 6 expected areas created
    const EXPECTED_AREA_COUNT = 6
    db.bookableSpaces.push({ id: 'a1', profileId: 'v1', name: 'Zone Alpha', sortOrder: 1 })
    db.bookableSpaces.push({ id: 'a2', profileId: 'v1', name: 'Zone Beta', sortOrder: 2 })
    db.bookableSpaces.push({ id: 'a3', profileId: 'v1', name: 'Zone Gamma', sortOrder: 3 })

    const res = await caller(db).entity.getByHandle({ handle: 'test-venue' })
    // Only 3 spaces returned — the missing 3 are detectable
    expect(res?.spaces).toHaveLength(3)
    expect(res!.spaces.length).toBeLessThan(EXPECTED_AREA_COUNT)
    expect(res?.spaces.map((s: any) => s.name)).toEqual(['Zone Alpha', 'Zone Beta', 'Zone Gamma'])
  })

  it('returns all areas when seeding is complete', async () => {
    const db = new FakeDb()
    db.profiles.push({ id: 'v2', username: 'full-venue', type: 'venue', name: 'Full Venue', status: 'visible', city: 'TestCity', citySlug: 'testcity' })
    const EXPECTED_AREA_COUNT = 6
    for (let i = 1; i <= EXPECTED_AREA_COUNT; i++) {
      db.bookableSpaces.push({ id: `f${i}`, profileId: 'v2', name: `Zone ${i}`, sortOrder: i })
    }

    const res = await caller(db).entity.getByHandle({ handle: 'full-venue' })
    expect(res?.spaces).toHaveLength(EXPECTED_AREA_COUNT)
    expect(res?.spaces.map((s: any) => s.name)).toEqual(
      Array.from({ length: 6 }, (_, i) => `Zone ${i + 1}`),
    )
  })

  it('returns zero spaces when no areas are seeded', async () => {
    const db = new FakeDb()
    db.profiles.push({ id: 'v3', username: 'empty-venue', type: 'venue', name: 'Empty Venue', status: 'visible', city: 'TestCity', citySlug: 'testcity' })
    // No bookableSpaces added — simulates seeding that created the profile but crashed before areas

    const res = await caller(db).entity.getByHandle({ handle: 'empty-venue' })
    expect(res?.spaces).toHaveLength(0)
  })

  it('lists venues by city', async () => {
    const db = new FakeDb()
    db.profiles.push({ id: 'p1', username: 'pina', type: 'venue', name: 'Pina', status: 'visible', citySlug: 'munich' })
    db.profiles.push({ id: 'p2', username: 'other', type: 'venue', name: 'Other', status: 'visible', citySlug: 'berlin' })
    const res = await caller(db).entity.listByCity({ citySlug: 'munich', type: 'venue' })
    expect(res.map((v: any) => v.username)).toEqual(['pina'])
  })
})

describe('booking.request', () => {
  it('creates a request when terms are accepted', async () => {
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'p1', name: 'A' })
    const out = await caller(db, { dancerId: 'd1' }).booking.request({
      spaceId: '11111111-1111-4111-8111-111111111111',
      email: 'org@example.com', termsAccepted: true, headcount: 50,
    })
    expect(out.ok).toBe(true)
    expect(db.bookingRequests).toHaveLength(1)
    expect(db.bookingRequests[0].termsAcceptedAt).toBeTruthy()
    expect(db.bookingRequests[0].profileId).toBe('p1')
  })

  it('rejects when terms are not accepted', async () => {
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'p1', name: 'A' })
    await expect(caller(db).booking.request({
      spaceId: '11111111-1111-4111-8111-111111111111',
      email: 'org@example.com', termsAccepted: false,
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('404s when the space does not exist', async () => {
    const db = new FakeDb()
    await expect(caller(db).booking.request({
      spaceId: '22222222-2222-4222-8222-222222222222',
      email: 'org@example.com', termsAccepted: true,
    })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('rejects when eventDate falls outside published availability', async () => {
    const db = new FakeDb()
    const spaceId = '11111111-1111-4111-8111-111111111111'
    db.bookableSpaces.push({ id: spaceId, profileId: 'p1', name: 'A' })
    // Slot on Monday (1) only
    db.availabilitySlots.push({ id: 'av1', spaceId, dayOfWeek: 1, startTime: '18:00', endTime: '23:00', isActive: true })
    // 2026-10-07 is a Wednesday (dayOfWeek=3)
    await expect(caller(db).booking.request({
      spaceId, email: 'org@example.com', termsAccepted: true,
      eventDate: '2026-10-07',
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('accepts when eventDate matches published availability', async () => {
    const db = new FakeDb()
    const spaceId = '11111111-1111-4111-8111-111111111111'
    db.bookableSpaces.push({ id: spaceId, profileId: 'p1', name: 'A' })
    // Slot on Monday (1)
    db.availabilitySlots.push({ id: 'av1', spaceId, dayOfWeek: 1, startTime: '18:00', endTime: '23:00', isActive: true })
    // 2026-10-05 is a Monday
    const out = await caller(db).booking.request({
      spaceId, email: 'org@example.com', termsAccepted: true,
      eventDate: '2026-10-05',
    })
    expect(out.ok).toBe(true)
  })

  it('allows booking on any day when no availability slots are published', async () => {
    const db = new FakeDb()
    const spaceId = '11111111-1111-4111-8111-111111111111'
    db.bookableSpaces.push({ id: spaceId, profileId: 'p1', name: 'A' })
    // No availability slots — space is fully open
    const out = await caller(db).booking.request({
      spaceId, email: 'org@example.com', termsAccepted: true,
      eventDate: '2026-10-07',
    })
    expect(out.ok).toBe(true)
  })

  // ── Area (spaceId) validation ───────────────────────────────────────────────
  it('rejects a non-UUID spaceId at the schema level', async () => {
    const db = new FakeDb()
    await expect(caller(db).booking.request({
      spaceId: 'not-a-uuid',
      email: 'org@example.com', termsAccepted: true,
    })).rejects.toThrow()
  })

  // ── Headcount validation ────────────────────────────────────────────────────
  it('rejects headcount of zero', async () => {
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'p1', name: 'A' })
    await expect(caller(db).booking.request({
      spaceId: '11111111-1111-4111-8111-111111111111',
      email: 'org@example.com', termsAccepted: true, headcount: 0,
    })).rejects.toThrow()
  })

  it('rejects a negative headcount', async () => {
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'p1', name: 'A' })
    await expect(caller(db).booking.request({
      spaceId: '11111111-1111-4111-8111-111111111111',
      email: 'org@example.com', termsAccepted: true, headcount: -5,
    })).rejects.toThrow()
  })

  it('rejects a fractional headcount', async () => {
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'p1', name: 'A' })
    await expect(caller(db).booking.request({
      spaceId: '11111111-1111-4111-8111-111111111111',
      email: 'org@example.com', termsAccepted: true, headcount: 1.5,
    })).rejects.toThrow()
  })

  it('rejects headcount above 100 000', async () => {
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'p1', name: 'A' })
    await expect(caller(db).booking.request({
      spaceId: '11111111-1111-4111-8111-111111111111',
      email: 'org@example.com', termsAccepted: true, headcount: 100001,
    })).rejects.toThrow()
  })

  it('accepts headcount at lower boundary (1)', async () => {
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'p1', name: 'A' })
    const out = await caller(db).booking.request({
      spaceId: '11111111-1111-4111-8111-111111111111',
      email: 'org@example.com', termsAccepted: true, headcount: 1,
    })
    expect(out.ok).toBe(true)
  })

  it('accepts headcount at upper boundary (100 000)', async () => {
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'p1', name: 'A' })
    const out = await caller(db).booking.request({
      spaceId: '11111111-1111-4111-8111-111111111111',
      email: 'org@example.com', termsAccepted: true, headcount: 100000,
    })
    expect(out.ok).toBe(true)
  })

  // ── Message validation ──────────────────────────────────────────────────────
  it('rejects a message longer than 2 000 characters', async () => {
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'p1', name: 'A' })
    await expect(caller(db).booking.request({
      spaceId: '11111111-1111-4111-8111-111111111111',
      email: 'org@example.com', termsAccepted: true, message: 'x'.repeat(2001),
    })).rejects.toThrow()
  })

  it('accepts a message at exactly 2 000 characters', async () => {
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'p1', name: 'A' })
    const out = await caller(db).booking.request({
      spaceId: '11111111-1111-4111-8111-111111111111',
      email: 'org@example.com', termsAccepted: true, message: 'x'.repeat(2000),
    })
    expect(out.ok).toBe(true)
  })

  // ── Date validation (business logic) ────────────────────────────────────────
  it('accepts a request with no eventDate (optional)', async () => {
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'p1', name: 'A' })
    const out = await caller(db).booking.request({
      spaceId: '11111111-1111-4111-8111-111111111111',
      email: 'org@example.com', termsAccepted: true,
    })
    expect(out.ok).toBe(true)
    expect(db.bookingRequests[0].eventDate).toBeNull()
  })

  it('rejects startTime outside published slot hours', async () => {
    const db = new FakeDb()
    const spaceId = '11111111-1111-4111-8111-111111111111'
    db.bookableSpaces.push({ id: spaceId, profileId: 'p1', name: 'A' })
    // Slot on Monday (1) from 18:00–23:00
    db.availabilitySlots.push({ id: 'av1', spaceId, dayOfWeek: 1, startTime: '18:00', endTime: '23:00', isActive: true })
    // 2026-10-05 is a Monday — correct day, but 10:00 is before the 18:00 window
    await expect(caller(db).booking.request({
      spaceId, email: 'org@example.com', termsAccepted: true,
      eventDate: '2026-10-05', startTime: '10:00',
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('accepts startTime within published slot hours', async () => {
    const db = new FakeDb()
    const spaceId = '11111111-1111-4111-8111-111111111111'
    db.bookableSpaces.push({ id: spaceId, profileId: 'p1', name: 'A' })
    db.availabilitySlots.push({ id: 'av1', spaceId, dayOfWeek: 1, startTime: '18:00', endTime: '23:00', isActive: true })
    // 2026-10-05 is a Monday, 19:00 falls inside 18:00–23:00
    const out = await caller(db).booking.request({
      spaceId, email: 'org@example.com', termsAccepted: true,
      eventDate: '2026-10-05', startTime: '19:00',
    })
    expect(out.ok).toBe(true)
  })

  it('rejects endTime that exceeds the slot window', async () => {
    const db = new FakeDb()
    const spaceId = '11111111-1111-4111-8111-111111111111'
    db.bookableSpaces.push({ id: spaceId, profileId: 'p1', name: 'A' })
    db.availabilitySlots.push({ id: 'av1', spaceId, dayOfWeek: 1, startTime: '18:00', endTime: '23:00', isActive: true })
    // 2026-10-05 Monday, start 19:00 ok but end 23:30 exceeds slot
    await expect(caller(db).booking.request({
      spaceId, email: 'org@example.com', termsAccepted: true,
      eventDate: '2026-10-05', startTime: '19:00', endTime: '23:30',
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('stores headcount and message on the persisted booking request', async () => {
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'p1', name: 'A' })
    await caller(db).booking.request({
      spaceId: '11111111-1111-4111-8111-111111111111',
      email: 'org@example.com', termsAccepted: true,
      headcount: 120, message: 'Birthday party',
    })
    expect(db.bookingRequests[0].headcount).toBe(120)
    expect(db.bookingRequests[0].message).toBe('Birthday party')
  })
})

// ── Date-only weekday consistency (RAZ-649) ────────────────────────────────
// The booking router converts YYYY-MM-DD strings into ISO day-of-week via
// utcDayOfWeek (Date.UTC → getUTCDay → 1=Mon…7=Sun). If it used a naive
// new Date(str).getDay(), a server in a negative-UTC-offset zone could shift
// a Sunday onto Saturday. These tests pin all seven weekdays against
// their matching availability slots.
describe('booking.request — date-only weekday consistency', () => {
  // 2026-10-05=Mon … 2026-10-11=Sun (verified from existing tests)
  const WEEK: [string, number][] = [
    ['2026-10-05', 1], // Monday
    ['2026-10-06', 2], // Tuesday
    ['2026-10-07', 3], // Wednesday
    ['2026-10-08', 4], // Thursday
    ['2026-10-09', 5], // Friday
    ['2026-10-10', 6], // Saturday
    ['2026-10-11', 7], // Sunday
  ]

  for (const [date, isoDay] of WEEK) {
    it(`accepts ${date} (ISO day ${isoDay}) when slot matches that weekday`, async () => {
      const db = new FakeDb()
      const spaceId = '11111111-1111-4111-8111-111111111111'
      db.bookableSpaces.push({ id: spaceId, profileId: 'p1', name: 'A' })
      db.availabilitySlots.push({ id: `av-${isoDay}`, spaceId, dayOfWeek: isoDay, startTime: '10:00', endTime: '22:00', isActive: true })
      const out = await caller(db).booking.request({
        spaceId, email: 'org@example.com', termsAccepted: true, eventDate: date,
      })
      expect(out.ok).toBe(true)
    })

    it(`rejects ${date} (ISO day ${isoDay}) when only an adjacent weekday is available`, async () => {
      const db = new FakeDb()
      const spaceId = '11111111-1111-4111-8111-111111111111'
      db.bookableSpaces.push({ id: spaceId, profileId: 'p1', name: 'A' })
      const wrongDay = isoDay === 7 ? 1 : isoDay + 1
      db.availabilitySlots.push({ id: 'av-wrong', spaceId, dayOfWeek: wrongDay, startTime: '10:00', endTime: '22:00', isActive: true })
      await expect(caller(db).booking.request({
        spaceId, email: 'org@example.com', termsAccepted: true, eventDate: date,
      })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    })
  }

  it('Sunday (ISO 7) is never matched by JS-native day 0', async () => {
    // Regression: new Date('2026-10-11').getDay() === 0 in JS, but ISO Sunday = 7.
    // A slot with dayOfWeek=0 must not match any valid date.
    const db = new FakeDb()
    const spaceId = '11111111-1111-4111-8111-111111111111'
    db.bookableSpaces.push({ id: spaceId, profileId: 'p1', name: 'A' })
    db.availabilitySlots.push({ id: 'av0', spaceId, dayOfWeek: 0 as any, startTime: '10:00', endTime: '22:00', isActive: true })
    await expect(caller(db).booking.request({
      spaceId, email: 'org@example.com', termsAccepted: true, eventDate: '2026-10-11',
    })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })
})

describe('booking.setAvailability', () => {
  it('replaces all slots for a space (admin)', async () => {
    const db = new FakeDb()
    const spaceId = '11111111-1111-4111-8111-111111111111'
    db.bookableSpaces.push({ id: spaceId, profileId: 'p1', name: 'A' })
    db.availabilitySlots.push({ id: 'old', spaceId, dayOfWeek: 3, startTime: '10:00', endTime: '18:00', isActive: true })

    const out = await caller(db, { dancerId: 'd1', isAdmin: true }).booking.setAvailability({
      spaceId,
      slots: [
        { dayOfWeek: 1, startTime: '18:00', endTime: '23:00' },
        { dayOfWeek: 5, startTime: '19:00', endTime: '02:00' },
      ],
    })
    expect(out.ok).toBe(true)
    expect(db.availabilitySlots.filter(s => s.spaceId === spaceId)).toHaveLength(2)
    expect(db.availabilitySlots.find(s => s.dayOfWeek === 3)).toBeUndefined()
  })

  it('rejects unauthenticated callers', async () => {
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'p1', name: 'A' })
    await expect(caller(db).booking.setAvailability({
      spaceId: '11111111-1111-4111-8111-111111111111',
      slots: [],
    })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('rejects a signed-in dancer who is not a member of the venue', async () => {
    const db = new FakeDb()
    const spaceId = '11111111-1111-4111-8111-111111111111'
    db.bookableSpaces.push({ id: spaceId, profileId: 'p1', name: 'A' })
    db.profiles.push({ id: 'p1', username: 'pina', type: 'venue', name: 'Pina', status: 'visible' })
    db.dancers.push({ id: 'd2', username: 'someone-else' })
    // d2 has no profileMembers entry for p1 — should be rejected
    await expect(caller(db, { dancerId: 'd2' }).booking.setAvailability({
      spaceId,
      slots: [],
    })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('allows a venue owner to set availability', async () => {
    const db = new FakeDb()
    const spaceId = '11111111-1111-4111-8111-111111111111'
    db.bookableSpaces.push({ id: spaceId, profileId: 'p1', name: 'A' })
    db.profileMembers.push({ profileId: 'p1', dancerId: 'd1', role: 'owner' })
    const out = await caller(db, { dancerId: 'd1' }).booking.setAvailability({
      spaceId,
      slots: [{ dayOfWeek: 6, startTime: '20:00', endTime: '03:00' }],
    })
    expect(out.ok).toBe(true)
  })

  it('allows an editor to set availability', async () => {
    const db = new FakeDb()
    const spaceId = '11111111-1111-4111-8111-111111111111'
    db.bookableSpaces.push({ id: spaceId, profileId: 'p1', name: 'A' })
    db.profileMembers.push({ profileId: 'p1', dancerId: 'd1', role: 'editor' })
    const out = await caller(db, { dancerId: 'd1' }).booking.setAvailability({
      spaceId,
      slots: [{ dayOfWeek: 3, startTime: '14:00', endTime: '22:00' }],
    })
    expect(out.ok).toBe(true)
  })

  it('allows a moderator (steward) to set availability', async () => {
    const db = new FakeDb()
    const spaceId = '11111111-1111-4111-8111-111111111111'
    db.bookableSpaces.push({ id: spaceId, profileId: 'p1', name: 'A' })
    db.profileMembers.push({ profileId: 'p1', dancerId: 'd1', role: 'moderator' })
    const out = await caller(db, { dancerId: 'd1' }).booking.setAvailability({
      spaceId,
      slots: [{ dayOfWeek: 1, startTime: '18:00', endTime: '23:00' }],
    })
    expect(out.ok).toBe(true)
  })

  it('404s for unknown space (admin)', async () => {
    const db = new FakeDb()
    await expect(caller(db, { dancerId: 'd1', isAdmin: true }).booking.setAvailability({
      spaceId: '22222222-2222-4222-8222-222222222222',
      slots: [],
    })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  // --- RAZ-651: comprehensive HH:MM availability validation ---

  it.each([
    ['29:99', '23:00', 'hour and minute both out of range (startTime)'],
    ['24:00', '23:00', 'hour 24 is out of range (startTime)'],
    ['10:60', '23:00', 'minute 60 is out of range (startTime)'],
    ['99:00', '23:00', 'hour 99 is out of range (startTime)'],
    ['18:00', '24:00', 'hour 24 is out of range (endTime)'],
    ['18:00', '10:60', 'minute 60 is out of range (endTime)'],
    ['18:00', '29:99', 'hour and minute both out of range (endTime)'],
  ])('rejects out-of-range time %s / %s (%s)', async (startTime, endTime, _label) => {
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'p1', name: 'A' })
    await expect(caller(db, { dancerId: 'd1', isAdmin: true }).booking.setAvailability({
      spaceId: '11111111-1111-4111-8111-111111111111',
      slots: [{ dayOfWeek: 1, startTime, endTime }],
    })).rejects.toThrow()
  })

  it.each([
    ['9:00', '23:00', 'single-digit hour (startTime)'],
    ['18:00', '9:00', 'single-digit hour (endTime)'],
    ['12:5', '23:00', 'single-digit minute (startTime)'],
    ['abc', '23:00', 'non-numeric string (startTime)'],
    ['', '23:00', 'empty string (startTime)'],
    ['1200', '23:00', 'missing colon (startTime)'],
    ['12:00:00', '23:00', 'seconds included (startTime)'],
    ['18:00', '12:00:00', 'seconds included (endTime)'],
  ])('rejects malformed format %s / %s (%s)', async (startTime, endTime, _label) => {
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'p1', name: 'A' })
    await expect(caller(db, { dancerId: 'd1', isAdmin: true }).booking.setAvailability({
      spaceId: '11111111-1111-4111-8111-111111111111',
      slots: [{ dayOfWeek: 1, startTime, endTime }],
    })).rejects.toThrow()
  })

  it.each([
    ['00:00', '23:59', 'full day boundary'],
    ['23:59', '00:00', 'latest start wrapping to midnight end'],
    ['00:00', '00:00', 'midnight to midnight'],
  ])('accepts valid boundary times %s / %s (%s)', async (startTime, endTime, _label) => {
    const db = new FakeDb()
    const spaceId = '11111111-1111-4111-8111-111111111111'
    db.bookableSpaces.push({ id: spaceId, profileId: 'p1', name: 'A' })
    const out = await caller(db, { dancerId: 'd1', isAdmin: true }).booking.setAvailability({
      spaceId,
      slots: [{ dayOfWeek: 1, startTime, endTime }],
    })
    expect(out.ok).toBe(true)
  })
})
