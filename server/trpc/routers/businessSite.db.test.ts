import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, inArray } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { appRouter } from '..'
import type { ProfileSite } from '../../../shared/types/profileSite'

// Website version history (0062) against a real Postgres (local only):
//   DATABASE_URL=postgresql://dev:dev@localhost:5441/wedance NEON_FETCH_ENDPOINT=http://localhost:4444/sql bunx vitest run server/trpc/routers/businessSite.db.test.ts
const DATABASE_URL = process.env.DATABASE_URL
const db: any = DATABASE_URL ? drizzle(neon(DATABASE_URL), { schema }) : null

vi.stubGlobal('useRuntimeConfig', () => ({ siteUrl: 'http://localhost:3000', resendApiKey: '' }))

const tag = `site${Date.now()}`
const ids = {} as Record<'owner' | 'stranger', string>
const pages = {} as Record<'mine' | 'other', { id: string; username: string }>
const web = (dancerId: string, extra: Record<string, unknown> = {}) => appRouter.createCaller({ db, dancerId, isAdmin: false, origin: 'https://wedance.test', ...extra } as any)

const v1: ProfileSite = { locales: ['en', 'de'], sections: [{ id: 'hero', kind: 'hero', title: { en: 'Dance with us', de: 'Tanz mit uns' } }] }
const v2: ProfileSite = { ...v1, sections: [{ id: 'hero', kind: 'hero', title: { en: 'Dance with us!', de: 'Tanz mit uns' } }, { id: 'faq', kind: 'faq', title: { en: 'Questions' } }] }

describe.skipIf(!DATABASE_URL)('website version history (DB)', () => {
  beforeAll(async () => {
    const rows = await db.insert(schema.dancers).values([
      { email: `${tag}-owner@test.local`, name: 'Owner' },
      { email: `${tag}-stranger@test.local`, name: 'Stranger' },
    ]).returning({ id: schema.dancers.id })
    ;[ids.owner, ids.stranger] = rows.map((r: any) => r.id)
    const mk = async (dancer: string, name: string) => {
      const { username } = await web(dancer).business.create({ type: 'organizer', name, city: 'Munich' })
      const [p] = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.username, username))
      return { id: p.id, username }
    }
    pages.mine = await mk(ids.owner, `Salsa School ${tag}`)
    pages.other = await mk(ids.stranger, `Other School ${tag}`)
  })

  afterAll(async () => {
    if (!db) return
    await db.delete(schema.profiles).where(inArray(schema.profiles.id, [pages.mine?.id, pages.other?.id].filter(Boolean)))
    await db.delete(schema.dancers).where(inArray(schema.dancers.id, Object.values(ids)))
  })

  it('every save is a version with who, from where and what changed; a no-op save adds none', async () => {
    const owner = web(ids.owner)
    const first = await owner.businessSite.save({ username: pages.mine.username, site: v1 })
    expect(first.summary).toEqual(['Created the site'])
    // An AI app over MCP: same procedure, OAuth context.
    const mcp = web(ids.owner, { oauthGrantId: '00000000-0000-4000-8000-000000000001', oauthClientId: 'https://chatgpt.com/oauth/client.json', scopes: ['business:publish'], grantedProfileIds: [pages.mine.id] })
    const second = await mcp.businessSite.save({ username: pages.mine.username, site: v2 })
    expect(second.summary).toEqual(['Added Questions “Questions”', 'Changed Hero “Dance with us!”: title (en)'])
    expect((await owner.businessSite.save({ username: pages.mine.username, site: v2 })).unchanged).toBe(true)

    const h = await owner.businessSite.history({ username: pages.mine.username })
    expect(h.versions.map(v => [v.via, v.clientApp, v.by?.name, v.current])).toEqual([['mcp', 'chatgpt', 'Owner', true], ['web', null, 'Owner', false]])
  })

  it('restore puts an old version live as a new version, which can be undone too', async () => {
    const owner = web(ids.owner)
    const [, oldest] = (await owner.businessSite.history({ username: pages.mine.username })).versions
    const r = await owner.businessSite.restore({ username: pages.mine.username, id: oldest!.id })
    expect(r.restoredFrom).toBe(oldest!.id)
    expect(r.summary[0]).toBe('Restored an earlier version')
    expect((await owner.businessSite.get({ username: pages.mine.username })).site).toEqual(v1)

    const h = (await owner.businessSite.history({ username: pages.mine.username })).versions
    expect(h).toHaveLength(3)
    expect(h[0]!.restoredFrom).toBe(oldest!.id)
    // Undo the restore: back to the AI app's version.
    await owner.businessSite.restore({ username: pages.mine.username, id: h[1]!.id })
    expect((await owner.businessSite.get({ username: pages.mine.username })).site).toEqual(v2)
  })

  it('only the page’s team sees or restores its versions; another page’s version id is not found', async () => {
    const [v] = (await web(ids.owner).businessSite.history({ username: pages.mine.username })).versions
    await expect(web(ids.stranger).businessSite.history({ username: pages.mine.username })).rejects.toThrow()
    await expect(web(ids.stranger).businessSite.restore({ username: pages.mine.username, id: v!.id })).rejects.toThrow()
    await expect(web(ids.stranger).businessSite.restore({ username: pages.other.username, id: v!.id })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
