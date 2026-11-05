/**
 * Unit tests for the festival router (public DB-backed reads).
 *
 * Uses the same hermetic FakeDb pattern as claim.test.ts so the suite stays
 * runnable without a live Neon connection.
 */
import { describe, it, expect, vi } from 'vitest'
import { dancers, festivals, festivalSignups } from '../../database/schema'

// ---------- mocks ----------
//
// drizzle-orm's `eq` returns an opaque tagged object. Replace it with a
// predicate so the FakeDb below can run a plain JS check against a row.

type FilterFn = (row: Record<string, any>) => boolean

vi.mock('drizzle-orm', async () => {
  const snakeToCamel = (s: string) =>
    s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())

  const resolveKey = (col: any): string | undefined => {
    const dbName: string | undefined = col?.name
    return dbName ? snakeToCamel(dbName) : undefined
  }

  const eq = (col: any, val: any): FilterFn => {
    const jsKey = resolveKey(col)
    return (row) => (jsKey ? row[jsKey] === val : false)
  }

  return { eq, and: () => () => true, isNull: () => () => false, inArray: () => () => false, sql: (..._args: any[]) => ({}), gt: () => () => false }
})

import { appRouter } from '../index'

// ---------- in-memory fake DB ----------

interface FakeRow { [k: string]: any }

class FakeDb {
  festivals: FakeRow[] = []
  dancers: FakeRow[] = []
  signups: FakeRow[] = []

  seedFestival(row: Partial<FakeRow> & { slug: string; name: string }) {
    const id = row.id ?? 'fest-' + row.slug
    this.festivals.push({
      id,
      slug: row.slug,
      name: row.name,
      startDate: row.startDate ?? null,
      endDate: row.endDate ?? null,
      ticketUrl: row.ticketUrl ?? null,
      maxFreeSpots: row.maxFreeSpots ?? 0,
    })
    return id
  }

  select(_columns: any) {
    return {
      from: (table: any) => {
        const rowsForTable = () => this.tableFor(table)
        const buildResult = (filter: FilterFn) => {
          const rows = rowsForTable().filter(filter)
          const promise: any = Promise.resolve(rows)
          promise.limit = (n: number) => Promise.resolve(rows.slice(0, n))
          return promise
        }
        return {
          where: (filter: FilterFn) => buildResult(filter),
        }
      },
    }
  }

  private tableFor(table: any): FakeRow[] {
    if (table === festivals) return this.festivals
    if (table === dancers) return this.dancers
    if (table === festivalSignups) return this.signups
    throw new Error('unexpected table in FakeDb')
  }
}

function createCaller(db: any) {
  return appRouter.createCaller({
    db,
    dancerId: null,
    isAdmin: false,
  })
}

// ---------- festival.bySlug ----------

const CHARANGA_SLUG = 'charanga-habanera-munich-2026'
const CHARANGA_NAME = 'David Calzado & Charanga Habanera in Munich'

describe('festival.bySlug', () => {
  it('returns the festival when the slug matches', async () => {
    const db = new FakeDb()
    db.seedFestival({
      slug: CHARANGA_SLUG,
      name: CHARANGA_NAME,
      startDate: '2026-05-23',
      endDate: '2026-05-23',
      ticketUrl: 'https://www.tickettailor.com/events/salsaclub/2183096',
      maxFreeSpots: 0,
    })

    const caller = createCaller(db as any)
    const result = await caller.festival.bySlug({ slug: CHARANGA_SLUG })

    expect(result).not.toBeNull()
    expect(result?.slug).toBe(CHARANGA_SLUG)
    expect(result?.name).toBe(CHARANGA_NAME)
    expect(result?.startDate).toBe('2026-05-23')
    expect(result?.ticketUrl).toBe('https://www.tickettailor.com/events/salsaclub/2183096')
    expect(result?.maxFreeSpots).toBe(0)
  })

  it('returns null when the slug is not in the DB', async () => {
    const db = new FakeDb()
    db.seedFestival({ slug: CHARANGA_SLUG, name: CHARANGA_NAME })

    const caller = createCaller(db as any)
    const result = await caller.festival.bySlug({ slug: 'does-not-exist' })

    expect(result).toBeNull()
  })

  it('returns null on a different slug even when other festivals exist', async () => {
    const db = new FakeDb()
    db.seedFestival({ slug: 'meneate-viena-2026', name: 'Menéate Viena 2026' })
    db.seedFestival({ slug: 'cuban-fire-munich-2026', name: 'Cuban Fire Munich' })

    const caller = createCaller(db as any)
    const result = await caller.festival.bySlug({ slug: CHARANGA_SLUG })

    expect(result).toBeNull()
  })

  it('rejects an empty slug at the validation layer', async () => {
    const db = new FakeDb()
    const caller = createCaller(db as any)

    await expect(caller.festival.bySlug({ slug: '' })).rejects.toThrow()
  })

  it('rejects a missing slug at the validation layer', async () => {
    const db = new FakeDb()
    const caller = createCaller(db as any)

    // @ts-expect-error — intentionally calling without required input
    await expect(caller.festival.bySlug({})).rejects.toThrow()
  })
})
