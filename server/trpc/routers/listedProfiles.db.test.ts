import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { createHash, randomBytes } from 'node:crypto'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, inArray, like } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { appRouter } from '..'
import { registerClient, resolveClient } from '../../oauth/clients'
import { validateAuthorizeRequest, approveConsent, consentToken } from '../../oauth/authorize'
import { exchangeCode, resolveAccessToken } from '../../oauth/tokens'
import { callTool } from '../../mcp/server'
import { TOOL_BY_NAME } from '../../mcp/tools'

// #454: an unclaimed page the user added through the app (or that is on one of
// their events) can be completed through the app; claimed pages can't, and
// "you don't manage this page" is no longer reported as "reconnect and tick".
// Local Postgres only:
//   DATABASE_URL=postgresql://dev:dev@localhost:5441/wedance NEON_FETCH_ENDPOINT=http://localhost:4444/sql bunx vitest run server/trpc/routers/listedProfiles.db.test.ts
const DATABASE_URL = process.env.DATABASE_URL
const db: any = DATABASE_URL ? drizzle(neon(DATABASE_URL), { schema }) : null

vi.stubGlobal('useRuntimeConfig', () => ({ siteUrl: 'http://localhost:3000', resendApiKey: '' }))
const REHOSTED = 'https://res.cloudinary.com/wedance-test/image/upload/wedance-2026/profiles/x.jpg'
const rehost = vi.hoisted(() => vi.fn(async (_url: string) => 'https://res.cloudinary.com/wedance-test/image/upload/wedance-2026/profiles/x.jpg'))
vi.mock('../../utils/rehostImage', () => ({ rehostImage: rehost }))

const ORIGIN = 'https://wedance.test'
const RESOURCE = `${ORIGIN}/mcp`
const REDIRECT = 'https://client.example/callback'
const tag = `listed454-${Date.now()}`
const ig = tag.replace(/-/g, '_')
const ids: Record<'alex' | 'mia' | 'sam', string> = {} as any
const pages: Record<'alexOrg' | 'miaOrg' | 'samOrg', { id: string; username: string }> = {} as any
const clientIds: string[] = []
const madeHandles: string[] = []

async function connect(dancerId: string, scopes: string[], profileIds: string[]) {
  const c = await registerClient(db, { client_name: `${tag} app`, redirect_uris: [REDIRECT] })
  clientIds.push(c.client_id)
  const client = (await resolveClient(db, c.client_id))!
  const verifier = randomBytes(48).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  const v = await validateAuthorizeRequest(db, { response_type: 'code', client_id: c.client_id, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256', state: 's', resource: RESOURCE, scope: scopes.join(' ') }, ORIGIN)
  if (!v.ok) throw new Error(`authorize failed: ${JSON.stringify(v)}`)
  const { redirect } = await approveConsent(db, { token: consentToken(v.request, dancerId), dancerId, isAdmin: false, scopes, profileIds, origin: ORIGIN })
  const t = await exchangeCode(db, client, { code: new URL(redirect).searchParams.get('code')!, redirect_uri: REDIRECT, code_verifier: verifier, resource: RESOURCE })
  return async () => {
    const auth = (await resolveAccessToken(db, t.access_token, RESOURCE))!
    const ctx: any = { db, dancerId: auth.dancerId, isAdmin: auth.isAdmin, scopes: auth.scopes, grantedProfileIds: auth.grantedProfileIds, oauthClientId: auth.clientId, oauthGrantId: auth.grantId, origin: ORIGIN }
    return { caller: appRouter.createCaller(ctx), ctx, origin: ORIGIN }
  }
}
const SCOPES = ['business:read', 'business:write', 'business:publish']
const json = (r: any) => {
  const text = r.content[0].text as string
  return JSON.parse(text.slice(text.indexOf('<wedance-data>') + 15, text.lastIndexOf('</wedance-data>')))
}
const tool = (name: string) => TOOL_BY_NAME.get(name)!
const web = (dancerId: string) => appRouter.createCaller({ db, dancerId, isAdmin: false } as any)
const row = async (username: string) => (await db.select().from(schema.profiles).where(eq(schema.profiles.username, username)))[0]

describe.skipIf(!DATABASE_URL)('completing unclaimed pages through the app (#454)', () => {
  let alexApp: Awaited<ReturnType<typeof connect>>
  let miaApp: Awaited<ReturnType<typeof connect>>
  let samApp: Awaited<ReturnType<typeof connect>>
  let venue: string // added by Alex with add_venue, no city on the page yet
  let artist: string // added by Alex from Instagram, on Mia's event

  beforeAll(async () => {
    const rows = await db.insert(schema.dancers).values([
      { email: `${tag}-alex@test.local`, name: 'Alex' },
      { email: `${tag}-mia@test.local`, name: 'Mia' },
      { email: `${tag}-sam@test.local`, name: 'Sam' },
    ]).returning({ id: schema.dancers.id })
    ids.alex = rows[0].id; ids.mia = rows[1].id; ids.sam = rows[2].id
    const mk = async (dancerId: string, name: string) => {
      const { username } = await web(dancerId).business.create({ type: 'organizer', name: `${tag} ${name}`, city: 'Munich' })
      const [p] = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.username, username))
      return { id: p.id, username }
    }
    pages.alexOrg = await mk(ids.alex, 'Alex Org')
    pages.miaOrg = await mk(ids.mia, 'Mia Org')
    pages.samOrg = await mk(ids.sam, 'Sam Org')
    alexApp = await connect(ids.alex, SCOPES, [pages.alexOrg.id])
    miaApp = await connect(ids.mia, SCOPES, [pages.miaOrg.id])
    samApp = await connect(ids.sam, SCOPES, [pages.samOrg.id])

    const v = json(await callTool(tool('add_venue'), { name: `${tag} Galerie`, address: 'Somewhere 1', city: `${tag} town` }, await alexApp()))
    venue = v.venue_handle
    madeHandles.push(venue)
    await db.update(schema.profiles).set({ city: null, citySlug: null, address: null }).where(eq(schema.profiles.username, venue))
    const a = json(await callTool(tool('add_profile_from_instagram'), { instagram: `@${ig}_dj`, type: 'artist' }, await alexApp()))
    artist = a.username
    madeHandles.push(artist)
    // Mia hosts an event with Alex's artist in the line-up and Alex's venue as its venue.
    await db.insert(schema.events).values({ name: `${tag} Mia night`, hostProfileId: pages.miaOrg.id, artists: [artist], venueUsername: venue, startDate: new Date('2031-05-01T18:00:00Z') })
  })

  afterAll(async () => {
    const handles = [...Object.values(pages).map(p => p.username), ...madeHandles]
    await db.delete(schema.events).where(like(schema.events.name, `${tag}%`))
    await db.delete(schema.profiles).where(inArray(schema.profiles.username, handles))
    if (clientIds.length) await db.delete(schema.oauthClients).where(inArray(schema.oauthClients.id, clientIds))
    await db.delete(schema.mcpAudit).where(inArray(schema.mcpAudit.dancerId, Object.values(ids)))
    await db.delete(schema.dancers).where(inArray(schema.dancers.id, Object.values(ids)))
  })

  it('lists update_listed_profile for a business:write connection', async () => {
    const { visibleTools } = await import('../../mcp/tools')
    const names = visibleTools({ scopes: ['business:write'], grantedProfileIds: [pages.alexOrg.id], isAdmin: false }).map(t => t.name)
    expect(names).toContain('update_listed_profile')
    expect(visibleTools({ scopes: ['business:read'], grantedProfileIds: [pages.alexOrg.id], isAdmin: false }).map(t => t.name)).not.toContain('update_listed_profile')
  })

  it('the user who added a venue completes it: address, city (resolved like add_venue), socials, styles, photo re-hosted', async () => {
    await db.update(schema.profiles).set({ socials: [{ platform: 'instagram', url: 'https://www.instagram.com/old/' }, { platform: 'website', url: 'https://old.example' }] }).where(eq(schema.profiles.username, venue))
    const r = await callTool(tool('update_listed_profile'), {
      handle: `@${venue}`, address: 'Heinz-Galinski-Straße 13', city: 'Berlin', bio: 'Gallery that hosts socials.', styles: ['Salsa'],
      socials: [{ platform: 'Instagram', url: 'https://www.instagram.com/galerieheinzgalinski/' }, { platform: 'website', url: '' }],
      photo: 'https://scontent.cdninstagram.com/v/t51/abc.jpg?oe=EXPIRES',
    }, await alexApp())
    expect(r.isError).toBeFalsy()
    const out = json(r)
    expect(out.saved).toBe(true)
    expect(out.url).toBe(`${ORIGIN}/@${venue}`)
    const p = await row(venue)
    expect(p.address).toBe('Heinz-Galinski-Straße 13')
    expect(p.city).toBe('Berlin')
    expect(p.citySlug).toBe('berlin')
    expect(p.bio).toBe('Gallery that hosts socials.')
    expect(p.styles).toEqual(['Salsa'])
    expect(p.socials).toEqual([{ platform: 'instagram', url: 'https://www.instagram.com/galerieheinzgalinski/' }])
    expect(rehost).toHaveBeenCalledWith('https://scontent.cdninstagram.com/v/t51/abc.jpg?oe=EXPIRES', 'profiles')
    expect(p.photo).toBe(REHOSTED)
    // Still unclaimed, still nobody's.
    expect(p.claimed).toBeFalsy()
    expect(await db.select().from(schema.profileMembers).where(eq(schema.profileMembers.profileId, p.id))).toHaveLength(0)
  })

  it('also works from the web session of the user who added it', async () => {
    await web(ids.alex).listedProfiles.update({ username: artist, bio: 'Munich DJ' })
    expect((await row(artist)).bio).toBe('Munich DJ')
  })

  it('the owner of an event the page is on completes it (artist in the line-up, venue of the event)', async () => {
    const r = await callTool(tool('update_listed_profile'), { handle: artist, name: 'DJ Fuego', styles: ['Bachata'] }, await miaApp())
    expect(r.isError).toBeFalsy()
    expect((await row(artist)).name).toBe('DJ Fuego')
    await (await miaApp()).caller.listedProfiles.update({ username: venue, name: `${tag} Galerie Heinz` })
    expect((await row(venue)).name).toBe(`${tag} Galerie Heinz`)
  })

  it('refuses a stranger: not the adder, not on their events', async () => {
    const r = await callTool(tool('update_listed_profile'), { handle: artist, bio: 'hijack' }, await samApp())
    expect(r.isError).toBe(true)
    expect(r.content[0]!.text).toMatch(/only if you added it/)
    expect(r.content[0]!.text).not.toMatch(/reconnect/i)
    await expect(web(ids.sam).listedProfiles.update({ username: venue, bio: 'hijack' })).rejects.toThrow(/only if you added it/)
    expect((await row(artist)).bio).toBe('Munich DJ')
  })

  it('refuses a claimed page: the owner edits it', async () => {
    // Mia's own page is claimed (she runs it). Alex has it on nothing, Mia runs it.
    await expect((await alexApp()).caller.listedProfiles.update({ username: pages.miaOrg.username, bio: 'x' })).rejects.toThrow(/is claimed: the owner edits this page/)
    await expect((await miaApp()).caller.listedProfiles.update({ username: pages.miaOrg.username, bio: 'x' })).rejects.toThrow(/You run @.*update_business_profile/)
    // A page Alex added that someone has since claimed: Alex can't any more, even though he added it.
    const [p] = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.username, artist))
    await db.insert(schema.profileMembers).values({ profileId: p.id, dancerId: ids.sam, role: 'owner' })
    await db.update(schema.profiles).set({ claimed: true }).where(eq(schema.profiles.id, p.id))
    const r = await callTool(tool('update_listed_profile'), { handle: artist, bio: 'after the claim' }, await alexApp())
    expect(r.isError).toBe(true)
    expect(r.content[0]!.text).toMatch(/claimed: the owner edits this page/)
    await expect((await miaApp()).caller.listedProfiles.update({ username: artist, bio: 'x' })).rejects.toThrow(/claimed/)
    expect((await row(artist)).bio).toBe('Munich DJ')
    // A v4 import marked claimed with no 2026 team counts as claimed too.
    await db.update(schema.profiles).set({ claimed: true }).where(eq(schema.profiles.username, venue))
    await expect((await alexApp()).caller.listedProfiles.update({ username: venue, bio: 'x' })).rejects.toThrow(/claimed/)
    await db.update(schema.profiles).set({ claimed: false }).where(eq(schema.profiles.username, venue))
  })

  describe('"you don’t manage this page" vs "reconnect and tick"', () => {
    it('an unclaimed page the user added: not managed, points to update_listed_profile, no reconnect', async () => {
      const app = await alexApp()
      const err = await app.caller.business.update({ username: venue, address: 'x' }).catch(e => e)
      expect(err.message).toMatch(/You don’t manage this profile\. Nobody has claimed @.*update_listed_profile/)
      expect(err.message).not.toMatch(/wasn’t given access|Reconnect it/)
      // The demo path: update_business_profile's preview.
      const r = await callTool(tool('update_business_profile'), { profile: venue, address: 'x' }, app)
      expect(r.isError).toBe(true)
      expect(r.content[0]!.text).toMatch(/update_listed_profile/)
      expect(r.content[0]!.text).not.toMatch(/tick the profile/)
    })

    it('a page someone else runs: not managed, reconnecting won’t help', async () => {
      const app = await alexApp()
      await expect(app.caller.business.update({ username: pages.miaOrg.username, bio: 'x' })).rejects.toThrow(/You don’t manage this profile\. Someone else runs @.*, so reconnecting won’t help/)
      await expect(app.caller.businessTeam.team({ username: pages.miaOrg.username })).rejects.toThrow(/You don’t manage/)
      const [ev] = await db.select({ id: schema.events.id }).from(schema.events).where(eq(schema.events.name, `${tag} Mia night`))
      await expect(app.caller.businessEvents.get({ id: ev.id })).rejects.toThrow(/You don’t manage this event, so reconnecting won’t help/)
    })

    it('the user’s own page this app wasn’t given: still "reconnect and tick"', async () => {
      const other = await web(ids.alex).business.create({ type: 'artist', name: `${tag} Alex Artist` })
      madeHandles.push(other.username)
      // A connection made before that page existed (made on the web, so it didn't join the grant).
      const app = await alexApp()
      await expect(app.caller.business.update({ username: other.username, bio: 'x' })).rejects.toThrow(/wasn’t given access to this profile\. Reconnect it and tick/)
      await expect(app.caller.businessEvents.create({ hostUsername: other.username, name: `${tag} x`, type: 'Party', date: '2031-03-02', startTime: '20:00' } as any)).rejects.toThrow(/wasn’t given access/)
    })
  })
})
