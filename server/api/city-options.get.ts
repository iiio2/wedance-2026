import { eq } from 'drizzle-orm'
import { useDb } from '../utils/db'
import { profiles } from '../database/schema'
import cityImages from '../data/city-images.json'
import { buildCityOptions, type CityOption } from '#shared/utils/citySearch'

/**
 * Suggestions for <CityCombobox>: every city someone has listed on WeDance
 * (ranked by community size) plus the illustrated-city catalogue, with country
 * and alternative spellings so "München" finds Munich. ~470 rows, ~25 KB
 * gzipped — fetched once per session and filtered on the client, so typing
 * never waits on the network and no geocoding API key is needed.
 */
export default defineEventHandler(async (event): Promise<CityOption[]> => {
  let rows: { city: string | null, citySlug: string | null }[] = []
  try {
    rows = await useDb()
      .select({ city: profiles.city, citySlug: profiles.citySlug })
      .from(profiles)
      .where(eq(profiles.status, 'visible'))
  }
  catch (err) {
    // The catalogue alone is still a useful list — never fail the field.
    console.error('[city-options] profile query failed', err)
  }
  setResponseHeader(event, 'Cache-Control', 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400')
  return buildCityOptions(rows, cityImages as Record<string, { country?: string | null, altNames?: string[] }>)
})
