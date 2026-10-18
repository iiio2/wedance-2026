import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, eq, inArray, like } from 'drizzle-orm'
import * as schema from '../database/schema'
import { appRouter } from '../trpc'
import { callTool } from './server'
import { TOOL_BY_NAME } from './tools'
import { eventLocalDate, eventLocalTime } from '../../shared/utils/eventTime'

// MCP phase 2 procedures and tools against a real Postgres (local only; the
// test setup drops a remote DATABASE_URL):
//   DATABASE_URL=postgresql://dev:dev@localhost:5441/wedance NEON_FETCH_ENDPOINT=http://localhost:4444/sql bunx vitest run server/mcp/phase2.db.test.ts
const DATABASE_URL = process.env.DATABASE_URL
const db: any = DATABASE_URL ? drizzle(neon(DATABASE_URL), { schema }) : null

// Emails log instead of sending (no Resend key), like local dev.
vi.stubGlobal('useRuntimeConfig', () => ({ siteUrl: 'http://localhost:3000', resendApiKey: '' }))

const ORIGIN = 'https://wedance.test'
const tag = `mcp2-${Date.now()}`
const ids: Record<'org' | 'promo' | 'artist' | 'fan' | 'shy' | 'private' | 'stranger', string> = {} as any
const pages: Record<'club' | 'other' | 'promo' | 'artist' | 'promoOrg', { id: string; username: string }> = {} as any
const grantIds: string[] = []
let clientId = ''

const web = (dancerId: string | null, extra: Record<string, unknown> = {}) => appRouter.createCaller({ db, dancerId, isAdmin: false, origin: ORIGIN, ...extra } as any)
/** A connected app: scopes and the pages it may act for, with a real grant row for the audit. */
async function app(dancerId: string, scopes: string[], profileIds: string[]) {
  const [g] = await db.insert(schema.oauthGrants).values({ dancerId, clientId, scopes, profileIds }).returning({ id: schema.oauthGrants.id })
  grantIds.push(g.id)
  const ctx: any = { db, dancerId, isAdmin: false, scopes, grantedProfileIds: profileIds, oauthClientId: clientId, oauthGrantId: g.id, origin: ORIGIN }
  return { caller: appRouter.createCaller(ctx), ctx, origin: ORIGIN }
}
const json = (r: any) => JSON.parse(r.content[0].text.slice(r.content[0].text.indexOf('<wedance-data>') + 15, r.content[0].text.lastIndexOf('</wedance-data>')))

const futureThursday = (() => {
  // A Thursday at least two weeks ahead (local date).
  const d = new Date(Date.now() + 14 * 86400_000)
  d.setUTCDate(d.getUTCDate() + ((4 - d.getUTCDay() + 7) % 7))
  return d.toISOString().slice(0, 10)
})()
const plusDays = (ymd: string, n: number) => new Date(new Date(`${ymd}T12:00:00Z`).getTime() + n * 86400_000).toISOString().slice(0, 10)

const template = { type: 'Workshop' as const, startTime: '19:00', endTime: '20:30', city: 'Munich', venueName: 'Buena Vista', styles: ['Salsa'] }

describe.skipIf(!DATABASE_URL)('MCP phase 2 (DB)', () => {
  let liveEvent: string // published, hosted by pages.club
  let otherEvent: string // published, hosted by pages.club
  let draftEvent: string

  beforeAll(async () => {
    const rows = await db.insert(schema.dancers).values([
      { email: `${tag}-org@test.local`, name: 'Org' },
      { email: `${tag}-promo@test.local`, name: 'Promo' },
      { email: `${tag}-artist@test.local`, name: 'Artist', username: `${tag}-artist` },
      { email: `${tag}-fan@test.local`, name: 'Fan Public', username: `${tag}-fan`, city: 'Munich' },
      { email: `${tag}-shy@test.local`, name: 'Shy Hidden', username: `${tag}-shy` },
      { email: `${tag}-private@test.local`, name: 'Private Profile', username: `${tag}-private`, profilePublic: false },
      { email: `${tag}-stranger@test.local`, name: 'Stranger' },
    ]).returning({ id: schema.dancers.id })
    ;[ids.org, ids.promo, ids.artist, ids.fan, ids.shy, ids.private, ids.stranger] = rows.map((r: any) => r.id)
    const mk = async (dancer: string, type: any, name: string) => {
      const { username } = await web(dancer).business.create({ type, name: `${tag} ${name}`, city: 'Munich' })
      const [p] = await db.select({ id: schema.profiles.id }).from(schema.profiles).where(eq(schema.profiles.username, username))
      return { id: p.id, username }
    }
    pages.club = await mk(ids.org, 'organizer', 'Club')
    pages.other = await mk(ids.org, 'organizer', 'Other')
    pages.promo = await mk(ids.promo, 'promoter', 'Promo')
    pages.promoOrg = await mk(ids.promo, 'organizer', 'PromoOrg')
    pages.artist = await mk(ids.artist, 'artist', 'Artist')
    clientId = `${tag}-client`
    await db.insert(schema.oauthClients).values({ id: clientId, kind: 'dcr', name: 'Phase 2 test app', redirectUris: ['https://client.example/cb'] })

    const org = web(ids.org)
    liveEvent = (await org.businessEvents.create({ hostUsername: pages.club.username, name: `${tag} Party`, ...template, type: 'Party', date: futureThursday, published: true } as any)).id
    otherEvent = (await org.businessEvents.create({ hostUsername: pages.club.username, name: `${tag} Other Party`, ...template, type: 'Party', date: plusDays(futureThursday, 1), published: true } as any)).id
    draftEvent = (await org.businessEvents.create({ hostUsername: pages.club.username, name: `${tag} Draft`, ...template, date: futureThursday } as any)).id
  })

  afterAll(async () => {
    const pageIds = Object.values(pages).map(p => p.id)
    await db.delete(schema.giveaways).where(like(schema.giveaways.title, `Win: ${tag}%`))
    await db.delete(schema.events).where(inArray(schema.events.hostProfileId, pageIds))
    await db.delete(schema.gigs).where(like(schema.gigs.title, `${tag}%`))
    await db.delete(schema.profiles).where(inArray(schema.profiles.id, pageIds))
    await db.delete(schema.mcpAudit).where(inArray(schema.mcpAudit.dancerId, Object.values(ids)))
    await db.delete(schema.oauthClients).where(eq(schema.oauthClients.id, clientId))
    const everyone = (await db.select({ id: schema.dancers.id }).from(schema.dancers).where(like(schema.dancers.email, `${tag}-%`))).map((d: any) => d.id)
    await db.delete(schema.planItems).where(inArray(schema.planItems.dancerId, everyone))
    await db.delete(schema.dancers).where(inArray(schema.dancers.id, everyone))
  })

  // ── recurring series ────────────────────────────────────────────────────────
  describe('recurring_series', () => {
    it('preview lists the dates; create makes one event per date, same seriesId, local times kept', async () => {
      const org = web(ids.org)
      const input = { hostUsername: pages.club.username, name: `${tag} Weekly Class`, ...template, date: futureThursday, every: 'week' as const, count: 4, skip: [plusDays(futureThursday, 14)], published: false }
      const p = await org.businessEvents.seriesPreview(input)
      expect(p.dates.map(d => d.date)).toEqual([futureThursday, plusDays(futureThursday, 7), plusDays(futureThursday, 21), plusDays(futureThursday, 28)])
      expect(p.dates.every(d => d.weekday === 'Thursday')).toBe(true)
      expect(p.skipped).toEqual([plusDays(futureThursday, 14)])
      const r = await org.businessEvents.createSeries(input)
      expect(r.created.map(c => c.date)).toEqual(p.dates.map(d => d.date))
      expect(r.created.every(c => c.startTime === '19:00')).toBe(true)
      const rows = await db.select().from(schema.events).where(eq(schema.events.seriesId, r.seriesId))
      expect(rows).toHaveLength(4)
      expect(rows.every((e: any) => e.hostProfileId === pages.club.id && !e.published && eventLocalTime(e.startDate, e.timezone) === '19:00')).toBe(true)
      // The editor groups them like a duplicated series.
      const list = await org.businessEvents.list({ profile: pages.club.username })
      expect(list.drafts.filter((e: any) => e.seriesId === r.seriesId)).toHaveLength(4)
      // One exception: an ordinary edit of one date.
      const one = await org.businessEvents.get({ id: r.created[1]!.id })
      await org.businessEvents.update({ ...(one as any), id: one.id, startTime: '20:00', host: undefined, synced: undefined, recurring: undefined, archived: undefined, editedAt: undefined, timezone: undefined, missing: undefined } as any)
      expect((await org.businessEvents.get({ id: r.created[1]!.id })).startTime).toBe('20:00')
      expect((await org.businessEvents.get({ id: r.created[2]!.id })).startTime).toBe('19:00')
    })

    it('monthly: the same nth weekday', async () => {
      const r = await web(ids.org).businessEvents.seriesPreview({ hostUsername: pages.club.username, name: `${tag} Monthly`, ...template, date: '2031-01-19', every: 'month', count: 3, published: false } as any)
      expect(r.dates.map(d => d.date)).toEqual(['2031-01-19', '2031-02-16', '2031-03-16'])
    })

    it('only for pages you run, only pages the app was given, publishing needs business:publish', async () => {
      const input = { hostUsername: pages.club.username, name: `${tag} Nope`, ...template, date: futureThursday, every: 'week' as const, count: 2, skip: [], published: false }
      await expect(web(ids.stranger).businessEvents.createSeries(input)).rejects.toThrow(/don’t manage/)
      const notGranted = await app(ids.org, ['business:publish'], [pages.other.id])
      await expect(notGranted.caller.businessEvents.createSeries(input)).rejects.toThrow(/wasn’t given access/)
      const writer = await app(ids.org, ['business:write'], [pages.club.id])
      await expect(writer.caller.businessEvents.createSeries({ ...input, published: true })).rejects.toThrow(/insufficient_scope.*business:publish/)
      await expect(writer.caller.businessEvents.createSeries({ ...input, until: null, count: null } as any)).rejects.toThrow(/until|count/)
    })

    it('MCP: drafts with business:write; published runs preview (the dates) → confirm; publish_series', async () => {
      const writer = await app(ids.org, ['business:write'], [pages.club.id])
      const tool = TOOL_BY_NAME.get('recurring_series')!
      const args = { profile: pages.club.username, name: `${tag} Sunday Taster`, type: 'Workshop', date: plusDays(futureThursday, 3), start_time: '18:00', end_time: '19:00', city: 'Munich', every: 'week', count: 3 }
      const drafts = json(await callTool(tool, args, writer))
      expect(drafts.created).toHaveLength(3)
      expect(drafts.published).toBe(false)
      expect((await callTool(tool, { ...args, published: true }, writer)).content[0]!.text).toMatch(/business:publish/)

      const pub = await app(ids.org, ['business:publish'], [pages.club.id])
      const preview = json(await callTool(tool, { ...args, name: `${tag} Live Taster`, published: true }, pub))
      expect(preview.status).toBe('needs_confirmation')
      expect(preview.preview.dates).toHaveLength(3)
      expect(await db.select().from(schema.events).where(eq(schema.events.name, `${tag} Live Taster`))).toHaveLength(0)
      const done = json(await callTool(tool, { ...args, name: `${tag} Live Taster`, published: true, confirm_token: preview.confirm_token }, pub))
      expect(done.published).toBe(true)
      const live = await db.select().from(schema.events).where(eq(schema.events.name, `${tag} Live Taster`))
      expect(live.every((e: any) => e.published)).toBe(true)

      // The drafts: publish the whole series at once.
      const ps = TOOL_BY_NAME.get('publish_series')!
      const pv = json(await callTool(ps, { series_id: drafts.seriesId }, pub))
      expect(pv.preview.dates).toHaveLength(3)
      const res = json(await callTool(ps, { series_id: drafts.seriesId, confirm_token: pv.confirm_token }, pub))
      expect(res.changed).toBe(3)
      const now = await db.select().from(schema.events).where(eq(schema.events.seriesId, drafts.seriesId))
      expect(now.every((e: any) => e.published)).toBe(true)
      expect(eventLocalDate(now[0].startDate, now[0].timezone)).toBe(plusDays(futureThursday, 3))
    })
  })

  // ── attendees ───────────────────────────────────────────────────────────────
  describe('attendees', () => {
    beforeAll(async () => {
      await web(ids.fan).plan.add({ itemType: 'event', itemId: liveEvent })
      await web(ids.fan).plan.setShareGoing({ itemType: 'event', itemId: liveEvent, share: true })
      await web(ids.shy).plan.add({ itemType: 'event', itemId: liveEvent }) // private by default
      await web(ids.private).plan.add({ itemType: 'event', itemId: liveEvent })
      await web(ids.private).plan.setShareGoing({ itemType: 'event', itemId: liveEvent, share: true }) // but the profile is private
      // A ticket bought before the buyer has an account: counted, never named.
      await db.insert(schema.attendances).values({ eventId: liveEvent, buyerEmail: `${tag}-stub@test.local`, status: 'ticket_holder', source: 'tickettailor' })
      await db.update(schema.attendances).set({ status: 'ticket_holder' }).where(and(eq(schema.attendances.eventId, liveEvent), eq(schema.attendances.dancerId, ids.fan)))
    })

    it('counts everyone; names only who made their going public with a public profile', async () => {
      const r = await web(ids.org).businessEvents.attendees({ id: liveEvent, csv: true })
      expect(r.counts).toMatchObject({ total: 4, going: 3, tickets: 2, named: 1, hidden: 3 })
      expect(r.attendees).toEqual([{ name: 'Fan Public', handle: `${tag}-fan`, city: 'Munich', status: 'ticket' }])
      expect(JSON.stringify(r)).not.toContain('Shy Hidden')
      expect(JSON.stringify(r)).not.toContain('Private Profile')
      expect(JSON.stringify(r)).not.toContain('@test.local')
      expect(r.csv!.split('\n')).toEqual(['name,handle,city,status', `"Fan Public","${tag}-fan","Munich","ticket"`])
      expect(r.summary).toMatch(/3 of 4/)
    })

    it('only the event’s team, only through a granted page, only with business:read', async () => {
      await expect(web(ids.stranger).businessEvents.attendees({ id: liveEvent })).rejects.toThrow(/don’t manage/)
      await expect((await app(ids.org, ['business:read'], [pages.other.id])).caller.businessEvents.attendees({ id: liveEvent })).rejects.toThrow(/wasn’t given access/)
      await expect((await app(ids.org, ['me:read'], [pages.club.id])).caller.businessEvents.attendees({ id: liveEvent })).rejects.toThrow(/insufficient_scope/)
      const ok = json(await callTool(TOOL_BY_NAME.get('attendees')!, { event_id: liveEvent }, await app(ids.org, ['business:read'], [pages.club.id])))
      expect(ok.counts.total).toBe(4)
    })
  })

  // ── gig applications ───────────────────────────────────────────────────────
  describe('apply_to_gig', () => {
    let roleGig: string
    let offerGig: string
    beforeAll(async () => {
      const base = { category: 'Teacher', posterName: `${tag} Club`, posterType: 'Organizer', location: 'Munich', when: 'Sundays', compensation: '€50', contactEmail: `${tag}-org@test.local` }
      roleGig = (await web(ids.org).gigs.create({ ...base, kind: 'role', title: `${tag} Salsa teacher` })).id
      offerGig = (await web(ids.org).gigs.create({ ...base, kind: 'offer', title: `${tag} DJ offer` })).id
    })

    it('an artist applies (as their page), once; not to offers or their own gig', async () => {
      const artist = await app(ids.artist, ['social:write', 'me:read'], [pages.artist.id])
      const r = json(await callTool(TOOL_BY_NAME.get('apply_to_gig')!, { gig_id: roleGig, message: 'I teach Cuban salsa every week.', profile: `@${pages.artist.username}` }, artist))
      expect(r).toMatchObject({ applied: true, status: 'pending' })
      await expect(web(ids.artist).gigs.applyTo({ gigId: roleGig, message: 'Applying a second time.' })).rejects.toThrow(/already applied/)
      await expect(web(ids.artist).gigs.applyTo({ gigId: offerGig, message: 'This is an offer, not a role.' })).rejects.toThrow(/offer/)
      await expect(web(ids.org).gigs.applyTo({ gigId: roleGig, message: 'Applying to my own gig.' })).rejects.toThrow(/own gig/)
      // A page the app wasn't given.
      const noPage = await app(ids.artist, ['social:write'], [])
      await expect(noPage.caller.gigs.applyTo({ gigId: offerGig, message: 'As a page I didn’t grant.', profile: pages.artist.username })).rejects.toThrow()
      const mine = json(await callTool(TOOL_BY_NAME.get('my_gig_applications')!, {}, artist))
      expect(mine.map((a: any) => a.gig.title.untrusted_text)).toContain(`${tag} Salsa teacher`)
    })

    it('post_gig_offer, enter_giveaway, request_private_class use the account email (auth.myEmail)', async () => {
      const pub = await app(ids.org, ['business:publish', 'me:read'], [pages.club.id])
      const tool = TOOL_BY_NAME.get('post_gig_offer')!
      const args = { kind: 'role', category: 'DJ', title: `${tag} DJ wanted`, poster_name: 'Club', poster_type: 'Organizer', location: 'Munich', when: 'Fridays', compensation: '€100' }
      const pv = json(await callTool(tool, args, pub))
      const done = json(await callTool(tool, { ...args, confirm_token: pv.confirm_token }, pub))
      const [row] = await db.select().from(schema.gigs).where(eq(schema.gigs.id, done.id))
      expect(row.contactEmail).toBe(`${tag}-org@test.local`)
      await expect((await app(ids.org, ['business:read'], [pages.club.id])).caller.auth.myEmail()).rejects.toThrow(/insufficient_scope.*me:read/)
    })

    it('the poster sees applications and decides (preview → confirm); others can’t', async () => {
      const list = await web(ids.org).gigs.applications({ gigId: roleGig })
      const appRow = list[0]!.applications[0]!
      expect(appRow).toMatchObject({ status: 'pending', applicant: { name: 'Artist', email: `${tag}-artist@test.local` }, page: { username: pages.artist.username } })
      await expect(web(ids.stranger).gigs.applications({ gigId: roleGig })).rejects.toThrow(/didn’t post/)
      await expect(web(ids.stranger).gigs.decideApplication({ applicationId: appRow.id, decision: 'accepted' })).rejects.toThrow(/Only whoever posted/)
      expect((await callTool(TOOL_BY_NAME.get('decide_gig_application')!, { application_id: appRow.id, decision: 'accepted' }, await app(ids.org, ['business:write'], [pages.club.id]))).isError).toBe(true)
      const pub = await app(ids.org, ['business:publish'], [pages.club.id])
      const tool = TOOL_BY_NAME.get('decide_gig_application')!
      const pv = json(await callTool(tool, { application_id: appRow.id, decision: 'accepted' }, pub))
      expect(pv.preview).toMatchObject({ applicant: 'Artist', decision: 'accepted' })
      json(await callTool(tool, { application_id: appRow.id, decision: 'accepted', confirm_token: pv.confirm_token }, pub))
      expect((await web(ids.artist).gigs.myApplications())[0]!.status).toBe('accepted')
    })
  })

  // ── influencer flag ────────────────────────────────────────────────────────
  describe('influencer flag', () => {
    it('a promoter page can be an influencer; other pages can’t', async () => {
      const promo = web(ids.promo)
      await promo.business.update({ username: pages.promo.username, influencer: true })
      expect((await promo.business.get({ username: pages.promo.username })).influencer).toBe(true)
      expect((await promo.business.myProfiles()).managed.find((p: any) => p.username === pages.promo.username)!.influencer).toBe(true)
      await expect(promo.business.update({ username: pages.promoOrg.username, influencer: true })).rejects.toThrow(/Only promoter pages/)
      // Switching a page away from promoter drops the flag.
      const [row] = await db.select({ roles: schema.profiles.roles }).from(schema.profiles).where(eq(schema.profiles.id, pages.promo.id))
      expect(row.roles).toEqual(['influencer'])
    })
  })

  // ── tracked links, results, dashboard ──────────────────────────────────────
  describe('tracked links', () => {
    let code = ''
    it('my_link: a promoter page’s stable link to a published event, with QR', async () => {
      const promo = await app(ids.promo, ['business:read'], [pages.promo.id, pages.promoOrg.id])
      const a = json(await callTool(TOOL_BY_NAME.get('my_link')!, { event_id: liveEvent, profile: pages.promo.username }, promo))
      code = a.code
      expect(a.url).toMatch(new RegExp(`^${ORIGIN}/events/.+\\?via=${code}$`))
      expect(a.qr.svg).toBe(`${ORIGIN}/api/qr/${code}.svg`)
      const b = json(await callTool(TOOL_BY_NAME.get('my_link')!, { event_id: liveEvent, profile: pages.promo.username }, promo))
      expect(b.code).toBe(code)
      await expect(promo.caller.referral.myLink({ eventId: liveEvent, profile: pages.promoOrg.username })).rejects.toThrow(/promoter pages/)
      await expect(promo.caller.referral.myLink({ eventId: draftEvent, profile: pages.promo.username })).rejects.toThrow(/published/)
      await expect((await app(ids.promo, ['business:read'], [pages.promoOrg.id])).caller.referral.myLink({ eventId: liveEvent, profile: pages.promo.username })).rejects.toThrow(/wasn’t given access/)
    })

    it('visits count once per browser; sign-ups, plan adds (this event only) and tickets credit the link', async () => {
      const visitor = (sid: string, dancerId: string | null = null) => web(dancerId, { voterSessionId: sid })
      expect((await visitor('sid-a').referral.trackVisit({ code })).counted).toBe(true)
      expect((await visitor('sid-a').referral.trackVisit({ code })).counted).toBe(false)
      expect((await visitor('sid-b').referral.trackVisit({ code })).counted).toBe(true)
      expect((await visitor('sid-c').referral.trackVisit({ code: 'zzzzzzzz' })).counted).toBe(false)

      // A new account through the link (magic link sign-up; the email is only logged here).
      const email = `${tag}-newbie@test.local`
      await web(null, { viaCode: code }).auth.requestMagicLink({ email, name: 'Newbie' })
      const [newbie] = await db.select({ id: schema.dancers.id }).from(schema.dancers).where(eq(schema.dancers.email, email))
      // The same person asking again isn't a second sign-up.
      await web(null, { viaCode: code }).auth.requestMagicLink({ email })

      await web(newbie.id, { viaCode: code }).plan.add({ itemType: 'event', itemId: liveEvent })
      await web(newbie.id, { viaCode: code }).plan.add({ itemType: 'event', itemId: otherEvent }) // another event: not this link's
      await web(ids.shy, { viaCode: code }).plan.add({ itemType: 'event', itemId: liveEvent }) // already had it; first credit for this link
      // A paid ticket (the Stripe webhook's call).
      const { recordLinkAction } = await import('../utils/trackedLinks')
      expect(await recordLinkAction(db, code, 'ticket', { dancerId: newbie.id, eventId: liveEvent, ref: 'cs_test_1' })).toBe(true)
      expect(await recordLinkAction(db, code, 'ticket', { dancerId: newbie.id, eventId: liveEvent, ref: 'cs_test_2' })).toBe(false)

      const promo = await app(ids.promo, ['business:read'], [pages.promo.id])
      const res = json(await callTool(TOOL_BY_NAME.get('my_results')!, {}, promo))
      expect(res.totals).toEqual({ visits: 2, signups: 1, planAdds: 2, tickets: 1 })
      expect(res.links[0]).toMatchObject({ page: pages.promo.username, code, event: { id: liveEvent } })
    })

    it('the event’s team sees every promoter’s results; the dashboard sums them up', async () => {
      const team = await web(ids.org).referral.eventLinkResults({ eventId: liveEvent })
      expect(team.links.map((l: any) => l.page)).toEqual([pages.promo.username])
      expect(team.totals.signups).toBe(1)
      await expect(web(ids.promo).referral.eventLinkResults({ eventId: liveEvent })).rejects.toThrow(/don’t manage/)
      const dash = json(await callTool(TOOL_BY_NAME.get('promoter_dashboard')!, { profile: pages.promo.username }, await app(ids.promo, ['business:read'], [pages.promo.id])))
      expect(dash.page).toMatchObject({ username: pages.promo.username, influencer: true })
      expect(dash.totals.tickets).toBe(1)
      expect(dash.upcoming[0].event.id).toBe(liveEvent)
    })
  })

  // ── promo kit ──────────────────────────────────────────────────────────────
  describe('promo_kit', () => {
    beforeAll(async () => {
      // The organizer's kept story flyer + its feed version, and a saved caption (no Gemini in tests).
      const post = (await db.insert(schema.eventPosts).values({ eventId: liveEvent, kind: 'announcement', format: 'story' }).returning({ id: schema.eventPosts.id }))[0].id
      const batch = crypto.randomUUID()
      await db.insert(schema.eventFlyers).values([
        { eventId: liveEvent, postId: post, batchId: batch, look: { description: 'neon' }, status: 'ready', url: 'https://img.test/story.png', width: 1080, height: 1920, keptAt: new Date() },
        { eventId: liveEvent, postId: post, batchId: batch, look: { description: 'neon' }, status: 'ready', url: 'https://img.test/feed.png', width: 1080, height: 1350, mode: 'recompose' },
      ])
      const { captionContext } = await import('../utils/flyer/caption')
      const [ev] = await db.select().from(schema.events).where(eq(schema.events.id, liveEvent))
      const { lines } = await captionContext(db, ev)
      await db.update(schema.events).set({ caption: { language: 'en+de', text: 'Salsa Thursday! #SalsaMunich', lines, writtenAt: new Date().toISOString() } }).where(eq(schema.events.id, liveEvent))
    })

    it('a promoter gets flyer (story + feed), caption, hashtags, link and QR; influencers get tips', async () => {
      const kit = json(await callTool(TOOL_BY_NAME.get('promo_kit')!, { event_id: liveEvent, profile: pages.promo.username }, await app(ids.promo, ['business:read'], [pages.promo.id])))
      expect(kit.flyer.story.url).toBe('https://img.test/story.png')
      expect(kit.flyer.feed.url).toBe('https://img.test/feed.png')
      expect(kit.flyer.painting).toBeNull()
      expect(kit.caption).toMatchObject({ from: 'the organizer', text: { untrusted_text: 'Salsa Thursday! #SalsaMunich' } })
      expect(kit.hashtags).toEqual(expect.arrayContaining(['#SalsaMunich', '#salsa', '#munich', '#wedance']))
      expect(kit.link.url).toMatch(/\?via=[a-z2-9]{8}$/)
      expect(kit.link.qr.png).toMatch(/\/api\/qr\/[a-z2-9]{8}\.png$/)
      expect(kit.forInfluencer).toMatch(/link sticker/)
    })

    it('no flyer: says so, or starts painting one (once)', async () => {
      const promo = await app(ids.promo, ['business:read'], [pages.promo.id])
      const none = await promo.caller.referral.promoKit({ eventId: otherEvent, profile: pages.promo.username, paintIfMissing: false })
      expect(none.flyer.story).toBeNull()
      expect(none.flyer.hint).toMatch(/No flyer yet/)
      const painting = await promo.caller.referral.promoKit({ eventId: otherEvent, profile: pages.promo.username, paintIfMissing: true })
      expect(painting.flyer.painting!.batchId).toMatch(/^[0-9a-f-]{36}$/)
      const again = await promo.caller.referral.promoKit({ eventId: otherEvent, profile: pages.promo.username, paintIfMissing: true })
      // Still painting (same batch) or just failed (no Gemini here): never a second painting.
      const rows = await db.select().from(schema.eventFlyers).where(eq(schema.eventFlyers.eventId, otherEvent))
      expect(rows).toHaveLength(1)
      if (again.flyer.painting) expect(again.flyer.painting.batchId).toBe(painting.flyer.painting!.batchId)
      else expect(again.flyer.hint).toMatch(/just failed/)
    })

    it('not for non-promoter pages of strangers; the team gets a kit without a link', async () => {
      await expect(web(ids.promo).referral.promoKit({ eventId: liveEvent, profile: pages.promoOrg.username })).rejects.toThrow(/promoter pages and the event’s own team/)
      const own = await web(ids.org).referral.promoKit({ eventId: liveEvent, profile: pages.club.username, paintIfMissing: false })
      expect(own.link).toBeNull()
      expect(own.flyer.story!.url).toBe('https://img.test/story.png')
    })
  })

  // ── giveaway proposals ─────────────────────────────────────────────────────
  describe('propose_giveaway', () => {
    it('promoter proposes → organizer approves (preview → confirm) → a live giveaway through the tracked link', async () => {
      const promo = await app(ids.promo, ['business:write'], [pages.promo.id])
      const p = json(await callTool(TOOL_BY_NAME.get('propose_giveaway')!, { event_id: liveEvent, profile: pages.promo.username, prize: `${tag} 2 full passes`, ends_on: plusDays(futureThursday, -1) }, promo))
      expect(p.status).toBe('pending')
      await expect(promo.caller.giveaway.propose({ eventId: liveEvent, profile: pages.promo.username, prize: 'again' })).rejects.toThrow(/already has/)
      await expect(promo.caller.giveaway.propose({ eventId: draftEvent, profile: pages.promo.username, prize: 'a draft event' })).rejects.toThrow(/published/)
      expect(await db.select().from(schema.giveaways).where(like(schema.giveaways.title, `Win: ${tag}%`))).toHaveLength(0)

      const list = await web(ids.org).giveaway.proposals({ eventId: liveEvent })
      expect(list[0]).toMatchObject({ id: p.id, status: 'pending', page: { username: pages.promo.username, influencer: true } })
      await expect(web(ids.stranger).giveaway.decideProposal({ proposalId: p.id, approve: true })).rejects.toThrow(/don’t manage/)
      expect((await callTool(TOOL_BY_NAME.get('decide_giveaway_proposal')!, { proposal_id: p.id, approve: true }, await app(ids.org, ['business:write'], [pages.club.id]))).isError).toBe(true)

      const pub = await app(ids.org, ['business:publish'], [pages.club.id])
      const tool = TOOL_BY_NAME.get('decide_giveaway_proposal')!
      const pv = json(await callTool(tool, { proposal_id: p.id, approve: true }, pub))
      expect(pv.preview).toMatchObject({ prize: `${tag} 2 full passes`, status: 'pending' })
      const done = json(await callTool(tool, { proposal_id: p.id, approve: true, confirm_token: pv.confirm_token }, pub))
      expect(done.status).toBe('approved')
      const [g] = await db.select().from(schema.giveaways).where(eq(schema.giveaways.id, done.giveawayId))
      expect(g).toMatchObject({ status: 'active', citySlug: 'munich', prizeDescription: `${tag} 2 full passes`, sponsorName: `${tag} Promo` })
      expect(g.ctaUrl).toMatch(/\?via=[a-z2-9]{8}$/)
      expect((await web(null).giveaway.listActive({ citySlug: 'munich' })).some((x: any) => x.id === g.id)).toBe(true)
      await expect(pub.caller.giveaway.decideProposal({ proposalId: p.id, approve: false })).rejects.toThrow(/approved already/)
    })
  })
})
