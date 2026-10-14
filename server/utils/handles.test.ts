import { describe, expect, it } from 'vitest'
import { candidates, handleSlug, pickHandle, unreadable } from './handles'

describe('unreadable', () => {
  it('spots handles nobody could say', () => {
    expect(unreadable('ChIJpTxPR1XZnUcRER0LZABcUuE')).toBe('google id')
    expect(unreadable('1396922169')).toBe('number')
    expect(unreadable('salsamc3a1spasing')).toBe('garbled')
    expect(unreadable('alosha-589fb')).toBe('random suffix')
    expect(unreadable('bodylanguageng2')).toBe('numbered copy')
    expect(unreadable('web.archive.orgweb20060107010')).toBe('not a handle')
    expect(unreadable('SalsamásPasing')).toBe('not a handle')
  })
  it('leaves readable ones alone', () => {
    for (const h of ['salsea', 'salsa.cubano', 'djlole', 'my-mia.de', 'alosha', 'evergreen-goes-luma', 'barbara-jimenez']) expect(unreadable(h)).toBeNull()
  })
})

describe('picking a handle', () => {
  it('prefers the Instagram handle, then the name, then name + city, then a number', () => {
    const p = { name: 'Salsa y Corazón', citySlug: 'munich', socials: [{ platform: 'instagram', url: 'https://instagram.com/salsaycorazon' }] }
    expect(candidates(p)).toEqual(['salsaycorazon', 'salsa-y-corazon', 'salsa-y-corazon-munich'])
    expect(pickHandle(candidates(p), new Set(['salsaycorazon']), handleSlug(p.name))).toBe('salsa-y-corazon')
    expect(pickHandle(candidates(p), new Set(['salsaycorazon', 'salsa-y-corazon', 'salsa-y-corazon-munich']), handleSlug(p.name))).toBe('salsa-y-corazon-2')
  })
  it('makes names into handles', () => {
    expect(handleSlug('Kulturzentrum Giesinger Bahnhof')).toBe('kulturzentrum-giesinger-bahnhof')
    expect(handleSlug('Arnulfstraße 195')).toBe('arnulfstrasse-195')
    expect(handleSlug('Alösha')).toBe('alosha')
  })
})
