/**
 * Unit tests for the TicketTailor webhook receiver.
 *
 * The handler itself is a thin wrapper over `tickettailor.lib`; this file
 * tests the pure lib (signature verification + body processing) against a
 * lightweight in-memory fake DB that mimics the bits of the drizzle query
 * builder we actually use. That keeps the suite hermetic — no Neon round-trip
 * required to run `bun run test`.
 */
import { describe, it, expect, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  verifySignature,
  extractEvents,
  processWebhookBody,
  TICKETTAILOR_FESTIVAL_MAP,
  ticketTailorPurchaseProps,
} from './tickettailor.lib'
import { dancers, festivals, festivalSignups } from '../../database/schema'

const SECRET = 'whsec_test_secret_for_unit_tests'
const CHARANGA_TT_EVENT_ID = 'ev_8158745'
const CHARANGA_SLUG = TICKETTAILOR_FESTIVAL_MAP[CHARANGA_TT_EVENT_ID]

function sign(body: string, secret = SECRET): string {
  return createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

function buildOrder(overrides: Partial<{
  id: string
  email: string
  ttEventId: string
  status: string
}> = {}) {
  return {
    object: 'order',
    id: overrides.id ?? 'or_75077458',
    status: overrides.status ?? 'completed',
    buyer_details: {
      email: overrides.email ?? 'buyer@example.com',
      first_name: 'Iciar',
      last_name: 'De Santiago',
      name: 'Iciar De Santiago',
    },
    event_summary: {
      event_id: overrides.ttEventId ?? CHARANGA_TT_EVENT_ID,
      id: overrides.ttEventId ?? CHARANGA_TT_EVENT_ID,
    },
    line_items: [{ description: 'Super Early Bird', quantity: 1, total: 5500 }],
  }
}

function buildEnvelope(eventName: string, order = buildOrder()) {
  return JSON.stringify({ event: eventName, payload: order })
}

// ---------- in-memory fake DB ----------
//
// Implements just enough of the drizzle query builder to exercise
// processWebhookBody. Each row is a plain object; "queries" are filtered with
// the matchers we register on each call site. This is brittle by design — a
// schema or query change in the lib will likely require updating the fake.

interface FakeRow { [k: string]: any }

class FakeDb {
  festivals: FakeRow[] = []
  dancers: FakeRow[] = []
  signups: FakeRow[] = []

  seedFestival(slug: string, id = 'fest-' + slug) {
    this.festivals.push({ id, slug, name: slug })
    return id
  }

  seedDancer(email: string, id?: string) {
    const did = id ?? 'dancer-' + email
    this.dancers.push({ id: did, email })
    return did
  }

  seedSignup(row: Partial<FakeRow>) {
    this.signups.push({
      id: row.id ?? 'sig-' + this.signups.length,
      paidAmount: 0,
      verifiedTicketHolder: false,
      tickettailorOrderId: null,
      tickettailorBuyerEmail: null,
      verifiedAt: null,
      dancerId: null,
      ...row,
    })
  }

  // The lib uses these shapes:
  //   db.select({...}).from(table).where(eq(...))
  //   db.insert(table).values(...).onConflictDoNothing(...).returning(...)
  //   db.update(table).set(...).where(and(...))

  select(_columns: any) {
    return {
      from: (table: any) => ({
        where: (filter: FilterFn) => {
          const rows = this.tableFor(table).filter(filter)
          return Promise.resolve(rows)
        },
      }),
    }
  }

  insert(table: any) {
    return {
      values: (vals: FakeRow) => ({
        onConflictDoNothing: (_opts: any) => ({
          returning: (_cols: any) => {
            // Conflict if any existing row shares tickettailor_order_id (when set).
            if (vals.tickettailorOrderId) {
              const dup = this.tableFor(table).find(
                (r: FakeRow) => r.tickettailorOrderId === vals.tickettailorOrderId,
              )
              if (dup) return Promise.resolve([])
            }
            // Also enforce (festival_id, dancer_id) unique when dancerId is non-null.
            if (vals.dancerId) {
              const dup = this.tableFor(table).find(
                (r: FakeRow) =>
                  r.festivalId === vals.festivalId && r.dancerId === vals.dancerId,
              )
              if (dup) {
                const err: any = new Error('duplicate key value violates unique constraint')
                err.cause = { code: '23505' }
                throw err
              }
            }
            const id = 'sig-' + this.signups.length
            this.tableFor(table).push({ ...vals, id })
            return Promise.resolve([{ id }])
          },
        }),
      }),
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

// drizzle's `eq` / `and` produce opaque SQL objects. We can't use them for
// our fake; instead we monkey-stub the lib's filter-call sites by accepting
// any function that decides whether a row matches. The lib only uses
// `eq(col, val)` / `and(eq(...), eq(...))` shapes — drizzle exports them, but
// at runtime they return tagged objects we can't introspect.
//
// To bridge that, we wrap the FakeDb's where-handlers to ignore the drizzle
// expression and instead accept a JS predicate that the test installs via
// FakeDb.lastFilter. We do this by monkey-patching the imports indirectly:
// the lib imports `eq` and `and` from drizzle-orm; vitest's mock cuts in.

type FilterFn = (row: FakeRow) => boolean

// ---------- mocks ----------
//
// vitest.mock replaces drizzle-orm's `eq` and `and` with predicate-builders so
// the FakeDb's `.where(filter)` receives plain functions instead of SQL.
import { vi } from 'vitest'
vi.mock('drizzle-orm', async () => {
  // Drizzle's column markers expose `.name` as the *DB* column name
  // (snake_case). Our FakeDb stores rows with camelCase JS keys (matching the
  // drizzle JS property names), so we translate snake_case back to camelCase
  // when resolving an eq() predicate against a row.
  const snakeToCamel = (s: string) =>
    s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

  const eq = (col: any, val: any): FilterFn => {
    const dbName: string | undefined = col?.name
    const jsKey = dbName ? snakeToCamel(dbName) : undefined
    return (row: FakeRow) => {
      if (jsKey && Object.prototype.hasOwnProperty.call(row, jsKey)) {
        return row[jsKey] === val
      }
      // Fallback: try the snake_case key directly.
      if (dbName && Object.prototype.hasOwnProperty.call(row, dbName)) {
        return row[dbName] === val
      }
      return false
    }
  }
  const and = (...preds: FilterFn[]): FilterFn => {
    return (row: FakeRow) => preds.every(p => p(row))
  }
  return { eq, and, sql: (..._args: any[]) => ({}) }
})

// ---------- signature verification ----------

describe('verifySignature', () => {
  it('accepts a signature computed with the same secret and body', () => {
    const body = '{"event":"order.completed","payload":{}}'
    expect(verifySignature(SECRET, body, sign(body))).toBe(true)
  })

  it('rejects a tampered body', () => {
    const body = '{"event":"order.completed","payload":{}}'
    const sig = sign(body)
    expect(verifySignature(SECRET, body + ' ', sig)).toBe(false)
  })

  it('rejects a signature computed with a different secret', () => {
    const body = '{"event":"order.completed","payload":{}}'
    expect(verifySignature(SECRET, body, sign(body, 'wrong-secret'))).toBe(false)
  })

  it('rejects a header that is not hex', () => {
    expect(verifySignature(SECRET, 'x', 'not-hex-and-wrong-length')).toBe(false)
  })

  it('rejects an empty signature', () => {
    expect(verifySignature(SECRET, 'x', '')).toBe(false)
  })
})

// ---------- envelope parsing ----------

describe('extractEvents', () => {
  it('parses the wrapped envelope shape', () => {
    const out = extractEvents({ event: 'order.completed', payload: buildOrder() })
    expect(out).toHaveLength(1)
    expect(out[0].eventType).toBe('order.completed')
    expect(out[0].order.id).toBe('or_75077458')
  })

  it('parses a flat order object as a fallback', () => {
    const out = extractEvents(buildOrder())
    expect(out).toHaveLength(1)
    // Default eventType when no envelope present.
    expect(out[0].eventType).toBe('order.completed')
  })

  it('returns no events for non-objects', () => {
    expect(extractEvents(null)).toEqual([])
    expect(extractEvents('hello')).toEqual([])
    expect(extractEvents(42)).toEqual([])
  })
})

// ---------- processWebhookBody ----------

describe('processWebhookBody', () => {
  it('returns parseError for invalid JSON', async () => {
    const db = new FakeDb() as any
    const result = await processWebhookBody(db, '{not json')
    expect(result.parseError).toBe(true)
    expect(result.processed).toBe(0)
  })

  it('ignores unsupported event types but still 200s', async () => {
    const db = new FakeDb()
    db.seedFestival(CHARANGA_SLUG)
    const body = JSON.stringify({ event: 'ticket.refunded', payload: buildOrder() })
    const result = await processWebhookBody(db as any, body)
    expect(result.processed).toBe(0)
    expect(result.outcomes[0]).toEqual({ kind: 'ignored', reason: 'unsupported_event:ticket.refunded' })
  })

  it('inserts a stub row when the buyer email is unknown', async () => {
    const db = new FakeDb()
    db.seedFestival(CHARANGA_SLUG)

    const body = buildEnvelope('order.created', buildOrder({ id: 'or_aaa', email: 'new@example.com' }))
    const result = await processWebhookBody(db as any, body)

    expect(result.processed).toBe(1)
    expect(result.outcomes[0]).toMatchObject({ kind: 'inserted', orderId: 'or_aaa' })
    expect(db.signups).toHaveLength(1)
    expect(db.signups[0]).toMatchObject({
      verifiedTicketHolder: true,
      tickettailorOrderId: 'or_aaa',
      tickettailorBuyerEmail: 'new@example.com',
      dancerId: null,
    })
  })

  it('links a verified row to an existing dancer when the email matches', async () => {
    const db = new FakeDb()
    db.seedFestival(CHARANGA_SLUG)
    const dancerId = db.seedDancer('returning@example.com')

    const body = buildEnvelope('order.completed', buildOrder({ id: 'or_bbb', email: 'returning@example.com' }))
    const result = await processWebhookBody(db as any, body)

    expect(result.processed).toBe(1)
    expect(db.signups[0]).toMatchObject({
      verifiedTicketHolder: true,
      tickettailorOrderId: 'or_bbb',
      dancerId,
    })
  })

  it('is idempotent on duplicate tickettailor_order_id', async () => {
    const db = new FakeDb()
    db.seedFestival(CHARANGA_SLUG)

    const body = buildEnvelope('order.completed', buildOrder({ id: 'or_dup', email: 'x@example.com' }))
    const first = await processWebhookBody(db as any, body)
    const second = await processWebhookBody(db as any, body)

    expect(first.processed).toBe(1)
    expect(second.processed).toBe(0)
    expect(second.outcomes[0]).toMatchObject({ kind: 'duplicate', orderId: 'or_dup' })
    expect(db.signups).toHaveLength(1)
  })

  it('promotes an existing unverified signup to verified when (festival, dancer) collides', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(CHARANGA_SLUG)
    const dancerId = db.seedDancer('repeat@example.com')
    db.seedSignup({ festivalId, dancerId, paidAmount: 0, verifiedTicketHolder: false })

    const body = buildEnvelope('order.completed', buildOrder({ id: 'or_promote', email: 'repeat@example.com' }))
    const result = await processWebhookBody(db as any, body)

    expect(result.processed).toBe(1)
    expect(result.outcomes[0]).toMatchObject({ kind: 'verified-existing', orderId: 'or_promote' })
    expect(db.signups).toHaveLength(1)
    expect(db.signups[0]).toMatchObject({
      verifiedTicketHolder: true,
      tickettailorOrderId: 'or_promote',
      dancerId,
    })
  })

  it('skips orders for unmapped TicketTailor events', async () => {
    const db = new FakeDb()
    db.seedFestival(CHARANGA_SLUG)
    const body = buildEnvelope('order.completed', buildOrder({ ttEventId: 'ev_unknown' }))
    const result = await processWebhookBody(db as any, body)
    expect(result.processed).toBe(0)
    expect(result.outcomes[0]).toMatchObject({ kind: 'ignored', reason: 'unmapped_event:ev_unknown' })
  })

  it('skips orders missing buyer email or order id', async () => {
    const db = new FakeDb()
    db.seedFestival(CHARANGA_SLUG)
    const malformed = JSON.stringify({
      event: 'order.completed',
      payload: { id: 'or_x', event_summary: { event_id: CHARANGA_TT_EVENT_ID } },
    })
    const result = await processWebhookBody(db as any, malformed)
    expect(result.processed).toBe(0)
    expect(result.outcomes[0]).toMatchObject({ kind: 'ignored', reason: 'missing_fields' })
  })
})

// =====================================================================
// server_ticket_purchased (PostHog) — emitted via the onPurchase callback
// =====================================================================

describe('ticket purchase tracking', () => {
  it('reports one purchase for a new order, tied to the matching dancer', async () => {
    const db = new FakeDb()
    db.seedFestival(CHARANGA_SLUG)
    const dancerId = db.seedDancer('fan@example.com')
    const onPurchase = vi.fn()

    const order = { ...buildOrder({ id: 'or_rev', email: 'fan@example.com' }), total: 11000, currency: { code: 'eur', base_multiplier: 100 }, line_items: [{ type: 'ticket', quantity: 2, total: 11000 }] }
    await processWebhookBody(db as any, buildEnvelope('order.completed', order as any), onPurchase)

    expect(onPurchase).toHaveBeenCalledOnce()
    const purchase = onPurchase.mock.calls[0]![0]
    expect(purchase).toMatchObject({ distinctId: dancerId, orderId: 'or_rev' })
    expect(purchase.properties).toMatchObject({
      festival: CHARANGA_SLUG,
      provider: 'tickettailor',
      tickets: 2,
      amount: 11000,
      currency: 'eur',
      $revenue: 110,
    })
  })

  it('is anonymous for an unknown buyer and never carries the name or email', async () => {
    const db = new FakeDb()
    db.seedFestival(CHARANGA_SLUG)
    const onPurchase = vi.fn()
    await processWebhookBody(db as any, buildEnvelope('order.created', buildOrder({ id: 'or_anon', email: 'stranger@example.com' })), onPurchase)

    const purchase = onPurchase.mock.calls[0]![0]
    expect(purchase.distinctId).toBeNull()
    const json = JSON.stringify(purchase.properties)
    expect(json).not.toContain('stranger@example.com')
    expect(json).not.toContain('Iciar')
  })

  it('counts an order once across order.created + order.completed and replays', async () => {
    const db = new FakeDb()
    db.seedFestival(CHARANGA_SLUG)
    const onPurchase = vi.fn()
    const order = buildOrder({ id: 'or_once', email: 'once@example.com' })
    await processWebhookBody(db as any, buildEnvelope('order.created', order), onPurchase)
    await processWebhookBody(db as any, buildEnvelope('order.completed', order), onPurchase)
    await processWebhookBody(db as any, buildEnvelope('order.completed', order), onPurchase)
    expect(onPurchase).toHaveBeenCalledOnce()
  })

  it('reports the purchase when it promotes an existing free signup', async () => {
    const db = new FakeDb()
    const festivalId = db.seedFestival(CHARANGA_SLUG)
    const dancerId = db.seedDancer('joined@example.com')
    db.seedSignup({ festivalId, dancerId, paidAmount: 0, verifiedTicketHolder: false })
    const onPurchase = vi.fn()
    await processWebhookBody(db as any, buildEnvelope('order.completed', buildOrder({ id: 'or_up', email: 'joined@example.com' })), onPurchase)
    expect(onPurchase).toHaveBeenCalledOnce()
    expect(onPurchase.mock.calls[0]![0].distinctId).toBe(dancerId)
  })

  it('does not report ignored orders', async () => {
    const db = new FakeDb()
    db.seedFestival(CHARANGA_SLUG)
    const onPurchase = vi.fn()
    await processWebhookBody(db as any, buildEnvelope('order.completed', buildOrder({ ttEventId: 'ev_unknown' })), onPurchase)
    await processWebhookBody(db as any, JSON.stringify({ event: 'ticket.refunded', payload: buildOrder() }), onPurchase)
    expect(onPurchase).not.toHaveBeenCalled()
  })

  it('falls back to line items when the order has no total', () => {
    const props = ticketTailorPurchaseProps(buildOrder() as any, 'fest')
    expect(props).toMatchObject({ amount: 5500, currency: 'eur', $revenue: 55, tickets: 1 })
  })
})
