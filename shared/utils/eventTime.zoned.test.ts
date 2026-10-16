import { describe, it, expect } from 'vitest'
import { zonedToUtc, eventLocalDate, eventLocalTime, nightStart } from './eventTime'

describe('zonedToUtc', () => {
  it('converts Munich summer and winter wall-clock times', () => {
    expect(zonedToUtc('2026-07-16', '20:00', 'Europe/Berlin').toISOString()).toBe('2026-07-16T18:00:00.000Z')
    expect(zonedToUtc('2026-12-03', '20:00', 'Europe/Berlin').toISOString()).toBe('2026-12-03T19:00:00.000Z')
  })

  it('handles the night the clocks change (last Sunday of October)', () => {
    expect(zonedToUtc('2026-10-25', '12:00', 'Europe/Berlin').toISOString()).toBe('2026-10-25T11:00:00.000Z')
    expect(zonedToUtc('2026-10-24', '23:30', 'Europe/Berlin').toISOString()).toBe('2026-10-24T21:30:00.000Z')
  })

  it('round-trips through the local formatters in other zones', () => {
    for (const tz of ['America/New_York', 'Asia/Tokyo', 'Europe/London']) {
      const d = zonedToUtc('2026-11-14', '21:15', tz)
      expect(eventLocalDate(d, tz)).toBe('2026-11-14')
      expect(eventLocalTime(d, tz)).toBe('21:15')
    }
  })
})

describe('nightStart', () => {
  it('starts tonight at 06:00 local once the morning has passed', () => {
    expect(nightStart(new Date('2026-10-16T20:28:00Z'), 'Europe/Berlin').toISOString()).toBe('2026-10-16T04:00:00.000Z')
  })

  it('keeps the previous evening until 06:00 local', () => {
    // 02:30 Munich on Oct 17 is still the night of Oct 16.
    expect(nightStart(new Date('2026-10-17T00:30:00Z'), 'Europe/Berlin').toISOString()).toBe('2026-10-16T04:00:00.000Z')
  })

  it('rolls back across a month boundary', () => {
    expect(nightStart(new Date('2026-11-01T02:00:00Z'), 'Europe/Berlin').toISOString()).toBe('2026-10-31T05:00:00.000Z')
  })
})
