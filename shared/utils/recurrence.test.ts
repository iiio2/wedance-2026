import { describe, it, expect } from 'vitest'
import { seriesDates, weekdayOf, nthOf, MAX_SERIES } from './recurrence'

describe('seriesDates', () => {
  it('weekly from the first date, until inclusive', () => {
    expect(seriesDates({ start: '2026-10-22', every: 'week', until: '2026-11-12' }).dates)
      .toEqual(['2026-10-22', '2026-10-29', '2026-11-05', '2026-11-12'])
  })
  it('count skips the skipped dates (they don’t count)', () => {
    const r = seriesDates({ start: '2026-10-22', every: 'week', count: 3, skip: ['2026-10-29'] })
    expect(r.dates).toEqual(['2026-10-22', '2026-11-05', '2026-11-12'])
    expect(r.skipped).toEqual(['2026-10-29'])
  })
  it('every second week', () => {
    expect(seriesDates({ start: '2026-10-22', every: '2weeks', count: 3 }).dates).toEqual(['2026-10-22', '2026-11-05', '2026-11-19'])
  })
  it('monthly on the same nth weekday (3rd Sunday)', () => {
    expect(nthOf('2026-10-18')).toBe(3)
    expect(weekdayOf('2026-10-18')).toBe('Sunday')
    expect(seriesDates({ start: '2026-10-18', every: 'month', count: 4 }).dates).toEqual(['2026-10-18', '2026-11-15', '2026-12-20', '2027-01-17'])
  })
  it('monthly on the last weekday, also when asked from a 5th weekday', () => {
    // 2026-10-29 is the 5th (and last) Thursday of October.
    expect(seriesDates({ start: '2026-10-29', every: 'month', count: 3 }).dates).toEqual(['2026-10-29', '2026-11-26', '2026-12-31'])
    expect(seriesDates({ start: '2026-10-01', every: 'month', count: 2, monthWeek: -1 }).dates).toEqual(['2026-10-29', '2026-11-26'])
  })
  it('first weekday of the month crossing a year', () => {
    expect(seriesDates({ start: '2026-12-06', every: 'month', until: '2027-02-28' }).dates).toEqual(['2026-12-06', '2027-01-03', '2027-02-07'])
  })
  it('needs an end, refuses an end before the start, never exceeds the cap', () => {
    expect(() => seriesDates({ start: '2026-10-22', every: 'week' })).toThrow(/until.*count/)
    expect(() => seriesDates({ start: '2026-10-22', every: 'week', until: '2026-10-01' })).toThrow(/before/)
    expect(seriesDates({ start: '2026-01-01', every: 'week', until: '2030-01-01' }).dates).toHaveLength(MAX_SERIES)
    expect(seriesDates({ start: '2026-01-01', every: 'week', count: 500 }).dates).toHaveLength(MAX_SERIES)
  })
  it('a skip list covering every date leaves nothing', () => {
    const r = seriesDates({ start: '2026-10-22', every: 'week', until: '2026-10-29', skip: ['2026-10-22', '2026-10-29'] })
    expect(r.dates).toEqual([])
    expect(r.skipped).toHaveLength(2)
  })
})

// ── Date-only weekday consistency (RAZ-649) ──────────────────────────────────
// weekdayOf parses via T12:00:00Z to avoid timezone-dependent day shifts.
// A naive new Date('2026-10-11') in UTC−8 would resolve to Saturday instead of
// Sunday. These tests pin all seven weekdays for a known week.
describe('weekdayOf — date-only weekday consistency', () => {
  const WEEK: [string, string][] = [
    ['2026-10-05', 'Monday'],
    ['2026-10-06', 'Tuesday'],
    ['2026-10-07', 'Wednesday'],
    ['2026-10-08', 'Thursday'],
    ['2026-10-09', 'Friday'],
    ['2026-10-10', 'Saturday'],
    ['2026-10-11', 'Sunday'],
  ]

  for (const [date, name] of WEEK) {
    it(`resolves ${date} as ${name}`, () => {
      expect(weekdayOf(date)).toBe(name)
    })
  }

  it('noon-UTC pinning prevents Sunday from shifting to Saturday', () => {
    // If weekdayOf used new Date('2026-10-11') without T12:00:00Z,
    // a UTC−8 runtime would parse it as 2026-10-10T08:00:00Z (still Sat UTC).
    // With noon pinning, getUTCDay() always returns 0 (Sunday).
    expect(weekdayOf('2026-10-11')).toBe('Sunday')
    expect(weekdayOf('2026-10-12')).toBe('Monday')
  })
})
