/**
 * "Is this page already on WeDance?" (#458) — the checks behind the duplicate
 * warning on Create (UI + MCP), add_venue, and the "Possible duplicates" card in
 * Business mode. A page is a likely duplicate when it:
 *   - links the same Instagram account (main or an alias),
 *   - has the same WeDance handle,
 *   - has a similar name in the same city ("Bar Buena Vista" / "Buena Vista Bar"),
 *   - (venues) has the same street address or sits within 75 m.
 * Merged copies (source_ref.mergedInto) never count: they answer for the page
 * they were merged into.
 */
import { sql, and, eq, or } from 'drizzle-orm'
import { profiles } from '../database/schema'
import { parseInstagramHandle } from '../../shared/utils/instagram'
import { sameAddress, nameKey } from './mergeProfiles'

const ACCENTS: Record<string, string> = { á: 'a', à: 'a', â: 'a', ä: 'a', ã: 'a', å: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', í: 'i', ì: 'i', î: 'i', ï: 'i', ó: 'o', ò: 'o', ô: 'o', ö: 'o', õ: 'o', ú: 'u', ù: 'u', û: 'u', ü: 'u', ñ: 'n', ç: 'c', ß: 'ss' }
// Words that don't tell two places apart.
const GENERIC = new Set(['the', 'der', 'die', 'das', 'la', 'le', 'el', 'los', 'las', 'il', 'de', 'del', 'di', 'da', 'du', 'des', 'and', 'und', 'y', 'e', 'et', 'n',
  'bar', 'club', 'cafe', 'official', 'offiziell', 'munich', 'munchen', 'muenchen', 'berlin', 'hamburg', 'koln', 'wien', 'vienna'])

/** Distinctive words of a name, accents and generic words dropped ("Bar Buena Vista" → buena, vista). */
export function nameTokens(name: string, city?: string | null): string[] {
  const fold = (t: string) => t.toLowerCase().replace(/[^\u0000-\u007f]/g, c => ACCENTS[c] ?? c)
  const cityWords = new Set(city ? fold(city).split(/[^a-z0-9]+/).filter(Boolean) : [])
  return [...new Set(fold(name).split(/[^a-z0-9]+/).filter(w => w && !GENERIC.has(w) && !cityWords.has(w)))].sort()
}

/** Same place or person by name: same letters, or the same distinctive words in any order. */
export function similarNames(a: string, b: string, city?: string | null): boolean {
  if (nameKey(a).length >= 3 && nameKey(a) === nameKey(b)) return true
  const x = nameTokens(a, city), y = nameTokens(b, city)
  if (!x.length || !y.length) return false
  const [small, big] = x.length <= y.length ? [x, y] : [y, x]
  const covered = small.every(w => big.includes(w))
  if (!covered) return false
  // Equal word sets need some substance ("Buena Vista"); a subset needs 2+ words ("Buena Vista" ⊂ "Buena Vista Social Club").
  return small.length === big.length ? small.join('').length >= 6 : small.length >= 2
}

function metres(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371000, toR = Math.PI / 180
  const dLat = (b.lat - a.lat) * toR, dLng = (b.lng - a.lng) * toR
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * toR) * Math.cos(b.lat * toR) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** SQL: not a copy merged into another page. */
export const notMerged = sql`not coalesce(${profiles.sourceRef} ? 'mergedInto', false)`

/** SQL: profiles that link this Instagram account, as their main account (www. / trailing slash / case vary in imports) or an alias. */
export const linksInstagramSql = (handle: string) =>
  sql`(${profiles.socials}::text ~* ${`instagram\\.com/${handle.replace(/\./g, '\\.')}/?"`} or ${profiles.instagramAliases} ? ${handle.toLowerCase()})`

export type DupeReason = 'instagram' | 'handle' | 'name' | 'address' | 'nearby'
export type LikelyDuplicate = {
  id: string; username: string; name: string; type: string; city: string | null; photo: string | null
  address: string | null; managed: boolean; reasons: DupeReason[]
}

const isManaged = sql<boolean>`exists (select 1 from "profile_members" m where m.profile_id = "profiles"."id")`

/**
 * Likely duplicates of a page someone is about to create (or of an existing page,
 * with `excludeId`). Visible, unmerged pages only; strongest match first.
 */
export async function findLikelyDuplicates(db: any, input: {
  name?: string | null; handle?: string | null; instagram?: string[] | string | null
  citySlug?: string | null; type?: string | null; address?: string | null; lat?: number | null; lng?: number | null
  excludeId?: string | null; limit?: number
}): Promise<LikelyDuplicate[]> {
  const igs = [...new Set((Array.isArray(input.instagram) ? input.instagram : [input.instagram]).map(h => parseInstagramHandle(h ?? null)).filter(Boolean) as string[])]
  const handle = input.handle?.replace(/^@/, '').toLowerCase() || null
  const conds = [
    ...igs.map(linksInstagramSql),
    handle ? sql`lower(${profiles.username}) = ${handle}` : undefined,
    // Name / address checks run in JS over the city's pages.
    input.citySlug && (input.name || input.address || input.lat != null) ? eq(profiles.citySlug, input.citySlug) : undefined,
    // No city given: an exact name anywhere still counts.
    !input.citySlug && input.name && nameKey(input.name).length >= 3 ? sql`lower(${profiles.name}) = lower(${input.name})` : undefined,
  ].filter(Boolean)
  if (!conds.length) return []
  const rows = await db.select({
    id: profiles.id, username: profiles.username, name: profiles.name, type: profiles.type, city: profiles.city, citySlug: profiles.citySlug,
    photo: profiles.photo, address: profiles.address, lat: profiles.lat, lng: profiles.lng, socials: profiles.socials,
    instagramAliases: profiles.instagramAliases, managed: isManaged,
  }).from(profiles).where(and(eq(profiles.status, 'visible'), notMerged, or(...(conds as any[]))))

  const out: LikelyDuplicate[] = []
  for (const r of rows as any[]) {
    if (r.id === input.excludeId) continue
    const reasons: DupeReason[] = []
    const theirIgs = [
      ...((r.socials ?? []) as { platform: string; url: string }[]).filter(s => s.platform?.toLowerCase() === 'instagram').map(s => parseInstagramHandle(s.url)),
      ...((r.instagramAliases ?? []) as string[]),
    ].filter(Boolean) as string[]
    if (igs.some(h => theirIgs.includes(h))) reasons.push('instagram')
    if (handle && r.username.toLowerCase() === handle) reasons.push('handle')
    const sameCity = !input.citySlug || r.citySlug === input.citySlug
    if (input.name && sameCity && similarNames(input.name, r.name, r.city)) reasons.push('name')
    // Address and distance only say "same place" for venues.
    const venues = (!input.type || input.type === 'venue') && r.type === 'venue'
    if (venues && sameCity && input.address && r.address && sameAddress(input.address, r.address)) reasons.push('address')
    else if (venues && input.lat != null && input.lng != null && r.lat != null && r.lng != null && metres({ lat: input.lat, lng: input.lng }, r) < 75) reasons.push('nearby')
    if (!reasons.length) continue
    out.push({ id: r.id, username: r.username, name: r.name, type: r.type, city: r.city ?? null, photo: r.photo ?? null, address: r.address ?? null, managed: !!r.managed, reasons })
  }
  const weight: Record<DupeReason, number> = { instagram: 0, handle: 1, address: 2, nearby: 3, name: 4 }
  const score = (d: LikelyDuplicate) => Math.min(...d.reasons.map(x => weight[x])) - d.reasons.length / 10 + (input.type && d.type !== input.type ? 1 : 0)
  return out.sort((a, b) => score(a) - score(b)).slice(0, input.limit ?? 5)
}

/** One line for a person (or an LLM) on why a page looks like the same one. */
export function dupeReasonText(reasons: DupeReason[]) {
  const t: Record<DupeReason, string> = { instagram: 'same Instagram account', handle: 'same handle', name: 'similar name in the same city', address: 'same address', nearby: 'within 75 m' }
  return reasons.map(r => t[r]).join(', ')
}
