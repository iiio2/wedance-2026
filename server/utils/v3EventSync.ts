/**
 * wedance.vip (v3, Firestore `posts` where type == "event") → 2026 `events` table.
 *
 * Pure mapping + a READ-ONLY Firestore REST client + the DB upsert, shared by
 * scripts/sync-v3-events.ts (CLI) and any future scheduled route. Nothing in
 * here ever writes to Firestore — the only Firestore call is `:runQuery`.
 *
 * v3 data is messy (it has been written by the v3 app, an ical importer, a
 * Facebook importer and a seeding bot over six years), so every field is
 * normalised defensively:
 *   - startDate/endDate: epoch ms number | numeric string | ISO string | Timestamp
 *   - venue: Google Places object | JSON string | plain address string
 *   - styles: { Key: { selected } } map | JSON string of that map | array | csv
 *   - org: object | JSON string
 */
import { createSign } from 'node:crypto'
import { and, eq, getTableColumns, gte, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { events, profiles } from '../database/schema'
import cityImages from '../data/city-images.json'

export const V3_SOURCE = 'wedance-v3'
const MUNICH_PLACE_ID = 'ChIJ2V-Mo_l1nkcRfZixfUq4DAE'
const BOT_USERNAME = 'wedance-bot'

// ---------------------------------------------------------------------------
// Normalisers
// ---------------------------------------------------------------------------

/** Any v3 date shape → epoch ms, or null when unusable. */
export function toMs(v: unknown): number | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.getTime()
  if (typeof v === 'number') return Number.isFinite(v) ? (v < 1e11 ? v * 1000 : v) : null // seconds → ms
  if (typeof v === 'string') {
    const s = v.trim()
    if (/^\d+(\.\d+)?$/.test(s)) return toMs(Number(s))
    const t = Date.parse(s)
    return Number.isNaN(t) ? null : t
  }
  if (typeof v === 'object') {
    const o = v as Record<string, any>
    if (typeof o.toMillis === 'function') return o.toMillis()
    const sec = o._seconds ?? o.seconds
    if (typeof sec === 'number') return sec * 1000 + Math.round((o._nanoseconds ?? o.nanoseconds ?? 0) / 1e6)
  }
  return null
}

function parseMaybeJson<T = any>(v: unknown): T | string | null {
  if (v == null) return null
  if (typeof v !== 'string') return v as T
  const s = v.trim()
  if (!s) return null
  if (s.startsWith('{') || s.startsWith('[')) {
    try { return JSON.parse(s) as T } catch { /* fall through */ }
  }
  return s
}

/**
 * City from a formatted address when Google gave no locality component (common
 * for Czech addresses): "Běhounská 22, 612 00 Brno-Brno-střed, Czechia" → "Brno",
 * "Dlouhá 741/13, 110 00 Praha 1-Staré Město, Czechia" → "Praha".
 */
export function cityFromAddress(address: string | null): string | null {
  if (!address) return null
  for (const part of address.split(',').map(s => s.trim())) {
    const m = part.match(/^(?:[A-Z]{1,2}-)?\d{3}\s?\d{2,3}\s+(.+)$/) ?? part.match(/^\d{4,5}\s+(.+)$/)
    if (m) return m[1]!.split('-')[0]!.replace(/\s+\d+$/, '').trim() || null
  }
  return null
}

export type Venue = {
  name: string | null
  address: string | null
  lat: number | null
  lng: number | null
  locality: string | null
  country: string | null
  countryCode: string | null
  placeId: string | null
}

export function parseVenue(raw: unknown): Venue | null {
  const v = parseMaybeJson<Record<string, any>>(raw)
  if (!v) return null
  if (typeof v === 'string') {
    // Plain address string — no geo, no components; locality guessed later.
    return { name: v.split(',')[0]!.trim() || null, address: v, lat: null, lng: null, locality: cityFromAddress(v), country: null, countryCode: null, placeId: null }
  }
  const comps: any[] = Array.isArray(v.address_components) ? v.address_components : []
  const comp = (type: string) => comps.find(c => Array.isArray(c?.types) && c.types.includes(type))
  const locality = comp('locality') ?? comp('postal_town') ?? comp('administrative_area_level_3')
  const country = comp('country')
  const loc = v.geometry?.location ?? v._geoloc ?? null
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x)) ? Number(x) : null)
  const name = typeof v.name === 'string' && v.name.trim() ? v.name.trim() : null
  const address = typeof v.formatted_address === 'string' && v.formatted_address.trim() ? v.formatted_address.trim() : null
  return {
    name,
    address,
    lat: num(loc?.lat),
    lng: num(loc?.lng),
    locality: locality?.long_name ?? cityFromAddress(address),
    country: country?.long_name ?? null,
    countryCode: country?.short_name ?? null,
    placeId: typeof v.place_id === 'string' && v.place_id ? v.place_id : null,
  }
}

/** v3 StyleKey → 2026 style label (the Title-Case names the 2026 UI colours). */
export const STYLE_MAP: Record<string, string> = {
  salsa: 'Salsa', salsala: 'Salsa', salsaon1: 'Salsa', salsaon2: 'Salsa', salsanewyork: 'Salsa', mambo: 'Salsa',
  salsacubana: 'Casino', casino: 'Casino', ruedadecasino: 'Rueda', rueda: 'Rueda',
  timba: 'Timba', son: 'Son', cubanson: 'Son', rumbaguaguanco: 'Rumba', rumba: 'Rumba',
  afrocuban: 'Afro', afro: 'Afro', afrobeats: 'Afrobeats', reggaeton: 'Reggaeton', cubaton: 'Reggaeton',
  bachata: 'Bachata', sensualbachata: 'Bachata', dominicanbachata: 'Bachata', bachatamoderna: 'Bachata',
  kizomba: 'Kizomba', douceur: 'Kizomba', semba: 'Semba', urbankizz: 'Urban Kiz', urbankiz: 'Urban Kiz', tarraxo: 'Tarraxo', tarraxinha: 'Tarraxo',
  brazilianzouk: 'Zouk', zouk: 'Zouk', lambada: 'Lambada',
  merengue: 'Merengue', cumbia: 'Cumbia', chachacha: 'Cha-Cha-Cha',
  tangoargentino: 'Tango', tango: 'Tango', westcoastswing: 'West Coast Swing', lindyhop: 'Lindy Hop',
  ballroom: 'Ballroom', hiphop: 'Hip Hop',
}

const humanize = (k: string) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim()

/** Any v3 styles shape → de-duplicated 2026 style labels, plus the keys we had no mapping for. */
export function mapStyles(raw: unknown): { styles: string[]; unmapped: string[] } {
  let v: any = parseMaybeJson(raw)
  let keys: string[] = []
  if (Array.isArray(v)) keys = v.map(x => (typeof x === 'string' ? x : x?.id ?? x?.name)).filter(Boolean)
  else if (typeof v === 'string') keys = v.split(/[,|]/).map(s => s.trim()).filter(Boolean)
  else if (v && typeof v === 'object') {
    // A JSON string that was spread into an object shows up as {"0":"{","1":"\""…}:
    // never turn character indices into tags.
    const entries = Object.entries(v)
    if (entries.length && entries.every(([k]) => /^\d+$/.test(k))) {
      return mapStyles(entries.map(([, c]) => c).join(''))
    }
    keys = entries.filter(([, s]) => s !== false && (s == null || typeof s !== 'object' || (s as any).selected !== false)).map(([k]) => k)
  }
  const out: string[] = []
  const unmapped: string[] = []
  for (const k of keys) {
    if (/^\d+$/.test(k)) continue
    const mapped = STYLE_MAP[k.toLowerCase().replace(/[^a-z0-9]/g, '')]
    const label = mapped ?? humanize(k)
    if (!mapped) unmapped.push(k)
    if (label && !out.includes(label)) out.push(label)
  }
  return { styles: out, unmapped }
}

export function parseOrg(raw: unknown): { username: string | null; name: string | null } {
  const v = parseMaybeJson<Record<string, any>>(raw)
  if (!v || typeof v !== 'object') return { username: typeof v === 'string' ? v : null, name: null }
  const username = typeof v.username === 'string' && v.username.trim() ? v.username.trim() : null
  const name = typeof v.name === 'string' && v.name.trim() ? v.name.trim() : null
  return { username, name }
}

// ---------------------------------------------------------------------------
// City + timezone resolution
// ---------------------------------------------------------------------------

export const normName = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, ' ').trim()

export const citySlugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export type CityIndex = Map<string, { slug: string; name: string }>

/**
 * name/alt-name → { slug, display name }. Seeds from 2026's own city records
 * (profiles.city/city_slug — the slugs /cities/[city] is keyed by) and from the
 * multilingual altNames in server/data/city-images.json, so "München" → munich,
 * "Wien" → vienna, "Warszawa" → warsaw.
 */
export function buildCityIndex(profileCities: { city: string | null; citySlug: string | null }[]): CityIndex {
  const idx: CityIndex = new Map()
  const names = new Map<string, string>() // slug → English display name
  for (const r of profileCities) if (r.city && r.citySlug && !names.has(r.citySlug)) names.set(r.citySlug, r.city)
  const put = (key: string, slug: string) => { const k = normName(key); if (k && !idx.has(k)) idx.set(k, { slug, name: names.get(slug) ?? key }) }
  for (const [slug, name] of names) { put(name, slug); put(slug.replace(/-/g, ' '), slug) }
  for (const [slug, img] of Object.entries(cityImages as Record<string, { altNames?: string[]; source?: string }>)) {
    const title = img.source ? decodeURIComponent(img.source.split('/wiki/')[1] ?? '').replace(/_/g, ' ').split(',')[0] : ''
    if (!names.has(slug) && title) names.set(slug, title)
    put(slug.replace(/-/g, ' '), slug)
    if (title) put(title, slug)
    for (const a of img.altNames ?? []) put(a, slug)
  }
  return idx
}

export function resolveCity(locality: string | null, idx: CityIndex): { slug: string; name: string } | null {
  if (!locality) return null
  const hit = idx.get(normName(locality))
  if (hit) return hit
  // "München-Ramersdorf", "Frankfurt am Main" → try the leading token.
  const head = normName(locality).split(' ')[0]
  if (head && head.length > 3 && idx.get(head)) return idx.get(head)!
  return { slug: citySlugify(locality), name: locality }
}

const COUNTRY_TZ: Record<string, string> = {
  DE: 'Europe/Berlin', AT: 'Europe/Vienna', CH: 'Europe/Zurich', IT: 'Europe/Rome', FR: 'Europe/Paris',
  ES: 'Europe/Madrid', PT: 'Europe/Lisbon', NL: 'Europe/Amsterdam', BE: 'Europe/Brussels', LU: 'Europe/Luxembourg',
  GB: 'Europe/London', IE: 'Europe/Dublin', DK: 'Europe/Copenhagen', NO: 'Europe/Oslo', SE: 'Europe/Stockholm',
  FI: 'Europe/Helsinki', EE: 'Europe/Tallinn', LV: 'Europe/Riga', LT: 'Europe/Vilnius', PL: 'Europe/Warsaw',
  CZ: 'Europe/Prague', SK: 'Europe/Bratislava', HU: 'Europe/Budapest', SI: 'Europe/Ljubljana', HR: 'Europe/Zagreb',
  RS: 'Europe/Belgrade', ME: 'Europe/Podgorica', AL: 'Europe/Tirane', GR: 'Europe/Athens', RO: 'Europe/Bucharest',
  BG: 'Europe/Sofia', UA: 'Europe/Kyiv', TR: 'Europe/Istanbul', RU: 'Europe/Moscow', CY: 'Asia/Nicosia', MT: 'Europe/Malta',
  CU: 'America/Havana', CO: 'America/Bogota', DO: 'America/Santo_Domingo', PR: 'America/Puerto_Rico', PE: 'America/Lima',
  AR: 'America/Argentina/Buenos_Aires', CL: 'America/Santiago', MX: 'America/Mexico_City', BR: 'America/Sao_Paulo',
  SN: 'Africa/Dakar', TN: 'Africa/Tunis', MA: 'Africa/Casablanca', NG: 'Africa/Lagos', AO: 'Africa/Luanda', EG: 'Africa/Cairo',
  ZA: 'Africa/Johannesburg', IL: 'Asia/Jerusalem', AE: 'Asia/Dubai', IN: 'Asia/Kolkata', TH: 'Asia/Bangkok',
  SG: 'Asia/Singapore', TW: 'Asia/Taipei', HK: 'Asia/Hong_Kong', JP: 'Asia/Tokyo', KR: 'Asia/Seoul', CN: 'Asia/Shanghai',
  NZ: 'Pacific/Auckland',
}

/** IANA timezone for a venue. Multi-zone countries split by longitude; unknown → Europe/Berlin (v3 is Munich-centred). */
export function resolveTimezone(countryCode: string | null, lng: number | null): string {
  const cc = (countryCode ?? '').toUpperCase()
  if (cc === 'US') return lng == null ? 'America/New_York' : lng > -87 ? 'America/New_York' : lng > -101 ? 'America/Chicago' : lng > -115 ? 'America/Denver' : 'America/Los_Angeles'
  if (cc === 'CA') return lng == null ? 'America/Toronto' : lng > -66 ? 'America/Halifax' : lng > -90 ? 'America/Toronto' : lng > -102 ? 'America/Winnipeg' : lng > -120 ? 'America/Edmonton' : 'America/Vancouver'
  if (cc === 'AU') return lng != null && lng < 129 ? 'Australia/Perth' : 'Australia/Sydney'
  if (cc === 'ES' && lng != null && lng < -12) return 'Atlantic/Canary'
  return COUNTRY_TZ[cc] ?? 'Europe/Berlin'
}

// ---------------------------------------------------------------------------
// Doc → row
// ---------------------------------------------------------------------------

export type V3Doc = Record<string, any> & { id: string }

export type MappedEvent = {
  sourceId: string
  slug: string
  name: string
  type: string
  description: string
  cover: string
  startDate: Date
  endDate: Date
  isFestival: boolean
  price: string
  city: string | null
  citySlug: string | null
  country: string | null
  timezone: string
  venueName: string | null
  venueAddress: string | null
  venueLat: number | null
  venueLng: number | null
  organizerUsername: string | null
  organizerName: string | null
  venueUsername: string | null
  artists: string[]
  link: string | null
  seriesId: string | null
  styles: string[]
}

export type SkipReason = 'not-event' | 'unlisted' | 'bad-date' | 'past' | 'no-venue' | 'no-name' | 'no-city'

const FESTIVAL_TYPES = new Set(['Festival', 'Congress', 'Weekender'])

/** v3 seeding-bot boilerplate about claiming a listing on wedance.vip — meaningless on 2026. */
function cleanDescription(d: unknown): string {
  if (typeof d !== 'string') return ''
  return d
    .split('\n')
    .filter(l => !/^\s*🔔\s*Is this your event\?/.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const url = (v: unknown) => (typeof v === 'string' && /^https?:\/\//i.test(v.trim()) ? v.trim() : null)

export function mapV3Event(
  doc: V3Doc,
  ctx: { now: number; cityIndex: CityIndex; placeLocality: Map<string, string>; knownProfiles: Map<string, string>; links?: Map<string, EventLinks> },
): { ok: true; row: MappedEvent; unmappedStyles: string[] } | { ok: false; reason: SkipReason } {
  if (doc.type !== 'event') return { ok: false, reason: 'not-event' }
  if (doc.visibility === 'Unlisted') return { ok: false, reason: 'unlisted' }
  const start = toMs(doc.startDate)
  if (start == null) return { ok: false, reason: 'bad-date' }
  if (start < ctx.now) return { ok: false, reason: 'past' }
  let end = toMs(doc.endDate)
  if (end == null || end <= start) {
    const dur = Number(doc.duration)
    end = start + (Number.isFinite(dur) && dur > 0 ? dur : 120) * 60_000
  }
  const name = typeof doc.name === 'string' ? doc.name.trim() : ''
  if (!name) return { ok: false, reason: 'no-name' }

  const venue = parseVenue(doc.venue)
  // v3 only lists events that carry a city place id + venue (explore/<city>). The
  // raw ical imports without either never appear on wedance.vip — mirror that.
  if (!venue && !doc.place) return { ok: false, reason: 'no-venue' }

  const place = typeof doc.place === 'string' && doc.place !== 'undefined' ? doc.place : ''
  const locality = venue?.locality ?? (place ? ctx.placeLocality.get(place) ?? (place === MUNICH_PLACE_ID ? 'Munich' : null) : null)
  const city = resolveCity(locality, ctx.cityIndex)
  if (!city) return { ok: false, reason: 'no-city' }

  const org = parseOrg(doc.org)
  const orgUser = org.username && org.username !== BOT_USERNAME ? org.username.toLowerCase() : null
  const { styles, unmapped } = mapStyles(doc.styles)
  const type = typeof doc.eventType === 'string' && doc.eventType ? doc.eventType : 'Party'

  return {
    ok: true,
    unmappedStyles: unmapped,
    row: {
      sourceId: doc.id,
      slug: `v3-${doc.id}`,
      name,
      type,
      description: cleanDescription(doc.description),
      cover: url(doc.cover) ?? url(doc.socialCover) ?? '',
      startDate: new Date(start),
      endDate: new Date(end),
      // Only the festival-shaped types — a multi-week Course is a series, not a festival.
      isFestival: FESTIVAL_TYPES.has(type),
      price: typeof doc.price === 'string' && doc.price.trim().toLowerCase() !== 'unknown' ? doc.price.trim() : '',
      city: city.name,
      citySlug: city.slug,
      country: venue?.country ?? null,
      timezone: resolveTimezone(venue?.countryCode ?? null, venue?.lng ?? null),
      venueName: venue?.name ?? null,
      venueAddress: venue?.address ?? null,
      venueLat: venue?.lat ?? null,
      venueLng: venue?.lng ?? null,
      // Only link organisers that exist as a 2026 profile (else /@handle 404s).
      ...linkedPeople(doc.id, orgUser, org, ctx),
      link: url(doc.link) ?? url(doc.sourceUrl) ?? url(doc.facebook) ?? url(doc.source),
      seriesId: typeof doc.seriesId === 'string' && doc.seriesId ? doc.seriesId : null,
      styles,
    },
  }
}

/** Profile links for one event, resolved by the profile sync (server/utils/v3ProfileSync.ts). */
export type EventLinks = { venueUsername: string | null; organizerUsername: string | null; artists: string[] }

function linkedPeople(
  id: string, orgUser: string | null, org: { username: string | null; name: string | null },
  ctx: { knownProfiles: Map<string, string>; links?: Map<string, EventLinks> },
) {
  const l = ctx.links?.get(id)
  // Only link organisers that exist (or are about to) as a 2026 profile, else /@handle 404s.
  const organizerUsername = l?.organizerUsername ?? (orgUser && ctx.knownProfiles.has(orgUser) ? orgUser : null)
  return {
    organizerUsername,
    organizerName: (organizerUsername && ctx.knownProfiles.get(organizerUsername)) || org.name || (orgUser ? org.username : null),
    venueUsername: l?.venueUsername ?? null,
    artists: l?.artists ?? [],
  }
}

/**
 * The recurring series a synced event belongs to, or null for a one-off. v3's
 * own `seriesId` wins; the seeding bot's deterministic ids (`seed-<slug>-<yyyymmdd>`)
 * carry the series in the id itself.
 */
export function seriesKey(sourceId: string | null | undefined, seriesId?: string | null): string | null {
  if (seriesId) return `series:${seriesId}`
  const m = /^seed-(.+)-\d{8}$/.exec(sourceId ?? '')
  return m ? `seed:${m[1]}` : null
}

/** Same night, same name, same place — v3 sometimes holds one event as two posts. */
export function dedupeKey(r: Pick<MappedEvent, 'name' | 'startDate' | 'venueName' | 'venueAddress' | 'venueLat' | 'venueLng'>): string {
  const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')
  const place = r.venueLat != null && r.venueLng != null
    ? `${r.venueLat.toFixed(3)},${r.venueLng.toFixed(3)}`
    : norm(r.venueName) || norm(r.venueAddress)
  return `${norm(r.name)}|${r.startDate.getTime()}|${place}`
}

/** Locality per city place id, learned from the events that do carry a full venue. */
export function learnPlaceLocalities(docs: V3Doc[]): Map<string, string> {
  const votes = new Map<string, Map<string, number>>()
  for (const d of docs) {
    const loc = parseVenue(d.venue)?.locality
    if (!loc || typeof d.place !== 'string' || !d.place) continue
    const m = votes.get(d.place) ?? new Map<string, number>()
    m.set(loc, (m.get(loc) ?? 0) + 1)
    votes.set(d.place, m)
  }
  const out = new Map<string, string>()
  for (const [p, m] of votes) out.set(p, [...m.entries()].sort((a, b) => b[1] - a[1])[0]![0])
  return out
}

// ---------------------------------------------------------------------------
// Firestore REST (read-only)
// ---------------------------------------------------------------------------

export type ServiceAccount = { project_id: string; client_email: string; private_key: string; token_uri?: string }

export async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/datastore',
    aud: sa.token_uri ?? 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`
  const sig = createSign('RSA-SHA256').update(unsigned).sign(sa.private_key).toString('base64url')
  const res = await fetch(sa.token_uri ?? 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  })
  if (!res.ok) throw new Error(`Google OAuth failed: ${res.status} ${await res.text()}`)
  return ((await res.json()) as { access_token: string }).access_token
}

/** Firestore REST typed value → plain JS. */
export function decodeValue(v: any): any {
  if (v == null) return null
  if ('nullValue' in v) return null
  if ('stringValue' in v) return v.stringValue
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return Number(v.doubleValue)
  if ('booleanValue' in v) return v.booleanValue
  if ('timestampValue' in v) return new Date(v.timestampValue)
  if ('referenceValue' in v) return v.referenceValue
  if ('geoPointValue' in v) return { lat: v.geoPointValue.latitude, lng: v.geoPointValue.longitude }
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decodeValue)
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, decodeValue(x)]))
  return null
}

/**
 * Every v3 post whose startDate is >= now, whatever type startDate was stored as.
 * Firestore range filters only match values of the same type, so it runs one
 * query per type (number, ISO string, Timestamp) and unions the results.
 */
export async function fetchUpcomingV3Posts(sa: ServiceAccount, now = Date.now()): Promise<V3Doc[]> {
  const token = await accessToken(sa)
  const endpoint = `https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents:runQuery`
  const iso = new Date(now).toISOString()
  const bounds = [{ integerValue: String(now) }, { stringValue: iso }, { timestampValue: iso }]
  const byId = new Map<string, V3Doc>()
  for (const value of bounds) {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'posts' }],
          where: { fieldFilter: { field: { fieldPath: 'startDate' }, op: 'GREATER_THAN_OR_EQUAL', value } },
        },
      }),
    })
    if (!res.ok) throw new Error(`Firestore runQuery failed: ${res.status} ${await res.text()}`)
    const rows = (await res.json()) as { document?: { name: string; fields?: Record<string, any> } }[]
    for (const r of rows) {
      if (!r.document) continue
      const id = r.document.name.split('/').pop()!
      // Some v3 docs carry their own (often empty) `id` field — the document name wins.
      byId.set(id, { ...Object.fromEntries(Object.entries(r.document.fields ?? {}).map(([k, x]) => [k, decodeValue(x)])), id })
    }
  }
  return [...byId.values()]
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

export type SyncSummary = {
  mode: 'dry-run' | 'write'
  fetched: number
  eligible: number
  created: number
  updated: number
  unchanged: number
  archived: number
  skipped: Record<string, number>
  byCity: Record<string, number>
  unmappedStyles: Record<string, number>
  schemaReady: boolean
}

// Columns compared to decide created / updated / unchanged.
const COMPARE: (keyof MappedEvent)[] = ['name', 'type', 'description', 'cover', 'startDate', 'endDate', 'isFestival', 'price', 'city', 'citySlug', 'country', 'timezone', 'venueName', 'venueAddress', 'venueLat', 'venueLng', 'organizerUsername', 'organizerName', 'venueUsername', 'artists', 'link', 'seriesId', 'styles']
const same = (a: unknown, b: unknown) =>
  a instanceof Date || b instanceof Date
    ? new Date(a as any).getTime() === new Date(b as any).getTime()
    : JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/**
 * Which mapped v3 events the sync may write, given the rows already in the DB.
 *  - archived by a person (editedAt set) → never brought back ('dismissed');
 *  - archived by a person "with every future date" (sourceRef.dismissed = 'series')
 *    → the series' new dates are kept out too ('dismissed-series');
 *  - two v3 posts for the same night → one row ('duplicate'), preferring the one
 *    already in the DB so its id and edits stay.
 * Rows the sync archived itself (gone from v3, editedAt null) may come back.
 */
export function selectRows(mapped: MappedEvent[], existing: any[]): { rows: MappedEvent[]; skipped: string[] } {
  const dismissedIds = new Set<string>()
  const dismissedSeries = new Set<string>()
  for (const e of existing) {
    if (!e.archived || !e.editedAt) continue
    dismissedIds.add(e.sourceId)
    const key = e.sourceRef?.dismissed === 'series' ? seriesKey(e.sourceId, e.seriesId) : null
    if (key) dismissedSeries.add(key)
  }
  const inDb = new Set(existing.map((e: any) => e.sourceId))
  const skipped: string[] = []
  const candidates: MappedEvent[] = []
  for (const r of mapped) {
    if (dismissedIds.has(r.sourceId)) { skipped.push('dismissed'); continue }
    const key = seriesKey(r.sourceId, r.seriesId)
    if (key && dismissedSeries.has(key)) { skipped.push('dismissed-series'); continue }
    candidates.push(r)
  }
  // Already-synced rows first, then by id, so the same post wins on every run.
  candidates.sort((a, b) => Number(inDb.has(b.sourceId)) - Number(inDb.has(a.sourceId)) || a.sourceId.localeCompare(b.sourceId))
  const seen = new Set<string>()
  const rows: MappedEvent[] = []
  for (const r of candidates) {
    const k = dedupeKey(r)
    if (seen.has(k)) { skipped.push('duplicate'); continue }
    seen.add(k)
    rows.push(r)
  }
  return { rows, skipped }
}

/** Applies migration 0021 (idempotent). */
export async function ensureEventsSchema(db: any, migrationSql: string) {
  for (const stmt of migrationSql.split(';').map(s => s.replace(/^\s*--.*$/gm, '').trim()).filter(Boolean)) {
    await db.execute(sql.raw(stmt))
  }
}

export async function syncV3Events(opts: {
  db: any
  docs: V3Doc[]
  write: boolean
  now?: number
  log?: (s: string) => void
  /** Per-event venue/organiser/artist handles from syncV3Profiles. */
  links?: Map<string, EventLinks>
  /** Profiles the profile sync creates in this run (username → name) — known before they exist in a dry-run. */
  extraProfiles?: Map<string, string>
}): Promise<SyncSummary> {
  const { db, docs, write } = opts
  const now = opts.now ?? Date.now()
  const log = opts.log ?? (() => {})

  const profileRows = await db.select({ city: profiles.city, citySlug: profiles.citySlug, username: profiles.username, name: profiles.name }).from(profiles)
  const cityIndex = buildCityIndex(profileRows)
  const knownProfiles = new Map<string, string>(profileRows.map((r: any) => [String(r.username).toLowerCase(), r.name]))
  for (const [u, n] of opts.extraProfiles ?? []) if (!knownProfiles.has(u)) knownProfiles.set(u, n)
  const placeLocality = learnPlaceLocalities(docs)

  const summary: SyncSummary = { mode: write ? 'write' : 'dry-run', fetched: docs.length, eligible: 0, created: 0, updated: 0, unchanged: 0, archived: 0, skipped: {}, byCity: {}, unmappedStyles: {}, schemaReady: true }
  const skip = (reason: string) => { summary.skipped[reason] = (summary.skipped[reason] ?? 0) + 1 }
  const mapped: { row: MappedEvent; unmappedStyles: string[] }[] = []
  for (const d of docs) {
    const r = mapV3Event(d, { now, cityIndex, placeLocality, knownProfiles, links: opts.links })
    if (!r.ok) { skip(r.reason); continue }
    mapped.push({ row: r.row, unmappedStyles: r.unmappedStyles })
  }

  // Existing synced rows (tolerate a DB that hasn't had migration 0021 yet — dry-run only).
  let existing: any[] = []
  try {
    existing = await db.select().from(events).where(eq(events.source, V3_SOURCE))
  } catch (e: any) {
    if (write) throw e
    summary.schemaReady = false
    try {
      // Pre-0022 DB (no events.artists yet): diff against everything else.
      const { artists: _a, ...cols } = getTableColumns(events)
      existing = (await db.select(cols).from(events).where(eq(events.source, V3_SOURCE))).map((r: any) => ({ ...r, artists: [] }))
      log(`  (events table lacks migration 0022 — artists links count as updates)`)
    } catch {
      log(`  (events table lacks the 0021 columns — counting every row as "created")`)
    }
  }
  const bySource = new Map(existing.map((r: any) => [r.sourceId, r]))
  const syncedAt = new Date(now)

  const { rows, skipped } = selectRows(mapped.map(m => m.row), existing)
  for (const reason of skipped) skip(reason)
  const kept = new Set(rows)
  for (const m of mapped) {
    if (!kept.has(m.row)) continue
    summary.byCity[m.row.citySlug!] = (summary.byCity[m.row.citySlug!] ?? 0) + 1
    for (const u of m.unmappedStyles) summary.unmappedStyles[u] = (summary.unmappedStyles[u] ?? 0) + 1
  }
  summary.eligible = rows.length

  const toWrite: MappedEvent[] = []
  for (const r of rows) {
    const ex: any = bySource.get(r.sourceId)
    if (!ex) { summary.created++; toWrite.push(r); continue }
    const changed = ex.archived || !ex.published || COMPARE.some(k => !same(ex[k], r[k]))
    if (changed) { summary.updated++; toWrite.push(r) } else summary.unchanged++
  }

  // Still-upcoming rows that v3 no longer lists (deleted / unlisted / moved) → archive.
  const liveIds = new Set(rows.map(r => r.sourceId))
  const gone = existing.filter((r: any) => !r.archived && !liveIds.has(r.sourceId) && r.startDate && new Date(r.startDate).getTime() >= now)
  summary.archived = gone.length

  if (!write) return summary

  const CHUNK = 100
  for (let i = 0; i < toWrite.length; i += CHUNK) {
    const values = toWrite.slice(i, i + CHUNK).map(r => ({
      ...r,
      source: V3_SOURCE,
      sourceRef: { source: V3_SOURCE, v3PostId: r.sourceId },
      ticketUrl: null,
      archived: false,
      published: true,
      syncedAt,
      updatedAt: syncedAt,
    }))
    await db.insert(events).values(values).onConflictDoUpdate({
      target: [events.source, events.sourceId],
      targetWhere: isNotNull(events.sourceId),
      set: Object.fromEntries(
        [...COMPARE, 'archived', 'published', 'syncedAt', 'updatedAt', 'sourceRef'].map(k => {
          const col = (events as any)[k]
          return [k, sql.raw(`excluded."${col.name}"`)]
        }),
      ),
      // Someone checked and edited it on WeDance: their version wins over v3's.
      setWhere: isNull(events.editedAt),
    })
    log(`  …upserted ${Math.min(i + CHUNK, toWrite.length)}/${toWrite.length}`)
  }
  if (gone.length) {
    await db.update(events)
      .set({ archived: true, syncedAt, updatedAt: syncedAt })
      // An edited event is its organizer's now: gone from v3 doesn't archive it.
      .where(and(eq(events.source, V3_SOURCE), inArray(events.sourceId, gone.map((r: any) => r.sourceId)), gte(events.startDate, syncedAt), isNull(events.editedAt)))
  }
  // Touch unchanged rows' syncedAt so "last seen in v3" stays truthful.
  const unchangedIds = rows.filter(r => !toWrite.includes(r)).map(r => r.sourceId)
  for (let i = 0; i < unchangedIds.length; i += 500) {
    await db.update(events).set({ syncedAt }).where(and(eq(events.source, V3_SOURCE), inArray(events.sourceId, unchangedIds.slice(i, i + 500))))
  }
  return summary
}
