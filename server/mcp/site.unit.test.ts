import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ProfileSite } from '../../shared/types/profileSite'
import { applySitePatch, mergeL10n, siteChanges, SitePatchError } from './site'
import { TOOLS } from './tools'
import { quoteUntrusted } from './format'

const site = (): ProfileSite => ({
  domain: 'https://salsaschool.example',
  locales: ['en', 'de'],
  seo: { title: { en: 'Salsa School', de: 'Salsa School' } },
  sections: [
    { id: 'hero', kind: 'hero', title: { en: 'Dance with us', de: 'Tanz mit uns' }, image: 'https://img/hero.jpg', buttons: [{ label: { en: 'Join' }, url: '#signup' }] },
    { id: 'about', kind: 'text', title: { en: 'About us' }, body: { en: 'We teach.' } },
    { id: 'events', kind: 'events', title: { en: 'Classes' } },
  ],
})

describe('mergeL10n', () => {
  it('changes one language, keeps the others, "" removes one', () => {
    expect(mergeL10n({ en: 'A', de: 'B' }, { en: 'A2' })).toEqual({ en: 'A2', de: 'B' })
    expect(mergeL10n({ en: 'A', de: 'B' }, { de: '' })).toEqual({ en: 'A' })
    expect(mergeL10n({ en: 'A' }, { en: '' })).toBeUndefined()
    expect(mergeL10n({ en: 'A' }, undefined)).toEqual({ en: 'A' })
  })
})

describe('applySitePatch', () => {
  it('changes an English title and keeps the German one and the other fields', () => {
    const next = applySitePatch(site(), { sections: [{ id: 'hero', title: { en: 'Dance like a god' } }] })
    expect(next.sections[0]).toEqual({ ...site().sections[0], title: { en: 'Dance like a god', de: 'Tanz mit uns' } })
    expect(next.sections.slice(1)).toEqual(site().sections.slice(1))
  })

  it('adds a section at a position, with an id, and gives new items ids', () => {
    const next = applySitePatch(site(), { sections: [{ kind: 'faq', position: 1, title: { en: 'Questions' }, items: [{ id: '', title: { en: 'Partner needed?' }, body: { en: 'No.' } }] }] })
    expect(next.sections.map(x => x.kind)).toEqual(['hero', 'faq', 'text', 'events'])
    expect(next.sections[1]!.id).toMatch(/\w+/)
    expect(next.sections[1]!.items![0]!.id).toMatch(/\w+/)
  })

  it('removes, hides and reorders', () => {
    const next = applySitePatch(site(), { remove_sections: ['about'], sections: [{ id: 'hero', hidden: true }], order: ['events'] })
    expect(next.sections.map(x => x.id)).toEqual(['events', 'hero'])
    expect(next.sections[1]!.hidden).toBe(true)
  })

  it('"" removes an image', () => {
    expect(applySitePatch(site(), { sections: [{ id: 'hero', image: '' }] }).sections[0]).not.toHaveProperty('image')
  })

  it('site-wide fields: domain gets https, SEO merges per language, welcome email', () => {
    const next = applySitePatch(site(), { domain: 'salsaschool.example.org', seo: { description: { en: 'Salsa in Munich' } }, welcome: { subject: { en: 'Welcome!' } } })
    expect(next.domain).toBe('https://salsaschool.example.org')
    expect(next.seo).toEqual({ title: { en: 'Salsa School', de: 'Salsa School' }, description: { en: 'Salsa in Munich' } })
    expect(next.welcome).toEqual({ subject: { en: 'Welcome!' } })
  })

  it('starts a site that has no content yet', () => {
    const next = applySitePatch({ locales: ['en'], sections: [] }, { sections: [{ kind: 'hero', title: { en: 'Hi' } }] })
    expect(next.sections).toHaveLength(1)
  })

  it('refuses unknown ids, a new section without kind, and invalid content', () => {
    expect(() => applySitePatch(site(), { sections: [{ id: 'nope', title: { en: 'x' } }] })).toThrow(SitePatchError)
    expect(() => applySitePatch(site(), { sections: [{ title: { en: 'x' } }] })).toThrow(/kind/)
    expect(() => applySitePatch(site(), { remove_sections: ['nope'] })).toThrow(SitePatchError)
    expect(() => applySitePatch(site(), { order: ['nope'] })).toThrow(SitePatchError)
    expect(() => applySitePatch(site(), { sections: [{ id: 'hero', anchor: 'Not Valid' }] })).toThrow(/Anchors/)
  })

  it('look, legal details and publishing: only the keys passed change, "" clears one', () => {
    const s0 = { ...site(), theme: { preset: 'tropical', accent: '#e11d48' }, legal: { name: 'Salsa School', email: 'hi@salsaschool.example' }, published: false }
    const next = applySitePatch(s0, { theme: { accent: '', font: 'montserrat' }, legal: { email: '', address: ' Hauptstr. 1, 80331 München ' }, published: true })
    expect(next.theme).toEqual({ preset: 'tropical', font: 'montserrat' })
    expect(next.legal).toEqual({ name: 'Salsa School', address: 'Hauptstr. 1, 80331 München' })
    expect(next.published).toBe(true)
  })

  it('never changes the site it was given', () => {
    const s = site()
    applySitePatch(s, { sections: [{ id: 'hero', title: { en: 'X' } }], remove_sections: ['about'] })
    expect(s).toEqual(site())
  })
})

describe('siteChanges (the preview)', () => {
  it('lists what changes: field from → to, added, removed, order', () => {
    const before = site()
    const after = applySitePatch(before, { sections: [{ id: 'hero', title: { en: 'New' } }, { kind: 'cta', title: { en: 'Join WhatsApp' } }], remove_sections: ['about'], order: ['events'] })
    const c = siteChanges(before, after)
    expect(c.changed).toEqual([{ id: 'hero', kind: 'hero', title: 'New', changes: { title: { from: { en: 'Dance with us', de: 'Tanz mit uns' }, to: { en: 'New', de: 'Tanz mit uns' } } } }])
    expect(c.added.map(x => x.kind)).toEqual(['cta'])
    expect(c.removed).toEqual([{ id: 'about', kind: 'text', title: 'About us' }])
    expect(c.reordered?.map(x => x.id)).toEqual(['events', 'hero', after.sections[2]!.id])
    expect(c.site).toEqual([])
  })
})

describe('MCP site tools', () => {
  const tool = (name: string) => TOOLS.find(t => t.name === name)!
  const args = (name: string, raw: Record<string, unknown>) => z.object(tool(name).input).parse(raw)
  function fake(stored: ProfileSite | null = site()) {
    const saved: any[] = []
    const businessSite = {
      get: async () => ({ profile: { username: 'salsaschool', name: 'Salsa School' }, site: stored ?? { locales: ['en'], sections: [] }, exists: !!stored, updatedAt: null }),
      save: async (i: any) => { saved.push(i); return { updatedAt: new Date('2026-11-05T12:00:00Z') } },
    }
    const business = { myProfiles: async () => ({ managed: [
      { username: 'salsaschool', name: 'Salsa School', type: 'organizer', role: 'owner', hasSite: true, siteDomain: 'https://salsaschool.example' },
      { username: 'other', name: 'Other', type: 'artist', role: 'owner', hasSite: false, siteDomain: null },
    ] }) }
    return { saved, t: { caller: { businessSite, business }, ctx: {}, origin: 'https://2026.wedance.vip' } as any }
  }

  it('my_profiles says which page has a website run on WeDance', async () => {
    const r: any = await tool('my_profiles').run(fake().t, {})
    expect(r[0].website).toMatchObject({ domain: 'https://salsaschool.example', managed_on_wedance: true })
    expect(r[0]).not.toHaveProperty('hasSite')
    expect(r[1].website).toBeNull()
  })

  it('update_my_site is two-step and its preview shows the change', async () => {
    expect(tool('update_my_site').confirm).toBe(true)
    const { t, saved } = fake()
    const p: any = await tool('update_my_site').preview!(t, args('update_my_site', { profile: '@salsaschool', sections: [{ id: 'about', body: { en: 'We teach salsa.' } }] }))
    expect(p.changed[0].changes.body).toEqual({ from: { en: 'We teach.' }, to: { en: 'We teach salsa.' } })
    expect(saved).toEqual([])
  })

  it('update_my_site saves the patched site, other sections untouched', async () => {
    const { t, saved } = fake()
    await tool('update_my_site').run(t, args('update_my_site', { profile: 'salsaschool', sections: [{ id: 'about', body: { en: 'We teach salsa.' } }] }))
    expect(saved[0].username).toBe('salsaschool')
    expect(saved[0].site.sections[1].body).toEqual({ en: 'We teach salsa.' })
    expect(saved[0].site.sections[0]).toEqual(site().sections[0])
    expect(saved[0].site.domain).toBe('https://salsaschool.example')
  })

  it('a bad patch is a BAD_REQUEST, nothing saved', async () => {
    const { t, saved } = fake()
    await expect(tool('update_my_site').run(t, args('update_my_site', { profile: 'salsaschool', remove_sections: ['nope'] }))).rejects.toMatchObject({ code: 'BAD_REQUEST' })
    expect(saved).toEqual([])
  })

  it('get_my_site returns site texts as untrusted, per language', async () => {
    const r: any = await tool('get_my_site').run(fake().t, args('get_my_site', { profile: 'salsaschool' }))
    expect(r.domain).toBe('https://salsaschool.example')
    expect(r.section_kinds.hero.hint).toBeTruthy()
    const out: any = quoteUntrusted(r)
    expect(out.site.sections[0].title.de).toEqual({ untrusted_text: 'Tanz mit uns' })
    expect(out.site.sections[0].buttons[0].label.en).toEqual({ untrusted_text: 'Join' })
    expect(out.site.sections[0].buttons[0].url).toBe('#signup')
    expect(out.site.sections[0].id).toBe('hero')
  })
})
