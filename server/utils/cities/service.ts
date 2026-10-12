import { mergeCityResults, normalizeCity, searchCities, type CityOption } from '../../../shared/utils/citySearch'
import { component, placeCityName, predictionCountry, type PlaceDetails, type PlacesClient, type PlacePrediction } from './google'
import { asciiFold, isUsefulQuery, localLanguage, mergeAltNames, slugCandidates, uniqueSlug } from './names'
import { LruCache, RateLimiter } from './memo'

/**
 * Canonical cities — search + resolve, independent of Nuxt so the backfill
 * script and the unit tests can drive it with their own store / Places client.
 *
 *   search(q)        our `cities` table first (accent/case-insensitive, alt names);
 *                    Google Autocomplete only when that finds < GOOGLE_BELOW hits.
 *   resolve(placeId) the row for that Google place — created on first pick
 *                    (Details in English + once, for non-English countries, in the
 *                    local language), so every later pick costs nothing.
 *
 * When the table doesn't exist yet (migration 0024 not applied), search falls
 * back to the pre-migration catalogue and resolve still returns the canonical
 * city — it just can't save it (`persisted: false`).
 */

export interface CityRow {
  id: string
  googlePlaceId: string
  slug: string
  name: string
  localName: string | null
  country: string | null
  countryCode: string | null
  region: string | null
  lat: number | null
  lng: number | null
  altNames: string[]
}

export type NewCityRow = Omit<CityRow, 'id'>

export interface CityStore {
  /** Does the `cities` table exist? (false before migration 0024) */
  available(): Promise<boolean>
  list(): Promise<CityRow[]>
  slugTaken(slug: string): Promise<boolean>
  /** Insert; on a google_place_id conflict returns the existing row (alt names merged), created=false. */
  insert(row: NewCityRow): Promise<{ row: CityRow, created: boolean }>
  updateAltNames(id: string, altNames: string[]): Promise<void>
}

export interface CityServiceDeps {
  store: CityStore
  /** null = no key configured → DB-only search, resolve unavailable. */
  places: PlacesClient | null
  /** The pre-migration list (profile cities + city-images.json). */
  fallback: () => Promise<CityOption[]>
  log?: Pick<Console, 'info' | 'warn' | 'error'>
  /** Google is asked only when local matching finds fewer than this. */
  googleBelow?: number
  /** Places calls per IP per minute (search) — beyond it search stays DB-only. */
  searchPerMinute?: number
  /** Resolves per IP per minute. */
  resolvePerMinute?: number
  now?: () => number
}

export interface SearchResult {
  results: CityOption[]
  /** Did this request reach Google (cache misses only)? */
  google: boolean
  /** true = matched against the canonical table; false = pre-migration catalogue. */
  canonical: boolean
}

export interface ResolveResult {
  city: CityOption
  /** Saved to (or already in) the `cities` table. */
  persisted: boolean
  created: boolean
}

export class CityResolveError extends Error {
  constructor(public code: 'BAD_PLACE' | 'NOT_FOUND' | 'NO_KEY' | 'RATE_LIMITED', message: string) { super(message) }
}

export const MIN_QUERY = 2
const PLACE_ID_RE = /^[\w-]{10,300}$/

export function rowToOption(r: CityRow, communities = 0): CityOption {
  return {
    id: r.id,
    placeId: r.googlePlaceId,
    slug: r.slug,
    name: r.name,
    localName: r.localName,
    country: r.country,
    countryCode: r.countryCode,
    region: r.region,
    lat: r.lat,
    lng: r.lng,
    altNames: r.altNames ?? [],
    communities,
    source: 'city',
  }
}

export function predictionToOption(p: PlacePrediction): CityOption {
  return {
    id: null,
    placeId: p.placeId,
    slug: '',
    name: p.mainText,
    country: predictionCountry(p),
    description: p.secondaryText || null,
    altNames: [],
    communities: 0,
    source: 'google',
  }
}

/** Canonical fields from an English Details result (+ optional local-language one). */
export function canonicalFromDetails(en: PlaceDetails, local: PlaceDetails | null): Omit<NewCityRow, 'slug' | 'altNames'> {
  const country = component(en, 'country')
  return {
    googlePlaceId: en.placeId,
    name: placeCityName(en),
    localName: local ? placeCityName(local) || null : null,
    country: country?.long_name ?? null,
    countryCode: country?.short_name?.toUpperCase() ?? null,
    region: component(en, 'administrative_area_level_1')?.long_name ?? null,
    lat: en.lat,
    lng: en.lng,
  }
}

export function createCityService(deps: CityServiceDeps) {
  const log = deps.log ?? console
  const now = deps.now ?? (() => Date.now())
  const googleBelow = deps.googleBelow ?? 3
  const predictions = new LruCache<PlacePrediction[]>(1000, 24 * 3600_000, now)
  const resolved = new LruCache<CityOption>(1000, 24 * 3600_000, now)
  const searchLimiter = new RateLimiter(deps.searchPerMinute ?? 30, 60_000, now)
  const resolveLimiter = new RateLimiter(deps.resolvePerMinute ?? 10, 60_000, now)

  // The whole table, cached briefly: matching runs in memory with the exact
  // rules the client uses (a few thousand rows at most).
  let rowsCache: { rows: CityRow[], exp: number } | null = null
  async function rows(): Promise<CityRow[] | null> {
    if (!(await deps.store.available())) return null
    if (rowsCache && rowsCache.exp > now()) return rowsCache.rows
    const list = await deps.store.list()
    rowsCache = { rows: list, exp: now() + 60_000 }
    return list
  }
  function invalidate() { rowsCache = null }

  async function localOptions(): Promise<{ options: CityOption[], canonical: boolean }> {
    const list = await rows()
    if (list && list.length) return { options: list.map(r => rowToOption(r)), canonical: true }
    return { options: await deps.fallback(), canonical: !!list }
  }

  async function search(q: string, opts: { sessionToken?: string, ip?: string, limit?: number } = {}): Promise<SearchResult> {
    const limit = Math.min(Math.max(opts.limit ?? 8, 1), 20)
    const query = q.trim().slice(0, 80)
    const { options, canonical } = await localOptions()
    const local = searchCities(options, query, limit)
    const folded = normalizeCity(query)
    if (folded.length < MIN_QUERY || local.length >= googleBelow || !deps.places)
      return { results: local, google: false, canonical }

    let preds = predictions.get(folded)
    let google = false
    if (!preds) {
      if (!searchLimiter.take(opts.ip ?? 'anon')) return { results: local, google: false, canonical }
      try {
        preds = await deps.places.autocomplete(query, { sessionToken: opts.sessionToken, language: 'en' })
        predictions.set(folded, preds)
        google = true
      }
      catch (err) {
        log.error('[cities] autocomplete failed', (err as Error).message)
        return { results: local, google: false, canonical }
      }
    }
    // A prediction for a place we already have becomes our row (known, no resolve needed).
    const byPlace = new Map(options.filter(o => o.placeId).map(o => [o.placeId!, o]))
    const remote = preds.map(p => byPlace.get(p.placeId) ?? resolved.get(p.placeId) ?? predictionToOption(p))
    return { results: mergeCityResults([local, remote], limit), google, canonical }
  }

  /**
   * `query` = what the person typed. It is kept as an alt name only when Google
   * found this place through a *different* name (no text match — "Мюнх" →
   * Munich), known from this instance's prediction cache; otherwise dropped.
   * `trustQuery` (backfill): the query is a value people saved for this place —
   * keep it whenever it adds a spelling.
   */
  async function resolve(placeId: string, opts: { sessionToken?: string, query?: string, ip?: string, trustQuery?: boolean } = {}): Promise<ResolveResult> {
    if (!PLACE_ID_RE.test(placeId)) throw new CityResolveError('BAD_PLACE', 'Invalid place id')
    if (opts.query && !opts.trustQuery) {
      const p = predictions.get(normalizeCity(opts.query))?.find(x => x.placeId === placeId)
      if (!p || p.matchedText) opts = { ...opts, query: undefined }
    }
    const list = await rows()
    const persistable = list !== null

    // 1. Already canonical → remember the typed spelling, done. No Google call.
    const known = list?.find(r => r.googlePlaceId === placeId)
    if (known) return { city: rowToOption(await rememberQuery(known, opts.query)), persisted: true, created: false }
    const cached = resolved.get(placeId)
    if (cached && !persistable) return { city: cached, persisted: false, created: false }

    if (!deps.places) throw new CityResolveError('NO_KEY', 'Places API is not configured')
    if (!resolveLimiter.take(opts.ip ?? 'anon')) throw new CityResolveError('RATE_LIMITED', 'Too many requests')

    // 2. Details in English (closes the billed autocomplete session) …
    const en = await deps.places.details(placeId, { sessionToken: opts.sessionToken, language: 'en' })
    if (!en || !placeCityName(en)) throw new CityResolveError('NOT_FOUND', 'Place not found')
    const cc = component(en, 'country')?.short_name ?? null
    // … and once per new city, the name in the country's language (München).
    const lang = localLanguage(cc)
    let local: PlaceDetails | null = null
    if (lang) {
      try { local = await deps.places.details(placeId, { language: lang }) }
      catch (err) { log.warn('[cities] local-name details failed', (err as Error).message) }
    }
    const base = canonicalFromDetails(en, local)
    if (!base.localName && !lang) base.localName = base.name

    // 3. Same city under another place-id variant (same name + country) → merge into it.
    const twin = list?.find(r => r.countryCode === base.countryCode && normalizeCity(r.name) === normalizeCity(base.name))
    if (twin) {
      const merged = await rememberQuery(twin, opts.query, [base.localName])
      return { city: rowToOption(merged), persisted: true, created: false }
    }

    const knownNames = [base.name, base.localName].filter(Boolean) as string[]
    const altNames = mergeAltNames([], [
      base.name, base.localName, asciiFold(base.name), base.localName ? asciiFold(base.localName) : null,
      isUsefulQuery(opts.query, knownNames) ? opts.query : null,
    ], knownNames)
    const taken = new Set((list ?? []).map(r => r.slug))
    const slug = await uniqueSlug(
      slugCandidates(base.name, base.countryCode, base.region, placeId),
      s => taken.has(s) || (persistable ? deps.store.slugTaken(s) : false),
    )
    const row: NewCityRow = { ...base, slug, altNames }

    if (!persistable) {
      const city = { ...rowToOption({ ...row, id: '' }), id: null }
      resolved.set(placeId, city)
      log.warn(`[cities] "cities" table missing — resolved ${row.name} (${placeId}) but persistence is pending migration 0024`)
      return { city, persisted: false, created: false }
    }
    const { row: saved, created } = await deps.store.insert(row)
    invalidate()
    return { city: rowToOption(saved), persisted: true, created }
  }

  async function rememberQuery(r: CityRow, query?: string, extra: Array<string | null> = []): Promise<CityRow> {
    const knownNames = [r.name, r.localName, ...r.altNames].filter(Boolean) as string[]
    const additions = [...extra, isUsefulQuery(query, knownNames) ? query! : null]
    const next = mergeAltNames(r.altNames, additions, [r.name, r.localName])
    if (next.length === r.altNames.length && next.every((a, i) => a === r.altNames[i])) return r
    await deps.store.updateAltNames(r.id, next)
    invalidate()
    return { ...r, altNames: next }
  }

  return { search, resolve, rows, invalidate }
}

export type CityService = ReturnType<typeof createCityService>
