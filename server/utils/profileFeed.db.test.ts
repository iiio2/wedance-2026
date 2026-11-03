import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { inArray } from 'drizzle-orm'
import * as schema from '../database/schema'
import { profileFeedEvents } from './profileFeed'

// #484: an artist's feed (their website's schedule) lists the events they're in
// the line-up of, not only the ones they host or organize.
// Local Postgres only:
//   DATABASE_URL=postgresql://dev:dev@localhost:5441/wedance NEON_FETCH_ENDPOINT=http://localhost:4444/sql bunx vitest run server/utils/profileFeed.db.test.ts
const DATABASE_URL = process.env.DATABASE_URL
const db: any = DATABASE_URL ? drizzle(neon(DATABASE_URL), { schema }) : null

vi.stubGlobal('useRuntimeConfig', () => ({ siteUrl: 'http://localhost:3000' }))

const tag = `feed484-${Date.now()}`
const DAY = 86400_000
const soon = (days: number) => new Date(Date.now() + days * DAY)
let artist: { id: string; username: string; name: string }
const eventIds: string[] = []

async function event(name: string, values: Partial<typeof schema.events.$inferInsert>) {
  const [e] = await db.insert(schema.events).values({
    name: `${tag} ${name}`, startDate: soon(7), published: true, archived: false, organizerUsername: `${tag}-host`, ...values,
  }).returning({ id: schema.events.id })
  eventIds.push(e.id)
}

describe.skipIf(!DATABASE_URL)('profile feed (#484)', () => {
  beforeAll(async () => {
    ;[artist] = await db.insert(schema.profiles).values({ username: `${tag}-milaila`, type: 'artist', name: 'Milaila' })
      .returning({ id: schema.profiles.id, username: schema.profiles.username, name: schema.profiles.name })
    const handle = artist.username
    await event('workshop she teaches', { artists: ['someone-else', handle.toUpperCase()] })
    await event('night she organizes and teaches at', { organizerUsername: handle, artists: [handle] })
    await event('draft with her', { artists: [handle], published: false })
    await event('archived with her', { artists: [handle], archived: true })
    await event('past with her', { artists: [handle], startDate: soon(-7) })
    await event('too far ahead', { artists: [handle], startDate: soon(400) })
    await event('without her', { artists: ['someone-else'] })
  })

  afterAll(async () => {
    if (eventIds.length) await db.delete(schema.events).where(inArray(schema.events.id, eventIds))
    if (artist) await db.delete(schema.profiles).where(inArray(schema.profiles.id, [artist.id]))
  })

  it('lists the events she is in the line-up of, once each, next to her own', async () => {
    const names = (await profileFeedEvents(db, artist, 60)).map(e => e.name.replace(`${tag} `, ''))
    expect(names.sort()).toEqual(['night she organizes and teaches at', 'workshop she teaches'])
  })
})
