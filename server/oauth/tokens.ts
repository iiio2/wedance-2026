import { and, eq, isNull } from 'drizzle-orm'
import { dancers, oauthCodes, oauthGrants, oauthTokens } from '../database/schema'
import { ACCESS_PREFIX, REFRESH_PREFIX, randomToken, sha256Hex, verifyPkce } from './crypto'
import { ACCESS_TOKEN_TTL_S, REFRESH_TOKEN_TTL_S, isAdminClient, parseScopes, type Scope } from './config'
import { OAuthError } from './errors'
import type { Client } from './clients'

/**
 * Tokens: code exchange, refresh rotation with reuse detection, revocation,
 * and resolving an access token for a request. Only hashes are stored.
 */

type Db = any

export interface TokenResponse {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  refresh_token: string
  scope: string
}

async function issuePair(db: Db, grantId: string, scopes: string[], resource: string, now = Date.now()): Promise<TokenResponse> {
  const access = randomToken(ACCESS_PREFIX)
  const refresh = randomToken(REFRESH_PREFIX)
  await db.insert(oauthTokens).values([
    { grantId, kind: 'access', tokenHash: sha256Hex(access), scopes, resource, expiresAt: new Date(now + ACCESS_TOKEN_TTL_S * 1000) },
    { grantId, kind: 'refresh', tokenHash: sha256Hex(refresh), scopes, resource, expiresAt: new Date(now + REFRESH_TOKEN_TTL_S * 1000) },
  ])
  return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TOKEN_TTL_S, refresh_token: refresh, scope: scopes.join(' ') }
}

/** End a grant: no token of it works any more. */
export async function revokeGrant(db: Db, grantId: string, reason: string, now = new Date()) {
  await db.update(oauthGrants).set({ revokedAt: now, revokedReason: reason, updatedAt: now }).where(and(eq(oauthGrants.id, grantId), isNull(oauthGrants.revokedAt)))
  await db.update(oauthTokens).set({ revokedAt: now }).where(and(eq(oauthTokens.grantId, grantId), isNull(oauthTokens.revokedAt)))
}

async function liveGrant(db: Db, grantId: string) {
  const [g] = await db.select().from(oauthGrants).where(eq(oauthGrants.id, grantId))
  return g && !g.revokedAt ? g : null
}

/** grant_type=authorization_code. */
export async function exchangeCode(db: Db, client: Client, form: Record<string, string>, now = Date.now()): Promise<TokenResponse> {
  const { code, redirect_uri: redirectUri, code_verifier: verifier, resource } = form
  if (!code) throw new OAuthError('invalid_request', 'code is required')
  const codeHash = sha256Hex(code)
  // Spend the code first, atomically: a second redemption finds it used.
  const [row] = await db.update(oauthCodes).set({ usedAt: new Date(now) })
    .where(and(eq(oauthCodes.codeHash, codeHash), isNull(oauthCodes.usedAt)))
    .returning()
  if (!row) {
    const [spent] = await db.select().from(oauthCodes).where(eq(oauthCodes.codeHash, codeHash))
    // A replayed code may have been stolen: end everything issued from it (RFC 6749 §4.1.2).
    if (spent) await revokeGrant(db, spent.grantId, 'authorization_code_reuse', new Date(now))
    throw new OAuthError('invalid_grant', 'The authorization code is invalid or was already used')
  }
  if (new Date(row.expiresAt).getTime() < now) throw new OAuthError('invalid_grant', 'The authorization code expired')
  if (row.clientId !== client.id) throw new OAuthError('invalid_grant', 'The authorization code was issued to another client')
  if (redirectUri !== row.redirectUri) throw new OAuthError('invalid_grant', 'redirect_uri does not match the authorization request')
  if (!verifyPkce(verifier, row.codeChallenge)) throw new OAuthError('invalid_grant', 'PKCE verification failed')
  if (resource && resource !== row.resource) throw new OAuthError('invalid_target', 'resource does not match the authorization request')
  const grant = await liveGrant(db, row.grantId)
  if (!grant) throw new OAuthError('invalid_grant', 'This connection was revoked')
  return issuePair(db, grant.id, row.scopes, row.resource, now)
}

/** grant_type=refresh_token: rotate. Presenting a spent refresh token revokes the grant. */
export async function refreshTokens(db: Db, client: Client, form: Record<string, string>, now = Date.now()): Promise<TokenResponse> {
  const token = form.refresh_token
  if (!token || !token.startsWith(REFRESH_PREFIX)) throw new OAuthError('invalid_grant', 'Unknown refresh token')
  const [row] = await db.select().from(oauthTokens).where(and(eq(oauthTokens.tokenHash, sha256Hex(token)), eq(oauthTokens.kind, 'refresh')))
  if (!row) throw new OAuthError('invalid_grant', 'Unknown refresh token')
  const [grant] = await db.select().from(oauthGrants).where(eq(oauthGrants.id, row.grantId))
  if (!grant || grant.clientId !== client.id) throw new OAuthError('invalid_grant', 'Unknown refresh token')
  if (grant.revokedAt) throw new OAuthError('invalid_grant', 'This connection was revoked')
  if (row.usedAt || row.revokedAt) {
    await revokeGrant(db, grant.id, 'refresh_token_reuse', new Date(now))
    throw new OAuthError('invalid_grant', 'Refresh token was already used; the connection has been revoked for safety')
  }
  if (new Date(row.expiresAt).getTime() < now) throw new OAuthError('invalid_grant', 'Refresh token expired')
  if (form.resource && form.resource !== row.resource) throw new OAuthError('invalid_target', 'resource does not match')
  // Spend it atomically; losing the race means someone else used it: reuse.
  const [spent] = await db.update(oauthTokens).set({ usedAt: new Date(now) })
    .where(and(eq(oauthTokens.id, row.id), isNull(oauthTokens.usedAt), isNull(oauthTokens.revokedAt)))
    .returning({ id: oauthTokens.id })
  if (!spent) {
    await revokeGrant(db, grant.id, 'refresh_token_reuse', new Date(now))
    throw new OAuthError('invalid_grant', 'Refresh token was already used; the connection has been revoked for safety')
  }
  // Never more than the token had, nor more than the grant allows now.
  let scopes = (row.scopes as string[]).filter(s => (grant.scopes as string[]).includes(s))
  if (form.scope) {
    const asked = parseScopes(form.scope)
    if (asked.some(s => !scopes.includes(s))) throw new OAuthError('invalid_scope', 'Requested scope exceeds the original grant')
    scopes = asked
  }
  return issuePair(db, grant.id, scopes, row.resource, now)
}

/** RFC 7009. Unknown tokens are not an error. Refresh → the whole grant's tokens end. */
export async function revokeToken(db: Db, client: Client, token: string | undefined, now = new Date()) {
  if (!token) throw new OAuthError('invalid_request', 'token is required')
  const [row] = await db.select({ id: oauthTokens.id, kind: oauthTokens.kind, grantId: oauthTokens.grantId, clientId: oauthGrants.clientId })
    .from(oauthTokens).innerJoin(oauthGrants, eq(oauthGrants.id, oauthTokens.grantId))
    .where(eq(oauthTokens.tokenHash, sha256Hex(token)))
  if (!row || row.clientId !== client.id) return
  if (row.kind === 'refresh') {
    await db.update(oauthTokens).set({ revokedAt: now }).where(and(eq(oauthTokens.grantId, row.grantId), isNull(oauthTokens.revokedAt)))
  } else {
    await db.update(oauthTokens).set({ revokedAt: now }).where(eq(oauthTokens.id, row.id))
  }
}

export interface AccessAuth {
  dancerId: string
  isAdmin: boolean
  scopes: Scope[]
  grantedProfileIds: string[]
  clientId: string
  grantId: string
}

/**
 * The request's access token → who and what. Null when unknown, expired,
 * revoked, or minted for another resource (RFC 8707 audience binding).
 * `admin` survives only for a WeDance admin on an allowlisted client.
 */
export async function resolveAccessToken(db: Db, token: string | null | undefined, expectedResource: string | null | undefined, now = Date.now()): Promise<AccessAuth | null> {
  if (!token || !token.startsWith(ACCESS_PREFIX) || !expectedResource) return null
  const [row] = await db.select({
    kind: oauthTokens.kind, scopes: oauthTokens.scopes, resource: oauthTokens.resource, expiresAt: oauthTokens.expiresAt, revokedAt: oauthTokens.revokedAt,
    grantId: oauthGrants.id, grantRevokedAt: oauthGrants.revokedAt, grantScopes: oauthGrants.scopes, profileIds: oauthGrants.profileIds,
    clientId: oauthGrants.clientId, lastUsedAt: oauthGrants.lastUsedAt, dancerId: dancers.id, dancerIsAdmin: dancers.isAdmin,
  })
    .from(oauthTokens)
    .innerJoin(oauthGrants, eq(oauthGrants.id, oauthTokens.grantId))
    .innerJoin(dancers, eq(dancers.id, oauthGrants.dancerId))
    .where(eq(oauthTokens.tokenHash, sha256Hex(token)))
  if (!row || row.kind !== 'access' || row.revokedAt || row.grantRevokedAt) return null
  if (new Date(row.expiresAt).getTime() <= now) return null
  if (row.resource !== expectedResource) return null
  const grantScopes = row.grantScopes as string[]
  let scopes = (row.scopes as string[]).filter(s => grantScopes.includes(s)) as Scope[]
  const admin = scopes.includes('admin') && !!row.dancerIsAdmin && isAdminClient(row.clientId)
  if (!admin) scopes = scopes.filter(s => s !== 'admin')
  // Last use for the connections page; at most one write per 5 minutes.
  if (!row.lastUsedAt || now - new Date(row.lastUsedAt).getTime() > 5 * 60_000) {
    await db.update(oauthGrants).set({ lastUsedAt: new Date(now) }).where(eq(oauthGrants.id, row.grantId))
  }
  return {
    dancerId: row.dancerId,
    isAdmin: admin,
    scopes,
    grantedProfileIds: (row.profileIds as string[]) ?? [],
    clientId: row.clientId,
    grantId: row.grantId,
  }
}
