import { clientIp, useCityService } from '../utils/cities/nitro'
import { CityResolveError, type ResolveResult } from '../utils/cities/service'

/**
 * POST /api/city-resolve { placeId, session?, query? }
 *
 * Turns a picked Google suggestion into the canonical city: returns our row if
 * we have it (no Google call), otherwise Place Details (English, + local
 * language once per new city), upserts it into `cities` and returns it. `query`
 * — what the person typed — is remembered as a spelling ("Мюнхен" → Munich).
 * Before migration 0024 the city is returned with `persisted: false`.
 */
export default defineEventHandler(async (event): Promise<ResolveResult> => {
  const body = await readBody<{ placeId?: unknown, session?: unknown, query?: unknown }>(event)
  const placeId = typeof body?.placeId === 'string' ? body.placeId : ''
  const sessionToken = typeof body?.session === 'string' && /^[\w-]{8,64}$/.test(body.session) ? body.session : undefined
  const query = typeof body?.query === 'string' ? body.query.slice(0, 80) : undefined
  try {
    return await useCityService().resolve(placeId, { sessionToken, query, ip: clientIp(event) })
  }
  catch (err) {
    if (err instanceof CityResolveError) {
      const status = { BAD_PLACE: 400, NOT_FOUND: 404, NO_KEY: 503, RATE_LIMITED: 429 }[err.code]
      throw createError({ statusCode: status, statusMessage: err.message })
    }
    console.error('[city-resolve] failed', (err as Error).message)
    throw createError({ statusCode: 502, statusMessage: 'Could not resolve the city' })
  }
})
