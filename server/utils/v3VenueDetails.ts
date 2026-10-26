/**
 * v3 venue details → 2026 venue profiles (scripts/sync-v3-venue-details.ts).
 *
 * From each v3 venue's Google listing (saved when the venue was picked in v3):
 * address, Google Maps link, coordinates, website and the business phone; from
 * its own fields: kind of place and amenities (onto 2026's fixed lists).
 *
 * Rules: fills EMPTY fields only; never touches a page that's claimed or that
 * someone runs on WeDance; never copies v3's own `phone` / `email` fields
 * (typed in by people, may be personal) — the phone comes only from the Google
 * listing, and goes to the booking contacts only signed-in organizers see.
 */
import { VENUE_AMENITIES, VENUE_TYPES } from '../../shared/types/venueDetails'

export type LocalVenue = {
  id: string
  username: string
  sourceRef: Record<string, any> | null
  address: string | null
  mapUrl: string | null
  lat: number | null
  lng: number | null
  socials: { platform: string; url: string }[] | null
  contact: Record<string, string> | null
  venueType: string | null
  amenities: string[] | null
  claimed: boolean | null
  managed: boolean
}

export type VenuePlan = { id: string; username: string; set: Record<string, unknown>; before: Record<string, unknown>; fields: string[] }

// v3 amenity values (it grew a long free list) → 2026's.
const AMENITY_ALIAS: Record<string, string> = { Speakers: 'SoundSystem' }
const OURS = new Set<string>(VENUE_AMENITIES.map(a => a.value))
const TYPES = new Set<string>(VENUE_TYPES.map(t => t.value))
export function mapAmenities(v3: unknown): string[] {
  const out = new Set<string>()
  for (const a of Array.isArray(v3) ? v3 : []) {
    const v = AMENITY_ALIAS[String(a)] ?? String(a)
    if (OURS.has(v)) out.add(v)
  }
  return [...out]
}

const isMapsLink = (u: string | null | undefined) => !!u && /(maps\.google\.|google\.[a-z.]+\/maps|goo\.gl\/maps)/i.test(u)
const empty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v as object).length)

/** Which 2026 venue a v3 venue is: its v3 id (v4 import), its Google place id (handle or sync id), its handle. */
export function matchVenue(v3: any, local: LocalVenue[]) {
  const pid: string | undefined = v3.address?.place_id
  const byFid = local.find(r => r.sourceRef?.firebaseId === v3.id)
  if (byFid) return byFid
  if (pid) {
    const hit = local.find(r => r.username.toLowerCase() === pid.toLowerCase() || r.sourceRef?.sourceId === `place:${pid}` || r.sourceRef?.placeId === pid
      || ((r.sourceRef?.oldHandles ?? []) as string[]).includes(pid))
    if (hit) return hit
  }
  return local.find(r => r.username.toLowerCase() === String(v3.username ?? '').toLowerCase()) ?? null
}

export function planVenueDetails(v3Venues: any[], local: LocalVenue[]): { plans: VenuePlan[]; unmatched: number; skippedOwned: number } {
  const plans: VenuePlan[] = []
  let unmatched = 0
  let skippedOwned = 0
  const seen = new Set<string>()
  for (const v of v3Venues) {
    let r = matchVenue(v, local)
    if (!r) { unmatched++; continue }
    // A merged copy fills the venue it merged into.
    for (let i = 0; i < 5 && r?.sourceRef?.mergedInto; i++) r = local.find(x => x.username === r!.sourceRef!.mergedInto) ?? r
    if (!r) continue
    if (seen.has(r.id)) continue
    seen.add(r.id)
    if (r.claimed || r.managed) { skippedOwned++; continue }
    const g = v.address && typeof v.address === 'object' ? v.address : {}
    const set: Record<string, unknown> = {}
    const before: Record<string, unknown> = {}
    const fields: string[] = []
    const put = (col: string, value: unknown, label: string, was: unknown) => { set[col] = value; before[col] = was; fields.push(label) }
    if (empty(r.address) && g.formatted_address) put('address', String(g.formatted_address), 'address', r.address)
    // map_url may already be a floor-plan image: only fill when empty.
    if (empty(r.mapUrl) && isMapsLink(g.url)) put('mapUrl', String(g.url), 'maps link', r.mapUrl)
    const loc = g.geometry?.location
    const lat = typeof loc?.lat === 'number' ? loc.lat : Number(loc?.lat)
    const lng = typeof loc?.lng === 'number' ? loc.lng : Number(loc?.lng)
    if (r.lat == null && Number.isFinite(lat) && Number.isFinite(lng)) { put('lat', lat, 'coordinates', r.lat); set.lng = lng; before.lng = r.lng }
    const website = String(v.website || g.website || '').trim()
    if (website && /^https?:\/\//.test(website) && !(r.socials ?? []).some(s => s.platform === 'website')) {
      put('socials', [...(r.socials ?? []), { platform: 'website', url: website }], 'website', r.socials)
    }
    const phone = String(g.international_phone_number || '').trim()
    if (phone && !r.contact?.phone) put('contact', { ...r.contact, phone }, 'business phone', r.contact)
    if (empty(r.venueType) && TYPES.has(String(v.venueType))) put('venueType', String(v.venueType), 'kind of place', r.venueType)
    const am = mapAmenities(v.amenities)
    if (empty(r.amenities) && am.length) put('amenities', am, 'amenities', r.amenities)
    if (fields.length) plans.push({ id: r.id, username: r.username, set, before, fields })
  }
  return { plans, unmatched, skippedOwned }
}
