import { getHeader, getRequestURL, readRawBody, setResponseHeaders, setResponseStatus, type H3Event } from 'h3'
import { siteOrigin } from './config'
import { OAuthError } from './errors'
import { hit, ipKey, LIMITS } from './rateLimit'
import { useDb } from '../utils/db'

/** HTTP plumbing shared by the OAuth and MCP routes. */

/** The origin the client used (x-forwarded-* on Vercel), resolved to our canonical origin. */
export function requestOrigin(event: H3Event): string {
  return siteOrigin(getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin)
}

/** The client's IP: Vercel's own header first (clients can't set it), then the usual ones. */
export function clientIp(event: H3Event): string | null {
  const v = getHeader(event, 'x-vercel-forwarded-for') || getHeader(event, 'x-real-ip') || getHeader(event, 'x-forwarded-for')
  if (v) return v.split(',')[0]!.trim()
  return event.node?.req?.socket?.remoteAddress ?? null
}

/** Token endpoints take form posts (RFC 6749); we also accept JSON. Values are strings. */
export async function readParams(event: H3Event): Promise<Record<string, string>> {
  const raw = (await readRawBody(event, 'utf8')) ?? ''
  if (raw.length > 64 * 1024) throw new OAuthError('invalid_request', 'Request body too large')
  const type = getHeader(event, 'content-type') ?? ''
  const out: Record<string, string> = {}
  if (type.includes('application/json')) {
    let body: unknown
    try { body = JSON.parse(raw || '{}') } catch { throw new OAuthError('invalid_request', 'Body is not valid JSON') }
    if (!body || typeof body !== 'object') throw new OAuthError('invalid_request', 'Body must be an object')
    for (const [k, v] of Object.entries(body as Record<string, unknown>)) if (typeof v === 'string') out[k] = v
    return out
  }
  for (const [k, v] of new URLSearchParams(raw)) {
    // RFC 6749 §3.1: parameters must not be repeated.
    if (k in out) throw new OAuthError('invalid_request', `Parameter ${k} was sent twice`)
    out[k] = v
  }
  return out
}

export async function readJsonObject(event: H3Event): Promise<Record<string, unknown>> {
  const raw = (await readRawBody(event, 'utf8')) ?? ''
  if (raw.length > 64 * 1024) throw new OAuthError('invalid_request', 'Request body too large')
  try {
    const body = JSON.parse(raw || '{}')
    if (body && typeof body === 'object' && !Array.isArray(body)) return body
  } catch { /* fall through */ }
  throw new OAuthError('invalid_client_metadata', 'Body must be a JSON object')
}

/** Discovery and token endpoints are called cross-origin by browser-based clients. */
export function allowCors(event: H3Event, methods = 'GET, POST, OPTIONS') {
  setResponseHeaders(event, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': methods,
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version, Mcp-Session-Id',
    'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
    'Access-Control-Max-Age': '86400',
  })
}

export function noStore(event: H3Event) {
  setResponseHeaders(event, { 'Cache-Control': 'no-store', Pragma: 'no-cache' })
}

/** Turn an error into an RFC 6749 JSON error response. Never echoes secrets. */
export function oauthErrorResponse(event: H3Event, e: unknown) {
  const err = e instanceof OAuthError ? e : new OAuthError('server_error', 'Something went wrong', 500)
  if (!(e instanceof OAuthError)) console.error('[oauth]', (e as Error)?.message ?? e)
  setResponseStatus(event, err.status)
  if (err.status === 401 && err.code === 'invalid_client') setResponseHeaders(event, { 'WWW-Authenticate': 'Basic realm="WeDance"' })
  noStore(event)
  return err.toJSON()
}

/** Per-IP limit for the OAuth endpoints. Throws a 429-shaped OAuthError. */
export async function limitOAuthIp(event: H3Event, scope: string) {
  const r = await hit(useDb(), ipKey(`oauth:${scope}`, clientIp(event)), LIMITS.oauth)
  if (!r.ok) {
    setResponseHeaders(event, { 'Retry-After': String(r.retryAfter) })
    throw new OAuthError('slow_down', 'Too many requests. Try again in a minute.', 429)
  }
}
