import { describe, it, expect } from 'vitest'
import { flyerLines, flyerChanges, checkFlyerText, paintPrompt, priceLines } from './flyer'

// Thu 15 Oct 2026, 19:00–23:00 Berlin (UTC+2)
const ev = {
  name: 'La Clave Thursday',
  startDate: '2026-10-15T17:00:00Z',
  endDate: '2026-10-15T21:00:00Z',
  timezone: 'Europe/Berlin',
  venueName: 'Luma',
  venueAddress: 'Neuhauser Str. 47, München',
  agenda: [{ time: '19:00', what: 'Reparto workshop · Yunior' }, { time: '21:00', what: 'Party · DJ Hamza' }],
  artists: [{ name: 'DJ Hamza' }, { name: 'Alösha' }],
  styles: ['Timba', 'Bachata'],
  price: 'Workshops free\nFrom 21:00 · 10€\n',
}

describe('flyerLines', () => {
  it('spells every line the poster carries, in order', () => {
    expect(flyerLines(ev).map(l => l.text)).toEqual([
      'LA CLAVE THURSDAY',
      'THURSDAY 15 OCTOBER',
      '19:00 – 23:00',
      '19:00 Reparto workshop · Yunior',
      '21:00 Party · DJ Hamza',
      'DJ HAMZA · ALÖSHA',
      'TIMBA × BACHATA',
      'Workshops free · From 21:00 · 10€',
      'LUMA · NEUHAUSER STR. 47 · MÜNCHEN',
    ])
  })
  it('leaves the agenda off when asked', () => {
    expect(flyerLines({ ...ev, showAgenda: false }).some(l => l.label === 'agenda')).toBe(false)
  })
  it('keeps price lines as typed, dropping blanks', () => {
    expect(priceLines(' Free \n\n10€ ')).toEqual(['Free', '10€'])
  })
  it('falls back to passes when price is empty', () => {
    const lines = flyerLines({ ...ev, price: '', passes: ['Full Pass · 210 €', 'Party Pass · 80 €'] })
    expect(lines.find(l => l.label === 'entry')?.text).toBe('Full Pass · 210 € · Party Pass · 80 €')
  })
  it('prefers price over passes', () => {
    const lines = flyerLines({ ...ev, price: '10€', passes: ['Full Pass · 210 €'] })
    expect(lines.find(l => l.label === 'entry')?.text).toBe('10€')
  })
  it('limits passes to 3 on the flyer', () => {
    const lines = flyerLines({ ...ev, price: '', passes: ['A · 10 €', 'B · 20 €', 'C · 30 €', 'D · 40 €'] })
    expect(lines.find(l => l.label === 'entry')?.text).toBe('A · 10 € · B · 20 € · C · 30 €')
  })
})

describe('flyerChanges', () => {
  it('pairs what changed and names new and dropped faces', () => {
    const was = { lines: ['A', 'DJ HAMZA', 'C'], pictured: ['DJ Hamza'] }
    const now = { lines: ['A', 'ELLIS', 'C'], pictured: ['Ellis'] }
    expect(flyerChanges(was, now)).toEqual([
      { was: 'DJ HAMZA', now: 'ELLIS' },
      { was: 'Photo: DJ Hamza', now: 'Photo: Ellis' },
    ])
  })
  it('is empty when nothing changed', () => {
    expect(flyerChanges({ lines: ['A'], pictured: [] }, { lines: ['A'], pictured: [] })).toEqual([])
  })
})

describe('checkFlyerText', () => {
  const lines = flyerLines(ev)
  it('passes when every line is on the poster, split or not', () => {
    const seen = ['THURSDAY 15 OCTOBER', 'LA CLAVE THURSDAY', '19:00-23:00', '19:00 REPARTO WORKSHOP • YUNIOR', '21:00 PARTY · DJ HAMZA',
      'DJ HAMZA', 'ALÖSHA', 'WORKSHOPS FREE · FROM 21:00 · 10€', 'LUMA', 'NEUHAUSER STR. 47', 'MÜNCHEN', 'CUBA']
    const c = checkFlyerText(lines, seen)
    expect(c.missing).toEqual([])
    expect(c.ok).toBe(true)
    expect(c.extra).toEqual(['CUBA'])
  })
  it('names a misspelt line, umlauts included', () => {
    const seen = ['THURSDAY 15 OCTOBER', 'LA CLAVE THURSDAY', '19:00 – 23:00', '19:00 Reparto workshop · Yunior', '21:00 Party · DJ Hamza',
      'DJ HAMZA · ALÖSHA', 'Workshops free · From 21:00 · 10€', 'LUMA · NEUHAUSER STR. 47 · MÜNEHEN']
    const c = checkFlyerText(lines, seen)
    expect(c.ok).toBe(false)
    expect(c.missing).toEqual(['LUMA · NEUHAUSER STR. 47 · MÜNCHEN'])
  })
  it('doesn’t require the music line', () => {
    expect(checkFlyerText(lines, lines.filter(l => l.label !== 'music').map(l => l.text)).ok).toBe(true)
  })
})

describe('paintPrompt', () => {
  it('spells out every line and the people', () => {
    const p = paintPrompt(flyerLines(ev), { description: 'Red neon street.' }, { people: ['Yunior'] })
    expect(p).toContain('featuring the person from image 1 as the artist')
    expect(p).toContain('Layout: the date and the title in the top 38%')
    expect(p).toContain('"LUMA · NEUHAUSER STR. 47 · MÜNCHEN"')
    expect(p).toContain('"19:00 Reparto workshop · Yunior"')
  })
})

describe('paintPrompt, the house way', () => {
  it('names the style reference as image 1 and numbers the photos after it', () => {
    const p = paintPrompt(flyerLines(ev), { description: 'Red neon street.' }, { styleRef: true, people: ['Yunior', 'Alösha'] })
    expect(p).toContain('Image 1 is the STYLE and LAYOUT reference')
    expect(p).toContain('Image 2: Yunior. Image 3: Alösha.')
    expect(p).toContain('Tall vertical 9:16')
  })
})

describe('a covered word', () => {
  it('fails the check when the reader marks hidden letters', () => {
    const lines = flyerLines(ev)
    const seen = lines.map(l => l.text).map(t => t === 'LA CLAVE THURSDAY' ? 'LA CLAVE TH___DAY' : t)
    expect(checkFlyerText(lines, seen).missing).toEqual(['LA CLAVE THURSDAY'])
  })
})

describe('a line painted twice', () => {
  it('is flagged, not failed', () => {
    const lines = flyerLines(ev)
    const c = checkFlyerText(lines, [...lines.map(l => l.text), 'TIMBA × BACHATA'])
    expect(c.ok).toBe(true)
    expect(c.extra).toEqual(['TIMBA × BACHATA (twice)'])
  })
})

describe('a festival over several days', () => {
  it('shows the dates and no time', () => {
    const lines = flyerLines({ name: 'Menéate Viena', startDate: '2026-11-26T20:00:00Z', endDate: '2026-11-29T22:59:00Z', timezone: 'Europe/Vienna', artists: [] })
    expect(lines.map(l => l.text)).toEqual(['MENÉATE VIENA', '26 – 29 NOVEMBER'])
  })
  it('spans months', () => {
    const lines = flyerLines({ name: 'X', startDate: '2026-10-30T10:00:00Z', endDate: '2026-11-01T20:00:00Z', timezone: 'Europe/Berlin', artists: [] })
    expect(lines[1]!.text).toBe('30 OCTOBER – 1 NOVEMBER')
  })
  it('a night past midnight is still one night', () => {
    const lines = flyerLines({ name: 'X', startDate: '2026-10-15T20:00:00Z', endDate: '2026-10-16T01:00:00Z', timezone: 'Europe/Berlin', artists: [] })
    expect(lines.map(l => l.label)).toEqual(['title', 'date', 'time'])
  })
})
