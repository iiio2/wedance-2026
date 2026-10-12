import { eq } from 'drizzle-orm'
import { useDb } from '../db'
import { profiles } from '../../database/schema'
import cityImages from '../../data/city-images.json'
import { buildCityOptions, type CityOption } from '../../../shared/utils/citySearch'
import { createPlacesClient } from './google'
import { createCityService, type CityService } from './service'
import { createDrizzleCityStore } from './store'

/**
 * App wiring for the city service: Neon store + Google Places client + the pre-migration catalogue
 * as fallback. One instance per server process so caches and rate limits hold.
 * Without GOOGLE_MAPS_API_KEY the picker still works from our own `cities`
 * table; it just can't add cities that aren't there yet.
 */

/** Visible profiles per city slug — ranks "Popular on WeDance". */
export async function profileCityRows(): Promise<{ city: string | null, citySlug: string | null }[]> {
  try {
    return await useDb()
      .select({ city: profiles.city, citySlug: profiles.citySlug })
      .from(profiles)
      .where(eq(profiles.status, 'visible'))
  }
  catch (err) {
    console.error('[cities] profile query failed', err)
    return []
  }
}

/** Today's list (profile cities + illustrated-city catalogue) — used until the `cities` table exists. */
export async function catalogueOptions(): Promise<CityOption[]> {
  const opts = buildCityOptions(await profileCityRows(), cityImages as Record<string, { country?: string | null, altNames?: string[] }>)
  return opts.map(o => ({ ...o, source: 'catalogue' as const }))
}

let service: CityService | null = null

export function useCityService(): CityService {
  if (service) return service
  // Read at request time, not via runtimeConfig: runtimeConfig defaults are
  // inlined into the server bundle at build time, and the key shouldn't be in
  // any build artefact. Server-only — never exposed under `public`.
  const key = process.env.GOOGLE_MAPS_API_KEY ?? ''
  if (!key) console.warn('[cities] GOOGLE_MAPS_API_KEY not set — city search is limited to known cities')
  service = createCityService({
    store: createDrizzleCityStore(useDb()),
    places: key ? createPlacesClient(key) : null,
    fallback: catalogueOptions,
  })
  return service
}

export function clientIp(event: Parameters<typeof getRequestIP>[0]): string {
  return getRequestIP(event, { xForwardedFor: true }) ?? 'anon'
}
