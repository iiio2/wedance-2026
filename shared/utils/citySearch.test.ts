import { describe, expect, it } from 'vitest'
import { buildCityOptions, citySlug, matchRange, normalizeCity, searchCities, type CityOption } from './citySearch'

const opt = (name: string, communities = 0, extra: Partial<CityOption> = {}): CityOption =>
  ({ name, slug: name.toLowerCase().replace(/\s+/g, '-'), country: null, altNames: [], communities, ...extra })

const cities = [
  opt('Munich', 120, { country: 'Germany', altNames: ['München', 'Múnich'] }),
  opt('Berlin', 90, { country: 'Germany' }),
  opt('Bern', 3, { country: 'Switzerland' }),
  opt('São Paulo', 10, { country: 'Brazil' }),
  opt('Frankfurt am Main', 5, { country: 'Germany' }),
  opt('Mumbai', 1, { country: 'India' }),
]

describe('normalizeCity', () => {
  it('folds accents, case and punctuation', () => {
    expect(normalizeCity('  São-Paulo ')).toBe('sao paulo')
    expect(normalizeCity('MÜNCHEN')).toBe('munchen')
  })
})

describe('searchCities', () => {
  it('ranks name prefix first, then by community size', () => {
    expect(searchCities(cities, 'ber').map(c => c.name)).toEqual(['Berlin', 'Bern'])
    expect(searchCities(cities, 'mu').map(c => c.name)).toEqual(['Munich', 'Mumbai'])
  })
  it('matches alternative spellings without accents', () => {
    expect(searchCities(cities, 'munchen')[0]!.name).toBe('Munich')
    expect(searchCities(cities, 'sao')[0]!.name).toBe('São Paulo')
  })
  it('matches later words and countries', () => {
    expect(searchCities(cities, 'main')[0]!.name).toBe('Frankfurt am Main')
    expect(searchCities(cities, 'brazil').map(c => c.name)).toEqual(['São Paulo'])
  })
  it('empty query returns the biggest communities', () => {
    expect(searchCities(cities, '', 2).map(c => c.name)).toEqual(['Munich', 'Berlin'])
  })
  it('ignores short mid-word matches', () => {
    expect(searchCities([opt('Dortmund'), opt('Munich')], 'mün').map(c => c.name)).toEqual(['Munich'])
    expect(searchCities([opt('Dortmund')], 'tmund').map(c => c.name)).toEqual(['Dortmund'])
  })
  it('returns nothing for gibberish', () => {
    expect(searchCities(cities, 'xqzz')).toEqual([])
  })
})

describe('matchRange', () => {
  it('maps the folded match back to the original string', () => {
    expect(matchRange('São Paulo', 'sao')).toEqual([0, 3])
    expect(matchRange('Frankfurt am Main', 'main')).toEqual([13, 17])
    expect(matchRange('Munich', 'xyz')).toBeNull()
    expect(matchRange('Munich', '')).toBeNull()
  })
})

describe('buildCityOptions', () => {
  it('counts profile cities and enriches them from the image catalogue', () => {
    const out = buildCityOptions(
      [{ city: 'Munich', citySlug: 'munich' }, { city: 'Munich', citySlug: 'munich' }, { city: null, citySlug: 'x' }],
      { 'munich': { country: 'Germany', altNames: ['München'] }, 'sao-paulo': { country: 'Brazil', altNames: ['São Paulo'] }, 'new-york': {} },
    )
    const by = Object.fromEntries(out.map(o => [o.slug, o]))
    expect(by.munich).toMatchObject({ name: 'Munich', communities: 2, country: 'Germany', altNames: ['München'] })
    expect(by['sao-paulo']!.name).toBe('São Paulo')
    expect(by['new-york']!.name).toBe('New York')
    expect(by.x).toBeUndefined()
  })
  it('drops alt names that just wrap the city name', () => {
    const [o] = buildCityOptions([], { oeiras: { altNames: ['Oeiras', 'Município de Oeiras', 'Оэйраш'] } })
    expect(o!.altNames).toEqual(['Оэйраш'])
  })
})

describe('normalizeCity / citySlug: letters NFKD cannot fold', () => {
  it('folds ł ø æ ß so slugs and search stay ASCII', () => {
    expect(citySlug('Wrocław')).toBe('wroclaw')
    expect(citySlug('Łódź')).toBe('lodz')
    expect(citySlug('Tromsø')).toBe('tromso')
    expect(normalizeCity('Straße')).toBe('strasse')
  })
})

