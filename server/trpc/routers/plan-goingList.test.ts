/**
 * Unit tests for plan.goingList — verified-ticket-holder filtering (RAZ-314).
 *
 * Hermetic — no DATABASE_URL required. Uses a multi-table FakeDb that
 * supports the festival path (festivals → festivalSignups ⋈ dancers) and
 * the event path (planItems ⋈ dancers).
 *
 * The "no fake friends" rule (RAZ-83): public attendee faces for festivals
 * must come from verified ticket holders only, never from unverified
 * "Going" clicks.
 */
import { describe, it, expect, vi } from 'vitest'
import { festivals, festivalSignups, dancers, planItems } from '../../database/schema'

// ---------- drizzle mocks ----------

vi.mock('drizzle-orm', async () => {
  const snakeToCamel = (s: string) =>
    s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

  const eq = (col: any, val: any) => {
    const dbName: string | undefined = col?.name
    const jsKey = dbName ? snakeToCamel(dbName) : undefined
    const fn = (row: Record<string, any>) => {
      if (jsKey && Object.prototype.hasOwnProperty.call(row, jsKey)) {
        return row[jsKey] === val
      }
      if (dbName && Object.prototype.hasOwnProperty.call(row, dbName)) {
        return row[dbName] === val
      }
      return false
    }
    return fn
  }

  const ne = (col: any, val: any) => {
    const dbName: string | undefined = col?.name
    const jsKey = dbName ? snakeToCamel(dbName) : undefined
    return (row: Record<string, any>) => {
      if (jsKey && Object.prototype.hasOwnProperty.call(row, jsKey)) {
        return row[jsKey] !== val
      }
      if (dbName && Object.prototype.hasOwnProperty.call(row, dbName)) {
        return row[dbName] !== val
      }
      return true
    }
  }

  const isNotNull = (col: any) => {
    const dbName: string | undefined = col?.name
    const jsKey = dbName ? snakeToCamel(dbName) : undefined
    return (row: Record<string, any>) => {
      if (jsKey && Object.prototype.hasOwnProperty.call(row, jsKey)) {
        return row[jsKey] != null
      }
      return true
    }
  }

  const and = (...preds: any[]) => (row: Record<string, any>) =>
    preds.every(p => p(row))

  return {
    eq, and, ne, isNotNull,
    sql: (..._args: any[]) => ({}),
    unique: () => ({}),
    index: () => ({}),
    inArray: () => () => true,
    gte: () => () => true,
    lt: () => () => true,
    asc: () => ({}),
    ilike: () => () => true,
  }
})

// ---------- FakeDb ----------

interface FakeRow { [k: string]: any }

class FakeDb {
  festivals: FakeRow[] = []
  dancers: FakeRow[] = []
  signups: FakeRow[] = []
  planItems: FakeRow[] = []

  seedFestival(slug: string, id = 'fest-' + slug) {
    this.festivals.push({ id, slug, name: slug })
    return id
  }

  seedDancer(opts: {
    id?: string
    name?: string
    city?: string | null
    photo?: string | null
    username?: string | null
    profilePublic?: boolean
  }) {
    const id = opts.id ?? 'dancer-' + this.dancers.length
    this.dancers.push({
      id,
      name: opts.name ?? 'Dancer ' + id,
      city: opts.city ?? null,
      photo: opts.photo ?? null,
      username: opts.username ?? id,
      profilePublic: opts.profilePublic ?? true,
    })
    return id
  }

  seedSignup(row: FakeRow) {
    this.signups.push({
      id: row.id ?? 'sig-' + this.signups.length,
      festivalId: row.festivalId,
      dancerId: row.dancerId ?? null,
      verifiedTicketHolder: row.verifiedTicketHolder ?? false,
      rosterVisibility: row.rosterVisibility ?? 'public_minimal',
      createdAt: row.createdAt ?? new Date(),
    })
  }

  seedPlanItem(row: FakeRow) {
    this.planItems.push({
      id: row.id ?? 'pi-' + this.planItems.length,
      dancerId: row.dancerId,
      itemType: row.itemType,
      itemId: row.itemId,
      shareGoing: row.shareGoing ?? false,
      createdAt: row.createdAt ?? new Date(),
    })
  }

  private tableFor(table: any): FakeRow[] {
    if (table === festivals) return this.festivals
    if (table === dancers) return this.dancers
    if (table === festivalSignups) return this.signups
    if (table === planItems) return this.planItems
    throw new Error('FakeDb: unexpected table reference')
  }

  select(_columns: any) {
    const self = this
    return {
      from: (table: any) => {
        const baseRows = () => self.tableFor(table).map(r => ({ ...r }))
        return {
          where: (filter: (r: FakeRow) => boolean) => {
            return Promise.resolve(baseRows().filter(filter))
          },
          innerJoin: (otherTable: any, _predicate: any) => {
            // Join base table rows with the other table on dancerId = id
            const otherRows = self.tableFor(otherTable)
            const joined: FakeRow[] = []
            for (const base of baseRows()) {
              const match = base.dancerId
                ? otherRows.find(o => o.id === base.dancerId)
                : null
              if (match) {
                // Merge: base fields + dancer fields (dancer fields use
                // their column names so the mock eq() predicates can find
                // them on the flat merged row).
                joined.push({ ...base, ...match, dancerId: base.dancerId })
              }
            }
            return {
              where: (filter: (r: FakeRow) => boolean) => ({
                limit: (_n: number) => Promise.resolve(
                  joined.filter(filter).map(r => ({
                    dancerId: r.dancerId,
                    name: r.name,
                    photo: r.photo,
                    city: r.city,
                    username: r.username,
                  })),
                ),
              }),
            }
          },
        }
      },
    }
  }

  // Stubs for other methods the router imports may need
  insert(_table: any) {
    return { values: () => ({ onConflictDoNothing: () => Promise.resolve() }) }
  }

  update(_table: any) {
    return { set: () => ({ where: () => Promise.resolve() }) }
  }

  delete(_table: any) {
    return { where: () => Promise.resolve() }
  }
}

// ---------- router under test ----------

;(globalThis as any).useRuntimeConfig = () => ({ databaseUrl: '' })

import { planRouter } from './plan'
import { router } from '../trpc'

const appRouter = router({ plan: planRouter })

function makeCaller(db: FakeDb) {
  return appRouter.createCaller({ db: db as any, dancerId: null, isAdmin: false })
}

const SLUG = 'charanga-habanera-munich-2026'

// =====================================================================
// goingList — festival path (RAZ-314: verified ticket holders only)
// =====================================================================

describe('plan.goingList — festival: verified ticket holders only (RAZ-314)', () => {
  it('returns empty list when festival does not exist', async () => {
    const db = new FakeDb()
    const caller = makeCaller(db)
    const res = await caller.plan.goingList({ festivalSlug: 'nonexistent' })
    expect(res).toEqual([])
  })

  it('returns a verified ticket holder with a public profile', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(SLUG)
    const dancer = db.seedDancer({ name: 'Iciar', city: 'Munich', photo: 'iciar.jpg', username: 'iciar' })
    db.seedSignup({ festivalId, dancerId: dancer, verifiedTicketHolder: true, rosterVisibility: 'public_full' })

    const caller = makeCaller(db)
    const res = await caller.plan.goingList({ festivalSlug: SLUG })

    expect(res).toHaveLength(1)
    expect(res[0]).toMatchObject({ name: 'Iciar', city: 'Munich', username: 'iciar' })
  })

  it('excludes a dancer who only clicked Going (no ticket)', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(SLUG)
    const verified = db.seedDancer({ name: 'Ticket Holder', username: 'th' })
    const goingOnly = db.seedDancer({ name: 'Just Going', username: 'jg' })

    db.seedSignup({ festivalId, dancerId: verified, verifiedTicketHolder: true })
    // goingOnly has a plan_item but NO signup — should not appear
    db.seedPlanItem({ dancerId: goingOnly, itemType: 'festival', itemId: SLUG, shareGoing: true })

    const caller = makeCaller(db)
    const res = await caller.plan.goingList({ festivalSlug: SLUG })

    expect(res).toHaveLength(1)
    expect(res[0].name).toBe('Ticket Holder')
  })

  it('excludes a dancer with an unverified ticket', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(SLUG)
    const verified = db.seedDancer({ name: 'Verified', username: 'v' })
    const unverified = db.seedDancer({ name: 'Unverified', username: 'uv' })

    db.seedSignup({ festivalId, dancerId: verified, verifiedTicketHolder: true })
    db.seedSignup({ festivalId, dancerId: unverified, verifiedTicketHolder: false })

    const caller = makeCaller(db)
    const res = await caller.plan.goingList({ festivalSlug: SLUG })

    expect(res).toHaveLength(1)
    expect(res[0].name).toBe('Verified')
  })

  it('excludes a dancer who set roster_visibility to hidden', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(SLUG)
    const visible = db.seedDancer({ name: 'Visible', username: 'vis' })
    const hidden = db.seedDancer({ name: 'Hidden', username: 'hid' })

    db.seedSignup({ festivalId, dancerId: visible, verifiedTicketHolder: true, rosterVisibility: 'public_minimal' })
    db.seedSignup({ festivalId, dancerId: hidden, verifiedTicketHolder: true, rosterVisibility: 'hidden' })

    const caller = makeCaller(db)
    const res = await caller.plan.goingList({ festivalSlug: SLUG })

    expect(res).toHaveLength(1)
    expect(res[0].name).toBe('Visible')
  })

  it('excludes a dancer with profile_public = false', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(SLUG)
    const publicDancer = db.seedDancer({ name: 'Public', username: 'pub', profilePublic: true })
    const privateDancer = db.seedDancer({ name: 'Private', username: 'prv', profilePublic: false })

    db.seedSignup({ festivalId, dancerId: publicDancer, verifiedTicketHolder: true })
    db.seedSignup({ festivalId, dancerId: privateDancer, verifiedTicketHolder: true })

    const caller = makeCaller(db)
    const res = await caller.plan.goingList({ festivalSlug: SLUG })

    expect(res).toHaveLength(1)
    expect(res[0].name).toBe('Public')
  })

  it('excludes stub rows (dancerId null)', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(SLUG)
    const dancer = db.seedDancer({ name: 'Real', username: 'real' })

    db.seedSignup({ festivalId, dancerId: dancer, verifiedTicketHolder: true })
    db.seedSignup({ festivalId, dancerId: null, verifiedTicketHolder: true })

    const caller = makeCaller(db)
    const res = await caller.plan.goingList({ festivalSlug: SLUG })

    expect(res).toHaveLength(1)
    expect(res[0].name).toBe('Real')
  })

  it('does not show a ticket holder from a different festival', async () => {
    const db = new FakeDb()
    const festA = db.seedFestival('festival-a')
    const festB = db.seedFestival('festival-b')
    const dancerA = db.seedDancer({ name: 'A-dancer', username: 'a' })
    const dancerB = db.seedDancer({ name: 'B-dancer', username: 'b' })

    db.seedSignup({ festivalId: festA, dancerId: dancerA, verifiedTicketHolder: true })
    db.seedSignup({ festivalId: festB, dancerId: dancerB, verifiedTicketHolder: true })

    const caller = makeCaller(db)
    const res = await caller.plan.goingList({ festivalSlug: 'festival-a' })

    expect(res).toHaveLength(1)
    expect(res[0].name).toBe('A-dancer')
  })

  it('does not require authentication (public procedure)', async () => {
    const db = new FakeDb()
    db.seedFestival(SLUG)
    const caller = makeCaller(db) // dancerId = null
    const res = await caller.plan.goingList({ festivalSlug: SLUG })
    expect(res).toEqual([])
  })
})

// =====================================================================
// goingList — event path (unchanged behaviour)
// =====================================================================

describe('plan.goingList — event: opt-in share_going (unchanged)', () => {
  it('returns dancers with shareGoing=true and profilePublic=true', async () => {
    const db = new FakeDb()
    const dancer = db.seedDancer({ name: 'Sharer', username: 'sh', profilePublic: true })
    db.seedPlanItem({ dancerId: dancer, itemType: 'event', itemId: 'ev-1', shareGoing: true })

    const caller = makeCaller(db)
    const res = await caller.plan.goingList({ itemType: 'event', itemId: 'ev-1' })

    expect(res).toHaveLength(1)
    expect(res[0].name).toBe('Sharer')
  })

  it('excludes dancers with shareGoing=false', async () => {
    const db = new FakeDb()
    const sharer = db.seedDancer({ name: 'Sharer', username: 'sh', profilePublic: true })
    const silent = db.seedDancer({ name: 'Silent', username: 'si', profilePublic: true })
    db.seedPlanItem({ dancerId: sharer, itemType: 'event', itemId: 'ev-2', shareGoing: true })
    db.seedPlanItem({ dancerId: silent, itemType: 'event', itemId: 'ev-2', shareGoing: false })

    const caller = makeCaller(db)
    const res = await caller.plan.goingList({ itemType: 'event', itemId: 'ev-2' })

    expect(res).toHaveLength(1)
    expect(res[0].name).toBe('Sharer')
  })
})
