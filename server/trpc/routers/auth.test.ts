/**
 * Unit tests for the email+password auth router (login + register).
 *
 * Follows the hermetic FakeDb pattern established in claim.test.ts so the suite
 * runs without a live Neon connection. FirebaseScrypt is real here — we don't
 * mock it — so the register→login round-trip actually exercises the same
 * hashing that legacy wedance-v4 users rely on. The Firebase env params are set
 * in beforeAll; any non-empty signer key works for the round-trip since verify
 * uses the same params that hash used.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest'
import {
  dancers, sessions, electionVotes, electionVoteHistory, electionCandidates,
  moderatorElections, festivalSignups, cityVideos, videoVotes, cityBattleVotes,
  reviews, guidelineVersions, bookingRequests, dinnerSignups, dinnerGroupMembers,
  giveawayEntries, recommendationRequests, festivalSubmissions, gigs, hangouts, hangoutRsvps,
  communityGroupReports, planItems, festivalRideShares, festivalRoommateLookups,
  referrals, profiles,
} from '../../database/schema'

// ---------- mocks ----------
// drizzle-orm's `eq` returns an opaque tagged object; replace it with a
// predicate-builder so FakeDb's `.where(filter)` can run a plain JS check.

type FilterFn = (row: Record<string, any>) => boolean

vi.mock('drizzle-orm', async () => {
  const snakeToCamel = (s: string) =>
    s.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())

  const resolveKey = (col: any): string | undefined => {
    const dbName: string | undefined = col?.name
    return dbName ? snakeToCamel(dbName) : undefined
  }

  const eq = (col: any, val: any): FilterFn => {
    const jsKey = resolveKey(col)
    return (row) => (jsKey ? row[jsKey] === val : false)
  }

  const and = (...preds: FilterFn[]): FilterFn => (row) => preds.every(p => p(row))

  const or = (...preds: (FilterFn | undefined)[]): FilterFn => (row) =>
    preds.filter(Boolean).some(p => (p as FilterFn)(row))

  const gt = (col: any, val: any): FilterFn => {
    const jsKey = resolveKey(col)
    return (row) => {
      if (!jsKey) return false
      const rowVal = row[jsKey]
      if (rowVal == null || val == null) return false
      return rowVal > val
    }
  }

  // sql template literals return a no-match predicate in the FakeDb (SQL paths
  // need integration tests against a real DB)
  const sql = (..._args: any[]): FilterFn => () => false

  return { eq, and, or, gt, sql }
})

// Mock email sending so requestMagicLink doesn't need a real mailer.
const mockSendMagicLink = vi.fn().mockResolvedValue(undefined)
const mockSendPasswordReset = vi.fn().mockResolvedValue(undefined)
vi.mock('../../utils/email', () => ({
  sendMagicLinkEmail: (...args: any[]) => mockSendMagicLink(...args),
  sendPasswordResetEmail: (...args: any[]) => mockSendPasswordReset(...args),
}))

// Mock Nuxt's useRuntimeConfig (auto-imported in the auth router).
vi.stubGlobal('useRuntimeConfig', () => ({ siteUrl: 'http://localhost:3000' }))

import { appRouter } from '../index'

// ---------- in-memory fake DB ----------

interface FakeRow { [k: string]: any }

// Query builder that can be awaited or executed via batch
class FakeQuery {
  private executeFn: () => Promise<void>

  constructor(fn: () => Promise<void>) {
    this.executeFn = fn
  }

  then(onFulfilled?: any, onRejected?: any) {
    return this.executeFn().then(onFulfilled, onRejected)
  }

  catch(onRejected?: any) {
    return this.executeFn().catch(onRejected)
  }

  _execute() {
    return this.executeFn()
  }
}

class FakeDb {
  dancers: FakeRow[] = []
  sessions: FakeRow[] = []
  electionVotes: FakeRow[] = []
  electionVoteHistory: FakeRow[] = []
  electionCandidates: FakeRow[] = []
  moderatorElections: FakeRow[] = []
  festivalSignups: FakeRow[] = []
  cityVideos: FakeRow[] = []
  videoVotes: FakeRow[] = []
  cityBattleVotes: FakeRow[] = []
  reviews: FakeRow[] = []
  guidelineVersions: FakeRow[] = []
  bookingRequests: FakeRow[] = []
  dinnerSignups: FakeRow[] = []
  dinnerGroupMembers: FakeRow[] = []
  giveawayEntries: FakeRow[] = []
  recommendationRequests: FakeRow[] = []
  festivalSubmissions: FakeRow[] = []
  gigs: FakeRow[] = []
  hangouts: FakeRow[] = []
  hangoutRsvps: FakeRow[] = []
  communityGroupReports: FakeRow[] = []
  planItems: FakeRow[] = []
  festivalRideShares: FakeRow[] = []
  festivalRoommateLookups: FakeRow[] = []
  referrals: FakeRow[] = []
  profiles: FakeRow[] = []

  seedDancer(row: Partial<FakeRow> & { email: string }) {
    const id = row.id ?? 'dancer-' + this.dancers.length
    const full: FakeRow = {
      id,
      name: row.name ?? 'Test Dancer',
      isAdmin: row.isAdmin ?? false,
      salt: row.salt ?? '',
      hash: row.hash ?? '',
      danceStyles: row.danceStyles ?? [],
      role: row.role ?? null,
      city: row.city ?? null,
      intent: row.intent ?? null,
      onboardedAt: row.onboardedAt ?? null,
      ...row,
    }
    this.dancers.push(full)
    return id
  }

  select(_columns: any) {
    return {
      from: (table: any) => ({
        where: (filter: FilterFn) => Promise.resolve(this.tableFor(table).filter(filter)),
      }),
    }
  }

  insert(table: any) {
    const self = this
    return {
      values: (row: FakeRow) => {
        // Lazy: don't execute until we know which chain method (.returning,
        // .onConflictDoUpdate, or bare await) the caller uses.
        const doPlainInsert = () => {
          if (table === dancers && self.dancers.some(d => d.email === row.email)) {
            const err: any = new Error('duplicate key value violates unique constraint')
            err.code = '23505'
            throw err
          }
          const id = row.id ?? (table === dancers ? 'dancer-' : 'session-') + self.tableFor(table).length
          const inserted = { id, ...row }
          self.tableFor(table).push(inserted)
          return inserted
        }

        // Build a thenable that also exposes .returning() and .onConflictDoUpdate().
        // Whichever is called first determines the execution path.
        let executed = false
        let insertedRow: FakeRow | undefined
        const ensurePlainInsert = () => {
          if (!executed) { executed = true; insertedRow = doPlainInsert() }
          return insertedRow!
        }

        const chain: any = {
          then(onFulfilled?: any, onRejected?: any) {
            try { ensurePlainInsert() } catch (e) { return Promise.reject(e).then(onFulfilled, onRejected) }
            return Promise.resolve(undefined).then(onFulfilled, onRejected)
          },
          returning(_cols: any) {
            return { then(onFulfilled?: any, onRejected?: any) {
              try { const row = ensurePlainInsert(); return Promise.resolve([row]).then(onFulfilled, onRejected) }
              catch (e) { return Promise.reject(e).then(onFulfilled, onRejected) }
            } }
          },
          onConflictDoUpdate({ set }: { target?: any; set: FakeRow }) {
            executed = true
            if (table === dancers) {
              const existing = self.dancers.find(d => d.email === row.email)
              if (existing) {
                Object.assign(existing, set)
                return Promise.resolve(undefined)
              }
            }
            const id = row.id ?? (table === dancers ? 'dancer-' : 'session-') + self.tableFor(table).length
            self.tableFor(table).push({ id, ...row })
            return Promise.resolve(undefined)
          },
        }
        return chain
      },
    }
  }

  update(table: any) {
    return {
      set: (patch: FakeRow) => ({
        where: (filter: FilterFn) => {
          return new FakeQuery(async () => {
            for (const row of this.tableFor(table)) {
              if (filter(row)) Object.assign(row, patch)
            }
          })
        },
      }),
    }
  }

  delete(table: any) {
    return {
      where: (filter: FilterFn) => {
        return new FakeQuery(async () => {
          const target = this.tableFor(table)
          const indices = []
          for (let i = target.length - 1; i >= 0; i--) {
            if (filter(target[i])) indices.push(i)
          }
          // Delete in reverse order to avoid index shifting
          for (const i of indices) target.splice(i, 1)
        })
      },
    }
  }

  batch(statements: any[]) {
    // Execute all statements in order (atomic on neon-http)
    // Each statement is either a FakeQuery or a Promise
    return Promise.all(statements.map(s => s._execute ? s._execute() : s))
  }

  transaction(fn: (tx: any) => Promise<void>): Promise<void> {
    // transaction() is no longer supported; db.batch() should be used instead
    throw new Error('transaction() is not supported by neon-http driver. Use db.batch() instead.')
  }

  private tableFor(table: any): FakeRow[] {
    if (table === dancers) return this.dancers
    if (table === sessions) return this.sessions
    if (table === electionVotes) return this.electionVotes
    if (table === electionVoteHistory) return this.electionVoteHistory
    if (table === electionCandidates) return this.electionCandidates
    if (table === moderatorElections) return this.moderatorElections
    if (table === festivalSignups) return this.festivalSignups
    if (table === cityVideos) return this.cityVideos
    if (table === videoVotes) return this.videoVotes
    if (table === cityBattleVotes) return this.cityBattleVotes
    if (table === reviews) return this.reviews
    if (table === guidelineVersions) return this.guidelineVersions
    if (table === bookingRequests) return this.bookingRequests
    if (table === dinnerSignups) return this.dinnerSignups
    if (table === dinnerGroupMembers) return this.dinnerGroupMembers
    if (table === giveawayEntries) return this.giveawayEntries
    if (table === recommendationRequests) return this.recommendationRequests
    if (table === festivalSubmissions) return this.festivalSubmissions
    if (table === gigs) return this.gigs
    if (table === hangouts) return this.hangouts
    if (table === hangoutRsvps) return this.hangoutRsvps
    if (table === communityGroupReports) return this.communityGroupReports
    if (table === planItems) return this.planItems
    if (table === festivalRideShares) return this.festivalRideShares
    if (table === festivalRoommateLookups) return this.festivalRoommateLookups
    if (table === referrals) return this.referrals
    if (table === profiles) return this.profiles
    throw new Error('unexpected table in FakeDb')
  }
}

function createCaller(db: any, opts: { dancerId?: string | null; isAdmin?: boolean } = {}) {
  return appRouter.createCaller({
    db,
    dancerId: opts.dancerId ?? null,
    isAdmin: opts.isAdmin ?? false,
  })
}

beforeAll(() => {
  // Any consistent, non-empty params make the hash→verify round-trip valid.
  process.env.FIREBASE_SALT_SEPARATOR = 'Bw=='
  process.env.FIREBASE_SIGNER_KEY = 'test-signer-key-for-unit-tests-only'
})

// ---------- register ----------

describe('auth.register', () => {
  it('creates a dancer with a salt + hash and returns a session', async () => {
    const db = new FakeDb()
    const caller = createCaller(db)

    const result = await caller.auth.register({
      name: 'Ada Lovelace',
      email: 'Ada@Example.COM',
      password: 'supersecret',
    })

    expect(result.name).toBe('Ada Lovelace')
    expect(result.sessionToken).toBeTruthy()
    expect(result.dancerId).toBeTruthy()

    const row = db.dancers[0]
    // Email is normalised to lowercase.
    expect(row.email).toBe('ada@example.com')
    // Salt + hash were generated (not the empty-string defaults).
    expect(row.salt).toBeTruthy()
    expect(row.hash).toBeTruthy()
    expect(row.hash).not.toBe('supersecret')
    // A session row was minted.
    expect(db.sessions).toHaveLength(1)
    expect(db.sessions[0].token).toBe(result.sessionToken)
  })

  it('preserves onboarding fields (danceStyles / role / city)', async () => {
    const db = new FakeDb()
    const caller = createCaller(db)

    await caller.auth.register({
      name: 'Grace Hopper',
      email: 'grace@example.com',
      password: 'password123',
      danceStyles: ['Salsa', 'Bachata'],
      role: 'follow',
      city: 'Munich',
    })

    const row = db.dancers[0]
    expect(row.danceStyles).toEqual(['Salsa', 'Bachata'])
    expect(row.role).toBe('follow')
    expect(row.city).toBe('Munich')
  })

  it('rejects a duplicate email with a clean message', async () => {
    const db = new FakeDb()
    db.seedDancer({ email: 'taken@example.com' })
    const caller = createCaller(db)

    await expect(
      caller.auth.register({
        name: 'Someone',
        email: 'taken@example.com',
        password: 'password123',
      }),
    ).rejects.toThrow(/Email already in use/)
  })

  it('rejects a short password (< 8 chars)', async () => {
    const db = new FakeDb()
    const caller = createCaller(db)

    await expect(
      caller.auth.register({
        name: 'Shorty',
        email: 'short@example.com',
        password: 'abc',
      }),
    ).rejects.toThrow()
  })
})

// ---------- login ----------

describe('auth.login', () => {
  it('succeeds with the correct password (round-trips against register)', async () => {
    const db = new FakeDb()
    const caller = createCaller(db)

    await caller.auth.register({
      name: 'Login User',
      email: 'login@example.com',
      password: 'correct-horse',
    })
    const sessionsBefore = db.sessions.length

    const result = await caller.auth.login({
      email: 'login@example.com',
      password: 'correct-horse',
    })

    expect(result.name).toBe('Login User')
    expect(result.sessionToken).toBeTruthy()
    // A second session row was minted by login.
    expect(db.sessions.length).toBe(sessionsBefore + 1)
  })

  it('is case-insensitive on the email (login email may be capitalised)', async () => {
    const db = new FakeDb()
    const caller = createCaller(db)

    await caller.auth.register({
      name: 'Case User',
      email: 'case@example.com',
      password: 'password123',
    })

    const result = await caller.auth.login({
      email: 'CASE@EXAMPLE.COM',
      password: 'password123',
    })
    expect(result.name).toBe('Case User')
  })

  it('fails with the wrong password and does not mint a session', async () => {
    const db = new FakeDb()
    const caller = createCaller(db)

    await caller.auth.register({
      name: 'Wrong Pass',
      email: 'wrong@example.com',
      password: 'correct-password',
    })
    const sessionsBefore = db.sessions.length

    await expect(
      caller.auth.login({ email: 'wrong@example.com', password: 'not-the-password' }),
    ).rejects.toThrow(/Invalid email or password/)
    expect(db.sessions.length).toBe(sessionsBefore)
  })

  it('fails for an unknown email with the same generic error (no user enumeration)', async () => {
    const db = new FakeDb()
    const caller = createCaller(db)

    await expect(
      caller.auth.login({ email: 'ghost@example.com', password: 'whatever123' }),
    ).rejects.toThrow(/Invalid email or password/)
  })

  it('fails for a dancer that has no password set (magic-link-only account)', async () => {
    const db = new FakeDb()
    // Seeded with empty salt/hash — e.g. created via the festival/magic-link flow.
    db.seedDancer({ email: 'passwordless@example.com', salt: '', hash: '' })
    const caller = createCaller(db)

    await expect(
      caller.auth.login({ email: 'passwordless@example.com', password: 'anything123' }),
    ).rejects.toThrow(/Invalid email or password/)
  })
})

// ---------- completeOnboarding ----------

describe('auth.completeOnboarding', () => {
  it('updates intent + collected fields and stamps onboardedAt', async () => {
    const db = new FakeDb()
    const id = db.seedDancer({ email: 'onboard@example.com' })
    const caller = createCaller(db, { dancerId: id })

    const before = db.dancers[0].onboardedAt
    const result = await caller.auth.completeOnboarding({
      intent: 'social',
      city: 'Munich',
      danceStyles: ['Salsa', 'Bachata'],
      role: 'both',
    })

    expect(result).toEqual({ ok: true })
    const row = db.dancers[0]
    expect(row.intent).toBe('social')
    expect(row.city).toBe('Munich')
    expect(row.danceStyles).toEqual(['Salsa', 'Bachata'])
    expect(row.role).toBe('both')
    // onboardedAt went from null to a Date.
    expect(before).toBeNull()
    expect(row.onboardedAt).toBeInstanceOf(Date)
  })

  it('a Skip (intent-only) stamps onboardedAt without wiping existing fields', async () => {
    const db = new FakeDb()
    const id = db.seedDancer({
      email: 'skip@example.com',
      city: 'Berlin',
      danceStyles: ['Zouk'],
      role: 'lead',
    })
    const caller = createCaller(db, { dancerId: id })

    await caller.auth.completeOnboarding({ intent: 'skipped' })

    const row = db.dancers[0]
    expect(row.intent).toBe('skipped')
    expect(row.onboardedAt).toBeInstanceOf(Date)
    // Existing fields untouched — no accidental wipe.
    expect(row.city).toBe('Berlin')
    expect(row.danceStyles).toEqual(['Zouk'])
    expect(row.role).toBe('lead')
  })

  it('rejects when unauthenticated', async () => {
    const db = new FakeDb()
    const caller = createCaller(db) // no dancerId

    await expect(
      caller.auth.completeOnboarding({ intent: 'social' }),
    ).rejects.toThrow(/Not signed in/)
  })
})

// ---------- me (extended fields) ----------

describe('auth.me', () => {
  it('returns null when unauthenticated', async () => {
    const db = new FakeDb()
    const caller = createCaller(db)
    expect(await caller.auth.me()).toBeNull()
  })

  it('returns the extended profile fields for a signed-in dancer', async () => {
    const db = new FakeDb()
    const onboardedAt = new Date('2026-07-04T10:00:00.000Z')
    const id = db.seedDancer({
      email: 'me@example.com',
      name: 'Me User',
      username: 'me-user-x1',
      city: 'Munich',
      danceStyles: ['Salsa'],
      role: 'follow',
      intent: 'social',
      onboardedAt,
    })
    const caller = createCaller(db, { dancerId: id })

    const me = await caller.auth.me()
    expect(me).toEqual({
      id,
      name: 'Me User',
      username: 'me-user-x1',
      isAdmin: false,
      city: 'Munich',
      danceStyles: ['Salsa'],
      danceLevels: {},
      role: 'follow',
      intent: 'social',
      onboardedAt: '2026-07-04T10:00:00.000Z',
      bio: null,
      photo: null,
      instagram: null,
      youtube: null,
      website: null,
      profilePublic: true,
    })
  })

  it('returns null onboardedAt/intent for a dancer that has not onboarded', async () => {
    const db = new FakeDb()
    const id = db.seedDancer({ email: 'fresh@example.com', name: 'Fresh' })
    const caller = createCaller(db, { dancerId: id })

    const me = await caller.auth.me()
    expect(me?.onboardedAt).toBeNull()
    expect(me?.intent).toBeNull()
    expect(me?.danceStyles).toEqual([])
  })
})

// ---------- resetPassword (via magic-link token) ----------

describe('auth.resetPassword', () => {
  it('sets a new password via a valid magic token and returns a session', async () => {
    const db = new FakeDb()
    // Register a user with a known password.
    await createCaller(db).auth.register({ name: 'Reset User', email: 'reset@example.com', password: 'oldpassword' })

    // Simulate a magic token being set (as requestMagicLink would do).
    db.dancers[0].magicToken = 'reset-token-123'
    db.dancers[0].magicTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 min from now

    const caller = createCaller(db)
    const result = await caller.auth.resetPassword({ token: 'reset-token-123', newPassword: 'newpassword1' })

    expect(result.name).toBe('Reset User')
    expect(result.sessionToken).toBeTruthy()

    // Old password should no longer work.
    await expect(createCaller(db).auth.login({ email: 'reset@example.com', password: 'oldpassword' })).rejects.toBeTruthy()

    // New password should work.
    const loginResult = await createCaller(db).auth.login({ email: 'reset@example.com', password: 'newpassword1' })
    expect(loginResult.dancerId).toBe(result.dancerId)
  })

  it('clears the magic token after use (single-use)', async () => {
    const db = new FakeDb()
    db.seedDancer({ email: 'single-use@example.com', name: 'Single Use' })
    db.dancers[0].magicToken = 'one-time-token'
    db.dancers[0].magicTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000)

    const caller = createCaller(db)
    await caller.auth.resetPassword({ token: 'one-time-token', newPassword: 'brandnew1' })

    // Token is cleared — second attempt fails.
    await expect(caller.auth.resetPassword({ token: 'one-time-token', newPassword: 'another12' }))
      .rejects.toThrow(/Invalid or expired/)
  })

  it('rejects an invalid token', async () => {
    const db = new FakeDb()
    const caller = createCaller(db)

    await expect(caller.auth.resetPassword({ token: 'bogus-token', newPassword: 'newpassword1' }))
      .rejects.toThrow(/Invalid or expired/)
  })

  it('rejects a short password (< 8 chars)', async () => {
    const db = new FakeDb()
    const caller = createCaller(db)

    await expect(caller.auth.resetPassword({ token: 'any-token', newPassword: 'short' }))
      .rejects.toThrow()
  })

  it('sets a password for a dancer that previously had none (magic-link-only account)', async () => {
    const db = new FakeDb()
    // A passwordless dancer (created via magic link / festival flow).
    db.seedDancer({ email: 'nopass@example.com', name: 'No Pass', salt: '', hash: '' })
    db.dancers[0].magicToken = 'first-password-token'
    db.dancers[0].magicTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000)

    const caller = createCaller(db)
    await caller.auth.resetPassword({ token: 'first-password-token', newPassword: 'myfirstpw' })

    // Can now log in with the new password.
    const loginResult = await createCaller(db).auth.login({ email: 'nopass@example.com', password: 'myfirstpw' })
    expect(loginResult.name).toBe('No Pass')
  })
})

// ---------- requestMagicLink (recovery / login) ----------

describe('auth.requestMagicLink', () => {
  beforeEach(() => {
    mockSendMagicLink.mockClear()
    mockSendPasswordReset.mockClear()
  })

  it('sends a recovery email for an existing dancer', async () => {
    const db = new FakeDb()
    db.seedDancer({ email: 'exists@example.com', name: 'Existing User' })
    const caller = createCaller(db)

    const result = await caller.auth.requestMagicLink({
      email: 'exists@example.com',
      purpose: 'recovery',
    })

    expect(result).toEqual({ sent: true })
    expect(mockSendPasswordReset).toHaveBeenCalledOnce()
    expect(mockSendPasswordReset.mock.calls[0][0]).toBe('exists@example.com')
    // Magic token was written to the existing dancer row.
    expect(db.dancers[0].magicToken).toBeTruthy()
  })

  it('recovery for an unknown email sends nothing and reports no account', async () => {
    const db = new FakeDb()
    const caller = createCaller(db)

    const result = await caller.auth.requestMagicLink({
      email: 'ghost@example.com',
      purpose: 'recovery',
    })

    // The UI uses this to offer sign-up instead of "check your email".
    expect(result).toEqual({ sent: false, accountExists: false })
    // No email to a non-user, and no account created for them.
    expect(mockSendPasswordReset).not.toHaveBeenCalled()
    expect(mockSendMagicLink).not.toHaveBeenCalled()
    expect(db.dancers).toHaveLength(0)
  })

  it('recovery leaves the existing profile fields untouched', async () => {
    const db = new FakeDb()
    db.seedDancer({ email: 'keep@example.com', name: 'Keep Me', city: 'munich' })
    const caller = createCaller(db)

    await caller.auth.requestMagicLink({
      email: 'keep@example.com',
      name: 'Overwrite Attempt',
      city: 'berlin',
      purpose: 'recovery',
    })

    expect(db.dancers[0].name).toBe('Keep Me')
    expect(db.dancers[0].city).toBe('munich')
    expect(db.dancers[0].magicToken).toBeTruthy()
  })

  it('login magic link still creates an account for a new email', async () => {
    const db = new FakeDb()
    const caller = createCaller(db)

    const result = await caller.auth.requestMagicLink({ email: 'new@example.com', purpose: 'login' })

    expect(result).toEqual({ sent: true })
    expect(db.dancers).toHaveLength(1)
    expect(mockSendMagicLink).toHaveBeenCalledOnce()
  })

  it('never exposes raw DB errors on the recovery path (RAZ-413)', async () => {
    const db = new FakeDb()
    db.seedDancer({ email: 'crash@example.com', name: 'Crash' })
    db.update = () => ({
      set: () => ({
        where: () => { throw new Error('Failed query: update "dancers" ... params: [secret-token]') },
      }),
    }) as any
    const caller = createCaller(db)

    const result = await caller.auth.requestMagicLink({
      email: 'crash@example.com',
      purpose: 'recovery',
    })
    expect(result).toEqual({ sent: true })
    expect(mockSendPasswordReset).not.toHaveBeenCalled()
  })

  it('never exposes raw DB errors to the client (RAZ-413)', async () => {
    // Simulate a DB failure — e.g. a missing column, connection error, or
    // constraint violation. The handler must swallow the error and return
    // { sent: true } so no SQL or params leak to the caller.
    const db = new FakeDb()
    const originalInsert = db.insert.bind(db)
    db.insert = (table: any) => {
      if (table === dancers) {
        return {
          values: () => ({
            onConflictDoUpdate: () => { throw new Error('Failed query: insert into "dancers" ... params: [secret-token]') },
          }),
        } as any
      }
      return originalInsert(table)
    }
    const caller = createCaller(db)

    // Must NOT throw — the raw "Failed query" error stays server-side.
    const result = await caller.auth.requestMagicLink({
      email: 'crash@example.com',
      purpose: 'login',
    })
    expect(result).toEqual({ sent: true })
    // Email was never sent because the DB call failed before it.
    expect(mockSendMagicLink).not.toHaveBeenCalled()
  })

  it('never exposes email-send errors to the client', async () => {
    const db = new FakeDb()
    db.seedDancer({ email: 'maildown@example.com', name: 'Mail Down' })
    mockSendPasswordReset.mockRejectedValueOnce(new Error('SMTP connection refused'))
    const caller = createCaller(db)

    const result = await caller.auth.requestMagicLink({
      email: 'maildown@example.com',
      purpose: 'recovery',
    })
    expect(result).toEqual({ sent: true })
  })
})

// ---------- changePassword ----------

describe('auth.changePassword', () => {
  it('changes the password after verifying the current one (old fails, new works)', async () => {
    const db = new FakeDb()
    const reg = await createCaller(db).auth.register({ name: 'Pw User', email: 'pw@example.com', password: 'oldpassword' })
    const caller = createCaller(db, { dancerId: reg.dancerId })

    await caller.auth.changePassword({ currentPassword: 'oldpassword', newPassword: 'newpassword1' })

    await expect(createCaller(db).auth.login({ email: 'pw@example.com', password: 'oldpassword' })).rejects.toBeTruthy()
    const ok = await createCaller(db).auth.login({ email: 'pw@example.com', password: 'newpassword1' })
    expect(ok.dancerId).toBe(reg.dancerId)
  })

  it('rejects a wrong current password', async () => {
    const db = new FakeDb()
    const reg = await createCaller(db).auth.register({ name: 'Pw User', email: 'pw@example.com', password: 'oldpassword' })
    const caller = createCaller(db, { dancerId: reg.dancerId })
    await expect(caller.auth.changePassword({ currentPassword: 'nope', newPassword: 'newpassword1' }))
      .rejects.toMatchObject({ code: 'BAD_REQUEST' })
  })

  it('requires authentication', async () => {
    const db = new FakeDb()
    await expect(createCaller(db).auth.changePassword({ currentPassword: 'a', newPassword: 'newpassword1' }))
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })
})

// ---------- deleteAccount ----------

describe('auth.deleteAccount', () => {
  it('requires authentication', async () => {
    const db = new FakeDb()
    await expect(createCaller(db).auth.deleteAccount())
      .rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('deletes a dancer and their sessions in a transaction', async () => {
    const db = new FakeDb()
    const reg = await createCaller(db).auth.register({
      name: 'Delete User',
      email: 'delete@example.com',
      password: 'password123',
    })
    const dancerId = reg.dancerId
    const caller = createCaller(db, { dancerId })

    // Verify the dancer exists
    const dancersBefore = db.dancers.length
    const sessionsBefore = db.sessions.length
    expect(dancersBefore).toBeGreaterThan(0)
    expect(sessionsBefore).toBeGreaterThan(0)

    // Delete the account
    const result = await caller.auth.deleteAccount()
    expect(result.ok).toBe(true)
    expect(result.deleted).toBe(true)

    // Verify the dancer is deleted
    const dancersAfter = db.dancers.filter(d => d.id === dancerId)
    expect(dancersAfter).toHaveLength(0)

    // Verify the sessions are deleted
    const sessionsAfter = db.sessions.filter(s => s.dancerId === dancerId)
    expect(sessionsAfter).toHaveLength(0)
  })

  it('atomically deletes all related data (votes, signups, etc)', async () => {
    const db = new FakeDb()
    const reg = await createCaller(db).auth.register({
      name: 'Complex Delete User',
      email: 'complex@example.com',
      password: 'password123',
    })
    const dancerId = reg.dancerId

    // Seed some related data
    db.electionCandidates.push({
      id: 'candidate-1',
      dancerId,
      electionId: 'election-1',
      guidelines: 'test',
    })
    db.festivalSignups.push({
      id: 'signup-1',
      dancerId,
      festivalId: 'fest-1',
      tickettailorBuyerEmail: 'test@example.com',
    })
    db.videoVotes.push({
      id: 'vote-1',
      voterDancerId: dancerId,
      winnerVideoId: 'vid-1',
      loserVideoId: 'vid-2',
      citySlug: 'berlin',
      voterSessionId: 'sess-1',
    })
    db.reviews.push({
      id: 'review-1',
      dancerId,
      profileId: 'prof-1',
      rating: 5,
      comment: 'test',
    })

    const caller = createCaller(db, { dancerId })

    // Delete the account
    await caller.auth.deleteAccount()

    // Verify all related data is deleted or anonymized
    expect(db.dancers.find(d => d.id === dancerId)).toBeUndefined()
    expect(db.electionCandidates.find(c => c.dancerId === dancerId)).toBeUndefined()
    expect(db.videoVotes.find(v => v.voterDancerId === dancerId)).toBeUndefined()
    expect(db.reviews.find(r => r.dancerId === dancerId)).toBeUndefined()

    // Festival signups should be anonymized (dancerId nulled, email cleared)
    const signupsAfter = db.festivalSignups.find(s => s.id === 'signup-1')
    expect(signupsAfter?.dancerId).toBeNull()
    expect(signupsAfter?.tickettailorBuyerEmail).toBeNull()
  })

  it('deletes hangout RSVPs and owned hangouts, anonymizes gigs', async () => {
    const db = new FakeDb()
    const reg = await createCaller(db).auth.register({
      name: 'Hangout User',
      email: 'hangout@example.com',
      password: 'password123',
    })
    const dancerId = reg.dancerId

    // Seed hangout and RSVP data
    const hangoutId = 'hangout-1'
    db.hangouts.push({
      id: hangoutId,
      kind: 'dinner',
      title: 'Dinner Hangout',
      time: '19:00',
      venue: 'Restaurant',
      host: 'organizer',
      citySlug: 'munich',
      peopleCount: 5,
      status: 'active',
      dancerId, // This user created the hangout
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    // Other dancer RSVP'd to this user's hangout
    db.hangoutRsvps.push({
      id: 'rsvp-1',
      hangoutId,
      dancerId: 'other-dancer-1',
      createdAt: new Date(),
    })

    // This user RSVP'd to another hangout
    db.hangoutRsvps.push({
      id: 'rsvp-2',
      hangoutId: 'hangout-2',
      dancerId,
      createdAt: new Date(),
    })

    // Posted gigs
    db.gigs.push({
      id: 'gig-1',
      kind: 'role',
      category: 'Teacher',
      title: 'Salsa Class',
      posterName: 'Test User',
      contactEmail: 'hangout@example.com',
      contactUrl: 'https://example.com/me',
      dancerId, // Gig posted by this user
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const caller = createCaller(db, { dancerId })

    // Delete the account
    await caller.auth.deleteAccount()

    // Verify hangouts and RSVPs are deleted
    expect(db.hangouts.find(h => h.id === hangoutId)).toBeUndefined()
    expect(db.hangoutRsvps.find(r => r.dancerId === dancerId)).toBeUndefined()
    expect(db.hangoutRsvps.find(r => r.hangoutId === hangoutId)).toBeUndefined()

    // Verify gigs are anonymized (dancerId nulled, identifying fields scrubbed)
    const gigAfter = db.gigs.find(g => g.id === 'gig-1')
    expect(gigAfter).toBeDefined()
    expect(gigAfter?.dancerId).toBeNull()
    expect(gigAfter?.posterName).toBe('Deleted user')
    expect(gigAfter?.contactEmail).toBe('anonymized@wedance.local')
    expect(gigAfter?.contactUrl).toBeNull()
  })

  it('deletes planItems, rideShares, roommates, reports, and referrals', async () => {
    const db = new FakeDb()
    const reg = await createCaller(db).auth.register({
      name: 'Full User',
      email: 'full@example.com',
      password: 'password123',
    })
    const dancerId = reg.dancerId

    db.planItems.push({ id: 'pi-1', dancerId, itemType: 'festival', itemId: 'f-1' })
    db.festivalRideShares.push({ id: 'rs-1', dancerId, festivalId: 'f-1', type: 'offering', originCity: 'Munich', date: '2026-01-01' })
    db.festivalRoommateLookups.push({ id: 'rm-1', dancerId, festivalId: 'f-1' })
    db.communityGroupReports.push({ id: 'cr-1', dancerId, groupId: 'g-1' })
    db.referrals.push({ id: 'ref-1', referrerId: dancerId, refereeId: 'other-dancer', festivalId: 'f-1', status: 'pending' })
    db.referrals.push({ id: 'ref-2', referrerId: 'other-dancer', refereeId: dancerId, festivalId: 'f-1', status: 'completed' })

    const caller = createCaller(db, { dancerId })
    await caller.auth.deleteAccount()

    expect(db.planItems.find(p => p.dancerId === dancerId)).toBeUndefined()
    expect(db.festivalRideShares.find(r => r.dancerId === dancerId)).toBeUndefined()
    expect(db.festivalRoommateLookups.find(r => r.dancerId === dancerId)).toBeUndefined()
    expect(db.communityGroupReports.find(r => r.dancerId === dancerId)).toBeUndefined()
    expect(db.referrals.find(r => r.referrerId === dancerId || r.refereeId === dancerId)).toBeUndefined()
    expect(db.dancers.find(d => d.id === dancerId)).toBeUndefined()
  })

  it('validates that schema columns used in deleteAccount exist', () => {
    // This test ensures the deletion logic uses correct column names
    // It fails at import time if any referenced column doesn't exist

    // Verify electionVoteHistory has the correct columns
    expect(electionVoteHistory.toCandidateId).toBeDefined()
    expect(electionVoteHistory.fromCandidateId).toBeDefined()
    expect(electionVoteHistory.voterDancerId).toBeDefined()

    // Verify festivalSubmissions has the email column
    expect(festivalSubmissions.submittedByEmail).toBeDefined()
    expect(festivalSubmissions.submittedById).toBeDefined()

    // Verify other critical columns
    expect(cityVideos.submittedByEmail).toBeDefined()
    expect(festivalSignups.tickettailorBuyerEmail).toBeDefined()

    // Verify columns for tables added in the FK-crash fix
    expect(communityGroupReports.dancerId).toBeDefined()
    expect(planItems.dancerId).toBeDefined()
    expect(festivalRideShares.dancerId).toBeDefined()
    expect(festivalRoommateLookups.dancerId).toBeDefined()
    expect(referrals.referrerId).toBeDefined()
    expect(referrals.refereeId).toBeDefined()

    // Verify gig identifying fields exist
    expect(gigs.posterName).toBeDefined()
    expect(gigs.contactEmail).toBeDefined()
    expect(gigs.contactUrl).toBeDefined()

    // Verify profiles moderator fields exist
    expect(profiles.moderatorName).toBeDefined()
    expect(profiles.moderatorHandle).toBeDefined()
  })

  it('deletes festivalSubmissions by submittedById', async () => {
    const db = new FakeDb()
    const reg = await createCaller(db).auth.register({
      name: 'Festival User',
      email: 'festival@example.com',
      password: 'password123',
    })
    const dancerId = reg.dancerId

    // Seed festivalSubmissions where submittedById matches
    db.festivalSubmissions.push({
      id: 'submission-1',
      slug: 'test-festival',
      name: 'My Festival',
      submittedById: dancerId,
      submittedByEmail: null,
      payload: { test: 'data' },
      status: 'pending',
    })

    const caller = createCaller(db, { dancerId })
    await caller.auth.deleteAccount()

    // submission-1 should be deleted (because submittedById matches)
    expect(db.festivalSubmissions.find(s => s.id === 'submission-1')).toBeUndefined()
    // Note: email-only row anonymization uses sql`lower()` which needs integration tests
  })
})
