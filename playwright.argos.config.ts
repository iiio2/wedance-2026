import { defineConfig, devices } from '@playwright/test'

/**
 * Visual review in Argos (https://app.argos-ci.com) — see docs/visual-review.md.
 *
 * CI runs this against every Vercel deploy (.github/workflows/visual-review.yml):
 * production deploys build the baseline, PR preview deploys are compared to it
 * and Argos posts a "changes need review" check on the PR.
 *
 *   ARGOS_BASE_URL=https://… bunx playwright test -c playwright.argos.config.ts
 *
 * Preview deploys sit behind Vercel SSO; VERCEL_AUTOMATION_BYPASS_SECRET lets
 * the browser through. Read-only: nothing is clicked or submitted.
 */
const baseURL = process.env.ARGOS_BASE_URL || 'https://2026.wedance.vip'
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

export default defineConfig({
  testDir: './e2e/argos',
  outputDir: './e2e/test-results/argos',
  timeout: 120_000,
  fullyParallel: true,
  workers: process.env.CI ? 3 : 2,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['@argos-ci/playwright/reporter', { uploadToArgos: !!process.env.ARGOS_TOKEN }]]
    : 'list',
  use: {
    baseURL,
    reducedMotion: 'reduce',
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'Europe/Berlin',
    extraHTTPHeaders: bypass ? { 'x-vercel-protection-bypass': bypass, 'x-vercel-set-bypass-cookie': 'true' } : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 } },
  ],
})
