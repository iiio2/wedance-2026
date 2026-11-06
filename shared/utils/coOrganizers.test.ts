import { describe, it, expect } from 'vitest'
import { cleanCoOrganizers, coOrganizerRole, CO_ORGANIZERS_MAX } from './coOrganizers'

describe('cleanCoOrganizers', () => {
  it('strips @, lowercases and trims roles', () => {
    expect(cleanCoOrganizers([{ username: '@AdelaideBeauvoir', role: ' host ' }, 'aslihan.dans']))
      .toEqual([{ username: 'adelaidebeauvoir', role: 'host' }, { username: 'aslihan.dans' }])
  })
  it('drops empty roles, blanks and repeats (first wins)', () => {
    expect(cleanCoOrganizers([{ username: 'a', role: '' }, { username: ' ' }, { username: 'A', role: 'host' }]))
      .toEqual([{ username: 'a' }])
  })
  it('never lists the organiser itself', () => {
    expect(cleanCoOrganizers(['bfestberlin', 'lateatnate', 'venue'], ['BFestBerlin', null, 'venue'])).toEqual([{ username: 'lateatnate' }])
  })
  it('caps the list', () => {
    expect(cleanCoOrganizers(Array.from({ length: 30 }, (_, i) => `p${i}`))).toHaveLength(CO_ORGANIZERS_MAX)
  })
  it('handles null', () => expect(cleanCoOrganizers(null)).toEqual([]))
})

describe('coOrganizerRole', () => {
  it('falls back to Co-organiser', () => {
    expect(coOrganizerRole({})).toBe('Co-organiser')
    expect(coOrganizerRole({ role: 'Host' })).toBe('Host')
  })
})
