import { describe, expect, it } from 'vitest'
import { contactsFor } from './contacts'

describe('contactsFor', () => {
  it('opens direct messages first, then the website', () => {
    const c = contactsFor({ name: 'Megano', username: 'megano_dance', socials: [
      { platform: 'website', url: 'https://megano-tanzschule.de/' },
      { platform: 'facebook', url: 'https://www.facebook.com/MEGANOTANZSCHULE' },
      { platform: 'instagram', url: 'https://instagram.com/megano_dance' },
    ] })
    expect(c.map(x => x.url)).toEqual(['https://ig.me/m/megano_dance', 'https://m.me/MEGANOTANZSCHULE', 'https://megano-tanzschule.de/'])
    expect(c[2]!.label).toBe('Their website (megano-tanzschule.de)')
  })
  it('keeps odd Facebook links as the page', () => {
    expect(contactsFor({ name: 'X', username: 'x', socials: [{ platform: 'facebook', url: 'https://www.facebook.com/profile.php?id=1' }] })[0])
      .toMatchObject({ kind: 'facebook', url: 'https://www.facebook.com/profile.php?id=1' })
  })
  it('points Google Maps venues at their Maps page', () => {
    expect(contactsFor({ name: 'KULT', username: 'ChIJnwr0yvV1nkcR2kdAim8pDB8', socials: [] })[0])
      .toMatchObject({ kind: 'maps', url: 'https://www.google.com/maps/place/?q=place_id:ChIJnwr0yvV1nkcR2kdAim8pDB8' })
  })
  it('puts a venue’s own booking contacts first, then Google Maps', () => {
    const c = contactsFor({ name: 'Salsea', username: 'salsea', contact: { phone: '089 1234 567', whatsapp: '+49 170 123 4567', email: 'book@salsea.de', telegram: '@salsea' }, mapUrl: 'https://maps.google.com/?cid=123', socials: [{ platform: 'instagram', url: 'https://instagram.com/salsea_dance' }] })
    expect(c.map(x => x.url)).toEqual(['https://wa.me/491701234567', 'tel:0891234567', 'mailto:book@salsea.de', 'https://ig.me/m/salsea_dance', 'https://t.me/salsea', 'https://maps.google.com/?cid=123'])
  })
  it('falls back to a search by name and city', () => {
    expect(contactsFor({ name: 'Studio 5', username: 'studio5', city: 'Munich', socials: [] })[0])
      .toMatchObject({ kind: 'search', url: 'https://www.google.com/search?q=Studio%205%20Munich' })
  })
})
