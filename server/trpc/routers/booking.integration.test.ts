/**
 * Integration-level tests for the booking router: round-trip persistence and
 * transaction-safety. Builds on the hermetic FakeDb from entityBooking.test.ts.
 *
 * RAZ-652 — Persist booking details and T&C acceptance (round-trip).
 * RAZ-653 — Preserve availability when replacement insertion fails.
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

/**
 * FakeDb with snapshot-based transaction rollback: if the callback throws,
 * all mutations since the transaction started are undone — matching real
 * Postgres behaviour.
 */
class FakeDb {
  profiles: Row[] = []
  profileMembers: Row[] = []
  bookableSpaces: Row[] = []
  bookingRequests: Row[] = []
  availabilitySlots: Row[] = []
  dancers: Row[] = []

  /** When set, the next insert into this table throws (simulating a DB error). */
  private _failNextInsertInto: any | null = null
  failNextInsertInto(table: any) { this._failNextInsertInto = table }

  select(_c: any) { return { from: (t: any) => ({ where: (f: FilterFn) => Promise.resolve(this.tableFor(t).filter(f)) }) } }

  insert(t: any) {
    return {
      values: (rows: Row | Row[]) => {
        if (this._failNextInsertInto === t) {
          this._failNextInsertInto = null
          const chain: any = Promise.reject(new Error('Simulated insert failure'))
          chain.returning = () => Promise.reject(new Error('Simulated insert failure'))
          return chain
        }
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
      },
    }
  }

  delete(t: any) {
    return {
      where: (f: FilterFn) => {
        const tbl = this.tableFor(t)
        const keep = tbl.filter(r => !f(r))
        tbl.length = 0
        keep.forEach(r => tbl.push(r))
        return Promise.resolve(undefined)
      },
    }
  }

  /** Snapshot-based transaction: if fn throws, all table mutations are rolled back. */
  async transaction(fn: (tx: FakeDb) => Promise<void>) {
    const snap = {
      profiles: [...this.profiles],
      profileMembers: [...this.profileMembers],
      bookableSpaces: [...this.bookableSpaces],
      bookingRequests: [...this.bookingRequests],
      availabilitySlots: [...this.availabilitySlots],
      dancers: [...this.dancers],
    }
    try {
      await fn(this)
    } catch (e) {
      // Rollback to snapshot
      this.profiles = snap.profiles
      this.profileMembers = snap.profileMembers
      this.bookableSpaces = snap.bookableSpaces
      this.bookingRequests = snap.bookingRequests
      this.availabilitySlots = snap.availabilitySlots
      this.dancers = snap.dancers
      throw e
    }
  }

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

// ── RAZ-652 — Persist booking details and T&C acceptance ──────────────────

describe('booking.request — persist all fields (RAZ-652)', () => {
  it('persists eventDate, spaceId linkage, headcount, message and termsAcceptedAt in one request', async () => {
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'venue-1', name: 'Main Hall' })

    await caller(db, { dancerId: 'd1' }).booking.request({
      spaceId: '11111111-1111-4111-8111-111111111111',
      email: 'organizer@example.com',
      name: 'Test Organizer',
      termsAccepted: true,
      eventDate: '2026-11-15',
      startTime: '19:00',
      endTime: '23:00',
      headcount: 80,
      message: 'Birthday party with live band',
    })

    expect(db.bookingRequests).toHaveLength(1)
    const row = db.bookingRequests[0]

    // Area linkage: the request is linked to the space's venue profile
    expect(row.spaceId).toBe('11111111-1111-4111-8111-111111111111')
    expect(row.profileId).toBe('venue-1')

    // Date and time
    expect(row.eventDate).toBe('2026-11-15')
    expect(row.startTime).toBe('19:00')
    expect(row.endTime).toBe('23:00')

    // Headcount and message
    expect(row.headcount).toBe(80)
    expect(row.message).toBe('Birthday party with live band')

    // T&C acceptance timestamp
    expect(row.termsAcceptedAt).toBeInstanceOf(Date)

    // Requester metadata
    expect(row.requesterEmail).toBe('organizer@example.com')
    expect(row.requesterName).toBe('Test Organizer')
    expect(row.requesterId).toBe('d1')
  })

  it('persists a minimal booking (only required fields) with nulls for optional fields', async () => {
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'venue-1', name: 'Main Hall' })

    await caller(db).booking.request({
      spaceId: '11111111-1111-4111-8111-111111111111',
      email: 'anon@example.com',
      termsAccepted: true,
    })

    expect(db.bookingRequests).toHaveLength(1)
    const row = db.bookingRequests[0]

    expect(row.eventDate).toBeNull()
    expect(row.startTime).toBeNull()
    expect(row.endTime).toBeNull()
    expect(row.headcount).toBeNull()
    expect(row.message).toBeNull()
    expect(row.requesterName).toBeNull()
    expect(row.requesterId).toBeNull()
    expect(row.termsAcceptedAt).toBeInstanceOf(Date)
  })

  it('persists T&C acceptance with a real timestamp, not a boolean', async () => {
    const before = new Date()
    const db = new FakeDb()
    db.bookableSpaces.push({ id: '11111111-1111-4111-8111-111111111111', profileId: 'venue-1', name: 'A' })

    await caller(db).booking.request({
      spaceId: '11111111-1111-4111-8111-111111111111',
      email: 'org@example.com',
      termsAccepted: true,
    })
    const after = new Date()

    const ts = db.bookingRequests[0].termsAcceptedAt as Date
    expect(ts.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(ts.getTime()).toBeLessThanOrEqual(after.getTime())
  })
})

// ── RAZ-653 — Preserve availability when replacement insertion fails ──────

describe('booking.setAvailability — transaction safety (RAZ-653)', () => {
  it('preserves previous availability when the replacement insert fails', async () => {
    const db = new FakeDb()
    const spaceId = '11111111-1111-4111-8111-111111111111'
    db.bookableSpaces.push({ id: spaceId, profileId: 'p1', name: 'Main Hall' })
    db.profileMembers.push({ profileId: 'p1', dancerId: 'd1', role: 'owner' })

    // Pre-existing slot: Monday 18–23
    db.availabilitySlots.push({
      id: 'existing-slot',
      spaceId,
      dayOfWeek: 1,
      startTime: '18:00',
      endTime: '23:00',
      isActive: true,
    })

    // Arm the failure: next insert into availabilitySlots will throw
    db.failNextInsertInto(availabilitySlots)

    // Attempt to replace slots — should fail and roll back
    await expect(
      caller(db, { dancerId: 'd1' }).booking.setAvailability({
        spaceId,
        slots: [
          { dayOfWeek: 5, startTime: '19:00', endTime: '02:00' },
          { dayOfWeek: 6, startTime: '20:00', endTime: '03:00' },
        ],
      }),
    ).rejects.toThrow()

    // The original slot must still be intact (transaction rolled back)
    const remaining = db.availabilitySlots.filter(s => s.spaceId === spaceId)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].id).toBe('existing-slot')
    expect(remaining[0].dayOfWeek).toBe(1)
    expect(remaining[0].startTime).toBe('18:00')
  })

  it('replaces slots cleanly when the insert succeeds', async () => {
    const db = new FakeDb()
    const spaceId = '11111111-1111-4111-8111-111111111111'
    db.bookableSpaces.push({ id: spaceId, profileId: 'p1', name: 'Main Hall' })
    db.profileMembers.push({ profileId: 'p1', dancerId: 'd1', role: 'owner' })

    // Pre-existing slot
    db.availabilitySlots.push({
      id: 'old-slot',
      spaceId,
      dayOfWeek: 1,
      startTime: '18:00',
      endTime: '23:00',
      isActive: true,
    })

    // Replace without failure
    await caller(db, { dancerId: 'd1' }).booking.setAvailability({
      spaceId,
      slots: [
        { dayOfWeek: 3, startTime: '14:00', endTime: '22:00' },
      ],
    })

    const remaining = db.availabilitySlots.filter(s => s.spaceId === spaceId)
    expect(remaining).toHaveLength(1)
    expect(remaining[0].dayOfWeek).toBe(3)
    expect(remaining.find(s => s.id === 'old-slot')).toBeUndefined()
  })
})
