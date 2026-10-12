import { clientIp, useCityService } from '../utils/cities/nitro'
import type { SearchResult } from '../utils/cities/service'

/**
 * GET /api/city-search?q=Мюнх&session=<uuid>
 *
 * Our canonical `cities` table first (accent/case-insensitive, alt names), then
 * — only when that finds fewer than 3 cities and the query has 2+ letters —
 * Google Places Autocomplete (types=(cities), English). Predictions for places
 * we already have come back as our rows; the rest carry `source: 'google'` and
 * must go through POST /api/city-resolve before they can be saved.
 * `session` is the Places session token (one per typing session, client-made).
 */
export default defineEventHandler(async (event): Promise<SearchResult> => {
  const { q, session, limit } = getQuery(event)
  const query = typeof q === 'string' ? q : ''
  const sessionToken = typeof session === 'string' && /^[\w-]{8,64}$/.test(session) ? session : undefined
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return useCityService().search(query, { sessionToken, ip: clientIp(event), limit: Number(limit) || 8 })
})
