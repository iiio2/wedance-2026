/**
 * Selecting plan items that point at mock data (scripts/cleanup-mock-plan-items.ts).
 */
import { describe, it, expect } from 'vitest'
import { collectMockIds, countMockBy, selectMockPlanItems } from './mockPlanCleanup'
import * as munich from '../../app/data/mock-city-munich'
import * as berlin from '../../app/data/mock-city-berlin'
import * as previewFestivals from '../../app/data/mock-preview-festivals'

describe('collectMockIds', () => {
  it('derives ids and slugs from the mock files, nested anywhere', () => {
    const ids = collectMockIds([munich, berlin, previewFestivals])
    expect(ids.has('muc-3')).toBe(true)
    expect(ids.has(berlin.events[0]!.id)).toBe(true)
    expect(ids.has('timba-fest-london-2026')).toBe(true)
  })

  it('never takes a UUID for a mock id', () => {
    const ids = collectMockIds([{ events: [{ id: '3b3c7260-9a8f-4b80-9466-2aeba8c71ba6' }, { id: 'muc-x' }] }])
    expect([...ids]).toEqual(['muc-x'])
  })
})

describe('selectMockPlanItems', () => {
  const mock = new Set(['muc-3', 'meneate-viena-2026', 'sat-13'])
  const rows = [
    { id: '1', dancerId: 'a', itemType: 'event', itemId: 'muc-3' },
    { id: '2', dancerId: 'a', itemType: 'festival', itemId: 'meneate-viena-2026' },
    { id: '3', dancerId: 'a', itemType: 'workshop', itemId: 'sat-13' },
    { id: '4', dancerId: 'b', itemType: 'event', itemId: '3b3c7260-9a8f-4b80-9466-2aeba8c71ba6' },
    { id: '5', dancerId: 'b', itemType: 'event', itemId: 'muc-3' },
  ]

  it('picks events/festivals with a mock id, keeps ids that are also real rows, never workshops', () => {
    const out = selectMockPlanItems(rows, mock, new Set(['meneate-viena-2026']))
    expect(out.map(r => r.id)).toEqual(['1', '5'])
  })

  it('counts per key, biggest first', () => {
    expect(countMockBy(selectMockPlanItems(rows, mock, new Set()), r => r.itemId)).toEqual([['muc-3', 2], ['meneate-viena-2026', 1]])
  })
})
