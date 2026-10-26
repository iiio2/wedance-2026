/**
 * wedance.vip (v3) → 2026 `profiles`: the venues, organisers and artists behind
 * the synced events, so the city page's "Who's on the floor" tabs and the
 * /@handle pages have real people attached to real dates.
 *
 * READ-ONLY against v3 (Firestore `:runQuery` only). Runs inside
 * scripts/sync-v3-events.ts before the event upsert and hands it the
 * per-event links (venue / organiser / artist handles).
 *
 * Matching, in order (first hit wins — never creates a duplicate):
 *   organiser / artist: v3 profile id (= 2026 source_ref.firebaseId from the v4
 *     migration, or source_ref.sourceId from this sync) → handle → name + city
 *   venue: Google place id (= v4-era venue handle) → name + city → street
 *     address + city → a venue created earlier in this run within 75 m
 *
 * Ownership: a 2026 profile that is `claimed`, or that this sync didn't create,
 * is never overwritten — at most its EMPTY photo / bio / city / styles / socials
 * / address are filled, and only while unclaimed. Profiles this sync created
 * (source_ref.source = 'wedance-v3') are kept in step with v3 until claimed.
 *
 * Privacy: only fields v3 shows publicly — name, handle, photo, bio, public
 * social links, city, styles, venue address. Never email / phone / WhatsApp /
 * gender / birthday / login data. v3 profiles that aren't `visibility: Public`
 * are not copied; an organiser/artist referenced by a public event is then built
 * only from the snapshot v3 embeds in that public event. Synced profiles are
 * unclaimed and not tied to any login (claimable via the normal claim flow).
 */
import { and, eq, sql } from 'drizzle-orm'
import { dancers, profiles } from '../database/schema'
import {
  accessToken, buildCityIndex, citySlugify, decodeValue, learnPlaceLocalities, mapStyles, mapV3Event, normName, parseVenue, resolveCity, V3_SOURCE,
  type CityIndex, type EventLinks, type ServiceAccount, type V3Doc,
} from './v3EventSync'

type PType = 'venue' | 'organizer' | 'artist'
const BOT = 'wedance-bot'

// ---------------------------------------------------------------------------
// v3 fetch
// ---------------------------------------------------------------------------

export type V3Profile = Record<string, any> & { id: string }

/** All v3 profiles of the public-facing types (+ City, for place-id → city name). */
export async function fetchV3Profiles(sa: ServiceAccount): Promise<V3Profile[]> {
  const token = await accessToken(sa)
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${sa.project_id}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'profiles' }],
        where: { fieldFilter: { field: { fieldPath: 'type' }, op: 'IN', value: { arrayValue: { values: ['Venue', 'Organiser', 'FanPage', 'Artist', 'City'].map(stringValue => ({ stringValue })) } } } },
      },
    }),
  })
  if (!res.ok) throw new Error(`Firestore runQuery(profiles) failed: ${res.status} ${await res.text()}`)
  const rows = (await res.json()) as { document?: { name: string; fields?: Record<string, any> } }[]
  return rows.filter(r => r.document).map(r => ({
    ...Object.fromEntries(Object.entries(r.document!.fields ?? {}).map(([k, x]) => [k, decodeValue(x)])),
    id: r.document!.name.split('/').pop()!,
  }))
}

// ---------------------------------------------------------------------------
// Field normalisers (public fields only)
// ---------------------------------------------------------------------------

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
const httpUrl = (v: unknown) => { const s = str(v); return s && /^https?:\/\/\S+$/i.test(s.replace(/\s+$/, '')) ? s : null }

const SOCIAL_BASE: Record<string, string> = {
  instagram: 'https://instagram.com/', facebook: 'https://facebook.com/', youtube: 'https://youtube.com/',
  tiktok: 'https://tiktok.com/@', twitter: 'https://twitter.com/', spotify: '', website: '',
}

/** Public social links → 2026 `socials` [{ platform, url }]. Handles become URLs; junk is dropped. */
export function toSocials(p: Record<string, any>): { platform: string; url: string }[] {
  const out: { platform: string; url: string }[] = []
  for (const [platform, base] of Object.entries(SOCIAL_BASE)) {
    const raw = str(p[platform])
    if (!raw) continue
    let url = /^https?:\/\//i.test(raw) ? raw : (base && /^@?[\w.-]{2,60}$/.test(raw) ? base + raw.replace(/^@/, '') : null)
    if (!url) continue
    url = url.replace(/\s+/g, '')
    if (/^https?:\/\/(www\.)?(instagram|facebook|youtube|tiktok|twitter)\.com\/@?$/i.test(url)) continue // empty handle
    if (!out.some(s => s.platform === platform)) out.push({ platform, url })
  }
  return out
}

/** "Arnulfstraße 195, 80634 München, Germany" → "arnulfstrasse 195" (street + number, for matching). */
export function addressKey(address: string | null | undefined): string | null {
  if (!address) return null
  // First comma part that looks like "street number" (skips a leading venue name and "80634 München").
  for (const part of address.split(',').map(p => p.trim())) {
    if (/^(?:[A-Z]{1,2}-)?\d{3,5}(\s|$)/.test(part)) continue
    const k = normName(part.replace(/\([^)]*\)/g, ' ').replace(/ß/g, 'ss').replace(/str\.?(\s|$)/gi, 'strasse$1'))
      .replace(/(\D)\s+strasse/g, '$1strasse')
    if (/[a-z]/.test(k) && /\d/.test(k) && k.length >= 5) return k
  }
  return null
}

/** A venue "name" that is really just its street address (Google geocode results, bot seeds). */
export function isAddressName(name: string | null, address: string | null): boolean {
  if (!name) return true
  const k = addressKey(name)
  return !!k && (k === addressKey(address) || /^\D+\s\d+\w?$/.test(k))
}

const metres = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const R = 6371000, toR = Math.PI / 180
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const venueKey = (v: { placeId: string | null; address: string | null; name: string | null }, citySlug: string) =>
  `venue|${v.placeId ?? ''}|${addressKey(v.address) ?? normName(v.name ?? '')}|${citySlug}`

const handleSlug = (s: string) => citySlugify(s).slice(0, 40).replace(/-+$/, '') || 'venue'

// ---------------------------------------------------------------------------
// Plan
// ---------------------------------------------------------------------------

export type ExistingProfile = {
  id: string; username: string; type: string; name: string; city: string | null; citySlug: string | null
  photo: string | null; bio: string | null; styles: string[] | null; address: string | null
  socials: { platform: string; url: string }[] | null; claimed: boolean | null; sourceRef: Record<string, any> | null
}

export type ProfileFields = {
  username: string; type: PType; name: string; city: string | null; citySlug: string | null
  photo: string | null; bio: string | null; styles: string[]; address: string | null
  socials: { platform: string; url: string }[]; sourceRef: Record<string, unknown>
}

export type ProfileOp =
  | { op: 'create'; fields: ProfileFields }
  | { op: 'update'; id: string; username: string; fields: Partial<ProfileFields> } // our own unclaimed row
  | { op: 'fill'; id: string; username: string; fields: Partial<ProfileFields> } // someone else's unclaimed row, empty fields only

export type MatchHow = 'v3-id' | 'handle' | 'name+city' | 'name-contains+city' | 'organiser-is-venue' | 'place-id' | 'address+city' | 'geo-75m' | 'created' | 'created-from-address'

export type ProfilePlan = {
  ops: ProfileOp[]
  links: Map<string, EventLinks>
  newProfiles: Map<string, string> // username → name, for the event mapper
  stats: Record<PType, { linkedEvents: number; profiles: number; matched: number; created: number; filled: number; updated: number; skippedPrivate: number }>
  how: Record<PType, Partial<Record<MatchHow, number>>>
  venueNoLink: number
  createdFromAddress: string[]
}

export function planProfiles(input: {
  events: V3Doc[] // the upcoming v3 event docs (same fetch as the event sync)
  eligibleIds: Set<string> // event ids the event sync will keep
  v3Profiles: V3Profile[]
  existing: ExistingProfile[]
  takenHandles: Set<string> // lowercased handles already used by dancers (the /@ namespace is shared)
  cityIndex: CityIndex
  placeLocality: Map<string, string>
}): ProfilePlan {
  const { cityIndex } = input
  const plan: ProfilePlan = {
    ops: [], links: new Map(), newProfiles: new Map(),
    stats: { venue: z(), organizer: z(), artist: z() }, how: { venue: {}, organizer: {}, artist: {} },
    venueNoLink: 0, createdFromAddress: [],
  }
  function z() { return { linkedEvents: 0, profiles: 0, matched: 0, created: 0, filled: 0, updated: 0, skippedPrivate: 0 } }

  // --- indexes over existing 2026 profiles -------------------------------
  const byId = new Map<string, ExistingProfile>() // v3 profile id → row
  const byHandle = new Map<string, ExistingProfile>()
  const byNameCity = new Map<string, ExistingProfile>()
  const venueByAddr = new Map<string, ExistingProfile>()
  const taken = new Set<string>(input.takenHandles)
  const venuesInCity = new Map<string, ExistingProfile[]>()
  const geoVenues: { username: string; name: string; citySlug: string | null; lat: number; lng: number; addrKey: string | null }[] = []
  const put = (m: Map<string, ExistingProfile>, k: string | null, r: ExistingProfile) => { if (k && !m.has(k)) m.set(k, r) }
  const nameKey = (t: string, name: string | null | undefined, city: string | null | undefined) => (name && city ? `${t === 'venue' ? 'v' : 'p'}|${normName(name)}|${city}` : null)
  // Claimed rows win every index (they are the real owner's identity).
  // Deterministic precedence (so re-runs pick the same twin): claimed first, then a
  // real handle over a bare Google place id, then alphabetical.
  const isPlaceHandle = (u: string) => /^(ChIJ|Ei|Gh)[\w-]{15,}$/.test(u)
  const rank = (r: ExistingProfile) => `${r.claimed ? 0 : 1}${isPlaceHandle(r.username) ? 1 : 0}${r.username.toLowerCase()}`
  // A copy merged into another (scripts/merge-duplicate-profiles.ts) answers
  // for the one it merged into: its keys find that one, never the hidden copy.
  const byUsername = new Map(input.existing.map(r => [r.username.toLowerCase(), r]))
  const live = (r: ExistingProfile) => {
    let x = r
    for (let i = 0; i < 5 && x.sourceRef?.mergedInto; i++) x = byUsername.get(String(x.sourceRef.mergedInto).toLowerCase()) ?? x
    return x
  }
  for (const raw of [...input.existing].sort((a, b) => rank(a).localeCompare(rank(b)))) {
    const r = live(raw)
    const ref = raw.sourceRef ?? {}
    put(byId, (ref.sourceId as string) ?? (ref.firebaseId as string) ?? null, r)
    put(byHandle, raw.username.toLowerCase(), r)
    // Renamed to a readable handle (scripts/readable-handles.ts): the old handle
    // and the Google place id still find it.
    for (const old of (ref.oldHandles ?? []) as string[]) put(byHandle, String(old).toLowerCase(), r)
    if (ref.placeId) put(byHandle, String(ref.placeId).toLowerCase(), r)
    put(byNameCity, nameKey(raw.type, raw.name, raw.citySlug), r)
    if (r.type === 'venue') {
      put(venueByAddr, addressKey(raw.address) ? `${addressKey(raw.address)}|${raw.citySlug}` : null, r)
      if (r.citySlug) { const l = venuesInCity.get(r.citySlug) ?? []; l.push(r); venuesInCity.set(r.citySlug, l) }
      // Venues an earlier run created keep their coordinates in source_ref → geo dedupe across runs.
      const lat = Number(ref.lat), lng = Number(ref.lng)
      if (ref.source === V3_SOURCE && ref.lat != null && Number.isFinite(lat) && Number.isFinite(lng)) {
        geoVenues.push({ username: r.username, name: r.name, citySlug: r.citySlug, lat, lng, addrKey: addressKey(r.address) })
      }
    }
    taken.add(raw.username.toLowerCase())
    for (const old of (ref.oldHandles ?? []) as string[]) taken.add(String(old).toLowerCase())
  }
  const v3ById = new Map(input.v3Profiles.map(p => [p.id, p]))
  const v3ByHandle = new Map<string, V3Profile>()
  for (const p of input.v3Profiles) if (typeof p.username === 'string' && p.username) {
    const k = p.username.toLowerCase(); const cur = v3ByHandle.get(k)
    if (!cur || (cur.visibility !== 'Public' && p.visibility === 'Public')) v3ByHandle.set(k, p)
  }
  const cityName = new Map<string, string>() // v3 city place id → name
  for (const p of input.v3Profiles) if (p.type === 'City' && typeof p.place === 'string' && str(p.name)) cityName.set(p.place, p.name)
  const cityOfPlace = (place: unknown) => {
    if (typeof place !== 'string' || !place) return null
    return resolveCity(input.placeLocality.get(place) ?? cityName.get(place) ?? null, cityIndex)
  }

  // Profiles touched in this run (by key) so repeated references reuse one decision.
  const decided = new Map<string, string>() // key → username
  const reconciled = new Set<string>()
  // Uniqueness is checked case-insensitively; case is kept (Google place ids are case-sensitive).
  const pick = (base: string) => {
    let h = base; let i = 2
    while (taken.has(h.toLowerCase())) h = `${base}-${i++}`
    taken.add(h.toLowerCase()); return h
  }

  /** Keep our own rows in step; fill blanks on others' unclaimed rows; never touch claimed. */
  function reconcile(row: ExistingProfile, t: PType, f: Omit<ProfileFields, 'username' | 'type' | 'sourceRef'>) {
    if (row.claimed || !row.id || reconciled.has(row.id)) return // claimed, created in this run, or already handled
    reconciled.add(row.id)
    const ours = row.sourceRef?.source === V3_SOURCE
    const empty = (v: any) => v == null || v === '' || (Array.isArray(v) && v.length === 0)
    const patch: Partial<ProfileFields> = {}
    for (const k of ['name', 'city', 'citySlug', 'photo', 'bio', 'styles', 'address', 'socials'] as const) {
      const next = (f as any)[k]
      if (empty(next)) continue
      // A venue's events quote its address in several spellings — keep the first one, don't flip-flop.
      const sticky = t === 'venue' && (k === 'address' || k === 'name')
      if (ours && !sticky ? JSON.stringify((row as any)[k] ?? null) !== JSON.stringify(next) : (k !== 'name' && empty((row as any)[k]))) (patch as any)[k] = next
    }
    if (!Object.keys(patch).length) return
    if (ours) { plan.ops.push({ op: 'update', id: row.id, username: row.username, fields: patch }); plan.stats[t].updated++ }
    else { plan.ops.push({ op: 'fill', id: row.id, username: row.username, fields: patch }); plan.stats[t].filled++ }
  }

  /** Organiser / artist from a v3 reference (embedded snapshot + optional profile doc). */
  function resolvePerson(t: PType, ref: { id?: string | null; username?: string | null; name?: string | null; photo?: string | null; bio?: string | null; [k: string]: any }, fallbackCity: { slug: string; name: string } | null): string | null {
    const handle = str(ref.username)?.toLowerCase() ?? null
    if (handle === BOT) return null
    const key = `${t}|${ref.id ?? ''}|${handle ?? ''}`
    if (decided.has(key)) return decided.get(key)!
    const doc = (ref.id && v3ById.get(ref.id)) || (handle && v3ByHandle.get(handle)) || null
    const v3id = doc?.id ?? ref.id ?? null
    const isPublic = doc ? doc.visibility === 'Public' : true // no doc → only the public event snapshot exists
    const src = doc && isPublic ? doc : ref
    const city = cityOfPlace(doc?.place) ?? fallbackCity
    const name = str(src.name) ?? str(ref.name) ?? str(ref.username)
    const fields = {
      name: name ?? '', city: city?.name ?? null, citySlug: city?.slug ?? null,
      photo: httpUrl(src.photo), bio: str(src.bio)?.slice(0, 2000) ?? null,
      styles: mapStyles(src.styles).styles, address: null, socials: toSocials(src),
    }
    let row = (v3id && byId.get(v3id)) || (handle && byHandle.get(handle)) || byNameCity.get(nameKey(t, name, city?.slug) ?? '') || null
    let how: MatchHow
    if (row) {
      how = v3id && byId.get(v3id) === row ? 'v3-id' : handle && byHandle.get(handle) === row ? 'handle' : 'name+city'
      plan.stats[t].matched++
      if (isPublic) reconcile(row, t, fields)
      decided.set(key, row.username)
    } else {
      if (!name || !handle) return null
      if (doc && !isPublic && !ref.name) { plan.stats[t].skippedPrivate++; return null }
      how = 'created'
      const username = pick(handle)
      const f: ProfileFields = { username, type: t, ...fields, sourceRef: { source: V3_SOURCE, sourceId: v3id ?? `handle:${handle}`, v3Type: doc?.type ?? (t === 'artist' ? 'Artist' : 'Organiser'), v3Username: ref.username } }
      plan.ops.push({ op: 'create', fields: f }); plan.stats[t].created++
      plan.newProfiles.set(username, f.name)
      const fake = { id: '', ...f, claimed: false } as unknown as ExistingProfile
      put(byHandle, username, fake); if (v3id) put(byId, v3id, fake); put(byNameCity, nameKey(t, f.name, f.citySlug), fake)
      decided.set(key, username)
    }
    plan.how[t][how] = (plan.how[t][how] ?? 0) + 1
    plan.stats[t].profiles++
    return decided.get(key)!
  }

  function resolveVenue(ev: V3Doc, city: { slug: string; name: string } | null, organiser: string | null): string | null {
    const v = parseVenue(ev.venue)
    if (!v || !city) return null
    const aKey = addressKey(v.address)
    const key = venueKey(v, city.slug)
    if (decided.has(key)) return decided.get(key)!
    const addrLike = isAddressName(v.name, v.address)
    let row: ExistingProfile | null = null; let how: MatchHow | null = null
    if (v.placeId && byHandle.get(v.placeId.toLowerCase())) { row = byHandle.get(v.placeId.toLowerCase())!; how = 'place-id' }
    else if (!addrLike && byNameCity.get(nameKey('venue', v.name, city.slug) ?? '')) { row = byNameCity.get(nameKey('venue', v.name, city.slug)!)!; how = 'name+city' }
    else if (aKey && venueByAddr.get(`${aKey}|${city.slug}`)) { row = venueByAddr.get(`${aKey}|${city.slug}`)!; how = 'address+city' }
    else if (!addrLike) {
      // "Dianatempel, Hofgarten" ↔ "Dianatempel"; "Alte Paketposthalle – Pineapple Park" ↔ "Paketposthalle".
      const n = normName(v.name!)
      const hit = (venuesInCity.get(city.slug) ?? [])
        .map(r => ({ r, k: normName(r.name) }))
        .filter(({ k }) => k.length >= 10 && (n.includes(k) || (n.length >= 10 && k.includes(n))))
        .sort((a, b) => b.k.length - a.k.length)[0]
      if (hit) { row = hit.r; how = 'name-contains+city' }
    }
    if (!row && !addrLike && organiser) {
      // A school that hosts its own classes: the venue IS the organiser's profile
      // ("Mike Dance Tanzschule" ↔ organiser "Mike Dance Tanzschule München").
      const o = byHandle.get(organiser.toLowerCase())
      const a = normName(v.name!), b = o ? normName(o.name) : ''
      if (o && b.length >= 8 && a.length >= 8 && (a.includes(b) || b.includes(a))) { row = o; how = 'organiser-is-venue' }
    }
    if (!row && v.lat != null && v.lng != null) {
      const near = geoVenues.find(c => c.citySlug === city.slug && metres(c, { lat: v.lat!, lng: v.lng! }) <= 75
        && (c.addrKey === aKey || normName(c.name) === normName(v.name ?? '') || addrLike))
      if (near) { decided.set(key, near.username); bump('geo-75m'); return near.username }
    }
    if (row) {
      bump(how!)
      plan.stats.venue.matched++; plan.stats.venue.profiles++
      reconcile(row, 'venue', { name: v.name ?? '', city: city.name, citySlug: city.slug, photo: null, bio: null, styles: [], address: v.address, socials: [] })
      decided.set(key, row.username)
      return row.username
    }
    // Create with a readable handle (the venue's name, else name + city); the
    // Google place id is kept in source_ref.placeId for matching.
    const name = addrLike ? (v.address?.split(',')[0]?.trim() || v.name || 'Venue') : v.name!
    const username = pick(taken.has(handleSlug(name)) ? `${handleSlug(name)}-${city.slug}` : handleSlug(name))
    const f = {
      username, type: 'venue' as const, name, city: city.name, citySlug: city.slug, photo: null, bio: null, styles: [],
      address: v.address, socials: [] as any[],
      sourceRef: { source: V3_SOURCE, sourceId: v.placeId ? `place:${v.placeId}` : `venue:${aKey ?? normName(name)}|${city.slug}`, v3Venue: true, lat: v.lat, lng: v.lng, ...(v.placeId ? { placeId: v.placeId } : {}) },
    }
    plan.ops.push({ op: 'create', fields: f }); plan.stats.venue.created++; plan.stats.venue.profiles++
    plan.newProfiles.set(username, name)
    if (addrLike) { plan.createdFromAddress.push(`${name} (${city.name})`); bump('created-from-address') } else bump('created')
    if (v.lat != null && v.lng != null) geoVenues.push({ username, name, citySlug: city.slug, lat: v.lat, lng: v.lng, addrKey: aKey })
    const fake = { id: '', ...f, claimed: false } as unknown as ExistingProfile
    put(byHandle, username, fake); if (!addrLike) put(byNameCity, nameKey('venue', name, city.slug), fake)
    if (aKey) put(venueByAddr, `${aKey}|${city.slug}`, fake)
    decided.set(key, username)
    return username
    function bump(h: MatchHow) { plan.how.venue[h] = (plan.how.venue[h] ?? 0) + 1 }
  }

  // --- walk the events ---------------------------------------------------
  // Pass 1: organisers, and which organiser most often runs each venue — so the
  // "school hosts its own classes" match doesn't depend on event order.
  const evCtx = new Map<string, { city: { slug: string; name: string } | null; organizerUsername: string | null }>()
  const venueOrgVotes = new Map<string, Map<string, number>>()
  for (const ev of input.events) {
    if (!input.eligibleIds.has(ev.id)) continue
    const venue = parseVenue(ev.venue)
    const city = resolveCity(venue?.locality ?? null, cityIndex) ?? cityOfPlace(ev.place)
    let org: any = ev.org
    if (typeof org === 'string') { try { org = JSON.parse(org) } catch { org = { username: org } } }
    const organizerUsername = org && typeof org === 'object' ? resolvePerson('organizer', org, city) : null
    evCtx.set(ev.id, { city, organizerUsername })
    if (venue && city && organizerUsername) {
      const k = venueKey(venue, city.slug); const m = venueOrgVotes.get(k) ?? new Map<string, number>()
      m.set(organizerUsername, (m.get(organizerUsername) ?? 0) + 1); venueOrgVotes.set(k, m)
    }
  }
  const topOrg = (k: string) => [...(venueOrgVotes.get(k) ?? new Map()).entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null
  // Pass 2: venues + artists.
  for (const ev of input.events) {
    if (!input.eligibleIds.has(ev.id)) continue
    const { city, organizerUsername } = evCtx.get(ev.id)!
    const venue = parseVenue(ev.venue)
    const venueUsername = resolveVenue(ev, city, venue && city ? topOrg(venueKey(venue, city.slug)) : null)
    if (!venueUsername) plan.venueNoLink++
    const artists: string[] = []
    const refs: any[] = [...(Array.isArray(ev.artists) ? ev.artists : []), ...(Array.isArray(ev.artistsList) ? ev.artistsList.map((u: any) => ({ username: u })) : [])]
    for (const a of refs) {
      const r = a && typeof a === 'object' ? a : { username: a }
      const h = resolvePerson('artist', r, city)
      if (h && !artists.includes(h)) artists.push(h)
    }
    if (venueUsername) plan.stats.venue.linkedEvents++
    if (organizerUsername) plan.stats.organizer.linkedEvents++
    if (artists.length) plan.stats.artist.linkedEvents++
    plan.links.set(ev.id, { venueUsername, organizerUsername, artists })
  }

  // --- public v3 artists in the synced cities (no event needed) -----------
  const syncedCities = new Set<string>()
  for (const e of input.events) {
    if (!plan.links.has(e.id)) continue
    const slug = (resolveCity(parseVenue(e.venue)?.locality ?? null, cityIndex) ?? cityOfPlace(e.place))?.slug
    if (slug) syncedCities.add(slug)
  }
  for (const p of input.v3Profiles) {
    if (p.type !== 'Artist') continue
    const city = cityOfPlace(p.place)
    if (!city || !syncedCities.has(city.slug)) continue
    if (p.visibility !== 'Public') { plan.stats.artist.skippedPrivate++; continue }
    resolvePerson('artist', { id: p.id, username: p.username, name: p.name }, city)
  }
  return plan
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

export async function loadExistingProfiles(db: any): Promise<{ existing: ExistingProfile[]; takenHandles: Set<string> }> {
  const cols = {
    id: profiles.id, username: profiles.username, type: profiles.type, name: profiles.name, city: profiles.city,
    citySlug: profiles.citySlug, photo: profiles.photo, bio: profiles.bio, styles: profiles.styles, address: profiles.address,
    socials: profiles.socials, claimed: profiles.claimed, sourceRef: profiles.sourceRef,
  }
  const existing: ExistingProfile[] = await db.select(cols).from(profiles)
  const d = await db.select({ u: dancers.username }).from(dancers).where(sql`${dancers.username} IS NOT NULL`)
  return { existing, takenHandles: new Set(d.map((r: any) => String(r.u).toLowerCase())) }
}

export async function applyProfilePlan(db: any, plan: ProfilePlan, log: (s: string) => void = () => {}) {
  const creates = plan.ops.filter(o => o.op === 'create') as Extract<ProfileOp, { op: 'create' }>[]
  for (let i = 0; i < creates.length; i += 100) {
    const values = creates.slice(i, i + 100).map(o => ({ ...o.fields, claimed: false, status: 'visible' as const }))
    // username is unique: a concurrent claim/registration between plan and apply just skips that row.
    await db.insert(profiles).values(values).onConflictDoNothing({ target: profiles.username })
    log(`  …profiles created ${Math.min(i + 100, creates.length)}/${creates.length}`)
  }
  for (const o of plan.ops) {
    if (o.op === 'create') continue
    // Guard in SQL too: never write to a row that got claimed in the meantime.
    await db.update(profiles).set(o.fields as any).where(and(eq(profiles.id, o.id), sql`coalesce(${profiles.claimed}, false) = false`))
  }
}

export type ProfileSummary = {
  v3ProfilesFetched: number
  byType: ProfilePlan['stats']
  how: ProfilePlan['how']
  eventsWithoutVenueLink: number
  venuesCreatedFromAddress: number
  venuesCreatedFromAddressSample: string[]
}

/** Plan (and with write=true apply) the profile side; returns the links for syncV3Events. */
export async function syncV3Profiles(opts: {
  db: any; docs: V3Doc[]; v3Profiles: V3Profile[]; write: boolean; now?: number; log?: (s: string) => void
}): Promise<{ plan: ProfilePlan; summary: ProfileSummary }> {
  const now = opts.now ?? Date.now()
  const { existing, takenHandles } = await loadExistingProfiles(opts.db)
  const cityIndex = buildCityIndex(existing)
  const placeLocality = learnPlaceLocalities(opts.docs)
  const known = new Map(existing.map(r => [r.username.toLowerCase(), r.name]))
  const eligibleIds = new Set(opts.docs.filter(d => mapV3Event(d, { now, cityIndex, placeLocality, knownProfiles: known }).ok).map(d => d.id))
  const plan = planProfiles({ events: opts.docs, eligibleIds, v3Profiles: opts.v3Profiles, existing, takenHandles, cityIndex, placeLocality })
  if (opts.write) await applyProfilePlan(opts.db, plan, opts.log)
  return {
    plan,
    summary: {
      v3ProfilesFetched: opts.v3Profiles.length,
      byType: plan.stats,
      how: plan.how,
      eventsWithoutVenueLink: plan.venueNoLink,
      venuesCreatedFromAddress: plan.createdFromAddress.length,
      venuesCreatedFromAddressSample: plan.createdFromAddress.slice(0, 15),
    },
  }
}
