import { describe, expect, it } from 'vitest'
import { contrastRatio, mixHex, readableOn, wcagLevel } from './contrast'

describe('contrastRatio', () => {
  it('is 21 for black on white and 1 for identical colours', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#dc2626', '#dc2626')).toBeCloseTo(1, 5)
  })

  it('is symmetric', () => {
    expect(contrastRatio('#3b1f0d', '#fbf5ea')).toBeCloseTo(contrastRatio('#fbf5ea', '#3b1f0d'), 10)
  })
})

describe('wcagLevel', () => {
  it('maps ratios to WCAG levels', () => {
    expect(wcagLevel(7.2)).toBe('AAA')
    expect(wcagLevel(4.6)).toBe('AA')
    expect(wcagLevel(3.1)).toBe('AA large')
    expect(wcagLevel(2)).toBe('fail')
  })
})

describe('readableOn', () => {
  it('leaves passing colours alone', () => {
    expect(readableOn('#3b1f0d', '#ffffff')).toBe('#3b1f0d')
  })

  it('darkens accents until they reach 4.5:1 on their own tint', () => {
    for (const accent of ['#dc2626', '#0891b2', '#16a34a', '#a855f7', '#f59e0b', '#ec4899', '#7c3aed']) {
      const tint = mixHex(accent, '#ffffff', 0.094)
      expect(contrastRatio(readableOn(accent, tint), tint)).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('mixHex', () => {
  it('mixes in sRGB', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080')
    expect(mixHex('#dc2626', '#ffffff', 1)).toBe('#dc2626')
  })
})
