import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { inArray } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { appRouter } from '../index'

// Local Postgres only (test-setup drops a remote DATABASE_URL):
//   DATABASE_URL=postgresql://dev:dev@localhost:5441/wedance \
//   NEON_FETCH_ENDPOINT=http://localhost:4444/sql bunx vitest run server/trpc/routers/businessTeam.test.ts
const DATABASE_URL = process.env.DATABASE_URL
let db: any = null
if (DATABASE_URL) db = drizzle(neon(DATABASE_URL), { schema })

const as = (dancerId: string | null, isAdmin = false) => appRouter.createCaller({ db, dancerId, isAdmin } as any)
const admin = () => as(null, true)

const tag = `team-${Date.now()}`
const ids: Record<'javier' | 'alex' | 'impostor' | 'realOwner', string> = {} as any
const handles: string[] = []

describe.skipIf(!DATABASE_URL)('businessTeam router', () => {
  beforeAll(async () => {
    const rows = await db.insert(schema.dancers).values(
      (['javier', 'alex', 'impostor', 'realOwner'] as const).map(n => ({ email: `${tag}-${n}@test.local`, name: n })),
    ).returning({ id: schema.dancers.id })
    ;(['javier', 'alex', 'impostor', 'realOwner'] as const).forEach((n, i) => { ids[n] = rows[i].id })
  })

  afterAll(async () => {
    if (handles.length) await db.delete(schema.profiles).where(inArray(schema.profiles.username, handles))
    await db.delete(schema.dancers).where(inArray(schema.dancers.id, Object.values(ids)))
  })

  it('join: owners approve, the new editor can edit but not manage the team', async () => {
    const { username } = await as(ids.javier).business.create({ type: 'organizer', name: `${tag} La Clave` })
    handles.push(username)

    const res = await as(ids.alex).businessTeam.requestAccess({ username, kind: 'join', role: 'editor', title: 'Promoter', message: 'Alösha, promo partner' })
    expect(res).toMatchObject({ kind: 'join', reviewer: 'owners' })

    // Javier sees it in his inbox and on the team page; WeDance admins don't get joins.
    const inbox = await as(ids.javier).businessEvents.inbox()
    expect(inbox.needs.some((n: any) => n.kind === 'join' && n.to === `/business/profiles/${username}/team`)).toBe(true)
    expect((await admin().business.listClaims()).some((c: any) => c.profileUsername === username)).toBe(false)

    const team = await as(ids.javier).businessTeam.team({ username })
    expect(team.requests).toHaveLength(1)
    // Someone who isn't an owner can't decide.
    await expect(as(ids.impostor).businessTeam.decideJoin({ requestId: team.requests[0]!.id, approve: true })).rejects.toThrow('Only owners')
    await as(ids.javier).businessTeam.decideJoin({ requestId: team.requests[0]!.id, approve: true })

    const after = await as(ids.alex).businessTeam.team({ username })
    expect(after.myRole).toBe('editor')
    expect(after.requests).toEqual([]) // editors don't see requests
    expect(after.members.find((m: any) => m.me)?.title).toBe('Promoter')
    await as(ids.alex).business.update({ username, bio: 'Thursday Latin nights' })
    await expect(as(ids.alex).businessTeam.setRole({ username, dancerId: ids.javier, role: 'editor' })).rejects.toThrow('Only owners')
  })

  it('always keeps one owner; hand over, then leave', async () => {
    const username = handles[0]!
    await expect(as(ids.javier).businessTeam.removeMember({ username, dancerId: ids.javier })).rejects.toThrow('at least one owner')
    await expect(as(ids.javier).businessTeam.setRole({ username, dancerId: ids.javier, role: 'editor' })).rejects.toThrow('at least one owner')
    await as(ids.javier).businessTeam.setRole({ username, dancerId: ids.alex, role: 'owner' })
    await as(ids.javier).businessTeam.removeMember({ username, dancerId: ids.javier })
    const team = await as(ids.alex).businessTeam.team({ username })
    expect(team.members.map((m: any) => m.name)).toEqual(['alex'])
    await expect(as(ids.javier).businessTeam.team({ username })).rejects.toThrow('don’t manage')
  })

  it('reclaim goes to WeDance, not the owners; approving can remove them', async () => {
    const { username } = await as(ids.impostor).business.create({ type: 'artist', name: `${tag} Real Artist` })
    handles.push(username)
    const res = await as(ids.realOwner).businessTeam.requestAccess({ username, kind: 'reclaim', message: 'It’s me — DM from @realartist' })
    expect(res).toMatchObject({ kind: 'reclaim', reviewer: 'wedance' })

    // The impostor can't see or decide it.
    expect((await as(ids.impostor).businessTeam.team({ username })).requests).toEqual([])
    const claim = (await admin().business.listClaims()).find((c: any) => c.profileUsername === username)!
    expect(claim.kind).toBe('reclaim')
    expect(claim.managers.map((m: any) => m.name)).toEqual(['impostor'])
    await expect(as(ids.impostor).businessTeam.decideJoin({ requestId: claim.id, approve: true })).rejects.toThrow('not found')

    await admin().business.decideClaim({ claimId: claim.id, approve: true, removeOthers: true })
    const team = await as(ids.realOwner).businessTeam.team({ username })
    expect(team.members.map((m: any) => [m.name, m.role])).toEqual([['realOwner', 'owner']])

    const history = await as(ids.realOwner).businessTeam.history({ username })
    expect(history.map((h: any) => h.action)).toEqual(expect.arrayContaining(['created', 'requested', 'removed', 'approved']))
  })

  it('an unmanaged profile always becomes a claim, whatever was asked', async () => {
    const username = `${tag}-free`
    await db.insert(schema.profiles).values({ username, type: 'venue', name: `${tag} Free Venue` })
    handles.push(username)
    const res = await as(ids.alex).businessTeam.requestAccess({ username, kind: 'join', message: 'We run this place' })
    expect(res.kind).toBe('claim')
    await expect(as(ids.alex).businessTeam.requestAccess({ username: handles[0]!, kind: 'join', message: 'again' })).rejects.toThrow('already on this team')
  })
})
