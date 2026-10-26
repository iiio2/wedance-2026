/**
 * RAZ-683 — this-week membership on /cities/[city] is computed in local time.
 * Extends the eventTime zone tests (shared/utils/eventTime.zoned.test.ts), which
 * cover a single event's local date; these cover the week window around it.
 *
 * The week is the VIEWER's local Monday–Sunday (Date getters), so each case pins
 * process.env.TZ; Node re-reads it on assignment.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { weekDateKeys, localDateKey, cityFeed } from './cityWeek'

const ORIGINAL_TZ = process.env.TZ
afterEach(() => { process.env.TZ = ORIGINAL_TZ })

const at = (tz: string, iso: string) => { process.env.TZ = tz; return new Date(iso) }
const week = (from: string, to: string) => {
  const out: string[] = []
  for (let d = new Date(`${from}T12:00:00Z`); localIso(d) <= to; d = new Date(d.getTime() + 86400_000)) out.push(localIso(d))
  return out
}
const localIso = (d: Date) => d.toISOString().slice(0, 10)

describe('weekDateKeys — local Monday to Sunday (RAZ-683)', () => {
  it.each([
    // [viewer zone, "now" as a UTC instant, expected Monday, expected Sunday]
    ['Europe/Berlin', '2026-10-21T10:00:00Z', '2026-10-19', '2026-10-25'], // midweek, CEST
    ['Europe/Berlin', '2026-10-18T22:30:00Z', '2026-10-19', '2026-10-25'], // Mon 00:30 CEST = Sun 22:30 UTC
    ['Europe/Berlin', '2026-10-18T21:59:00Z', '2026-10-12', '2026-10-18'], // Sun 23:59 CEST — still the old week
    ['Europe/Berlin', '2026-10-25T22:30:00Z', '2026-10-19', '2026-10-25'], // Sun 23:30 CET, the night DST ended
    ['Europe/Berlin', '2026-10-25T23:00:00Z', '2026-10-26', '2026-11-01'], // Mon 00:00 CET, first week after DST end
    ['Europe/Berlin', '2026-03-29T22:30:00Z', '2026-03-30', '2026-04-05'], // Mon 00:30 CEST after DST start
    ['Europe/Berlin', '2026-03-29T01:30:00Z', '2026-03-23', '2026-03-29'], // Sun 02:30 doesn't exist → 03:30 CEST, same week
    ['America/New_York', '2026-10-26T01:00:00Z', '2026-10-19', '2026-10-25'], // Sun 21:00 EDT = Mon 01:00 UTC
    ['Asia/Tokyo', '2026-10-25T15:30:00Z', '2026-10-26', '2026-11-01'], // Mon 00:30 JST = Sun 15:30 UTC
  ])('%s at %s → %s…%s', (tz, iso, mon, sun) => {
    const keys = [...weekDateKeys(at(tz, iso))]
    expect(keys).toEqual(week(mon, sun))
    expect(new Set(keys).size).toBe(7)
  })

  it('never takes the date from toISOString (a CEST Monday morning stays Monday)', () => {
    const now = at('Europe/Berlin', '2026-10-18T23:15:00Z') // Mon 01:15 CEST
    expect(now.toISOString().slice(0, 10)).toBe('2026-10-18') // the UTC date the old bug used
    expect(localDateKey(now)).toBe('2026-10-19')
    expect(weekDateKeys(now).has('2026-10-18')).toBe(false)
  })
})

describe('cityFeed — which events count as this week (RAZ-683)', () => {
  const synced = (id: string, startDate: string, extra: Record<string, any> = {}) => ({ id, startDate, timezone: 'Europe/Berlin', isFestival: false, styles: ['Salsa'], ...extra })
  const booked = (id: string, eventDate: string) => ({ id, eventDate, styles: ['Salsa'] })

  it('dates synced events in the event\'s zone, at both ends of the week', () => {
    const wk = weekDateKeys(at('Europe/Berlin', '2026-10-21T10:00:00Z')) // 19–25 Oct
    const feed = cityFeed([], [
      synced('mon-0030-cest', '2026-10-18T22:30:00Z'), // Mon 19 00:30 CEST → this week (UTC date is the 18th)
      synced('sun-2330-cest', '2026-10-18T21:30:00Z'), // Sun 18 23:30 CEST → last week, dropped
      synced('sun-2330-cet', '2026-10-25T22:30:00Z'), // Sun 25 23:30 CET (after DST end) → this week
      synced('mon-0030-cet', '2026-10-25T23:30:00Z'), // Mon 26 00:30 CET → later
    ], wk)
    expect(feed.syncedThisWeek.map(e => e.id)).toEqual(['mon-0030-cest', 'sun-2330-cet'])
    expect(feed.syncedLater.map(e => e.id)).toEqual(['mon-0030-cet'])
  })

  it('a viewer in another zone still sees the event on its own local date', () => {
    // Viewer in New York, Sunday evening; the Munich social is Monday 00:30 Munich time.
    const wk = weekDateKeys(at('America/New_York', '2026-10-25T22:00:00Z')) // Sun 25 Oct EDT → 19–25 Oct
    const feed = cityFeed([], [synced('munich-mon', '2026-10-25T23:30:00Z')], wk)
    expect(feed.syncedThisWeek).toHaveLength(0)
    expect(feed.syncedLater.map(e => e.id)).toEqual(['munich-mon'])
  })

  it('reads booked events by their local event date, never shifting the day', () => {
    const wk = weekDateKeys(at('Europe/Berlin', '2026-10-21T10:00:00Z'))
    const feed = cityFeed([
      booked('first-day', '2026-10-19'), booked('last-day', '2026-10-25'),
      booked('next-mon', '2026-10-26'), booked('prev-sun', '2026-10-18'), { id: 'undated', eventDate: null, styles: [] },
    ], [], wk)
    expect(feed.bookedThisWeek.map(b => b.id)).toEqual(['first-day', 'last-day'])
    expect(feed.bookedLater.map(b => b.id)).toEqual(['next-mon'])
  })

  it('keeps festivals out of the weekly lists (they have their own section)', () => {
    const wk = weekDateKeys(at('Europe/Berlin', '2026-10-21T10:00:00Z'))
    const feed = cityFeed([], [synced('fest', '2026-10-22T18:00:00Z', { isFestival: true }), synced('fest-later', '2026-11-22T18:00:00Z', { isFestival: true })], wk)
    expect(feed.syncedThisWeek).toHaveLength(0)
    expect(feed.syncedLater).toHaveLength(0)
  })
})
