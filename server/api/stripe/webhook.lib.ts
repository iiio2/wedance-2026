import { eq, and } from 'drizzle-orm'
import { referrals } from '../../database/schema'

/**
 * Mark the referral tied to a Stripe checkout session as 'completed'.
 *
 * Idempotent: the WHERE clause filters on status='pending', so an
 * already-completed row is a no-op (0 rows updated).
 */
export async function completeReferral(db: any, stripeSessionId: string) {
  const [row] = await db
    .select({ id: referrals.id, discountCents: referrals.discountCents })
    .from(referrals)
    .where(and(
      eq(referrals.stripeSessionId, stripeSessionId),
      eq(referrals.status, 'pending'),
    ))

  if (!row) return

  return db
    .update(referrals)
    .set({
      status: 'completed',
      completedAt: new Date(),
      referrerCreditCents: row.discountCents,
    })
    .where(and(
      eq(referrals.id, row.id),
      eq(referrals.status, 'pending'),
    ))
}

/**
 * Mark the referral tied to a Stripe checkout session as 'expired'.
 *
 * Idempotent: only transitions 'pending' → 'expired'.
 */
export async function expireReferral(db: any, stripeSessionId: string) {
  return db
    .update(referrals)
    .set({ status: 'expired' })
    .where(and(
      eq(referrals.stripeSessionId, stripeSessionId),
      eq(referrals.status, 'pending'),
    ))
}

// ---------------------------------------------------------------------------
// PostHog conversion events (tracking plan P0). Pure builders so the payloads
// are unit-tested; the handler hands them to `trackServerEvent`. Conventions:
// money is `amount` in cents + `currency`, and purchase events add `$revenue`
// in major units. No names, emails or free text.
// ---------------------------------------------------------------------------

/** The subset of a Stripe Checkout Session the builders read. */
export interface CheckoutSessionLike {
  id: string
  mode?: string | null
  amount_total?: number | null
  currency?: string | null
  metadata?: Record<string, string> | null
}

export interface ServerEventPayload {
  /** The dancer the event belongs to; null → anonymous capture. */
  distinctId: string | null
  properties: Record<string, unknown>
}

/** A festival checkout (ticket or €1 social unlock) — not an organiser subscription. */
export function isFestivalCheckout(session: CheckoutSessionLike): boolean {
  return session.mode !== 'subscription' && !!session.metadata?.festivalSlug
}

function ticketCount(meta: Record<string, string>): number {
  const n = Number(meta.ticketCount)
  if (Number.isFinite(n) && n > 0) return n
  // Older sessions only carry the joined names ("Full Pass, Party Pass").
  return meta.ticketName ? meta.ticketName.split(', ').filter(Boolean).length : 1
}

/** Props shared by the purchased / expired events of one festival checkout. */
function festivalCheckoutProps(session: CheckoutSessionLike): Record<string, unknown> {
  const meta = session.metadata ?? {}
  const isTicket = !!meta.ticketName
  const discount = Number(meta.referralDiscount || 0) + Number(meta.referrerCredit || 0)
  return {
    festival: meta.festivalSlug,
    provider: 'stripe',
    product: isTicket ? 'ticket' : 'social_unlock',
    tickets: isTicket ? ticketCount(meta) : 1,
    referral: !!meta.referrerId,
    // The promoter's tracked-link code the buyer came through (an organisation
    // handle, never a person's data).
    referral_code: meta.via || null,
    ...(discount > 0 ? { discount } : {}),
  }
}

/** `server_ticket_purchased` for a paid festival checkout. */
export function ticketPurchasedEvent(session: CheckoutSessionLike, amountCents: number): ServerEventPayload {
  const currency = (session.currency || 'eur').toLowerCase()
  return {
    distinctId: session.metadata?.dancerId || null,
    properties: {
      ...festivalCheckoutProps(session),
      amount: amountCents,
      currency,
      $revenue: amountCents / 100,
      $currency: currency.toUpperCase(),
    },
  }
}

/** `server_ticket_checkout_expired` — the buyer left Stripe Checkout without paying. */
export function ticketCheckoutExpiredEvent(session: CheckoutSessionLike): ServerEventPayload {
  return {
    distinctId: session.metadata?.dancerId || null,
    properties: festivalCheckoutProps(session),
  }
}

/** The subset of a Stripe Subscription the builders read. */
export interface SubscriptionLike {
  id: string
  currency?: string | null
  created?: number | null
  items?: { data?: Array<{ price?: { unit_amount?: number | null; currency?: string | null; recurring?: { interval?: string | null } | null } | null; quantity?: number | null }> } | null
  cancellation_details?: { reason?: string | null } | null
}

function subscriptionPrice(sub: SubscriptionLike) {
  const item = sub.items?.data?.[0]
  const unit = item?.price?.unit_amount ?? 0
  const amount = unit * (item?.quantity ?? 1)
  const currency = (item?.price?.currency || sub.currency || 'eur').toLowerCase()
  return { amount, currency, interval: item?.price?.recurring?.interval ?? null }
}

/** `server_subscription_activated` — first paid organiser subscription period. */
export function subscriptionActivatedEvent(
  sub: SubscriptionLike,
  meta: { dancerId: string; plan: string; profileId: string },
): ServerEventPayload {
  const { amount, currency, interval } = subscriptionPrice(sub)
  return {
    distinctId: meta.dancerId,
    properties: {
      plan: meta.plan,
      profile_id: meta.profileId,
      provider: 'stripe',
      amount,
      currency,
      interval,
      $revenue: amount / 100,
      $currency: currency.toUpperCase(),
    },
  }
}

/** `server_subscription_cancelled` — the subscription actually ended (Stripe `customer.subscription.deleted`). */
export function subscriptionCancelledEvent(
  sub: SubscriptionLike,
  row: { dancerId: string; plan: string; profileId: string; createdAt?: Date | null } | null,
  now = new Date(),
): ServerEventPayload {
  const { amount, currency, interval } = subscriptionPrice(sub)
  const started = row?.createdAt ?? (sub.created ? new Date(sub.created * 1000) : null)
  return {
    distinctId: row?.dancerId ?? null,
    properties: {
      plan: row?.plan ?? null,
      profile_id: row?.profileId ?? null,
      provider: 'stripe',
      amount,
      currency,
      interval,
      // Stripe enum (cancellation_requested / payment_failed / payment_disputed) — never free text.
      reason: sub.cancellation_details?.reason ?? null,
      days_active: started ? Math.max(0, Math.floor((now.getTime() - started.getTime()) / 86_400_000)) : null,
    },
  }
}
