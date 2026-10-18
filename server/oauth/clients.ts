import { eq } from 'drizzle-orm'
import { oauthClients } from '../database/schema'
import { CLIENT_SECRET_PREFIX, randomToken, safeEqual, sha256Hex } from './crypto'
import { redirectUriProblem } from './redirect'
import { CIMD_CACHE_MS, cimdUrlProblem, fetchMetadataDocument, parseClientMetadata } from './cimd'
import { OAuthError } from './errors'

/**
 * OAuth clients: Dynamic Client Registration (RFC 7591) and Client ID
 * Metadata Documents. Both end up as an `oauth_clients` row.
 */

type Db = any
export type Client = typeof oauthClients.$inferSelect

const AUTH_METHODS = ['none', 'client_secret_post', 'client_secret_basic'] as const

/** POST /oauth/register. Returns the RFC 7591 response body. */
export async function registerClient(db: Db, body: Record<string, unknown>) {
  const uris = body.redirect_uris
  if (!Array.isArray(uris) || !uris.length || uris.length > 20) throw new OAuthError('invalid_redirect_uri', 'redirect_uris: 1–20 URIs required', 400)
  for (const r of uris) {
    const problem = redirectUriProblem(r)
    if (problem) throw new OAuthError('invalid_redirect_uri', problem, 400)
  }
  const method = (body.token_endpoint_auth_method ?? 'none') as string
  if (!(AUTH_METHODS as readonly string[]).includes(method)) throw new OAuthError('invalid_client_metadata', `token_endpoint_auth_method must be one of ${AUTH_METHODS.join(', ')}`, 400)
  const grantTypes = (body.grant_types ?? ['authorization_code', 'refresh_token']) as unknown
  if (!Array.isArray(grantTypes) || grantTypes.some(g => !['authorization_code', 'refresh_token'].includes(g))) {
    throw new OAuthError('invalid_client_metadata', 'grant_types may only contain authorization_code and refresh_token', 400)
  }
  const responseTypes = (body.response_types ?? ['code']) as unknown
  if (!Array.isArray(responseTypes) || responseTypes.some(r => r !== 'code')) throw new OAuthError('invalid_client_metadata', 'response_types may only contain code', 400)
  const name = typeof body.client_name === 'string' && body.client_name.trim() ? body.client_name.trim().slice(0, 120) : 'Unnamed app'
  const httpsUrl = (v: unknown) => {
    if (typeof v !== 'string') return null
    try { return new URL(v).protocol === 'https:' ? v.slice(0, 500) : null } catch { return null }
  }

  const clientId = `wdcl_${randomToken().slice(0, 32)}`
  const secret = method === 'none' ? null : randomToken(CLIENT_SECRET_PREFIX)
  const now = new Date()
  // Only the fields we understand are kept: no free-form metadata from strangers.
  const metadata = {
    client_name: name,
    redirect_uris: uris,
    grant_types: grantTypes,
    response_types: responseTypes,
    token_endpoint_auth_method: method,
    ...(typeof body.scope === 'string' ? { scope: body.scope.slice(0, 500) } : {}),
    ...(typeof body.software_id === 'string' ? { software_id: body.software_id.slice(0, 200) } : {}),
    ...(typeof body.software_version === 'string' ? { software_version: body.software_version.slice(0, 60) } : {}),
  }
  await db.insert(oauthClients).values({
    id: clientId,
    kind: 'dcr',
    name,
    redirectUris: uris as string[],
    clientUri: httpsUrl(body.client_uri),
    logoUri: httpsUrl(body.logo_uri),
    tokenEndpointAuthMethod: method,
    clientSecretHash: secret ? sha256Hex(secret) : null,
    metadata,
  })
  return {
    client_id: clientId,
    client_id_issued_at: Math.floor(now.getTime() / 1000),
    ...(secret ? { client_secret: secret, client_secret_expires_at: 0 } : {}),
    ...metadata,
    ...(httpsUrl(body.client_uri) ? { client_uri: httpsUrl(body.client_uri) } : {}),
    ...(httpsUrl(body.logo_uri) ? { logo_uri: httpsUrl(body.logo_uri) } : {}),
  }
}

export const isMetadataUrlClientId = (clientId: string) => clientId.startsWith('https://')

// A metadata URL that just failed isn't fetched again for 5 minutes (per
// instance), so the authorize page can't be used to hammer someone's server.
const recentFailures = new Map<string, number>()
const FAILURE_BACKOFF_MS = 5 * 60_000

/**
 * Find a client by id. An https client_id is a metadata document: fetched on
 * first sight and re-fetched when the cached copy is over an hour old (a
 * failed re-fetch keeps the cached copy rather than locking the app out).
 */
export async function resolveClient(db: Db, clientId: string | null | undefined, opts: { fetchDocument?: (id: string) => Promise<unknown>; now?: number } = {}): Promise<Client | null> {
  if (!clientId || typeof clientId !== 'string' || clientId.length > 500) return null
  const [row] = await db.select().from(oauthClients).where(eq(oauthClients.id, clientId))
  if (!isMetadataUrlClientId(clientId)) return row ?? null
  if (cimdUrlProblem(clientId)) return null
  const now = opts.now ?? Date.now()
  const fresh = row?.metadataFetchedAt && now - new Date(row.metadataFetchedAt).getTime() < CIMD_CACHE_MS
  if (row && fresh) return row
  const failedAt = recentFailures.get(clientId)
  if (failedAt && now - failedAt < FAILURE_BACKOFF_MS && !opts.fetchDocument) {
    if (row) return row
    throw new OAuthError('invalid_client', 'The app’s metadata document couldn’t be loaded a moment ago. Try again in a few minutes.', 400)
  }
  let meta
  try {
    meta = parseClientMetadata(clientId, await (opts.fetchDocument ?? fetchMetadataDocument)(clientId))
    recentFailures.delete(clientId)
  } catch (e) {
    if (recentFailures.size > 1000) recentFailures.clear()
    recentFailures.set(clientId, now)
    if (row) return row
    throw new OAuthError('invalid_client', `Couldn’t use the app’s metadata document: ${(e as Error).message}`, 400)
  }
  const values = {
    kind: 'cimd' as const,
    name: meta.name,
    redirectUris: meta.redirectUris,
    clientUri: meta.clientUri,
    logoUri: meta.logoUri,
    tokenEndpointAuthMethod: 'none',
    clientSecretHash: null,
    metadata: { client_name: meta.name, redirect_uris: meta.redirectUris },
    metadataFetchedAt: new Date(now),
  }
  const [saved] = await db.insert(oauthClients).values({ id: clientId, ...values })
    .onConflictDoUpdate({ target: oauthClients.id, set: values })
    .returning()
  return saved
}

/**
 * Client authentication at the token and revocation endpoints. Public
 * clients send only client_id; confidential ones a secret (post or basic).
 */
export async function authenticateClient(db: Db, form: Record<string, string>, authorization: string | null | undefined): Promise<Client> {
  let id = form.client_id
  let secret = form.client_secret
  if (authorization?.startsWith('Basic ')) {
    try {
      const [u, p] = Buffer.from(authorization.slice(6), 'base64').toString('utf8').split(':')
      id = decodeURIComponent(u ?? '')
      secret = decodeURIComponent(p ?? '')
    } catch {
      throw new OAuthError('invalid_client', 'Malformed Basic authorization', 401)
    }
  }
  const client = await resolveClient(db, id)
  if (!client) throw new OAuthError('invalid_client', 'Unknown client', 401)
  if (client.tokenEndpointAuthMethod === 'none') {
    if (secret) throw new OAuthError('invalid_client', 'This client is public and has no secret', 401)
    return client
  }
  if (!secret || !client.clientSecretHash || !safeEqual(sha256Hex(secret), client.clientSecretHash)) {
    throw new OAuthError('invalid_client', 'Client authentication failed', 401)
  }
  return client
}
