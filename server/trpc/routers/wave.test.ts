/**
 * Unit tests for the wave router (RAZ-82: Arrive With Friends).
 *
 * Hermetic — no DATABASE_URL required. Uses an in-memory FakeDb that
 * mirrors enough of the Drizzle query builder to exercise the wave
 * procedures: send, retract, myWaves, wavesForMe, friends.
 *
 * We mock drizzle-orm by importing the real module and only overriding
 * eq/and/inArray to return predicate functions. This avoids breaking
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

  return { ...real, eq, and, inArray }
})

// ---------- FakeDb ----------

interface FakeRow { [k: string]: any }

// Two stores: waves and dancers (for profile joins)
let waveRows: FakeRow[] = []
let dancerRows: FakeRow[] = []

class FakeDb {
  select(columns: any) {
    return {
      from: (table: any) => {
        const tableName = table?.[Symbol.for('drizzle:Name')]
          || table?.constructor?.name || 'unknown'
        const store = tableName === 'festival_waves' ? waveRows : dancerRows

        return {
          where: (filter: (r: FakeRow) => boolean) => {
            const matched = store.filter(filter)
            return Promise.resolve(
              matched.map(r => this._project(columns, r)),
            )
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
    dancerRows = [
      { id: 'a0000000-0000-4000-a000-000000000001', name: 'Alice', photo: null, city: 'Munich', username: 'alice', danceStyles: ['Salsa'], role: 'follow', instagram: 'alice_dance', profilePublic: true },
      { id: 'b0000000-0000-4000-b000-000000000002', name: 'Bob', photo: null, city: 'Berlin', username: 'bob', danceStyles: ['Bachata'], role: 'lead', instagram: null, profilePublic: true },
      { id: 'c0000000-0000-4000-b000-000000000003', name: 'Carol', photo: null, city: 'Munich', username: 'carol', danceStyles: ['Kizomba'], role: 'follow', instagram: null, profilePublic: false },
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
