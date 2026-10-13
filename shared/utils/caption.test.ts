import { describe, it, expect } from 'vitest'
import { captionDetails, captionPrompt, composeCaption, keepVerifiedMentions, instagramOf } from './caption'

// La Clave Thursday on prod (15 Oct 2026, 19:00–23:00 Berlin).
const ctx = {
  title: 'La Clave Thursday',
  startDate: '2026-10-15T17:00:00Z',
  endDate: '2026-10-15T21:00:00Z',
  timezone: 'Europe/Berlin',
  agenda: [
    { time: '19:00', what: 'Reparto from Zero · Yunior' },
    { time: '20:00', what: 'Bachata from Zero · Alösha' },
    { time: '21:00', what: 'Party · DJ Papi' },
  ],
  styles: ['Salsa', 'Bachata'],
  prices: ['€10 after 21:00', 'Workshops for free'],
  host: { name: 'La Clave en Múnich', instagram: 'ritmo_jg' },
  venue: { name: 'LUMA', address: 'Neuhauser Str. 47, 80331 München', instagram: 'evergreen_goes_luma' },
  artists: [{ name: 'Yunior', instagram: 'yuniorflowcubano' }, { name: 'Alösha', instagram: 'alosha_corazon_cubano' }, { name: 'DJ Papi', instagram: null }],
}

describe('captionDetails', () => {
  it('one fact per line: programme items and prices each on their own, venue with its address', () => {
    expect(captionDetails(ctx)).toEqual([
      '📅 Thursday 15 October',
      '🕒 19:00 – 23:00',
      '🔸 19:00 Reparto from Zero · Yunior',
      '🔸 20:00 Bachata from Zero · Alösha',
      '🔸 21:00 Party · DJ Papi',
      '🎶 Salsa × Bachata',
      '🎧 Yunior (@yuniorflowcubano) · Alösha (@alosha_corazon_cubano) · DJ Papi',
      '🎟 €10 after 21:00',
      '🎟 Workshops for free',
      '📍 LUMA (@evergreen_goes_luma), Neuhauser Str. 47, 80331 München',
    ])
  })
  it('names a profile named after its handle by the handle alone', () => {
    const c = { ...ctx, artists: [{ name: 'alosha_corazon_cubano', instagram: 'alosha_corazon_cubano' }, { name: 'djpapi.muc', instagram: 'djpapi.muc' }] }
    expect(captionDetails(c)).toContain('🎧 @alosha_corazon_cubano · @djpapi.muc')
  })
  it('writes the date in the first language', () => {
    expect(captionDetails(ctx, 'de')[0]).toBe('📅 Donnerstag, 15. Oktober')
  })
})

describe('composeCaption', () => {
  it('hooks, the fixed details, calls to action and hashtags; strips made-up handles', () => {
    const text = composeCaption(ctx, 'en+de', {
      en: { hook: 'Dance with us at La Clave with @ritmo_jg and @madeup!', cta: 'Tickets via link in bio.' },
      de: { hook: 'Tanzt mit uns!', cta: 'Tickets über den Link in der Bio.' },
      hashtags: ['#LaClave', 'Salsa Munich', '#LaClave'],
    })
    expect(text).toBe([
      'Dance with us at La Clave with @ritmo_jg and madeup!\n🇩🇪 Tanzt mit uns!',
      captionDetails(ctx).join('\n'),
      'Tickets via link in bio.\n🇩🇪 Tickets über den Link in der Bio.',
      '#LaClave #SalsaMunich',
    ].join('\n\n'))
  })
  it('still has every detail when Gemini returns nothing', () => {
    expect(composeCaption(ctx, 'en', {})).toBe(captionDetails(ctx).join('\n'))
  })
})

describe('captionPrompt', () => {
  it('asks only for hook, cta and hashtags per language', () => {
    const p = captionPrompt(ctx, 'en+de')
    expect(p).toContain('"en": {"hook": "...", "cta": "..."}, "de": {"hook": "...", "cta": "..."}, "hashtags"')
    expect(p).toContain('@ritmo_jg')
  })
})

describe('keepVerifiedMentions', () => {
  it('keeps verified handles and leaves emails alone', () => {
    expect(keepVerifiedMentions('With @hmez2050 and @madeup.dj, hello@laclave.de', ['hmez2050'])).toBe('With @hmez2050 and madeup.dj, hello@laclave.de')
  })
})

describe('instagramOf', () => {
  it('reads the handle from a profile link', () => {
    expect(instagramOf([{ platform: 'instagram', url: 'https://www.instagram.com/Ritmo_JG/?hl=de' }])).toBe('ritmo_jg')
    expect(instagramOf([])).toBeNull()
  })
})
