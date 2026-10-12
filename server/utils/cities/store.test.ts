import { afterAll, describe, expect, it } from 'vitest'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { inArray } from 'drizzle-orm'
import * as schema from '../../database/schema'
import { createDrizzleCityStore } from './store'
import { createCityService } from './service'
import type { PlacesClient } from './google'

// Integration: the real Drizzle store against a LOCAL Postgres (test-setup.ts drops any
// remote DATABASE_URL). Skips without a database; CI's integration job pushes the schema.
const DATABASE_URL = process.env.DATABASE_URL
const db = DATABASE_URL ? drizzle(neon(DATABASE_URL), { schema }) : null

const IDS = ['ChIJtest_store_munich_0001', 'ChIJtest_store_munich_0002']

const places: PlacesClient = {
  calls: 0,
  async autocomplete() { return [] },
  async details(placeId, { language = 'en' }) {
    const de = language === 'de'
    return {
      placeId,
      name: de ? 'Teststadt' : 'Testopolis',
      addressComponents: [
        { long_name: de ? 'Teststadt' : 'Testopolis', short_name: 'M', types: ['locality'] },
        { long_name: 'Bavaria', short_name: 'BY', types: ['administrative_area_level_1'] },
        { long_name: 'Germany', short_name: 'DE', types: ['country'] },
      ],
      lat: 48.1,
      lng: 11.5,
    }
  },
}

describe.skipIf(!db)('cities store (local Postgres)', () => {
  afterAll(async () => {
    if (db) await db.delete(schema.cities).where(inArray(schema.cities.googlePlaceId, IDS))
  })

  it('creates on first resolve, reuses afterwards, accumulates spellings', async () => {
    const store = createDrizzleCityStore(db!)
    expect(await store.available()).toBe(true)
    await db!.delete(schema.cities).where(inArray(schema.cities.googlePlaceId, IDS))
    const svc = createCityService({ store, places, fallback: async () => [], log: { info() {}, warn() {}, error() {} } })

    const first = await svc.resolve(IDS[0]!, { query: 'Мюнхен', trustQuery: true })
    expect(first).toMatchObject({ persisted: true, created: true, city: { name: 'Testopolis', localName: 'Teststadt', countryCode: 'DE' } })
    expect(first.city.id).toMatch(/[0-9a-f-]{36}/)

    const again = await svc.resolve(IDS[0]!, { query: 'Munique', trustQuery: true })
    expect(again).toMatchObject({ persisted: true, created: false, city: { id: first.city.id } })
    const [row] = await db!.select().from(schema.cities).where(inArray(schema.cities.googlePlaceId, [IDS[0]!]))
    expect(row!.altNames).toEqual(expect.arrayContaining(['Teststadt', 'Мюнхен', 'Munique']))

    // Same name + country under another place id → merged into the existing row, no duplicate slug.
    const twin = await svc.resolve(IDS[1]!)
    expect(twin.city.id).toBe(first.city.id)
  })
})
