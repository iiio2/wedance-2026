import { describe, expect, it } from 'vitest'
import type { ProfileSite } from '../types/profileSite'
import { siteChangeSummary } from './siteDiff'

const base = (): ProfileSite => ({
  domain: 'https://salsaschool.example', locales: ['en', 'de'],
  sections: [
    { id: 'hero', kind: 'hero', title: { en: 'Dance with us', de: 'Tanz mit uns' } },
    { id: 'faq', kind: 'faq', title: { en: 'Questions' } },
    { id: 'v', kind: 'video', video: 'https://youtu.be/x' },
  ],
})

describe('siteChangeSummary', () => {
  it('a first save', () => expect(siteChangeSummary(null, base())).toEqual(['Created the site']))
  it('nothing changed', () => expect(siteChangeSummary(base(), base())).toEqual([]))
  it('key order is not a change (Postgres jsonb reorders keys)', () => {
    const reordered = JSON.parse(JSON.stringify(base()), (_k, v) => v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).reverse()) : v)
    expect(siteChangeSummary(base(), reordered)).toEqual([])
  })
  it('names the section, the field and the languages that changed', () => {
    const after = base(); after.sections[0]!.title = { en: 'Dance with us', de: 'Tanzt mit uns' }
    expect(siteChangeSummary(base(), after)).toEqual(['Changed Hero “Dance with us”: title (de)'])
  })
  it('search & sharing and the welcome email say which text and language', () => {
    const after = { ...base(), seo: { title: { en: 'Salsa in Munich' } }, welcome: { subject: { de: 'Willkommen' } } }
    expect(siteChangeSummary(base(), after)).toEqual(['Changed search & sharing: title (en)', 'Changed welcome email: subject (de)'])
  })
  it('added, removed, hidden, reordered, site fields', () => {
    const after = base()
    after.domain = 'https://salsaschool.example.org'
    after.sections = [{ ...after.sections[1]!, hidden: true }, after.sections[0]!, { id: 'c', kind: 'cta', title: { en: 'Join the group' } }]
    expect(siteChangeSummary(base(), after)).toEqual([
      'Changed address', 'Added Call to action “Join the group”', 'Hid Questions “Questions”', 'Removed Video', 'Reordered sections',
    ])
  })
})
