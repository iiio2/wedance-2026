import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createHash, randomBytes } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, inArray, like } from 'drizzle-orm'
import * as schema from '../database/schema'
import { appRouter } from '../trpc'
import { registerClient, resolveClient } from './clients'
import { validateAuthorizeRequest, approveConsent, consentToken } from './authorize'
import { exchangeCode, resolveAccessToken } from './tokens'
import { addProfileToOwnGrant } from './grants'
import { callTool } from '../mcp/server'
import { TOOL_BY_NAME } from '../mcp/tools'

// #447: a page made through a connected app joins that app's grant; pages that
// already existed still need a tick on the consent screen. Local Postgres only:
//   DATABASE_URL=postgresql://dev:dev@localhost:5441/wedance NEON_FETCH_ENDPOINT=http://localhost:4444/sql bunx vitest run server/oauth/grants.db.test.ts
const DATABASE_URL = process.env.DATABASE_URL
const db: any = DATABASE_URL ? drizzle(neon(DATABASE_URL), { schema }) : null

vi.stubGlobal('useRuntimeConfig', () => ({ siteUrl: 'http://localhost:3000', resendApiKey: '' }))

const ORIGIN = 'https://wedance.test'
const RESOURCE = `${ORIGIN}/mcp`
const REDIRECT = 'https://client.example/callback'
const tag = `grant447-${Date.now()}`
const ig = tag.replace(/-/g, '_') // Instagram handles: letters, digits, _ and .
const ids: Record<'alex' | 'mia', string> = {} as any
const pages: Record<'existing' | 'other' | 'foreign', { id: string; username: string }> = {} as any
const clientIds: string[] = []
const madeHandles: string[] = []

/** Connect an app for a dancer the real way (consent → code → token) and return its MCP context. */
async function connect(dancerId: string, scopes: string[], profileIds: string[], allProfiles = false) {
  const c = await registerClient(db, { client_name: `${tag} app`, redirect_uris: [REDIRECT] })
  clientIds.push(c.client_id)
  const client = (await resolveClient(db, c.client_id))!
  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const v = await validateAuthorizeRequest(db, { response_type: 'code', client_id: c.client_id, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256', state: 's', resource: RESOURCE, scope: scopes.join(' ') }, ORIGIN)
  if (!v.ok) throw new Error(`authorize failed: ${JSON.stringify(v)}`)
  const { redirect } = await approveConsent(db, { token: consentToken(v.request, dancerId), dancerId, isAdmin: false, scopes, profileIds, allProfiles, origin: ORIGIN })
  const t = await exchangeCode(db, client, { code: new URL(redirect).searchParams.get('code')!, redirect_uri: REDIRECT, code_verifier: verifier, resource: RESOURCE })
  return { token: t.access_token, request: () => request(t.access_token) }
}

/** One MCP request: the token is resolved afresh, exactly as server/trpc/context.ts does. */
async function request(token: string) {
  const auth = (await resolveAccessToken(db, token, RESOURCE))!
  const ctx: any = { db, dancerId: auth.dancerId, isAdmin: auth.isAdmin, scopes: auth.scopes, grantedProfileIds: auth.grantedProfileIds, oauthClientId: auth.clientId, oauthGrantId: auth.grantId, origin: ORIGIN }
  return { caller: appRouter.createCaller(ctx), ctx, origin: ORIGIN }
}
const json = (r: any) => {
  const text = r.content[0].text as string
  return JSON.parse(text.slice(text.indexOf('<wedance-data>') + 15, text.lastIndexOf('</wedance-data>')))
}
const tool = (name: string) => TOOL_BY_NAME.get(name)!

describe.skipIf(!DATABASE_URL)('pages made through a connected app join its grant (#447)', () => {
  beforeAll(async () => {
    const rows = await db.insert(schema.dancers).values([
      { email: `${tag}-alex@test.local`, name: 'Alex' },
      { email: `${tag}-mia@test.local`, name: 'Mia' },
    ]).returning({ id: schema.dancers.id })
    ids.alex = rows[0].id; ids.mia = rows[1].id
    const mk = async (dancerId: string, name: string) => {
      const { username } = await appRouter.createCaller({ db, dancerId, isAdmin: false } as any).business.create({ type: 'organizer', name: `${tag} ${name}`, city: 'Munich' })
      const [p] = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.username, username))
      return { id: p.id, username }
    }
    pages.existing = await mk(ids.alex, 'Existing')
    pages.other = await mk(ids.alex, 'Other')
    pages.foreign = await mk(ids.mia, 'Foreign')
  })

  afterAll(async () => {
    const handles = [...Object.values(pages).map(p => p.username), ...madeHandles]
    await db.delete(schema.events).where(like(schema.events.name, `${tag}%`))
    await db.delete(schema.profiles).where(inArray(schema.profiles.username, handles))
    if (clientIds.length) await db.delete(schema.oauthClients).where(inArray(schema.oauthClients.id, clientIds))
    await db.delete(schema.mcpAudit).where(inArray(schema.mcpAudit.dancerId, Object.values(ids)))
    await db.delete(schema.dancers).where(inArray(schema.dancers.id, Object.values(ids)))
  })

  it('create_my_page → create_event → get_my_event in the same connection, no reconnect', async () => {
    const app = await connect(ids.alex, ['business:read', 'business:write'], [])
    // Connected with no pages: the tool to make the first one is still there.
    const made = json(await callTool(tool('create_my_page'), { type: 'organizer', name: `${tag} B-Fest`, city: 'Berlin', instagram: `${ig}fest` }, await app.request()))
    madeHandles.push(made.handle)
    // Next request: the token resolves to a grant that now names the new page.
    const t = await app.request()
    const [p] = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.username, made.handle))
    expect(t.ctx.grantedProfileIds).toEqual([p.id])
    const ev = await callTool(tool('create_event'), { profile: made.handle, name: `${tag} Festival night`, type: 'Party', date: '2031-06-06', start_time: '21:00' }, t)
    expect(ev.isError, JSON.stringify(ev)).toBeFalsy()
    const got = await callTool(tool('get_my_event'), { event_id: json(ev).id }, await app.request())
    expect(got.isError, JSON.stringify(got)).toBeFalsy()
    expect(json(got).name).toBe(`${tag} Festival night`)
    // The dancer owns it, and the app still can't touch the page it was never given.
    const [m] = await db.select({ role: schema.profileMembers.role }).from(schema.profileMembers).where(eq(schema.profileMembers.profileId, p.id))
    expect(m.role).toBe('owner')
    await expect((await app.request()).caller.businessEvents.create({ hostUsername: pages.existing.username, name: `${tag} nope`, type: 'Party', date: '2031-06-07', startTime: '20:00' } as any)).rejects.toThrow(/wasn’t given access/)
  })

  it('add_profile_from_instagram then create_my_page with that account: the page becomes theirs and usable', async () => {
    const app = await connect(ids.alex, ['business:read', 'business:write'], [pages.existing.id])
    const added = json(await callTool(tool('add_profile_from_instagram'), { instagram: `${ig}x`, type: 'organizer' }, await app.request()))
    madeHandles.push(added.username)
    // Added for a line-up: not the dancer's page, so not usable as a host.
    await expect((await app.request()).caller.businessEvents.create({ hostUsername: added.username, name: `${tag} early`, type: 'Party', date: '2031-06-08', startTime: '20:00' } as any)).rejects.toThrow()
    const made = json(await callTool(tool('create_my_page'), { type: 'organizer', name: `${tag} X Fest`, instagram: `${ig}x` }, await app.request()))
    expect(made.handle).toBe(added.username)
    const t = await app.request()
    const [p] = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.username, added.username))
    expect(t.ctx.grantedProfileIds.sort()).toEqual([pages.existing.id, p.id].sort())
    const ev = await callTool(tool('create_event'), { profile: added.username, name: `${tag} X night`, type: 'Party', date: '2031-06-09', start_time: '21:00' }, t)
    expect(ev.isError, JSON.stringify(ev)).toBeFalsy()
  })

  it('a pre-existing page the dancer runs but did not tick stays refused', async () => {
    // Ticked "Other" only; "Existing" is Alex's too but was left unticked.
    const app = await connect(ids.alex, ['business:read', 'business:write'], [pages.other.id])
    const t = await app.request()
    expect(t.ctx.grantedProfileIds).toEqual([pages.other.id])
    const ev = await callTool(tool('create_event'), { profile: pages.existing.username, name: `${tag} sneaky`, type: 'Party', date: '2031-06-10', start_time: '21:00' }, t)
    expect(ev.isError).toBe(true)
    expect(JSON.stringify(ev)).toMatch(/wasn’t given access/)
    // Making another page through the app adds only that one.
    const made = json(await callTool(tool('create_my_page'), { type: 'venue', name: `${tag} Hall` }, await app.request()))
    madeHandles.push(made.handle)
    const after = await app.request()
    expect(after.ctx.grantedProfileIds).toHaveLength(2)
    expect(after.ctx.grantedProfileIds).not.toContain(pages.existing.id)
    expect((await callTool(tool('create_event'), { profile: pages.existing.username, name: `${tag} sneaky 2`, type: 'Party', date: '2031-06-10', start_time: '21:00' }, after)).isError).toBe(true)
  })

  it('never adds a page the dancer does not run, nor to someone else’s grant, nor for web sessions', async () => {
    const app = await connect(ids.alex, ['business:read', 'business:write'], [])
    const t = await app.request()
    // Mia's page: Alex isn't on its team.
    expect(await addProfileToOwnGrant(t.ctx, pages.foreign.id)).toBe(false)
    expect((await app.request()).ctx.grantedProfileIds).toEqual([])
    // Mia's request with Alex's grant id (mismatched owner): refused.
    const miaCtx = { db, dancerId: ids.mia, oauthGrantId: t.ctx.oauthGrantId, grantedProfileIds: [] as string[] }
    expect(await addProfileToOwnGrant(miaCtx, pages.foreign.id)).toBe(false)
    expect((await app.request()).ctx.grantedProfileIds).toEqual([])
    // Web session: no grant to change.
    expect(await addProfileToOwnGrant({ db, dancerId: ids.alex, grantedProfileIds: null }, pages.existing.id)).toBe(false)
  })

  it('a page taken over twice is listed once; a revoked grant gets nothing', async () => {
    const app = await connect(ids.alex, ['business:read', 'business:write'], [])
    const t = await app.request()
    expect(await addProfileToOwnGrant(t.ctx, pages.existing.id)).toBe(true)
    const t2 = await app.request()
    expect(await addProfileToOwnGrant({ ...t2.ctx, grantedProfileIds: [] }, pages.existing.id)).toBe(true)
    expect((await app.request()).ctx.grantedProfileIds).toEqual([pages.existing.id])
    await db.update(schema.oauthGrants).set({ revokedAt: new Date() }).where(eq(schema.oauthGrants.id, t.ctx.oauthGrantId))
    const app2 = await connect(ids.alex, ['business:read', 'business:write'], [])
    const t3 = await app2.request()
    await db.update(schema.oauthGrants).set({ revokedAt: new Date() }).where(eq(schema.oauthGrants.id, t3.ctx.oauthGrantId))
    expect(await addProfileToOwnGrant(t3.ctx, pages.existing.id)).toBe(false)
  })

  it('"All my pages" covers every page the dancer runs, including one gained after connecting (#457)', async () => {
    const app = await connect(ids.alex, ['business:read', 'business:write'], [], true)
    const [g] = await db.select({ all: schema.oauthGrants.allProfiles }).from(schema.oauthGrants).where(eq(schema.oauthGrants.id, (await app.request()).ctx.oauthGrantId))
    expect(g.all).toBe(true)
    const t = await app.request()
    expect(t.ctx.grantedProfileIds).toEqual(expect.arrayContaining([pages.existing.id, pages.other.id]))
    expect(t.ctx.grantedProfileIds).not.toContain(pages.foreign.id)
    // A page made on the website after the grant (not through the app): covered on the next request.
    const { username } = await appRouter.createCaller({ db, dancerId: ids.alex, isAdmin: false } as any).business.create({ type: 'venue', name: `${tag} Later`, city: 'Munich' })
    madeHandles.push(username)
    const [later] = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.username, username))
    const after = await app.request()
    expect(after.ctx.grantedProfileIds).toContain(later.id)
    const ev = await callTool(tool('create_event'), { profile: username, name: `${tag} Later night`, type: 'Party', date: '2031-06-11', start_time: '21:00' }, after)
    expect(ev.isError, JSON.stringify(ev)).toBeFalsy()
    // Still never someone else's page.
    expect((await callTool(tool('create_event'), { profile: pages.foreign.username, name: `${tag} foreign`, type: 'Party', date: '2031-06-11', start_time: '21:00' }, after)).isError).toBe(true)
  })

  it('"All my pages" without a business permission grants no pages', async () => {
    const app = await connect(ids.alex, ['me:read'], [], true)
    const t = await app.request()
    const [g] = await db.select({ all: schema.oauthGrants.allProfiles }).from(schema.oauthGrants).where(eq(schema.oauthGrants.id, t.ctx.oauthGrantId))
    expect(g.all).toBe(false)
    expect(t.ctx.grantedProfileIds).toEqual([])
  })
})
