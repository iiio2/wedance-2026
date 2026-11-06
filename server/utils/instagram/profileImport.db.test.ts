import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, inArray, like } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { appRouter } from '../../trpc'
import { importInstagramProfiles } from './profileImport'
import type { InstagramProfile } from './apify'

// #452: pages added from an Instagram handle are filled from Apify after the
// response — empty fields only, claimed pages never. Apify and Cloudinary are
// mocked. Local Postgres only:
//   DATABASE_URL=postgresql://dev:dev@localhost:5441/wedance NEON_FETCH_ENDPOINT=http://localhost:4444/sql bunx vitest run server/utils/instagram/profileImport.db.test.ts
const DATABASE_URL = process.env.DATABASE_URL
const db: any = DATABASE_URL ? drizzle(neon(DATABASE_URL), { schema }) : null

vi.stubGlobal('useRuntimeConfig', () => ({ siteUrl: 'http://localhost:3000', resendApiKey: '' }))
const REHOSTED = 'https://res.cloudinary.com/wedance-test/image/upload/wedance-2026/profiles/ig.jpg'
const rehost = vi.hoisted(() => vi.fn(async (_url: string, _folder?: string) => 'https://res.cloudinary.com/wedance-test/image/upload/wedance-2026/profiles/ig.jpg'))
vi.mock('../rehostImage', () => ({ rehostImage: rehost }))
const apify = vi.hoisted(() => ({ profiles: new Map<string, any>(), calls: [] as string[][], fail: false }))
vi.mock('./apify', async (orig) => ({
  ...(await orig<typeof import('./apify')>()),
  fetchInstagramProfiles: async (handles: string[]) => {
    apify.calls.push(handles)
    if (apify.fail) throw new Error('Apify apify~instagram-profile-scraper answered 402: quota')
    return new Map(handles.map(h => [h, apify.profiles.get(h) ?? null]))
  },
}))

const tag = `ig452${Date.now()}`
const city = { name: `Tagtown ${tag}`, slug: `tagtown-${tag}` }
const ig = (handle: string, over: Partial<InstagramProfile> = {}): InstagramProfile => ({
  handle, fullName: null, biography: null, photoUrl: null, externalUrl: null, isBusiness: false, isPrivate: false, category: null, address: null, ...over,
})
let dancerId: string
const caller = (waitUntil?: (p: Promise<unknown>) => void) => appRouter.createCaller({ db, dancerId, isAdmin: false, waitUntil } as any)
const row = async (username: string) => (await db.select().from(schema.profiles).where(eq(schema.profiles.username, username)))[0]
/** Run a mutation, then wait for what it handed to waitUntil (the import). */
async function andAfter<T>(fn: (c: ReturnType<typeof caller>) => Promise<T>): Promise<T> {
  const later: Promise<unknown>[] = []
  const out = await fn(caller(p => later.push(p)))
  await Promise.all(later)
  return out
}

describe.skipIf(!DATABASE_URL)('Instagram profile import (#452)', () => {
  const saved = process.env.APIFY_TOKEN

  beforeAll(async () => {
    process.env.APIFY_TOKEN = 'test-token'
    const [d] = await db.insert(schema.dancers).values({ email: `${tag}@test.local`, name: 'Org' }).returning({ id: schema.dancers.id })
    dancerId = d.id
    await db.insert(schema.cities).values({ googlePlaceId: `gp-${tag}`, slug: city.slug, name: city.name })
  })

  afterEach(() => {
    apify.profiles.clear()
    apify.calls.length = 0
    apify.fail = false
    rehost.mockClear()
  })

  afterAll(async () => {
    if (saved === undefined) delete process.env.APIFY_TOKEN
    else process.env.APIFY_TOKEN = saved
    if (!db) return
    const ps = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(like(schema.profiles.username, `%${tag}%`))
    if (ps.length) await db.delete(schema.profiles).where(inArray(schema.profiles.id, ps.map((p: any) => p.id)))
    await db.delete(schema.dancers).where(eq(schema.dancers.id, dancerId))
    await db.delete(schema.cities).where(eq(schema.cities.slug, city.slug))
  })

  it('addFromInstagram fills an artist page after the response: name, photo, bio, website, city', async () => {
    const h = `${tag}_dj`
    apify.profiles.set(h, ig(h, {
      fullName: 'DJ Tag', biography: 'Salsa DJ.', photoUrl: 'https://scontent.cdninstagram.com/v/hd.jpg?oe=EXPIRES',
      externalUrl: 'https://linktr.ee/djtag', address: { street: 'Agency St 1', zip: null, city: `${city.name}, Germany` },
    }))
    const page = await andAfter(c => c.businessEvents.addFromInstagram({ instagram: `@${h}`, type: 'artist' }))
    expect(page.name).toBe(h) // the response doesn't wait for Apify
    expect(apify.calls).toEqual([[h]])
    expect(rehost).toHaveBeenCalledWith('https://scontent.cdninstagram.com/v/hd.jpg?oe=EXPIRES', 'profiles')
    const r = await row(page.username)
    expect(r).toMatchObject({ name: 'DJ Tag', bio: 'Salsa DJ.', photo: REHOSTED, city: city.name, citySlug: city.slug, address: null })
    expect(r.socials).toEqual([{ platform: 'instagram', url: `https://instagram.com/${h}` }, { platform: 'website', url: 'https://linktr.ee/djtag' }])
    expect(r.sourceRef).toMatchObject({ source: 'wedance-business', addedBy: dancerId, instagram_import: { ok: true, handle: h, fields: ['name', 'bio', 'photo', 'website', 'city'] } })
  })

  it('keeps a name the assistant gave, and a venue gets its business address', async () => {
    const h = `${tag}_gallery`
    apify.profiles.set(h, ig(h, { fullName: 'Galerie Tag', biography: 'Kunst.', address: { street: 'Musterstr. 5', zip: '80331', city: city.name } }))
    const page = await andAfter(c => c.businessEvents.addFromInstagram({ instagram: `https://www.instagram.com/${h}/`, type: 'venue', name: 'Gallery as told' }))
    const r = await row(page.username)
    expect(r).toMatchObject({ name: 'Gallery as told', bio: 'Kunst.', address: `Musterstr. 5, 80331 ${city.name}`, city: city.name })
  })

  it('addVenue with an Instagram handle fills only what the venue is missing', async () => {
    const h = `${tag}_club`
    apify.profiles.set(h, ig(h, { fullName: 'Club Tag IG', biography: 'Every Friday.', photoUrl: 'https://scontent.cdninstagram.com/c.jpg', address: { street: 'Other St 9', zip: null, city: 'Berlin' } }))
    const page = await andAfter(c => c.businessEvents.addVenue({ name: `Club ${tag}`, address: 'Real St 1', city: 'Nowhere', instagram: h }))
    expect(page.created).toBe(true)
    const r = await row(page.username)
    expect(r).toMatchObject({ name: `Club ${tag}`, address: 'Real St 1', bio: 'Every Friday.', photo: REHOSTED })
  })

  it('never writes a claimed page, and re-checks at write time', async () => {
    const h = `${tag}_claimed`
    const [p] = await db.insert(schema.profiles).values({ username: `claimed-${tag}`, type: 'artist', name: h, claimed: true, socials: [{ platform: 'instagram', url: `https://instagram.com/${h}` }] }).returning()
    apify.profiles.set(h, ig(h, { fullName: 'Someone', biography: 'Bio' }))
    const [res] = await importInstagramProfiles(db, [{ profileId: p.id, handle: h }])
    expect(res).toMatchObject({ status: 'skipped', reason: 'claimed' })
    expect(apify.calls).toEqual([])
    const r = await row(p.username)
    expect(r).toMatchObject({ name: h, bio: null })
    expect(r.sourceRef).toBeNull()

    // Claimed while Apify was running: the write is dropped.
    const h2 = `${tag}_racing`
    const [q] = await db.insert(schema.profiles).values({ username: `racing-${tag}`, type: 'artist', name: h2, socials: [{ platform: 'instagram', url: `https://instagram.com/${h2}` }] }).returning()
    const results = await importInstagramProfiles(db, [{ profileId: q.id, handle: h2 }], {
      fetchProfiles: async () => {
        await db.update(schema.profiles).set({ claimed: true }).where(eq(schema.profiles.id, q.id))
        return new Map([[h2, ig(h2, { fullName: 'Too Late', biography: 'Nope' })]])
      },
    })
    expect(results[0]!.status).toBe('filled')
    expect(await row(q.username)).toMatchObject({ name: h2, bio: null, sourceRef: null })
  })

  it('business.create fills the dancer’s own new page — but not the name they chose', async () => {
    const h = `${tag}_mine`
    apify.profiles.set(h, ig(h, { fullName: 'IG Name', biography: 'My school.', photoUrl: 'https://scontent.cdninstagram.com/m.jpg' }))
    const { username } = await andAfter(c => c.business.create({ type: 'organizer', name: `My School ${tag}`, instagram: h }))
    expect(await row(username)).toMatchObject({ name: `My School ${tag}`, bio: 'My school.', photo: REHOSTED, claimed: true })
  })

  it('records a failed run and an unknown account, so they can be retried', async () => {
    const h = `${tag}_down`
    apify.fail = true
    const page = await andAfter(c => c.businessEvents.addFromInstagram({ instagram: h, type: 'artist' }))
    expect((await row(page.username)).sourceRef.instagram_import).toMatchObject({ ok: false, handle: h, error: expect.stringContaining('402') })

    // Adding it again while it still has no photo retries; this time the account doesn't exist.
    apify.fail = false
    await andAfter(c => c.businessEvents.addFromInstagram({ instagram: h, type: 'artist' }))
    expect(apify.calls).toEqual([[h], [h]])
    expect((await row(page.username)).sourceRef.instagram_import).toMatchObject({ ok: false, error: 'not_found' })
  })

  it('a photo Cloudinary refuses leaves the photo empty, the rest still fills', async () => {
    const h = `${tag}_nophoto`
    apify.profiles.set(h, ig(h, { fullName: 'No Photo', photoUrl: 'https://scontent.cdninstagram.com/x.jpg' }))
    rehost.mockRejectedValueOnce(new Error('That photo couldn’t be loaded.'))
    const page = await andAfter(c => c.businessEvents.addFromInstagram({ instagram: h, type: 'artist' }))
    const r = await row(page.username)
    expect(r).toMatchObject({ name: 'No Photo', photo: null })
    expect(r.sourceRef.instagram_import).toMatchObject({ ok: true, fields: ['name'], photo: 'not stored' })
  })

  it('a line-up added one call at a time goes to Apify in one run', async () => {
    const hs = [`${tag}_a`, `${tag}_b`, `${tag}_c`]
    for (const [i, h] of hs.entries()) apify.profiles.set(h, ig(h, { fullName: `Artist ${i}` }))
    const later: Promise<unknown>[] = []
    const c = caller(p => later.push(p))
    const pages = []
    for (const h of hs) pages.push(await c.businessEvents.addFromInstagram({ instagram: h, type: 'artist' }))
    await Promise.all(later)
    expect(apify.calls).toEqual([hs])
    for (const [i, p] of pages.entries()) expect((await row(p.username)).name).toBe(`Artist ${i}`)
  })
})
