/**
 * C3 — Going, attendance sharing and the discovery pool, against a real Postgres
 * (RAZ-682). Runs only on a local database (server/test-setup.ts drops any remote
 * DATABASE_URL); every fixture is synthetic, suffixed with this run's id, and
 * removed in afterAll.
 *
 * Two public-eligibility rules exist today and are asserted SEPARATELY, never
 * unified (RAZ-314 / RAZ-312 are not settled for ordinary events):
 *  - legacy festival path (plan.goingList itemType=festival, /festivals cards):
 *    verified ticket holders only;
 *  - ordinary events (plan.goingList itemType=event, wave.discoverPool): dancers
 *    who are Going AND opted in (plan_items.share_going) with a public profile;
 *  - new attendance API (attendance.publicList / counts, ADR-008, not yet read by
 *    any page): status going|ticket_holder, visibility <> hidden, public profile.
 * Going is a planning action: none of these tests treat it as a ticket.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, eq, inArray, like } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { appRouter } from '../index'
import { listFestivals } from '../../utils/festivalListing'

const DATABASE_URL = process.env.DATABASE_URL
const db: any = DATABASE_URL ? drizzle(neon(DATABASE_URL), { schema }) : null

const RUN = Math.random().toString(36).slice(2, 8)
const CITY = `c3going-${RUN}`
const DAY = 86400_000
const ids: Record<string, string> = {}
const caller = (dancerId: string | null, database: any = db) => appRouter.createCaller({ db: database, dancerId, isAdmin: false } as any)
const anon = () => caller(null)

async function addDancer(key: string, values: Partial<typeof schema.dancers.$inferInsert> = {}) {
  const [row] = await db.insert(schema.dancers).values({
    email: `${key}-${RUN}@test.wedance.local`,
    name: `${key} ${RUN}`,
    username: `c3-${key.toLowerCase()}-${RUN}`,
    city: 'C3 City',
    profilePublic: true,
    photo: `https://example.com/${key}-${RUN}.jpg`,
    ...values,
  }).returning({ id: schema.dancers.id })
  ids[key] = row.id
  return row.id as string
}

async function addEvent(key: string, values: Partial<typeof schema.events.$inferInsert> = {}) {
  const start = new Date(Date.now() + 2 * DAY)
  const [row] = await db.insert(schema.events).values({
    name: `${key} ${RUN}`,
    type: 'Party',
    citySlug: CITY,
    city: 'C3 City',
    timezone: 'Europe/Berlin',
    styles: ['Salsa'],
    startDate: start,
    endDate: new Date(start.getTime() + 4 * 3600_000),
    published: true,
    archived: false,
    ...values,
  }).returning({ id: schema.events.id })
  ids[key] = row.id
  return row.id as string
}

const attend = (event: string, dancer: string, status: string, visibility: string, extra: Record<string, unknown> = {}) =>
  db.insert(schema.attendances).values({ eventId: ids[event], dancerId: ids[dancer], status, visibility, ...extra })

const planRows = (dancer: string, itemId: string) => db.select().from(schema.planItems)
  .where(and(eq(schema.planItems.dancerId, ids[dancer]!), eq(schema.planItems.itemId, itemId)))
const attendanceRow = async (event: string, dancer: string) => (await db.select().from(schema.attendances)
  .where(and(eq(schema.attendances.eventId, ids[event]!), eq(schema.attendances.dancerId, ids[dancer]!))))[0] ?? null

describe.skipIf(!DATABASE_URL)('C3 Going journey — integration', () => {
  beforeAll(async () => {
    for (const k of ['a', 'b', 'minimal', 'hiddenD', 'ticket', 'interested', 'viewer', 'goer', 'holder', 'other']) await addDancer(k)
    await addDancer('priv', { profilePublic: false })
    await addDancer('noPhoto', { photo: null })
    await addDancer('emptyPhoto', { photo: '' })
    await addDancer('cityLocal') // same city, public, photo — but not going
    for (const k of ['evA', 'evB', 'evPlan', 'evShare', 'evIso', 'evIso2', 'evCount', 'evCount2', 'evPool', 'evPool2', 'evDual', 'evTicket']) await addEvent(k)
  })

  afterAll(async () => {
    const dancerIds = Object.entries(ids).filter(([k]) => !k.startsWith('ev') && !k.startsWith('fest')).map(([, v]) => v)
    await db.delete(schema.festivalWaves).where(inArray(schema.festivalWaves.dancerId, dancerIds))
    await db.delete(schema.festivalSignups).where(inArray(schema.festivalSignups.dancerId, dancerIds))
    await db.delete(schema.planItems).where(inArray(schema.planItems.dancerId, dancerIds))
    await db.delete(schema.attendances).where(inArray(schema.attendances.dancerId, dancerIds))
    await db.delete(schema.festivals).where(like(schema.festivals.slug, `%-${RUN}`))
    await db.delete(schema.events).where(like(schema.events.name, `% ${RUN}`))
    await db.delete(schema.dancers).where(like(schema.dancers.email, `%-${RUN}@test.wedance.local`))
  })

  // ── RAZ-690 ──────────────────────────────────────────────────────────────
  describe('RAZ-690 attendance API: privacy and field projection (new ADR-008 rule)', () => {
    beforeAll(async () => {
      await attend('evA', 'a', 'going', 'public_full')
      await attend('evA', 'minimal', 'going', 'public_minimal')
      await attend('evA', 'hiddenD', 'going', 'hidden')
      await attend('evA', 'priv', 'going', 'public_full')
      await attend('evA', 'ticket', 'ticket_holder', 'public_full', { source: 'stripe', verifiedAt: new Date() })
      await attend('evA', 'interested', 'interested', 'public_full')
      await attend('evB', 'b', 'going', 'public_full')
    })

    it('lists only non-hidden going / ticket holders with public profiles, for this event only', async () => {
      const { attendees } = await anon().attendance.publicList({ eventId: ids.evA! })
      expect(attendees.map(a => a.dancerId).sort()).toEqual([ids.a, ids.minimal, ids.ticket].sort())
      // hidden attendance, private profile, "interested" and event B's attendee are absent
      for (const k of ['hiddenD', 'priv', 'interested', 'b']) expect(attendees.some(a => a.dancerId === ids[k])).toBe(false)
    })

    it('projects minimal vs full visibility and exposes no private fields', async () => {
      const { attendees } = await anon().attendance.publicList({ eventId: ids.evA! })
      const by = (k: string) => attendees.find(a => a.dancerId === ids[k])!
      expect(by('a').photo).toBe(`https://example.com/a-${RUN}.jpg`)
      expect(by('minimal').photo).toBeNull() // public_minimal → no face
      expect(by('minimal').name).toBe(`minimal ${RUN}`)
      for (const a of attendees) expect(Object.keys(a).sort()).toEqual(['city', 'dancerId', 'name', 'photo', 'username', 'verified'])
      expect(JSON.stringify(attendees)).not.toContain('@test.wedance.local')
    })

    it('keeps Going and verified-ticket status apart: only ticket holders are verified', async () => {
      const { attendees, counts } = await anon().attendance.publicList({ eventId: ids.evA! })
      expect(attendees.find(a => a.dancerId === ids.ticket)!.verified).toBe(true)
      expect(attendees.find(a => a.dancerId === ids.a)!.verified).toBe(false)
      expect(attendees.find(a => a.dancerId === ids.minimal)!.verified).toBe(false)
      // Counts include hidden attendees (counted, never listed); "interested" is not Going.
      expect(counts).toEqual({ going: 4, verified: 1, hidden: 1 })
    })

    it('card faces come only from public_full, public profiles with a photo, per event', async () => {
      const res = await anon().attendance.counts({ eventIds: [ids.evA!, ids.evB!] })
      expect(res[ids.evA!]!.faces.sort()).toEqual([`https://example.com/a-${RUN}.jpg`, `https://example.com/ticket-${RUN}.jpg`].sort())
      expect(res[ids.evA!]).toMatchObject({ going: 4, verified: 1 })
      expect(res[ids.evB!]).toEqual({ going: 1, verified: 0, faces: [`https://example.com/b-${RUN}.jpg`] })
    })
  })

  // ── RAZ-691 ──────────────────────────────────────────────────────────────
  describe('RAZ-691 a click never grants or downgrades ticket ownership', () => {
    beforeAll(async () => {
      await attend('evTicket', 'holder', 'ticket_holder', 'public_minimal', { source: 'stripe', verifiedAt: new Date('2026-10-01T10:00:00Z') })
    })

    it('Going via attendance.set is a hidden click, never a verified ticket', async () => {
      expect(await caller(ids.goer!).attendance.set({ eventId: ids.evTicket!, status: 'going' })).toEqual({ status: 'going' })
      expect(await attendanceRow('evTicket', 'goer')).toMatchObject({ status: 'going', source: 'click', visibility: 'hidden', verifiedAt: null })
      const { attendees, counts } = await anon().attendance.publicList({ eventId: ids.evTicket! })
      expect(attendees.some(a => a.dancerId === ids.goer)).toBe(false)
      expect(counts.verified).toBe(1)
    })

    it('Going via plan.add (dual-write) is also a click, never a verified ticket', async () => {
      await caller(ids.other!).plan.add({ itemType: 'event', itemId: ids.evTicket! })
      expect(await attendanceRow('evTicket', 'other')).toMatchObject({ status: 'going', source: 'click', verifiedAt: null })
    })

    it('a ticket holder clicking Going / Interested / not going keeps the verified ticket', async () => {
      const me = caller(ids.holder!)
      expect(await me.attendance.set({ eventId: ids.evTicket!, status: 'going' })).toEqual({ status: 'ticket_holder' })
      expect(await me.attendance.set({ eventId: ids.evTicket!, status: 'interested' })).toEqual({ status: 'ticket_holder' })
      await me.attendance.set({ eventId: ids.evTicket!, status: 'none' })
      expect(await attendanceRow('evTicket', 'holder')).toMatchObject({ status: 'ticket_holder', source: 'stripe', verifiedAt: new Date('2026-10-01T10:00:00Z') })
    })

    it('adding and removing the event in the plan keeps the verified ticket', async () => {
      const me = caller(ids.holder!)
      await me.plan.add({ itemType: 'event', itemId: ids.evTicket! })
      await me.plan.remove({ itemType: 'event', itemId: ids.evTicket! })
      expect(await attendanceRow('evTicket', 'holder')).toMatchObject({ status: 'ticket_holder', source: 'stripe' })
      expect(await planRows('holder', ids.evTicket!)).toHaveLength(0)
    })
  })

  // ── RAZ-704 ──────────────────────────────────────────────────────────────
  describe('RAZ-704 Going persists across fresh sessions and undo sticks', () => {
    it('repeated add keeps one plan row and one attendance row', async () => {
      await caller(ids.viewer!).plan.add({ itemType: 'event', itemId: ids.evPlan! })
      await caller(ids.viewer!).plan.add({ itemType: 'event', itemId: ids.evPlan! })
      expect(await planRows('viewer', ids.evPlan!)).toHaveLength(1)
      const att = await db.select().from(schema.attendances).where(and(eq(schema.attendances.eventId, ids.evPlan!), eq(schema.attendances.dancerId, ids.viewer!)))
      expect(att).toHaveLength(1)
    })

    it('a fresh authenticated query sees the Going; the public count is 1', async () => {
      const fresh = caller(ids.viewer!) // a new request context, nothing cached
      expect(await fresh.plan.list()).toContainEqual({ itemType: 'event', itemId: ids.evPlan })
      expect(await anon().plan.count({ itemType: 'event', itemId: ids.evPlan! })).toBe(1)
    })

    it('undo removes it, and it stays removed on the next load', async () => {
      await caller(ids.viewer!).plan.remove({ itemType: 'event', itemId: ids.evPlan! })
      for (let load = 0; load < 2; load++) {
        expect(await caller(ids.viewer!).plan.list()).not.toContainEqual({ itemType: 'event', itemId: ids.evPlan })
      }
      expect(await anon().plan.count({ itemType: 'event', itemId: ids.evPlan! })).toBe(0)
      expect(await attendanceRow('evPlan', 'viewer')).toBeNull()
    })
  })

  // ── RAZ-705 ──────────────────────────────────────────────────────────────
  describe('RAZ-705 plan mutations are isolated per signed-in dancer', () => {
    beforeAll(async () => {
      await caller(ids.b!).plan.add({ itemType: 'event', itemId: ids.evIso! })
      await caller(ids.b!).plan.setShareGoing({ itemType: 'event', itemId: ids.evIso!, share: true })
      await caller(ids.b!).attendance.setVisibility({ eventId: ids.evIso!, visibility: 'public_full' })
    })

    it('dancer A cannot remove, hide or change B\'s Going', async () => {
      const a = caller(ids.a!)
      await a.plan.remove({ itemType: 'event', itemId: ids.evIso! })
      await a.plan.setShareGoing({ itemType: 'event', itemId: ids.evIso!, share: false })
      await a.attendance.set({ eventId: ids.evIso!, status: 'none' })
      await expect(a.attendance.setVisibility({ eventId: ids.evIso!, visibility: 'hidden' })).rejects.toMatchObject({ code: 'NOT_FOUND' })
      await expect(a.attendance.updateLogistics({ eventId: ids.evIso!, travelBooked: true })).rejects.toMatchObject({ code: 'NOT_FOUND' })

      const [bRow] = await planRows('b', ids.evIso!)
      expect(bRow).toMatchObject({ shareGoing: true })
      expect(await attendanceRow('evIso', 'b')).toMatchObject({ status: 'going', visibility: 'public_full', travelBookedAt: null })
      expect(await planRows('a', ids.evIso!)).toHaveLength(0)
    })

    it('anonymous Going attempts are rejected and create no rows', async () => {
      const before = await anon().plan.count({ itemType: 'event', itemId: ids.evIso2! })
      await expect(anon().plan.add({ itemType: 'event', itemId: ids.evIso2! })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
      await expect(anon().attendance.set({ eventId: ids.evIso2!, status: 'going' })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
      await expect(anon().plan.setShareGoing({ itemType: 'event', itemId: ids.evIso2!, share: true })).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
      expect(await anon().plan.count({ itemType: 'event', itemId: ids.evIso2! })).toBe(before)
      expect(await db.select().from(schema.attendances).where(eq(schema.attendances.eventId, ids.evIso2!))).toHaveLength(0)
    })

    it('a mutation on one event leaves other events unchanged', async () => {
      await caller(ids.a!).plan.add({ itemType: 'event', itemId: ids.evIso2! })
      await caller(ids.a!).plan.remove({ itemType: 'event', itemId: ids.evIso2! })
      expect(await planRows('b', ids.evIso!)).toHaveLength(1)
      expect(await anon().plan.count({ itemType: 'event', itemId: ids.evIso! })).toBe(1)
    })
  })

  // ── RAZ-706 ──────────────────────────────────────────────────────────────
  describe('RAZ-706 attendance sharing: hidden by default, explicit opt-in, revocable', () => {
    const list = (who: ReturnType<typeof caller>) => who.plan.goingList({ itemType: 'event', itemId: ids.evShare! })

    it('a new Going is hidden — for anonymous and for another dancer', async () => {
      await caller(ids.goer!).plan.add({ itemType: 'event', itemId: ids.evShare! })
      expect((await planRows('goer', ids.evShare!))[0]).toMatchObject({ shareGoing: false })
      expect(await attendanceRow('evShare', 'goer')).toMatchObject({ visibility: 'hidden' })
      expect(await caller(ids.goer!).plan.getShareGoing({ itemType: 'event', itemId: ids.evShare! })).toEqual({ share: false })
      expect(await list(anon())).toEqual([])
      expect(await list(caller(ids.viewer!))).toEqual([])
    })

    it('opting in shows the dancer (public fields only) to anonymous and to another dancer', async () => {
      await caller(ids.goer!).plan.setShareGoing({ itemType: 'event', itemId: ids.evShare!, share: true })
      for (const who of [anon(), caller(ids.viewer!)]) {
        const res = await list(who)
        expect(res.map(r => r.dancerId)).toEqual([ids.goer])
        expect(Object.keys(res[0]!).sort()).toEqual(['city', 'dancerId', 'name', 'photo', 'username'])
      }
    })

    it('opting in with a private profile still shows nobody', async () => {
      await caller(ids.priv!).plan.add({ itemType: 'event', itemId: ids.evShare! })
      await caller(ids.priv!).plan.setShareGoing({ itemType: 'event', itemId: ids.evShare!, share: true })
      expect((await list(anon())).some(r => r.dancerId === ids.priv)).toBe(false)
    })

    it('opting out hides the dancer again, and it stays hidden on reload', async () => {
      await caller(ids.goer!).plan.setShareGoing({ itemType: 'event', itemId: ids.evShare!, share: false })
      for (let load = 0; load < 2; load++) {
        expect((await list(anon())).some(r => r.dancerId === ids.goer)).toBe(false)
        expect((await list(caller(ids.viewer!))).some(r => r.dancerId === ids.goer)).toBe(false)
      }
      expect(await caller(ids.goer!).plan.getShareGoing({ itemType: 'event', itemId: ids.evShare! })).toEqual({ share: false })
      // Still Going (planning) — only the visibility changed.
      expect(await planRows('goer', ids.evShare!)).toHaveLength(1)
    })

    it('legacy festival path keeps its own rule: opting in without a verified ticket shows nobody', async () => {
      const slug = `c3-fest-${RUN}`
      const [f] = await db.insert(schema.festivals).values({ slug, name: `C3 Fest ${RUN}` }).returning({ id: schema.festivals.id })
      ids.festLegacy = f.id
      await caller(ids.goer!).plan.add({ itemType: 'festival', itemId: slug })
      await caller(ids.goer!).plan.setShareGoing({ itemType: 'festival', itemId: slug, share: true })
      expect(await anon().plan.goingList({ itemType: 'festival', itemId: slug })).toEqual([])
      // A verified ticket holder with the (legacy) default roster visibility is listed.
      await db.insert(schema.festivalSignups).values({ festivalId: f.id, dancerId: ids.ticket, verifiedTicketHolder: true })
      expect((await anon().plan.goingList({ itemType: 'festival', itemId: slug })).map(r => r.dancerId)).toEqual([ids.ticket])
    })
  })

  // ── RAZ-707 ──────────────────────────────────────────────────────────────
  describe('RAZ-707 planning counts vs public faces', () => {
    beforeAll(async () => {
      for (const k of ['a', 'hiddenD', 'priv']) await caller(ids[k]!).plan.add({ itemType: 'event', itemId: ids.evCount! })
      await caller(ids.a!).plan.setShareGoing({ itemType: 'event', itemId: ids.evCount!, share: true })
      await caller(ids.priv!).plan.setShareGoing({ itemType: 'event', itemId: ids.evCount!, share: true })
      await caller(ids.b!).plan.add({ itemType: 'event', itemId: ids.evCount2! })
      await caller(ids.b!).plan.setShareGoing({ itemType: 'event', itemId: ids.evCount2!, share: true })
    })

    it('the anonymous planning count includes hidden Going', async () => {
      expect(await anon().plan.count({ itemType: 'event', itemId: ids.evCount! })).toBe(3)
      expect(await anon().plan.countBatch({ itemType: 'event', itemIds: [ids.evCount!, ids.evCount2!] }))
        .toEqual({ [ids.evCount!]: 3, [ids.evCount2!]: 1 })
    })

    it('faces show only eligible visible attendees, and never cross events', async () => {
      const faces = await anon().plan.goingBatch({ itemType: 'event', itemIds: [ids.evCount!, ids.evCount2!] })
      expect(faces[ids.evCount!]!.map(f => f.name)).toEqual([`a ${RUN}`])
      expect(faces[ids.evCount2!]!.map(f => f.name)).toEqual([`b ${RUN}`])
      const json = JSON.stringify(faces)
      for (const k of ['hiddenD', 'priv']) expect(json).not.toContain(`${k} ${RUN}`)
    })

    it('hidden Going is counted but never exposed by the attendance API either', async () => {
      const { attendees, counts } = await anon().attendance.publicList({ eventId: ids.evCount! })
      expect(counts.going).toBe(3)
      // plan.setShareGoing does not touch attendances.visibility (dual-write covers add/remove only,
      // follow-up RAZ-722), so the new API still lists nobody here.
      expect(attendees).toEqual([])
    })

    // Legacy festival path (/festivals cards): the +N overflow badge is publicGoingCount - 5.
    // KNOWN DEFECT (follow-up RAZ-720): publicGoingCount counts verified public ticket
    // holders WITHOUT the roster_visibility <> 'hidden' filter the avatars use, so a hidden
    // holder inflates "+N". Expected to fail until fixed — flip to it() then.
    it.fails('festival avatar overflow counts only attendees eligible to be shown', async () => {
      const key = `c3-overflow-${RUN}`
      const [f] = await db.insert(schema.festivals).values({ slug: key, name: `C3 Overflow ${RUN}` }).returning({ id: schema.festivals.id })
      ids.festOverflow = f.id
      const start = new Date(Date.now() + 30 * DAY)
      await addEvent('evOverflow', { isFestival: true, type: 'Festival', festival: { key } as any, startDate: start, endDate: new Date(start.getTime() + 2 * DAY) })
      const holders = ['a', 'b', 'minimal', 'ticket', 'viewer', 'goer']
      for (const k of holders) await db.insert(schema.festivalSignups).values({ festivalId: f.id, dancerId: ids[k], verifiedTicketHolder: true })
      await db.insert(schema.festivalSignups).values({ festivalId: f.id, dancerId: ids.hiddenD, verifiedTicketHolder: true, rosterVisibility: 'hidden' })
      const row = (await listFestivals(db)).find(r => r.name === `evOverflow ${RUN}`)!
      expect(row.goingAvatars).toHaveLength(5)
      expect(row.publicGoingCount).toBe(holders.length) // 6 eligible → "+1", not "+2"
    })
  })

  // ── RAZ-708 ──────────────────────────────────────────────────────────────
  describe('RAZ-708 discovery pool = opted-in public attendees of this exact event', () => {
    beforeAll(async () => {
      const goingShared = async (k: string, ev = 'evPool') => {
        await caller(ids[k]!).plan.add({ itemType: 'event', itemId: ids[ev]! })
        await caller(ids[k]!).plan.setShareGoing({ itemType: 'event', itemId: ids[ev]!, share: true })
      }
      await goingShared('a') // eligible
      await goingShared('noPhoto') // no photo
      await goingShared('emptyPhoto') // empty photo
      await goingShared('priv') // private profile
      await goingShared('b', 'evPool2') // other event
      await goingShared('viewer') // the caller themselves
      await caller(ids.minimal!).plan.add({ itemType: 'event', itemId: ids.evPool! }) // going, not shared
    })

    it('contains only eligible dancers, never the caller or arbitrary city profiles', async () => {
      const pool = await caller(ids.viewer!).wave.discoverPool({ festivalSlug: ids.evPool!, itemType: 'event' })
      expect(pool.map(p => p.id)).toEqual([ids.a])
      expect(pool[0]!.photo).toBe(`https://example.com/a-${RUN}.jpg`)
      for (const k of ['cityLocal', 'noPhoto', 'emptyPhoto', 'priv', 'b', 'minimal', 'viewer']) expect(pool.some(p => p.id === ids[k])).toBe(false)
    })

    it('an event with no opted-in attendees yields an empty pool (no filler)', async () => {
      const pool = await caller(ids.viewer!).wave.discoverPool({ festivalSlug: ids.evIso2!, itemType: 'event' })
      expect(pool).toEqual([])
    })
  })

  // ── RAZ-710 ──────────────────────────────────────────────────────────────
  describe('RAZ-710 plan ↔ attendance dual-write (expand phase only)', () => {
    it('event add/remove mirrors into attendances with the event id, hidden by default', async () => {
      const me = caller(ids.interested!)
      await me.plan.add({ itemType: 'event', itemId: ids.evDual! })
      expect(await attendanceRow('evDual', 'interested')).toMatchObject({ eventId: ids.evDual, status: 'going', source: 'click', visibility: 'hidden' })
      await me.plan.remove({ itemType: 'event', itemId: ids.evDual! })
      expect(await attendanceRow('evDual', 'interested')).toBeNull()
    })

    it('a festival slug maps to its event row (canonical event id)', async () => {
      const key = `c3-dual-fest-${RUN}`
      await addEvent('evDualFest', { isFestival: true, type: 'Festival', festival: { key } as any })
      await caller(ids.interested!).plan.add({ itemType: 'festival', itemId: key })
      expect(await planRows('interested', key)).toHaveLength(1)
      expect(await attendanceRow('evDualFest', 'interested')).toMatchObject({ status: 'going', visibility: 'hidden' })
      await caller(ids.interested!).plan.remove({ itemType: 'festival', itemId: key })
      expect(await attendanceRow('evDualFest', 'interested')).toBeNull()
    })

    it('a failing secondary write leaves the legacy plan path correct', async () => {
      // The real db, except that every attendances insert/delete throws.
      const broken = new Proxy(db, {
        get(target, prop) {
          if (prop === 'insert' || prop === 'delete') {
            return (table: any) => {
              if (table === schema.attendances) throw new Error('attendances unavailable')
              return target[prop](table)
            }
          }
          const v = target[prop]
          return typeof v === 'function' ? v.bind(target) : v
        },
      })
      const me = caller(ids.other!, broken)
      await expect(me.plan.add({ itemType: 'event', itemId: ids.evDual! })).resolves.toBeUndefined()
      expect(await planRows('other', ids.evDual!)).toHaveLength(1)
      expect(await attendanceRow('evDual', 'other')).toBeNull() // secondary write skipped, not half-done
      await expect(me.plan.remove({ itemType: 'event', itemId: ids.evDual! })).resolves.toBeUndefined()
      expect(await planRows('other', ids.evDual!)).toHaveLength(0)
    })
  })
})
