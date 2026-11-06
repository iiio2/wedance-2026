import { and, eq, inArray, isNull } from 'drizzle-orm'
import { oauthCodes, oauthGrants, profileMembers } from '../database/schema'
import { CODE_PREFIX, isValidCodeChallenge, randomToken, sha256Hex, signPayload, verifyPayload } from './crypto'
import { BUSINESS_SCOPES, CODE_TTL_S, CONSENT_TTL_S, DEFAULT_SCOPES, hasScope, isAdminClient, issuerFor, mcpResourceFor, parseScopes, type Scope } from './config'
import { redirectUriRegistered, redirectWith } from './redirect'
import { resolveClient, type Client } from './clients'
import { OAuthError } from './errors'

/**
 * /oauth/authorize: validate the request, show consent, mint the code.
 *
 * Errors split in two (RFC 6749 §4.1.2.1): when the client or redirect_uri
 * can't be trusted we show the error on our page and never redirect (no open
 * redirects); anything else goes back to the client's redirect_uri.
 */

type Db = any

export interface AuthorizeParams {
  response_type?: string
  client_id?: string
  redirect_uri?: string
  code_challenge?: string
  code_challenge_method?: string
  state?: string
  scope?: string
  resource?: string
}

export interface ValidAuthorizeRequest {
  client: Client
  redirectUri: string
  state: string | null
  codeChallenge: string
  resource: string
  scopes: Scope[]
}

export type AuthorizeOutcome =
  | { ok: true; request: ValidAuthorizeRequest }
  | { ok: false; fatal: true; error: string; description: string }
  | { ok: false; fatal: false; redirect: string; error: string; description: string }

export async function validateAuthorizeRequest(db: Db, p: AuthorizeParams, origin: string, opts: { fetchDocument?: (id: string) => Promise<unknown> } = {}): Promise<AuthorizeOutcome> {
  const fatal = (error: string, description: string) => ({ ok: false as const, fatal: true as const, error, description })
  let client: Client | null
  try {
    client = await resolveClient(db, p.client_id, opts)
  } catch (e) {
    return fatal('invalid_client', e instanceof OAuthError ? e.description : 'Unknown app.')
  }
  if (!client) return fatal('invalid_client', 'This app isn’t registered with WeDance.')
  if (!p.redirect_uri || !redirectUriRegistered(client.redirectUris as string[], p.redirect_uri)) {
    return fatal('invalid_request', 'The redirect_uri doesn’t match what the app registered.')
  }
  const state = typeof p.state === 'string' && p.state.length <= 1000 ? p.state : null
  const back = (error: string, description: string) => ({
    ok: false as const, fatal: false as const, error, description,
    redirect: redirectWith(p.redirect_uri!, { error, error_description: description, state, iss: issuerFor(origin) }),
  })
  if (p.state && p.state.length > 1000) return back('invalid_request', 'state is too long')
  if (p.response_type !== 'code') return back('unsupported_response_type', 'Only response_type=code is supported')
  if (!p.code_challenge || !isValidCodeChallenge(p.code_challenge)) return back('invalid_request', 'PKCE is required: send a S256 code_challenge')
  if (p.code_challenge_method !== 'S256') return back('invalid_request', 'code_challenge_method must be S256')
  if (!p.resource) return back('invalid_target', `resource is required (${mcpResourceFor(origin)})`)
  if (p.resource !== mcpResourceFor(origin)) return back('invalid_target', `Unknown resource; this server issues tokens for ${mcpResourceFor(origin)}`)
  let scopes = p.scope === undefined || p.scope.trim() === '' ? [...DEFAULT_SCOPES] : parseScopes(p.scope)
  if (p.scope && !scopes.length) return back('invalid_scope', 'None of the requested scopes exist')
  // admin is only ever offered to an allowlisted app (and then only to admins).
  if (!isAdminClient(client.id)) scopes = scopes.filter(s => s !== 'admin')
  return { ok: true, request: { client, redirectUri: p.redirect_uri, state, codeChallenge: p.code_challenge, resource: p.resource, scopes } }
}

/** The consent screen's request token: binds the validated request to the dancer (CSRF + tamper proof). */
export function consentToken(req: ValidAuthorizeRequest, dancerId: string, now = Date.now()) {
  return signPayload('oauth-consent', {
    c: req.client.id, r: req.redirectUri, s: req.state, cc: req.codeChallenge, res: req.resource, sc: req.scopes, d: dancerId,
  }, CONSENT_TTL_S, now)
}

interface ConsentPayload { c: string; r: string; s: string | null; cc: string; res: string; sc: Scope[]; d: string }

export function readConsentToken(token: string, dancerId: string, now = Date.now()): ConsentPayload {
  const p = verifyPayload<ConsentPayload & Record<string, unknown>>('oauth-consent', token, now)
  if (!p) throw new OAuthError('invalid_request', 'This sign-in request expired. Start connecting the app again.', 400)
  if (p.d !== dancerId) throw new OAuthError('access_denied', 'This request was made for another account.', 403)
  return p
}

/** Profiles the dancer is on the team of (the profile picker's choices). */
export async function memberProfileIds(db: Db, dancerId: string, among?: string[]) {
  if (among && !among.length) return []
  const rows = await db.select({ id: profileMembers.profileId }).from(profileMembers)
    .where(and(eq(profileMembers.dancerId, dancerId), among ? inArray(profileMembers.profileId, among) : undefined))
  return rows.map((r: any) => r.id as string)
}

/**
 * Consent given: record the grant (one live grant per dancer + app; the new
 * consent replaces scopes and profiles) and mint a single-use code.
 * `allProfiles` ("All my pages") covers every page the dancer runs, now and later.
 */
export async function approveConsent(db: Db, input: { token: string; dancerId: string; isAdmin: boolean; scopes: string[]; profileIds: string[]; allProfiles?: boolean; origin: string }, now = Date.now()) {
  const p = readConsentToken(input.token, input.dancerId, now)
  const client = await resolveClient(db, p.c)
  if (!client || !redirectUriRegistered(client.redirectUris as string[], p.r)) throw new OAuthError('invalid_client', 'The app changed its registration. Start connecting it again.')
  // Only what was asked for, and admin only for an admin on an allowlisted app.
  let scopes = parseScopes(input.scopes.join(' ')).filter(s => p.sc.includes(s))
  if (!(input.isAdmin && isAdminClient(client.id))) scopes = scopes.filter(s => s !== 'admin')
  const business = BUSINESS_SCOPES.some(s => hasScope(scopes, s))
  const allProfiles = business && !!input.allProfiles
  const profileIds = !business ? [] : await memberProfileIds(db, input.dancerId, allProfiles ? undefined : [...new Set(input.profileIds)])
  const at = new Date(now)
  const [existing] = await db.select({ id: oauthGrants.id }).from(oauthGrants)
    .where(and(eq(oauthGrants.dancerId, input.dancerId), eq(oauthGrants.clientId, client.id), isNull(oauthGrants.revokedAt)))
  let grantId: string
  if (existing) {
    await db.update(oauthGrants).set({ scopes, profileIds, allProfiles, updatedAt: at }).where(eq(oauthGrants.id, existing.id))
    grantId = existing.id
  } else {
    const [g] = await db.insert(oauthGrants).values({ dancerId: input.dancerId, clientId: client.id, scopes, profileIds, allProfiles }).returning({ id: oauthGrants.id })
    grantId = g!.id
  }
  const code = randomToken(CODE_PREFIX)
  await db.insert(oauthCodes).values({
    codeHash: sha256Hex(code), grantId, clientId: client.id, redirectUri: p.r, codeChallenge: p.cc, resource: p.res, scopes,
    expiresAt: new Date(now + CODE_TTL_S * 1000),
  })
  return { redirect: redirectWith(p.r, { code, state: p.s, iss: issuerFor(input.origin) }), grantId }
}

/** "Don't allow": back to the app with access_denied. */
export function denyConsent(input: { token: string; dancerId: string; origin: string }, now = Date.now()) {
  const p = readConsentToken(input.token, input.dancerId, now)
  return { redirect: redirectWith(p.r, { error: 'access_denied', error_description: 'The user did not allow access', state: p.s, iss: issuerFor(input.origin) }) }
}
