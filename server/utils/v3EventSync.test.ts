import { describe, it, expect } from 'vitest'
import { toMs, mapStyles, parseVenue, cityFromAddress, buildCityIndex, resolveCity, resolveTimezone, mapV3Event, learnPlaceLocalities, decodeValue, seriesKey, dedupeKey, selectRows, type MappedEvent } from './v3EventSync'

const MUNICH = 'ChIJ2V-Mo_l1nkcRfZixfUq4DAE'
const NOW = Date.parse('2026-10-04T00:00:00Z')
const cityIndex = buildCityIndex([{ city: 'Munich', citySlug: 'munich' }, { city: 'Prague', citySlug: 'prague' }])
const ctx = { now: NOW, cityIndex, placeLocality: new Map<string, string>(), knownProfiles: new Map([['montunoclub', 'MontunoClub']]) }

const munichVenue = {
  name: 'Buena Vista Bar',
  formatted_address: 'Herzog-Wilhelm-Straße 8, 80331 München, Germany',
  address_components: [
    { long_name: 'München', short_name: 'München', types: ['locality', 'political'] },
    { long_name: 'Germany', short_name: 'DE', types: ['country', 'political'] },
  ],
  geometry: { location: { lat: 48.137, lng: 11.566 } },
}
const base = { id: 'abc', type: 'event', name: 'Salsa Social', eventType: 'Party', startDate: Date.parse('2026-10-10T18:00:00Z'), endDate: Date.parse('2026-10-10T22:00:00Z'), venue: munichVenue, place: MUNICH, styles: { Salsa: { selected: true } }, org: { username: 'MontunoClub' }, visibility: 'Public' }

describe('toMs', () => {
  it('normalises epoch ms, seconds, numeric strings, ISO strings, Timestamps', () => {
    expect(toMs(1796644800000)).toBe(1796644800000)
    expect(toMs(1796644800)).toBe(1796644800000)
    expect(toMs('1796644800000')).toBe(1796644800000)
    expect(toMs('2026-10-10T18:00:00.000Z')).toBe(Date.parse('2026-10-10T18:00:00Z'))
    expect(toMs({ _seconds: 1796644800, _nanoseconds: 0 })).toBe(1796644800000)
    expect(toMs(new Date('2026-10-10T18:00:00Z'))).toBe(Date.parse('2026-10-10T18:00:00Z'))
    expect(toMs('not a date')).toBeNull()
    expect(toMs(null)).toBeNull()
  })
})

describe('mapStyles', () => {
  it('maps the Firestore style map to 2026 labels, de-duplicated', () => {
    expect(mapStyles({ salsa: { selected: true }, Salsa: { selected: true }, BrazilianZouk: { selected: true }, UrbanKizz: {} }).styles).toEqual(['Salsa', 'Zouk', 'Urban Kiz'])
  })
  it('drops unselected styles', () => {
    expect(mapStyles({ Salsa: { selected: true }, Bachata: { selected: false } }).styles).toEqual(['Salsa'])
  })
  it('parses styles stored as a JSON string', () => {
    expect(mapStyles('{"Bachata":{"selected":true},"Kizomba":{"selected":true}}').styles).toEqual(['Bachata', 'Kizomba'])
  })
  it('never turns a spread string into "0","1",… tags', () => {
    const spread = Object.fromEntries([...'{"Salsa":{"selected":true}}'].map((c, i) => [String(i), c]))
    expect(mapStyles(spread).styles).toEqual(['Salsa'])
  })
  it('keeps unknown keys as humanised labels and reports them', () => {
    expect(mapStyles({ AfroHouse: { selected: true } })).toEqual({ styles: ['Afro House'], unmapped: ['AfroHouse'] })
  })
})

describe('venue + city', () => {
  it('parses a Google Places venue (object or JSON string)', () => {
    const v = parseVenue(JSON.stringify(munichVenue))!
    expect(v).toMatchObject({ name: 'Buena Vista Bar', locality: 'München', countryCode: 'DE', lat: 48.137, lng: 11.566 })
  })
  it('accepts a plain address string', () => {
    expect(parseVenue('Some Club, Main St 1')).toMatchObject({ name: 'Some Club', address: 'Some Club, Main St 1', lat: null })
  })
  it('extracts a city from Czech-style addresses with no locality component', () => {
    expect(cityFromAddress('Běhounská 22, 612 00 Brno-Brno-střed, Czechia')).toBe('Brno')
    expect(cityFromAddress('Dlouhá 741/13, 110 00 Praha 1-Staré Město, Czechia')).toBe('Praha')
  })
  it('resolves local-language names to 2026 city slugs', () => {
    expect(resolveCity('München', cityIndex)).toEqual({ slug: 'munich', name: 'Munich' })
    expect(resolveCity('Praha', cityIndex)).toEqual({ slug: 'prague', name: 'Prague' })
    expect(resolveCity('Santa Susanna', cityIndex)).toEqual({ slug: 'santa-susanna', name: 'Santa Susanna' })
  })
  it('learns a city place id from sibling events', () => {
    expect(learnPlaceLocalities([{ ...base, id: 'x' }]).get(MUNICH)).toBe('München')
  })
  it('picks a timezone per country, splitting multi-zone countries', () => {
    expect(resolveTimezone('DE', 11.5)).toBe('Europe/Berlin')
    expect(resolveTimezone('CA', -73.6)).toBe('America/Toronto')
    expect(resolveTimezone('US', -122.4)).toBe('America/Los_Angeles')
    expect(resolveTimezone('ES', -15.4)).toBe('Atlantic/Canary')
    expect(resolveTimezone(null, null)).toBe('Europe/Berlin')
  })
})

describe('mapV3Event', () => {
  it('maps a full Munich event', () => {
    const r = mapV3Event(base, ctx)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row).toMatchObject({
      sourceId: 'abc', slug: 'v3-abc', name: 'Salsa Social', type: 'Party', citySlug: 'munich', city: 'Munich',
      timezone: 'Europe/Berlin', venueName: 'Buena Vista Bar', styles: ['Salsa'],
      organizerUsername: 'montunoclub', organizerName: 'MontunoClub', isFestival: false,
    })
    expect(r.row.startDate.toISOString()).toBe('2026-10-10T18:00:00.000Z')
  })
  it('accepts ISO-string dates and derives a missing end from duration', () => {
    const r = mapV3Event({ ...base, startDate: '2026-10-10T18:00:00.000Z', endDate: null, duration: '90' }, ctx)
    expect(r.ok && r.row.endDate.toISOString()).toBe('2026-10-10T19:30:00.000Z')
  })
  it('flags festival types and does not link the seeding bot as organiser', () => {
    const r = mapV3Event({ ...base, eventType: 'Congress', org: { username: 'wedance-bot' } }, ctx)
    expect(r.ok && r.row.isFestival).toBe(true)
    expect(r.ok && r.row.organizerUsername).toBeNull()
  })
  it('does not link organisers that have no 2026 profile', () => {
    const r = mapV3Event({ ...base, org: { username: 'Unknown', name: 'Unknown School' } }, ctx)
    expect(r.ok && r.row.organizerUsername).toBeNull()
    expect(r.ok && r.row.organizerName).toBe('Unknown School')
  })
  it('skips with a reason', () => {
    expect(mapV3Event({ ...base, startDate: Date.parse('2026-01-01T00:00:00Z') }, ctx)).toEqual({ ok: false, reason: 'past' })
    expect(mapV3Event({ ...base, visibility: 'Unlisted' }, ctx)).toEqual({ ok: false, reason: 'unlisted' })
    expect(mapV3Event({ ...base, type: 'post' }, ctx)).toEqual({ ok: false, reason: 'not-event' })
    expect(mapV3Event({ ...base, venue: null, place: undefined }, ctx)).toEqual({ ok: false, reason: 'no-venue' })
    expect(mapV3Event({ ...base, startDate: 'soon' }, ctx)).toEqual({ ok: false, reason: 'bad-date' })
  })
  it('strips the v3 claim-your-listing boilerplate but keeps the source line', () => {
    const r = mapV3Event({ ...base, description: '🔔 Is this your event? Claim your free WeDance listing.\n\nℹ️ Imported by WeDance.\n\nSource: https://x.de' }, ctx)
    expect(r.ok && r.row.description).toBe('ℹ️ Imported by WeDance.\n\nSource: https://x.de')
  })
})

describe('decodeValue (Firestore REST)', () => {
  it('decodes nested typed values', () => {
    expect(decodeValue({ mapValue: { fields: { a: { integerValue: '5' }, b: { arrayValue: { values: [{ stringValue: 'x' }] } }, c: { nullValue: null } } } })).toEqual({ a: 5, b: ['x'], c: null })
  })
})

describe('selectRows (RAZ-412: archived events must not come back, no duplicates)', () => {
  const row = (sourceId: string, over: Partial<MappedEvent> = {}): MappedEvent => {
    const r = mapV3Event({ ...base, id: sourceId }, ctx)
    if (!r.ok) throw new Error(r.reason)
    return { ...r.row, ...over }
  }

  it('reads the series from v3 seriesId or the seed id', () => {
    expect(seriesKey('seed-salsa-from-zero-thursday-20261015')).toBe('seed:salsa-from-zero-thursday')
    expect(seriesKey('abc', 'S1')).toBe('series:S1')
    expect(seriesKey('nNRBbAh5cJwSqczw90ZK')).toBeNull()
  })

  it('keeps a person-archived event out, but lets a sync-archived one come back', () => {
    const { rows, skipped } = selectRows(
      [row('a'), row('b', { startDate: new Date('2026-10-11T18:00:00Z') })],
      [{ sourceId: 'a', archived: true, editedAt: new Date() }, { sourceId: 'b', archived: true, editedAt: null }],
    )
    expect(rows.map(r => r.sourceId)).toEqual(['b'])
    expect(skipped).toEqual(['dismissed'])
  })

  it('keeps every new date of a series archived "with every date" out', () => {
    const { rows, skipped } = selectRows(
      [row('seed-sfz-thu-20261105', { startDate: new Date('2026-11-05T19:00:00Z') }), row('seed-other-20261105')],
      [{ sourceId: 'seed-sfz-thu-20261015', archived: true, editedAt: new Date(), sourceRef: { dismissed: 'series' } }],
    )
    expect(rows.map(r => r.sourceId)).toEqual(['seed-other-20261105'])
    expect(skipped).toEqual(['dismissed-series'])
  })

  it('archiving one date of a series leaves the other dates alone', () => {
    const { rows } = selectRows(
      [row('seed-sfz-thu-20261022')],
      [{ sourceId: 'seed-sfz-thu-20261015', archived: true, editedAt: new Date(), sourceRef: {} }],
    )
    expect(rows).toHaveLength(1)
  })

  it('collapses two v3 posts for the same night, keeping the one already synced', () => {
    const { rows, skipped } = selectRows([row('zzz'), row('aaa', { name: 'Salsa  social!' })], [{ sourceId: 'zzz', archived: false }])
    expect(rows.map(r => r.sourceId)).toEqual(['zzz'])
    expect(skipped).toEqual(['duplicate'])
    expect(dedupeKey(row('x'))).toBe(dedupeKey(row('y', { name: 'SALSA SOCIAL' })))
    expect(dedupeKey(row('x'))).not.toBe(dedupeKey(row('y', { startDate: new Date('2026-10-17T18:00:00Z') })))
  })
})
