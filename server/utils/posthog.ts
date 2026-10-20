/**
 * Server-side PostHog capture for conversions.
 *
 * Why: ad blockers drop a large share of client-side PostHog requests, so the
 * funnel's conversion steps (sign-up, login, event created/published, booking
 * request, …) are ALSO sent from the tRPC router that performs them. The
 * server copy is the source of truth for counting conversions; the client copy
 * keeps the in-session context (pageviews, replay, UTM) for the same user.
 *
 * Naming convention — server events never double-count client events:
 *   every server event is `server_<name>` where `<name>` is the matching client
 *   event (if any), e.g. client `signup_completed` ↔ server `server_signup_completed`.
 *   Count conversions on the `server_*` event; use the un-prefixed client event
 *   for in-session funnels. The full catalogue lives in CLAUDE.md → "Analytics (PostHog)".
 *
 * Every event carries `app: 'wedance-2026'` (the shared-project filter, same as
 * the client super-property) and `$lib: 'wedance-server'`.
 *
 * distinct_id = the dancer's id (the same id the client passes to identify), so
 * server and client events land on one person. Anonymous callers (public
 * procedures such as booking.request) get a random id and
 * `$process_person_profile: false`, so no junk person profiles are created.
 *
 * Safety: dependency-free `fetch` POST to `${host}/i/v0/e/`. A no-op when the
 * key is missing (dev, tests, CI). Never throws and never blocks the response:
 * the request is handed to the request's `waitUntil` when available (Vercel
 * keeps the function alive until it settles), else fired and forgotten.
 */

import { createHash } from 'node:crypto'

export const SERVER_EVENT_PREFIX = 'server_'

export interface PosthogServerConfig {
  key: string
  host: string
}

type Fetch = (input: string, init?: RequestInit) => Promise<{ ok: boolean; status: number }>

export interface ServerCaptureOptions {
  /** Override the runtime config (tests). */
  config?: PosthogServerConfig | null
  /** Override fetch (tests). */
  fetch?: Fetch
  /**
   * Stable key for one real-world occurrence (e.g. `stripe:<session id>`).
   * Becomes a deterministic event `uuid`, so a webhook redelivery that slips
   * past the handler's own idempotency check is collapsed by PostHog.
   */
  dedupeKey?: string
}

/** Deterministic RFC-4122-shaped uuid for a dedupe key. Exported for tests. */
export function dedupeUuid(key: string): string {
  const h = createHash('sha256').update(`wedance-2026:${key}`).digest('hex')
  const variant = ((parseInt(h[16]!, 16) & 0x3) | 0x8).toString(16)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

/** The key + host from runtime config (falls back to env outside Nitro). Null when unkeyed. */
export function posthogServerConfig(): PosthogServerConfig | null {
  // Unit/integration tests load .env; never send real events from a test run.
  if (process.env.VITEST) return null
  // `nuxt dev` with the Vercel-pulled .env (prod key) must not pollute prod data.
  if (import.meta.dev) return null
  let key = ''
  let host = ''
  try {
    const pub = (useRuntimeConfig().public ?? {}) as Record<string, unknown>
    key = String(pub.posthogKey || '')
    host = String(pub.posthogHost || '')
  }
  catch {
    key = process.env.NUXT_PUBLIC_POSTHOG_KEY || ''
    host = process.env.NUXT_PUBLIC_POSTHOG_HOST || ''
  }
  if (!key) return null
  return { key, host: host || 'https://eu.i.posthog.com' }
}

/** The body PostHog's capture endpoint expects. Exported for tests. */
export function buildServerEvent(
  config: PosthogServerConfig,
  event: string,
  distinctId: string | null | undefined,
  properties: Record<string, unknown> = {},
  dedupeKey?: string,
) {
  const name = event.startsWith(SERVER_EVENT_PREFIX) ? event : `${SERVER_EVENT_PREFIX}${event}`
  const anonymous = !distinctId
  return {
    api_key: config.key,
    event: name,
    distinct_id: distinctId || `anon-server-${crypto.randomUUID()}`,
    ...(dedupeKey ? { uuid: dedupeUuid(dedupeKey) } : {}),
    timestamp: new Date().toISOString(),
    properties: {
      ...properties,
      app: 'wedance-2026',
      $lib: 'wedance-server',
      ...(anonymous ? { $process_person_profile: false } : {}),
    },
  }
}

/**
 * Send one event. Resolves (never rejects) once PostHog answered or failed;
 * a no-op without a key.
 */
export async function sendServerEvent(
  event: string,
  distinctId: string | null | undefined,
  properties?: Record<string, unknown>,
  opts: ServerCaptureOptions = {},
): Promise<void> {
  try {
    const config = opts.config === undefined ? posthogServerConfig() : opts.config
    if (!config?.key) return
    const body = buildServerEvent(config, event, distinctId, properties, opts.dedupeKey)
    const doFetch: Fetch = opts.fetch ?? ((url, init) => fetch(url, init))
    const res = await doFetch(`${config.host.replace(/\/$/, '')}/i/v0/e/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(3000),
    })
    if (!res.ok) console.warn(`[posthog] ${body.event} → HTTP ${res.status}`)
  }
  catch (e) {
    console.warn('[posthog] capture failed', (e as Error)?.message ?? e)
  }
}

/**
 * Fire-and-forget capture from a tRPC procedure. Uses `ctx.dancerId` as the
 * distinct id unless one is given (e.g. the dancer a sign-up just created).
 * Adds `channel: 'web' | 'mcp'`.
 */
export function trackServer(
  ctx: { dancerId?: string | null; oauthClientId?: string | null; waitUntil?: (p: Promise<unknown>) => void } | null | undefined,
  event: string,
  properties?: Record<string, unknown>,
  opts: ServerCaptureOptions & { distinctId?: string | null } = {},
): void {
  try {
    // `channel`: web session vs a connected app (MCP / OAuth token) — same routers.
    const props = { channel: ctx?.oauthClientId ? 'mcp' : 'web', ...properties }
    const p = sendServerEvent(event, opts.distinctId !== undefined ? opts.distinctId : ctx?.dancerId, props, opts)
    if (ctx?.waitUntil) ctx.waitUntil(p)
    else void p
  }
  catch { /* never break the caller */ }
}

/** The slice of an H3 event `trackServerEvent` needs (kept structural for tests). */
export interface WaitUntilEvent {
  waitUntil?: (p: Promise<unknown>) => void
}

/**
 * Fire-and-forget capture from a plain API route / webhook (no tRPC ctx).
 *
 * `distinctId` is the dancer the event belongs to when known (e.g. the buyer's
 * dancerId from Stripe metadata); `null` sends it anonymously with
 * `$process_person_profile: false`. The request is handed to the H3 event's
 * `waitUntil` so Vercel keeps the function alive until PostHog answered.
 * `channel` defaults to `'webhook'`. Never throws; a no-op without a key.
 */
export function trackServerEvent(
  h3Event: WaitUntilEvent | null | undefined,
  event: string,
  distinctId: string | null | undefined,
  properties?: Record<string, unknown>,
  opts: ServerCaptureOptions = {},
): void {
  try {
    const waitUntil = h3Event?.waitUntil ? (p: Promise<unknown>) => h3Event.waitUntil!(p) : undefined
    trackServer({ dancerId: distinctId ?? null, waitUntil }, event, { channel: 'webhook', ...properties }, opts)
  }
  catch { /* never break the caller */ }
}
