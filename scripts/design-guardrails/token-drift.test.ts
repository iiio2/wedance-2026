/**
 * Self-tests for the design-drift scanner (scan.ts). The drift itself is
 * REPORTED, never asserted — see report.ts: we ship continuously and keep a
 * record of drift per commit instead of blocking on it.
 */
import { describe, expect, it } from 'vitest'
import { findDynamicClasses, findQuotedFontLists } from './scan'

describe('design-guardrail scanner self-test', () => {
  it('detects a quoted comma list and accepts a correct stack', () => {
    expect(findQuotedFontLists(`:root{ --wd-font-hand: 'Caveat, cursive'; }`)).toHaveLength(1)
    expect(findQuotedFontLists(`.x{ font-family: "Anton, sans-serif"; }`)).toHaveLength(1)
    expect(findQuotedFontLists(`:root{ --wd-font-display: 'Playfair Display', serif; }`)).toHaveLength(0)
  })

  it('detects runtime-built class names and accepts full literals', () => {
    expect(findDynamicClasses('cls: `bg-wd-${kebab(key)}`')).toHaveLength(1)
    expect(findDynamicClasses(":class=\"'text-' + tone\"")).toHaveLength(1)
    expect(findDynamicClasses('`border-${c}-500`')).toHaveLength(1)
    expect(findDynamicClasses("{ red: 'bg-wd-red-600', cyan: 'bg-wd-cyan-600' }")).toHaveLength(0)
    expect(findDynamicClasses('`${base} bg-primary text-white`')).toHaveLength(0)
    expect(findDynamicClasses("background: `var(${c.token})`")).toHaveLength(0)
  })
})
