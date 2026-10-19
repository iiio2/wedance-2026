/**
 * Regression test for RAZ-175: Festival board shows past festivals as upcoming
 *
 * Ensures:
 * 1. Past festivals (where endDate has passed) are filtered out
 * 2. Upcoming festivals are sorted by startDate (nearest first)
 * 3. The daysUntil formatter works correctly for various scenarios
 *
 * CRITICAL: This test imports the REAL implementations from festivalDateFormatter.ts,
 * not local copies. If the source functions break, this test WILL fail.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { hasEventEnded, daysUntil } from './festivalDateFormatter'

// Mock date: 2026-09-23 (fixed "today" for deterministic tests)
const MOCK_TODAY = new Date('2026-09-23')

describe('Festival board (RAZ-175)', () => {
  beforeEach(() => {
    // Override Date constructor to return fixed date
    vi.useFakeTimers()
    vi.setSystemTime(MOCK_TODAY)
  })

  it('should mark festivals ending before today as ended', () => {
    // March 2026 festivals (6+ months past relative to 2026-09-23)
    expect(hasEventEnded('2026-03-15')).toBe(true)
    expect(hasEventEnded('2026-03-29')).toBe(true)

    // July 2026 festival (2 months past)
    expect(hasEventEnded('2026-07-06')).toBe(true)

    // September 18-21 (just ended)
    expect(hasEventEnded('2026-09-21')).toBe(true)
  })

  it('should mark festivals ending today or later as upcoming', () => {
    // Today
    expect(hasEventEnded('2026-09-23')).toBe(false)

    // Future festivals
    expect(hasEventEnded('2026-10-12')).toBe(false)
    expect(hasEventEnded('2027-07-04')).toBe(false)
  })

  it('should format days correctly for various date ranges', () => {
    // Past event
    expect(daysUntil('2026-03-14')).toBe('Past')

    // Today
    expect(daysUntil('2026-09-23')).toBe('Today')

    // Tomorrow
    expect(daysUntil('2026-09-24')).toBe('Tomorrow')

    // Days (within 30 days)
    expect(daysUntil('2026-10-03')).toMatch(/^In \d+ days$/)

    // Weeks (31-60 days)
    expect(daysUntil('2026-11-10')).toMatch(/^In \d+ weeks$/)

    // Months (>60 days)
    expect(daysUntil('2027-07-01')).toMatch(/^In \d+ months$/)
  })

  it('should filter out festivals where endDate has passed', () => {
    const festivals = [
      { slug: 'past-1', startDate: '2026-03-14', endDate: '2026-03-15' },
      { slug: 'past-2', startDate: '2026-03-21', endDate: '2026-03-22' },
      { slug: 'past-3', startDate: '2026-03-26', endDate: '2026-03-29' },
      { slug: 'upcoming-1', startDate: '2026-10-10', endDate: '2026-10-12' },
      { slug: 'upcoming-2', startDate: '2027-07-01', endDate: '2027-07-04' },
    ]

    const filtered = festivals.filter(f => !hasEventEnded(f.endDate))

    expect(filtered).toHaveLength(2)
    expect(filtered.map(f => f.slug)).toEqual(['upcoming-1', 'upcoming-2'])
  })

  it('should sort festivals by startDate ascending (nearest first)', () => {
    const festivals = [
      { slug: 'far-future', startDate: '2027-07-01', endDate: '2027-07-04' },
      { slug: 'near-future', startDate: '2026-10-10', endDate: '2026-10-12' },
      { slug: 'very-near', startDate: '2026-09-25', endDate: '2026-09-27' },
    ]

    const sorted = festivals.sort((a, b) =>
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    )

    expect(sorted.map(f => f.slug)).toEqual(['very-near', 'near-future', 'far-future'])
  })

  it('should handle both filtering and sorting together', () => {
    const festivals = [
      { slug: 'past-1', startDate: '2026-03-26', endDate: '2026-03-29' },
      { slug: 'far-future', startDate: '2027-07-01', endDate: '2027-07-04' },
      { slug: 'past-2', startDate: '2026-03-14', endDate: '2026-03-15' },
      { slug: 'near-future', startDate: '2026-10-10', endDate: '2026-10-12' },
    ]

    // Filter then sort
    const result = festivals
      .filter(f => !hasEventEnded(f.endDate))
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())

    expect(result.map(f => f.slug)).toEqual(['near-future', 'far-future'])
  })
})

// SSR (Vercel, UTC) and the browser (the dancer's zone) must agree, or the
// label hydrates differently around midnight.
describe('daysUntil — datetimes count days in the event zone, not the runtime zone', () => {
  const originalTz = process.env.TZ
  // 23:30 UTC on the 20th = 01:30 on the 21st in Munich.
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-20T23:30:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
    process.env.TZ = originalTz
  })

  it('reads the same in UTC and in Munich', () => {
    const event = '2026-10-21T19:00:00.000Z' // 21:00 on the 21st in Munich
    const labels = ['UTC', 'Europe/Berlin', 'America/New_York', 'Asia/Dhaka'].map((tz) => {
      process.env.TZ = tz
      return daysUntil(event)
    })
    expect(new Set(labels)).toEqual(new Set(['Today']))
  })

  it('uses the event timezone when given', () => {
    // "Now" is 19:30 on the 20th in New York, 01:30 on the 21st in Munich.
    // 05:00Z on the 21st is 01:00 that night in New York, 07:00 in Munich.
    expect(daysUntil('2026-10-21T05:00:00.000Z', 'America/New_York')).toBe('Tomorrow')
    expect(daysUntil('2026-10-21T05:00:00.000Z', 'Europe/Berlin')).toBe('Today')
    expect(daysUntil('2026-10-21T05:00:00.000Z')).toBe('Today') // default zone: Europe/Berlin
  })
})
