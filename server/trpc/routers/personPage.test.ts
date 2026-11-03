/**
 * One handle per person (#474): a dancer marks one page they own as "this is me".
 * Hermetic FakeDb (same pattern as entityBooking.test.ts) — no live Neon.
 */
import { describe, it, expect, vi } from 'vitest'
import { dancers, profiles, profileMembers, cityVideos, bookableSpaces } from '../../database/schema'

type FilterFn = (row: Record<string, any>) => boolean

vi.mock('drizzle-orm', async () => {
  const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())
  const resolveKey = (col: any): string | undefined => (col?.name ? snakeToCamel(col.name) : undefined)
  const eq = (col: any, val: any): FilterFn => { const k = resolveKey(col); return (r) => (k ? r[k] === val : false) }
  const and = (...p: FilterFn[]): FilterFn => (r) => p.every(f => f(r))
  const inArray = (col: any, vals: any[]): FilterFn => { const k = resolveKey(col); return (r) => (k ? vals.includes(r[k]) : false) }
  return { eq, and, inArray, gt: () => () => false, sql: (..._a: any[]) => ({}) }
})

import { appRouter } from '../index'

interface Row { [k: string]: any }
class FakeDb {
  dancers: Row[] = []
  profiles: Row[] = []
  profileMembers: Row[] = []
  cityVideos: Row[] = []
  bookableSpaces: Row[] = []
  select(_c: any) { return { from: (t: any) => ({ where: (f: FilterFn) => Promise.resolve(this.tableFor(t).filter(f)) }) } }
  update(t: any) {
    return { set: (patch: Row) => ({ where: (f: FilterFn) => {
      for (const r of this.tableFor(t)) if (f(r)) Object.assign(r, patch)
      return Promise.resolve()
    } }) }
  }
  private tableFor(t: any): Row[] {
    if (t === dancers) return this.dancers
    if (t === profiles) return this.profiles
    if (t === profileMembers) return this.profileMembers
    if (t === cityVideos) return this.cityVideos
    if (t === bookableSpaces) return this.bookableSpaces
    throw new Error('unexpected table')
  }
  dancer(id: string, extra: Row = {}) {
    this.dancers.push({ id, name: id, username: `${id}-handle`, email: `${id}@x.com`, role: 'lead', danceStyles: ['Salsa'], profilePublic: true, pageProfileId: null, ...extra })
  }
  page(id: string, type: string, extra: Row = {}) {
    this.profiles.push({ id, username: id, name: id.toUpperCase(), type, status: 'visible', photo: null, ...extra })
  }
  member(profileId: string, dancerId: string, role = 'owner') {
    this.profileMembers.push({ id: `${profileId}:${dancerId}`, profileId, dancerId, role })
  }
}
const caller = (db: any, dancerId: string | null = null) =>
  appRouter.createCaller({ db, dancerId, isAdmin: false } as any)

function alex() {
  const db = new FakeDb()
  db.dancer('alex')
  db.page('alex-artist', 'artist')
  db.page('salsa-nights', 'organizer')
  db.page('studio', 'venue')
  db.member('alex-artist', 'alex')
  db.member('salsa-nights', 'alex')
  db.member('studio', 'alex')
  return db
}

describe('profile.myPage', () => {
  it('offers the artist / organiser pages the caller owns, never venues', async () => {
    const res = await caller(alex(), 'alex').profile.myPage()
    expect(res.current).toBeNull()
    // Artist pages first: those are usually the person.
    expect(res.options.map(o => o.username)).toEqual(['alex-artist', 'salsa-nights'])
  })

  it('leaves out pages where the caller is only an editor', async () => {
    const db = alex()
    db.page('friend-artist', 'artist')
    db.member('friend-artist', 'alex', 'editor')
    const res = await caller(db, 'alex').profile.myPage()
    expect(res.options.map(o => o.username)).not.toContain('friend-artist')
  })
})

describe('profile.setPage', () => {
  it('links an owned artist page and clears it again', async () => {
    const db = alex()
    expect(await caller(db, 'alex').profile.setPage({ username: 'alex-artist' })).toEqual({ page: 'alex-artist' })
    expect(db.dancers[0].pageProfileId).toBe('alex-artist')
    expect((await caller(db, 'alex').profile.myPage()).current).toBe('alex-artist')

    expect(await caller(db, 'alex').profile.setPage({ username: null })).toEqual({ page: null })
    expect(db.dancers[0].pageProfileId).toBeNull()
  })

  it('refuses a venue', async () => {
    await expect(caller(alex(), 'alex').profile.setPage({ username: 'studio' })).rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('refuses a page the caller does not own', async () => {
    const db = alex()
    db.page('someone', 'artist')
    await expect(caller(db, 'alex').profile.setPage({ username: 'someone' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
    db.member('someone', 'alex', 'editor')
    await expect(caller(db, 'alex').profile.setPage({ username: 'someone' })).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('refuses a page another owner already uses as theirs', async () => {
    const db = alex()
    db.dancer('kim', { pageProfileId: 'salsa-nights' })
    db.member('salsa-nights', 'kim')
    await expect(caller(db, 'alex').profile.setPage({ username: 'salsa-nights' })).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('needs a signed-in dancer', async () => {
    await expect(caller(alex()).profile.setPage({ username: 'alex-artist' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

describe('the page is the person', () => {
  it('getByUsername points the dancer handle at their page', async () => {
    const db = alex()
    db.dancers[0].pageProfileId = 'alex-artist'
    const d = await caller(db).profile.getByUsername({ username: 'alex-handle' })
    expect(d.pageHandle).toBe('alex-artist')
  })

  it('getByUsername has no page handle when the page is hidden', async () => {
    const db = alex()
    db.dancers[0].pageProfileId = 'alex-artist'
    db.profiles[0].status = 'hidden'
    expect((await caller(db).profile.getByUsername({ username: 'alex-handle' })).pageHandle).toBeNull()
  })

  it('getByHandle shows the dancer side and the other pages they run', async () => {
    const db = alex()
    db.dancers[0].pageProfileId = 'alex-artist'
    // Another artist they manage is someone else, not something they run.
    db.page('friend-artist', 'artist')
    db.member('friend-artist', 'alex')
    const res = await caller(db).entity.getByHandle({ handle: 'alex-artist' })
    expect(res?.person).toMatchObject({ username: 'alex-handle', role: 'lead', danceStyles: ['Salsa'] })
    expect(res?.person?.runs.map(r => r.username).sort()).toEqual(['salsa-nights', 'studio'])
  })

  it('a private dancer stays private: the page shows only itself', async () => {
    const db = alex()
    db.dancers[0].pageProfileId = 'alex-artist'
    db.dancers[0].profilePublic = false
    expect((await caller(db).entity.getByHandle({ handle: 'alex-artist' }))?.person).toBeNull()
  })

  it('a page nobody picked has no person', async () => {
    expect((await caller(alex()).entity.getByHandle({ handle: 'alex-artist' }))?.person).toBeNull()
  })
})
