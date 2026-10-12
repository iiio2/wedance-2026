import { eq, sql } from 'drizzle-orm'
import { cities } from '../../database/schema'
import type { CityRow, CityStore, NewCityRow } from './service'

/**
 * Drizzle-backed CityStore. Checks that the `cities` table exists (one cheap
 * read, cached for a minute) before every read or write, so the app keeps
 * working — and never attempts a write — on a database where migration 0024
 * hasn't been applied yet.
 */
// Any drizzle Postgres database (neon-http in the app, the same in scripts).
type Db = { select: any, insert: any, update: any, execute: any }

export function createDrizzleCityStore(db: Db, now = () => Date.now()): CityStore {
  let exists: { v: boolean, exp: number } | null = null

  async function available() {
    if (exists && exists.exp > now()) return exists.v
    try {
      const res: any = await db.execute(sql`select to_regclass('public.cities') is not null as ok`)
      const row = Array.isArray(res) ? res[0] : res?.rows?.[0]
      const v = row?.ok === true || row?.ok === 't'
      exists = { v, exp: now() + (v ? 10 * 60_000 : 60_000) }
      return v
    }
    catch (err) {
      console.error('[cities] table check failed', (err as Error).message)
      return false
    }
  }

  const cols = {
    id: cities.id, googlePlaceId: cities.googlePlaceId, slug: cities.slug, name: cities.name,
    localName: cities.localName, country: cities.country, countryCode: cities.countryCode,
    region: cities.region, lat: cities.lat, lng: cities.lng, altNames: cities.altNames,
  }

  return {
    available,
    async list() {
      if (!(await available())) return []
      return await db.select(cols).from(cities) as CityRow[]
    },
    async slugTaken(slug) {
      if (!(await available())) return false
      const r = await db.select({ id: cities.id }).from(cities).where(eq(cities.slug, slug)).limit(1)
      return r.length > 0
    },
    async insert(row: NewCityRow) {
      if (!(await available())) throw new Error('cities table missing')
      const inserted = await db.insert(cities).values(row).onConflictDoNothing({ target: cities.googlePlaceId }).returning(cols) as CityRow[]
      if (inserted[0]) return { row: inserted[0], created: true }
      const [existing] = await db.select(cols).from(cities).where(eq(cities.googlePlaceId, row.googlePlaceId)).limit(1) as CityRow[]
      return { row: existing!, created: false }
    },
    async updateAltNames(id, altNames) {
      if (!(await available())) return
      await db.update(cities).set({ altNames, updatedAt: new Date() }).where(eq(cities.id, id))
    },
  }
}
