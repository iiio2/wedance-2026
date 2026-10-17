/**
 * Pure helpers behind /my-plan's week socials and discover deck (no database needed). The
 * DB-backed behaviour — swipe persistence, discover exclusion, the planned
 * week — is covered in server/trpc/routers/plan-myPlanFeeds.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { resolveWeekOccurrences, slugifyCity, stylesForDancer, stylesMatch } from './myPlanFeeds'

describe('stylesMatch', () => {
  it('matches the same style and its variants', () => {
    expect(stylesMatch(['Salsa'], ['salsa'])).toBe(true)
    expect(stylesMatch(['Rueda de Casino'], ['Salsa'])).toBe(true)
  })
  it('does not match unrelated styles or empty lists', () => {
    expect(stylesMatch(['Kizomba'], ['Salsa'])).toBe(false)
    expect(stylesMatch([], ['Salsa'])).toBe(false)
    expect(stylesMatch(['Salsa'], [])).toBe(false)
  })
})

describe('slugifyCity', () => {
  it('turns a free-text city into an events.city_slug', () => {
    expect(slugifyCity('München')).toBe('munchen')
    expect(slugifyCity(' Frankfurt am Main ')).toBe('frankfurt-am-main')
  })
})

describe('resolveWeekOccurrences', () => {
  const at = (d: number) => new Date(Date.UTC(2026, 9, 17 + d, 20))

  it('shows a planned occurrence that falls in the week', () => {
    const out = resolveWeekOccurrences([{ id: 'a', seriesId: null }], [{ id: 'a', seriesId: null, startDate: at(1) }])
    expect(out).toEqual([{ eventId: 'a', planItemId: 'a' }])
  })

  it('shows the next occurrence of a recurring event planned on another date', () => {
    const out = resolveWeekOccurrences(
      [{ id: 'last-week', seriesId: 's1' }],
      [{ id: 'thu', seriesId: 's1', startDate: at(2) }, { id: 'next-thu', seriesId: 's1', startDate: at(6) }],
    )
    expect(out).toEqual([{ eventId: 'thu', planItemId: 'last-week' }])
  })

  it('does not repeat a series already planned directly this week', () => {
    const out = resolveWeekOccurrences(
      [{ id: 'thu', seriesId: 's1' }, { id: 'old', seriesId: 's1' }],
      [{ id: 'thu', seriesId: 's1', startDate: at(2) }],
    )
    expect(out).toEqual([{ eventId: 'thu', planItemId: 'thu' }])
  })

  it('returns nothing for planned events outside the week', () => {
    expect(resolveWeekOccurrences([{ id: 'x', seriesId: null }], [])).toEqual([])
  })
})

describe('stylesForDancer', () => {
  it('puts the dancer\'s styles first', () => {
    expect(stylesForDancer(['Ballroom', 'Salsa'], ['Salsa'])).toEqual(['Salsa', 'Ballroom'])
    expect(stylesForDancer(['Ballroom', 'Salsa'], [])).toEqual(['Ballroom', 'Salsa'])
  })
})
