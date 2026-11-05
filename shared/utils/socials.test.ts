import { describe, expect, it } from 'vitest'
import { mergeSocials } from './socials'

const ig = { platform: 'instagram', url: 'https://instagram.com/salsa_bar' }

describe('mergeSocials', () => {
  it('adds a website and keeps the Instagram', () => {
    expect(mergeSocials([ig], [{ platform: 'website', url: 'https://salsa.bar' }]))
      .toEqual([ig, { platform: 'website', url: 'https://salsa.bar' }])
  })

  it('replaces a platform case-insensitively', () => {
    expect(mergeSocials([ig, { platform: 'Website', url: 'https://old.bar' }], [{ platform: 'WEBSITE', url: ' https://new.bar ' }]))
      .toEqual([ig, { platform: 'website', url: 'https://new.bar' }])
  })

  it('an empty link removes that platform', () => {
    expect(mergeSocials([ig, { platform: 'website', url: 'https://old.bar' }], [{ platform: 'website', url: '' }])).toEqual([ig])
  })

  it('works without current links', () => {
    expect(mergeSocials(null, [{ platform: 'website', url: '' }])).toEqual([])
  })
})
