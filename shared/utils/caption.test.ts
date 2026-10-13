import { describe, it, expect } from 'vitest'
import { captionPrompt, keepVerifiedMentions, instagramOf } from './caption'

describe('keepVerifiedMentions', () => {
  it('keeps verified handles and un-tags made-up ones', () => {
    expect(keepVerifiedMentions('With @hmez2050 and @madeup.dj at @Evergreen_Goes_Luma.', ['hmez2050', 'evergreen_goes_luma']))
      .toBe('With @hmez2050 and madeup.dj at @Evergreen_Goes_Luma.')
  })
  it('leaves email addresses alone', () => {
    expect(keepVerifiedMentions('Write to hello@laclave.de', [])).toBe('Write to hello@laclave.de')
  })
})

describe('instagramOf', () => {
  it('reads the handle from a profile link', () => {
    expect(instagramOf([{ platform: 'website', url: 'https://x.de' }, { platform: 'instagram', url: 'https://www.instagram.com/Ritmo_JG/?hl=de' }])).toBe('ritmo_jg')
    expect(instagramOf([])).toBeNull()
  })
})

describe('captionPrompt', () => {
  const ctx = {
    lines: ['LA CLAVE THURSDAY', 'THURSDAY 22 OCTOBER', 'LUMA · NEUHAUSER STR. 47 · MÜNCHEN'],
    host: { name: 'La Clave en Múnich', instagram: 'ritmo_jg' },
    venue: { name: 'Luma', instagram: null },
    artists: [{ name: 'Hamza', instagram: 'hmez2050' }, { name: 'Yunior', instagram: null }],
    eventUrl: 'https://2026.wedance.vip/events/1',
  }
  it('lists only verified accounts and the language', () => {
    const p = captionPrompt(ctx, 'en+de')
    expect(p).toContain('Hamza: @hmez2050')
    expect(p).toContain('organizer La Clave en Múnich: @ritmo_jg')
    expect(p).not.toContain('Yunior: @')
    expect(p).toContain('🇩🇪')
    expect(p).toContain('MÜNCHEN')
  })
})
