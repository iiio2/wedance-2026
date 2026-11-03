/**
 * Apify as WeDance's Instagram data source (#452, decision 2026-10-31).
 *
 * Public Instagram data through Apify actors, over the plain HTTP API — never a
 * logged-in account of ours (v3's instagram-private-api got that account banned).
 *
 *   runActor(actorId, input)        any actor, run synchronously, dataset items back
 *   fetchInstagramProfiles(handles) apify~instagram-profile-scraper, normalised
 *
 * `runActor` is generic so the next importers reuse it (#453: an event from a
 * post URL through apify~instagram-scraper / the post scraper).
 *
 * Env: APIFY_TOKEN. Without it every call is a silent no-op (logged once):
 * `apifyEnabled()` is false and the fetchers return nothing.
 *
 * The actor's output is read defensively: every field may be missing, and the
 * business address comes in more than one shape (an object, a JSON string, or
 * flat fields), so `normalizeInstagramProfile` accepts all of them.
 */

const API = 'https://api.apify.com/v2'
export const PROFILE_SCRAPER = 'apify~instagram-profile-scraper'

/** What WeDance uses of a public Instagram profile. Every field may be empty. */
export type InstagramProfile = {
  handle: string
  fullName: string | null
  biography: string | null
  /** Largest picture Instagram gives (HD when there is one). A CDN link that expires: re-host it, never store it. */
  photoUrl: string | null
  externalUrl: string | null
  isBusiness: boolean
  isPrivate: boolean
  category: string | null
  address: { street: string | null; zip: string | null; city: string | null } | null
}

type Fetch = typeof fetch

export type ActorOptions = {
  token?: string | null
  /** Seconds Apify may run the actor (the sync endpoint caps at 300). */
  timeoutSecs?: number
  /** Milliseconds we wait for the HTTP answer. */
  abortMs?: number
  fetch?: Fetch
}

let warned = false
/** The token, or null — logging "disabled" once per process, not per call. */
export function apifyToken(): string | null {
  const t = (process.env.APIFY_TOKEN ?? '').trim()
  if (t) return t
  if (!warned) {
    warned = true
    console.info('[apify] APIFY_TOKEN not set — Instagram import is off.')
  }
  return null
}

export const apifyEnabled = () => apifyToken() !== null

export class ApifyError extends Error {
  constructor(message: string, readonly status?: number) { super(message) }
}

/**
 * Run an actor and return its dataset items (`run-sync-get-dataset-items`).
 * Throws ApifyError on a failed run, a non-2xx answer or a timeout; callers
 * decide whether that is fatal. Returns [] when there is no token.
 */
export async function runActor<T = Record<string, unknown>>(actorId: string, input: unknown, opts: ActorOptions = {}): Promise<T[]> {
  const token = opts.token === undefined ? apifyToken() : opts.token
  if (!token) return []
  const timeoutSecs = Math.min(opts.timeoutSecs ?? 120, 300)
  const url = `${API}/acts/${encodeURIComponent(actorId)}/run-sync-get-dataset-items?format=json&clean=true&timeout=${timeoutSecs}`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), opts.abortMs ?? (timeoutSecs + 30) * 1000)
  try {
    const res = await (opts.fetch ?? fetch)(url, {
      method: 'POST',
      // Bearer header, not ?token=: keeps the token out of any logged URL.
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(input),
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new ApifyError(`Apify ${actorId} answered ${res.status}: ${body.slice(0, 200)}`, res.status)
    }
    const data = await res.json()
    if (!Array.isArray(data)) throw new ApifyError(`Apify ${actorId} returned no dataset items`)
    return data as T[]
  } catch (e: any) {
    if (e instanceof ApifyError) throw e
    throw new ApifyError(e?.name === 'AbortError' ? `Apify ${actorId} timed out` : `Apify ${actorId} failed: ${e?.message ?? e}`)
  } finally {
    clearTimeout(timer)
  }
}

const str = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s : null
}

/** The business address, whatever shape the actor gives it. */
function addressOf(item: Record<string, any>): InstagramProfile['address'] {
  let a: any = item.businessAddress ?? item.business_address ?? item.businessAddressJson ?? item.business_address_json ?? null
  if (typeof a === 'string') {
    try { a = JSON.parse(a) }
    catch { a = { street_address: a } }
  }
  const src = a && typeof a === 'object' ? a : {}
  const street = str(src.street_address ?? src.streetAddress ?? src.address_street ?? src.street ?? item.addressStreet ?? item.address_street)
  const zip = str(src.zip_code ?? src.zipCode ?? src.zip ?? src.postal_code ?? item.zipCode ?? item.zip_code)
  const city = str(src.city_name ?? src.cityName ?? src.city ?? item.cityName ?? item.city_name ?? item.city)
  return street || zip || city ? { street, zip, city } : null
}

/** One dataset item → an InstagramProfile, or null when it isn't a profile (a "not found" row). */
export function normalizeInstagramProfile(item: unknown): InstagramProfile | null {
  if (!item || typeof item !== 'object') return null
  const it = item as Record<string, any>
  const handle = str(it.username)?.toLowerCase()
  if (!handle || it.error) return null
  const firstLink = Array.isArray(it.externalUrls) ? it.externalUrls.map((l: any) => str(l?.url)).find(Boolean) : null
  return {
    handle,
    fullName: str(it.fullName ?? it.full_name),
    biography: str(it.biography ?? it.bio),
    photoUrl: str(it.profilePicUrlHD ?? it.profilePicUrlHd ?? it.profile_pic_url_hd) ?? str(it.profilePicUrl ?? it.profile_pic_url),
    externalUrl: str(it.externalUrl ?? it.external_url) ?? firstLink ?? null,
    isBusiness: it.isBusinessAccount === true || it.is_business_account === true,
    isPrivate: it.private === true || it.is_private === true,
    category: str(it.businessCategoryName ?? it.category_name ?? it.category),
    address: addressOf(it),
  }
}

// Per-handle cache: a page added twice in a row, or a backfill re-run, doesn't
// pay Apify twice. Misses are cached shorter, so a typo'd handle can be retried.
const HIT_MS = 6 * 3600_000
const MISS_MS = 30 * 60_000
const cache = new Map<string, { at: number; profile: InstagramProfile | null }>()

export function clearInstagramCache() { cache.clear() }

/**
 * Public profiles for these handles, in one actor run (the uncached ones).
 * The map holds every requested handle: a profile, or null when Instagram has
 * no such public account. Throws ApifyError when the run itself fails — then
 * nothing is cached. Empty map without a token.
 */
export async function fetchInstagramProfiles(handles: string[], opts: ActorOptions & { now?: number } = {}): Promise<Map<string, InstagramProfile | null>> {
  const out = new Map<string, InstagramProfile | null>()
  const token = opts.token === undefined ? apifyToken() : opts.token
  if (!token) return out
  const now = opts.now ?? Date.now()
  const want = [...new Set(handles.map(h => h.trim().replace(/^@/, '').toLowerCase()).filter(Boolean))]
  const todo: string[] = []
  for (const h of want) {
    const c = cache.get(h)
    if (c && now - c.at < (c.profile ? HIT_MS : MISS_MS)) out.set(h, c.profile)
    else todo.push(h)
  }
  if (!todo.length) return out
  const items = await runActor(PROFILE_SCRAPER, { usernames: todo }, { ...opts, token })
  const found = new Map<string, InstagramProfile>()
  for (const item of items) {
    const p = normalizeInstagramProfile(item)
    if (p) found.set(p.handle, p)
  }
  for (const h of todo) {
    const p = found.get(h) ?? null
    out.set(h, p)
    cache.set(h, { at: now, profile: p })
  }
  if (cache.size > 1000) for (const k of [...cache.keys()].slice(0, cache.size - 1000)) cache.delete(k)
  return out
}
