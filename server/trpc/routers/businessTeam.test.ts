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
    expect(inbox.needs.some((n: any) => n.kind === 'join' && n.to === `/business/network/${username}/team`)).toBe(true)
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

  // --- RAZ-321: Claim verification workflow ---

  it('claim with evidence: evidence and evidenceType are stored and visible to admin', async () => {
    const username = `${tag}-ev`
    await db.insert(schema.profiles).values({ username, type: 'venue', name: `${tag} Evidence Venue` })
    handles.push(username)
    await as(ids.alex).businessTeam.requestAccess({
      username, kind: 'claim', message: 'I run this venue',
      evidence: 'https://instagram.com/evidence-venue', evidenceType: 'social_media',
    })
    const claims = await admin().business.listClaims()
    const c = claims.find((c: any) => c.profileUsername === username)!
    expect(c.evidence).toBe('https://instagram.com/evidence-venue')
    expect(c.evidenceType).toBe('social_media')
    // Clean up: approve so the claim is off the queue.
    await admin().business.decideClaim({ claimId: c.id, approve: true })
  })

  it('claim without evidence: defaults are stored', async () => {
    const username = `${tag}-noev`
    await db.insert(schema.profiles).values({ username, type: 'artist', name: `${tag} No Evidence Artist` })
    handles.push(username)
    await as(ids.javier).businessTeam.requestAccess({
      username, kind: 'claim', message: 'DM me from @noev',
    })
    const claims = await admin().business.listClaims()
    const c = claims.find((c: any) => c.profileUsername === username)!
    expect(c.evidence).toBe('')
    expect(c.evidenceType).toBe('other')
    // Clean up.
    await admin().business.decideClaim({ claimId: c.id, approve: false })
  })

  it('info_required: admin asks for more info, claimant sees it, can re-submit', async () => {
    const username = `${tag}-info`
    await db.insert(schema.profiles).values({ username, type: 'venue', name: `${tag} Info Venue` })
    handles.push(username)
    await as(ids.alex).businessTeam.requestAccess({
      username, kind: 'claim', message: 'This is my bar',
      evidence: 'https://mybar.com', evidenceType: 'website_link',
    })
    const claims = await admin().business.listClaims()
    const c = claims.find((c: any) => c.profileUsername === username)!

    // Admin requests more info.
    const result = await admin().business.decideClaim({
      claimId: c.id, approve: false, requestInfo: true,
      reviewerNote: 'Please send a DM from the venue Instagram account.',
    })
    expect(result.status).toBe('info_required')

    // info_required claims still show in the admin list.
    const afterClaims = await admin().business.listClaims()
    const afterClaim = afterClaims.find((c: any) => c.profileUsername === username)
    expect(afterClaim?.status).toBe('info_required')
    expect(afterClaim?.reviewerNote).toBe('Please send a DM from the venue Instagram account.')

    // Claimant sees it in their profiles list.
    const myProfiles = await as(ids.alex).business.myProfiles()
    const myClaim = myProfiles.claims.find((c: any) => c.username === username)
    expect(myClaim?.status).toBe('info_required')
    expect(myClaim?.reviewerNote).toBe('Please send a DM from the venue Instagram account.')

    // Claimant re-submits with better evidence.
    await as(ids.alex).businessTeam.requestAccess({
      username, kind: 'claim', message: 'Here is a DM screenshot',
      evidence: 'https://instagram.com/dm-proof', evidenceType: 'social_media',
    })
    const resubmitted = (await admin().business.listClaims()).find((c: any) => c.profileUsername === username)!
    expect(resubmitted.status).toBe('pending')
    expect(resubmitted.evidence).toBe('https://instagram.com/dm-proof')
    expect(resubmitted.reviewerNote).toBe('')

    // Now approve.
    await admin().business.decideClaim({ claimId: resubmitted.id, approve: true })
    const team = await as(ids.alex).businessTeam.team({ username })
    expect(team.myRole).toBe('owner')
  })

  it('info_required without a note is rejected', async () => {
    const username = `${tag}-nonote`
    await db.insert(schema.profiles).values({ username, type: 'artist', name: `${tag} No Note` })
    handles.push(username)
    await as(ids.javier).businessTeam.requestAccess({
      username, kind: 'claim', message: 'Claim without note',
    })
    const c = (await admin().business.listClaims()).find((c: any) => c.profileUsername === username)!
    await expect(admin().business.decideClaim({
      claimId: c.id, approve: false, requestInfo: true, reviewerNote: '',
    })).rejects.toThrow('Tell them what you need')
    // Clean up.
    await admin().business.decideClaim({ claimId: c.id, approve: false })
  })

  it('duplicate claim: re-submitting updates the existing claim', async () => {
    const username = `${tag}-dupe`
    await db.insert(schema.profiles).values({ username, type: 'venue', name: `${tag} Dupe Venue` })
    handles.push(username)
    await as(ids.alex).businessTeam.requestAccess({
      username, kind: 'claim', message: 'First attempt',
      evidence: 'https://first.com', evidenceType: 'website_link',
    })
    await as(ids.alex).businessTeam.requestAccess({
      username, kind: 'claim', message: 'Second attempt with better proof',
      evidence: 'https://better-proof.com', evidenceType: 'domain_email',
    })
    const claims = await admin().business.listClaims()
    const matching = claims.filter((c: any) => c.profileUsername === username)
    expect(matching).toHaveLength(1)
    expect(matching[0].message).toBe('Second attempt with better proof')
    expect(matching[0].evidence).toBe('https://better-proof.com')
    expect(matching[0].evidenceType).toBe('domain_email')
    await admin().business.decideClaim({ claimId: matching[0].id, approve: false })
  })

  it('non-admin cannot approve or reject claims', async () => {
    const username = `${tag}-auth`
    await db.insert(schema.profiles).values({ username, type: 'venue', name: `${tag} Auth Venue` })
    handles.push(username)
    await as(ids.javier).businessTeam.requestAccess({
      username, kind: 'claim', message: 'Normal user tries admin',
    })
    const claims = await admin().business.listClaims()
    const c = claims.find((c: any) => c.profileUsername === username)!
    await expect(as(ids.impostor).business.decideClaim({ claimId: c.id, approve: true }))
      .rejects.toThrow()
    await admin().business.decideClaim({ claimId: c.id, approve: false })
  })

  it('already-decided claim cannot be decided again', async () => {
    const username = `${tag}-double`
    await db.insert(schema.profiles).values({ username, type: 'artist', name: `${tag} Double Decide` })
    handles.push(username)
    await as(ids.javier).businessTeam.requestAccess({
      username, kind: 'claim', message: 'First round',
    })
    const c = (await admin().business.listClaims()).find((c: any) => c.profileUsername === username)!
    await admin().business.decideClaim({ claimId: c.id, approve: true })
    await expect(admin().business.decideClaim({ claimId: c.id, approve: false }))
      .rejects.toThrow('already decided')
  })

  it('approval grants profile management; rejection does not', async () => {
    const uApprove = `${tag}-grant`
    const uReject = `${tag}-deny`
    await db.insert(schema.profiles).values([
      { username: uApprove, type: 'venue', name: `${tag} Grant Venue` },
      { username: uReject, type: 'venue', name: `${tag} Deny Venue` },
    ])
    handles.push(uApprove, uReject)

    await as(ids.alex).businessTeam.requestAccess({ username: uApprove, kind: 'claim', message: 'Approve me' })
    await as(ids.alex).businessTeam.requestAccess({ username: uReject, kind: 'claim', message: 'Reject me' })

    const claims = await admin().business.listClaims()
    const cApprove = claims.find((c: any) => c.profileUsername === uApprove)!
    const cReject = claims.find((c: any) => c.profileUsername === uReject)!

    await admin().business.decideClaim({ claimId: cApprove.id, approve: true })
    await admin().business.decideClaim({ claimId: cReject.id, approve: false })

    // Approved: can manage.
    const team = await as(ids.alex).businessTeam.team({ username: uApprove })
    expect(team.myRole).toBe('owner')
    // Rejected: cannot manage.
    await expect(as(ids.alex).businessTeam.team({ username: uReject })).rejects.toThrow("don\u2019t manage")
  })

  it('reviewer note is stored on approve/reject', async () => {
    const username = `${tag}-rnote`
    await db.insert(schema.profiles).values({ username, type: 'artist', name: `${tag} Reviewer Note` })
    handles.push(username)
    await as(ids.javier).businessTeam.requestAccess({ username, kind: 'claim', message: 'Note test' })
    const c = (await admin().business.listClaims()).find((c: any) => c.profileUsername === username)!
    await admin().business.decideClaim({
      claimId: c.id, approve: false,
      reviewerNote: 'We could not verify your identity from the evidence provided.',
    })
    const [row] = await db.select({ reviewerNote: schema.profileClaims.reviewerNote })
      .from(schema.profileClaims).where(inArray(schema.profileClaims.id, [c.id]))
    expect(row.reviewerNote).toBe('We could not verify your identity from the evidence provided.')
  })
})
