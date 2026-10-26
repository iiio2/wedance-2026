import { citySlug, normalizeCity } from '../../../shared/utils/citySearch'

/**
 * Naming rules for canonical cities: which language a country's "local name"
 * is in, how slugs stay unique, and how alternative spellings accumulate.
 * Pure functions — unit-tested in names.test.ts.
 */

/**
 * Country (ISO 3166-1 alpha-2) → the language its city names are written in.
 * Only single-language countries: for CH, BE, CA, LU … one language would be
 * wrong for half the cities (Genève isn't "Genf"), so they get no local-name
 * call. English-speaking countries map to 'en' = the canonical name already is
 * the local one, no extra call.
 */
export const COUNTRY_LANGUAGE: Record<string, string> = {
  DE: 'de', AT: 'de', LI: 'de',
  FR: 'fr', MC: 'fr',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', CU: 'es', DO: 'es', EC: 'es', UY: 'es', PY: 'es', BO: 'es', CR: 'es', PA: 'es', GT: 'es', HN: 'es', SV: 'es', NI: 'es', PR: 'es',
  IT: 'it', SM: 'it',
  PT: 'pt', BR: 'pt', AO: 'pt', MZ: 'pt',
  NL: 'nl',
  PL: 'pl', CZ: 'cs', SK: 'sk', HU: 'hu', RO: 'ro', MD: 'ro', BG: 'bg', HR: 'hr', SI: 'sl', RS: 'sr', BA: 'bs', ME: 'sr', MK: 'mk', AL: 'sq',
  GR: 'el', CY: 'el', TR: 'tr',
  RU: 'ru', BY: 'be', UA: 'uk', KZ: 'kk', GE: 'ka', AM: 'hy', AZ: 'az',
  LT: 'lt', LV: 'lv', EE: 'et', FI: 'fi', SE: 'sv', NO: 'no', DK: 'da', IS: 'is',
  IL: 'he', JP: 'ja', KR: 'ko', CN: 'zh-CN', TW: 'zh-TW', TH: 'th', VN: 'vi', ID: 'id',
  US: 'en', GB: 'en', IE: 'en', AU: 'en', NZ: 'en', JM: 'en', TT: 'en', NG: 'en', GH: 'en', KE: 'en', ZA: 'en', MT: 'en',
}

/** Language for the local-name Details call, or null when none is needed / knowable. */
export function localLanguage(countryCode: string | null | undefined): string | null {
  const lang = countryCode ? COUNTRY_LANGUAGE[countryCode.toUpperCase()] : undefined
  return lang && lang !== 'en' ? lang : null
}

/** Slug candidates in preference order: "munich" → "munich-de" → "munich-bavaria-de" → "munich-de-2" … */
export function slugCandidates(name: string, countryCode?: string | null, region?: string | null, placeId?: string): string[] {
  const base = citySlug(name) || (placeId ? `city-${placeId.slice(-8).toLowerCase().replace(/[^a-z0-9]/g, '')}` : 'city')
  const cc = (countryCode ?? '').toLowerCase()
  const reg = citySlug(region ?? '')
  const out = [base]
  if (cc) out.push(`${base}-${cc}`)
  if (reg && reg !== base) out.push(cc ? `${base}-${reg}-${cc}` : `${base}-${reg}`)
  const last = out.at(-1)!
  for (let i = 2; i < 50; i++) out.push(`${last}-${i}`)
  return out
}

/** First free slug. `taken` checks the database (or an in-memory set). */
export async function uniqueSlug(candidates: string[], taken: (slug: string) => boolean | Promise<boolean>): Promise<string> {
  for (const s of candidates) if (!(await taken(s))) return s
  throw new Error(`cities: no free slug among ${candidates[0]}…`)
}

/** ASCII-folded form ("München" → "Munchen"), kept as a searchable spelling. */
export function asciiFold(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ı/g, 'i').replace(/ß/g, 'ss')
}

/**
 * Should a typed query be remembered as a spelling of the city it resolved to?
 * Yes when it is 3+ letters and NOT just the start of a name we already match
 * ("Muni" adds nothing — it already finds Munich). "Мюнх" does get stored; the
 * next person typing it finds Munich without asking Google.
 */
export function isUsefulQuery(query: string | null | undefined, known: string[]): boolean {
  const q = normalizeCity(query ?? '')
  if (q.length < 3) return false
  // Redundant when it already finds the city: name/alt prefix, word prefix ("Berchtesg" in
  // "Ramsau bei Berchtesgaden") or substring.
  return !known.some((k) => {
    const n = normalizeCity(k)
    return n.startsWith(q) || n.includes(q)
  })
}

/**
 * Add spellings to an alt-name list. Case-insensitive dedupe (first spelling
 * wins; "Munchen" is kept next to "München" so plain SQL lookups find it too), and a longer spelling replaces a shorter one it extends
 * ("Мюнх" is dropped once "Мюнхен" arrives) — except protected names
 * (canonical + local) which are never removed.
 */
export function mergeAltNames(existing: string[], additions: Array<string | null | undefined>, protectedNames: Array<string | null | undefined> = []): string[] {
  const keep = new Set(protectedNames.filter(Boolean).map(n => normalizeCity(n!)))
  const out = existing.filter(Boolean)
  for (const raw of additions) {
    const a = raw?.trim()
    if (!a) continue
    const n = normalizeCity(a)
    if (!n) continue
    const lower = a.toLowerCase()
    if (out.some(e => e.toLowerCase() === lower)) continue
    // Already covered by a longer spelling.
    if (out.some(e => { const f = normalizeCity(e); return f.startsWith(n) && f !== n }) && !keep.has(n)) continue
    // Replace shorter prefixes it extends.
    for (let i = out.length - 1; i >= 0; i--) {
      const e = normalizeCity(out[i]!)
      if (n.startsWith(e) && e !== n && !keep.has(e)) out.splice(i, 1)
    }
    out.push(a)
  }
  return out
}
