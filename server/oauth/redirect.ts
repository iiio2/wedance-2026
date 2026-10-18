/**
 * Redirect URIs: what a client may register, and the exact-match rule at
 * /oauth/authorize and /oauth/token (OAuth 2.1 §2.3.1 / §4.1.3).
 */

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])
// Never valid as a redirect: they run code or read files in the browser.
const FORBIDDEN_SCHEMES = new Set(['javascript:', 'data:', 'vbscript:', 'file:', 'blob:', 'about:', 'ftp:', 'ws:', 'wss:'])

/**
 * A redirect URI a client may register: https anywhere, http only on a
 * loopback host (native apps, RFC 8252 §7.3), or a private-use scheme with a
 * dot in it (RFC 8252 §7.1, e.g. `com.example.app:/cb`). No fragments, no
 * credentials. Returns an error message, or null when it's fine.
 */
export function redirectUriProblem(uri: unknown): string | null {
  if (typeof uri !== 'string' || !uri || uri.length > 2000) return 'redirect_uri must be a non-empty string'
  let u: URL
  try { u = new URL(uri) } catch { return `redirect_uri is not a URL: ${uri}` }
  if (u.hash || uri.includes('#')) return 'redirect_uri must not contain a fragment'
  if (u.username || u.password) return 'redirect_uri must not contain credentials'
  if (FORBIDDEN_SCHEMES.has(u.protocol)) return `redirect_uri scheme ${u.protocol} is not allowed`
  if (u.protocol === 'https:') return u.hostname ? null : 'redirect_uri needs a host'
  if (u.protocol === 'http:') return LOOPBACK_HOSTS.has(u.hostname) ? null : 'http redirect_uris are only allowed for localhost'
  // Private-use URI scheme for native apps: reverse-domain style.
  return /^[a-z][a-z0-9+\-]*\.[a-z0-9+.\-]+:$/i.test(u.protocol) ? null : `redirect_uri scheme ${u.protocol} is not allowed`
}

/** Exact, case-sensitive string match against the registered list. */
export function redirectUriRegistered(registered: readonly string[], requested: string | null | undefined): boolean {
  return !!requested && registered.some(r => r === requested)
}

/** Build the redirect back to the client with query params (code, state, iss, or error). */
export function redirectWith(redirectUri: string, params: Record<string, string | undefined | null>): string {
  const u = new URL(redirectUri)
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) u.searchParams.set(k, v)
  return u.toString()
}
