/**
 * Unit tests for the wave router (RAZ-82: Arrive With Friends).
 *
 * Hermetic — no DATABASE_URL required. Uses an in-memory FakeDb that
 * mirrors enough of the Drizzle query builder to exercise the wave
 * procedures: send, retract, myWaves, wavesForMe, friends, discoverPool,
 * incomingCount.
 *
 * We mock drizzle-orm by importing the real module and only overriding
 * eq/and/inArray/ne to return predicate functions. This avoids breaking
 * pgTable internals that depend on the real drizzle-orm exports.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------- drizzle mocks ----------
// Import real module first, then override only the query-builder helpers
// so that pgTable (from drizzle-orm/pg-core) still works correctly.
vi.mock('drizzle-orm', async (importOriginal) => {
  const real = await importOriginal<typeof import('drizzle-orm')>()

  const snakeToCamel = (s: string) =>
    s.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase())

  const eq = (col: any, val: any) => {
    const dbName: string | undefined = col?.name
    const jsKey = dbName ? snakeToCamel(dbName) : undefined
    return (row: Record<string, any>) => {
      if (jsKey && Object.prototype.hasOwnProperty.call(row, jsKey)) {
        return row[jsKey] === val
      }
      if (dbName && Object.prototype.hasOwnProperty.call(row, dbName)) {
        return row[dbName] === val
      }
      return false
    }
  }

  const and = (...preds: any[]) => (row: Record<string, any>) =>
    preds.every(p => p(row))

  const inArray = (col: any, vals: any[]) => {
    const dbName: string | undefined = col?.name
    const jsKey = dbName ? snakeToCamel(dbName) : undefined
    return (row: Record<string, any>) => {
      const v = jsKey && Object.prototype.hasOwnProperty.call(row, jsKey)
        ? row[jsKey]
        : (dbName && Object.prototype.hasOwnProperty.call(row, dbName) ? row[dbName] : undefined)
      return vals.includes(v)
    }
  }

  const ne = (col: any, val: any) => {
    const dbName: string | undefined = col?.name
    const jsKey = dbName ? snakeToCamel(dbName) : undefined
    return (row: Record<string, any>) => {
      if (jsKey && Object.prototype.hasOwnProperty.call(row, jsKey)) {
        return row[jsKey] !== val
      }
      if (dbName && Object.prototype.hasOwnProperty.call(row, dbName)) {
        return row[dbName] !== val
      }
      return true
    }
  }

  const isNotNull = (col: any) => {
    const jsKey = col?.name ? snakeToCamel(col.name) : undefined
    return (row: Record<string, any>) => !!jsKey && row[jsKey] != null
  }

  return { ...real, eq, and, inArray, isNotNull, ne }
})

// ---------- FakeDb ----------

interface FakeRow { [k: string]: any }

// Three stores: waves, dancers (for profile joins), plan items (for going list)
let waveRows: FakeRow[] = []
let dancerRows: FakeRow[] = []
let planItemRows: FakeRow[] = []

class FakeDb {
  select(columns: any) {
    return {
      from: (table: any) => {
        const tableName = table?.[Symbol.for('drizzle:Name')]
          || table?.constructor?.name || 'unknown'
        const store = tableName === 'festival_waves' ? waveRows
          : tableName === 'plan_items' ? planItemRows
          : dancerRows

        return {
          where: (filter: (r: FakeRow) => boolean) => {
            const matched = store.filter(filter)
            const result = matched.map(r => this._project(columns, r))
            const p = Promise.resolve(result) as any
            p.limit = (_n: number) => Promise.resolve(result)
            return p
          },
          innerJoin: (_joinTable: any, _cond: any) => ({
            where: (filter: (r: FakeRow) => boolean) => {
              const waves = waveRows.filter(filter)
              const result = waves.map(w => {
                const dancer = dancerRows.find(d => d.id === w.dancerId)
                if (!dancer) return null
                const merged = { ...w, ...dancer }
                if (!filter(merged)) return null
                return this._project(columns, merged)
              }).filter(Boolean)
              return {
                limit: (_n: number) => Promise.resolve(result),
              }
            },
          }),
          limit: (_n: number) => Promise.resolve(
            store.map(r => this._project(columns, r)),
          ),
        }
      },
    }
  }

  /** Project a row through the column map, resolving drizzle column names */
  private _project(columns: any, row: FakeRow): any {
    const out: any = {}
    for (const key of Object.keys(columns)) {
      const col = columns[key]
      const dbName: string | undefined = col?.name
      const jsKey = dbName
        ? dbName.replace(/_([a-z])/g, (_: string, c: string) => c.toUpperCase())
        : key
      out[key] = row[jsKey]
    }
    return out
  }

  insert(_table: any) {
    return {
      values: (row: FakeRow) => ({
        onConflictDoNothing: () => {
          const exists = waveRows.some(
            r =>
              r.festivalSlug === row.festivalSlug &&
              r.dancerId === row.dancerId &&
              r.targetDancerId === row.targetDancerId,
          )
          if (!exists) {
            waveRows.push({
              id: `wave-${waveRows.length}`,
              createdAt: new Date(),
              ...row,
            })
          }
          return Promise.resolve()
        },
      }),
    }
  }

  delete(_table: any) {
    return {
      where: (filter: (r: FakeRow) => boolean) => {
        waveRows = waveRows.filter(r => !filter(r))
        return Promise.resolve()
      },
    }
  }
}

// ---------- router under test ----------

;(globalThis as any).useRuntimeConfig = () => ({ databaseUrl: '' })

import { waveRouter } from './wave'
import { router } from '../trpc'

const appRouter = router({ wave: waveRouter })

function makeCaller(db: FakeDb, dancerId: string | null = 'a0000000-0000-4000-a000-000000000001') {
  return appRouter.createCaller({ db: db as any, dancerId, isAdmin: false })
}

describe('wave router (RAZ-82)', () => {
  let db: FakeDb

  beforeEach(() => {
    db = new FakeDb()
    waveRows = []
    planItemRows = []
    dancerRows = [
      { id: 'a0000000-0000-4000-a000-000000000001', name: 'Alice', photo: 'https://img.test/alice.jpg', city: 'Munich', username: 'alice', danceStyles: ['Salsa'], danceLevels: { Salsa: 'Intermediate' }, role: 'follow', instagram: 'alice_dance', bio: 'I love salsa', profilePublic: true },
      { id: 'b0000000-0000-4000-b000-000000000002', name: 'Bob', photo: 'https://img.test/bob.jpg', city: 'Berlin', username: 'bob', danceStyles: ['Bachata'], danceLevels: { Bachata: 'Advanced' }, role: 'lead', instagram: null, bio: null, profilePublic: true },
      { id: 'c0000000-0000-4000-b000-000000000003', name: 'Carol', photo: 'https://img.test/carol.jpg', city: 'Munich', username: 'carol', danceStyles: ['Kizomba'], danceLevels: {}, role: 'follow', instagram: null, bio: null, profilePublic: false },
    ]
  })

  describe('send', () => {
    it('creates a wave', async () => {
      const caller = makeCaller(db, 'a0000000-0000-4000-a000-000000000001')
      await caller.wave.send({ festivalSlug: 'fest-1', targetDancerId: 'b0000000-0000-4000-b000-000000000002' })
      expect(waveRows).toHaveLength(1)
      expect(waveRows[0].dancerId).toBe('a0000000-0000-4000-a000-000000000001')
      expect(waveRows[0].targetDancerId).toBe('b0000000-0000-4000-b000-000000000002')
    })

    it('is idempotent', async () => {
      const caller = makeCaller(db, 'a0000000-0000-4000-a000-000000000001')
      await caller.wave.send({ festivalSlug: 'fest-1', targetDancerId: 'b0000000-0000-4000-b000-000000000002' })
      await caller.wave.send({ festivalSlug: 'fest-1', targetDancerId: 'b0000000-0000-4000-b000-000000000002' })
      expect(waveRows).toHaveLength(1)
    })

    it('ignores self-wave', async () => {
      const caller = makeCaller(db, 'a0000000-0000-4000-a000-000000000001')
      await caller.wave.send({ festivalSlug: 'fest-1', targetDancerId: 'a0000000-0000-4000-a000-000000000001' })
      expect(waveRows).toHaveLength(0)
    })

    it('rejects unauthenticated calls', async () => {
      const caller = makeCaller(db, null)
      await expect(
        caller.wave.send({ festivalSlug: 'fest-1', targetDancerId: 'b0000000-0000-4000-b000-000000000002' }),
      ).rejects.toThrow('Not signed in')
    })
  })

  describe('retract', () => {
    it('removes a wave', async () => {
      const caller = makeCaller(db, 'a0000000-0000-4000-a000-000000000001')
      await caller.wave.send({ festivalSlug: 'fest-1', targetDancerId: 'b0000000-0000-4000-b000-000000000002' })
      expect(waveRows).toHaveLength(1)

      await caller.wave.retract({ festivalSlug: 'fest-1', targetDancerId: 'b0000000-0000-4000-b000-000000000002' })
      expect(waveRows).toHaveLength(0)
    })

    it('is safe to retract a non-existent wave', async () => {
      const caller = makeCaller(db, 'a0000000-0000-4000-a000-000000000001')
      await caller.wave.retract({ festivalSlug: 'fest-1', targetDancerId: 'b0000000-0000-4000-b000-000000000002' })
      expect(waveRows).toHaveLength(0)
    })
  })

  describe('myWaves', () => {
    it('returns IDs of dancers the caller waved at', async () => {
      const caller = makeCaller(db, 'a0000000-0000-4000-a000-000000000001')
      await caller.wave.send({ festivalSlug: 'fest-1', targetDancerId: 'b0000000-0000-4000-b000-000000000002' })
      await caller.wave.send({ festivalSlug: 'fest-1', targetDancerId: 'c0000000-0000-4000-b000-000000000003' })

      const ids = await caller.wave.myWaves({ festivalSlug: 'fest-1' })
      expect(ids).toHaveLength(2)
      expect(ids).toContain('b0000000-0000-4000-b000-000000000002')
      expect(ids).toContain('c0000000-0000-4000-b000-000000000003')
    })

    it('scopes to the given festival', async () => {
      const caller = makeCaller(db, 'a0000000-0000-4000-a000-000000000001')
      await caller.wave.send({ festivalSlug: 'fest-1', targetDancerId: 'b0000000-0000-4000-b000-000000000002' })
      await caller.wave.send({ festivalSlug: 'fest-2', targetDancerId: 'c0000000-0000-4000-b000-000000000003' })

      const ids = await caller.wave.myWaves({ festivalSlug: 'fest-1' })
      expect(ids).toHaveLength(1)
      expect(ids[0]).toBe('b0000000-0000-4000-b000-000000000002')
    })

    it('returns empty for no waves', async () => {
      const caller = makeCaller(db, 'a0000000-0000-4000-a000-000000000001')
      const ids = await caller.wave.myWaves({ festivalSlug: 'fest-1' })
      expect(ids).toHaveLength(0)
    })
  })

  describe('friends (mutual waves)', () => {
    it('returns empty when no outgoing waves', async () => {
      const caller = makeCaller(db, 'a0000000-0000-4000-a000-000000000001')
      const f = await caller.wave.friends({ festivalSlug: 'fest-1' })
      expect(f).toHaveLength(0)
    })

    it('returns empty when waves are one-directional', async () => {
      const caller1 = makeCaller(db, 'a0000000-0000-4000-a000-000000000001')
      await caller1.wave.send({ festivalSlug: 'fest-1', targetDancerId: 'b0000000-0000-4000-b000-000000000002' })

      const f = await caller1.wave.friends({ festivalSlug: 'fest-1' })
      expect(f).toHaveLength(0)
    })

    it('returns mutual waves as friends', async () => {
      const caller1 = makeCaller(db, 'a0000000-0000-4000-a000-000000000001')
      const caller2 = makeCaller(db, 'b0000000-0000-4000-b000-000000000002')

      await caller1.wave.send({ festivalSlug: 'fest-1', targetDancerId: 'b0000000-0000-4000-b000-000000000002' })
      await caller2.wave.send({ festivalSlug: 'fest-1', targetDancerId: 'a0000000-0000-4000-a000-000000000001' })

      const f = await caller1.wave.friends({ festivalSlug: 'fest-1' })
      expect(f).toHaveLength(1)
      expect(f[0].dancerId).toBe('b0000000-0000-4000-b000-000000000002')
      expect(f[0].name).toBe('Bob')
    })
  })

  describe('discoverPool (RAZ-65)', () => {
    const ALICE = 'a0000000-0000-4000-a000-000000000001'
    const BOB = 'b0000000-0000-4000-b000-000000000002'
    const CAROL = 'c0000000-0000-4000-b000-000000000003'

    function addPlanItem(dancerId: string, slug = 'fest-1', shareGoing = true, itemType = 'festival') {
      planItemRows.push({
        id: `plan-${planItemRows.length}`,
        dancerId,
        itemType,
        itemId: slug,
        shareGoing,
      })
    }

    it('returns attendees who opted into share going', async () => {
      addPlanItem(BOB) // Bob is going and sharing
      addPlanItem(ALICE) // Alice (self) is going too — should be excluded

      const caller = makeCaller(db, ALICE)
      const pool = await caller.wave.discoverPool({ festivalSlug: 'fest-1' })
      expect(pool).toHaveLength(1)
      expect(pool[0].id).toBe(BOB)
      expect(pool[0].name).toBe('Bob')
    })

    it('reads a plain event\'s going list when itemType is event', async () => {
      addPlanItem(BOB, 'event-1', true, 'event')

      const caller = makeCaller(db, ALICE)
      expect(await caller.wave.discoverPool({ festivalSlug: 'event-1' })).toHaveLength(0)
      const pool = await caller.wave.discoverPool({ festivalSlug: 'event-1', itemType: 'event' })
      expect(pool.map(d => d.id)).toEqual([BOB])
    })

    it('leaves out dancers without a photo', async () => {
      dancerRows.push({ id: 'e0000000-0000-4000-b000-000000000005', name: 'Eve', photo: null, city: 'Munich', username: 'eve', danceStyles: [], danceLevels: {}, role: 'follow', bio: null, profilePublic: true })
      dancerRows.push({ id: 'f0000000-0000-4000-b000-000000000006', name: 'Fay', photo: '', city: 'Munich', username: 'fay', danceStyles: [], danceLevels: {}, role: 'follow', bio: null, profilePublic: true })
      addPlanItem('e0000000-0000-4000-b000-000000000005') // going, but no photo

      const caller = makeCaller(db, ALICE)
      const pool = await caller.wave.discoverPool({ festivalSlug: 'fest-1' })
      expect(pool.map(d => d.name)).toEqual([])
    })

    it('excludes dancers the caller already swiped on', async () => {
      addPlanItem(BOB)

      // Alice already waved at Bob
      const caller = makeCaller(db, ALICE)
      await caller.wave.send({ festivalSlug: 'fest-1', targetDancerId: BOB })

      const pool = await caller.wave.discoverPool({ festivalSlug: 'fest-1' })
      expect(pool).toHaveLength(0)
    })

    it('excludes dancers with shareGoing=false', async () => {
      addPlanItem(BOB, 'fest-1', false) // Bob is going but NOT sharing

      const caller = makeCaller(db, ALICE)
      const pool = await caller.wave.discoverPool({ festivalSlug: 'fest-1' })
      expect(pool).toHaveLength(0)
    })

    it('excludes private profiles', async () => {
      addPlanItem(CAROL) // Carol has profilePublic=false

      const caller = makeCaller(db, ALICE)
      const pool = await caller.wave.discoverPool({ festivalSlug: 'fest-1' })
      expect(pool).toHaveLength(0)
    })

    it('prioritises dancers who waved at the caller (likedMe=true first)', async () => {
      // Add a fourth public dancer so we have two candidates
      dancerRows.push({
        id: 'd0000000-0000-4000-d000-000000000004',
        name: 'Dave',
        photo: 'https://img.test/dave.jpg',
        city: 'Hamburg',
        username: 'dave',
        danceStyles: ['Salsa'],
        danceLevels: {},
        role: 'lead',
        instagram: null,
        bio: null,
        profilePublic: true,
      })

      addPlanItem(BOB)
      addPlanItem('d0000000-0000-4000-d000-000000000004')

      // Bob waved at Alice (incoming) — Dave didn't
      waveRows.push({
        id: 'wave-incoming',
        festivalSlug: 'fest-1',
        dancerId: BOB,
        targetDancerId: ALICE,
        createdAt: new Date(),
      })

      const caller = makeCaller(db, ALICE)
      const pool = await caller.wave.discoverPool({ festivalSlug: 'fest-1' })
      expect(pool).toHaveLength(2)
      expect(pool[0].id).toBe(BOB) // Bob first (waved at Alice)
      expect(pool[0].likedMe).toBe(true)
      expect(pool[1].id).toBe('d0000000-0000-4000-d000-000000000004')
      expect(pool[1].likedMe).toBe(false)
    })

    it('returns enriched profile fields (styles with levels)', async () => {
      addPlanItem(BOB)
      const caller = makeCaller(db, ALICE)
      const pool = await caller.wave.discoverPool({ festivalSlug: 'fest-1' })
      expect(pool[0].styles).toEqual([{ name: 'Bachata', level: 'Advanced' }])
      expect(pool[0].role).toBe('lead')
    })

    it('returns empty when no attendees', async () => {
      const caller = makeCaller(db, ALICE)
      const pool = await caller.wave.discoverPool({ festivalSlug: 'fest-1' })
      expect(pool).toHaveLength(0)
    })

    it('rejects unauthenticated', async () => {
      const caller = makeCaller(db, null)
      await expect(caller.wave.discoverPool({ festivalSlug: 'fest-1' })).rejects.toThrow('Not signed in')
    })
  })

  describe('incomingCount (RAZ-65)', () => {
    const ALICE = 'a0000000-0000-4000-a000-000000000001'
    const BOB = 'b0000000-0000-4000-b000-000000000002'

    it('counts incoming waves not yet reciprocated', async () => {
      // Bob waved at Alice
      waveRows.push({
        id: 'wave-1',
        festivalSlug: 'fest-1',
        dancerId: BOB,
        targetDancerId: ALICE,
        createdAt: new Date(),
      })

      const caller = makeCaller(db, ALICE)
      const count = await caller.wave.incomingCount({ festivalSlug: 'fest-1' })
      expect(count).toBe(1)
    })

    it('does not count waves already reciprocated', async () => {
      // Bob waved at Alice
      waveRows.push({
        id: 'wave-1',
        festivalSlug: 'fest-1',
        dancerId: BOB,
        targetDancerId: ALICE,
        createdAt: new Date(),
      })

      // Alice waved back at Bob
      const caller = makeCaller(db, ALICE)
      await caller.wave.send({ festivalSlug: 'fest-1', targetDancerId: BOB })

      const count = await caller.wave.incomingCount({ festivalSlug: 'fest-1' })
      expect(count).toBe(0)
    })

    it('returns 0 when no incoming waves', async () => {
      const caller = makeCaller(db, ALICE)
      const count = await caller.wave.incomingCount({ festivalSlug: 'fest-1' })
      expect(count).toBe(0)
    })

    it('rejects unauthenticated', async () => {
      const caller = makeCaller(db, null)
      await expect(caller.wave.incomingCount({ festivalSlug: 'fest-1' })).rejects.toThrow('Not signed in')
    })
  })

  describe('auth guard', () => {
    it('myWaves rejects unauthenticated', async () => {
      const caller = makeCaller(db, null)
      await expect(caller.wave.myWaves({ festivalSlug: 'fest-1' })).rejects.toThrow('Not signed in')
    })

    it('friends rejects unauthenticated', async () => {
      const caller = makeCaller(db, null)
      await expect(caller.wave.friends({ festivalSlug: 'fest-1' })).rejects.toThrow('Not signed in')
    })

    it('wavesForMe rejects unauthenticated', async () => {
      const caller = makeCaller(db, null)
      await expect(caller.wave.wavesForMe({ festivalSlug: 'fest-1' })).rejects.toThrow('Not signed in')
    })
  })
})
