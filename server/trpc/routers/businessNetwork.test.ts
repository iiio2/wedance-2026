import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { inArray } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { appRouter } from '../index'

// Runs only against a local Postgres with migration 0042 applied:
//   DATABASE_URL=postgresql://dev:dev@localhost:5441/wedance \
//   NEON_FETCH_ENDPOINT=http://localhost:4444/sql bunx vitest run server/trpc/routers/businessNetwork.test.ts
const DATABASE_URL = process.env.DATABASE_URL

let db: any = null
if (DATABASE_URL) db = drizzle(neon(DATABASE_URL), { schema })

const caller = (dancerId: string | null) => appRouter.createCaller({ db, dancerId, isAdmin: false } as any)

const tag = `network-test-${Date.now()}`
const h = (s: string) => `${tag}-${s}`
let me: string
let stranger: string
const eventIds: string[] = []
const handles = ['mine', 'second', 'venue', 'organizer', 'artist', 'drafted', 'manual'].map(h)

describe.skipIf(!DATABASE_URL)('businessNetwork router', () => {
  beforeAll(async () => {
    const dancers = await db.insert(schema.dancers).values([
      { email: `${tag}-me@test.local`, name: 'Me' },
      { email: `${tag}-stranger@test.local`, name: 'Stranger' },
    ]).returning({ id: schema.dancers.id })
    me = dancers[0].id
    stranger = dancers[1].id

    const rows = await db.insert(schema.profiles).values([
      { username: h('mine'), type: 'artist', name: 'My Artist Page' },
      { username: h('second'), type: 'organizer', name: 'My Organizer Page' },
      { username: h('venue'), type: 'venue', name: 'Club Venue' },
      { username: h('organizer'), type: 'organizer', name: 'Party Organizer' },
      { username: h('artist'), type: 'artist', name: 'Fellow Artist' },
      { username: h('drafted'), type: 'organizer', name: 'Secret Booker' },
      { username: h('manual'), type: 'venue', name: 'Hand Added Venue' },
    ]).returning({ id: schema.profiles.id, username: schema.profiles.username })
    const id = (s: string) => rows.find((r: any) => r.username === h(s))!.id
    await db.insert(schema.profileMembers).values([
      { profileId: id('mine'), dancerId: me, role: 'owner' },
      { profileId: id('second'), dancerId: me, role: 'owner' },
    ])

    const evs = await db.insert(schema.events).values([
      // Published: I play at the venue, booked by the organizer, with a fellow artist.
      { name: `${tag} Social`, startDate: new Date('2026-09-01T20:00:00Z'), published: true, archived: false,
        venueUsername: h('venue'), organizerUsername: h('organizer'), artists: [h('mine'), h('artist')] },
      // Someone else's unpublished draft that lists me — must NOT leak who they book.
      { name: `${tag} Draft`, startDate: new Date('2026-11-01T20:00:00Z'), published: false,
        hostProfileId: id('drafted'), artists: [h('mine')] },
      // My own unpublished event hosts the venue — counts (it's mine).
      { name: `${tag} My Draft`, startDate: new Date('2026-12-01T20:00:00Z'), published: false,
        hostProfileId: id('second'), venueUsername: h('venue') },
    ]).returning({ id: schema.events.id })
    eventIds.push(...evs.map((e: any) => e.id))
  })

  afterAll(async () => {
    if (eventIds.length) await db.delete(schema.events).where(inArray(schema.events.id, eventIds))
    await db.delete(schema.profiles).where(inArray(schema.profiles.username, handles))
    await db.delete(schema.dancers).where(inArray(schema.dancers.id, [me, stranger]))
  })

  it('derives contacts from shared events, never from someone else’s draft', async () => {
    const { contacts } = await caller(me).businessNetwork.list({ username: h('mine') })
    const names = contacts.map(c => c.username)
    expect(names).toEqual(expect.arrayContaining([h('venue'), h('organizer'), h('artist')]))
    expect(names).not.toContain(h('drafted'))
    expect(names).not.toContain(h('mine'))
  })

  it('in "all pages" mode merges my pages and says which page knows whom', async () => {
    const { contacts } = await caller(me).businessNetwork.list()
    const venue = contacts.find(c => c.username === h('venue'))!
    expect(venue.sharedEvents).toBe(2)
    expect(venue.via).toEqual([h('mine'), h('second')].sort())
    expect(venue.next!.name).toBe(`${tag} My Draft`) // 2026-12-01, still ahead
    expect(venue.last!.name).toBe(`${tag} Social`) // 2026-09-01, already happened
    // My own other page is "Your pages", not a contact.
    expect(contacts.map(c => c.username)).not.toContain(h('second'))
  })

  it('hides a contact and restores it', async () => {
    await caller(me).businessNetwork.hide({ from: [h('mine')], username: h('artist') })
    let res = await caller(me).businessNetwork.list({ username: h('mine') })
    expect(res.contacts.map(c => c.username)).not.toContain(h('artist'))
    expect(res.hidden.map(c => c.username)).toContain(h('artist'))

    await caller(me).businessNetwork.restore({ from: [h('mine')], username: h('artist') })
    res = await caller(me).businessNetwork.list({ username: h('mine') })
    expect(res.contacts.map(c => c.username)).toContain(h('artist'))
    expect(res.hidden).toHaveLength(0)
  })

  it('adds someone by hand, and a removed hand-add disappears', async () => {
    await caller(me).businessNetwork.add({ from: h('mine'), username: h('manual') })
    let { contacts } = await caller(me).businessNetwork.list({ username: h('mine') })
    const manual = contacts.find(c => c.username === h('manual'))!
    expect(manual.added).toBe(true)
    expect(manual.sharedEvents).toBe(0)

    await caller(me).businessNetwork.restore({ from: [h('mine')], username: h('manual') })
    ;({ contacts } = await caller(me).businessNetwork.list({ username: h('mine') }))
    expect(contacts.map(c => c.username)).not.toContain(h('manual'))
  })

  it('refuses pages I don’t manage and adding my own page', async () => {
    await expect(caller(stranger).businessNetwork.list({ username: h('mine') })).rejects.toThrow('You don’t manage this profile.')
    await expect(caller(stranger).businessNetwork.add({ from: h('mine'), username: h('manual') })).rejects.toThrow('You don’t manage this profile.')
    await expect(caller(me).businessNetwork.add({ from: h('mine'), username: h('mine') })).rejects.toThrow('your own page')
    await expect(caller(null).businessNetwork.list()).rejects.toThrow('Not signed in')
  })
})
