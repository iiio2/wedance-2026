import { describe, expect, it } from 'vitest'
import { cn } from './utils'

describe('cn', () => {
  it('treats text-eyebrow / text-meta / text-tag as font sizes, not colours', () => {
    expect(cn('text-sm', 'text-meta text-secondary')).toBe('text-meta text-secondary')
    expect(cn('text-sm', 'text-eyebrow')).toBe('text-eyebrow')
    expect(cn('text-xs text-foreground', 'text-tag')).toBe('text-foreground text-tag')
  })

  it('still merges colours', () => {
    expect(cn('text-sm text-foreground', 'text-wd-red-800')).toBe('text-sm text-wd-red-800')
  })
})
