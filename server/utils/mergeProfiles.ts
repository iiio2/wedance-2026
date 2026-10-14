/**
 * Duplicate profiles (venue / organizer / artist): find them and merge them
 * (scripts/merge-duplicate-profiles.ts).
 *
 * A duplicate group: same type, same name (ignoring case, accents and
 * punctuation), and the same city — or no city on one side. Most come from the
 * v4 import ("bodylanguageng", "bodylanguageng2" … "28") or from the same place
 * saved under a Google id and a handle.
 *
 * Who stays: the copy someone runs on WeDance, then claimed, then the best
 * handle (a real name, a website, "name2", a Google place id), then the one
 * with the most events. A copy merges into it when it's safe to say they're one:
 *   - it's an empty shell (no events, nobody runs it), or
 *   - it's a numbered copy of the same handle ("salon.cubano2"), or
 *   - its handle differs only by punctuation ("dj.lole" / "djlole"), or
 *   - (organizers, artists) the same distinctive name (8+ letters) in the same
 *     city, or
 *   - (venues) it has the same street address, is within 150 m, or has the
 *     same name in the same city with an address on one side only — unless the
 *     name is just a street.
 * Everything else is listed for review, never merged: two copies both run by
 * people, venues with events at different addresses, and names that are just
 * a city ("Budapest").
 *
 * Merging moves every reference to the copy onto the one that stays, fills the
 * one that stays's EMPTY fields from the copy, and hides the copy with
 * `source_ref.mergedInto` (so /@copy forwards, and the v3 sync links to the one
 * that stays). Nothing is deleted.
 */
import { sql } from 'drizzle-orm'

export type DupRow = {
  id: string
  username: string
  type: string
  name: string
  citySlug: string | null
  claimed: boolean | null
  managed: boolean
  events: number
  address: string | null
  lat: number | null
  lng: number | null
  sourceRef: Record<string, any> | null
}
export type MergeVerdict = { row: DupRow; merge: boolean; reason: string }
export type DupGroup = { type: string; key: string; keep: DupRow; others: MergeVerdict[] }

const ACCENTS: Record<string, string> = { á: 'a', à: 'a', â: 'a', ä: 'a', ã: 'a', å: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', í: 'i', ì: 'i', î: 'i', ï: 'i', ó: 'o', ò: 'o', ô: 'o', ö: 'o', õ: 'o', ú: 'u', ù: 'u', û: 'u', ü: 'u', ñ: 'n', ç: 'c', ß: 's' }
export const nameKey = (name: string) => name.toLowerCase().replace(/[^\u0000-\u007f]/g, c => ACCENTS[c] ?? c).replace(/[^a-z0-9]+/g, '')
const isPlaceHandle = (u: string) => /^(ChIJ|Ei|Gh)[\w-]{15,}$/.test(u)
const base = (u: string) => u.toLowerCase().replace(/\d+$/, '')
// "dj.lole" = "djlole" = "dj_lole" (but not a different name).
const plain = (u: string) => u.toLowerCase().replace(/\d+$/, '').replace(/[^a-z0-9]+/g, '')
const STREETY = /(stra(ss|ß)e|strasse|str\.|platz|gasse|weg\b|street|road|avenue|\bcalle\b|\d)/i
const fold = (a: string) => a.toLowerCase().replace(/[^\u0000-\u007f]/g, c => ACCENTS[c] ?? c)
const addrKey = (a: string | null) => a ? fold(a).replace(/,?\s*(germany|deutschland|austria|osterreich)\s*$/, '').replace(/[^a-z0-9]+/g, '') : null
/** Street and number ("sonnenstr7") and postcode, as written in different ways. */
function addrParts(a: string | null) {
  if (!a) return null
  const f = fold(a)
  const postcode = f.match(/\b\d{4,5}\b/)?.[0] ?? null
  // The part with the street: the first comma part that holds a street word or a number.
  const part = f.split(',').map(x => x.trim()).find(x => /(str|platz|gasse|weg|allee|street|road|avenue|tér|\d)/.test(x)) ?? f.split(',')[0]!
  const street = part.replace(/stra(ss|s)e|str\./g, 'str').replace(/\b\d{4,5}\b/g, '').replace(/[^a-z0-9]+/g, '')
  return { street, postcode }
}
/** Same place by address: same postcode (when both have one) and the same street (one may lack the number). */
export function sameAddress(a: string | null, b: string | null) {
  const x = addrParts(a), y = addrParts(b)
  if (!x || !y || !x.street || !y.street) return false
  if (x.postcode && y.postcode && x.postcode !== y.postcode) return false
  if (!x.postcode || !y.postcode) return x.street === y.street
  return x.street === y.street || x.street.startsWith(y.street.replace(/\d+$/, '')) && y.street.startsWith(x.street.replace(/\d+$/, '')) && (!/\d$/.test(x.street) || !/\d$/.test(y.street))
}
function meters(a: DupRow, b: DupRow) {
  if (a.lat == null || a.lng == null || b.lat == null || b.lng == null) return null
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
// Every reference moves to the one that stays, so its events don't decide it:
// the real, plain handle does (it's the URL people share).
// Handle quality: a real name, then a website ("my-mia.de"), then "name2", then a Google id.
const handleQuality = (u: string) => (isPlaceHandle(u) ? 3 : /\d$/.test(u) ? 2 : /\.[a-z]{2,6}$/i.test(u) ? 1 : 0)
const rank = (r: DupRow) => [r.managed ? 0 : 1, r.claimed ? 0 : 1, handleQuality(r.username), -r.events, r.username.length, r.username.toLowerCase()] as const
const byRank = (a: DupRow, b: DupRow) => {
  const x = rank(a), y = rank(b)
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return (x[i] as any) < (y[i] as any) ? -1 : 1
  return 0
}

export function findDuplicates(rows: DupRow[], cityKeys: Set<string>): DupGroup[] {
  const groups = new Map<string, DupRow[]>()
  for (const r of rows) {
    const k = nameKey(r.name)
    if (k.length < 3) continue
    const g = `${r.type}|${k}`
    groups.set(g, [...(groups.get(g) ?? []), r])
  }
  const out: DupGroup[] = []
  for (const [g, all] of groups) {
    if (all.length < 2) continue
    const [type, key] = g.split('|') as [string, string]
    // Split by city: rows with a city group by it; rows without one join the
    // city they match (if there is only one), else stay on their own.
    const cities = [...new Set(all.map(r => r.citySlug).filter(Boolean))] as string[]
    const buckets = cities.length ? cities.map(c => all.filter(r => r.citySlug === c || (!r.citySlug && cities.length === 1))) : [all]
    for (const b of buckets) {
      if (b.length < 2) continue
      const sorted = [...b].sort(byRank)
      const keep = sorted[0]!
      const others = sorted.slice(1).map((row): MergeVerdict => {
        if (row.managed) return { row, merge: false, reason: 'both run by people on WeDance' }
        if (type === 'venue' && cityKeys.has(key)) return { row, merge: false, reason: 'the name is just a city' }
        if (!row.events) return { row, merge: true, reason: 'empty copy' }
        // Handles only tell organizers and artists apart: a venue's handle can be
        // "<street>-2" for a different place, so venues go by address.
        if (type !== 'venue' && base(row.username) === base(keep.username)) return { row, merge: true, reason: 'numbered copy' }
        if (type !== 'venue' && plain(row.username) === plain(keep.username)) return { row, merge: true, reason: 'same handle, other punctuation' }
        if (type === 'venue') {
          const a = addrKey(row.address), k = addrKey(keep.address)
          if ((a && k && a === k) || sameAddress(row.address, keep.address)) return { row, merge: true, reason: 'same address' }
          const m = meters(row, keep)
          if (m != null && m < 150) return { row, merge: true, reason: `${Math.round(m)} m apart` }
          // A street ("Zentnerstraße") can hold many places: needs the address to match.
          if (STREETY.test(keep.name)) return { row, merge: false, reason: 'the name is a street, address not known to match' }
          // Same name in the same city: one place, unless both addresses say otherwise.
          if (m != null && m >= 150) return { row, merge: false, reason: `same name, ${Math.round(m)} m apart` }
          if (a && k) return { row, merge: false, reason: 'same name, different addresses' }
          return { row, merge: true, reason: 'same name and city, address on one side only' }
        }
        // Organizers / artists: the same full name in the same city is the same
        // one, when the name is distinctive enough ("United Bachata Party").
        if (key.length >= 8) return { row, merge: true, reason: 'same name and city' }
        return { row, merge: false, reason: 'short name, both have events' }
      })
      out.push({ type, key, keep, others })
    }
  }
  return out
}

/** Handles in an event's line-up, flyer options and festival programme, renamed. */
export function renameInEvent(ev: { artists: string[] | null; flyerOptions: any; festival: any }, from: string, to: string) {
  const swap = (h: string) => (h === from ? to : h)
  const artists = [...new Set((ev.artists ?? []).map(swap))]
  const fo = { ...(ev.flyerOptions ?? {}) }
  for (const k of ['photos', 'names'] as const) {
    if (fo[k] && from in fo[k]) {
      const m = { ...fo[k] }
      if (!(to in m)) m[to] = m[from]
      delete m[from]
      fo[k] = m
    }
  }
  let festival = ev.festival
  if (festival) {
    festival = { ...festival }
    if (festival.sessions) festival.sessions = festival.sessions.map((s: any) => ({ ...s, artist: swap(s.artist), ...(s.with ? { with: [...new Set((s.with as string[]).map(swap))] } : {}) }))
    if (festival.videos && from in festival.videos) {
      const v = { ...festival.videos }
      if (!(to in v)) v[to] = v[from]
      delete v[from]
      festival.videos = v
    }
  }
  return { artists, flyerOptions: fo, festival }
}

const FILL = ['photo', 'bio', 'city', 'city_slug', 'address', 'lat', 'lng', 'map_url', 'venue_type', 'floor_type', 'capacity', 'floor_plan'] as const

/**
 * Merge `from` into `to`: move every reference, fill `to`'s empty fields,
 * hide `from`. Returns what it touched (for the backup / report).
 */
/**
 * Point everything that names a profile by its handle at another handle:
 * events (venue, organizer, line-up, flyer options, festival programme) and
 * moderator handles. Used when merging and when renaming a handle.
 */
export async function moveHandleRefs(db: any, from: string, to: string, count: (k: string, n: number) => void = () => {}) {
  const q = async (s: any) => { const r: any = await db.execute(s); return (r.rows ?? r) as any[] }
  count('events.venue', (await q(sql`update events set venue_username = ${to} where venue_username = ${from} returning id`)).length)
  count('events.organizer', (await q(sql`update events set organizer_username = ${to} where organizer_username = ${from} returning id`)).length)
  const evs = await q(sql`select id, artists, flyer_options as "flyerOptions", festival from events
    where artists::jsonb ? ${from} or flyer_options->'photos' ? ${from} or flyer_options->'names' ? ${from}
      or festival::text like ${`%"${from}"%`}`)
  for (const e of evs) {
    const n = renameInEvent(e, from, to)
    await q(sql`update events set artists = ${JSON.stringify(n.artists)}::jsonb, flyer_options = ${JSON.stringify(n.flyerOptions)}::jsonb, festival = ${n.festival ? JSON.stringify(n.festival) : null}::jsonb where id = ${e.id}`)
  }
  count('events.lineup', evs.length)
  count('profiles.moderator_handle', (await q(sql`update profiles set moderator_handle = ${to} where moderator_handle = ${from} returning id`)).length)
}

export async function mergeProfile(db: any, from: { id: string; username: string }, to: { id: string; username: string }) {
  const q = async (s: any) => { const r: any = await db.execute(s); return (r.rows ?? r) as any[] }
  const touched: Record<string, number> = {}
  const count = (k: string, n: number) => { if (n) touched[k] = (touched[k] ?? 0) + n }
  await moveHandleRefs(db, from.username, to.username, count)
  count('events.host', (await q(sql`update events set host_profile_id = ${to.id} where host_profile_id = ${from.id} returning id`)).length)
  // Rows with a unique (…, profile) pair: drop the copy's where the one that stays has its own.
  count('artist_follows', (await q(sql`delete from artist_follows f where f.profile_id = ${from.id} and exists (select 1 from artist_follows g where g.profile_id = ${to.id} and g.dancer_id = f.dancer_id) returning f.id`)).length)
  count('profile_invites', (await q(sql`delete from profile_invites i where i.profile_id = ${from.id} and exists (select 1 from profile_invites j where j.profile_id = ${to.id} and j.event_id = i.event_id) returning i.id`)).length)
  count('profile_members', (await q(sql`delete from profile_members m where m.profile_id = ${from.id} and exists (select 1 from profile_members n where n.profile_id = ${to.id} and n.dancer_id = m.dancer_id) returning m.id`)).length)
  for (const [table, col] of [
    ['artist_follows', 'profile_id'], ['bookable_spaces', 'profile_id'], ['booking_requests', 'profile_id'], ['booking_requests', 'organizer_id'],
    ['brand_looks', 'profile_id'], ['guideline_versions', 'profile_id'], ['moderator_elections', 'profile_id'], ['profile_access_log', 'profile_id'],
    ['profile_claims', 'profile_id'], ['profile_invites', 'profile_id'], ['profile_members', 'profile_id'], ['profile_suggestions', 'profile_id'],
  ] as const) {
    count(`${table}.${col}`, (await q(sql`update ${sql.identifier(table)} set ${sql.identifier(col)} = ${to.id} where ${sql.identifier(col)} = ${from.id} returning 1 as x`)).length)
  }
  // Fill the empty fields of the one that stays.
  const [a] = await q(sql`select * from profiles where id = ${to.id}`)
  const [b] = await q(sql`select * from profiles where id = ${from.id}`)
  const fill: string[] = []
  for (const c of FILL) if ((a[c] == null || a[c] === '') && b[c] != null && b[c] !== '') fill.push(c)
  for (const c of fill) await q(sql`update profiles set ${sql.identifier(c)} = (select ${sql.identifier(c)} from profiles where id = ${from.id}) where id = ${to.id}`)
  const platforms = new Set(((a.socials ?? []) as any[]).map(s => s.platform))
  const socials = [...(a.socials ?? []), ...((b.socials ?? []) as any[]).filter(s => !platforms.has(s.platform))]
  const photos = [...(a.photos ?? [])]
  for (const p of (b.photos ?? []) as any[]) if (!photos.some((x: any) => x.url === p.url)) photos.push(p)
  const styles = (a.styles ?? []).length ? a.styles : (b.styles ?? [])
  const amenities = (a.amenities ?? []).length ? a.amenities : (b.amenities ?? [])
  const contact = { ...(b.contact ?? {}), ...(a.contact ?? {}) }
  await q(sql`update profiles set socials = ${JSON.stringify(socials)}::json, photos = ${JSON.stringify(photos)}::jsonb, styles = ${JSON.stringify(styles)}::json,
    amenities = ${JSON.stringify(amenities)}::jsonb, contact = ${JSON.stringify(contact)}::jsonb where id = ${to.id}`)
  // Hide the copy, pointing at the one that stays.
  await q(sql`update profiles set status = 'hidden', source_ref = coalesce(source_ref, '{}'::jsonb) || ${JSON.stringify({ mergedInto: to.username, mergedAt: new Date().toISOString() })}::jsonb where id = ${from.id}`)
  return { touched, filled: fill }
}
