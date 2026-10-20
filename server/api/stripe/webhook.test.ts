/**
 * Unit tests for Stripe webhook referral state transitions.
 *
 * Tests the extracted completeReferral / expireReferral helpers from
 * webhook.lib.ts using the same FakeDb pattern as referral.test.ts.
 */
import { describe, it, expect, vi } from 'vitest'
import { referrals } from '../../database/schema'

// ---------- drizzle mocks ----------
vi.mock('drizzle-orm', async () => {
  const snakeToCamel = (s: string) =>
    s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

  const eq = (col: any, val: any) => {
    const dbName: string | undefined = col?.name
    const jsKey = dbName ? snakeToCamel(dbName) : undefined
    return (row: Record<string, any>) => {
      if (jsKey && Object.prototype.hasOwnProperty.call(row, jsKey)) {
        return row[jsKey] === val
      }
      if (dbName && Object.prototype.hasOwnProperty.call(row, dbName)) {
        return row[dbName] === val
      }
      return false
    }
  }

  const and = (...preds: any[]) => {
    return (row: Record<string, any>) => preds.every(p => p(row))
  }

  return { eq, and, sql: (..._args: any[]) => ({}) }
})

// ---------- FakeDb ----------

interface FakeRow { [k: string]: any }
type FilterFn = (row: FakeRow) => boolean

class FakeDb {
  referrals: FakeRow[] = []

  seedReferral(row: FakeRow) {
    this.referrals.push({
      id: row.id ?? 'ref-' + this.referrals.length,
      festivalId: row.festivalId ?? 'fest-1',
      referrerId: row.referrerId ?? 'referrer-1',
      refereeId: row.refereeId ?? 'referee-1',
      discountCents: row.discountCents ?? 2100,
      stripeSessionId: row.stripeSessionId ?? null,
      status: row.status ?? 'pending',
      referrerCreditCents: row.referrerCreditCents ?? 0,
      referrerCreditAppliedSessionId: row.referrerCreditAppliedSessionId ?? null,
      createdAt: new Date(),
      completedAt: null,
      ...row,
    })
  }

  select(_columns: any) {
    const self = this
    return {
      from: (table: any) => ({
        where: (filter: FilterFn) => {
          return Promise.resolve(self.tableFor(table).filter(filter))
        },
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
    if (table === referrals) return this.referrals
    throw new Error('FakeDb: unexpected table reference')
  }
}

// ---------- import under test ----------
import {
  completeReferral, expireReferral, isFestivalCheckout,
  subscriptionActivatedEvent, subscriptionCancelledEvent, ticketCheckoutExpiredEvent, ticketPurchasedEvent,
} from './webhook.lib'

// =====================================================================
// completeReferral
// =====================================================================

describe('completeReferral', () => {
  it('transitions a pending referral to completed and credits the referrer', async () => {
    const db = new FakeDb()
    db.seedReferral({ stripeSessionId: 'cs_123', status: 'pending', discountCents: 2100 })

    await completeReferral(db, 'cs_123')

    expect(db.referrals[0].status).toBe('completed')
    expect(db.referrals[0].completedAt).toBeInstanceOf(Date)
    expect(db.referrals[0].referrerCreditCents).toBe(2100)
  })

  it('is idempotent — does not re-complete an already completed referral', async () => {
    const db = new FakeDb()
    const originalDate = new Date('2026-01-01')
    db.seedReferral({ stripeSessionId: 'cs_123', status: 'completed', completedAt: originalDate })

    await completeReferral(db, 'cs_123')

    // Status unchanged, completedAt not overwritten
    expect(db.referrals[0].status).toBe('completed')
    expect(db.referrals[0].completedAt).toBe(originalDate)
  })

  it('does not touch referrals for a different session', async () => {
    const db = new FakeDb()
    db.seedReferral({ stripeSessionId: 'cs_other', status: 'pending' })

    await completeReferral(db, 'cs_123')

    expect(db.referrals[0].status).toBe('pending')
  })

  it('does not touch an expired referral', async () => {
    const db = new FakeDb()
    db.seedReferral({ stripeSessionId: 'cs_123', status: 'expired' })

    await completeReferral(db, 'cs_123')

    expect(db.referrals[0].status).toBe('expired')
  })
})

// =====================================================================
// expireReferral
// =====================================================================

describe('expireReferral', () => {
  it('transitions a pending referral to expired', async () => {
    const db = new FakeDb()
    db.seedReferral({ stripeSessionId: 'cs_456', status: 'pending' })

    await expireReferral(db, 'cs_456')

    expect(db.referrals[0].status).toBe('expired')
  })

  it('is idempotent — does not re-expire an already expired referral', async () => {
    const db = new FakeDb()
    db.seedReferral({ stripeSessionId: 'cs_456', status: 'expired' })

    await expireReferral(db, 'cs_456')

    expect(db.referrals[0].status).toBe('expired')
  })

  it('does not expire a completed referral', async () => {
    const db = new FakeDb()
    db.seedReferral({ stripeSessionId: 'cs_456', status: 'completed' })

    await expireReferral(db, 'cs_456')

    expect(db.referrals[0].status).toBe('completed')
  })

  it('does not touch referrals for a different session', async () => {
    const db = new FakeDb()
    db.seedReferral({ stripeSessionId: 'cs_other', status: 'pending' })

    await expireReferral(db, 'cs_456')

    expect(db.referrals[0].status).toBe('pending')
  })
})

// =====================================================================
// PostHog conversion payloads (server_ticket_purchased & co.)
// =====================================================================

const ticketSession = {
  id: 'cs_paid',
  mode: 'payment',
  amount_total: 9000,
  currency: 'eur',
  metadata: {
    festivalSlug: 'charanga-2026',
    ticketName: 'Full Pass, Party Pass',
    ticketCount: '2',
    dancerId: 'dancer-1',
    amountCents: '9000',
    referrerId: 'dancer-ref',
    referralDiscount: '1000',
    via: 'salsa-crew',
  },
}

describe('ticketPurchasedEvent', () => {
  it('builds the revenue payload for a ticket checkout', () => {
    const { distinctId, properties } = ticketPurchasedEvent(ticketSession, 9000)
    expect(distinctId).toBe('dancer-1')
    expect(properties).toEqual({
      festival: 'charanga-2026',
      provider: 'stripe',
      product: 'ticket',
      tickets: 2,
      referral: true,
      referral_code: 'salsa-crew',
      discount: 1000,
      amount: 9000,
      currency: 'eur',
      $revenue: 90,
      $currency: 'EUR',
    })
  })

  it('counts tickets from the joined names on older sessions', () => {
    const { ticketCount: _, ...meta } = ticketSession.metadata
    expect(ticketPurchasedEvent({ ...ticketSession, metadata: meta }, 9000).properties.tickets).toBe(2)
  })

  it('marks the €1 social unlock as its own product', () => {
    const { properties } = ticketPurchasedEvent({ id: 'cs_unlock', mode: 'payment', currency: 'eur', metadata: { festivalSlug: 'f', dancerId: 'd' } }, 100)
    expect(properties).toMatchObject({ product: 'social_unlock', tickets: 1, referral: false, referral_code: null, amount: 100, $revenue: 1 })
    expect(properties.discount).toBeUndefined()
  })

  it('never carries the buyer email or ticket names', () => {
    const json = JSON.stringify(ticketPurchasedEvent(ticketSession, 9000))
    expect(json).not.toContain('Full Pass')
    expect(json).not.toContain('@')
  })
})

describe('ticketCheckoutExpiredEvent / isFestivalCheckout', () => {
  it('reports the abandoned festival checkout without money props', () => {
    const { distinctId, properties } = ticketCheckoutExpiredEvent(ticketSession)
    expect(distinctId).toBe('dancer-1')
    expect(properties).toMatchObject({ festival: 'charanga-2026', provider: 'stripe', tickets: 2, product: 'ticket' })
    expect(properties.$revenue).toBeUndefined()
  })

  it('tells festival checkouts from organiser subscriptions', () => {
    expect(isFestivalCheckout(ticketSession)).toBe(true)
    expect(isFestivalCheckout({ id: 'cs_sub', mode: 'subscription', metadata: { plan: 'network', dancerId: 'd', profileId: 'p' } })).toBe(false)
    expect(isFestivalCheckout({ id: 'cs_x', mode: 'payment', metadata: {} })).toBe(false)
  })
})

const sub = {
  id: 'sub_1',
  created: Math.floor(new Date('2026-09-01T00:00:00Z').getTime() / 1000),
  items: { data: [{ quantity: 1, price: { unit_amount: 2900, currency: 'eur', recurring: { interval: 'month' } } }] },
  cancellation_details: { reason: 'cancellation_requested' },
}

describe('subscription events', () => {
  it('activated carries plan, price and $revenue for the payer', () => {
    const { distinctId, properties } = subscriptionActivatedEvent(sub, { dancerId: 'org-1', plan: 'network', profileId: 'prof-1' })
    expect(distinctId).toBe('org-1')
    expect(properties).toEqual({
      plan: 'network', profile_id: 'prof-1', provider: 'stripe',
      amount: 2900, currency: 'eur', interval: 'month', $revenue: 29, $currency: 'EUR',
    })
  })

  it('cancelled carries the Stripe reason and days active, no revenue', () => {
    const row = { dancerId: 'org-1', plan: 'network', profileId: 'prof-1', createdAt: new Date('2026-09-01T00:00:00Z') }
    const { distinctId, properties } = subscriptionCancelledEvent(sub, row, new Date('2026-10-01T12:00:00Z'))
    expect(distinctId).toBe('org-1')
    expect(properties).toMatchObject({ plan: 'network', profile_id: 'prof-1', reason: 'cancellation_requested', days_active: 30, amount: 2900 })
    expect(properties.$revenue).toBeUndefined()
  })

  it('cancelled without our row falls back to the Stripe creation date and stays anonymous', () => {
    const { distinctId, properties } = subscriptionCancelledEvent({ ...sub, cancellation_details: null }, null, new Date('2026-09-11T00:00:00Z'))
    expect(distinctId).toBeNull()
    expect(properties).toMatchObject({ plan: null, reason: null, days_active: 10 })
  })
})
