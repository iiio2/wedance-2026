import { describe, expect, it } from 'vitest'
import { mapAmenities, planVenueDetails, type LocalVenue } from './v3VenueDetails'

const local = (o: Partial<LocalVenue>): LocalVenue => ({ id: 'id1', username: 'kult', sourceRef: null, address: null, mapUrl: null, lat: null, lng: null, socials: [], contact: {}, venueType: null, amenities: [], claimed: false, managed: false, ...o })
const v3 = {
  id: 'fb1', username: 'kult', venueType: 'DanceStudio', amenities: ['Restrooms', 'Speakers', 'ScenicViews'], phone: '+49 private', email: 'me@x.de',
  address: { place_id: 'ChIJabc', formatted_address: 'Neuhauser Str. 15A, 80331 München', url: 'https://maps.google.com/?cid=1', website: 'https://kult.de/', international_phone_number: '+49 89 123', geometry: { location: { lat: 48.1, lng: 11.5 } } },
}

describe('planVenueDetails', () => {
  it('fills empty fields from the Google listing and v3 own fields', () => {
    const { plans } = planVenueDetails([v3], [local({ sourceRef: { firebaseId: 'fb1' } })])
    expect(plans[0]!.set).toEqual({
      address: 'Neuhauser Str. 15A, 80331 München', mapUrl: 'https://maps.google.com/?cid=1', lat: 48.1, lng: 11.5,
      socials: [{ platform: 'website', url: 'https://kult.de/' }], contact: { phone: '+49 89 123' }, venueType: 'DanceStudio', amenities: ['Restrooms', 'SoundSystem'],
    })
  })
  it('never copies v3’s own phone or email', () => {
    const { plans } = planVenueDetails([{ ...v3, address: { ...v3.address, international_phone_number: undefined } }], [local({ sourceRef: { firebaseId: 'fb1' } })])
    expect(JSON.stringify(plans[0]!.set)).not.toMatch(/private|me@x\.de/)
  })
  it('keeps what 2026 already has', () => {
    const { plans } = planVenueDetails([v3], [local({ username: 'ChIJabc', address: 'Own', mapUrl: 'https://img/plan.png', lat: 1, lng: 2, contact: { phone: '1' }, venueType: 'Club', amenities: ['Bar'], socials: [{ platform: 'website', url: 'https://own' }] })])
    expect(plans).toEqual([])
  })
  it('skips claimed or managed pages', () => {
    const r = planVenueDetails([v3], [local({ username: 'ChIJabc', managed: true })])
    expect(r.plans).toEqual([])
    expect(r.skippedOwned).toBe(1)
  })
  it('maps amenities onto the fixed list', () => {
    expect(mapAmenities(['Speakers', 'SoundSystem', 'Mirrors', 'VIPAreas'])).toEqual(['SoundSystem', 'Mirrors'])
  })
})
