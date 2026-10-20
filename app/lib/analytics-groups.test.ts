import { describe, it, expect } from 'vitest'
import { organiserProfileFromPath } from './analytics-groups'

describe('organiserProfileFromPath', () => {
  it('reads the profile from Business mode pages', () => {
    expect(organiserProfileFromPath('/business/network/salsa-crew')).toBe('salsa-crew')
    expect(organiserProfileFromPath('/business/network/salsa-crew/bookings')).toBe('salsa-crew')
    expect(organiserProfileFromPath('/business/network/caf%C3%A9')).toBe('café')
  })

  it('is null elsewhere', () => {
    expect(organiserProfileFromPath('/business/network')).toBeNull()
    expect(organiserProfileFromPath('/business/network/')).toBeNull()
    expect(organiserProfileFromPath('/@salsa-crew')).toBeNull()
    expect(organiserProfileFromPath('/business/events/1')).toBeNull()
  })
})
