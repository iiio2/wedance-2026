/**
 * Readable handles for /@<handle> (profiles) and /u/<handle> (dancers) — one
 * namespace. A handle is readable when a person could say it: not a Google
 * place id ("ChIJpTx…"), not a number, not garbled ("salsamc3a1spasing" from
 * a broken "á"), not a random suffix ("alosha-589fb"), not a numbered copy when
 * the plain name is free.
 *
 * Candidates, best first: the profile's Instagram handle (how people know
 * them), its name ("salsa-y-corazon"), name + city, name + a number.
 */
import { parseInstagramHandle } from '../../shared/utils/instagram'

const MARKS = /[̀-ͯ]/g
/** Handles nobody gets: site sections, page names and roles (a page at /@admin would mislead). */
export const RESERVED = ['admin', 'administrator', 'api', 'app', 'artist', 'artists', 'auth', 'booking-terms', 'business', 'charanga', 'cities', 'city', 'confirm', 'dancer', 'dancers', 'docs', 'elections', 'event', 'events', 'festival', 'festivals', 'find-your-dance', 'for-events', 'for-organizers', 'for-sponsors', 'for-venues', 'gigs', 'help', 'imprint', 'login', 'logout', 'me', 'moderator', 'my-plan', 'my-year', 'null', 'onboarding', 'organizer', 'organizers', 'press', 'privacy-policy', 'profile', 'profiles', 'root', 'settings', 'signin', 'signup', 'sketches', 'staff', 'support', 'system', 'team', 'terms', 'u', 'undefined', 'user', 'venue', 'venues', 'wedance', 'www']
export function handleSlug(s: string, max = 40) {
  return s.toLowerCase().replace(/ß/g, 'ss').normalize('NFKD').replace(MARKS, '')
    // A run of 6+ digits in a name is likely a phone number: never in a public URL.
    .replace(/\d{6,}/g, ' ')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, max).replace(/-+$/, '')
}

const PLACE = /^(ChIJ|Ei|Gh)[\w-]{15,}$/
const GARBLED = /(c3[a-b][0-9a-f]|c2[a-b][0-9a-f]|%[0-9a-f]{2})/i
const RANDOM_SUFFIX = /-(?=[0-9a-f]*\d)(?=[0-9a-f]*[a-f])[0-9a-f]{5}$/
const NUMBERED = /[a-z._-]\d{1,2}$/i
const JUNK = /(www\.|web\.archive|instagra(m)?com|facebook\.com|^m\.)/i

/** Why a handle isn't readable, or null when it is. */
export function unreadable(handle: string): 'google id' | 'number' | 'garbled' | 'random suffix' | 'numbered copy' | 'not a handle' | null {
  if (PLACE.test(handle)) return 'google id'
  if (/^\d{4,}$/.test(handle)) return 'number'
  if (/[^\x21-\x7e]/.test(handle) || JUNK.test(handle) || handle.length > 40) return 'not a handle'
  if (GARBLED.test(handle)) return 'garbled'
  if (RANDOM_SUFFIX.test(handle)) return 'random suffix'
  if (NUMBERED.test(handle)) return 'numbered copy'
  return null
}

export function candidates(p: { name: string; citySlug?: string | null; socials?: { platform: string; url: string }[] | null }) {
  const out: string[] = []
  const ig = (p.socials ?? []).find(s => s.platform === 'instagram')?.url
  const h = ig ? parseInstagramHandle(ig) : null
  if (h && !unreadable(h)) out.push(h.toLowerCase())
  const n = handleSlug(p.name)
  if (n.length >= 3) {
    out.push(n)
    if (p.citySlug) out.push(`${n}-${p.citySlug}`)
  }
  return out
}

/**
 * The readable handle to use: the first free candidate, else `root` (the
 * name) with the lowest free number from 2. `taken` is lowercased and gets the
 * pick added.
 */
export function pickHandle(cands: string[], taken: Set<string>, root: string) {
  for (const c of cands) if (!taken.has(c.toLowerCase())) { taken.add(c.toLowerCase()); return c }
  for (let i = 2; ; i++) {
    const h = `${root}-${i}`
    if (!taken.has(h)) { taken.add(h); return h }
  }
}

/**
 * A free readable handle for a new dancer (or one getting their first): their
 * name, name + city, then name + the lowest free number — checked against
 * dancers, profiles, handles kept for redirects and RESERVED.
 */
export async function freeHandle(db: any, name: string, city?: string | null): Promise<string> {
  const { sql } = await import('drizzle-orm')
  const raw = String(name || '').includes('@') ? String(name).split('@')[0]! : String(name || '')
  const root = handleSlug(raw) || 'dancer'
  const c = city ? handleSlug(city) : ''
  const wanted = [root, ...(c ? [`${root}-${c}`] : [])].filter(h => h.length >= 3 && !RESERVED.includes(h))
  const like = `${root}%`
  // Can't check (no raw SQL here): the old way, name + a random suffix.
  if (typeof db?.execute !== 'function') return `${root}-${crypto.randomUUID().slice(0, 5)}`
  const res: any = await db.execute(sql`
    select lower(username) as h from dancers where lower(username) like ${like}
    union select lower(x) from dancers, jsonb_array_elements_text(old_usernames) x where lower(x) like ${like}
    union select lower(username) from profiles where lower(username) like ${like}
    union select lower(x) from profiles, jsonb_array_elements_text(coalesce(source_ref->'oldHandles', '[]'::jsonb)) x where lower(x) like ${like}`)
  const taken = new Set<string>([...RESERVED, ...((res.rows ?? res) as any[]).map(r => r.h)])
  return pickHandle(wanted, taken, root)
}
