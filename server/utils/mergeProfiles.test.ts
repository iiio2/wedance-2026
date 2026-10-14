import { describe, expect, it } from 'vitest'
import { findDuplicates, renameInEvent, sameAddress, type DupRow } from './mergeProfiles'

let n = 0
const row = (o: Partial<DupRow>): DupRow => ({ id: `id${++n}`, username: `u${n}`, type: 'organizer', name: 'Salon Cubano', citySlug: 'munich', claimed: false, managed: false, events: 0, address: null, lat: null, lng: null, sourceRef: null, ...o })
const cities = new Set(['budapest', 'munich'])

describe('findDuplicates', () => {
  it('keeps the busiest copy and merges numbered and empty copies', () => {
    const [g] = findDuplicates([row({ username: 'salon.cubano2' }), row({ username: 'salon.cubano', events: 9 }), row({ username: 'salon.cubano3', events: 1 })], cities)
    expect(g!.keep.username).toBe('salon.cubano')
    expect(g!.others.map(o => [o.row.username, o.merge, o.reason])).toEqual([['salon.cubano3', true, 'numbered copy'], ['salon.cubano2', true, 'empty copy']])
  })
  it('prefers the copy someone runs, and never merges two that people run', () => {
    const [g] = findDuplicates([row({ username: 'a', events: 50 }), row({ username: 'b', managed: true }), row({ username: 'c', managed: true })], cities)
    expect(g!.keep.username).toBe('b')
    expect(g!.others.find(o => o.row.username === 'c')).toMatchObject({ merge: false, reason: 'both run by people on WeDance' })
    // The busy copy nobody runs joins the one someone does.
    expect(g!.others.find(o => o.row.username === 'a')).toMatchObject({ merge: true, reason: 'same name and city' })
  })
  it('merges venues with events only at the same place', () => {
    const v = { type: 'venue', name: 'Salsa OnStage' }
    const [g] = findDuplicates([
      row({ ...v, username: 'salsaonstage', events: 53, lat: 48.1, lng: 11.5 }),
      row({ ...v, username: 'ChIJEx0xXYXfnUcRUmF5nsN_fDI', events: 45, lat: 48.1005, lng: 11.5 }),
      row({ ...v, username: 'other', events: 3, lat: 48.2, lng: 11.6 }),
    ], cities)
    expect(g!.keep.username).toBe('salsaonstage')
    expect(Object.fromEntries(g!.others.map(o => [o.row.username, o.merge]))).toEqual({ ChIJEx0xXYXfnUcRUmF5nsN_fDI: true, other: false })
  })
  it('merges same-name venues in a city when only one side has an address, but not streets', () => {
    const v = { type: 'venue' }
    const [g] = findDuplicates([row({ ...v, name: 'Salsea', username: 'salsea', events: 178, address: 'Leopoldstr. 1' }), row({ ...v, name: 'Salsea', username: 'ChIJpTxPR1XZnUcRER0LZABcUuE', events: 319 })], cities)
    expect(g!.others[0]).toMatchObject({ merge: true })
    const [s] = findDuplicates([row({ ...v, name: 'Zentnerstraße 39', username: 'ChIJaaaaaaaaaaaaaaaaaaaa', events: 7 }), row({ ...v, name: 'Zentnerstraße 39', username: 'ChIJbbbbbbbbbbbbbbbbbbbb', events: 4 })], cities)
    expect(s!.others[0]).toMatchObject({ merge: false })
  })
  it('merges organizers whose handles differ only by punctuation', () => {
    const [g] = findDuplicates([row({ name: 'DJ Lole', username: 'djlole', events: 209 }), row({ name: 'DJ Lole', username: 'dj.lole', events: 29 })], cities)
    expect(g!.others[0]).toMatchObject({ merge: true, reason: 'same handle, other punctuation' })
  })
  it('leaves venues named after a city alone', () => {
    const [g] = findDuplicates([row({ type: 'venue', name: 'Budapest', citySlug: 'budapest', events: 27 }), row({ type: 'venue', name: 'Budapest', citySlug: null })], cities)
    expect(g!.others[0]).toMatchObject({ merge: false, reason: 'the name is just a city' })
  })
  it('prefers a real handle over a website, a numbered one and a Google id', () => {
    const [g] = findDuplicates([row({ username: 'ChIJaaaaaaaaaaaaaaaaaaaa', events: 40 }), row({ username: 'mia.de' }), row({ username: 'mia2' }), row({ username: 'mia_munich' })], cities)
    expect(g!.keep.username).toBe('mia_munich')
  })
  it('doesn’t group the same name in different cities', () => {
    expect(findDuplicates([row({ citySlug: 'munich' }), row({ citySlug: 'berlin' })], cities)).toEqual([])
  })
})

describe('renameInEvent', () => {
  it('renames a handle in the line-up, flyer options and festival programme', () => {
    const r = renameInEvent({
      artists: ['a', 'old', 'b'],
      flyerOptions: { photos: { old: 'p.jpg' }, names: { old: 'Old' } },
      festival: { sessions: [{ artist: 'old', with: ['b', 'old'] }], videos: { old: 'v' } },
    }, 'old', 'new')
    expect(r).toEqual({ artists: ['a', 'new', 'b'], flyerOptions: { photos: { new: 'p.jpg' }, names: { new: 'Old' } }, festival: { sessions: [{ artist: 'new', with: ['b', 'new'] }], videos: { new: 'v' } } })
  })
})

describe('sameAddress', () => {
  it('reads the same place written differently', () => {
    expect(sameAddress('Sonnenstraße 7, 80331 München, Germany', 'Sonnenstr. 7, 80331 München')).toBe(true)
    expect(sameAddress('Sonnenstraße 24-26, 80331 München, Germany', 'Sonnenstraße 24-26, 80331 München-Ludwigsvorstadt-Isarvorstadt, Germany')).toBe(true)
    expect(sameAddress('Willy-Brandt-Allee, 81829 München', 'Willy-Brandt-Allee 32, 81829 München')).toBe(true)
  })
  it('tells different places apart', () => {
    expect(sameAddress('Győr, Széchenyi tér, 9022 Hungary', 'Budapest, Széchenyi tér, 1045 Hungary')).toBe(false)
    expect(sameAddress('Caroline-Michaelis-Straße 1, 10115 Berlin', 'Neuhauser Str. 47, 80331 München')).toBe(false)
    expect(sameAddress('Sonnenstraße 7, 80331 München', 'Sonnenstraße 9, 80331 München')).toBe(false)
  })
})
