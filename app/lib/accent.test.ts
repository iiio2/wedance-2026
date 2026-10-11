import { describe, expect, it } from 'vitest'
import { accentText, blend, darken } from './accent'
import { contrastRatio } from './contrast'
import { WD } from './brand'

describe('accentText', () => {
  it('keeps a dark accent unchanged', () => {
    expect(accentText(WD.amber600)).toBe(WD.amber600)
  })
  it('darkens a light accent until it passes 4.5:1 on its tint', () => {
    const c = accentText(WD.amber500)
    expect(c).not.toBe(WD.amber500)
    expect(contrastRatio(c, blend(WD.amber500, 0.094))).toBeGreaterThanOrEqual(4.5)
  })
  it('passes non-hex input through', () => {
    expect(accentText('var(--wd-red-600)')).toBe('var(--wd-red-600)')
  })
  it('blend and darken match color-mix maths', () => {
    expect(blend(WD.brown900, 1)).toBe(WD.brown900)
    expect(darken(WD.red600, 0)).toBe(WD.red600)
  })
})
