import { describe, it, expect } from 'vitest'
import { pickChampions } from './battleChampions'

const v = (id: string, citySlug: string, competitionMonth: string, eloScore: number) =>
  ({ id, citySlug, competitionMonth, eloScore })

describe('pickChampions', () => {
  it('uses the current month when at least two cities have videos', () => {
    const { champions, fallback } = pickChampions([
      v('m1', 'munich', '2026-10', 1000),
      v('h1', 'havana', '2026-10', 1100),
      v('old', 'berlin', '2026-07', 1500),
    ], '2026-10')
    expect(fallback).toBe(false)
    expect(champions.map(c => c.id)).toEqual(['h1', 'm1'])
  })

  it('keeps only the highest-ELO video per city', () => {
    const { champions } = pickChampions([
      v('a', 'munich', '2026-10', 1000),
      v('b', 'munich', '2026-10', 1200),
      v('c', 'havana', '2026-10', 1100),
    ], '2026-10')
    expect(champions.map(c => c.id)).toEqual(['b', 'c'])
  })

  it('falls back to all months when the current month has no videos', () => {
    const { champions, fallback } = pickChampions([
      v('m1', 'munich', '2026-07', 1000),
      v('m2', 'munich', '2026-08', 1300),
      v('h1', 'havana', '2026-07', 1100),
    ], '2026-10')
    expect(fallback).toBe(true)
    expect(champions.map(c => c.id)).toEqual(['m2', 'h1'])
  })

  it('falls back when only one city has a current-month video', () => {
    const { champions, fallback } = pickChampions([
      v('m1', 'munich', '2026-10', 900),
      v('h1', 'havana', '2026-07', 1100),
    ], '2026-10')
    expect(fallback).toBe(true)
    expect(champions.map(c => c.citySlug).sort()).toEqual(['havana', 'munich'])
  })

  it('returns nothing when there are no videos at all', () => {
    expect(pickChampions([], '2026-10')).toEqual({ champions: [], fallback: true })
  })
})
