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
    const p = paintPrompt(flyerLines(ev), { description: 'Red neon street.' }, { people: 1 })
    expect(p).toContain('person from the first photo')
    expect(p).toContain('"LUMA · NEUHAUSER STR. 47 · MÜNCHEN"')
    expect(p).toContain('"19:00 Reparto workshop · Yunior"')
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
