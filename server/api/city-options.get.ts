import { catalogueOptions, profileCityRows, useCityService } from '../utils/cities/nitro'
import { rowToOption } from '../utils/cities/service'
import type { CityOption } from '#shared/utils/citySearch'

/**
 * The known-city list for <CityCombobox>: fetched once per session on first
 * focus, filtered on the client with every keystroke (no request per letter),
 * and its biggest communities are the "Popular on WeDance" empty state.
 *
 * Source: the canonical `cities` table, ranked by visible profiles per slug.
 * Until migration 0024 is applied (or while the table is still empty) it falls
 * back to today's list — profile cities + the illustrated-city catalogue — so
 * the field keeps working before the migration.
 */
export default defineEventHandler(async (event): Promise<CityOption[]> => {
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
  try {
    const rows = await useCityService().rows()
    if (rows && rows.length) {
      const counts = new Map<string, number>()
      for (const r of await profileCityRows()) if (r.citySlug) counts.set(r.citySlug, (counts.get(r.citySlug) ?? 0) + 1)
      return rows.map(r => rowToOption(r, counts.get(r.slug) ?? 0))
    }
  }
  catch (err) {
    console.error('[city-options] cities table read failed', (err as Error).message)
  }
  return catalogueOptions()
})
