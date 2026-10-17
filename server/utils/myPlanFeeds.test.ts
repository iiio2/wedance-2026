/**
 * Pure helpers behind /my-plan's week socials (no database needed). The
 * DB-backed behaviour — swipe persistence, discover exclusion, the week
 * window — is covered in server/trpc/routers/plan-myPlanFeeds.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { pickWeekSocials, slugifyCity, stylesForDancer, stylesMatch, type WeekSocial } from './myPlanFeeds'

function social(id: string, day: number, opts: Partial<WeekSocial> = {}): WeekSocial {
  return {
    id,
    name: id,
    type: 'Party',
    styles: [],
    startDate: new Date(Date.UTC(2026, 9, 17 + day, 20)).toISOString(),
    endDate: null,
    timezone: 'Europe/Berlin',
    venueName: '',
    city: 'Munich',
    going: false,
    friendsGoing: 0,
    styleMatch: false,
    ...opts,
  }
}

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

describe('pickWeekSocials', () => {
  it('keeps only style matches when the dancer has styles and some match', () => {
    const out = pickWeekSocials([
      social('kiz', 1, { styleMatch: false }),
      social('salsa', 2, { styleMatch: true }),
    ], true)
    expect(out.map(s => s.id)).toEqual(['salsa'])
  })

  it('falls back to every social when none match the dancer\'s styles', () => {
    const out = pickWeekSocials([social('a', 1), social('b', 2)], true)
    expect(out.map(s => s.id)).toEqual(['a', 'b'])
  })

  it('always keeps RSVPs, even unmatched, and caps each day so the whole week shows', () => {
    const rows = [
      social('sat1', 1, { styleMatch: true }),
      social('sat2', 1, { styleMatch: true }),
      social('sat3', 1, { styleMatch: true }),
      social('sun1', 2, { styleMatch: true }),
      social('mine', 1, { going: true }),
    ]
    const out = pickWeekSocials(rows, true, 2)
    expect(out.map(s => s.id)).toEqual(['sat1', 'mine', 'sun1'])
  })
})

describe('stylesForDancer', () => {
  it('puts the dancer\'s styles first', () => {
    expect(stylesForDancer(['Ballroom', 'Salsa'], ['Salsa'])).toEqual(['Salsa', 'Ballroom'])
    expect(stylesForDancer(['Ballroom', 'Salsa'], [])).toEqual(['Ballroom', 'Salsa'])
  })
})
