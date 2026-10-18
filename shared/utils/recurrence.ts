/**
 * The dates of a recurring series (weekly classes, a party every second
 * Thursday, a social on the first Sunday of the month). Pure, local calendar
 * dates (YYYY-MM-DD) only: the times are applied per date in the event's zone,
 * so a series crossing a DST switch keeps its wall-clock time.
 *
 * - week / 2weeks: the start date's weekday, every 7 or 14 days.
 * - month: the same "nth weekday" as the start date (the 3rd Sunday), or the
 *   last one (`monthWeek: -1`). A month without a 5th weekday is skipped.
 * Stops at `until` (inclusive) or after `count` dates, whichever comes first.
 * Skipped dates don't count towards `count`.
 */

export type RepeatEvery = 'week' | '2weeks' | 'month'
export interface SeriesRule {
  start: string
  every: RepeatEvery
  until?: string | null
  count?: number | null
  skip?: string[]
  /** month only: 1–4, or -1 for the last. Default: the start date's. */
  monthWeek?: 1 | 2 | 3 | 4 | -1 | null
}

export const MAX_SERIES = 52

const DAY = 86400_000
const parse = (d: string) => new Date(`${d}T12:00:00Z`)
const fmt = (d: Date) => d.toISOString().slice(0, 10)
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export const weekdayOf = (d: string) => WEEKDAYS[parse(d).getUTCDay()]!

/** Which "nth weekday" a date is: 1–4, or 5 (only some months have it). */
export const nthOf = (d: string) => Math.ceil(parse(d).getUTCDate() / 7)

function nthWeekday(y: number, m: number, weekday: number, n: number): Date | null {
  const year = y + Math.floor(m / 12)
  const month = ((m % 12) + 12) % 12
  if (n === -1) {
    const last = new Date(Date.UTC(year, month + 1, 0, 12))
    last.setUTCDate(last.getUTCDate() - ((last.getUTCDay() - weekday + 7) % 7))
    return last
  }
  const first = new Date(Date.UTC(year, month, 1, 12))
  const d = new Date(first.getTime() + ((weekday - first.getUTCDay() + 7) % 7) * DAY + (n - 1) * 7 * DAY)
  return d.getUTCMonth() === month ? d : null
}

export function seriesDates(rule: SeriesRule): { dates: string[]; skipped: string[] } {
  if (!rule.until && !rule.count) throw new Error('Give an end date (until) or a number of dates (count).')
  if (rule.until && rule.until < rule.start) throw new Error('The end date is before the first date.')
  const cap = Math.min(rule.count ?? MAX_SERIES, MAX_SERIES)
  const skip = new Set(rule.skip ?? [])
  const dates: string[] = []
  const skipped: string[] = []
  const take = (d: string) => {
    if (skip.has(d)) skipped.push(d)
    else dates.push(d)
  }
  const start = parse(rule.start)
  // Enough candidates to fill the cap past any skips, never unbounded.
  const limit = cap + skip.size
  if (rule.every === 'month') {
    const weekday = start.getUTCDay()
    const n = rule.monthWeek ?? (nthOf(rule.start) > 4 ? -1 : nthOf(rule.start))
    for (let i = 0, seen = 0; dates.length < cap && seen < limit && i < 120; i++) {
      const d = nthWeekday(start.getUTCFullYear(), start.getUTCMonth() + i, weekday, n)
      if (!d) continue
      const s = fmt(d)
      if (s < rule.start) continue
      if (rule.until && s > rule.until) break
      seen++
      take(s)
    }
  } else {
    const step = rule.every === 'week' ? 7 : 14
    for (let i = 0; dates.length < cap && i < limit; i++) {
      const s = fmt(new Date(start.getTime() + i * step * DAY))
      if (rule.until && s > rule.until) break
      take(s)
    }
  }
  return { dates, skipped }
}
