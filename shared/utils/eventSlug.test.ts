import { describe, it, expect } from 'vitest'
import { eventSlug, eventPath, eventKey } from './eventSlug'

const id = '1ed1a238-7c7c-474d-94ff-1656b08f9c73'

describe('eventSlug', () => {
  it('name plus the short id', () => {
    expect(eventSlug({ id, name: 'La Clave Thursday' })).toBe('la-clave-thursday-1ed1a238')
    expect(eventPath({ id, name: 'La Clave Thursday' })).toBe('/events/la-clave-thursday-1ed1a238')
  })
  it('strips accents and punctuation', () => {
    expect(eventSlug({ id, name: 'Fiesta Cubana: Alösha & Friends!' })).toBe('fiesta-cubana-alosha-friends-1ed1a238')
  })
  it('cuts long names at a word, around 40 characters', () => {
    expect(eventSlug({ id, name: 'Cantina Salsa After Work: Salsa Cubana, Timba, Son, Bachata, Kizomba' }))
      .toBe('cantina-salsa-after-work-salsa-cubana-1ed1a238')
  })
  it('is just the short id without a name', () => {
    expect(eventSlug({ id, name: '' })).toBe('1ed1a238')
  })
})

describe('eventKey', () => {
  it('finds the event by the short id, whatever the name says', () => {
    expect(eventKey('la-clave-thursday-1ed1a238')).toEqual({ short: '1ed1a238' })
    expect(eventKey('old-name-1ed1a238')).toEqual({ short: '1ed1a238' })
    expect(eventKey('1ed1a238')).toEqual({ short: '1ed1a238' })
  })
  it('takes old full-id links', () => {
    expect(eventKey(id)).toEqual({ id })
  })
  it('rejects anything else', () => {
    expect(eventKey('la-clave-thursday')).toBeNull()
    expect(eventKey('party-2026-10-15')).toBeNull()
  })
})
