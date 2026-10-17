/**
 * Integration tests for /my-plan's real data: plan.weekSocials (this week's
 * socials + RSVP), plan.discover / discoverSwipe / discoverUnswipe (the deck
 * persists decisions and never shows a decided card again).
 *
 * Runs against a local Postgres only (see server/test-setup.ts) and creates
 * its own fixture rows in a throwaway city, removed again in afterAll.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, inArray, like } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { appRouter } from '../index'

const DATABASE_URL = process.env.DATABASE_URL
const db: any = DATABASE_URL ? drizzle(neon(DATABASE_URL), { schema }) : null

const RUN = Math.random().toString(36).slice(2, 8)
const CITY = `Testville ${RUN}`
const CITY_SLUG = `testville-${RUN}`
const FEST = `test-fest-${RUN}`
const DAY = 86400_000

const ids: Record<string, string> = {}
const caller = (dancerId: string) => appRouter.createCaller({ db, dancerId, isAdmin: false } as any)

async function addDancer(key: string, values: Partial<typeof schema.dancers.$inferInsert>) {
  const [row] = await db.insert(schema.dancers).values({
    email: `${key}-${RUN}@test.wedance.local`,
    name: `${key} ${RUN}`,
    city: CITY,
    danceStyles: ['Salsa'],
    profilePublic: true,
    ...values,
  }).returning({ id: schema.dancers.id })
  ids[key] = row.id
}

async function addEvent(key: string, values: Partial<typeof schema.events.$inferInsert>) {
  const [row] = await db.insert(schema.events).values({
    name: `${key} ${RUN}`,
    type: 'Party',
    citySlug: CITY_SLUG,
    city: CITY,
    timezone: 'Europe/Berlin',
    styles: ['Salsa'],
    published: true,
    archived: false,
    ...values,
  }).returning({ id: schema.events.id })
  ids[key] = row.id
}

describe.skipIf(!DATABASE_URL)('my-plan feeds', () => {
  beforeAll(async () => {
    const now = Date.now()
    await addDancer('me', { photo: 'https://example.com/me.jpg' })
    await addDancer('withPhoto', { photo: 'https://example.com/p.jpg' })
    await addDancer('noPhoto', { photo: null })
    await addDancer('emptyPhoto', { photo: '' })
    await addDancer('friend', { photo: 'https://example.com/f.jpg', city: 'Elsewhere' })

    // Friend = mutual follow.
    await db.insert(schema.follows).values([
      { dancerId: ids.me, targetDancerId: ids.friend },
      { dancerId: ids.friend, targetDancerId: ids.me },
    ])

    await addEvent('socialSoon', { startDate: new Date(now + 2 * DAY), endDate: new Date(now + 2 * DAY + 4 * 3600_000) })
    await addEvent('socialKizomba', { styles: ['Kizomba'], startDate: new Date(now + 3 * DAY), endDate: new Date(now + 3 * DAY + 3600_000) })
    await addEvent('course', { type: 'Course', startDate: new Date(now + DAY), endDate: new Date(now + DAY + 3600_000) })
    await addEvent('nextMonth', { startDate: new Date(now + 20 * DAY), endDate: new Date(now + 20 * DAY + 3600_000) })
    await addEvent('past', { startDate: new Date(now - 3 * DAY), endDate: new Date(now - 3 * DAY + 3600_000) })

    // A festival the friend has picked, so a dancer card + friend count exist.
    await db.insert(schema.festivals).values({ slug: FEST, name: `Test Fest ${RUN}` })
    await db.insert(schema.planItems).values([
      { dancerId: ids.withPhoto, itemType: 'festival', itemId: FEST },
      { dancerId: ids.friend, itemType: 'event', itemId: ids.socialSoon },
    ])
  })

  afterAll(async () => {
    const dancerIds = Object.entries(ids).filter(([k]) => ['me', 'withPhoto', 'noPhoto', 'emptyPhoto', 'friend'].includes(k)).map(([, v]) => v)
    const eventIds = Object.entries(ids).filter(([k]) => !dancerIds.includes(ids[k]!)).map(([, v]) => v)
    await db.delete(schema.discoverSwipes).where(inArray(schema.discoverSwipes.dancerId, dancerIds))
    await db.delete(schema.attendances).where(inArray(schema.attendances.dancerId, dancerIds)).catch(() => {})
    await db.delete(schema.planItems).where(inArray(schema.planItems.dancerId, dancerIds))
    await db.delete(schema.follows).where(inArray(schema.follows.dancerId, dancerIds))
    await db.delete(schema.events).where(inArray(schema.events.id, eventIds))
    await db.delete(schema.festivals).where(eq(schema.festivals.slug, FEST))
    await db.delete(schema.dancers).where(like(schema.dancers.email, `%-${RUN}@test.wedance.local`))
  })

  describe('plan.weekSocials', () => {
    it('lists this week\'s socials in the dancer\'s city in their styles — no classes, nothing later or past', async () => {
      const { citySlug, socials } = await caller(ids.me!).plan.weekSocials()
      expect(citySlug).toBe(CITY_SLUG)
      expect(socials.map(s => s.id)).toEqual([ids.socialSoon])
      expect(socials[0]!.startDate).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(socials[0]!.timezone).toBe('Europe/Berlin')
    })

    it('counts friends (mutual follows) going, and marks the dancer\'s RSVP after a reload', async () => {
      const me = caller(ids.me!)
      let [s] = (await me.plan.weekSocials()).socials
      expect(s!.going).toBe(false)
      expect(s!.friendsGoing).toBe(1)

      await me.plan.add({ itemType: 'event', itemId: ids.socialSoon!, metadata: { type: 'social' } })
      ;[s] = (await me.plan.weekSocials()).socials
      expect(s!.going).toBe(true)

      await me.plan.remove({ itemType: 'event', itemId: ids.socialSoon! })
      ;[s] = (await me.plan.weekSocials()).socials
      expect(s!.going).toBe(false)
    })
  })

  describe('plan.discover', () => {
    const deckIds = async () => (await caller(ids.me!).plan.discover()).cards.map(c => `${c.targetKind}:${c.targetId}`)

    it('only shows dancers with a photo, never the caller', async () => {
      const deck = await deckIds()
      expect(deck).toContain(`dancer:${ids.withPhoto}`)
      expect(deck).not.toContain(`dancer:${ids.noPhoto}`)
      expect(deck).not.toContain(`dancer:${ids.emptyPhoto}`)
      expect(deck).not.toContain(`dancer:${ids.me}`)
      const { cards } = await caller(ids.me!).plan.discover()
      for (const c of cards) if (c.targetKind === 'dancer') expect(c.dancerPhoto).toBeTruthy()
    })

    it('shows each dancer once, with the festival that put them on the card', async () => {
      const { cards } = await caller(ids.me!).plan.discover()
      const mine = cards.filter(c => c.targetKind === 'dancer' && c.targetId === ids.withPhoto)
      expect(mine).toHaveLength(1)
      expect(mine[0]!.kind).toBe('dancer-new-fest')
      expect(mine[0]!.targetKind === 'dancer' && mine[0]!.festivalSlug).toBe(FEST)
    })

    it('a Skip is stored and the card does not come back; undo brings it back', async () => {
      const me = caller(ids.me!)
      await me.plan.discoverSwipe({ targetKind: 'dancer', targetId: ids.withPhoto!, decision: 'skip' })
      expect(await deckIds()).not.toContain(`dancer:${ids.withPhoto}`)

      await me.plan.discoverUnswipe({ targetKind: 'dancer', targetId: ids.withPhoto! })
      expect(await deckIds()).toContain(`dancer:${ids.withPhoto}`)
    })

    it('a Yes is stored too, and re-deciding overwrites instead of duplicating', async () => {
      const me = caller(ids.me!)
      await me.plan.discoverSwipe({ targetKind: 'dancer', targetId: ids.withPhoto!, decision: 'yes', festivalSlug: FEST })
      await me.plan.discoverSwipe({ targetKind: 'dancer', targetId: ids.withPhoto!, decision: 'skip' })
      const rows = await db.select().from(schema.discoverSwipes).where(eq(schema.discoverSwipes.dancerId, ids.me!))
      expect(rows).toHaveLength(1)
      expect(rows[0].decision).toBe('skip')
      expect(await deckIds()).not.toContain(`dancer:${ids.withPhoto}`)
      await me.plan.discoverUnswipe({ targetKind: 'dancer', targetId: ids.withPhoto! })
    })

    it('excludes skipped events and events already in the plan', async () => {
      const me = caller(ids.me!)
      expect(await deckIds()).toContain(`event:${ids.socialSoon}`)

      await me.plan.discoverSwipe({ targetKind: 'event', targetId: ids.socialSoon!, decision: 'skip' })
      expect(await deckIds()).not.toContain(`event:${ids.socialSoon}`)
      await me.plan.discoverUnswipe({ targetKind: 'event', targetId: ids.socialSoon! })

      await me.plan.add({ itemType: 'event', itemId: ids.socialSoon!, metadata: { type: 'social' } })
      expect(await deckIds()).not.toContain(`event:${ids.socialSoon}`)
      await me.plan.remove({ itemType: 'event', itemId: ids.socialSoon! })
    })

    it('reports a real friends-going count on event cards (no placeholder numbers)', async () => {
      const { cards } = await caller(ids.me!).plan.discover()
      const card = cards.find(c => c.targetKind === 'event' && c.targetId === ids.socialSoon)
      expect(card && 'friendsGoing' in card ? card.friendsGoing : -1).toBe(1)
    })

    it('builds a festival nudge from Yes swipes that survives a reload', async () => {
      const me = caller(ids.me!)
      await me.plan.discoverSwipe({ targetKind: 'dancer', targetId: ids.withPhoto!, decision: 'yes', festivalSlug: FEST })
      const { nudges } = await me.plan.discover()
      const nudge = nudges.find(n => n.festivalSlug === FEST)
      expect(nudge?.dancerNames).toEqual([`withPhoto ${RUN}`])

      // "Not this year" = a Skip on the festival → the nudge is gone for good.
      await me.plan.discoverSwipe({ targetKind: 'festival', targetId: FEST, decision: 'skip' })
      expect((await me.plan.discover()).nudges.find(n => n.festivalSlug === FEST)).toBeUndefined()
    })

    it('rejects anonymous callers', async () => {
      const anon = appRouter.createCaller({ db, dancerId: null, isAdmin: false } as any)
      await expect(anon.plan.discoverSwipe({ targetKind: 'dancer', targetId: 'x', decision: 'skip' })).rejects.toThrow()
    })
  })
})
