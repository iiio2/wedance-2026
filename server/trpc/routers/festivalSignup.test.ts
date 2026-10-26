/**
 * Unit tests for the new O-008 PR 2 procedures on the festivalSignup router:
 *
 *   - publicRoster   (public query)
 *   - setMyVisibility  (protected mutation)
 *
 * Hermetic — no DATABASE_URL required. Uses the same FakeDb shape as
 * `server/api/webhooks/tickettailor.test.ts`, extended with `leftJoin`
 * support for the roster query. The fake mirrors just enough of the
 * drizzle query builder to exercise our two procedures; it is brittle by
 * design and a query change in the router will likely require updating
 * the fake.
 */
import { describe, it, expect, vi } from 'vitest'
import { festivals, festivalSignups, dancers } from '../../database/schema'

// ---------- drizzle mocks ----------
//
// Drizzle's `eq` / `and` produce opaque SQL objects at runtime; the FakeDb
// can't introspect them. We replace them with predicate-builders so the
// fake's `.where(filter)` receives plain functions instead of SQL.

vi.mock('drizzle-orm', async () => {
  const snakeToCamel = (s: string) =>
    s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

  const eq = (col: any, val: any) => {
    const dbName: string | undefined = col?.name
    const tableHint: string | undefined = col?.table
    const jsKey = dbName ? snakeToCamel(dbName) : undefined
    const fn = (row: Record<string, any>) => {
      // For join rows we namespace by table name; fall back to the flat
      // row shape for non-joined queries.
      if (tableHint && row[tableHint] && jsKey && Object.prototype.hasOwnProperty.call(row[tableHint], jsKey)) {
        return row[tableHint][jsKey] === val
      }
      if (jsKey && Object.prototype.hasOwnProperty.call(row, jsKey)) {
        return row[jsKey] === val
      }
      if (dbName && Object.prototype.hasOwnProperty.call(row, dbName)) {
        return row[dbName] === val
      }
      return false
    }
    // Tag the predicate with the column metadata so `leftJoin` can use it
    // as a join predicate.
    ;(fn as any).__joinMeta = { col, val }
    return fn
  }

  const and = (...preds: any[]) => {
    const fn = (row: Record<string, any>) => preds.every(p => p(row))
    return fn
  }

  return { eq, and, sql: (..._args: any[]) => ({}), gt: () => () => true }
})

// Mock drizzle pg-core just enough to satisfy schema imports.
// (Schema is imported above; the mock is for any indirect use.)

// ---------- FakeDb ----------

interface FakeRow { [k: string]: any }

class FakeDb {
  festivals: FakeRow[] = []
  dancers: FakeRow[] = []
  signups: FakeRow[] = []

  seedFestival(slug: string, id = 'fest-' + slug) {
    this.festivals.push({ id, slug, name: slug })
    return id
  }

  seedDancer(opts: { id?: string; email?: string; name?: string; city?: string | null; photo?: string | null }) {
    const id = opts.id ?? 'dancer-' + this.dancers.length
    this.dancers.push({
      id,
      email: opts.email ?? `${id}@example.com`,
      name: opts.name ?? 'Dancer ' + id,
      city: opts.city ?? null,
      photo: opts.photo ?? null,
      isAdmin: false,
    })
    return id
  }

  seedSignup(row: FakeRow) {
    this.signups.push({
      id: row.id ?? 'sig-' + this.signups.length,
      paidAmount: 0,
      verifiedTicketHolder: false,
      tickettailorOrderId: null,
      tickettailorBuyerEmail: null,
      verifiedAt: null,
      dancerId: null,
      rosterVisibility: 'public_minimal',
      ...row,
    })
  }

  // ---- query builder ----
  //
  // Supports the shapes our two procedures use:
  //   db.select({...}).from(t).where(eq(...))
  //   db.select({...}).from(t).leftJoin(t2, eq(...)).where(and(...))
  //   db.update(t).set(...).where(and(...))

  select(_columns: any) {
    const self = this
    return {
      from: (table: any) => {
        const baseRows = () => self.tableFor(table).map(r => ({ ...r }))
        return {
          where: (filter: (r: FakeRow) => boolean) => {
            return Promise.resolve(baseRows().filter(filter))
          },
          leftJoin: (otherTable: any, _predicate: any) => {
            // Take the column metadata from the predicate to figure out
            // which JS keys to compare. The predicate is `eq(a.x, b.y)`
            // (one column reference + one value) OR `eq(a.x, b.y)` where
            // both are column refs. Drizzle in our actual code uses
            // `eq(festivalSignups.dancerId, dancers.id)` — both column
            // refs — so we synthesize a join predicate manually.

            // `predicate` was built by `eq(col1, col2)` where col2 may be
            // a column object (no primitive). We can't introspect that
            // through our mock cleanly; instead we hard-code the only
            // join the router uses: festivalSignups.dancerId == dancers.id.
            const joined: FakeRow[] = []
            const baseTable = self.tableFor(table)
            const otherRows = self.tableFor(otherTable)
            for (const base of baseTable) {
              const match = base.dancerId
                ? otherRows.find(o => o.id === base.dancerId)
                : null
              joined.push({
                ...base,
                // namespace the joined-table fields so the projection
                // can pick them out
                dancers: match ?? null,
                festival_signups: base,
              })
            }
            return {
              where: (filter: (r: FakeRow) => boolean) => {
                return Promise.resolve(
                  joined
                    .filter(filter)
                    .map((r) => ({
                      // expose the projected shape the router asks for
                      id: r.id,
                      dancerId: r.dancerId,
                      rosterVisibility: r.rosterVisibility,
                      dancerName: r.dancers?.name ?? null,
                      dancerCity: r.dancers?.city ?? null,
                      dancerPhoto: r.dancers?.photo ?? null,
                    })),
                )
              },
            }
          },
        }
      },
    }
  }

  update(table: any) {
    const self = this
    return {
      set: (patch: FakeRow) => ({
        where: (filter: (r: FakeRow) => boolean) => {
          for (const row of self.tableFor(table)) {
            if (filter(row)) Object.assign(row, patch)
          }
          return Promise.resolve()
        },
      }),
    }
  }

  private tableFor(table: any): FakeRow[] {
    if (table === festivals) return this.festivals
    if (table === dancers) return this.dancers
    if (table === festivalSignups) return this.signups
    throw new Error('FakeDb: unexpected table reference')
  }
}

// ---------- caller helper ----------
//
// The router pulls in nuxt's `useRuntimeConfig` (for the Stripe checkout
// procedure). We don't exercise that here, but importing the module
// requires it to exist. Stub it.
;(globalThis as any).useRuntimeConfig = () => ({ stripeSecretKey: 'sk_test_dummy', siteUrl: 'http://test' })

import { festivalSignupRouter } from './festivalSignup'
import { router } from '../trpc'

const appRouter = router({ festivalSignup: festivalSignupRouter })

function makeCaller(db: FakeDb, opts: { dancerId?: string; isAdmin?: boolean } = {}) {
  return appRouter.createCaller({
    db: db as any,
    dancerId: opts.dancerId ?? null,
    isAdmin: opts.isAdmin ?? false,
  })
}

const SLUG = 'charanga-habanera-munich-2026'

// =====================================================================
// publicRoster
// =====================================================================

describe('festivalSignup.publicRoster', () => {
  it('returns empty roster when the festival does not exist', async () => {
    const db = new FakeDb()
    const caller = makeCaller(db)
    const res = await caller.festivalSignup.publicRoster({ festivalSlug: 'unknown' })
    expect(res).toEqual({ attendees: [], unclaimed: 0 })
  })

  it('includes only verified ticket holders', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(SLUG)
    const verifiedDancer = db.seedDancer({ name: 'Iciar', city: 'Munich' })
    const unverifiedDancer = db.seedDancer({ name: 'Ghost', city: 'Berlin' })
    db.seedSignup({ festivalId, dancerId: verifiedDancer, verifiedTicketHolder: true })
    db.seedSignup({ festivalId, dancerId: unverifiedDancer, verifiedTicketHolder: false })

    const caller = makeCaller(db)
    const res = await caller.festivalSignup.publicRoster({ festivalSlug: SLUG })

    expect(res.attendees).toHaveLength(1)
    expect(res.attendees[0]).toMatchObject({ displayName: 'Iciar', city: 'Munich' })
    expect(res.unclaimed).toBe(0)
  })

  it('counts stub rows (dancer_id null) as unclaimed instead of listing them', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(SLUG)
    const claimed = db.seedDancer({ name: 'Klaus', city: 'Munich' })
    db.seedSignup({ festivalId, dancerId: claimed, verifiedTicketHolder: true })
    // Two webhook stubs without a linked dancer.
    db.seedSignup({ festivalId, dancerId: null, verifiedTicketHolder: true, tickettailorBuyerEmail: 'a@x.com' })
    db.seedSignup({ festivalId, dancerId: null, verifiedTicketHolder: true, tickettailorBuyerEmail: 'b@x.com' })

    const caller = makeCaller(db)
    const res = await caller.festivalSignup.publicRoster({ festivalSlug: SLUG })

    expect(res.attendees).toHaveLength(1)
    expect(res.attendees[0].displayName).toBe('Klaus')
    expect(res.unclaimed).toBe(2)
  })

  it('hides rows with roster_visibility=hidden', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(SLUG)
    const visible = db.seedDancer({ name: 'Visible', city: 'Munich' })
    const hidden = db.seedDancer({ name: 'Shy', city: 'Berlin' })
    db.seedSignup({ festivalId, dancerId: visible, verifiedTicketHolder: true, rosterVisibility: 'public_minimal' })
    db.seedSignup({ festivalId, dancerId: hidden, verifiedTicketHolder: true, rosterVisibility: 'hidden' })

    const caller = makeCaller(db)
    const res = await caller.festivalSignup.publicRoster({ festivalSlug: SLUG })

    expect(res.attendees).toHaveLength(1)
    expect(res.attendees[0].displayName).toBe('Visible')
  })

  it('omits photo for public_minimal and includes photo for public_full', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(SLUG)
    const minimalDancer = db.seedDancer({ name: 'Min', city: 'Munich', photo: 'https://example.com/min.jpg' })
    const fullDancer = db.seedDancer({ name: 'Full', city: 'Berlin', photo: 'https://example.com/full.jpg' })
    db.seedSignup({ festivalId, dancerId: minimalDancer, verifiedTicketHolder: true, rosterVisibility: 'public_minimal' })
    db.seedSignup({ festivalId, dancerId: fullDancer, verifiedTicketHolder: true, rosterVisibility: 'public_full' })

    const caller = makeCaller(db)
    const res = await caller.festivalSignup.publicRoster({ festivalSlug: SLUG })

    const min = res.attendees.find(a => a.displayName === 'Min')!
    const full = res.attendees.find(a => a.displayName === 'Full')!

    expect(min.city).toBe('Munich')
    expect(min.photoUrl).toBeNull()
    expect(full.city).toBe('Berlin')
    expect(full.photoUrl).toBe('https://example.com/full.jpg')
  })

  it('does not require auth (public procedure)', async () => {
    const db = new FakeDb()
    db.seedFestival(SLUG)
    const caller = makeCaller(db, {}) // no dancerId
    const res = await caller.festivalSignup.publicRoster({ festivalSlug: SLUG })
    expect(res).toEqual({ attendees: [], unclaimed: 0 })
  })
})

// =====================================================================
// setMyVisibility
// =====================================================================

describe('festivalSignup.setMyVisibility', () => {
  it('updates the caller\'s own row', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(SLUG)
    const me = db.seedDancer({ name: 'Me' })
    db.seedSignup({ festivalId, dancerId: me, verifiedTicketHolder: true, rosterVisibility: 'public_minimal' })

    const caller = makeCaller(db, { dancerId: me })
    const res = await caller.festivalSignup.setMyVisibility({ festivalSlug: SLUG, level: 'hidden' })

    expect(res.level).toBe('hidden')
    const row = db.signups.find(r => r.dancerId === me)!
    expect(row.rosterVisibility).toBe('hidden')
  })

  it('does not touch other dancers\' rows', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(SLUG)
    const me = db.seedDancer({ name: 'Me' })
    const other = db.seedDancer({ name: 'Other' })
    db.seedSignup({ festivalId, dancerId: me, verifiedTicketHolder: true, rosterVisibility: 'public_minimal' })
    db.seedSignup({ festivalId, dancerId: other, verifiedTicketHolder: true, rosterVisibility: 'public_minimal' })

    const caller = makeCaller(db, { dancerId: me })
    await caller.festivalSignup.setMyVisibility({ festivalSlug: SLUG, level: 'public_full' })

    const myRow = db.signups.find(r => r.dancerId === me)!
    const otherRow = db.signups.find(r => r.dancerId === other)!
    expect(myRow.rosterVisibility).toBe('public_full')
    expect(otherRow.rosterVisibility).toBe('public_minimal')
  })

  it('errors when the caller has no signup row for that festival', async () => {
    const db = new FakeDb()
    db.seedFestival(SLUG)
    const me = db.seedDancer({ name: 'Me' })

    const caller = makeCaller(db, { dancerId: me })
    await expect(
      caller.festivalSignup.setMyVisibility({ festivalSlug: SLUG, level: 'hidden' }),
    ).rejects.toThrow(/no signup/i)
  })

  it('errors when the festival does not exist', async () => {
    const db = new FakeDb()
    const me = db.seedDancer({ name: 'Me' })
    const caller = makeCaller(db, { dancerId: me })
    await expect(
      caller.festivalSignup.setMyVisibility({ festivalSlug: 'nope', level: 'hidden' }),
    ).rejects.toThrow(/not found/i)
  })

  it('errors when the caller is not authenticated', async () => {
    const db = new FakeDb()
    db.seedFestival(SLUG)
    const caller = makeCaller(db) // no dancerId
    await expect(
      caller.festivalSignup.setMyVisibility({ festivalSlug: SLUG, level: 'hidden' }),
    ).rejects.toThrow(/not signed in/i)
  })

  it('rejects invalid visibility levels via zod', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(SLUG)
    const me = db.seedDancer({ name: 'Me' })
    db.seedSignup({ festivalId, dancerId: me, verifiedTicketHolder: true })
    const caller = makeCaller(db, { dancerId: me })
    await expect(
      // @ts-expect-error — deliberately bad input
      caller.festivalSignup.setMyVisibility({ festivalSlug: SLUG, level: 'public_partial' }),
    ).rejects.toThrow()
  })
})

// =====================================================================
// ticketCheckout
// =====================================================================

describe('festivalSignup.ticketCheckout', () => {
  it('rejects unauthenticated callers', async () => {
    const db = new FakeDb()
    db.seedFestival(SLUG)
    const caller = makeCaller(db) // no dancerId
    await expect(
      caller.festivalSignup.ticketCheckout({
        festivalSlug: SLUG,
        ticketNames: ['Full Pass'],
      }),
    ).rejects.toThrow(/not signed in/i)
  })

  it('rejects empty ticket names array', async () => {
    const db = new FakeDb()
    db.seedFestival(SLUG)
    const me = db.seedDancer({ name: 'Me' })
    const caller = makeCaller(db, { dancerId: me })
    await expect(
      caller.festivalSignup.ticketCheckout({
        festivalSlug: SLUG,
        ticketNames: [],
      }),
    ).rejects.toThrow()
  })

  it('rejects empty string in ticket names', async () => {
    const db = new FakeDb()
    db.seedFestival(SLUG)
    const me = db.seedDancer({ name: 'Me' })
    const caller = makeCaller(db, { dancerId: me })
    await expect(
      caller.festivalSignup.ticketCheckout({
        festivalSlug: SLUG,
        ticketNames: [''],
      }),
    ).rejects.toThrow()
  })

  it('rejects unknown ticket names (server-side price lookup)', async () => {
    const db = new FakeDb()
    db.seedFestival(SLUG)
    const me = db.seedDancer({ name: 'Me' })
    const caller = makeCaller(db, { dancerId: me })
    await expect(
      caller.festivalSignup.ticketCheckout({
        festivalSlug: SLUG,
        ticketNames: ['Fake VIP Pass'],
      }),
    ).rejects.toThrow(/not found/i)
  })

  it('rejects when user already has a verified ticket', async () => {
    const TICKET_SLUG = 'meneate-viena-2026'
    const db = new FakeDb()
    const festivalId = db.seedFestival(TICKET_SLUG)
    const me = db.seedDancer({ name: 'Already Bought' })
    db.seedSignup({ festivalId, dancerId: me, verifiedTicketHolder: true, paidAmount: 21000 })

    const caller = makeCaller(db, { dancerId: me })
    await expect(
      caller.festivalSignup.ticketCheckout({
        festivalSlug: TICKET_SLUG,
        ticketNames: ['Friday Pass'],
      }),
    ).rejects.toThrow(/already have a ticket/i)
  })

  it('allows checkout when user has social unlock but no verified ticket', async () => {
    const TICKET_SLUG = 'meneate-viena-2026'
    const db = new FakeDb()
    const festivalId = db.seedFestival(TICKET_SLUG)
    const me = db.seedDancer({ name: 'Social User', email: 'social@example.com' })
    db.seedSignup({ festivalId, dancerId: me, verifiedTicketHolder: false, paidAmount: 100 })

    const caller = makeCaller(db, { dancerId: me })
    // Should NOT reject — the user has a social unlock, not a verified ticket.
    // It will fail later at Stripe (dummy key), but should pass the guard.
    await expect(
      caller.festivalSignup.ticketCheckout({
        festivalSlug: TICKET_SLUG,
        ticketNames: ['Friday Pass'],
      }),
    ).rejects.not.toThrow(/already have a ticket/i)
  })
})
