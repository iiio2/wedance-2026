import { describe, it, expect } from 'vitest'
import { profileSiteSchema, resolveSite, missingTexts, pick, type ProfileSite } from './profileSite'

const site: ProfileSite = {
  domain: 'https://montuno.club',
  locales: ['en', 'de'],
  seo: { title: { en: 'Montuno Club', de: 'Montuno Club DE' } },
  sections: [
    { id: 'a', kind: 'text', title: { en: 'Dance is social.', de: 'Tanzen ist sozial.' }, body: { en: 'One.\n\nTwo.' }, items: [{ id: 'i', title: { en: 'Free' }, body: { en: 'Donation', de: 'Spende' } }] },
    { id: 'b', kind: 'cta', hidden: true, title: { en: 'Hidden' } },
    { id: 'c', kind: 'cards', callout: { title: { en: 'Join' }, button: { label: { en: 'WhatsApp', de: 'WhatsApp beitreten' }, url: 'https://chat.whatsapp.com/x' } } },
  ],
}

describe('profile site (RAZ-412)', () => {
  it('resolves one language, falling back to the main one, and drops hidden sections', () => {
    const de = resolveSite(site, 'de')
    expect(de.lang).toBe('de')
    expect(de.sections.map(s => s.id)).toEqual(['a', 'c'])
    expect(de.sections[0]!.title).toBe('Tanzen ist sozial.')
    expect(de.sections[0]!.body).toBe('One.\n\nTwo.')
    expect(de.sections[0]!.items![0]).toEqual({ id: 'i', title: 'Free', body: 'Spende' })
    expect(de.sections[1]!.callout).toEqual({ title: 'Join', button: { label: 'WhatsApp beitreten', url: 'https://chat.whatsapp.com/x' } })
    expect(de.seo.title).toBe('Montuno Club DE')
  })

  it('an unknown language gets the main one', () => {
    expect(resolveSite(site, 'fr').lang).toBe('en')
    expect(pick(undefined, 'de', 'en')).toBe('')
  })

  it('counts texts a language still lacks', () => {
    expect(missingTexts(site, 'de')).toBe(4) // body, item title, hidden cta title, callout title
    expect(missingTexts(site, 'en')).toBe(0)
  })

  it('validates what the editor saves', () => {
    expect(profileSiteSchema.safeParse(site).success).toBe(true)
    expect(profileSiteSchema.safeParse({ ...site, locales: [] }).success).toBe(false)
    expect(profileSiteSchema.safeParse({ ...site, sections: [{ id: 'x', kind: 'carousel' }] }).success).toBe(false)
    expect(profileSiteSchema.safeParse({ ...site, sections: [{ id: 'x', kind: 'text', anchor: 'Has Space' }] }).success).toBe(false)
  })
})
