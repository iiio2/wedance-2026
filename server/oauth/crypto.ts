import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Small crypto helpers for the OAuth server. Everything secret we store is a
 * sha256 hash; every comparison of secrets is timing safe.
 */

/** Token prefixes: an access token is recognisable in createContext without a lookup. */
export const ACCESS_PREFIX = 'wda_'
export const REFRESH_PREFIX = 'wdr_'
export const CODE_PREFIX = 'wdc_'
export const CLIENT_SECRET_PREFIX = 'wds_'

/** A random, URL-safe token with 256 bits of entropy. */
export function randomToken(prefix = ''): string {
  return prefix + randomBytes(32).toString('base64url')
}

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function sha256Base64Url(value: string): string {
  return createHash('sha256').update(value, 'ascii').digest('base64url')
}

/** Constant-time string equality (hashes first, so lengths never leak). */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a, 'utf8').digest()
  const hb = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(ha, hb) && a.length === b.length
}

// RFC 7636: 43–128 characters from the unreserved set.
const VERIFIER = /^[A-Za-z0-9\-._~]{43,128}$/
const CHALLENGE = /^[A-Za-z0-9\-_]{43}$/

export function isValidCodeChallenge(challenge: string): boolean {
  return CHALLENGE.test(challenge)
}

/** PKCE S256 (RFC 7636 §4.6): BASE64URL(SHA256(verifier)) == challenge. */
export function verifyPkce(verifier: string | undefined | null, challenge: string): boolean {
  if (!verifier || !VERIFIER.test(verifier)) return false
  return safeEqual(sha256Base64Url(verifier), challenge)
}

/**
 * The secret behind consent request tokens and publish confirm tokens.
 * Production needs OAUTH_SIGNING_SECRET (≥ 32 chars); locally a fixed dev
 * value keeps the flow working without setup.
 */
export function signingSecret(): string {
  const s = process.env.OAUTH_SIGNING_SECRET
  if (s && s.length >= 32) return s
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    throw new Error('OAUTH_SIGNING_SECRET is not set (32+ characters). Connected apps are disabled until it is.')
  }
  return 'wedance-dev-only-oauth-signing-secret-not-for-production'
}

/**
 * A signed, expiring payload: base64url(json).base64url(hmac). `purpose` is
 * part of the MAC, so a token minted for one use never verifies for another.
 */
export function signPayload(purpose: string, payload: Record<string, unknown>, ttlSeconds: number, now = Date.now()): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(now / 1000) + ttlSeconds })).toString('base64url')
  const mac = createHmac('sha256', signingSecret()).update(`${purpose}.${body}`).digest('base64url')
  return `${body}.${mac}`
}

export function verifyPayload<T extends Record<string, unknown>>(purpose: string, token: string | undefined | null, now = Date.now()): (T & { exp: number }) | null {
  if (!token || typeof token !== 'string' || token.length > 4096) return null
  const [body, mac, extra] = token.split('.')
  if (!body || !mac || extra !== undefined) return null
  const expected = createHmac('sha256', signingSecret()).update(`${purpose}.${body}`).digest('base64url')
  if (!safeEqual(mac, expected)) return null
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    if (typeof data?.exp !== 'number' || data.exp * 1000 < now) return null
    return data
  } catch {
    return null
  }
}

/** Stable hash of a JSON value (keys sorted), for binding a confirmation to its arguments. */
export function hashArgs(value: unknown): string {
  return sha256Hex(stableStringify(value))
}

export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null'
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`
  const keys = Object.keys(value as Record<string, unknown>).filter(k => (value as any)[k] !== undefined).sort()
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify((value as any)[k])}`).join(',')}}`
}
