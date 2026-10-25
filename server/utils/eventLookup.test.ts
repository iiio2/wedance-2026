/**
 * eventPageExists — what /events/<param> resolves to (shared with events.get).
 * Postgres only; fixtures removed in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { like } from 'drizzle-orm'
import * as schema from '../database/schema'
import { eventPageExists } from './eventLookup'
import { eventSlug } from '../../shared/utils/eventSlug'
import { appRouter } from '../trpc/index'

const DATABASE_URL = process.env.DATABASE_URL
const db: any = DATABASE_URL ? drizzle(neon(DATABASE_URL), { schema }) : null
const RUN = Math.random().toString(36).slice(2, 8)
const ids: Record<string, string> = {}

describe.skipIf(!DATABASE_URL)('eventPageExists', () => {
  beforeAll(async () => {
    const base = { citySlug: `testville-${RUN}`, startDate: new Date(Date.now() + 86400_000), archived: false }
    const [pub] = await db.insert(schema.events).values({ ...base, name: `Live night ${RUN}`, published: true, slug: `live-night-${RUN}` }).returning({ id: schema.events.id })
    const [fest] = await db.insert(schema.events).values({ ...base, name: `Fest ${RUN}`, published: true, festival: { key: `fest-key-${RUN}`, sessions: [{ id: 's-abc', date: '2026-10-25', time: '19:00', duration: 60, type: 'workshop', title: 'Taster', artist: '', style: 'Salsa', level: 'Beginner' }] } as any }).returning({ id: schema.events.id })
    const [hidden] = await db.insert(schema.events).values({ ...base, name: `Hidden ${RUN}`, published: false, slug: `hidden-${RUN}`, festival: { key: `hidden-key-${RUN}` } as any }).returning({ id: schema.events.id })
    ids.pub = pub.id; ids.fest = fest.id; ids.hidden = hidden.id
  })

  afterAll(async () => {
    await db.delete(schema.events).where(like(schema.events.name, `% ${RUN}`))
  })

  it('finds a published event by id, slug, festival key and name-short-id URL', async () => {
    expect(await eventPageExists(db, ids.pub!)).toBe(true)
    expect(await eventPageExists(db, `live-night-${RUN}`)).toBe(true)
    expect(await eventPageExists(db, `fest-key-${RUN}`)).toBe(true)
    expect(await eventPageExists(db, eventSlug({ id: ids.pub!, name: `Live night ${RUN}` }))).toBe(true)
  })

  it('finds a festival programme item by f~<key>~<session id>', async () => {
    expect(await eventPageExists(db, `f~fest-key-${RUN}~s-abc`)).toBe(true)
    expect(await eventPageExists(db, `f~fest-key-${RUN}~s-nope`)).toBe(false)
    expect(await eventPageExists(db, `f~hidden-key-${RUN}~s-abc`)).toBe(false)
  })

  it('treats an unpublished event as not found — by id, slug or festival key', async () => {
    expect(await eventPageExists(db, ids.hidden!)).toBe(false)
    expect(await eventPageExists(db, `hidden-${RUN}`)).toBe(false)
    expect(await eventPageExists(db, `hidden-key-${RUN}`)).toBe(false)
  })

  it('does not find what isn\'t there', async () => {
    expect(await eventPageExists(db, `no-such-event-${RUN}`)).toBe(false)
    expect(await eventPageExists(db, '00000000-0000-4000-8000-000000000000')).toBe(false)
  })

  it('agrees with events.get: unpublished → NOT_FOUND, published → the event', async () => {
    const caller = appRouter.createCaller({ db, dancerId: null, isAdmin: false } as any)
    await expect(caller.events.get({ id: `hidden-key-${RUN}` })).rejects.toThrow(/not found/i)
    expect((await caller.events.get({ id: `fest-key-${RUN}` })).id).toBe(ids.fest)
  })
})
