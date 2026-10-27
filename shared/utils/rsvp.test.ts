import { describe, it, expect } from 'vitest'
import { isPartnerEvent, isRsvpAnswer, pairingAnswer, rsvpOptions, rsvpSummaryLine, summarizeRsvps } from './rsvp'

describe('isPartnerEvent', () => {
  it('knows couple dances from solo ones', () => {
    expect(isPartnerEvent(['Salsa', 'Casino'])).toBe(true)
    expect(isPartnerEvent(['Bachata'])).toBe(true)
    expect(isPartnerEvent(['Zouk'])).toBe(true)
    expect(isPartnerEvent(['Reggaeton'])).toBe(false)
    expect(isPartnerEvent(['Afrobeats', 'Dancehall'])).toBe(false)
    expect(isPartnerEvent([])).toBe(false)
    expect(isPartnerEvent(null)).toBe(false)
  })
})

describe('rsvpOptions', () => {
  it('asks the organiser’s four questions for a partner dance', () => {
    expect(rsvpOptions(true).map(o => o.label)).toEqual(['With my partner', 'I follow, need a leader', 'I lead, need a follower', 'Next time'])
  })
  it('asks Yes / with a friend / Next time otherwise', () => {
    expect(rsvpOptions(false).map(o => [o.id, o.label])).toEqual([['yes', 'I’m going'], ['partner', 'With a friend'], ['next', 'Next time']])
  })
})

describe('summarizeRsvps / rsvpSummaryLine', () => {
  const rows = [
    ...Array(2).fill({ answer: 'partner', confirmed: true }),
    ...Array(3).fill({ answer: 'needLeader', confirmed: true }),
    { answer: 'needFollower', confirmed: true },
    { answer: 'needFollower', confirmed: false },
    ...Array(3).fill({ answer: 'next', confirmed: true }),
  ]
  it('counts the buckets, the unconfirmed, and a partner as two people', () => {
    const s = summarizeRsvps(rows)
    expect(s.counts).toEqual({ partner: 2, needLeader: 3, needFollower: 2, yes: 0, next: 3 })
    expect(s.unconfirmed).toBe(1)
    expect(s.coming).toBe(9)
    expect(s.balance).toBe(1)
  })
  it('reads like the organiser’s view', () => {
    expect(rsvpSummaryLine(summarizeRsvps(rows), true))
      .toBe('9 coming · 1 unconfirmed · 2 with a partner · 3 need a leader · 2 need a follower · 3 next time → 1 leader short')
    expect(rsvpSummaryLine(summarizeRsvps([{ answer: 'needFollower', confirmed: true }]), true))
      .toBe('1 coming · 0 with a partner · 0 need a leader · 1 need a follower · 0 next time → 1 follower short')
    expect(rsvpSummaryLine(summarizeRsvps([{ answer: 'yes', confirmed: true }, { answer: 'partner', confirmed: true }]), false))
      .toBe('3 coming · 1 alone · 1 with a friend · 0 next time')
  })
})

describe('pairingAnswer / isRsvpAnswer', () => {
  it('pairs leader needs with follower needs', () => {
    expect(pairingAnswer('needLeader')).toBe('needFollower')
    expect(pairingAnswer('needFollower')).toBe('needLeader')
    expect(pairingAnswer('partner')).toBeNull()
  })
  it('accepts only known answers', () => {
    expect(isRsvpAnswer('needLeader')).toBe(true)
    expect(isRsvpAnswer('maybe')).toBe(false)
    expect(isRsvpAnswer(undefined)).toBe(false)
  })
})
