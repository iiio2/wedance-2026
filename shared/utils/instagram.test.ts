import { describe, it, expect } from 'vitest'
import { parseInstagramHandle, handleFromInstagram, nameFromInstagram } from './instagram'

describe('parseInstagramHandle', () => {
  it('reads every way people paste an Instagram account', () => {
    for (const s of [
      'https://www.instagram.com/ritmo_jg',
      'https://www.instagram.com/ritmo_jg/',
      'https://instagram.com/ritmo_jg?igsh=MXZ3b2xkY2s1',
      'instagram.com/Ritmo_JG',
      'https://m.instagram.com/ritmo_jg/#',
      '@ritmo_jg',
      'ritmo_jg',
    ]) expect(parseInstagramHandle(s), s).toBe('ritmo_jg')
  })

  it('rejects things that are not a handle', () => {
    for (const s of ['', '   ', 'https://facebook.com/x', 'two words', '@', '.dot', 'dot.', 'a..b', 'x'.repeat(31)])
      expect(parseInstagramHandle(s), s).toBeNull()
  })
})

describe('handle and name suggestions', () => {
  it('turns an Instagram handle into a WeDance handle and a name to edit', () => {
    expect(handleFromInstagram('ritmo_jg')).toBe('ritmo-jg')
    expect(handleFromInstagram('migo.bachatero')).toBe('migo-bachatero')
    expect(nameFromInstagram('ritmo_jg')).toBe('Ritmo Jg')
    expect(nameFromInstagram('la.clave_munich')).toBe('La Clave Munich')
  })
})
