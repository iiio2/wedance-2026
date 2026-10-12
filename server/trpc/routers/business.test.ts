import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, inArray } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { appRouter } from '../index'

// Runs only against a local Postgres (test-setup drops the prod URL):
//   DATABASE_URL=postgresql://dev:dev@localhost:5441/wedance \
//   NEON_FETCH_ENDPOINT=http://localhost:4444/sql bunx vitest run server/trpc/routers/business.test.ts
const DATABASE_URL = process.env.DATABASE_URL

let db: any = null
if (DATABASE_URL) db = drizzle(neon(DATABASE_URL), { schema })

const caller = (dancerId: string | null, isAdmin = false) =>
  appRouter.createCaller({ db, dancerId, isAdmin } as any)

const tag = `hosting-test-${Date.now()}`
let owner: string
let other: string
const createdProfiles: string[] = []

describe.skipIf(!DATABASE_URL)('business router', () => {
  beforeAll(async () => {
    const rows = await db.insert(schema.dancers).values([
      { email: `${tag}-owner@test.local`, name: 'Owner' },
      { email: `${tag}-other@test.local`, name: 'Other' },
    ]).returning({ id: schema.dancers.id })
    owner = rows[0].id
    other = rows[1].id
  })

  afterAll(async () => {
    if (createdProfiles.length) {
      await db.delete(schema.profiles).where(inArray(schema.profiles.username, createdProfiles))
    }
    await db.delete(schema.dancers).where(inArray(schema.dancers.id, [owner, other]))
  })

  it('requires sign-in to create a profile', async () => {
    await expect(caller(null).business.create({ type: 'artist', name: 'Nobody' })).rejects.toThrow('Not signed in')
  })

  it('makes the creator the owner, and only the owner can edit', async () => {
    const { username } = await caller(owner).business.create({ type: 'artist', name: `${tag} Artist`, city: 'Munich' })
    createdProfiles.push(username)

    const mine = await caller(owner).business.myProfiles()
    expect(mine.managed.map(p => p.username)).toContain(username)

    await caller(owner).business.update({ username, bio: 'Teaches Timba', photos: [{ url: 'https://example.com/a.jpg' }], photo: 'https://example.com/a.jpg' })
    const p = await caller(owner).business.get({ username })
    expect(p.bio).toBe('Teaches Timba')
    expect(p.photo).toBe('https://example.com/a.jpg')

    await expect(caller(other).business.update({ username, bio: 'hijack' })).rejects.toThrow('You don’t manage this profile.')
    await expect(caller(other).business.get({ username })).rejects.toThrow('You don’t manage this profile.')
    expect((await caller(other).business.canManage({ username })).canManage).toBe(false)
    expect((await caller(owner).business.canManage({ username })).canManage).toBe(true)
  })

  it('refuses claims on a profile someone already manages', async () => {
    const username = createdProfiles[0]!
    await expect(caller(other).business.requestClaim({ username, message: 'it is me' })).rejects.toThrow('already manages')
  })

  it('lets a claimant manage an unclaimed profile once an admin approves', async () => {
    const username = `${tag}-venue`
    await db.insert(schema.profiles).values({ username, type: 'venue', name: 'Unclaimed Venue' })
    createdProfiles.push(username)

    await caller(other).business.requestClaim({ username, message: 'DM from @venue' })
    await expect(caller(other).business.update({ username, name: 'Mine' })).rejects.toThrow('You don’t manage this profile.')
    await expect(caller(other).business.listClaims()).rejects.toThrow('Admin access required')

    const claims = await caller(null, true).business.listClaims()
    const claim = claims.find(c => c.profileUsername === username)!
    expect(claim.message).toBe('DM from @venue')

    await caller(null, true).business.decideClaim({ claimId: claim.id, approve: true })
    const [p] = await db.select().from(schema.profiles).where(eq(schema.profiles.username, username))
    expect(p.claimed).toBe(true)

    await caller(other).business.update({ username, name: 'Mine now', city: 'Munich' })
    const updated = await caller(other).business.get({ username })
    expect(updated.name).toBe('Mine now')
    const [row] = await db.select().from(schema.profiles).where(eq(schema.profiles.username, username))
    expect(row.citySlug).toBe('munich')
  })

  it('treats a v4-claimed profile without 2026 managers as claimable', async () => {
    // Like MontunoClub: claimed=true came over from v4, nobody manages it here.
    const username = `${tag}-v4org`
    await db.insert(schema.profiles).values({ username, type: 'organizer', name: `${tag} V4 Org`, claimed: true })
    createdProfiles.push(username)

    const [hit] = (await caller(other).business.search({ q: `${tag} V4` })).filter(r => r.username === username)
    expect(hit?.managed).toBe(false)
    expect(await caller(null).business.canManage({ username })).toEqual({ canManage: false, managed: false })
    await expect(caller(other).business.requestClaim({ username, message: 'I run it' })).resolves.toEqual({ requested: true })

    // Once someone manages it, it reads as managed and new claims are refused.
    const [claim] = (await caller(null, true).business.listClaims()).filter(c => c.profileUsername === username)
    expect(claim?.profileManaged).toBe(false)
    await caller(null, true).business.decideClaim({ claimId: claim!.id, approve: true })
    expect((await caller(null).business.canManage({ username })).managed).toBe(true)
    await expect(caller(owner).business.requestClaim({ username, message: 'me too' })).rejects.toThrow('already manages')
  })

  it('picks a free handle when the name is taken', async () => {
    const a = await caller(owner).business.create({ type: 'organizer', name: `${tag} Org` })
    const b = await caller(owner).business.create({ type: 'organizer', name: `${tag} Org` })
    createdProfiles.push(a.username, b.username)
    expect(a.username).not.toBe(b.username)
  })
})
