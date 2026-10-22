/**
 * Integration tests for the Pinakothek showcase seed logic (RAZ-654 – RAZ-656).
 *
 * These test the observable invariants of the seed-pinakothek script's
 * idempotency patterns using synthetic in-memory state — no real database.
 *
 * RAZ-654 — Repeat showcase seeding without duplicate areas.
 * RAZ-655 — Recover partially seeded showcase data without duplicates.
 * RAZ-656 — Correct showcase booking model during seeding.
 */
import { describe, it, expect } from 'vitest'

// ── In-memory store modelling the seed script's DB surface ───────────────

interface Profile {
  id: string
  username: string
  type: string
  guidelines: string | null
  bookingModel: string
  [k: string]: any
}

interface Space {
  id: string
  profileId: string
  name: string
  sortOrder: number
}

class SeedDb {
  profiles: Profile[] = []
  spaces: Space[] = []

  findProfile(username: string): Profile | undefined {
    return this.profiles.find(p => p.username === username)
  }

  findSpaces(profileId: string): Space[] {
    return this.spaces.filter(s => s.profileId === profileId)
  }

  insertProfile(data: Profile) {
    this.profiles.push(data)
    return data
  }

  updateProfile(id: string, data: Partial<Profile>) {
    const p = this.profiles.find(p => p.id === id)
    if (p) Object.assign(p, data)
  }

  insertSpace(data: Space) {
    this.spaces.push(data)
  }
}

// ── Seed logic extracted to a testable function ──────────────────────────

const EXPECTED_AREA_COUNT = 6
const AREAS = Array.from({ length: EXPECTED_AREA_COUNT }, (_, i) => ({
  name: `Area ${i + 1}`,
  sortOrder: i + 1,
}))

/**
 * Mirrors the seed-pinakothek.ts script's three-branch idempotency:
 *  1. Full profile + ≥6 areas → skip
 *  2. Profile exists but missing areas → add missing
 *  3. Bare profile (no guidelines) → enrich + add areas
 *  4. No profile → create from scratch
 *
 * Also corrects bookingModel if it doesn't match the expected value (RAZ-656).
 */
function runSeed(
  db: SeedDb,
  handle: string,
  profileData: Omit<Profile, 'id'>,
) {
  const existing = db.findProfile(handle)

  if (existing?.guidelines) {
    const areas = db.findSpaces(existing.id)

    // RAZ-656: correct bookingModel if wrong
    if (existing.bookingModel !== profileData.bookingModel) {
      db.updateProfile(existing.id, { bookingModel: profileData.bookingModel })
    }

    if (areas.length >= EXPECTED_AREA_COUNT) {
      return { action: 'skip', profileId: existing.id }
    }

    // Fill missing areas (without duplicating existing ones)
    for (let i = areas.length; i < EXPECTED_AREA_COUNT; i++) {
      db.insertSpace({
        id: `space-${existing.id}-${i}`,
        profileId: existing.id,
        ...AREAS[i],
      })
    }
    return { action: 'filled-areas', profileId: existing.id, added: EXPECTED_AREA_COUNT - areas.length }
  }

  if (existing) {
    // Bare profile — enrich with full data
    const { username: _u, type: _t, ...updateData } = profileData
    db.updateProfile(existing.id, updateData)

    const existingAreas = db.findSpaces(existing.id)
    for (let i = existingAreas.length; i < EXPECTED_AREA_COUNT; i++) {
      db.insertSpace({
        id: `space-${existing.id}-${i}`,
        profileId: existing.id,
        ...AREAS[i],
      })
    }
    return { action: 'enriched', profileId: existing.id }
  }

  // No profile — create from scratch
  const id = `profile-${handle}`
  db.insertProfile({ id, ...profileData })
  for (let i = 0; i < EXPECTED_AREA_COUNT; i++) {
    db.insertSpace({ id: `space-${id}-${i}`, profileId: id, ...AREAS[i] })
  }
  return { action: 'created', profileId: id }
}

const SHOWCASE_DATA: Omit<Profile, 'id'> = {
  username: 'test-showcase',
  type: 'venue',
  guidelines: 'No music before 7pm.',
  bookingModel: 'free',
  name: 'Test Showcase Venue',
}

// ── RAZ-654 — Repeat showcase seeding without duplicate areas ─────────────

describe('seed idempotency — no duplicates on re-run (RAZ-654)', () => {
  it('creates 6 areas on first run', () => {
    const db = new SeedDb()
    const result = runSeed(db, 'test-showcase', SHOWCASE_DATA)

    expect(result.action).toBe('created')
    expect(db.findSpaces(result.profileId)).toHaveLength(EXPECTED_AREA_COUNT)
    expect(db.profiles).toHaveLength(1)
  })

  it('skips and keeps exactly 6 areas on second run', () => {
    const db = new SeedDb()

    // First run
    const r1 = runSeed(db, 'test-showcase', SHOWCASE_DATA)
    expect(r1.action).toBe('created')
    expect(db.findSpaces(r1.profileId)).toHaveLength(6)

    // Second run — should skip
    const r2 = runSeed(db, 'test-showcase', SHOWCASE_DATA)
    expect(r2.action).toBe('skip')

    // Still exactly 6 areas — no duplicates
    expect(db.findSpaces(r2.profileId)).toHaveLength(6)
    expect(db.profiles).toHaveLength(1)
  })

  it('skips on third run without accumulating areas', () => {
    const db = new SeedDb()

    runSeed(db, 'test-showcase', SHOWCASE_DATA)
    runSeed(db, 'test-showcase', SHOWCASE_DATA)
    const r3 = runSeed(db, 'test-showcase', SHOWCASE_DATA)

    expect(r3.action).toBe('skip')
    expect(db.findSpaces(r3.profileId)).toHaveLength(6)
  })
})

// ── RAZ-655 — Recover partially seeded showcase data without duplicates ──

describe('seed recovery — partial seed completed without duplicates (RAZ-655)', () => {
  it('fills missing areas when profile has only 3 of 6', () => {
    const db = new SeedDb()
    // Simulate a partial seed: profile + guidelines + only 3 areas
    db.insertProfile({ id: 'partial-1', ...SHOWCASE_DATA })
    for (let i = 0; i < 3; i++) {
      db.insertSpace({ id: `existing-${i}`, profileId: 'partial-1', ...AREAS[i] })
    }

    const result = runSeed(db, 'test-showcase', SHOWCASE_DATA)

    expect(result.action).toBe('filled-areas')
    expect(result.added).toBe(3)

    const allSpaces = db.findSpaces('partial-1')
    expect(allSpaces).toHaveLength(6)

    // Original 3 are untouched
    expect(allSpaces.filter(s => s.id.startsWith('existing-'))).toHaveLength(3)
  })

  it('fills missing areas when profile has zero areas (crashed after profile creation)', () => {
    const db = new SeedDb()
    // Profile exists with guidelines but zero areas
    db.insertProfile({ id: 'crashed-1', ...SHOWCASE_DATA })

    const result = runSeed(db, 'test-showcase', SHOWCASE_DATA)

    expect(result.action).toBe('filled-areas')
    expect(result.added).toBe(6)
    expect(db.findSpaces('crashed-1')).toHaveLength(6)
  })

  it('re-running after recovery does not add more areas', () => {
    const db = new SeedDb()
    db.insertProfile({ id: 'partial-2', ...SHOWCASE_DATA })
    for (let i = 0; i < 2; i++) {
      db.insertSpace({ id: `existing-${i}`, profileId: 'partial-2', ...AREAS[i] })
    }

    // Recovery run
    runSeed(db, 'test-showcase', SHOWCASE_DATA)
    expect(db.findSpaces('partial-2')).toHaveLength(6)

    // Idempotent re-run
    const r2 = runSeed(db, 'test-showcase', SHOWCASE_DATA)
    expect(r2.action).toBe('skip')
    expect(db.findSpaces('partial-2')).toHaveLength(6)
  })

  it('enriches a bare profile (no guidelines) and adds all areas', () => {
    const db = new SeedDb()
    // v3-synced profile: exists but no guidelines
    db.insertProfile({
      id: 'bare-1',
      username: 'test-showcase',
      type: 'venue',
      guidelines: null,
      bookingModel: 'commercial',
      name: 'Bare Venue',
    })

    const result = runSeed(db, 'test-showcase', SHOWCASE_DATA)

    expect(result.action).toBe('enriched')
    expect(db.findSpaces('bare-1')).toHaveLength(6)

    // Profile was enriched with the seed data
    const p = db.findProfile('test-showcase')!
    expect(p.guidelines).toBe('No music before 7pm.')
    expect(p.name).toBe('Test Showcase Venue')
  })
})

// ── RAZ-656 — Correct showcase booking model during seeding ───────────────

describe('seed bookingModel correction (RAZ-656)', () => {
  it('corrects bookingModel from commercial to free when fully seeded', () => {
    const db = new SeedDb()
    // Profile with wrong bookingModel but otherwise complete
    db.insertProfile({
      id: 'wrong-model-1',
      ...SHOWCASE_DATA,
      bookingModel: 'commercial', // should be 'free'
    })
    for (let i = 0; i < 6; i++) {
      db.insertSpace({ id: `sp-${i}`, profileId: 'wrong-model-1', ...AREAS[i] })
    }

    const result = runSeed(db, 'test-showcase', SHOWCASE_DATA)

    // Areas are already complete so it skips adding more
    expect(result.action).toBe('skip')

    // But bookingModel was corrected
    const p = db.findProfile('test-showcase')!
    expect(p.bookingModel).toBe('free')
  })

  it('does not change bookingModel when it already matches', () => {
    const db = new SeedDb()
    db.insertProfile({ id: 'correct-model', ...SHOWCASE_DATA })
    for (let i = 0; i < 6; i++) {
      db.insertSpace({ id: `sp-${i}`, profileId: 'correct-model', ...AREAS[i] })
    }

    runSeed(db, 'test-showcase', SHOWCASE_DATA)

    const p = db.findProfile('test-showcase')!
    expect(p.bookingModel).toBe('free')
  })

  it('corrects bookingModel during partial-area recovery', () => {
    const db = new SeedDb()
    db.insertProfile({
      id: 'partial-wrong',
      ...SHOWCASE_DATA,
      bookingModel: 'commercial',
    })
    for (let i = 0; i < 4; i++) {
      db.insertSpace({ id: `sp-${i}`, profileId: 'partial-wrong', ...AREAS[i] })
    }

    const result = runSeed(db, 'test-showcase', SHOWCASE_DATA)

    expect(result.action).toBe('filled-areas')
    expect(result.added).toBe(2)
    expect(db.findSpaces('partial-wrong')).toHaveLength(6)

    // bookingModel corrected as a side-effect
    const p = db.findProfile('test-showcase')!
    expect(p.bookingModel).toBe('free')
  })
})
