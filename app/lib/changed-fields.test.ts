import { describe, it, expect } from 'vitest'
import { changedFields } from './changed-fields'

describe('changedFields', () => {
  it('lists the names of fields whose value changed, sorted', () => {
    expect(changedFields(
      { name: 'Ana', city: 'Munich', danceStyles: ['Salsa'], bio: null, profilePublic: true },
      { name: 'Ana', city: 'Berlin', danceStyles: ['Salsa', 'Bachata'], bio: '', profilePublic: false },
    )).toEqual(['city', 'danceStyles', 'profilePublic'])
  })

  it('ignores undefined patch fields and treats empty as unset', () => {
    expect(changedFields({ instagram: null }, { instagram: '', website: undefined })).toEqual([])
  })

  it('never returns values', () => {
    expect(changedFields({ bio: 'old secret' }, { bio: 'new secret' })).toEqual(['bio'])
  })
})
