import { describe, it, expect, vi, afterEach } from 'vitest'
import { getEarlyBirdInfo, getTicketPriceCents, getReferralDiscountPercent } from './ticket-prices'

describe('getEarlyBirdInfo', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns early-bird config for a known festival before the deadline', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-01-15'))

    const info = getEarlyBirdInfo('agua-pichi-2027')
    expect(info).not.toBeNull()
    expect(info!.offerName).toBe('Early Bird Full Pass')
    expect(info!.deadline).toBe('2027-04-01')
    expect(info!.priceCents).toBe(12_000)
    expect(info!.regularPriceCents).toBe(17_000)
  })

  it('returns null after the deadline has passed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2027-05-01'))

    const info = getEarlyBirdInfo('agua-pichi-2027')
    expect(info).toBeNull()
  })

  it('returns null for an unknown festival', () => {
    const info = getEarlyBirdInfo('nonexistent-festival-2099')
    expect(info).toBeNull()
  })
})

describe('getTicketPriceCents', () => {
  it('returns the correct price for a known ticket', () => {
    const result = getTicketPriceCents('agua-pichi-2027', 'Full Pass')
    expect(result).toEqual({ priceCents: 17_000, soldOut: false })
  })

  it('returns soldOut flag for sold-out tickets', () => {
    const result = getTicketPriceCents('agua-pichi-2027', 'Super-Early-Bird Party Pass')
    expect(result).toEqual({ priceCents: 5_000, soldOut: true })
  })

  it('returns null for unknown festival', () => {
    expect(getTicketPriceCents('unknown', 'Full Pass')).toBeNull()
  })

  it('returns null for unknown ticket name', () => {
    expect(getTicketPriceCents('agua-pichi-2027', 'VIP Backstage')).toBeNull()
  })
})

describe('getReferralDiscountPercent', () => {
  it('returns configured discount for a festival with a referral program', () => {
    expect(getReferralDiscountPercent('agua-pichi-2027')).toBe(10)
  })

  it('returns 0 for a festival without a referral program', () => {
    expect(getReferralDiscountPercent('nonexistent-festival')).toBe(0)
  })
})
