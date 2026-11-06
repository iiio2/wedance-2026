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
 *   - its handle differs only by punctuation ("dj.max" / "djmax"), or
 *   - (organizers, artists) the same distinctive name (8+ letters) in the same
 *     city, or
 *   - (venues) it has the same street address, is within 150 m, or has the
 *     same name in the same city with an address on one side only — unless the
 *     name is just a street.
 * Everything else is listed for review, never merged: two copies both run by
 * people, venues with events at different addresses, and names that are just
 * a city ("Budapest").
 *
 * A second group: same type and the same Instagram account, whatever the name
 * (the v4 import made a fan page per Instagram mention: "salsa-school" and
 * "salsaschool.official2"). The account is the business, so organizers
 * merge — unless both are claimed. Artists merge only when the copy is
 * a numbered copy or a bare handle; two artists sharing an account are often a
 * couple ("alexei.emilia"), so they go to review. Venues merge only in the same
 * city (one account can run several places).
 *
 * Merging moves every reference to the copy onto the one that stays, fills the
 * one that stays's EMPTY fields from the copy, and hides the copy with
 * `source_ref.mergedInto` (so /@copy forwards, and the v3 sync links to the one
 * that stays). Nothing is deleted.
 */
import { sql } from 'drizzle-orm'
import { parseInstagramHandle } from '../../shared/utils/instagram'

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
  instagram?: string[] // main account + aliases (instagramHandles)
}
export type MergeVerdict = { row: DupRow; merge: boolean; reason: string }
export type DupGroup = { type: string; key: string; keep: DupRow; others: MergeVerdict[] }

const ACCENTS: Record<string, string> = { á: 'a', à: 'a', â: 'a', ä: 'a', ã: 'a', å: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', í: 'i', ì: 'i', î: 'i', ï: 'i', ó: 'o', ò: 'o', ô: 'o', ö: 'o', õ: 'o', ú: 'u', ù: 'u', û: 'u', ü: 'u', ñ: 'n', ç: 'c', ß: 's' }
export const nameKey = (name: string) => name.toLowerCase().replace(/[^\u0000-\u007f]/g, c => ACCENTS[c] ?? c).replace(/[^a-z0-9]+/g, '')
const isPlaceHandle = (u: string) => /^(ChIJ|Ei|Gh)[\w-]{15,}$/.test(u)
const base = (u: string) => u.toLowerCase().replace(/\d+$/, '')
// "dj.max" = "djmax" = "dj_max" (but not a different name).
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
// Handle quality: a real name, then a website ("my-mia.de"), then "name2", then a Google id or a URL-encoded handle ("salsaaut%c3%a9ntica").
const handleQuality = (u: string) => (isPlaceHandle(u) || /%[0-9a-f]{2}/i.test(u) ? 3 : /\d$/.test(u) ? 2 : /\.[a-z]{2,6}$/i.test(u) ? 1 : 0)
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
  // Same type + same Instagram account. A row a name group already merges away
  // is left out (its next run sees it gone).
  const mergedAway = new Set(out.flatMap(g => g.others.filter(o => o.merge).map(o => o.row.id)))
  const inNameGroup = new Set(out.flatMap(g => [g.keep.id, ...g.others.map(o => o.row.id)]))
  const byIg = new Map<string, DupRow[]>()
  for (const r of rows) {
    if (mergedAway.has(r.id)) continue
    for (const h of new Set(r.instagram ?? [])) {
      if (h.length < 3 || SHARED_ACCOUNTS.has(h)) continue
      const g = `${r.type}|${h}`
      byIg.set(g, [...(byIg.get(g) ?? []), r])
    }
  }
  const seen = new Set<string>()
  for (const [g, all] of byIg) {
    const fresh = all.filter(r => !seen.has(r.id))
    if (fresh.length < 2) continue
    // Pairs a name group already decided stay with it.
    if (fresh.every(r => inNameGroup.has(r.id)) && new Set(fresh.map(r => nameKey(r.name))).size === 1) continue
    const [type, handle] = g.split('|') as [string, string]
    const sorted = [...fresh].sort(byRank)
    const keep = sorted[0]!
    const others = sorted.slice(1).map((row): MergeVerdict => {
      if (row.managed) return { row, merge: false, reason: 'same Instagram, both run by people on WeDance' }
      if (row.claimed && keep.claimed) return { row, merge: false, reason: 'same Instagram, both claimed' }
      if (type === 'artist') {
        const stub = nameKey(row.name) === plain(row.username) && !row.events
        if (base(row.username) === base(keep.username) || plain(row.username) === plain(keep.username) || stub) return { row, merge: true, reason: 'same Instagram, artist copy' }
        return { row, merge: false, reason: 'same Instagram, two artists (a couple?)' }
      }
      if (type === 'venue' && (!row.citySlug || row.citySlug !== keep.citySlug)) return { row, merge: false, reason: 'same Instagram, venues in different cities' }
      return { row, merge: true, reason: 'same Instagram' }
    })
    for (const r of sorted) seen.add(r.id)
    out.push({ type, key: `ig:${handle}`, keep, others })
  }
  return out
}

// Instagram accounts that many unrelated pages link to (a platform, not the business).
const SHARED_ACCOUNTS = new Set(['wedance', 'wedance.vip', 'wedanceteam', 'wedance_vip', 'instagram', 'p', 'explore', 'reel', 'stories'])

/** Handles in an event's line-up, flyer options and festival programme, renamed. */
export function renameInEvent(ev: { artists: string[] | null; coOrganizers?: { username: string; role?: string }[] | null; flyerOptions: any; festival: any }, from: string, to: string) {
  const swap = (h: string) => (h === from ? to : h)
  const artists = [...new Set((ev.artists ?? []).map(swap))]
  // Co-organisers (#456): each page once, the first entry (and its role) wins.
  const coOrganizers = (ev.coOrganizers ?? []).map(c => ({ ...c, username: swap(c.username) }))
    .filter((c, i, all) => all.findIndex(x => x.username === c.username) === i)
  const fo = { ...ev.flyerOptions }
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
  return { artists, coOrganizers, flyerOptions: fo, festival }
}

const FILL = ['photo', 'bio', 'city', 'city_slug', 'address', 'lat', 'lng', 'map_url', 'venue_type', 'floor_type', 'capacity', 'floor_plan'] as const
// The kept profile's columns a merge may change — snapshotted so an undo puts them back.
const SNAPSHOT = [...FILL, 'socials', 'photos', 'styles', 'amenities', 'contact', 'instagram_aliases'] as const
const JSON_COLS: Record<string, 'json' | 'jsonb'> = { socials: 'json', styles: 'json', photos: 'jsonb', amenities: 'jsonb', contact: 'jsonb', instagram_aliases: 'jsonb' }

/**
 * Every column that points at a profile by id. `same` = the other columns of a
 * unique key with it: the copy's row only moves when the kept profile has no row
 * for the same key (else it stays on the hidden copy — nothing is deleted).
 * `t` is the row being moved, `x` the kept profile's row. `idCol` names the
 * row's key for the undo (profile_sites has no id).
 * Not moved on purpose: handles (the copy's handle keeps naming the copy, which
 * forwards), profile_access_log (the copy's own history) and mcp_audit.
 * server/utils/mergeProfiles.test.ts fails when a profile FK is missing here.
 */
export const PROFILE_REFS: { table: string; col: string; same?: string; notSelf?: string; idCol?: string }[] = [
  { table: 'events', col: 'host_profile_id' },
  { table: 'follows', col: 'profile_id', same: 'x.dancer_id = t.dancer_id' },
  { table: 'profile_members', col: 'profile_id', same: 'x.dancer_id = t.dancer_id' },
  { table: 'profile_claims', col: 'profile_id', same: 'x.dancer_id = t.dancer_id' },
  { table: 'profile_owner_suggestions', col: 'profile_id', same: 'x.dancer_id = t.dancer_id', idCol: 'dancer_id' },
  { table: 'profile_invites', col: 'profile_id', same: 'x.event_id = t.event_id' },
  { table: 'tracked_links', col: 'profile_id', same: 'x.event_id = t.event_id' },
  { table: 'profile_suggestions', col: 'profile_id', same: `x.kind = t.kind and x.value = t.value and x.status = 'pending' and t.status = 'pending'` },
  { table: 'profile_contacts', col: 'profile_id', same: 'lower(x.email) = lower(t.email)' },
  { table: 'profile_sites', col: 'profile_id', same: 'true', idCol: 'profile_id' },
  // Its history follows the site: moves only when the kept profile has no site versions (so no site) either.
  { table: 'profile_site_versions', col: 'profile_id', same: 'true' },
  // A person's own page (#474): one person per page, so a kept page someone already is stays theirs.
  { table: 'dancers', col: 'page_profile_id', same: 'true' },
  // Pairs (notSelf): never link the kept profile to itself.
  { table: 'network_links', col: 'profile_id', same: 'x.other_profile_id = t.other_profile_id', notSelf: 'other_profile_id' },
  { table: 'network_links', col: 'other_profile_id', same: 'x.profile_id = t.profile_id', notSelf: 'profile_id' },
  { table: 'profile_affiliations', col: 'artist_profile_id', same: 'x.organizer_profile_id = t.organizer_profile_id', notSelf: 'organizer_profile_id' },
  { table: 'profile_affiliations', col: 'organizer_profile_id', same: 'x.artist_profile_id = t.artist_profile_id', notSelf: 'artist_profile_id' },
  { table: 'bookable_spaces', col: 'profile_id' },
  { table: 'booking_requests', col: 'profile_id' },
  { table: 'booking_requests', col: 'organizer_id' },
  { table: 'booking_inquiries', col: 'profile_id' },
  { table: 'inbound_requests', col: 'profile_id' },
  { table: 'brand_looks', col: 'profile_id' },
  { table: 'guideline_versions', col: 'profile_id' },
  { table: 'moderator_elections', col: 'profile_id' },
  { table: 'organizer_subscriptions', col: 'profile_id' },
  { table: 'gigs', col: 'poster_profile_id' },
  { table: 'gig_applications', col: 'profile_id' },
  { table: 'giveaway_proposals', col: 'profile_id' },
]
/**
 * The PROFILE_REFS that exist in this database. Some tables in the schema were
 * never created everywhere (e.g. profile_affiliations, inbound_requests are
 * missing from production's 0044 partial apply), and one missing table must not
 * stop a merge half way.
 */
async function liveRefs(db: any) {
  const r: any = await db.execute(sql`select table_name as t, column_name as c from information_schema.columns
    where table_schema = 'public' and table_name in (${sql.join([...new Set(PROFILE_REFS.map(x => x.table))].map(t => sql`${t}`), sql`, `)})`)
  const have = new Set(((r.rows ?? r) as any[]).map(x => `${x.t}.${x.c}`))
  return PROFILE_REFS.filter(x => have.has(`${x.table}.${x.col}`))
}

/** Profile FK columns a merge leaves alone (see PROFILE_REFS). */
export const PROFILE_REFS_KEPT = ['handles.profile_id', 'profile_access_log.profile_id', 'mcp_audit.profile_id', 'profile_merges.from_profile_id', 'profile_merges.to_profile_id']

/** Instagram handles a profile links: the main one in socials, then its aliases. */
export function instagramHandles(p: { socials?: { platform: string; url: string }[] | null; instagram_aliases?: string[] | null; instagramAliases?: string[] | null }) {
  const main = (p.socials ?? []).filter(s => s.platform?.toLowerCase() === 'instagram').map(s => parseInstagramHandle(s.url)).filter(Boolean) as string[]
  const aliases = (p.instagram_aliases ?? p.instagramAliases ?? []).map(a => parseInstagramHandle(a)).filter(Boolean) as string[]
  return [...new Set([...main, ...aliases])]
}

/**
 * Point everything that names a profile by its handle at another handle:
 * events (venue, organizer, co-organisers, line-up, flyer options, festival programme) and
 * moderator handles. Used when merging and when renaming a handle.
 * `record` gets the ids it changed (and the line-ups before) for an undo.
 */
export async function moveHandleRefs(db: any, from: string, to: string, count: (k: string, n: number) => void = () => {}, record?: (k: string, ids: string[]) => void, lineupsBefore?: any[]) {
  const q = async (s: any) => { const r: any = await db.execute(s); return (r.rows ?? r) as any[] }
  const ids = (rows: any[]) => rows.map(r => String(r.id))
  const venue = ids(await q(sql`update events set venue_username = ${to} where venue_username = ${from} returning id`))
  count('events.venue', venue.length); record?.('events.venue_username', venue)
  const org = ids(await q(sql`update events set organizer_username = ${to} where organizer_username = ${from} returning id`))
  count('events.organizer', org.length); record?.('events.organizer_username', org)
  const evs = await q(sql`select id, artists, co_organizers as "coOrganizers", flyer_options as "flyerOptions", festival from events
    where artists::jsonb ? ${from} or flyer_options->'photos' ? ${from} or flyer_options->'names' ? ${from}
      or co_organizers @> ${JSON.stringify([{ username: from }])}::jsonb
      or festival::text like ${`%"${from}"%`}`)
  for (const e of evs) {
    lineupsBefore?.push(e)
    const n = renameInEvent(e, from, to)
    await q(sql`update events set artists = ${JSON.stringify(n.artists)}::jsonb, co_organizers = ${JSON.stringify(n.coOrganizers)}::jsonb, flyer_options = ${JSON.stringify(n.flyerOptions)}::jsonb, festival = ${n.festival ? JSON.stringify(n.festival) : null}::jsonb where id = ${e.id}`)
  }
  count('events.lineup', evs.length)
  const mod = ids(await q(sql`update profiles set moderator_handle = ${to} where moderator_handle = ${from} returning id`))
  count('profiles.moderator_handle', mod.length); record?.('profiles.moderator_handle', mod)
  // Reviews of the copy (polymorphic by handle); one per dancer, so a dancer who
  // reviewed both keeps theirs on the copy.
  const rev = ids(await q(sql`update reviews t set target_slug = ${to} where t.target_slug = ${from} and t.target_type in ('venue', 'artist', 'organizer')
    and not exists (select 1 from reviews x where x.target_type = t.target_type and x.target_slug = ${to} and x.dancer_id = t.dancer_id) returning t.id`))
  count('reviews', rev.length); record?.('reviews.target_slug', rev)
}

export type MergeResult = { touched: Record<string, number>; filled: string[]; mergeId: string }

/**
 * Merge `from` into `to`: move every reference (PROFILE_REFS + handle refs),
 * fill `to`'s empty fields, add `from`'s Instagram accounts to `to`'s aliases,
 * hide `from` with source_ref.mergedInto, and record it all in profile_merges
 * (written first and kept up to date, so a merge that stops half way can still
 * be undone). Nothing is deleted.
 */
export async function mergeProfile(db: any, from: { id: string; username: string }, to: { id: string; username: string }, opts: { by?: string | null } = {}): Promise<MergeResult> {
  const q = async (s: any) => { const r: any = await db.execute(s); return (r.rows ?? r) as any[] }
  const touched: Record<string, number> = {}
  const count = (k: string, n: number) => { if (n) touched[k] = (touched[k] ?? 0) + n }
  const moved: Record<string, string[]> = {}
  const [a] = await q(sql`select * from profiles where id = ${to.id}`)
  const [b] = await q(sql`select * from profiles where id = ${from.id}`)
  const before: Record<string, unknown> = {
    profile: Object.fromEntries(SNAPSHOT.map(c => [c, a[c] ?? null])),
    fromStatus: b.status, lineups: [] as any[],
  }
  const [m] = await q(sql`insert into profile_merges (from_profile_id, to_profile_id, from_username, to_username, merged_by, before)
    values (${from.id}, ${to.id}, ${from.username}, ${to.username}, ${opts.by ?? null}, ${JSON.stringify(before)}::jsonb) returning id`)
  const mergeId = String(m.id)
  const save = async () => { await q(sql`update profile_merges set moved = ${JSON.stringify(moved)}::jsonb, before = ${JSON.stringify(before)}::jsonb where id = ${mergeId}`) }
  const record = async (k: string, ids: string[]) => { if (!ids.length) return; moved[k] = [...(moved[k] ?? []), ...ids]; await save() }

  const recorded: [string, string[]][] = []
  await moveHandleRefs(db, from.username, to.username, count, (k, ids) => { recorded.push([k, ids]) }, before.lineups as any[])
  for (const [k, ids] of recorded) await record(k, ids)
  if ((before.lineups as any[]).length) await save()

  for (const r of await liveRefs(db)) {
    const idCol = r.idCol ?? 'id'
    const conflict = r.same ? sql` and not exists (select 1 from ${sql.identifier(r.table)} x where x.${sql.identifier(r.col)} = ${to.id} and ${sql.raw(r.same)})` : sql``
    const also = r.notSelf ? sql` and t.${sql.identifier(r.notSelf)} <> ${to.id}` : sql``
    const rows = await q(sql`update ${sql.identifier(r.table)} t set ${sql.identifier(r.col)} = ${to.id}
      where t.${sql.identifier(r.col)} = ${from.id}${conflict}${also} returning t.${sql.identifier(idCol)} as id`)
    count(`${r.table}.${r.col}`, rows.length)
    await record(`${r.table}.${r.col}`, rows.map(x => String(x.id)))
  }

  // Fill the empty fields of the one that stays.
  const fill: string[] = []
  for (const c of FILL) if ((a[c] == null || a[c] === '') && b[c] != null && b[c] !== '') fill.push(c)
  for (const c of fill) await q(sql`update profiles set ${sql.identifier(c)} = (select ${sql.identifier(c)} from profiles where id = ${from.id}) where id = ${to.id}`)
  const platforms = new Set(((a.socials ?? []) as any[]).map(s => s.platform))
  const socials = [...(a.socials ?? []), ...((b.socials ?? []) as any[]).filter(s => !platforms.has(s.platform))]
  const photos = [...(a.photos ?? [])]
  for (const p of (b.photos ?? []) as any[]) if (!photos.some((x: any) => x.url === p.url)) photos.push(p)
  const styles = (a.styles ?? []).length ? a.styles : (b.styles ?? [])
  const amenities = (a.amenities ?? []).length ? a.amenities : (b.amenities ?? [])
  const contact = { ...b.contact, ...a.contact }
  // The copy's Instagram accounts become aliases of the one that stays (its main one stays main).
  const mainIg = instagramHandles({ socials })
  const aliases = [...new Set([...instagramHandles(a), ...instagramHandles(b)])].filter(h => !mainIg.includes(h))
  await q(sql`update profiles set socials = ${JSON.stringify(socials)}::json, photos = ${JSON.stringify(photos)}::jsonb, styles = ${JSON.stringify(styles)}::json,
    amenities = ${JSON.stringify(amenities)}::jsonb, contact = ${JSON.stringify(contact)}::jsonb, instagram_aliases = ${JSON.stringify(aliases)}::jsonb where id = ${to.id}`)
  // Hide the copy, pointing at the one that stays.
  await q(sql`update profiles set status = 'hidden', source_ref = coalesce(source_ref, '{}'::jsonb) || ${JSON.stringify({ mergedInto: to.username, mergedAt: new Date().toISOString() })}::jsonb where id = ${from.id}`)
  return { touched, filled: fill, mergeId }
}

/**
 * Undo a merge from its profile_merges row: move the recorded rows back, put the
 * line-ups and the kept profile's fields back as they were, show the copy again.
 * Rows that changed since (e.g. an event re-pointed by hand) are left alone.
 */
export async function undoMerge(db: any, mergeId: string, by: string | null = null) {
  const q = async (s: any) => { const r: any = await db.execute(s); return (r.rows ?? r) as any[] }
  const [m] = await q(sql`select * from profile_merges where id = ${mergeId}`)
  if (!m) throw new Error('Merge not found.')
  if (m.undone_at) throw new Error('This merge was already undone.')
  const moved = (m.moved ?? {}) as Record<string, string[]>
  const before = (m.before ?? {}) as { profile?: Record<string, unknown>; fromStatus?: string; lineups?: any[] }
  const inList = (ids: string[]) => sql.join(ids.map(i => sql`${i}`), sql`, `)
  for (const r of await liveRefs(db)) {
    const ids = moved[`${r.table}.${r.col}`]
    if (!ids?.length) continue
    const idCol = r.idCol ?? 'id'
    // profile_sites is keyed by the profile itself: its moved "id" is the kept profile's.
    await q(sql`update ${sql.identifier(r.table)} set ${sql.identifier(r.col)} = ${m.from_profile_id}
      where ${sql.identifier(r.col)} = ${m.to_profile_id} and ${sql.identifier(idCol)}::text in (${inList(ids)})`)
  }
  const back = async (key: string, table: string, col: string) => {
    const ids = moved[key]
    if (ids?.length) await q(sql`update ${sql.identifier(table)} set ${sql.identifier(col)} = ${m.from_username} where ${sql.identifier(col)} = ${m.to_username} and id::text in (${inList(ids)})`)
  }
  await back('events.venue_username', 'events', 'venue_username')
  await back('events.organizer_username', 'events', 'organizer_username')
  await back('profiles.moderator_handle', 'profiles', 'moderator_handle')
  await back('reviews.target_slug', 'reviews', 'target_slug')
  for (const e of before.lineups ?? []) {
    await q(sql`update events set artists = ${JSON.stringify(e.artists ?? [])}::jsonb, co_organizers = ${JSON.stringify(e.coOrganizers ?? [])}::jsonb, flyer_options = ${JSON.stringify(e.flyerOptions ?? {})}::jsonb, festival = ${e.festival ? JSON.stringify(e.festival) : null}::jsonb where id = ${e.id}`)
  }
  if (before.profile) {
    const sets = Object.entries(before.profile).map(([c, v]) => JSON_COLS[c]
      ? sql`${sql.identifier(c)} = ${v == null ? null : JSON.stringify(v)}::${sql.raw(JSON_COLS[c]!)}`
      : sql`${sql.identifier(c)} = ${v}`)
    if (sets.length) await q(sql`update profiles set ${sql.join(sets, sql`, `)} where id = ${m.to_profile_id}`)
  }
  await q(sql`update profiles set status = ${before.fromStatus ?? 'visible'}, source_ref = (coalesce(source_ref, '{}'::jsonb) - 'mergedInto' - 'mergedAt') where id = ${m.from_profile_id}`)
  await q(sql`update profile_merges set undone_at = now(), undone_by = ${by} where id = ${mergeId}`)
  return { fromUsername: m.from_username as string, toUsername: m.to_username as string }
}
