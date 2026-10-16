import { describe, it, expect } from 'vitest'
import { useSharePlan } from './useSharePlan'

const plan = new Map([
  ['sat-f1-1400', { workshopId: 'sat-f1-1400', role: 'lead', partnerStatus: 'looking' }],
]) as any

describe('useSharePlan', () => {
  const { encode, decode } = useSharePlan()

  it('round-trips the sharer dancer id so visitors can add them as a friend', () => {
    const id = '0b6a1f7e-2c1d-4f3a-9a0e-6d2b7c8e9f10'
    const decoded = decode(encode('Alösha', 'lead', plan, id))
    expect(decoded?.name).toBe('Alösha')
    expect(decoded?.dancerId).toBe(id)
    expect(decoded?.plan[0]).toEqual({ workshopId: 'sat-f1-1400', role: 'lead', partnerStatus: 'looking' })
  })

  it('decodes links shared before the id existed', () => {
    const decoded = decode(encode('Alösha', 'lead', plan))
    expect(decoded?.dancerId).toBeNull()
    expect(decoded?.plan).toHaveLength(1)
  })
})
