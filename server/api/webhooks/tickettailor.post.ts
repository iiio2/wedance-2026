/**
 * TicketTailor webhook receiver.
 *
 * Marks WeDance festival signups as `verified_ticket_holder = true` whenever
 * a buyer completes an order on TicketTailor for a TicketTailor-mapped festival.
 *
 * Authoritative flow:
 *   1. TicketTailor signs each delivery with HMAC-SHA256 over the raw request
 *      body using the per-webhook signing secret (`TICKETTAILOR_WEBHOOK_SECRET`).
 *      The signature is sent as `x-tt-signature` (hex digest, lowercase).
 *   2. We verify the signature with `crypto.timingSafeEqual` BEFORE parsing.
 *   3. For accepted event types (`order.created`, `order.completed`), we look
 *      up the festival by `event_id` (TicketTailor `ev_*`), upsert a verified
 *      signup row keyed on `tickettailor_order_id`, and link to an existing
 *      dancer by buyer email when one exists.
 *   4. Stub rows (no `dancer_id`) are claimed later via PR 4's claim flow when
 *      the buyer signs in via magic link.
 *
 * Idempotency: `tickettailor_order_id` has a unique index. Replays from
 * TicketTailor (or our own retry tooling) collapse to the same row.
 *
 * The bulk of this handler is pure logic exposed via `./tickettailor.lib`
 * so it can be unit-tested without booting Nitro.
 */
import { useDb } from '../../utils/db'
import { trackServerEvent } from '../../utils/posthog'
import { processWebhookBody, verifySignature } from './tickettailor.lib'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = config.tickettailorWebhookSecret as string

  if (!secret) {
    // Fail closed: if the secret isn't configured, treat every request as untrusted.
    console.error('[tickettailor webhook] TICKETTAILOR_WEBHOOK_SECRET is not set')
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', data: { error: 'webhook_secret_missing' } })
  }

  const rawBody = await readRawBody(event)
  if (!rawBody) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', data: { error: 'empty_body' } })
  }

  const headerSig = getHeader(event, 'x-tt-signature') || ''
  if (!headerSig) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', data: { error: 'missing_signature' } })
  }

  if (!verifySignature(secret, rawBody, headerSig)) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized', data: { error: 'invalid_signature' } })
  }

  // Body is verified — safe to parse and process.
  // `server_ticket_purchased` once per order: order.created and order.completed
  // both arrive, but only the first one records the row (idempotent on order id).
  const result = await processWebhookBody(useDb(), rawBody, (purchase) => {
    trackServerEvent(event, 'ticket_purchased', purchase.distinctId, purchase.properties, { dedupeKey: `tickettailor:${purchase.orderId}` })
  })
  if (result.parseError) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid JSON' })
  }

  return { ok: true, processed: result.processed }
})
