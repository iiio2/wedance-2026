/**
 * C3 — the wedance.vip (v3) mirror against a real Postgres (RAZ-682): repeat
 * runs, delisting, source rollback and the profile ownership rules. Extends the
 * pure mapping tests in v3EventSync.test.ts / v3ProfileSync.test.ts with the
 * write path (syncV3Events / syncV3Profiles with write: true).
 *
 * Safety: the sync archives every upcoming wedance-v3 row it doesn't see, and the
 * documented rollback deletes the whole source. So each test runs inside ONE
 * transaction on a dedicated pg connection and ends with ROLLBACK — nothing here
 * is ever committed, even on a local copy of production. server/test-setup.ts
 * already refuses any non-local DATABASE_URL. The v3 side is synthetic docs; no
 * Firestore call is made.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { and, eq, inArray, sql } from 'drizzle-orm'
import * as schema from '../database/schema'
import { syncV3Events, V3_SOURCE } from './v3EventSync'
import { syncV3Profiles } from './v3ProfileSync'
import { appRouter } from '../trpc/index'

const DATABASE_URL = process.env.DATABASE_URL
const RUN = Math.random().toString(36).slice(2, 8)
const TOWN = `C3town ${RUN}`
const TOWN_SLUG = `c3town-${RUN}`
const DAY = 86400_000
const NOW = Date.now()

let client: pg.Client
let db: any

/** Runs fn in a transaction that is always rolled back. */
async function inRollback(fn: () => Promise<void>) {
  await client.query('BEGIN')
  try { await fn() }
  finally { await client.query('ROLLBACK') }
}

const venue = (name: string, street: string) => ({
  name, formatted_address: `${street}, 80000 ${TOWN}, Germany`,
  address_components: [{ long_name: TOWN, types: ['locality'] }, { long_name: 'Germany', short_name: 'DE', types: ['country'] }],
  geometry: { location: { lat: 48.1, lng: 11.5 } },
})
const doc = (n: number, extra: Record<string, any> = {}) => ({
  id: `c3-${RUN}-${n}`, type: 'event', name: `C3 Social ${n} ${RUN}`, eventType: 'Party', visibility: 'Public',
  startDate: NOW + (n + 1) * DAY, endDate: NOW + (n + 1) * DAY + 4 * 3600_000,
  venue: venue(`C3 Hall ${n} ${RUN}`, `Hallstraße ${n}`), styles: { Salsa: { selected: true } },
  link: `https://club.example/c3-${RUN}-${n}`, price: '12 €', ...extra,
})
const sync = (docs: any[], extra: Record<string, any> = {}) => syncV3Events({ db, docs, write: true, now: NOW, ...extra })
const mine = async () => db.select().from(schema.events).where(and(eq(schema.events.source, V3_SOURCE), sql`${schema.events.sourceId} like ${`c3-${RUN}-%`}`))
const bySource = async () => new Map((await mine()).map((r: any) => [r.sourceId, r]))

describe.skipIf(!DATABASE_URL)('C3 v3 mirror — write path (rolled back)', () => {
  beforeAll(async () => {
    client = new pg.Client({ connectionString: DATABASE_URL })
    await client.connect()
    db = drizzle(client, { schema })
  })
  afterAll(async () => { await client?.end() })

  // ── RAZ-697 ──────────────────────────────────────────────────────────────
  it('RAZ-697 repeating the same import changes nothing; a changed source field updates the same row', () => inRollback(async () => {
    const docs = [doc(1), doc(2), doc(3)]
    const first = await sync(docs)
    expect(first).toMatchObject({ created: 3, updated: 0, unchanged: 0 })
    const before = await bySource()
    expect(before.size).toBe(3)

    const second = await sync(docs)
    expect(second).toMatchObject({ created: 0, updated: 0, unchanged: 3 })
    const after = await bySource()
    expect(after.size).toBe(3)
    for (const [k, r] of before) expect((after.get(k) as any).id).toBe((r as any).id)

    const moved = NOW + 9 * DAY
    const third = await sync([doc(1, { name: `C3 Social renamed ${RUN}`, startDate: moved, endDate: moved + 3600_000 }), doc(2), doc(3)])
    expect(third).toMatchObject({ created: 0, updated: 1, unchanged: 2 })
    const updated = await bySource()
    expect(updated.size).toBe(3)
    const row: any = updated.get(`c3-${RUN}-1`)
    expect(row.id).toBe((before.get(`c3-${RUN}-1`) as any).id)
    expect(row.name).toBe(`C3 Social renamed ${RUN}`)
    expect(new Date(row.startDate).getTime()).toBe(moved)
  }))

  // ── RAZ-687 (data side) ──────────────────────────────────────────────────
  it('RAZ-687 an imported event keeps its website as "link" and gets no ticket URL', () => inRollback(async () => {
    await sync([doc(1)])
    const [row]: any[] = await mine()
    expect(row).toMatchObject({ link: `https://club.example/c3-${RUN}-1`, ticketUrl: null })
    const ev = await appRouter.createCaller({ db, dancerId: null, isAdmin: false } as any).events.get({ id: row.id })
    expect(ev).toMatchObject({ link: `https://club.example/c3-${RUN}-1`, ticketUrl: null })
  }))

  // ── RAZ-698 ──────────────────────────────────────────────────────────────
  it('RAZ-698 delisted or removed source events are archived; native and other-source events are untouched', () => inRollback(async () => {
    const base = { citySlug: TOWN_SLUG, city: TOWN, timezone: 'Europe/Berlin', published: true, archived: false, startDate: new Date(NOW + 2 * DAY), endDate: new Date(NOW + 2 * DAY + 3 * 3600_000) }
    const [native] = await db.insert(schema.events).values({ ...base, name: `Native ${RUN}` }).returning()
    const [other] = await db.insert(schema.events).values({ ...base, name: `Other source ${RUN}`, source: 'wedance-business', sourceId: `biz-${RUN}` }).returning()
    await sync([doc(1), doc(2), doc(3), doc(4)])
    // A person edited #4 on WeDance: theirs now, so v3 losing it doesn't archive it.
    await db.update(schema.events).set({ editedAt: new Date() }).where(and(eq(schema.events.source, V3_SOURCE), eq(schema.events.sourceId, `c3-${RUN}-4`)))

    // #2 removed from v3, #3 still there but Unlisted.
    await sync([doc(1), doc(3, { visibility: 'Unlisted' })])
    const rows = await bySource()
    expect((rows.get(`c3-${RUN}-1`) as any).archived).toBe(false)
    expect((rows.get(`c3-${RUN}-2`) as any).archived).toBe(true)
    expect((rows.get(`c3-${RUN}-3`) as any).archived).toBe(true)
    expect((rows.get(`c3-${RUN}-4`) as any).archived).toBe(false)

    const feed = await appRouter.createCaller({ db, dancerId: null, isAdmin: false } as any).events.byCity({ citySlug: TOWN_SLUG })
    const ids = feed.map((e: any) => e.id)
    expect(ids).toContain((rows.get(`c3-${RUN}-1`) as any).id)
    expect(ids).not.toContain((rows.get(`c3-${RUN}-2`) as any).id)
    expect(ids).not.toContain((rows.get(`c3-${RUN}-3`) as any).id)
    expect(ids).toEqual(expect.arrayContaining([native.id, other.id]))

    const [nativeAfter] = await db.select().from(schema.events).where(eq(schema.events.id, native.id))
    const [otherAfter] = await db.select().from(schema.events).where(eq(schema.events.id, other.id))
    expect(nativeAfter).toEqual(native)
    expect(otherAfter).toEqual(other)
  }))

  // ── RAZ-699 ──────────────────────────────────────────────────────────────
  it('RAZ-699 the documented rollback removes only the wedance-v3 source', () => inRollback(async () => {
    const base = { citySlug: TOWN_SLUG, city: TOWN, published: true, archived: false, startDate: new Date(NOW + 2 * DAY) }
    const [native] = await db.insert(schema.events).values({ ...base, name: `Native ${RUN}` }).returning()
    const [other] = await db.insert(schema.events).values({ ...base, name: `Other source ${RUN}`, source: 'wedance-business', sourceId: `biz-${RUN}` }).returning()
    const [nativeProfile] = await db.insert(schema.profiles).values({ username: `c3-native-${RUN}`, type: 'venue', name: `Native venue ${RUN}`, citySlug: TOWN_SLUG }).returning()
    const docs = [doc(1, { org: { id: `c3org-${RUN}`, username: `C3Org${RUN}`, name: `C3 Org ${RUN}` } })]
    const { plan } = await syncV3Profiles({ db, docs, v3Profiles: [], write: true, now: NOW })
    await sync(docs, { links: plan.links, extraProfiles: plan.newProfiles })
    expect((await mine())).toHaveLength(1)
    const syncedProfiles = await db.select().from(schema.profiles).where(sql`${schema.profiles.sourceRef}->>'source' = ${V3_SOURCE} and ${schema.profiles.citySlug} = ${TOWN_SLUG}`)
    expect(syncedProfiles.length).toBeGreaterThan(0)

    // CLAUDE.md "wedance.vip → 2026 event sync": profile rollback (links first), then events.
    await db.execute(sql`UPDATE events SET venue_username=NULL, artists='[]' WHERE source='wedance-v3'`)
    await db.execute(sql`DELETE FROM profiles WHERE source_ref->>'source'='wedance-v3'`)
    await db.execute(sql`DELETE FROM events WHERE source='wedance-v3'`)

    expect(await mine()).toHaveLength(0)
    expect(await db.select().from(schema.profiles).where(inArray(schema.profiles.id, syncedProfiles.map((p: any) => p.id)))).toHaveLength(0)
    expect((await db.select().from(schema.events).where(eq(schema.events.id, native.id)))[0]).toEqual(native)
    expect((await db.select().from(schema.events).where(eq(schema.events.id, other.id)))[0]).toEqual(other)
    expect((await db.select().from(schema.profiles).where(eq(schema.profiles.id, nativeProfile.id)))[0]).toEqual(nativeProfile)
  }))

  // ── RAZ-700 ──────────────────────────────────────────────────────────────
  it('RAZ-700 repeated profile sync: no duplicates, claimed untouched, others filled only where empty, own rows follow v3', () => inRollback(async () => {
    const town = { city: TOWN, citySlug: TOWN_SLUG }
    const [claimed] = await db.insert(schema.profiles).values({ username: `c3-claimed-${RUN}`, type: 'venue', name: `C3 Hall 1 ${RUN}`, claimed: true, bio: null, photo: null, ...town }).returning()
    const [unrelated] = await db.insert(schema.profiles).values({ username: `c3-unrelated-${RUN}`, type: 'organizer', name: `Their Name ${RUN}`, bio: null, photo: 'https://img.example/theirs.png', sourceRef: { firebaseId: `v3-unrelated-${RUN}` }, ...town }).returning()
    const [own] = await db.insert(schema.profiles).values({ username: `c3-own-${RUN}`, type: 'organizer', name: `Own Old ${RUN}`, bio: 'old bio', sourceRef: { source: V3_SOURCE, sourceId: `v3-own-${RUN}` }, ...town }).returning()
    const place = `c3place-${RUN}`
    const v3Profiles = [
      { id: `v3-unrelated-${RUN}`, type: 'Organiser', username: `Unrelated${RUN}`, name: `V3 Name ${RUN}`, bio: 'v3 bio', photo: 'https://img.example/v3.png', visibility: 'Public', place },
      { id: `v3-own-${RUN}`, type: 'Organiser', username: `Own${RUN}`, name: `Own New ${RUN}`, bio: 'new bio', visibility: 'Public', place },
      { id: `v3-fresh-${RUN}`, type: 'Organiser', username: `Fresh${RUN}`, name: `Fresh ${RUN}`, visibility: 'Public', place },
    ]
    const docs = [
      doc(1, { org: { id: `v3-unrelated-${RUN}`, username: `Unrelated${RUN}` } }), // venue = the claimed hall (name + city)
      doc(2, { org: { id: `v3-own-${RUN}`, username: `Own${RUN}` } }),
      doc(3, { org: { id: `v3-fresh-${RUN}`, username: `Fresh${RUN}` } }),
    ]
    const count = async () => (await db.select({ n: sql<number>`count(*)::int` }).from(schema.profiles).where(eq(schema.profiles.citySlug, TOWN_SLUG)))[0].n

    const first = await syncV3Profiles({ db, docs, v3Profiles, write: true, now: NOW })
    expect(first.plan.links.get(`c3-${RUN}-1`)!.venueUsername).toBe(`c3-claimed-${RUN}`)
    const afterFirst = await count()
    const second = await syncV3Profiles({ db, docs, v3Profiles, write: true, now: NOW })
    expect(second.plan.ops.filter(o => o.op === 'create')).toHaveLength(0)
    expect(await count()).toBe(afterFirst)
    expect([...second.plan.links]).toEqual([...first.plan.links])
    // No duplicate per handle / per v3 id.
    const rows = await db.select().from(schema.profiles).where(eq(schema.profiles.citySlug, TOWN_SLUG))
    expect(new Set(rows.map((r: any) => r.username.toLowerCase())).size).toBe(rows.length)
    const v3Ids = rows.map((r: any) => r.sourceRef?.sourceId ?? r.sourceRef?.firebaseId).filter(Boolean)
    expect(new Set(v3Ids).size).toBe(v3Ids.length)

    const get = async (id: string) => (await db.select().from(schema.profiles).where(eq(schema.profiles.id, id)))[0]
    expect(await get(claimed.id)).toEqual(claimed) // claimed: never written
    expect(await get(unrelated.id)).toMatchObject({ name: `Their Name ${RUN}`, photo: 'https://img.example/theirs.png', bio: 'v3 bio' }) // only the empty bio filled
    expect(await get(own.id)).toMatchObject({ name: `Own New ${RUN}`, bio: 'new bio' }) // ours: follows v3
  }))
})
