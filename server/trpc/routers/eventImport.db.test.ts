import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import * as schema from '../../database/schema'
import { appRouter } from '../index'
import { TOOLS } from '../../mcp/tools'
import posts from '../../utils/instagram/__fixtures__/post-scraper-bfest.json'
import bfestAnswer from '../../utils/instagram/__fixtures__/bfest-extraction.json'

// #453: an Instagram post → a complete draft through the real procedures.
// Apify, Gemini and Cloudinary are mocked (the B-FEST post and the model's
// answer for it). Local Postgres only:
//   DATABASE_URL=postgresql://dev:dev@localhost:5441/wedance NEON_FETCH_ENDPOINT=http://localhost:4444/sql bunx vitest run server/trpc/routers/eventImport.db.test.ts
const DATABASE_URL = process.env.DATABASE_URL
const db: any = DATABASE_URL ? drizzle(neon(DATABASE_URL), { schema }) : null

vi.stubGlobal('useRuntimeConfig', () => ({ siteUrl: 'http://localhost:3000', resendApiKey: '', geminiApiKey: 'test-key', public: {} }))
const COVER = 'https://res.cloudinary.com/wedance-test/image/upload/wedance-2026/events/bfest.jpg'
const rehost = vi.hoisted(() => vi.fn(async (_url: string, _folder?: string) => 'https://res.cloudinary.com/wedance-test/image/upload/wedance-2026/events/bfest.jpg'))
vi.mock('../../utils/rehostImage', () => ({ rehostImage: rehost }))
const fetchPost = vi.hoisted(() => vi.fn())
vi.mock('../../utils/instagram/post', async orig => ({ ...(await orig<typeof import('../../utils/instagram/post')>()), fetchInstagramPost: fetchPost }))
const extract = vi.hoisted(() => vi.fn())
vi.mock('../../utils/flyer/gemini', async orig => ({ ...(await orig<typeof import('../../utils/flyer/gemini')>()), extractJson: extract }))
// The #452 profile import runs after the response; not part of this test.
vi.mock('../../utils/instagram/profileImport', async orig => ({ ...(await orig<typeof import('../../utils/instagram/profileImport')>()), scheduleInstagramImport: () => null }))

const tag = `ig453${Date.now()}`
const host = `bfest-${tag}`
const URL_ = 'https://www.instagram.com/p/DQbfestHw31/?igsh=x'
let dancerId: string
const caller = () => appRouter.createCaller({ db, dancerId, isAdmin: false } as any)

describe.skipIf(!DATABASE_URL)('import an event from an Instagram post (#453)', () => {
  const saved = process.env.APIFY_TOKEN

  beforeAll(async () => {
    process.env.APIFY_TOKEN = 'test-token'
    const { normalizeInstagramPost } = await vi.importActual<typeof import('../../utils/instagram/post')>('../../utils/instagram/post')
    fetchPost.mockImplementation(async () => normalizeInstagramPost(posts[0]))
    extract.mockImplementation(async () => structuredClone(bfestAnswer))
    const [d] = await db.insert(schema.dancers).values({ email: `${tag}@test.local`, name: 'Aslihan' }).returning({ id: schema.dancers.id })
    dancerId = d.id
    const [p] = await db.insert(schema.profiles).values({ username: host, type: 'organizer', name: 'B-FEST Berlin', socials: [{ platform: 'instagram', url: 'https://instagram.com/bfestberlin' }] }).returning({ id: schema.profiles.id })
    await db.insert(schema.profileMembers).values({ profileId: p.id, dancerId, role: 'owner' })
    await db.insert(schema.cities).values({ googlePlaceId: `gp-${tag}`, slug: 'berlin', name: 'Berlin', countryCode: 'DE', country: 'Germany', lng: 13.4 }).onConflictDoNothing()
  })

  afterEach(() => { fetchPost.mockClear(); extract.mockClear(); rehost.mockClear() })

  afterAll(async () => {
    if (saved === undefined) delete process.env.APIFY_TOKEN
    else process.env.APIFY_TOKEN = saved
    if (!db) return
    const [hp] = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.username, host))
    if (hp) await db.delete(schema.events).where(eq(schema.events.hostProfileId, hp.id))
    const added = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(sql`${schema.profiles.sourceRef}->>'addedBy' = ${dancerId}`)
    const ids = [...added.map((r: any) => r.id), ...(hp ? [hp.id] : [])]
    if (ids.length) {
      await db.delete(schema.profileMembers).where(inArray(schema.profileMembers.profileId, ids))
      await db.delete(schema.profiles).where(inArray(schema.profiles.id, ids))
    }
    await db.delete(schema.cities).where(eq(schema.cities.googlePlaceId, `gp-${tag}`))
    await db.delete(schema.dancers).where(eq(schema.dancers.id, dancerId))
  })

  it('makes the B-FEST draft: programme, 10 on the line-up, venue page, €15+, cover', async () => {
    const r = await caller().eventImport.fromInstagram({ url: URL_ })
    expect(r).toMatchObject({ created: true, host, cover: true, venue: { handle: 'galerieheinzgalinski' } })
    expect(r.lineup).toHaveLength(10)
    expect(r.organizers).toEqual(['adelaidebeauvoir', 'aslihan.dans', 'mr.whitenoize', 'lateatnate'])
    expect(fetchPost).toHaveBeenCalledWith('https://www.instagram.com/p/DQbfestHw31/', 'DQbfestHw31')
    expect(rehost).toHaveBeenCalledWith('https://scontent.cdninstagram.com/v/t51/bfest-halloween.jpg', 'events')

    const ev: any = await caller().businessEvents.get({ id: r.id })
    expect(ev).toMatchObject({ published: false, name: 'HALLOWEEN at B-FEST Boutique', date: '2026-10-31', startTime: '18:00', endTime: '22:00', city: 'Berlin', price: '€15+', cover: COVER, venueUsername: 'galerieheinzgalinski' })
    expect(ev.festival.sessions.map((s: any) => [s.time, s.type, s.duration])).toEqual([['18:00', 'doors', 0], ['19:00', 'show', 90], ['20:30', 'party', 90]])
    expect(ev.artists).toHaveLength(10)
    expect(ev.flyerOptions.names['dance_witch_jenna']).toBe('Charley Horse')
    const [venue] = await db.select().from(schema.profiles).where(eq(schema.profiles.username, 'galerieheinzgalinski'))
    expect(venue).toMatchObject({ type: 'venue', name: 'Galerie Heinz Galinski', address: 'Heinz-Galinski-Straße 13' })
    const [row] = await db.select({ sourceRef: schema.events.sourceRef }).from(schema.events).where(eq(schema.events.id, r.id))
    expect(row.sourceRef.instagram).toMatchObject({ code: 'DQbfestHw31', owner: 'bfestberlin' })
  })

  it('the same post again returns that draft, without reading Instagram', async () => {
    const r = await caller().eventImport.fromInstagram({ url: URL_, profile: host })
    expect(r.created).toBe(false)
    expect(fetchPost).not.toHaveBeenCalled()
  })

  it('refuses a page link, a page the dancer doesn’t run, and a server without Apify', async () => {
    await expect(caller().eventImport.fromInstagram({ url: 'https://www.instagram.com/bfestberlin/' })).rejects.toThrow(/page @bfestberlin, not a post/)
    await expect(caller().eventImport.fromInstagram({ url: 'https://www.instagram.com/p/OTHER12345/', profile: 'not-mine-at-all' })).rejects.toThrow(/don’t run @not-mine-at-all/)
    delete process.env.APIFY_TOKEN
    try {
      await expect(caller().eventImport.fromInstagram({ url: 'https://www.instagram.com/p/OTHER12345/' })).rejects.toThrow(/APIFY_TOKEN is missing/)
    } finally {
      process.env.APIFY_TOKEN = 'test-token'
    }
    expect(fetchPost).not.toHaveBeenCalled()
  })

  it('MCP import_from_instagram: a page link points to add_profile_from_instagram; a post returns the draft and its checklist', async () => {
    const tool = TOOLS.find(t => t.name === 'import_from_instagram')!
    const t = { caller: caller(), ctx: {}, origin: 'https://x' } as any
    const page: any = await tool.run(t, z.object(tool.input).parse({ url: 'instagram.com/galerieheinzgalinski' }))
    expect(page.created).toBe(false)
    expect(page.error).toMatch(/add_profile_from_instagram/)
    await db.update(schema.events).set({ archived: true }).where(sql`${schema.events.sourceRef}->'instagram'->>'code' = 'DQbfestHw31'`)
    const r: any = await tool.run(t, z.object(tool.input).parse({ url: URL_ }))
    expect(r).toMatchObject({ created: true, published: false, editor: `https://x/business/events/${r.id}` })
    expect(r.imported).toMatchObject({ name: { untrusted_text: 'HALLOWEEN at B-FEST Boutique' }, date: '2026-10-31', venue: '@galerieheinzgalinski', price: { untrusted_text: '€15+' }, cover: true })
    expect(r.imported.lineup).toHaveLength(10)
    expect(Array.isArray(r.missing)).toBe(true)
  })
})
