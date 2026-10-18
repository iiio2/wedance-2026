/**
 * OAuth / MCP configuration: who we are (issuer, resource), the scopes and
 * their plain-language meaning, lifetimes, and the admin client allowlist.
 */

export const ACCESS_TOKEN_TTL_S = 60 * 60 // 1 h
export const REFRESH_TOKEN_TTL_S = 30 * 24 * 60 * 60 // 30 d
export const CODE_TTL_S = 5 * 60 // authorization codes: 5 min, single use
export const CONSENT_TTL_S = 15 * 60 // the consent screen's signed request
export const CONFIRM_TTL_S = 10 * 60 // business:publish preview → commit window

export const SCOPES = ['me:read', 'plan:write', 'social:write', 'business:read', 'business:write', 'business:publish', 'admin'] as const
export type Scope = (typeof SCOPES)[number]

/** Shown on the consent screen and in the docs. `admin` is never offered publicly. */
export const SCOPE_INFO: Record<Scope, { title: string; detail: string }> = {
  'me:read': { title: 'See your profile and plan', detail: 'Your name, city and styles, what’s in your plan, your tickets and who you follow.' },
  'plan:write': { title: 'Change your plan', detail: 'Add or remove events, say whether you’re going, join festivals, offer rides and look for roommates. Ticket purchases only ever return a payment link you open yourself.' },
  'social:write': { title: 'Post and react for you', detail: 'Ask the locals, recommend places, RSVP to hangouts, join dinners, follow pages, write reviews, enter giveaways, vote on city videos and send booking requests.' },
  'business:read': { title: 'Read your business pages', detail: 'For the pages you pick below: events, inbox, booking requests, team and insights.' },
  'business:write': { title: 'Draft for your business pages', detail: 'Create and edit draft events, make flyers and captions, plan posts and set availability. Nothing goes public with this alone.' },
  'business:publish': { title: 'Publish for your business pages', detail: 'Publish events, edit live pages, invite artists, answer invites and change your team. The app shows you a preview and asks again before each one.' },
  'admin': { title: 'WeDance admin', detail: 'Admin actions on WeDance. Only for WeDance admins using an approved app.' },
}

/** Scopes a client may ask for and that we list publicly. */
export const PUBLIC_SCOPES = SCOPES.filter(s => s !== 'admin') as Exclude<Scope, 'admin'>[]

/** No `scope` in the request: everything public (the consent screen lets the dancer untick). */
export const DEFAULT_SCOPES: Scope[] = [...PUBLIC_SCOPES]

export const BUSINESS_SCOPES: Scope[] = ['business:read', 'business:write', 'business:publish']

/** Parse a space-separated scope string; unknown values are dropped. */
export function parseScopes(raw: string | null | undefined): Scope[] {
  if (!raw) return []
  return [...new Set(raw.split(/\s+/).filter((s): s is Scope => (SCOPES as readonly string[]).includes(s)))]
}

/**
 * Does `held` grant `needed`? Business scopes nest: publish ⊃ write ⊃ read.
 * Everything else must be held as is.
 */
export function hasScope(held: readonly string[] | null | undefined, needed: Scope): boolean {
  if (!held) return false
  if (held.includes(needed)) return true
  if (needed === 'business:read') return held.includes('business:write') || held.includes('business:publish')
  if (needed === 'business:write') return held.includes('business:publish')
  return false
}

/** Client ids allowed to receive `admin` (comma-separated MCP_ADMIN_CLIENT_IDS). */
export function adminClientIds(): string[] {
  return (process.env.MCP_ADMIN_CLIENT_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean)
}

export function isAdminClient(clientId: string | null | undefined): boolean {
  return !!clientId && adminClientIds().includes(clientId)
}

/**
 * Our public origin. Production is always the custom domain; SITE_URL wins
 * when set; otherwise the origin the request came in on (preview deploys,
 * localhost), so discovery documents match the URL the client used.
 */
export function siteOrigin(requestOrigin?: string | null): string {
  const env = process.env
  const raw = env.SITE_URL
    || (env.VERCEL_ENV === 'production' ? 'https://2026.wedance.vip' : '')
    || requestOrigin
    || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : 'http://localhost:3000')
  return raw.replace(/\/+$/, '')
}

export const issuerFor = (origin: string) => origin
export const mcpResourceFor = (origin: string) => `${origin}/mcp`
export const resourceMetadataUrlFor = (origin: string) => `${origin}/.well-known/oauth-protected-resource/mcp`
