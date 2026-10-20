/**
 * Pure logic for the TicketTailor webhook receiver. Kept in its own module
 * so it can be unit-tested without booting Nitro / Nuxt globals.
 *
 * See ./tickettailor.post.ts for the HTTP wrapper.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { eq, and } from 'drizzle-orm'
import type { useDb } from '../../utils/db'
import { dancers, festivals, festivalSignups } from '../../database/schema'

// Map TicketTailor event_id → WeDance festival slug.
// Keep tiny on purpose; expand only when we add a second event.
export const TICKETTAILOR_FESTIVAL_MAP: Record<string, string> = {
  ev_8158745: 'charanga-habanera-munich-2026',
}

const ACCEPTED_EVENT_TYPES = new Set([
  'order.created',
  'order.completed',
])

interface TicketTailorBuyerDetails {
  email?: string
  first_name?: string | null
  last_name?: string | null
  name?: string | null
}

export interface TicketTailorOrder {
  object?: string
  id?: string
  status?: string
  buyer_details?: TicketTailorBuyerDetails
  event_summary?: { event_id?: string; id?: string }
  /** Order total in minor units (cents). */
  total?: number | null
  currency?: { code?: string | null; base_multiplier?: number | null } | string | null
  line_items?: Array<{ type?: string | null; quantity?: number | null; total?: number | null }> | null
  issued_tickets?: unknown[] | null
}

/** One newly recorded TicketTailor purchase — the `server_ticket_purchased` payload. */
export interface TicketTailorPurchase {
  /** The buyer's dancer id when their email matches an account; null → anonymous. */
  distinctId: string | null
  orderId: string
  properties: Record<string, unknown>
}

/**
 * The `server_ticket_purchased` props for a TicketTailor order. Money in cents
 * + currency, `$revenue` in major units; never the buyer's name or email.
 */
export function ticketTailorPurchaseProps(order: TicketTailorOrder, festivalSlug: string): Record<string, unknown> {
  const lines = Array.isArray(order.line_items) ? order.line_items : []
  const ticketLines = lines.filter(l => !l.type || l.type === 'ticket')
  const amount = typeof order.total === 'number'
    ? order.total
    : lines.reduce((sum, l) => sum + (Number(l.total) || 0), 0)
  const rawCurrency = typeof order.currency === 'string' ? order.currency : order.currency?.code
  const currency = (rawCurrency || 'eur').toLowerCase()
  const multiplier = (typeof order.currency === 'object' && order.currency?.base_multiplier) || 100
  const tickets = Array.isArray(order.issued_tickets) && order.issued_tickets.length
    ? order.issued_tickets.length
    : ticketLines.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0) || 1
  return {
    festival: festivalSlug,
    provider: 'tickettailor',
    product: 'ticket',
    tickets,
    amount,
    currency,
    $revenue: amount / multiplier,
    $currency: currency.toUpperCase(),
    referral: false,
    referral_code: null,
  }
}

interface TicketTailorEnvelope {
  event?: string
  payload?: TicketTailorOrder | TicketTailorOrder[] | unknown
}

/** HMAC-SHA256 hex over the raw body, constant-time compared. */
export function verifySignature(secret: string, rawBody: string, headerSig: string): boolean {
  const expected = createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')
  if (expected.length !== headerSig.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected, 'utf8'), Buffer.from(headerSig, 'utf8'))
  } catch {
    return false
  }
}

/**
 * TicketTailor delivers either:
 *   { event: "order.completed", payload: { ...order } }
 * or, for some webhook shapes, the order object directly.
 * Normalise both into a single event-name + order-array pair.
 */
export function extractEvents(parsed: unknown): { eventType: string; order: TicketTailorOrder }[] {
  if (!parsed || typeof parsed !== 'object') return []

  const envelope = parsed as TicketTailorEnvelope
  const eventType = envelope.event ?? 'order.completed'

  const payload = envelope.payload ?? parsed
  const orders: TicketTailorOrder[] = Array.isArray(payload)
    ? (payload as TicketTailorOrder[])
    : [payload as TicketTailorOrder]

  return orders
    .filter((o): o is TicketTailorOrder => !!o && typeof o === 'object')
    .map(order => ({ eventType, order }))
}

export interface ProcessResult {
  processed: number
  parseError?: boolean
  /** Per-order outcome, useful in tests. */
  outcomes: Array<
    | { kind: 'inserted'; orderId: string }
    | { kind: 'duplicate'; orderId: string }
    | { kind: 'verified-existing'; orderId: string }
    | { kind: 'ignored'; reason: string }
  >
}

type Db = ReturnType<typeof useDb>

/**
 * Parse a verified webhook body and write matching festival_signup rows.
 * Caller is responsible for HMAC verification before invoking this.
 */
export async function processWebhookBody(
  db: Db,
  rawBody: string,
  /** Called once per order the first time it is recorded (not on replays). */
  onPurchase?: (purchase: TicketTailorPurchase) => void,
): Promise<ProcessResult> {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawBody)
  } catch {
    return { processed: 0, parseError: true, outcomes: [] }
  }

  const incoming = extractEvents(parsed)
  let processed = 0
  const outcomes: ProcessResult['outcomes'] = []

  for (const { eventType, order } of incoming) {
    if (!ACCEPTED_EVENT_TYPES.has(eventType)) {
      outcomes.push({ kind: 'ignored', reason: `unsupported_event:${eventType}` })
      continue
    }

    const orderId = order.id
    const buyerEmail = order.buyer_details?.email?.toLowerCase().trim()
    const ttEventId = order.event_summary?.event_id || order.event_summary?.id

    if (!orderId || !buyerEmail || !ttEventId) {
      outcomes.push({ kind: 'ignored', reason: 'missing_fields' })
      continue
    }

    const festivalSlug = TICKETTAILOR_FESTIVAL_MAP[ttEventId]
    if (!festivalSlug) {
      outcomes.push({ kind: 'ignored', reason: `unmapped_event:${ttEventId}` })
      continue
    }

    const [festival] = await db
      .select({ id: festivals.id })
      .from(festivals)
      .where(eq(festivals.slug, festivalSlug))

    if (!festival) {
      outcomes.push({ kind: 'ignored', reason: `festival_not_seeded:${festivalSlug}` })
      continue
    }

    const [existingDancer] = await db
      .select({ id: dancers.id })
      .from(dancers)
      .where(eq(dancers.email, buyerEmail))

    const dancerId = existingDancer?.id ?? null

    try {
      const inserted = await db
        .insert(festivalSignups)
        .values({
          festivalId: festival.id,
          dancerId,
          paidAmount: 0,
          verifiedTicketHolder: true,
          tickettailorOrderId: orderId,
          tickettailorBuyerEmail: buyerEmail,
          verifiedAt: new Date(),
        })
        .onConflictDoNothing({ target: festivalSignups.tickettailorOrderId })
        .returning({ id: festivalSignups.id })

      if (inserted.length > 0) {
        processed += 1
        outcomes.push({ kind: 'inserted', orderId })
        onPurchase?.({ distinctId: dancerId, orderId, properties: ticketTailorPurchaseProps(order, festivalSlug) })
      } else {
        outcomes.push({ kind: 'duplicate', orderId })
      }
    } catch (e: any) {
      // (festival_id, dancer_id) unique can fire when the dancer already had
      // an unverified signup. Promote it to verified and attach the order id.
      const msg = `${e.message || ''} ${e.cause?.message || ''}`
      const code = e.cause?.code || ''
      const isUnique = msg.includes('unique') || msg.includes('duplicate') || code === '23505'

      if (isUnique && dancerId) {
        await db
          .update(festivalSignups)
          .set({
            verifiedTicketHolder: true,
            tickettailorOrderId: orderId,
            tickettailorBuyerEmail: buyerEmail,
            verifiedAt: new Date(),
          })
          .where(and(
            eq(festivalSignups.festivalId, festival.id),
            eq(festivalSignups.dancerId, dancerId),
          ))
        processed += 1
        outcomes.push({ kind: 'verified-existing', orderId })
        onPurchase?.({ distinctId: dancerId, orderId, properties: ticketTailorPurchaseProps(order, festivalSlug) })
      } else {
        throw e
      }
    }
  }

  return { processed, outcomes }
}
