import { describe, it, expect, afterEach } from 'vitest'
import fixture from './__fixtures__/profile-scraper.json'
import { normalizeInstagramProfile } from './apify'
import { planInstagramFill, isPlaceholderName, socialFromLink, scheduleInstagramImport, type ProfileRow } from './profileImport'

const dj = normalizeInstagramProfile(fixture[0])!
const venue = normalizeInstagramProfile(fixture[1])!
const munich = { name: 'Munich', slug: 'munich' }

const row = (over: Partial<ProfileRow> = {}): ProfileRow => ({
  id: 'p1', username: 'dj-salsero-test', type: 'artist', name: 'dj_salsero_test', bio: null, photo: null, city: null, citySlug: null,
  address: null, socials: [{ platform: 'instagram', url: 'https://instagram.com/dj_salsero_test' }], claimed: false, managed: false, sourceRef: null,
  ...over,
})

describe('isPlaceholderName', () => {
  it('is the handle in any spelling', () => {
    expect(isPlaceholderName('dj_salsero_test', 'dj_salsero_test')).toBe(true)
    expect(isPlaceholderName('@dj_salsero_test', 'dj_salsero_test')).toBe(true)
    expect(isPlaceholderName('Dj Salsero Test', 'dj_salsero_test')).toBe(true)
    expect(isPlaceholderName('', 'x')).toBe(true)
    expect(isPlaceholderName('Carlos', 'dj_salsero_test')).toBe(false)
  })
})

describe('socialFromLink', () => {
  it('turns the bio link into a website or a known platform', () => {
    expect(socialFromLink('https://linktr.ee/x')).toEqual({ platform: 'website', url: 'https://linktr.ee/x' })
    expect(socialFromLink('www.youtube.com/@x')).toEqual({ platform: 'youtube', url: 'https://www.youtube.com/@x' })
    expect(socialFromLink('https://m.facebook.com/x')?.platform).toBe('facebook')
    expect(socialFromLink('https://instagram.com/other')).toBeNull()
    expect(socialFromLink('javascript:alert(1)')).toBeNull()
    expect(socialFromLink('not a url')).toBeNull()
    expect(socialFromLink(null)).toBeNull()
  })
})

describe('planInstagramFill', () => {
  it('fills an empty artist page: name, bio, photo, website, city — not an address', () => {
    const plan = planInstagramFill(row(), { ...dj, address: { street: 'Agency St 1', zip: null, city: 'Munich' } }, munich)
    expect(plan).toEqual({
      name: 'DJ Salsero 🎧',
      bio: dj.biography,
      photoSource: 'https://scontent.cdninstagram.com/v/t51/hd.jpg',
      socials: [{ platform: 'instagram', url: 'https://instagram.com/dj_salsero_test' }, { platform: 'website', url: 'https://linktr.ee/djsalsero' }],
      city: munich,
      fields: ['name', 'bio', 'photo', 'website', 'city'],
    })
  })

  it('never overwrites what is there', () => {
    const plan = planInstagramFill(row({
      name: 'Carlos Ramírez', bio: 'My own words', photo: 'https://res.cloudinary.com/x.jpg', city: 'Berlin',
      socials: [{ platform: 'instagram', url: 'https://instagram.com/dj_salsero_test' }, { platform: 'website', url: 'https://carlos.dj' }],
    }), dj, munich)
    expect(plan).toEqual({ fields: [] })
  })

  it('fills a venue address from the business address', () => {
    const plan = planInstagramFill(row({ type: 'venue', name: 'Galerie Test', username: 'galerie-test-venue' }), venue, munich)
    expect(plan.address).toBe('Musterstraße 5, 80331 Munich, Germany')
    expect(plan.name).toBeUndefined() // a real name already
    expect(plan.fields).toEqual(['bio', 'photo', 'website', 'city', 'address'])
  })

  it('keeps the handle when Instagram has no real name either', () => {
    expect(planInstagramFill(row(), { ...dj, fullName: 'dj_salsero_test' }, null).name).toBeUndefined()
    expect(planInstagramFill(row(), { ...dj, fullName: null }, null).name).toBeUndefined()
  })
})

describe('scheduleInstagramImport', () => {
  const saved = process.env.APIFY_TOKEN
  afterEach(() => { if (saved === undefined) delete process.env.APIFY_TOKEN; else process.env.APIFY_TOKEN = saved })

  it('is a silent no-op without APIFY_TOKEN: no DB work, nothing handed to waitUntil', () => {
    delete process.env.APIFY_TOKEN
    const handed: unknown[] = []
    const db = new Proxy({}, { get: () => { throw new Error('db touched') } })
    expect(scheduleInstagramImport({ db, waitUntil: p => handed.push(p) }, [{ profileId: 'p1', handle: 'x' }])).toBeNull()
    expect(handed).toEqual([])
  })
})
