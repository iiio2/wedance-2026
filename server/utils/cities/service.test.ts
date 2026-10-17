import { describe, expect, it, vi } from 'vitest'
import { createCityService, type CityRow, type CityStore, type NewCityRow } from './service'
import { createPlacesClient, type PlaceDetails, type PlacePrediction, type PlacesClient } from './google'
import { mergeAltNames, slugCandidates, uniqueSlug, isUsefulQuery, localLanguage } from './names'
import { mergeCityResults, type CityOption } from '../../../shared/utils/citySearch'

const MUNICH_ID = 'ChIJ2V-Mo_l1nkcRfZixfUq4DAE'
const BERLIN_ID = 'ChIJAVkDPzdOqEcRcDteW0YgIQQ'

const comps = (city: string, region: string, country: string, cc: string) => [
  { long_name: city, short_name: city, types: ['locality', 'political'] },
  { long_name: region, short_name: region, types: ['administrative_area_level_1', 'political'] },
  { long_name: country, short_name: cc, types: ['country', 'political'] },
]

const DETAILS: Record<string, Record<string, PlaceDetails>> = {
  [MUNICH_ID]: {
    en: { placeId: MUNICH_ID, name: 'Munich', addressComponents: comps('Munich', 'Bavaria', 'Germany', 'DE'), lat: 48.137, lng: 11.575 },
    de: { placeId: MUNICH_ID, name: 'München', addressComponents: comps('München', 'Bayern', 'Deutschland', 'DE'), lat: 48.137, lng: 11.575 },
  },
  ChIJ_london_uk_000: {
    en: { placeId: 'ChIJ_london_uk_000', name: 'London', addressComponents: comps('London', 'England', 'United Kingdom', 'GB'), lat: 51.5, lng: -0.12 },
  },
  ChIJ_london_on_000: {
    en: { placeId: 'ChIJ_london_on_000', name: 'London', addressComponents: comps('London', 'Ontario', 'Canada', 'CA'), lat: 42.98, lng: -81.24 },
  },
}

const PREDICTIONS: Record<string, PlacePrediction[]> = {
  'мюнх': [{ placeId: MUNICH_ID, mainText: 'Munich', secondaryText: 'Germany', description: 'Munich, Germany', types: ['locality'], matchedText: false }],
  'мюнхен': [{ placeId: MUNICH_ID, mainText: 'Munich', secondaryText: 'Germany', description: 'Munich, Germany', types: ['locality'], matchedText: false }],
  'munique': [{ placeId: MUNICH_ID, mainText: 'Munich', secondaryText: 'Germany', description: 'Munich, Germany', types: ['locality'], matchedText: false }],
  'bavari': [{ placeId: MUNICH_ID, mainText: 'Munich', secondaryText: 'Bavaria, Germany', description: 'Munich, Bavaria, Germany', types: ['locality'], matchedText: true }],
  'londo': [
    { placeId: 'ChIJ_london_uk_000', mainText: 'London', secondaryText: 'UK', description: 'London, UK', types: ['locality'], matchedText: true },
    { placeId: 'ChIJ_london_on_000', mainText: 'London', secondaryText: 'ON, Canada', description: 'London, ON, Canada', types: ['locality'], matchedText: true },
  ],
}

function fakePlaces(): PlacesClient & { log: string[] } {
  const log: string[] = []
  return {
    log,
    get calls() { return log.length },
    async autocomplete(input) { log.push(`auto:${input}`); return PREDICTIONS[input.toLowerCase()] ?? [] },
    async details(id, { language = 'en' }) { log.push(`details:${id}:${language}`); return DETAILS[id]?.[language] ?? null },
  }
}

function memoryStore(initial: CityRow[] = [], available = true): CityStore & { rows: CityRow[], writes: number } {
  const s = {
    rows: [...initial],
    writes: 0,
    async available() { return available },
    async list() { return s.rows },
    async slugTaken(slug: string) { return s.rows.some(r => r.slug === slug) },
    async insert(row: NewCityRow) {
      s.writes++
      const existing = s.rows.find(r => r.googlePlaceId === row.googlePlaceId)
      if (existing) return { row: existing, created: false }
      const saved = { ...row, id: `id-${s.rows.length + 1}` }
      s.rows.push(saved)
      return { row: saved, created: true }
    },
    async updateAltNames(id: string, altNames: string[]) {
      s.writes++
      s.rows.find(r => r.id === id)!.altNames = altNames
    },
  }
  return s
}

const munichRow = (alts: string[] = ['München']): CityRow => ({
  id: 'munich-1', googlePlaceId: MUNICH_ID, slug: 'munich', name: 'Munich', localName: 'München',
  country: 'Germany', countryCode: 'DE', region: 'Bavaria', lat: 48.1, lng: 11.5, altNames: alts,
})
const berlinRow: CityRow = {
  id: 'berlin-1', googlePlaceId: BERLIN_ID, slug: 'berlin', name: 'Berlin', localName: 'Berlin',
  country: 'Germany', countryCode: 'DE', region: 'Berlin', lat: 52.5, lng: 13.4, altNames: [],
}
const quiet = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }

describe('city search', () => {
  it('never calls Google for queries under 2 letters', async () => {
    const places = fakePlaces()
    const svc = createCityService({ store: memoryStore([berlinRow]), places, fallback: async () => [], log: quiet })
    await svc.search('')
    await svc.search('м')
    await svc.search(' x ')
    expect(places.log).toEqual([])
  })

  it('answers from the database when it has enough matches — no Google call', async () => {
    const places = fakePlaces()
    const rows = ['Munich', 'Munster', 'Mumbai'].map((n, i) => ({ ...berlinRow, id: `r${i}`, googlePlaceId: `ChIJ_place_${i}_000`, slug: n.toLowerCase(), name: n }))
    const svc = createCityService({ store: memoryStore(rows), places, fallback: async () => [], log: quiet })
    const r = await svc.search('mu')
    expect(r.results.map(c => c.name)).toEqual(['Mumbai', 'Munich', 'Munster'])
    expect(r.google).toBe(false)
    expect(places.calls).toBe(0)
  })

  it('finds a known city by an alt spelling, accent- and case-insensitive', async () => {
    const places = fakePlaces()
    const svc = createCityService({ store: memoryStore([munichRow(['München', 'Мюнхен'])]), places, fallback: async () => [], log: quiet, googleBelow: 1 })
    for (const q of ['MUNCHEN', 'münch', 'мюнхен', 'munich']) {
      const r = await svc.search(q)
      expect(r.results[0]).toMatchObject({ name: 'Munich', id: 'munich-1', source: 'city' })
    }
    expect(places.calls).toBe(0)
  })

  it('merges Google predictions, turning a prediction for a known place into our row', async () => {
    const places = fakePlaces()
    const svc = createCityService({ store: memoryStore([munichRow([])]), places, fallback: async () => [], log: quiet })
    const r = await svc.search('Мюнх', { sessionToken: 'sess-123456' })
    expect(r.google).toBe(true)
    expect(r.results).toHaveLength(1)
    expect(r.results[0]).toMatchObject({ name: 'Munich', id: 'munich-1', source: 'city' })
  })

  it('keeps unknown predictions as google results, deduped by place id', async () => {
    const places = fakePlaces()
    const svc = createCityService({ store: memoryStore([]), places, fallback: async () => [], log: quiet })
    const r = await svc.search('Londo')
    expect(r.results.map(c => [c.name, c.country, c.source])).toEqual([
      ['London', 'UK', 'google'],
      ['London', 'Canada', 'google'],
    ])
  })

  it('caches predictions — the same query twice costs one call', async () => {
    const places = fakePlaces()
    const svc = createCityService({ store: memoryStore([]), places, fallback: async () => [], log: quiet })
    await svc.search('Londo')
    const again = await svc.search('londo')
    expect(again.google).toBe(false)
    expect(places.log).toEqual(['auto:Londo'])
  })

  it('rate-limits Google per IP and degrades to local results', async () => {
    const places = fakePlaces()
    const svc = createCityService({ store: memoryStore([]), places, fallback: async () => [], log: quiet, searchPerMinute: 2 })
    for (const q of ['aaa', 'bbb', 'ccc', 'ddd']) await svc.search(q, { ip: '1.2.3.4' })
    expect(places.calls).toBe(2)
    await svc.search('eee', { ip: '5.6.7.8' })
    expect(places.calls).toBe(3)
  })

  it('ranks table rows by community size, not alphabetically', async () => {
    const places = fakePlaces()
    const munchberg: CityRow = { id: 'mb', googlePlaceId: 'mb-id', slug: 'munchberg', name: 'Münchberg', localName: 'Münchberg', country: 'Germany', countryCode: 'DE', region: 'Bavaria', lat: 50.2, lng: 11.8, altNames: ['Мюнхберг'] }
    const catalogue: CityOption[] = [
      { name: 'Munich', slug: 'munich', country: 'Germany', altNames: ['München'], communities: 975, source: 'catalogue' },
      { name: 'Münchberg', slug: 'munchberg', country: 'Germany', altNames: [], communities: 0, source: 'catalogue' },
    ]
    const svc = createCityService({ store: memoryStore([munchberg, munichRow(['München', 'Мюнхен'])]), places, fallback: async () => catalogue, log: quiet })
    const r = await svc.search('Мюнх')
    expect(r.results.map(c => c.name)).toEqual(['Munich', 'Münchberg'])
    expect(r.results[0]!.communities).toBe(975)
  })

  it('falls back to the catalogue while the table is missing', async () => {
    const places = fakePlaces()
    const catalogue: CityOption[] = [{ name: 'Munich', slug: 'munich', country: 'Germany', altNames: ['München'], communities: 9, source: 'catalogue' }]
    const svc = createCityService({ store: memoryStore([], false), places, fallback: async () => catalogue, log: quiet })
    const r = await svc.search('münchen')
    expect(r.canonical).toBe(false)
    expect(r.results[0]).toMatchObject({ name: 'Munich', source: 'catalogue' })
  })
})

describe('city resolve', () => {
  it('creates the canonical city: English name, local name, alt names, typed spelling', async () => {
    const places = fakePlaces()
    const store = memoryStore([berlinRow])
    const svc = createCityService({ store, places, fallback: async () => [], log: quiet })
    await svc.search('Мюнхен', { sessionToken: 'sess-123456' })
    const r = await svc.resolve(MUNICH_ID, { sessionToken: 'sess-123456', query: 'Мюнхен' })
    expect(r).toMatchObject({ persisted: true, created: true })
    expect(r.city).toMatchObject({ name: 'Munich', localName: 'München', slug: 'munich', country: 'Germany', countryCode: 'DE', region: 'Bavaria', source: 'city' })
    expect(r.city.altNames).toEqual(expect.arrayContaining(['Munich', 'München', 'Munchen', 'Мюнхен']))
    // English details inside the session, local-language details once.
    expect(places.log).toEqual(['auto:Мюнхен', `details:${MUNICH_ID}:en`, `details:${MUNICH_ID}:de`])
  })

  it('maps München, Мюнхен, Munique and munich to the same saved value', async () => {
    const places = fakePlaces()
    const store = memoryStore([])
    const svc = createCityService({ store, places, fallback: async () => [], log: quiet })
    const values = new Set<string>()
    for (const q of ['München', 'Мюнхен', 'Munique', 'munich']) {
      const r = await svc.resolve(MUNICH_ID, { query: q, trustQuery: true })
      values.add(r.city.name)
    }
    expect([...values]).toEqual(['Munich'])
    expect(store.rows).toHaveLength(1)
    expect(store.rows[0]!.altNames).toEqual(expect.arrayContaining(['München', 'Мюнхен', 'Munique']))
    // Only the first pick paid for Details; the rest were database hits.
    expect(places.calls).toBe(2)
  })

  it('remembers a typed spelling only when Google matched another name of the place', async () => {
    const places = fakePlaces()
    const store = memoryStore([munichRow([])])
    const svc = createCityService({ store, places, fallback: async () => [], log: quiet, googleBelow: 5 })
    await svc.search('Bavari')
    await svc.resolve(MUNICH_ID, { query: 'Bavari' }) // matched the region text → not a spelling
    await svc.resolve(MUNICH_ID, { query: 'Мюнхен' }) // no prediction cached for it → dropped
    expect(store.rows[0]!.altNames).toEqual([])
    await svc.search('Мюнх')
    await svc.resolve(MUNICH_ID, { query: 'Мюнх' })
    expect(store.rows[0]!.altNames).toEqual(['Мюнх'])
  })

  it('returns an existing city without calling Google', async () => {
    const places = fakePlaces()
    const svc = createCityService({ store: memoryStore([munichRow()]), places, fallback: async () => [], log: quiet })
    const r = await svc.resolve(MUNICH_ID, { query: 'Muni' })
    expect(r).toMatchObject({ persisted: true, created: false, city: { id: 'munich-1', name: 'Munich' } })
    expect(places.calls).toBe(0)
  })

  it('does not store prefixes of names it already matches, and upgrades a stored prefix', async () => {
    const places = fakePlaces()
    const store = memoryStore([munichRow(['München'])])
    const svc = createCityService({ store, places, fallback: async () => [], log: quiet })
    await svc.resolve(MUNICH_ID, { query: 'Mün', trustQuery: true })
    expect(store.rows[0]!.altNames).toEqual(['München'])
    await svc.resolve(MUNICH_ID, { query: 'Мюнх', trustQuery: true })
    await svc.resolve(MUNICH_ID, { query: 'Мюнхен', trustQuery: true })
    expect(store.rows[0]!.altNames).toEqual(['München', 'Мюнхен'])
  })

  it('gives a second London a country-qualified slug', async () => {
    const places = fakePlaces()
    const store = memoryStore([])
    const svc = createCityService({ store, places, fallback: async () => [], log: quiet })
    const uk = await svc.resolve('ChIJ_london_uk_000')
    const ca = await svc.resolve('ChIJ_london_on_000')
    expect(uk.city.slug).toBe('london')
    expect(ca.city.slug).toBe('london-ca')
    // English-speaking countries: no local-language call, local name = name.
    expect(uk.city.localName).toBe('London')
    expect(places.log.filter(l => l.startsWith('details'))).toHaveLength(2)
  })

  it('resolves without persisting while the table is missing, and says so', async () => {
    const places = fakePlaces()
    const store = memoryStore([], false)
    const log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
    const svc = createCityService({ store, places, fallback: async () => [], log })
    const r = await svc.resolve(MUNICH_ID, { query: 'Мюнх', trustQuery: true })
    expect(r).toMatchObject({ persisted: false, city: { name: 'Munich', slug: 'munich', id: null } })
    expect(store.writes).toBe(0)
    expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('persistence is pending migration 0024'))
    // Cached: picking it again is free.
    await svc.resolve(MUNICH_ID)
    expect(places.calls).toBe(2)
  })

  it('rejects malformed place ids before any call', async () => {
    const places = fakePlaces()
    const svc = createCityService({ store: memoryStore([]), places, fallback: async () => [], log: quiet })
    await expect(svc.resolve('../../etc')).rejects.toMatchObject({ code: 'BAD_PLACE' })
    expect(places.calls).toBe(0)
  })
})

describe('Places client', () => {
  it('sends types=(cities), language, session token and the key; parses predictions', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(JSON.stringify({
      status: 'OK',
      predictions: [{ place_id: MUNICH_ID, description: 'Munich, Germany', structured_formatting: { main_text: 'Munich', secondary_text: 'Germany' }, types: ['locality'] }],
    })))
    const client = createPlacesClient('test-key', fetchMock as unknown as typeof fetch)
    const preds = await client.autocomplete('Мюнх', { sessionToken: 'sess-1' })
    const url = new URL(fetchMock.mock.calls[0]![0])
    expect(url.pathname).toBe('/maps/api/place/autocomplete/json')
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ input: 'Мюнх', types: '(cities)', language: 'en', sessiontoken: 'sess-1', key: 'test-key' })
    expect(preds).toEqual([{ placeId: MUNICH_ID, mainText: 'Munich', secondaryText: 'Germany', description: 'Munich, Germany', types: ['locality'], matchedText: false }])
    expect(client.calls).toBe(1)
  })

  it('venue search: types=establishment biased around the city; details carry the formatted address', async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('/details/')
      ? { status: 'OK', result: { place_id: 'ChIJvenue', name: 'Café Kosmos', formatted_address: 'Dachauer Str. 7, 80335 München, Germany', geometry: { location: { lat: 48.14, lng: 11.56 } } } }
      : { status: 'OK', predictions: [{ place_id: 'ChIJvenue', description: 'Café Kosmos, Dachauer Str., München', structured_formatting: { main_text: 'Café Kosmos', secondary_text: 'Dachauer Str., München' }, types: ['bar'] }] })))
    const client = createPlacesClient('test-key', fetchMock as unknown as typeof fetch)
    const preds = await client.autocomplete('Kosmos', { sessionToken: 'sess-2', types: 'establishment', near: { lat: 48.137, lng: 11.575, radius: 30000 } })
    const url = new URL(fetchMock.mock.calls[0]![0])
    expect(Object.fromEntries(url.searchParams)).toMatchObject({ input: 'Kosmos', types: 'establishment', location: '48.137,11.575', radius: '30000', sessiontoken: 'sess-2' })
    expect(preds[0]).toMatchObject({ placeId: 'ChIJvenue', mainText: 'Café Kosmos' })
    const d = await client.details('ChIJvenue', { sessionToken: 'sess-2' })
    expect(new URL(fetchMock.mock.calls[1]![0]).searchParams.get('fields')).toContain('formatted_address')
    expect(d).toMatchObject({ name: 'Café Kosmos', formattedAddress: 'Dachauer Str. 7, 80335 München, Germany', lat: 48.14, lng: 11.56 })
  })

  it('treats ZERO_RESULTS as empty and other statuses as errors without leaking the key', async () => {
    const zero = createPlacesClient('k', (async () => new Response('{"status":"ZERO_RESULTS"}')) as unknown as typeof fetch)
    expect(await zero.autocomplete('zzz', {})).toEqual([])
    const denied = createPlacesClient('secret-key', (async () => new Response('{"status":"REQUEST_DENIED","error_message":"nope"}')) as unknown as typeof fetch)
    await expect(denied.details(MUNICH_ID, {})).rejects.toThrow(/REQUEST_DENIED/)
    await expect(denied.details(MUNICH_ID, {})).rejects.not.toThrow(/secret-key/)
  })
})

describe('naming rules', () => {
  it('slug candidates: name → name-cc → name-region-cc → numbered', async () => {
    const c = slugCandidates('São Paulo', 'BR', 'São Paulo')
    expect(c.slice(0, 3)).toEqual(['sao-paulo', 'sao-paulo-br', 'sao-paulo-br-2'])
    const f = slugCandidates('Frankfurt', 'DE', 'Brandenburg')
    expect(f.slice(0, 3)).toEqual(['frankfurt', 'frankfurt-de', 'frankfurt-brandenburg-de'])
    expect(await uniqueSlug(f, s => ['frankfurt', 'frankfurt-de'].includes(s))).toBe('frankfurt-brandenburg-de')
  })

  it('local language only for single-language, non-English countries', () => {
    expect(localLanguage('DE')).toBe('de')
    expect(localLanguage('ua')).toBe('uk')
    expect(localLanguage('GB')).toBeNull()
    expect(localLanguage('CH')).toBeNull()
    expect(localLanguage(null)).toBeNull()
  })

  it('alt names dedupe by folded form and keep protected names', () => {
    expect(mergeAltNames(['München'], ['MÜNCHEN', 'Munchen', 'Мюнхен'], ['Munich', 'München'])).toEqual(['München', 'Munchen', 'Мюнхен'])
    expect(isUsefulQuery('mu', ['Munich'])).toBe(false)
    expect(isUsefulQuery('Muni', ['Munich'])).toBe(false)
    expect(isUsefulQuery('Мюнх', ['Munich', 'München'])).toBe(true)
    expect(isUsefulQuery('Berchtesg', ['Ramsau bei Berchtesgaden'])).toBe(false)
  })
})

describe('mergeCityResults', () => {
  const known: CityOption = { id: 'm1', placeId: MUNICH_ID, slug: 'munich', name: 'Munich', country: 'Germany', altNames: [], communities: 5, source: 'city' }
  const pred: CityOption = { id: null, placeId: MUNICH_ID, slug: '', name: 'Munich', country: 'Germany', altNames: [], communities: 0, source: 'google' }
  const catalogue: CityOption = { slug: 'munich', name: 'Munich', country: 'Germany', altNames: [], communities: 5, source: 'catalogue' }

  it('dedupes by place id and prefers the known row, in either order', () => {
    expect(mergeCityResults([[known], [pred]])).toEqual([known])
    expect(mergeCityResults([[pred], [known]])).toEqual([known])
  })

  it('drops a Google prediction that names a city already listed (same name + country)', () => {
    expect(mergeCityResults([[catalogue], [pred]])).toEqual([catalogue])
  })

  it('treats a listed city without a country as the same place as a same-named prediction', () => {
    const noCountry = { ...catalogue, country: null }
    expect(mergeCityResults([[noCountry], [pred]])).toEqual([noCountry])
    // …but not a same-named city in a different country.
    expect(mergeCityResults([[catalogue], [{ ...pred, placeId: 'other', country: 'USA' }]])).toHaveLength(2)
  })

  it('respects the limit', () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ ...known, id: `x${i}`, placeId: `p${i}`, slug: `s${i}`, name: `City ${i}` }))
    expect(mergeCityResults([many], 5)).toHaveLength(5)
  })
})
