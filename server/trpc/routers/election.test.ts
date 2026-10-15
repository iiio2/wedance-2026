/**
 * Hermetic tests for the moderator-election router (epic G800).
 * Covers: open → nominate → advance → vote → change-vote (history) → close →
 * winner + guidelines become the space's active ruleset. Plus one-vote enforcement.
 */
import { describe, it, expect, vi } from 'vitest'
import {
  dancers, profiles, profileMembers,
  moderatorElections, electionCandidates, electionVotes, electionVoteHistory, guidelineVersions,
} from '../../database/schema'

type FilterFn = (row: Record<string, any>) => boolean

vi.mock('drizzle-orm', async () => {
  const snakeToCamel = (s: string) => s.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())
  const resolveKey = (col: any): string | undefined => (col?.name ? snakeToCamel(col.name) : undefined)
  const eq = (col: any, val: any): FilterFn => { const k = resolveKey(col); return (r) => (k ? r[k] === val : false) }
  const and = (...p: FilterFn[]): FilterFn => (r) => p.every(f => f(r))
  const inArray = (col: any, arr: any[]): FilterFn => { const k = resolveKey(col); return (r) => (k ? arr.includes(r[k]) : false) }
  return { eq, and, inArray, desc: (c: any) => c, gt: () => () => false, sql: (..._a: any[]) => ({}) }
})

import { appRouter } from '../index'

// Deterministic UUID helpers so zod's .uuid() validation passes.
let _seq = 0
const genId = () => `00000000-0000-4000-8000-${String(++_seq).padStart(12, '0')}`
const U = {
  p1: '11111111-1111-4111-8111-111111111111',
  alice: '22222222-2222-4222-8222-222222222222',
  bob: '33333333-3333-4333-8333-333333333333',
  vera: '44444444-4444-4444-8444-444444444444',
  stub: '55555555-5555-4555-8555-555555555555',
}

interface Row { [k: string]: any }
class Q {
  constructor(private _rows: Row[]) {}
  where(f: FilterFn) { this._rows = this._rows.filter(f); return this }
  orderBy() { return this }
  limit(n: number) { this._rows = this._rows.slice(0, n); return this }
  innerJoin() { return this }
  then(res: any, rej?: any) { return Promise.resolve(this._rows).then(res, rej) }
}
class FakeDb {
  dancers: Row[] = []
  profiles: Row[] = []
  profileMembers: Row[] = []
  moderatorElections: Row[] = []
  electionCandidates: Row[] = []
  electionVotes: Row[] = []
  electionVoteHistory: Row[] = []
  guidelineVersions: Row[] = []
  // Return row COPIES (snapshots) — like real Drizzle — so a later update()
  // doesn't retroactively mutate a value a caller already read.
  select(_c?: any) { return { from: (t: any) => new Q(this.tableFor(t).map(r => ({ ...r }))) } }
  insert(t: any) {
    return { values: (row: Row) => {
      const id = row.id ?? genId()
      const rec = { id, ...row }
      this.tableFor(t).push(rec)
      const chain: any = Promise.resolve(undefined)
      chain.returning = () => Promise.resolve([rec])
      chain.onConflictDoUpdate = () => chain
      chain.onConflictDoNothing = () => chain
      return chain
    } }
  }
  update(t: any) {
    return { set: (v: Row) => ({ where: (f: FilterFn) => {
      this.tableFor(t).forEach(r => { if (f(r)) Object.assign(r, v) })
      return Promise.resolve()
    } }) }
  }
  private tableFor(t: any): Row[] {
    if (t === dancers) return this.dancers
    if (t === profiles) return this.profiles
    if (t === profileMembers) return this.profileMembers
    if (t === moderatorElections) return this.moderatorElections
    if (t === electionCandidates) return this.electionCandidates
    if (t === electionVotes) return this.electionVotes
    if (t === electionVoteHistory) return this.electionVoteHistory
    if (t === guidelineVersions) return this.guidelineVersions
    throw new Error('unexpected table')
  }
}
function caller(db: any, opts: { dancerId?: string | null, isAdmin?: boolean } = {}) {
  return appRouter.createCaller({ db, dancerId: opts.dancerId ?? null, isAdmin: opts.isAdmin ?? false, voterSessionId: null })
}

function seed() {
  const db = new FakeDb()
  db.profiles.push({ id: U.p1, username: 'pina', type: 'venue', name: 'Pina', status: 'visible', bookingModel: 'free', moderatorHandle: null, guidelines: null })
  db.dancers.push({ id: U.alice, username: 'alice', name: 'Alice', photo: null })
  db.dancers.push({ id: U.bob, username: 'bob', name: 'Bob', photo: null })
  db.dancers.push({ id: U.vera, username: 'vera', name: 'Vera', photo: null })
  db.dancers.push({ id: U.stub, username: null, name: 'Stub', photo: null }) // no profile → ineligible
  return db
}

describe('election full flow', () => {
  it('runs open → nominate → vote → change → close and elects the majority winner', async () => {
    const db = seed()
    const admin = caller(db, { dancerId: U.alice, isAdmin: true })

    const { electionId } = await admin.election.open({ profileId: U.p1, termStart: '2026-01-01' })
    expect(electionId).toBeTruthy()

    const a = await caller(db, { dancerId: U.alice }).election.nominate({ electionId, guidelines: 'Alice keeps it chill and inclusive for all levels.' })
    const b = await caller(db, { dancerId: U.bob }).election.nominate({ electionId, guidelines: 'Bob runs a tighter schedule with themed nights.' })

    await admin.election.advanceToVoting({ electionId })

    // Vera votes Alice, then changes to Bob. Alice votes Alice, Bob votes Bob.
    await caller(db, { dancerId: U.vera }).election.castVote({ electionId, candidateId: a.candidateId })
    const changed = await caller(db, { dancerId: U.vera }).election.castVote({ electionId, candidateId: b.candidateId })
    expect(changed).toMatchObject({ changed: true })
    const noop = await caller(db, { dancerId: U.vera }).election.castVote({ electionId, candidateId: b.candidateId })
    expect(noop).toMatchObject({ unchanged: true })
    await caller(db, { dancerId: U.alice }).election.castVote({ electionId, candidateId: a.candidateId })
    await caller(db, { dancerId: U.bob }).election.castVote({ electionId, candidateId: b.candidateId })

    // One vote per real profile: Vera has exactly one current-vote row.
    expect(db.electionVotes.filter(v => v.voterDancerId === U.vera)).toHaveLength(1)
    // ...but the full change is preserved in the immutable history (cast + change).
    expect(db.electionVoteHistory.filter(v => v.voterDancerId === U.vera)).toHaveLength(2)

    // myVote reflects the current choice + full history.
    const mine = await caller(db, { dancerId: U.vera }).election.myVote({ electionId })
    expect(mine.candidateId).toBe(b.candidateId)
    expect(mine.history).toHaveLength(2)
    expect(mine.history[0]!.fromCandidateId).toBeNull()
    expect(mine.history[1]!.fromCandidateId).toBe(a.candidateId)

    // Close: Bob wins 2–1; his guidelines become the space's active ruleset.
    const res = await admin.election.close({ electionId })
    expect(res.winnerCandidateId).toBe(b.candidateId)
    expect(res.votes).toBe(2)

    const [profile] = db.profiles
    expect(profile!.guidelines).toContain('themed nights')
    expect(profile!.moderatorHandle).toBe('@bob')
    expect(db.guidelineVersions).toHaveLength(1)
    expect(db.guidelineVersions[0]).toMatchObject({ moderatorDancerId: U.bob, profileId: U.p1 })
  })

  it('rejects a stub account (no real profile) from nominating', async () => {
    const db = seed()
    const { electionId } = await caller(db, { dancerId: U.alice, isAdmin: true }).election.open({ profileId: U.p1 })
    await expect(
      caller(db, { dancerId: U.stub }).election.nominate({ electionId, guidelines: 'x'.repeat(30) }),
    ).rejects.toThrow(/complete WeDance profile/i)
  })

  it('refuses a second concurrent election for the same space', async () => {
    const db = seed()
    const admin = caller(db, { dancerId: U.alice, isAdmin: true })
    await admin.election.open({ profileId: U.p1 })
    await expect(admin.election.open({ profileId: U.p1 })).rejects.toThrow(/already running/i)
  })
})
