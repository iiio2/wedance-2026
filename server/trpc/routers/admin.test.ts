import { describe, it, expect } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { appRouter } from '../index'

const DATABASE_URL = process.env.DATABASE_URL

let db: any = null
if (DATABASE_URL) {
  const sql = neon(DATABASE_URL)
  db = drizzle(sql, { schema })
}

function createCaller(opts: { dancerId?: string; isAdmin?: boolean } = {}) {
  return appRouter.createCaller({
    db,
    dancerId: opts.dancerId ?? null,
    isAdmin: opts.isAdmin ?? false,
  })
}

async function getTestDinners() {
  const [festival] = await db.select().from(schema.festivals)
    .where(eq(schema.festivals.slug, 'salsa-open-berlin-2026'))
  if (!festival) return []
  return db.select().from(schema.dinners).where(eq(schema.dinners.festivalId, festival.id))
}

describe.skipIf(!DATABASE_URL)('admin.listDinners', () => {
  it('rejects non-admin users', async () => {
    const caller = createCaller({ dancerId: 'some-id' })
    await expect(
      caller.admin.listDinners({ festivalSlug: 'salsa-open-berlin-2026' })
    ).rejects.toThrow('Admin access required')
  })

  it('returns dinners with signup counts for admin', async () => {
    const caller = createCaller({ dancerId: 'admin-id', isAdmin: true })
    const dinners = await caller.admin.listDinners({ festivalSlug: 'salsa-open-berlin-2026' })

    expect(dinners.length).toBeGreaterThan(0)
    expect(dinners[0]).toHaveProperty('signupCount')
    expect(dinners[0]).toHaveProperty('restaurant')
    expect(dinners[0]).toHaveProperty('date')
  })
})

describe.skipIf(!DATABASE_URL)('admin.assignGroups', () => {
  it('rejects non-admin users', async () => {
    const caller = createCaller({ dancerId: 'some-id' })
    const testDinners = await getTestDinners()
    if (!testDinners.length) return

    await expect(
      caller.admin.assignGroups({ dinnerId: testDinners[0].id, groupSize: 5 })
    ).rejects.toThrow('Admin access required')
  })

  it('creates balanced groups within 4-6 range', async () => {
    const testDinners = await getTestDinners()
    if (!testDinners.length) return
    const dinnerId = testDinners[0].id

    // Check there are signups
    const signups = await db.select().from(schema.dinnerSignups)
      .where(eq(schema.dinnerSignups.dinnerId, dinnerId))
    if (signups.length < 4) return

    const caller = createCaller({ dancerId: 'admin-id', isAdmin: true })
    const result = await caller.admin.assignGroups({ dinnerId, groupSize: 5 })

    expect(result.groups.length).toBeGreaterThan(0)
    for (const group of result.groups) {
      expect(group.memberCount).toBeGreaterThanOrEqual(4)
      expect(group.memberCount).toBeLessThanOrEqual(6)
    }

    // Clean up groups
    for (const group of result.groups) {
      await db.delete(schema.dinnerGroupMembers)
        .where(eq(schema.dinnerGroupMembers.groupId, group.groupId))
      await db.delete(schema.dinnerGroups)
        .where(eq(schema.dinnerGroups.id, group.groupId))
    }
  })

  it('clears chat links when reassigning (membership changes)', async () => {
    const testDinners = await getTestDinners()
    if (!testDinners.length) return
    const dinnerId = testDinners[0].id

    const signups = await db.select().from(schema.dinnerSignups)
      .where(eq(schema.dinnerSignups.dinnerId, dinnerId))
    if (signups.length < 4) return

    const caller = createCaller({ dancerId: 'admin-id', isAdmin: true })

    // First assignment
    const result1 = await caller.admin.assignGroups({ dinnerId, groupSize: 5 })
    expect(result1.groups.length).toBeGreaterThan(0)

    // Set a chat link
    const testLink = 'https://chat.whatsapp.com/test-preserve'
    await caller.admin.setGroupChatLink({
      groupId: result1.groups[0].groupId,
      chatLink: testLink,
    })

    // Reassign — old groups are deleted, new groups start with null chat links
    const result2 = await caller.admin.assignGroups({ dinnerId, groupSize: 5 })

    // Verify chat links are cleared (membership may have changed)
    const groups = await caller.admin.dinnerGroups({ dinnerId })
    for (const g of groups) {
      expect(g.chatLink).toBeNull()
    }

    // Clean up
    for (const group of result2.groups) {
      await db.delete(schema.dinnerGroupMembers)
        .where(eq(schema.dinnerGroupMembers.groupId, group.groupId))
      await db.delete(schema.dinnerGroups)
        .where(eq(schema.dinnerGroups.id, group.groupId))
    }
  })
})

describe.skipIf(!DATABASE_URL)('admin.revealRestaurant', () => {
  it('sets revealDate to today', async () => {
    const testDinners = await getTestDinners()
    const dinnerWithRestaurant = testDinners.find(d => d.restaurant)
    if (!dinnerWithRestaurant) return

    const caller = createCaller({ dancerId: 'admin-id', isAdmin: true })
    const result = await caller.admin.revealRestaurant({ dinnerId: dinnerWithRestaurant.id })
    expect(result.revealed).toBe(true)

    // Verify in DB
    const [updated] = await db.select().from(schema.dinners)
      .where(eq(schema.dinners.id, dinnerWithRestaurant.id))
    const today = new Date().toISOString().slice(0, 10)
    expect(updated.revealDate).toBe(today)

    // Clean up — reset revealDate
    await db.update(schema.dinners)
      .set({ revealDate: null })
      .where(eq(schema.dinners.id, dinnerWithRestaurant.id))
  })
})
