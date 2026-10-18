import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash, randomBytes } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, inArray, like } from 'drizzle-orm'
import * as schema from '../database/schema'
import { appRouter } from '../trpc'
import { registerClient, authenticateClient, resolveClient } from './clients'
import { validateAuthorizeRequest, approveConsent, consentToken, denyConsent } from './authorize'
import { exchangeCode, refreshTokens, resolveAccessToken, revokeToken } from './tokens'
import { sha256Hex } from './crypto'
import { OAuthError } from './errors'
import { callTool } from '../mcp/server'
import { TOOL_BY_NAME } from '../mcp/tools'

// Local Postgres only (test-setup drops a remote DATABASE_URL):
//   DATABASE_URL=postgresql://dev:dev@localhost:5441/wedance NEON_FETCH_ENDPOINT=http://localhost:4444/sql bunx vitest run server/oauth
const DATABASE_URL = process.env.DATABASE_URL
const db: any = DATABASE_URL ? drizzle(neon(DATABASE_URL), { schema }) : null

const ORIGIN = 'https://wedance.test'
const RESOURCE = `${ORIGIN}/mcp`
const REDIRECT = 'https://client.example/callback'
const tag = `oauth-${Date.now()}`
const ids: Record<'alex' | 'mia' | 'admin', string> = {} as any
const pages: Record<'montuno' | 'laclave' | 'foreign', { id: string; username: string }> = {} as any
const clientIds: string[] = []

const pkce = () => {
  const verifier = randomBytes(48).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}
const authParams = (clientId: string, challenge: string, extra: Record<string, string> = {}) => ({
  response_type: 'code', client_id: clientId, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256', state: 'st-1', resource: RESOURCE, ...extra,
})

async function newClient(extra: Record<string, unknown> = {}) {
  const c = await registerClient(db, { client_name: `${tag} app`, redirect_uris: [REDIRECT], ...extra })
  clientIds.push(c.client_id)
  return c
}

/** The whole dance for one dancer: consent → code. */
async function consent(dancerId: string, clientId: string, scopes: string[], profileIds: string[] = [], isAdmin = false) {
  const { verifier, challenge } = pkce()
  const v = await validateAuthorizeRequest(db, authParams(clientId, challenge, { scope: scopes.join(' ') }), ORIGIN)
  if (!v.ok) throw new Error(`authorize failed: ${JSON.stringify(v)}`)
  const { redirect } = await approveConsent(db, { token: consentToken(v.request, dancerId), dancerId, isAdmin, scopes, profileIds, origin: ORIGIN })
  const u = new URL(redirect)
  return { code: u.searchParams.get('code')!, verifier, redirect: u }
}

async function tokensFor(dancerId: string, scopes: string[], profileIds: string[] = [], opts: { isAdmin?: boolean; extra?: Record<string, unknown> } = {}) {
  const c = await newClient(opts.extra)
  const client = (await resolveClient(db, c.client_id))!
  const { code, verifier } = await consent(dancerId, c.client_id, scopes, profileIds, opts.isAdmin)
  const t = await exchangeCode(db, client, { code, redirect_uri: REDIRECT, code_verifier: verifier, resource: RESOURCE })
  return { client, t }
}

const scopedCaller = async (accessToken: string) => {
  const auth = (await resolveAccessToken(db, accessToken, RESOURCE))!
  return appRouter.createCaller({ db, dancerId: auth.dancerId, isAdmin: auth.isAdmin, scopes: auth.scopes, grantedProfileIds: auth.grantedProfileIds, oauthClientId: auth.clientId, oauthGrantId: auth.grantId } as any)
}

describe.skipIf(!DATABASE_URL)('OAuth server (DB)', () => {
  beforeAll(async () => {
    const rows = await db.insert(schema.dancers).values([
      { email: `${tag}-alex@test.local`, name: 'Alex' },
      { email: `${tag}-mia@test.local`, name: 'Mia' },
      { email: `${tag}-admin@test.local`, name: 'Admin', isAdmin: true },
    ]).returning({ id: schema.dancers.id })
    ids.alex = rows[0].id; ids.mia = rows[1].id; ids.admin = rows[2].id
    const web = appRouter.createCaller({ db, dancerId: ids.alex, isAdmin: false } as any)
    for (const [k, name] of [['montuno', 'Montuno'], ['laclave', 'La Clave']] as const) {
      const { username } = await web.business.create({ type: 'organizer', name: `${tag} ${name}`, city: 'Munich' })
      const [p] = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.username, username))
      pages[k] = { id: p.id, username }
    }
    const { username } = await appRouter.createCaller({ db, dancerId: ids.mia, isAdmin: false } as any).business.create({ type: 'organizer', name: `${tag} Foreign`, city: 'Munich' })
    const [p] = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.username, username))
    pages.foreign = { id: p.id, username }
  })

  afterAll(async () => {
    await db.delete(schema.events).where(like(schema.events.name, `${tag}%`))
    await db.delete(schema.profiles).where(inArray(schema.profiles.username, Object.values(pages).map(p => p.username)))
    if (clientIds.length) await db.delete(schema.oauthClients).where(inArray(schema.oauthClients.id, clientIds))
    await db.delete(schema.mcpAudit).where(inArray(schema.mcpAudit.dancerId, Object.values(ids)))
    await db.delete(schema.dancers).where(inArray(schema.dancers.id, Object.values(ids)))
  })

  describe('client registration', () => {
    it('public clients: client_id only; confidential: the secret, checked against its hash', async () => {
      const pub = await newClient()
      expect(pub.client_secret).toBeUndefined()
      expect((await authenticateClient(db, { client_id: pub.client_id }, null)).id).toBe(pub.client_id)
      await expect(authenticateClient(db, { client_id: pub.client_id, client_secret: 'x' }, null)).rejects.toThrow(OAuthError)

      const conf = await newClient({ token_endpoint_auth_method: 'client_secret_basic' })
      expect(conf.client_secret).toMatch(/^wds_/)
      const [row] = await db.select().from(schema.oauthClients).where(eq(schema.oauthClients.id, conf.client_id))
      expect(row.clientSecretHash).toBe(sha256Hex(conf.client_secret!))
      expect(JSON.stringify(row)).not.toContain(conf.client_secret)
      const basic = `Basic ${Buffer.from(`${conf.client_id}:${conf.client_secret}`).toString('base64')}`
      expect((await authenticateClient(db, {}, basic)).id).toBe(conf.client_id)
      await expect(authenticateClient(db, { client_id: conf.client_id, client_secret: 'wrong' }, null)).rejects.toThrow(/authentication failed/)
      await expect(authenticateClient(db, { client_id: conf.client_id }, null)).rejects.toThrow(/authentication failed/)
    })

    it('rejects bad registrations', async () => {
      await expect(registerClient(db, { redirect_uris: ['javascript:alert(1)'] })).rejects.toThrow(OAuthError)
      await expect(registerClient(db, { redirect_uris: [] })).rejects.toThrow(OAuthError)
      await expect(registerClient(db, { redirect_uris: [REDIRECT], grant_types: ['client_credentials'] })).rejects.toThrow(OAuthError)
    })

    it('Client ID Metadata Documents are fetched once, cached, and validated', async () => {
      const id = `https://${tag}.example/client.json`
      clientIds.push(id)
      let fetches = 0
      const fetchDocument = async () => { fetches++; return { client_id: id, client_name: 'Doc App', redirect_uris: [REDIRECT] } }
      const c = await resolveClient(db, id, { fetchDocument })
      expect(c).toMatchObject({ id, kind: 'cimd', name: 'Doc App', tokenEndpointAuthMethod: 'none' })
      await resolveClient(db, id, { fetchDocument })
      expect(fetches).toBe(1)
      await resolveClient(db, id, { fetchDocument, now: Date.now() + 2 * 3600_000 })
      expect(fetches).toBe(2)
      await expect(resolveClient(db, `https://${tag}-bad.example/c.json`, { fetchDocument: async () => ({ client_id: 'https://other.example/c.json', redirect_uris: [REDIRECT] }) })).rejects.toThrow(/does not match/)
      expect(await resolveClient(db, 'https://127.0.0.1/client.json', { fetchDocument })).toBeNull()
    })
  })

  describe('authorize', () => {
    it('never redirects for an unknown client or an unregistered redirect_uri', async () => {
      const c = await newClient()
      const { challenge } = pkce()
      expect(await validateAuthorizeRequest(db, authParams('wdcl_nope', challenge), ORIGIN)).toMatchObject({ ok: false, fatal: true })
      expect(await validateAuthorizeRequest(db, { ...authParams(c.client_id, challenge), redirect_uri: 'https://evil.example/cb' }, ORIGIN)).toMatchObject({ ok: false, fatal: true })
    })
    it('sends other errors back to the app: PKCE required, S256 only, resource required and bound', async () => {
      const c = await newClient()
      const { challenge } = pkce()
      const back = async (p: any) => {
        const r: any = await validateAuthorizeRequest(db, p, ORIGIN)
        expect(r.ok).toBe(false)
        expect(r.fatal).toBe(false)
        const u = new URL(r.redirect)
        expect(u.origin + u.pathname).toBe(REDIRECT)
        expect(u.searchParams.get('state')).toBe('st-1')
        return u.searchParams.get('error')
      }
      expect(await back({ ...authParams(c.client_id, challenge), code_challenge: undefined })).toBe('invalid_request')
      expect(await back({ ...authParams(c.client_id, challenge), code_challenge_method: 'plain' })).toBe('invalid_request')
      expect(await back({ ...authParams(c.client_id, challenge), resource: undefined })).toBe('invalid_target')
      expect(await back({ ...authParams(c.client_id, challenge), resource: 'https://evil.example/mcp' })).toBe('invalid_target')
      expect(await back({ ...authParams(c.client_id, challenge), response_type: 'token' })).toBe('unsupported_response_type')
    })
    it('consent: profiles limited to the dancer’s own pages; the request token is bound to the dancer', async () => {
      const c = await newClient()
      const { challenge } = pkce()
      const v: any = await validateAuthorizeRequest(db, authParams(c.client_id, challenge, { scope: 'business:read' }), ORIGIN)
      const token = consentToken(v.request, ids.alex)
      await expect(approveConsent(db, { token, dancerId: ids.mia, isAdmin: false, scopes: ['business:read'], profileIds: [], origin: ORIGIN })).rejects.toThrow(/another account/)
      const { grantId } = await approveConsent(db, { token, dancerId: ids.alex, isAdmin: false, scopes: ['business:read', 'business:publish'], profileIds: [pages.montuno.id, pages.foreign.id], origin: ORIGIN })
      const [g] = await db.select().from(schema.oauthGrants).where(eq(schema.oauthGrants.id, grantId))
      expect(g.profileIds).toEqual([pages.montuno.id]) // Mia's page dropped
      expect(g.scopes).toEqual(['business:read']) // more than asked for is dropped
      expect(new URL(denyConsent({ token, dancerId: ids.alex, origin: ORIGIN }).redirect).searchParams.get('error')).toBe('access_denied')
    })
  })

  describe('tokens', () => {
    it('code is single use; reuse revokes what it issued', async () => {
      const c = await newClient()
      const client = (await resolveClient(db, c.client_id))!
      const { code, verifier } = await consent(ids.alex, c.client_id, ['me:read'])
      const t = await exchangeCode(db, client, { code, redirect_uri: REDIRECT, code_verifier: verifier })
      expect(t).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'me:read' })
      expect(await resolveAccessToken(db, t.access_token, RESOURCE)).not.toBeNull()
      await expect(exchangeCode(db, client, { code, redirect_uri: REDIRECT, code_verifier: verifier })).rejects.toThrow(/already used/)
      expect(await resolveAccessToken(db, t.access_token, RESOURCE)).toBeNull()
    })
    it('code checks: PKCE verifier, redirect_uri, client, expiry', async () => {
      const c = await newClient()
      const other = (await resolveClient(db, (await newClient()).client_id))!
      const client = (await resolveClient(db, c.client_id))!
      const a = await consent(ids.alex, c.client_id, ['me:read'])
      await expect(exchangeCode(db, client, { code: a.code, redirect_uri: REDIRECT, code_verifier: pkce().verifier })).rejects.toThrow(/PKCE/)
      const b = await consent(ids.alex, c.client_id, ['me:read'])
      await expect(exchangeCode(db, client, { code: b.code, redirect_uri: `${REDIRECT}/x`, code_verifier: b.verifier })).rejects.toThrow(/redirect_uri/)
      const d = await consent(ids.alex, c.client_id, ['me:read'])
      await expect(exchangeCode(db, other, { code: d.code, redirect_uri: REDIRECT, code_verifier: d.verifier })).rejects.toThrow(/another client/)
      const e = await consent(ids.alex, c.client_id, ['me:read'])
      await expect(exchangeCode(db, client, { code: e.code, redirect_uri: REDIRECT, code_verifier: e.verifier }, Date.now() + 6 * 60_000)).rejects.toThrow(/expired/)
      const f = await consent(ids.alex, c.client_id, ['me:read'])
      await expect(exchangeCode(db, client, { code: f.code, redirect_uri: REDIRECT, code_verifier: f.verifier, resource: 'https://other.example/mcp' })).rejects.toThrow(/resource/)
    })
    it('tokens are stored hashed', async () => {
      const { t } = await tokensFor(ids.alex, ['me:read'])
      const rows = await db.select().from(schema.oauthTokens).where(inArray(schema.oauthTokens.tokenHash, [sha256Hex(t.access_token), sha256Hex(t.refresh_token)]))
      expect(rows).toHaveLength(2)
      expect(JSON.stringify(rows)).not.toContain(t.access_token)
      expect(JSON.stringify(rows)).not.toContain(t.refresh_token)
    })
    it('audience binding: a token works only for the resource it was issued for', async () => {
      const { t } = await tokensFor(ids.alex, ['me:read'])
      expect(await resolveAccessToken(db, t.access_token, RESOURCE)).toMatchObject({ dancerId: ids.alex, scopes: ['me:read'] })
      expect(await resolveAccessToken(db, t.access_token, 'https://other.example/mcp')).toBeNull()
      expect(await resolveAccessToken(db, t.access_token, null)).toBeNull()
      expect(await resolveAccessToken(db, t.access_token, RESOURCE, Date.now() + 3601_000)).toBeNull()
      expect(await resolveAccessToken(db, t.refresh_token, RESOURCE)).toBeNull()
    })
    it('refresh rotates; presenting a spent refresh token revokes the whole grant', async () => {
      const { client, t } = await tokensFor(ids.alex, ['me:read', 'plan:write'])
      const r1 = await refreshTokens(db, client, { refresh_token: t.refresh_token })
      expect(r1.refresh_token).not.toBe(t.refresh_token)
      const narrowed = await refreshTokens(db, client, { refresh_token: r1.refresh_token, scope: 'me:read' })
      expect(narrowed.scope).toBe('me:read')
      await expect(refreshTokens(db, client, { refresh_token: narrowed.refresh_token, scope: 'plan:write' })).rejects.toThrow(/exceeds/)
      // The old one again: reuse.
      await expect(refreshTokens(db, client, { refresh_token: t.refresh_token })).rejects.toThrow(/already used/)
      expect(await resolveAccessToken(db, narrowed.access_token, RESOURCE)).toBeNull()
      const [g] = await db.select().from(schema.oauthGrants).innerJoin(schema.oauthTokens, eq(schema.oauthTokens.grantId, schema.oauthGrants.id)).where(eq(schema.oauthTokens.tokenHash, sha256Hex(t.access_token)))
      expect(g.oauth_grants.revokedReason).toBe('refresh_token_reuse')
    })
    it('revocation endpoint: refresh revokes the grant’s tokens, other clients’ tokens untouched', async () => {
      const { client, t } = await tokensFor(ids.alex, ['me:read'])
      const stranger = (await resolveClient(db, (await newClient()).client_id))!
      await revokeToken(db, stranger, t.refresh_token)
      expect(await resolveAccessToken(db, t.access_token, RESOURCE)).not.toBeNull()
      await revokeToken(db, client, t.refresh_token)
      expect(await resolveAccessToken(db, t.access_token, RESOURCE)).toBeNull()
    })
    it('connections page revoke ends every token of the grant', async () => {
      const { t } = await tokensFor(ids.alex, ['me:read'])
      const web = appRouter.createCaller({ db, dancerId: ids.alex, isAdmin: false } as any)
      const conns = await web.oauth.connections()
      const auth = (await resolveAccessToken(db, t.access_token, RESOURCE))!
      expect(conns.some((c: any) => c.id === auth.grantId)).toBe(true)
      await expect(appRouter.createCaller({ db, dancerId: ids.mia, isAdmin: false } as any).oauth.revokeConnection({ id: auth.grantId })).rejects.toThrow(/gone/)
      await web.oauth.revokeConnection({ id: auth.grantId })
      expect(await resolveAccessToken(db, t.access_token, RESOURCE)).toBeNull()
    })
  })

  describe('admin allowlist', () => {
    it('admin needs a WeDance admin AND an allowlisted client', async () => {
      const prev = process.env.MCP_ADMIN_CLIENT_IDS
      try {
        // Not allowlisted: admin is dropped at authorize time.
        process.env.MCP_ADMIN_CLIENT_IDS = ''
        const plain = await tokensFor(ids.admin, ['me:read', 'admin'], [], { isAdmin: true })
        expect(plain.t.scope).toBe('me:read')
        // Allowlisted client, admin dancer: admin survives.
        const c = await newClient()
        process.env.MCP_ADMIN_CLIENT_IDS = c.client_id
        const client = (await resolveClient(db, c.client_id))!
        const { code, verifier } = await consent(ids.admin, c.client_id, ['me:read', 'admin'], [], true)
        const t = await exchangeCode(db, client, { code, redirect_uri: REDIRECT, code_verifier: verifier })
        expect(await resolveAccessToken(db, t.access_token, RESOURCE)).toMatchObject({ isAdmin: true, scopes: ['me:read', 'admin'] })
        // Same allowlisted client, non-admin dancer: no admin.
        const m = await consent(ids.mia, c.client_id, ['me:read', 'admin'], [], false)
        const tm = await exchangeCode(db, client, { code: m.code, redirect_uri: REDIRECT, code_verifier: m.verifier })
        expect(tm.scope).toBe('me:read')
        // Client later removed from the allowlist: the live token loses admin.
        process.env.MCP_ADMIN_CLIENT_IDS = ''
        expect(await resolveAccessToken(db, t.access_token, RESOURCE)).toMatchObject({ isAdmin: false, scopes: ['me:read'] })
      } finally {
        process.env.MCP_ADMIN_CLIENT_IDS = prev
      }
    })
  })

  describe('grant enforcement inside tRPC', () => {
    it('an app acts only for the pages it was given', async () => {
      const { t } = await tokensFor(ids.alex, ['business:publish'], [pages.montuno.id])
      const app = await scopedCaller(t.access_token)
      expect((await app.business.myProfiles()).managed.map((p: any) => p.username)).toEqual([pages.montuno.username])
      await app.business.update({ username: pages.montuno.username, bio: 'From Claude' })
      await expect(app.business.update({ username: pages.laclave.username, bio: 'x' })).rejects.toThrow(/wasn’t given access/)
      await expect(app.businessTeam.team({ username: pages.laclave.username })).rejects.toThrow(/wasn’t given access/)
      const { id } = await app.businessEvents.create({ hostUsername: pages.montuno.username, name: `${tag} Sunday class`, type: 'Course', date: '2031-03-02', startTime: '18:00' } as any)
      await expect(app.businessEvents.create({ hostUsername: pages.laclave.username, name: `${tag} x`, type: 'Party', date: '2031-03-02', startTime: '20:00' } as any)).rejects.toThrow(/wasn’t given access/)
      // An event of a page that wasn't granted can't be managed either.
      const { id: other } = await appRouter.createCaller({ db, dancerId: ids.alex, isAdmin: false } as any).businessEvents.create({ hostUsername: pages.laclave.username, name: `${tag} La Clave night`, type: 'Party', date: '2031-03-05', startTime: '21:00' } as any)
      await expect(app.businessEvents.get({ id: other })).rejects.toThrow(/wasn’t given access/)
      await expect(app.businessEvents.archive({ id: other })).rejects.toThrow(/wasn’t given access/)
      expect((await app.businessEvents.get({ id })).name).toBe(`${tag} Sunday class`)
      // The web session still sees and manages both.
      const web = appRouter.createCaller({ db, dancerId: ids.alex, isAdmin: false } as any)
      expect((await web.business.myProfiles()).managed).toHaveLength(2)
    })
    it('publishing through tRPC needs business:publish, not just business:write', async () => {
      const { t } = await tokensFor(ids.alex, ['business:write'], [pages.montuno.id])
      const app = await scopedCaller(t.access_token)
      await expect(app.businessEvents.create({ hostUsername: pages.montuno.username, name: `${tag} live`, type: 'Party', date: '2031-04-01', startTime: '20:00', published: true } as any)).rejects.toThrow(/business:publish/)
      const { id } = await app.businessEvents.create({ hostUsername: pages.montuno.username, name: `${tag} draft`, type: 'Party', date: '2031-04-01', startTime: '20:00' } as any)
      const cur: any = await app.businessEvents.get({ id })
      await expect(app.businessEvents.update({ ...cur, id, published: true } as any)).rejects.toThrow(/business:publish/)
      await expect(app.business.update({ username: pages.montuno.username, bio: 'x' })).rejects.toThrow(/business:publish/)
    })
  })

  describe('MCP tool calls', () => {
    it('publish tools: preview → confirm_token → commit, single use, audited', async () => {
      const { t } = await tokensFor(ids.alex, ['business:publish'], [pages.montuno.id])
      const auth = (await resolveAccessToken(db, t.access_token, RESOURCE))!
      const ctx: any = { db, dancerId: auth.dancerId, isAdmin: false, scopes: auth.scopes, grantedProfileIds: auth.grantedProfileIds, oauthClientId: auth.clientId, oauthGrantId: auth.grantId }
      const tc = { caller: appRouter.createCaller(ctx), ctx, origin: ORIGIN }
      const created: any = await tc.caller.businessEvents.create({ hostUsername: pages.montuno.username, name: `${tag} Taster`, type: 'Workshop', date: '2031-05-04', startTime: '18:00' } as any)
      const tool = TOOL_BY_NAME.get('publish_event')!
      const preview = await callTool(tool, { event_id: created.id }, tc)
      const text = preview.content[0]!.text
      expect(text).toContain('needs_confirmation')
      expect((await tc.caller.businessEvents.get({ id: created.id })).published).toBe(false)
      const token = text.match(/"confirm_token": "([^"]+)"/)![1]!
      expect((await callTool(tool, { event_id: created.id, published: false, confirm_token: token }, tc)).isError).toBe(true) // changed args
      const done = await callTool(tool, { event_id: created.id, confirm_token: token }, tc)
      expect(done.isError).toBeFalsy()
      expect((await tc.caller.businessEvents.get({ id: created.id })).published).toBe(true)
      const again = await callTool(tool, { event_id: created.id, confirm_token: token }, tc)
      expect(again.content[0]!.text).toMatch(/already used/)
      const audit = await db.select().from(schema.mcpAudit).where(eq(schema.mcpAudit.grantId, auth.grantId))
      expect(audit.map((a: any) => a.result).sort()).toEqual(['denied', 'ok', 'preview'])
      expect(audit.find((a: any) => a.result === 'ok').profileId).toBe(pages.montuno.id)
      expect(JSON.stringify(audit)).not.toContain(token)
      // The page's team sees what the app did.
      const log = await appRouter.createCaller({ db, dancerId: ids.alex, isAdmin: false } as any).oauth.auditForProfile({ username: pages.montuno.username })
      expect(log.some((l: any) => l.tool === 'publish_event' && l.result === 'ok')).toBe(true)
    })
    it('a tool outside the token’s scopes is refused even when called directly', async () => {
      const { t } = await tokensFor(ids.alex, ['me:read'])
      const auth = (await resolveAccessToken(db, t.access_token, RESOURCE))!
      const ctx: any = { db, dancerId: auth.dancerId, isAdmin: false, scopes: auth.scopes, grantedProfileIds: [], oauthGrantId: auth.grantId, oauthClientId: auth.clientId }
      const res = await callTool(TOOL_BY_NAME.get('add_to_plan')!, { kind: 'event', id: 'x' }, { caller: appRouter.createCaller(ctx), ctx, origin: ORIGIN })
      expect(res.isError).toBe(true)
      expect(res.content[0]!.text).toMatch(/insufficient_scope/)
    })
  })
})
