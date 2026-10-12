/**
 * City typeahead — the data shape and the matching rules behind <CityCombobox>.
 *
 * Shared on purpose: the server matches the canonical `cities` table with these
 * rules (server/utils/cities/), the client filters the known-city list with the
 * same rules on every keystroke, and only asks the server (→ Google Places) when
 * the city isn't known yet.
 */

export interface CityOption {
  /** Canonical English name ("Munich"), also the value written to v-model. */
  name: string
  /** URL slug — /cities/<slug>. Empty for a Google suggestion that isn't resolved yet. */
  slug: string
  country: string | null
  /** Other spellings that should match: München, Múnich, Мюнхен … */
  altNames: string[]
  /** Visible venues + artists + organisers listed in this city. Ranks the list. */
  communities: number
  /** `cities.id` — set once the city is a canonical row in our database. */
  id?: string | null
  /** Google place id — set for canonical rows and for Google suggestions. */
  placeId?: string | null
  /** Name in the country's own language ("München"). */
  localName?: string | null
  countryCode?: string | null
  region?: string | null
  lat?: number | null
  lng?: number | null
  /**
   * Where the option came from: `city` = canonical row (safe to save),
   * `google` = a Places prediction that must be resolved before it is saved,
   * `catalogue` = the pre-migration list (profile cities + city-images.json),
   * used only until the `cities` table exists.
   */
  source?: 'city' | 'google' | 'catalogue'
  /** Google suggestion: secondary text ("Bavaria, Germany"). */
  description?: string | null
}

/** A suggestion that still needs `/api/city-resolve` before it can be saved. */
export function needsResolve(o: CityOption): boolean {
  return o.source === 'google' && !o.id
}

/** Stable identity for de-duplication: place id first, then slug, then folded name + country. */
export function cityKey(o: CityOption): string {
  if (o.placeId) return `p:${o.placeId}`
  if (o.slug) return `s:${o.slug}`
  return `n:${normalizeCity(o.name)}|${normalizeCity(o.country ?? '')}`
}

/**
 * Merge result lists in priority order, dropping duplicates. A city we already
 * know (has an id / slug) wins over the Google prediction for the same place,
 * so "Мюнх" shows our "Munich" row instead of an unresolved prediction.
 */
export function mergeCityResults(lists: CityOption[][], limit = 8): CityOption[] {
  const out: CityOption[] = []
  const seen = new Map<string, number>()
  // folded name → [index, folded country] of listed non-Google cities
  const names = new Map<string, Array<[number, string]>>()
  const index = (o: CityOption, i: number) => {
    seen.set(cityKey(o), i)
    if (o.placeId && o.slug) seen.set(`s:${o.slug}`, i)
    if (o.source !== 'google') {
      const n = normalizeCity(o.name)
      names.set(n, [...(names.get(n) ?? []), [i, normalizeCity(o.country ?? '')]])
    }
  }
  for (const list of lists) {
    for (const o of list) {
      let at = seen.get(cityKey(o)) ?? (o.placeId && o.slug ? seen.get(`s:${o.slug}`) : undefined)
      // A Google prediction named like a city already listed (same country, or
      // the listed one has none) is that city — keep the listed one.
      if (at === undefined && o.source === 'google') {
        const c = normalizeCity(o.country ?? '')
        at = names.get(normalizeCity(o.name))?.find(([, k]) => !k || !c || k === c)?.[0]
      }
      if (at !== undefined) {
        if (needsResolve(out[at]!) && !needsResolve(o)) { out[at] = o; index(o, at) }
        continue
      }
      out.push(o)
      index(o, out.length - 1)
    }
  }
  return out.slice(0, limit)
}

/** Lowercase, strip accents, collapse punctuation — "São Paulo" and "sao paulo" compare equal. */
// Letters NFKD can't decompose to ASCII. Without this "Wrocław" slugged to
// "wroc-aw" and "lodz" never matched "Łódź".
const FOLD: Record<string, string> = { ł: 'l', đ: 'd', ð: 'd', ø: 'o', æ: 'ae', œ: 'oe', ß: 'ss', þ: 'th', ı: 'i', ħ: 'h', ŧ: 't' }

export function normalizeCity(s: string): string {
  return s
    .toLowerCase()
    .replace(/[łđðøæœßþıħŧ]/g, ch => FOLD[ch]!)
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

export function citySlug(s: string): string {
  return normalizeCity(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

/** "new-york" → "New York". Fallback name for image-only cities. */
export function titleFromSlug(slug: string): string {
  return slug.split('-').filter(Boolean).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

/**
 * Score one option against a normalised query. Higher is better, 0 = no match.
 * Name prefix > alt-name prefix > word prefix > substring > country prefix.
 */
function score(o: CityOption, q: string): number {
  const name = normalizeCity(o.name)
  if (name === q) return 100
  if (name.startsWith(q)) return 80
  const alts = o.altNames.map(normalizeCity)
  if (alts.some(a => a === q || a.startsWith(q))) return 70
  if (name.split(' ').some(w => w.startsWith(q))) return 60
  // Mid-word matches only once the query is specific enough — at 3 letters
  // "mun" would surface Dortmund and "ber" Amberes (Antwerp).
  if (q.length >= 4 && (name.includes(q) || alts.some(a => a.includes(q)))) return 40
  if (o.country && normalizeCity(o.country).startsWith(q)) return 20
  return 0
}

/**
 * Filter + rank. Ties break on community size, then name. Empty query → the
 * biggest communities (the "popular" list shown when the field is focused).
 */
export function searchCities(options: CityOption[], query: string, limit = 8): CityOption[] {
  const q = normalizeCity(query)
  const byCommunity = (a: CityOption, b: CityOption) => b.communities - a.communities || a.name.localeCompare(b.name)
  if (!q) return [...options].sort(byCommunity).slice(0, limit)
  return options
    .map(o => ({ o, s: score(o, q) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s || byCommunity(a.o, b.o))
    .slice(0, limit)
    .map(x => x.o)
}

/** Character ranges of the first match in `text`, for highlighting. null = no visible match (e.g. matched an alt name). */
export function matchRange(text: string, query: string): [number, number] | null {
  const q = normalizeCity(query)
  if (!q) return null
  // Normalise char-by-char so indexes map back to the original string.
  const folded = [...text].map(c => normalizeCity(c) || ' ')
  const flat = folded.join('')
  const at = flat.indexOf(q)
  if (at < 0) return null
  // Rebuild offsets: each original char contributed folded[i].length chars.
  let pos = 0, start = -1, end = -1, i = 0
  const chars = [...text]
  for (; i < chars.length; i++) {
    const next = pos + folded[i]!.length
    if (start < 0 && next > at) start = i
    if (next >= at + q.length) { end = i + 1; break }
    pos = next
  }
  if (start < 0 || end < 0) return null
  const offset = (n: number) => chars.slice(0, n).join('').length
  return [offset(start), offset(end)]
}

/**
 * Drop alt names that only wrap the main one ("Município de Oeiras",
 * "Oeiras Municipality") — they add nothing and make "mun" match Oeiras.
 */
export function usefulAlts(alts: string[], slug: string): string[] {
  const base = normalizeCity(slug.replace(/-/g, ' '))
  const seen = new Set<string>([base])
  return alts.filter((a) => {
    const n = normalizeCity(a)
    if (!n || seen.has(n) || (n.includes(base) && n !== base)) return false
    seen.add(n)
    return true
  })
}

type ProfileCityRow = { city: string | null, citySlug: string | null }
type CityImage = { country?: string | null, altNames?: string[] }

/**
 * Merge the cities people have listed (real names, counted) with the
 * illustrated-city catalogue (country + alternative spellings). Image-only
 * cities still appear so a newcomer in, say, Trieste gets a suggestion.
 */
export function buildCityOptions(rows: ProfileCityRow[], images: Record<string, CityImage>): CityOption[] {
  const map = new Map<string, CityOption>()
  for (const r of rows) {
    if (!r.city || !r.citySlug) continue
    const e = map.get(r.citySlug) ?? { name: r.city.trim(), slug: r.citySlug, country: null, altNames: [], communities: 0 }
    e.communities++
    map.set(r.citySlug, e)
  }
  for (const [slug, img] of Object.entries(images)) {
    const alts = usefulAlts(img.altNames ?? [], slug)
    const e = map.get(slug)
    if (e) {
      e.country = img.country ?? null
      e.altNames = alts
      continue
    }
    // Prefer an alt spelling that slugifies back to the key: "sao-paulo" → "São Paulo".
    const name = (img.altNames ?? []).find(a => citySlug(a) === slug) ?? titleFromSlug(slug)
    map.set(slug, { name, slug, country: img.country ?? null, altNames: alts, communities: 0 })
  }
  return [...map.values()]
}
