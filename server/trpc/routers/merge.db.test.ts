import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, inArray, like, or } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { appRouter } from '..'

// Merging duplicate profiles and Instagram aliases (#458) against a real Postgres
// (local only; the test setup drops a remote DATABASE_URL):
//   DATABASE_URL=postgresql://dev:dev@localhost:5441/wedance NEON_FETCH_ENDPOINT=http://localhost:4444/sql bunx vitest run server/trpc/routers/merge.db.test.ts
const DATABASE_URL = process.env.DATABASE_URL
const db: any = DATABASE_URL ? drizzle(neon(DATABASE_URL), { schema }) : null

vi.stubGlobal('useRuntimeConfig', () => ({ siteUrl: 'http://localhost:3000', resendApiKey: '' }))

const tag = `merge${Date.now()}`
const ids = {} as Record<'owner' | 'fan' | 'fan2' | 'stranger', string>
const pages = {} as Record<'keep' | 'copy' | 'other', { id: string; username: string }>
let eventIds: string[] = []
const web = (dancerId: string, extra: Record<string, unknown> = {}) => appRouter.createCaller({ db, dancerId, isAdmin: false, origin: 'https://wedance.test', ...extra } as any)
const profile = async (id: string) => (await db.select().from(schema.profiles).where(eq(schema.profiles.id, id)))[0]

describe.skipIf(!DATABASE_URL)('merge duplicate profiles (DB)', () => {
  beforeAll(async () => {
    const rows = await db.insert(schema.dancers).values([
      { email: `${tag}-owner@test.local`, name: 'Owner' },
      { email: `${tag}-fan@test.local`, name: 'Fan' },
      { email: `${tag}-fan2@test.local`, name: 'Fan Two' },
      { email: `${tag}-stranger@test.local`, name: 'Stranger' },
    ]).returning({ id: schema.dancers.id })
    ;[ids.owner, ids.fan, ids.fan2, ids.stranger] = rows.map((r: any) => r.id)
    const mk = async (dancer: string, name: string, instagram: string) => {
      const { username } = await web(dancer).business.create({ type: 'venue', name, city: 'Munich', instagram })
      const [p] = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.username, username))
      return { id: p.id, username }
    }
    pages.keep = await mk(ids.owner, `Buena Vista Bar ${tag}`, `${tag}_bvb`)
    pages.copy = await mk(ids.owner, `Bar Buena Vista ${tag}`, `${tag}_barbv`)
    pages.other = await mk(ids.stranger, `Stranger Venue ${tag}`, `${tag}_other`)
    await db.update(schema.profiles).set({ address: 'Herzog-Wilhelm-Straße 8, 80331 München', bio: 'The copy’s bio' }).where(eq(schema.profiles.id, pages.copy.id))

    // References to the copy: events (venue, line-up), follows (one dancer follows both), a review.
    const evs = await db.insert(schema.events).values([
      { name: `${tag} Social`, venueUsername: pages.copy.username, archived: false, published: true },
      { name: `${tag} Night`, organizerUsername: pages.copy.username, artists: [pages.copy.username, 'someone'], archived: false, published: true },
    ]).returning({ id: schema.events.id })
    eventIds = evs.map((e: any) => e.id)
    await db.insert(schema.follows).values([
      { dancerId: ids.fan, profileId: pages.copy.id },
      { dancerId: ids.fan2, profileId: pages.copy.id },
      { dancerId: ids.fan2, profileId: pages.keep.id },
    ])
    await db.insert(schema.reviews).values({ targetType: 'venue', targetSlug: pages.copy.username, dancerId: ids.fan, rating: 5, text: 'Great' })
  })

  afterAll(async () => {
    const pageIds = Object.values(pages).map(p => p.id)
    await db.delete(schema.events).where(inArray(schema.events.id, eventIds))
    await db.delete(schema.reviews).where(inArray(schema.reviews.dancerId, Object.values(ids)))
    await db.delete(schema.follows).where(inArray(schema.follows.profileId, pageIds))
    await db.delete(schema.profileMerges).where(or(inArray(schema.profileMerges.fromProfileId, pageIds), inArray(schema.profileMerges.toProfileId, pageIds)))
    await db.delete(schema.profiles).where(or(inArray(schema.profiles.id, pageIds), like(schema.profiles.name, `%${tag}%`)))
    await db.delete(schema.dancers).where(inArray(schema.dancers.id, Object.values(ids)))
  })

  it('warns about the duplicate when creating a similar page in the same city', async () => {
    const found = await web(ids.stranger).business.findExisting({ name: 'Buena Vista Bar', city: 'Munich', type: 'venue' })
    // Different spelling of the tag suffix — the plain name still finds both pages.
    const mine = (await web(ids.stranger).business.findExisting({ name: `Bar Buena Vista ${tag}`, city: 'Munich' })).map((d: any) => d.username)
    expect(mine).toEqual(expect.arrayContaining([pages.keep.username, pages.copy.username]))
    expect(found.every((d: any) => d.reasons.length > 0)).toBe(true)
  })

  it('lists the copy as a possible duplicate the owner can merge', async () => {
    const d = await web(ids.owner).business.duplicates({ username: pages.keep.username })
    expect(d.find((x: any) => x.username === pages.copy.username)).toMatchObject({ canMerge: true, reasons: expect.arrayContaining(['name']) })
  })

  it('refuses a merge by someone who doesn’t own both pages', async () => {
    await expect(web(ids.owner).business.merge({ from: pages.other.username, into: pages.keep.username })).rejects.toThrow()
    await expect(web(ids.stranger).business.merge({ from: pages.copy.username, into: pages.other.username })).rejects.toThrow()
  })

  let mergeId = ''
  it('moves every reference, keeps the copy’s Instagram as an alias and hides the copy', async () => {
    const r = await web(ids.owner).business.merge({ from: `@${pages.copy.username}`, into: pages.keep.username })
    mergeId = r.mergeId
    const [social, night] = await Promise.all(eventIds.map(async id => (await db.select().from(schema.events).where(eq(schema.events.id, id)))[0]))
    expect(social.venueUsername).toBe(pages.keep.username)
    expect(night.organizerUsername).toBe(pages.keep.username)
    expect(night.artists).toEqual([pages.keep.username, 'someone'])

    const follows = await db.select().from(schema.follows).where(inArray(schema.follows.dancerId, [ids.fan, ids.fan2]))
    expect(follows.filter((f: any) => f.profileId === pages.keep.id).map((f: any) => f.dancerId).sort()).toEqual([ids.fan, ids.fan2].sort())
    // fan2 already followed the kept page: their copy follow stays on the hidden copy (nothing deleted).
    expect(follows.filter((f: any) => f.profileId === pages.copy.id).map((f: any) => f.dancerId)).toEqual([ids.fan2])

    const [review] = await db.select().from(schema.reviews).where(eq(schema.reviews.dancerId, ids.fan))
    expect(review.targetSlug).toBe(pages.keep.username)

    const keep = await profile(pages.keep.id), copy = await profile(pages.copy.id)
    expect(keep.instagramAliases).toEqual([`${tag}_barbv`])
    expect(keep.address).toBe('Herzog-Wilhelm-Straße 8, 80331 München') // empty field filled
    expect(copy.status).toBe('hidden')
    expect(copy.sourceRef.mergedInto).toBe(pages.keep.username)
    // The owner's page list no longer shows the copy.
    const mine = (await web(ids.owner).business.myProfiles()).managed.map((p: any) => p.username)
    expect(mine).toContain(pages.keep.username)
    expect(mine).not.toContain(pages.copy.username)
  })

  it('forwards the old handle to the kept page', async () => {
    const anon = appRouter.createCaller({ db, dancerId: null, isAdmin: false } as any)
    expect(await anon.entity.getByHandle({ handle: pages.copy.username })).toBeNull()
    expect(await anon.entity.movedTo({ handle: pages.copy.username })).toEqual({ handle: pages.keep.username })
  })

  it('finds the kept page by the merged copy’s Instagram account (alias dedupe)', async () => {
    const r = await web(ids.stranger).businessEvents.addFromInstagram({ instagram: `https://instagram.com/${tag}_barbv`, type: 'venue' })
    expect(r.username).toBe(pages.keep.username)
    const v = await web(ids.stranger).businessEvents.addVenue({ name: 'Anything', address: 'Elsewhere 1', city: 'Munich', instagram: `@${tag}_barbv` })
    expect(v).toMatchObject({ username: pages.keep.username, created: false })
    await expect(web(ids.stranger).business.create({ type: 'venue', name: 'Mine', instagram: `${tag}_barbv` })).rejects.toThrow(/already has a page/)
  })

  it('lets the owner edit aliases and keeps the main account out of them', async () => {
    await web(ids.owner).business.update({ username: pages.keep.username, instagramAliases: [`${tag}_barbv`, `https://instagram.com/${tag}_bvb`, `@${tag}_old`] })
    expect((await profile(pages.keep.id)).instagramAliases).toEqual([`${tag}_barbv`, `${tag}_old`])
  })

  it('undoes the merge: references move back and the copy shows again', async () => {
    const history = await web(ids.owner).business.merges({ username: pages.keep.username })
    expect(history[0]).toMatchObject({ id: mergeId, fromUsername: pages.copy.username, undoneAt: null })
    await web(ids.owner).business.undoMerge({ mergeId })
    const [social, night] = await Promise.all(eventIds.map(async id => (await db.select().from(schema.events).where(eq(schema.events.id, id)))[0]))
    expect(social.venueUsername).toBe(pages.copy.username)
    expect(night.organizerUsername).toBe(pages.copy.username)
    expect(night.artists).toEqual([pages.copy.username, 'someone'])
    const follows = await db.select().from(schema.follows).where(eq(schema.follows.dancerId, ids.fan))
    expect(follows.map((f: any) => f.profileId)).toEqual([pages.copy.id])
    const copy = await profile(pages.copy.id), keep = await profile(pages.keep.id)
    expect(copy.status).toBe('visible')
    expect(copy.sourceRef?.mergedInto).toBeUndefined()
    expect(keep.address).toBeNull()
    await expect(web(ids.owner).business.undoMerge({ mergeId })).rejects.toThrow(/already undone/)
  })
})
