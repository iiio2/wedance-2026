/**
 * One full-page Argos screenshot per route × viewport. Routes come from the
 * shared route list (scripts/release-snapshots/routes.ts).
 * Volatile bits (relative dates, live counts) are hidden via [data-visual-mask]
 * so day-to-day data doesn't show up as a design change.
 */
import { argosScreenshot } from '@argos-ci/playwright'
import { expect, test } from '@playwright/test'
import { STABILIZE_CSS } from '../design/helpers'
import { SNAPSHOT_ROUTES } from '../../scripts/release-snapshots/routes'

const MASK_CSS = `${STABILIZE_CSS}
  [data-visual-mask], time { visibility: hidden !important; }
`

let festivalPath: string | null = null

test.beforeAll(async ({ request }) => {
  const res = await request.get('/api/festivals')
  if (res.ok()) {
    const list = await res.json() as { href: string }[]
    festivalPath = list[0]?.href ?? null
  }
})

for (const route of SNAPSHOT_ROUTES) {
  test(route.name, async ({ page }, info) => {
    const path = route.path === 'festival' ? festivalPath : route.path
    test.skip(!path, 'no festival to capture')
    const res = await page.goto(path!, { waitUntil: 'load' })
    expect(res?.status(), `${path} should load`).toBeLessThan(400)
    // Scroll once so lazy images and in-view sections render before the shot.
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 700) {
        window.scrollTo(0, y)
        await new Promise(r => setTimeout(r, 120))
      }
      window.scrollTo(0, 0)
    })
    await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
    await argosScreenshot(page, `${route.name}-${info.project.name}`, { fullPage: true, argosCSS: MASK_CSS })
  })
}
