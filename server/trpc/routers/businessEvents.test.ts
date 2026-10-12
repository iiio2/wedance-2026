import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, inArray } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { appRouter } from '../index'
import { eventLocalDate, eventLocalTime } from '../../../shared/utils/eventTime'

// Local Postgres only (test-setup drops a remote DATABASE_URL):
//   DATABASE_URL=postgresql://dev:dev@localhost:5441/wedance \
//   NEON_FETCH_ENDPOINT=http://localhost:4444/sql bunx vitest run server/trpc/routers/businessEvents.test.ts
const DATABASE_URL = process.env.DATABASE_URL
let db: any = null
if (DATABASE_URL) db = drizzle(neon(DATABASE_URL), { schema })

const caller = (dancerId: string | null) => appRouter.createCaller({ db, dancerId, isAdmin: false } as any)

const tag = `hostev-${Date.now()}`
let owner: string
let stranger: string
let orgHandle: string
let artistHandle: string
const profileHandles: string[] = []

const base = {
  type: 'Party' as const,
  date: '2026-10-22', // a Thursday before the Oct 25 clock change
  startTime: '20:00',
  endTime: '01:00',
  city: 'Munich',
  venueName: 'Luma',
  venueAddress: 'Neuhauser Str. 47',
  artists: [] as string[],
  styles: ['Salsa'],
  description: '',
  price: '',
  published: true,
}

describe.skipIf(!DATABASE_URL)('businessEvents router', () => {
  beforeAll(async () => {
    const rows = await db.insert(schema.dancers).values([
      { email: `${tag}-owner@test.local`, name: 'Owner' },
      { email: `${tag}-stranger@test.local`, name: 'Stranger' },
    ]).returning({ id: schema.dancers.id })
    owner = rows[0].id
    stranger = rows[1].id
    orgHandle = (await caller(owner).business.create({ type: 'organizer', name: `${tag} Nights` })).username
    artistHandle = (await caller(owner).business.create({ type: 'artist', name: `${tag} DJ` })).username
    profileHandles.push(orgHandle, artistHandle)
  })

  afterAll(async () => {
    const hosts = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(inArray(schema.profiles.username, profileHandles))
    if (hosts.length) await db.delete(schema.events).where(inArray(schema.events.hostProfileId, hosts.map((h: any) => h.id)))
    await db.delete(schema.profiles).where(inArray(schema.profiles.username, profileHandles))
    await db.delete(schema.dancers).where(inArray(schema.dancers.id, [owner, stranger]))
  })

  it('stores local Munich times and reads them back unchanged', async () => {
    const { id } = await caller(owner).businessEvents.create({ ...base, hostUsername: orgHandle, name: `${tag} Thursday` })
    const ev = await caller(owner).businessEvents.get({ id })
    expect(ev).toMatchObject({ date: '2026-10-22', startTime: '20:00', endTime: '01:00', endDate: null, city: 'Munich' })
    const [row] = await db.select().from(schema.events).where(eq(schema.events.id, id))
    expect(row.timezone).toBe('Europe/Berlin')
    expect(row.citySlug).toBe('munich')
    expect(row.startDate.toISOString()).toBe('2026-10-22T18:00:00.000Z')
    // 01:00 is the next morning.
    expect(row.endDate.toISOString()).toBe('2026-10-22T23:00:00.000Z')
    expect(row.organizerUsername).toBe(orgHandle)
    expect(row.archived).toBe(false)
  })

  it('only lets managers of the host profile edit', async () => {
    await expect(caller(stranger).businessEvents.create({ ...base, hostUsername: orgHandle, name: 'Hijack' })).rejects.toThrow('You don’t manage this profile.')
    const { upcoming } = await caller(owner).businessEvents.list()
    const id = upcoming[0]!.id
    await expect(caller(stranger).businessEvents.get({ id })).rejects.toThrow('You don’t manage this event.')
    await expect(caller(stranger).businessEvents.update({ ...base, id, name: 'Hijack' })).rejects.toThrow('You don’t manage this event.')
    await expect(caller(stranger).businessEvents.archive({ id })).rejects.toThrow('You don’t manage this event.')
  })

  it('repeats weekly at the same local time across the clock change', async () => {
    const { upcoming } = await caller(owner).businessEvents.list({ profile: orgHandle })
    const src = upcoming.find((e: any) => e.name === `${tag} Thursday`)!
    const { created } = await caller(owner).businessEvents.duplicate({ id: src.id, weeks: 2 })
    expect(created).toHaveLength(2)
    const dates = created.map((c: any) => eventLocalDate(c.startDate, 'Europe/Berlin'))
    expect(dates).toEqual(['2026-10-29', '2026-11-05'])
    for (const c of created) expect(eventLocalTime(c.startDate, 'Europe/Berlin')).toBe('20:00')
    const [copy] = await db.select().from(schema.events).where(eq(schema.events.id, created[0].id))
    const [orig] = await db.select().from(schema.events).where(eq(schema.events.id, src.id))
    expect(copy.seriesId).toBe(orig.seriesId)
    expect(copy.seriesId).toBeTruthy()
  })

  it('adds an artist from an Instagram link once, then reuses them', async () => {
    const ig = `${tag.replace(/-/g, '_')}_dj`.slice(0, 30)
    const a = await caller(owner).businessEvents.addFromInstagram({ instagram: `https://www.instagram.com/${ig}/`, type: 'artist' })
    profileHandles.push(a.username)
    const b = await caller(owner).businessEvents.addFromInstagram({ instagram: `@${ig}`, type: 'artist' })
    expect(b.username).toBe(a.username)
    const [p] = await db.select().from(schema.profiles).where(eq(schema.profiles.username, a.username))
    expect(p.claimed).toBe(false)
    expect(p.socials).toEqual([{ platform: 'instagram', url: `https://instagram.com/${ig}` }])
  })

  it('inbox flags drafts and missing details, and lists line-ups I play', async () => {
    const draft = await caller(owner).businessEvents.create({
      ...base, hostUsername: orgHandle, name: `${tag} Draft`, date: futureDate(5), endTime: '23:00', published: false,
    })
    const live = await caller(owner).businessEvents.create({
      ...base, hostUsername: orgHandle, name: `${tag} Live`, date: futureDate(6), endTime: '23:00', artists: [artistHandle],
    })
    const inbox = await caller(owner).businessEvents.inbox()
    expect(inbox.needs.find((n: any) => n.to === `/business/events/${draft.id}`)?.kind).toBe('draft')
    const missing = inbox.needs.find((n: any) => n.to === `/business/events/${live.id}`)
    expect(missing?.kind).toBe('missing')
    expect(missing?.detail).toContain('cover photo')
    expect(missing?.detail).toContain(`Instagram for @${artistHandle}`)
    expect(inbox.comingUp.map((c: any) => c.id)).toEqual(expect.arrayContaining([draft.id, live.id]))
    // The stranger sees nothing of this.
    const theirs = await caller(stranger).businessEvents.inbox()
    expect(theirs.comingUp).toHaveLength(0)
  })

  it('archive removes an event from the lists', async () => {
    const { upcoming } = await caller(owner).businessEvents.list()
    const target = upcoming.find((e: any) => e.name === `${tag} Draft`)!
    await caller(owner).businessEvents.archive({ id: target.id })
    const after = await caller(owner).businessEvents.list()
    expect(after.upcoming.some((e: any) => e.id === target.id)).toBe(false)
  })
})

function futureDate(days: number) {
  return new Date(Date.now() + days * 86400_000).toISOString().slice(0, 10)
}
