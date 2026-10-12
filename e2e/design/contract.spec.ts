/**
 * Component contract for the shared ui components, checked in a real browser.
 *
 * Catches the bugs that shipped before:
 *   - <Button> rendering as a <div> (no keyboard, no `disabled`) for 10 days
 *   - destructive variant: red text on a red background
 *
 * Elements are found by the class signature that buttonVariants / badgeVariants
 * emit, so every <Button>/<Badge> on the page is covered, whatever its props.
 */
import { expect, test } from '@playwright/test'
import { gotoStable } from './helpers'
import { COMPONENT_SHOWCASE_ROUTES, PRODUCT_ROUTES } from './pages'

// :not(input…) — form controls share the focus-ring classes but aren't Buttons.
const BUTTON_SEL = '[class*="disabled:cursor-not-allowed"][class*="focus-visible:ring-ring"][class*="ring-offset-background"]:not(input, select, textarea)'
const BADGE_SEL = '[class*="focus:ring-ring"][class*="rounded-full"][class*="px-2.5"][class*="py-0.5"]'
const MIN_CONTRAST = 4.5

/**
 * Known contrast debt (found by this guardrail on 2026-10-10), as
 * "fg on bg" → lowest ratio tolerated. A pair listed here may not get WORSE;
 * any other pair must meet 4.5:1. Delete an entry once the token is fixed.
 *   - red-600 text on cream  (Button destructive + link variants): 4.45
 *   - red-600 text on destructive/10 tint (Badge destructive):      3.82
 */
const CONTRAST_DEBT: Record<string, number> = {
  'rgb(220, 38, 38) on rgb(251,245,234)': 4.45,
  'rgb(220, 38, 38) on rgb(247,224,214)': 3.82,
}

interface Probe {
  kind: 'button' | 'badge'
  tag: string
  label: string
  classes: string
  href: string | null
  disabled: boolean
  ariaDisabled: boolean
  busy: boolean
  cursor: string
  tabIndex: number
  contrast: number | null
  fg: string
  bg: string
}

/** Runs in the page: computes the contract facts for every Button/Badge. */
function probe(args: { buttonSel: string, badgeSel: string }): Probe[] {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!

  // Any CSS colour (hex, rgb, oklch, color-mix, color(srgb …)) → [r,g,b,a 0..1]
  function rgba(css: string): [number, number, number, number] {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000'
    ctx.fillStyle = css
    ctx.fillRect(0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return [d[0]!, d[1]!, d[2]!, d[3]! / 255]
  }
  const over = (top: number[], under: number[]) => {
    const a = top[3]!
    return [0, 1, 2].map(i => top[i]! * a + under[i]! * (1 - a)).concat(1)
  }
  const lum = (c: number[]) => {
    const ch = (v: number) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
    return 0.2126 * ch(c[0]!) + 0.7152 * ch(c[1]!) + 0.0722 * ch(c[2]!)
  }
  const ratio = (a: number[], b: number[]) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
    return (hi! + 0.05) / (lo! + 0.05)
  }

  /** Effective opaque background behind el, or null if a gradient/image is in the way. */
  function backdrop(el: Element): number[] | null {
    const layers: number[][] = []
    for (let n: Element | null = el; n; n = n.parentElement) {
      const cs = getComputedStyle(n)
      if (cs.backgroundImage && cs.backgroundImage !== 'none') return null
      const c = rgba(cs.backgroundColor)
      if (c[3] > 0) layers.push(c)
      if (c[3] >= 1) break
    }
    return layers.reverse().reduce((under, top) => over(top, under), [255, 255, 255, 1])
  }

  const out: Probe[] = []
  const seen = new Set<Element>()
  for (const [kind, sel] of [['button', args.buttonSel], ['badge', args.badgeSel]] as const) {
    for (const el of document.querySelectorAll<HTMLElement>(sel)) {
      if (seen.has(el)) continue
      seen.add(el)
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      if (r.width === 0 || r.height === 0 || cs.visibility === 'hidden') continue
      const disabled = (el as HTMLButtonElement).disabled === true
      const bg = backdrop(el)
      const fg = rgba(cs.color)
      const contrast = bg && !disabled && Number(cs.opacity) === 1 ? ratio(over(fg, bg), bg) : null
      out.push({
        kind,
        tag: el.tagName.toLowerCase(),
        label: (el.innerText || el.getAttribute('aria-label') || '').trim().slice(0, 40),
        classes: el.className.toString().slice(0, 160),
        href: el.getAttribute('href'),
        disabled,
        ariaDisabled: el.getAttribute('aria-disabled') === 'true',
        busy: el.getAttribute('aria-busy') === 'true',
        cursor: cs.cursor,
        tabIndex: el.tabIndex,
        contrast: contrast === null ? null : Math.round(contrast * 100) / 100,
        fg: cs.color,
        bg: bg ? `rgb(${bg.slice(0, 3).map(Math.round).join(',')})` : 'gradient/image',
      })
    }
  }
  return out
}

async function probePage(page: import('@playwright/test').Page, path: string) {
  await gotoStable(page, path)
  return page.evaluate(probe, { buttonSel: BUTTON_SEL, badgeSel: BADGE_SEL })
}

const describeProbe = (p: Probe) => `<${p.tag}> "${p.label}" fg=${p.fg} bg=${p.bg} contrast=${p.contrast}\n    class="${p.classes}"`

test.describe('component contract', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 1000, 'contract is viewport-independent; desktop only')

  for (const path of COMPONENT_SHOWCASE_ROUTES) {
    test(`Button & Badge contract on ${path}`, async ({ page }) => {
      const probes = await probePage(page, path)
      const buttons = probes.filter(p => p.kind === 'button')

      // Real interactive elements — never a <div>/<span> with button styling.
      const notInteractive = buttons.filter(p => !(p.tag === 'button' || (p.tag === 'a' && p.href)))
      expect(notInteractive.map(describeProbe), 'Button must render a <button> or an <a href> (keyboard, focus, disabled all depend on it)').toEqual([])

      const unfocusable = buttons.filter(p => !p.disabled && p.tabIndex < 0)
      expect(unfocusable.map(describeProbe), 'Enabled Button must be keyboard-focusable').toEqual([])

      // Disabled looks AND behaves disabled.
      const fakeDisabled = buttons.filter(p => p.ariaDisabled && !p.disabled && p.tag === 'button')
      expect(fakeDisabled.map(describeProbe), 'Disabled <button> needs the `disabled` attribute, not just aria-disabled').toEqual([])
      // A loading Button (aria-busy) is disabled but shows the progress cursor on purpose.
      const badCursor = buttons.filter(p => p.disabled && p.cursor !== (p.busy ? 'progress' : 'not-allowed'))
      expect(badCursor.map(describeProbe), 'Disabled Button must show cursor: not-allowed').toEqual([])
      const noPointer = buttons.filter(p => !p.disabled && p.cursor !== 'pointer')
      expect(noPointer.map(describeProbe), 'Enabled Button must show cursor: pointer').toEqual([])

      // Text vs background contrast, every variant as rendered.
      const lowContrast = probes.filter(p => p.contrast !== null && p.contrast < (CONTRAST_DEBT[`${p.fg} on ${p.bg}`] ?? MIN_CONTRAST))
      expect(lowContrast.map(describeProbe), `Button/Badge text contrast must be ≥ ${MIN_CONTRAST}:1 (WCAG AA)`).toEqual([])
    })
  }

  test('the showcase actually renders components (guards against an empty selector)', async ({ page }) => {
    const probes = await probePage(page, '/docs/design/components/button')
    expect(probes.filter(p => p.kind === 'button').length).toBeGreaterThan(5)
    const badges = await probePage(page, '/docs/design/components/badge')
    expect(badges.filter(p => p.kind === 'badge').length).toBeGreaterThan(2)
    expect(probes.some(p => p.disabled), 'the Button docs show a disabled Button').toBe(true)
  })

  for (const route of PRODUCT_ROUTES) {
    test(`Buttons are real buttons on ${route.path}`, async ({ page }) => {
      const probes = await probePage(page, route.path)
      const bad = probes.filter(p => p.kind === 'button' && !(p.tag === 'button' || (p.tag === 'a' && p.href)))
      expect(bad.map(describeProbe)).toEqual([])
    })
  }
})
