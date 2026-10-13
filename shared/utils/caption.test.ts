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
    lines: [
      { label: 'title', text: 'LA CLAVE THURSDAY' }, { label: 'date', text: 'THURSDAY 22 OCTOBER' }, { label: 'time', text: '19:00 – 23:00' },
      { label: 'agenda', text: '19:00 Reparto from Zero · Yunior' }, { label: 'agenda', text: '21:00 Party · DJ Papi' },
      { label: 'entry', text: '€10 after 21:00 · Workshops for free' }, { label: 'venue', text: 'LUMA · NEUHAUSER STR. 47 · 80331 MÜNCHEN' },
    ],
    host: { name: 'La Clave en Múnich', instagram: 'ritmo_jg' },
    venue: { name: 'LUMA', address: 'Neuhauser Str. 47, 80331 München', instagram: null },
    artists: [{ name: 'Hamza', instagram: 'hmez2050' }, { name: 'Yunior', instagram: null }],
    eventUrl: 'https://2026.wedance.vip/events/1',
  }
  it('lists only verified accounts and the language', () => {
    const p = captionPrompt(ctx, 'en+de')
    expect(p).toContain('Hamza: @hmez2050')
    expect(p).toContain('organizer La Clave en Múnich: @ritmo_jg')
    expect(p).not.toContain('Yunior: @')
    expect(p).toContain('🇩🇪')
    expect(p).toContain('Place: LUMA, Neuhauser Str. 47, 80331 München')
  })
  it('gives the programme one line per item and each price its own line', () => {
    const p = captionPrompt(ctx, 'en')
    expect(p).toContain('  - 19:00 Reparto from Zero · Yunior\n  - 21:00 Party · DJ Papi')
    expect(p).toContain('Never merge items')
    expect(p).toContain('Entry: €10 after 21:00\nEntry: Workshops for free')
  })
})
