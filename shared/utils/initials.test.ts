import { describe, expect, it } from 'vitest'
import { initialOf, initialsOf } from './initials'

/** True when `s` holds a UTF-16 surrogate that has lost its partner. */
const hasLoneSurrogate = (s: string) => /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s)

describe('initialOf', () => {
  it('takes the first letter, upper-cased', () => {
    expect(initialOf('salsa night')).toBe('S')
    expect(initialOf('Ölmühle')).toBe('Ö')
  })

  it('folds styled "math bold" letters instead of splitting the surrogate pair', () => {
    // The synced festival title that broke /festivals hydration.
    const name = '𝐆𝐋𝐎𝐁𝐀𝐋 𝐓𝐀𝐑𝐑𝐀𝐗𝐎 𝐅𝐄𝐒𝐓𝐈𝐕𝐀𝐋 𝐏𝐀𝐑𝐈𝐒 𝟐𝟎𝟐𝟔'
    expect(name.charAt(0)).toBe('\uD835') // the old behaviour: half a character
    expect(initialOf(name)).toBe('G')
  })

  it('skips leading punctuation and emoji', () => {
    expect(initialOf('¡Menéate Viena! 2026')).toBe('M')
    expect(initialOf('★ Salsation Festival ★')).toBe('S')
    expect(initialOf('🎃 Halloween Latino')).toBe('H')
    expect(initialOf('2026 Kizomba Fest')).toBe('2')
  })

  it('falls back when there is no letter or digit', () => {
    expect(initialOf('')).toBe('?')
    expect(initialOf(null)).toBe('?')
    expect(initialOf('🕺💃')).toBe('?')
    expect(initialOf('   ', '')).toBe('')
  })

  it('never returns a lone surrogate', () => {
    for (const s of ['𝐀', '🎃x', '𝓢𝓪𝓵𝓼𝓪', '\uD835', 'a\uDC00']) expect(hasLoneSurrogate(initialOf(s))).toBe(false)
  })
})

describe('initialsOf', () => {
  it('joins the first letters of the first words', () => {
    expect(initialsOf('Ana María López')).toBe('AM')
    expect(initialsOf('Ana María López', 3)).toBe('AML')
    expect(initialsOf('cher')).toBe('C')
  })

  it('skips words without a letter and handles styled letters', () => {
    expect(initialsOf('🕺 Mark + Klaus')).toBe('MK')
    expect(initialsOf('𝐆𝐋𝐎𝐁𝐀𝐋 𝐓𝐀𝐑𝐑𝐀𝐗𝐎')).toBe('GT')
  })

  it('falls back for an empty name', () => {
    expect(initialsOf('')).toBe('?')
    expect(initialsOf(undefined, 2, '')).toBe('')
  })
})
