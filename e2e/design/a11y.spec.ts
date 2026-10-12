/**
 * Accessibility guardrail for /docs/design pages and key product routes.
 *
 * Two layers:
 *   1. Built-in checks (always run, no dependency): <html lang>, a <main>
 *      landmark, one <h1>, images have alt, buttons/links/inputs have an
 *      accessible name.
 *   2. axe-core WCAG 2.1 A/AA scan — only when @axe-core/playwright is
 *      installed; otherwise the test is skipped with a note.
 *
 * Known violations are frozen in a11y-baseline.json (ratchet):
 *   - /docs/design pages are static → per-rule COUNTS; a count may only go down.
 *   - product routes read the database, so node counts move with content →
 *     per-rule "*": an already-known rule is tolerated, any NEW rule fails.
 * Fix a violation → delete or lower its entry. Never raise one silently.
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { gotoStable } from './helpers'
import { DESIGN_ROUTES, PRODUCT_ROUTES } from './pages'

/** key "<layer> <project> <route>" → rule → max count, or "*" = rule tolerated at any count. */
type Baseline = Record<string, Record<string, number | '*'>>
const BASELINE: Baseline = JSON.parse(readFileSync(new URL('./a11y-baseline.json', import.meta.url), 'utf8'))

function loadAxe(): (new (opts: { page: import('@playwright/test').Page }) => any) | null {
  const require = createRequire(import.meta.url)
  // AXE_PLAYWRIGHT_PATH lets you point at an install outside node_modules.
  const paths = [process.cwd(), process.env.AXE_PLAYWRIGHT_PATH].filter(Boolean) as string[]
  try { return require(require.resolve('@axe-core/playwright', { paths })).default }
  catch { return null }
}
const AxeBuilder = loadAxe()

interface Finding { rule: string, target: string }

/** In-page lightweight audit. */
function audit(): Finding[] {
  const out: Finding[] = []
  const desc = (el: Element) => {
    const id = el.id ? `#${el.id}` : ''
    const cls = el.getAttribute('class')?.split(/\s+/).slice(0, 3).join('.') ?? ''
    const txt = (el as HTMLElement).innerText?.trim().slice(0, 30) ?? ''
    return `${el.tagName.toLowerCase()}${id}${cls ? `.${cls}` : ''}${txt ? ` "${txt}"` : ''}`
  }
  const visible = (el: Element) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
  }
  const name = (el: Element): string => {
    const aria = el.getAttribute('aria-label')?.trim()
    if (aria) return aria
    const lb = el.getAttribute('aria-labelledby')
    if (lb) return lb.split(/\s+/).map(id => document.getElementById(id)?.textContent ?? '').join(' ').trim()
    if ((el as HTMLInputElement).labels?.length) return [...(el as HTMLInputElement).labels!].map(l => l.textContent).join(' ').trim()
    const text = (el as HTMLElement).innerText?.trim() || el.textContent?.trim()
    if (text) return text
    const alt = [...el.querySelectorAll('img[alt], svg title, [aria-label]')]
      .map(n => n.getAttribute('alt') ?? n.getAttribute('aria-label') ?? n.textContent).join(' ').trim()
    if (alt) return alt
    return el.getAttribute('title')?.trim() ?? ''
  }

  if (!document.documentElement.getAttribute('lang')) out.push({ rule: 'html-lang', target: 'html' })
  if (!document.querySelector('main, [role="main"]')) out.push({ rule: 'landmark-main', target: 'body' })
  const h1s = [...document.querySelectorAll('h1')].filter(visible)
  if (h1s.length !== 1) out.push({ rule: 'single-h1', target: `${h1s.length} visible <h1>` })

  for (const img of document.querySelectorAll('img'))
    if (!img.hasAttribute('alt') && img.getAttribute('role') !== 'presentation' && img.getAttribute('aria-hidden') !== 'true')
      out.push({ rule: 'image-alt', target: desc(img) })

  for (const el of document.querySelectorAll('button, a[href], [role="button"]'))
    if (visible(el) && !el.closest('[aria-hidden="true"]') && !name(el)) out.push({ rule: 'control-name', target: desc(el) })

  for (const el of document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea'))
    if (visible(el) && !name(el)) out.push({ rule: 'input-label', target: desc(el) })

  return out
}

function countByRule(findings: Finding[]) {
  return findings.reduce<Record<string, number>>((m, f) => ((m[f.rule] = (m[f.rule] ?? 0) + 1), m), {})
}

const BASELINE_URL = new URL('./a11y-baseline.json', import.meta.url)

/**
 * A11Y_UPDATE_BASELINE=1 rewrites the entry for this page with today's counts
 * (product routes as "*"). Run with --workers=1 so writes don't race. Use it to
 * register a NEW page or to lower counts after fixes — never to hide a regression.
 */
function writeBaseline(key: string, counts: Record<string, number>) {
  const current: Baseline = JSON.parse(readFileSync(BASELINE_URL, 'utf8'))
  const isProduct = PRODUCT_ROUTES.some(r => key.endsWith(` ${r.path}`))
  const entry = Object.fromEntries(Object.entries(counts).sort().map(([rule, n]) => [rule, isProduct ? '*' : n]))
  if (Object.keys(entry).length) current[key] = entry
  else delete current[key]
  const sorted = Object.fromEntries(Object.entries(current).sort(([a], [b]) => a.localeCompare(b)))
  writeFileSync(BASELINE_URL, JSON.stringify(sorted, null, 2) + '\n')
}

function assertWithinBaseline(key: string, findings: Finding[], details: string) {
  const counts = countByRule(findings)
  if (process.env.A11Y_UPDATE_BASELINE) return writeBaseline(key, counts)
  const allowed = BASELINE[key] ?? {}
  const over = Object.entries(counts).filter(([rule, n]) => allowed[rule] !== '*' && n > (allowed[rule] ?? 0))
  const msg = over.map(([rule, n]) => `${rule}: ${n} (baseline ${allowed[rule] ?? 0})`).join(', ')
  expect(over, `New accessibility violations on ${key} — ${msg}\n${details}\nFix them; if a count went down, lower it in e2e/design/a11y-baseline.json.`).toEqual([])
}

const ROUTES = [...DESIGN_ROUTES, ...PRODUCT_ROUTES]

test.describe('accessibility', () => {
  for (const route of ROUTES) {
    test(`built-in checks: ${route.path}`, async ({ page }, info) => {
      await gotoStable(page, route.path)
      const findings = await page.evaluate(audit)
      const details = findings.map(f => `  [${f.rule}] ${f.target}`).join('\n')
      assertWithinBaseline(`basic ${info.project.name} ${route.path}`, findings, details)
    })

    test(`axe WCAG A/AA: ${route.path}`, async ({ page }, info) => {
      test.skip(!AxeBuilder, '@axe-core/playwright not installed — run `bun install` (it is in devDependencies)')
      await gotoStable(page, route.path)
      const results = await new AxeBuilder!({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .exclude('nuxt-devtools-frame')
        .analyze()
      const findings: Finding[] = results.violations.flatMap((v: any) =>
        v.nodes.map((n: any) => ({ rule: v.id, target: String(n.target) })))
      const details = results.violations
        .map((v: any) => `  [${v.id}] ${v.impact}: ${v.help} (${v.nodes.length})\n${v.nodes.slice(0, 5).map((n: any) => `      ${n.target}`).join('\n')}`)
        .join('\n')
      assertWithinBaseline(`axe ${info.project.name} ${route.path}`, findings, details)
    })
  }
})
