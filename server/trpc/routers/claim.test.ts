/**
 * Unit tests for the magic-link claim router.
 *
 * Mirrors the hermetic FakeDb pattern PR 1 established in
 * server/api/webhooks/tickettailor.test.ts so the suite stays runnable without
 * a live Neon connection. The fake covers the drizzle-orm shapes the router
 * actually uses: select/from/where, update/set/where, plus eq/and/isNull and
 * inArray predicates.
 *
 * RAZ-323: tests now cover the emailVerifiedAt gate on ticket claiming, the
 * protected getClaimStatus endpoint, and the security scenario where an
 * attacker registers with someone else's email to steal their tickets.
 */
import { describe, it, expect, vi } from 'vitest'
import { dancers, festivals, festivalSignups } from '../../database/schema'

// ---------- mocks ----------
//
// drizzle-orm's `eq`, `and`, `isNull`, `inArray` return opaque tagged objects.
// Replace them with predicate-builders so FakeDb's `.where(filter)` can run a
// plain JS check against a row instead.

type FilterFn = (row: Record<string, any>) => boolean

vi.mock('drizzle-orm', async () => {
  const snakeToCamel = (s: string) =>
    s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

  const resolveKey = (col: any): string | undefined => {
    const dbName: string | undefined = col?.name
    return dbName ? snakeToCamel(dbName) : undefined
  }

  const eq = (col: any, val: any): FilterFn => {
    const jsKey = resolveKey(col)
    return (row) => (jsKey ? row[jsKey] === val : false)
  }

  const and = (...preds: FilterFn[]): FilterFn => {
    return (row) => preds.every(p => p(row))
  }

  const isNull = (col: any): FilterFn => {
    const jsKey = resolveKey(col)
    return (row) => (jsKey ? row[jsKey] === null || row[jsKey] === undefined : false)
  }

  const inArray = (col: any, values: any[]): FilterFn => {
    const jsKey = resolveKey(col)
    const set = new Set(values)
    return (row) => (jsKey ? set.has(row[jsKey]) : false)
  }

  return { eq, and, isNull, inArray, sql: (..._args: any[]) => ({}), gt: () => () => false }
})

import { appRouter } from '../index'

// ---------- in-memory fake DB ----------

interface FakeRow { [k: string]: any }

class FakeDb {
  festivals: FakeRow[] = []
  dancers: FakeRow[] = []
  signups: FakeRow[] = []

  seedFestival(slug: string, name?: string, id?: string) {
    const fid = id ?? 'fest-' + slug
    this.festivals.push({ id: fid, slug, name: name ?? slug })
    return fid
  }

  /** Seed a dancer. Pass emailVerifiedAt to simulate a verified account. */
  seedDancer(email: string, id?: string, opts: { emailVerifiedAt?: Date | null } = {}) {
    const did = id ?? 'dancer-' + email
    this.dancers.push({
      id: did,
      email,
      emailVerifiedAt: 'emailVerifiedAt' in opts ? opts.emailVerifiedAt : new Date(), // verified by default
    })
    return did
  }

  /** Seed a dancer with NO email verification (simulates password-only signup). */
  seedUnverifiedDancer(email: string, id?: string) {
    return this.seedDancer(email, id, { emailVerifiedAt: null })
  }

  seedStubSignup(festivalId: string, buyerEmail: string, opts: Partial<FakeRow> = {}) {
    const id = opts.id ?? 'sig-' + this.signups.length
    this.signups.push({
      id,
      festivalId,
      dancerId: null,
      paidAmount: 0,
      verifiedTicketHolder: true,
      tickettailorOrderId: opts.tickettailorOrderId ?? `or_${id}`,
      tickettailorBuyerEmail: buyerEmail,
      verifiedAt: new Date(),
      ...opts,
    })
    return id
  }

  seedLinkedSignup(festivalId: string, dancerId: string) {
    const id = 'sig-' + this.signups.length
    this.signups.push({
      id,
      festivalId,
      dancerId,
      paidAmount: 0,
      verifiedTicketHolder: false,
      tickettailorOrderId: null,
      tickettailorBuyerEmail: null,
      verifiedAt: null,
    })
    return id
  }

  select(_columns: any) {
    return {
      from: (table: any) => {
        const rowsForTable = () => this.tableFor(table)
        const buildResult = (filter: FilterFn) => {
          const rows = rowsForTable().filter(filter)
          const promise: any = Promise.resolve(rows)
          promise.limit = (n: number) => Promise.resolve(rows.slice(0, n))
          return promise
        }
        return {
          where: (filter: FilterFn) => buildResult(filter),
        }
      },
    }
  }

  update(table: any) {
    return {
      set: (patch: FakeRow) => ({
        where: (filter: FilterFn) => {
          for (const row of this.tableFor(table)) {
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
    throw new Error('unexpected table in FakeDb')
  }
}

function createCaller(db: any, opts: { dancerId?: string; isAdmin?: boolean } = {}) {
  return appRouter.createCaller({
    db,
    dancerId: opts.dancerId ?? null,
    isAdmin: opts.isAdmin ?? false,
  })
}

const CHARANGA_SLUG = 'charanga-habanera-munich-2026'
const CHARANGA_NAME = 'Charanga Habanera Munich 2026'

// ---------- claimMyTicketHolderRows ----------

describe('claim.claimMyTicketHolderRows', () => {
  it('returns claimed:0 with no festivals when there are no stubs', async () => {
    const db = new FakeDb()
    db.seedFestival(CHARANGA_SLUG, CHARANGA_NAME)
    const dancerId = db.seedDancer('lonely@example.com')

    const caller = createCaller(db as any, { dancerId })
    const result = await caller.claim.claimMyTicketHolderRows()

    expect(result).toEqual({ claimed: 0, festivals: [] })
  })

  it('claims a single stub row matching the user email', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(CHARANGA_SLUG, CHARANGA_NAME)
    const dancerId = db.seedDancer('buyer@example.com')
    const stubId = db.seedStubSignup(festivalId, 'buyer@example.com')

    const caller = createCaller(db as any, { dancerId })
    const result = await caller.claim.claimMyTicketHolderRows()

    expect(result.claimed).toBe(1)
    expect(result.festivals).toEqual([{ slug: CHARANGA_SLUG, name: CHARANGA_NAME }])
    const updated = db.signups.find(s => s.id === stubId)
    expect(updated?.dancerId).toBe(dancerId)
  })

  it('is idempotent — re-running after a successful claim returns 0', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(CHARANGA_SLUG, CHARANGA_NAME)
    const dancerId = db.seedDancer('buyer@example.com')
    db.seedStubSignup(festivalId, 'buyer@example.com')

    const caller = createCaller(db as any, { dancerId })
    const first = await caller.claim.claimMyTicketHolderRows()
    const second = await caller.claim.claimMyTicketHolderRows()

    expect(first.claimed).toBe(1)
    expect(second.claimed).toBe(0)
    expect(second.festivals).toEqual([])
  })

  it('claims multiple stubs across different festivals in one call', async () => {
    const db = new FakeDb()
    const charangaId = db.seedFestival(CHARANGA_SLUG, CHARANGA_NAME)
    const otherId = db.seedFestival('cuban-fire-munich-2026', 'Cuban Fire')
    const dancerId = db.seedDancer('multi@example.com')
    db.seedStubSignup(charangaId, 'multi@example.com', { tickettailorOrderId: 'or_a' })
    db.seedStubSignup(otherId, 'multi@example.com', { tickettailorOrderId: 'or_b' })

    const caller = createCaller(db as any, { dancerId })
    const result = await caller.claim.claimMyTicketHolderRows()

    expect(result.claimed).toBe(2)
    expect(result.festivals).toHaveLength(2)
    const slugs = result.festivals.map(f => f.slug).sort()
    expect(slugs).toEqual(['charanga-habanera-munich-2026', 'cuban-fire-munich-2026'])
    expect(db.signups.every(s => s.dancerId === dancerId)).toBe(true)
  })

  it('email lookup is case-insensitive (stubs stored lowercase, dancer email mixed-case)', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(CHARANGA_SLUG, CHARANGA_NAME)
    const dancerId = db.seedDancer('Buyer@Example.COM')
    db.seedStubSignup(festivalId, 'buyer@example.com')

    const caller = createCaller(db as any, { dancerId })
    const result = await caller.claim.claimMyTicketHolderRows()

    expect(result.claimed).toBe(1)
  })

  it('skips stubs for festivals where the dancer already has a signup row', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(CHARANGA_SLUG, CHARANGA_NAME)
    const dancerId = db.seedDancer('overlap@example.com')
    db.seedLinkedSignup(festivalId, dancerId)
    db.seedStubSignup(festivalId, 'overlap@example.com')

    const caller = createCaller(db as any, { dancerId })
    const result = await caller.claim.claimMyTicketHolderRows()

    expect(result.claimed).toBe(0)
    expect(result.festivals).toEqual([])
  })

  it('rejects unauthenticated callers', async () => {
    const db = new FakeDb()
    const caller = createCaller(db as any, {})
    await expect(caller.claim.claimMyTicketHolderRows()).rejects.toThrow(/Not signed in/)
  })

  // ---------- RAZ-323: email verification gate ----------

  it('rejects an unverified email — prevents ticket theft via password-only signup', async () => {
    // Attack scenario: Eve registers with alice@example.com via the password
    // signup (no email verification). Alice's TicketTailor ticket stub exists.
    // Eve tries to claim → must be rejected.
    const db = new FakeDb()
    const festivalId = db.seedFestival(CHARANGA_SLUG, CHARANGA_NAME)
    const eveDancerId = db.seedUnverifiedDancer('alice@example.com', 'eve-id')
    db.seedStubSignup(festivalId, 'alice@example.com')

    const caller = createCaller(db as any, { dancerId: eveDancerId })
    await expect(caller.claim.claimMyTicketHolderRows()).rejects.toThrow(/verify your email/)

    // Stub must remain unclaimed.
    const stub = db.signups.find(s => s.tickettailorBuyerEmail === 'alice@example.com')
    expect(stub?.dancerId).toBeNull()
  })

  it('allows a verified email to claim tickets after magic-link sign-in', async () => {
    // Normal flow: buyer signs in via magic link (emailVerifiedAt is set),
    // then claims their ticket.
    const db = new FakeDb()
    const festivalId = db.seedFestival(CHARANGA_SLUG, CHARANGA_NAME)
    const dancerId = db.seedDancer('real-buyer@example.com', undefined, {
      emailVerifiedAt: new Date(),
    })
    db.seedStubSignup(festivalId, 'real-buyer@example.com')

    const caller = createCaller(db as any, { dancerId })
    const result = await caller.claim.claimMyTicketHolderRows()

    expect(result.claimed).toBe(1)
    expect(result.festivals).toEqual([{ slug: CHARANGA_SLUG, name: CHARANGA_NAME }])
  })

  it('attacker cannot claim after legitimate owner — idempotent guard', async () => {
    // Alice (verified) claims her ticket. Eve (also verified, same email —
    // hypothetically, e.g. if Alice deleted and Eve re-registered) tries to
    // claim the same stub. The stub is already linked, so Eve gets 0.
    const db = new FakeDb()
    const festivalId = db.seedFestival(CHARANGA_SLUG, CHARANGA_NAME)
    const aliceId = db.seedDancer('shared@example.com', 'alice')
    db.seedStubSignup(festivalId, 'shared@example.com')

    const aliceCaller = createCaller(db as any, { dancerId: aliceId })
    const aliceResult = await aliceCaller.claim.claimMyTicketHolderRows()
    expect(aliceResult.claimed).toBe(1)

    // Now Eve tries (different dancer id, same email).
    const eveId = db.seedDancer('shared@example.com', 'eve')
    const eveCaller = createCaller(db as any, { dancerId: eveId })
    const eveResult = await eveCaller.claim.claimMyTicketHolderRows()
    expect(eveResult.claimed).toBe(0)

    // Stub still belongs to Alice.
    const stub = db.signups[0]
    expect(stub.dancerId).toBe(aliceId)
  })
})

// ---------- getClaimStatus (now protected, RAZ-323) ----------

describe('claim.getClaimStatus', () => {
  it('rejects unauthenticated callers', async () => {
    const db = new FakeDb()
    const caller = createCaller(db as any, {})
    await expect(caller.claim.getClaimStatus()).rejects.toThrow(/Not signed in/)
  })

  it('returns pending:false when the verified user has no matching stub', async () => {
    const db = new FakeDb()
    db.seedFestival(CHARANGA_SLUG, CHARANGA_NAME)
    const dancerId = db.seedDancer('noone@example.com')

    const caller = createCaller(db as any, { dancerId })
    const result = await caller.claim.getClaimStatus()
    expect(result).toEqual({ pending: false })
  })

  it('returns pending:true with festival info when a verified user has a stub', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(CHARANGA_SLUG, CHARANGA_NAME)
    const dancerId = db.seedDancer('pending@example.com')
    db.seedStubSignup(festivalId, 'pending@example.com')

    const caller = createCaller(db as any, { dancerId })
    const result = await caller.claim.getClaimStatus()

    expect(result).toEqual({
      pending: true,
      festivalSlug: CHARANGA_SLUG,
      festivalName: CHARANGA_NAME,
    })
  })

  it('returns needsVerification for an unverified account (no info leak)', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(CHARANGA_SLUG, CHARANGA_NAME)
    const dancerId = db.seedUnverifiedDancer('unverified@example.com')
    db.seedStubSignup(festivalId, 'unverified@example.com')

    const caller = createCaller(db as any, { dancerId })
    const result = await caller.claim.getClaimStatus()

    // Must NOT reveal that tickets exist — returns pending:false with a hint.
    expect(result.pending).toBe(false)
    expect((result as any).needsVerification).toBe(true)
    expect((result as any).festivalSlug).toBeUndefined()
  })

  it('does not flag emails that are already linked (dancer_id IS NOT NULL)', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(CHARANGA_SLUG, CHARANGA_NAME)
    const dancerId = db.seedDancer('claimed@example.com')
    db.signups.push({
      id: 'sig-claimed',
      festivalId,
      dancerId,
      verifiedTicketHolder: true,
      tickettailorOrderId: 'or_claimed',
      tickettailorBuyerEmail: 'claimed@example.com',
      verifiedAt: new Date(),
    })

    const caller = createCaller(db as any, { dancerId })
    const result = await caller.claim.getClaimStatus()

    expect(result).toEqual({ pending: false })
  })
})
