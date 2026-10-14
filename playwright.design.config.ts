import { defineConfig, devices } from '@playwright/test'

/**
 * Design-system guardrails (separate from the BDD suite in playwright.config.ts).
 *
 *   bun run test:design   contract + accessibility (CI-safe, no pixels)
 *   bun run test:visual   screenshot regression (local; baselines are per-OS)
 *
 * Point at a running server with DESIGN_BASE_URL (or BASE_URL); otherwise a dev
 * server is started on :3000. All specs are read-only — they never submit forms,
 * so they are safe against any database.
 */
const baseURL = process.env.DESIGN_BASE_URL || process.env.BASE_URL || 'http://localhost:3000'
const external = Boolean(process.env.DESIGN_BASE_URL || process.env.BASE_URL || process.env.CI)

export default defineConfig({
  testDir: './e2e/design',
  outputDir: './e2e/test-results/design',
  snapshotPathTemplate: '{testDir}/__screenshots__/{platform}/{arg}{ext}',
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/design' }]],
  timeout: 90_000,
  expect: {
    timeout: 15_000,
    toHaveScreenshot: { animations: 'disabled', caret: 'hide', scale: 'css', maxDiffPixelRatio: 0.01 },
  },
  fullyParallel: true,
  workers: process.env.CI ? 2 : 3,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL,
    reducedMotion: 'reduce',
    colorScheme: 'light',
    locale: 'en-US',
    timezoneId: 'Europe/Berlin',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 812 }, isMobile: false, hasTouch: false } },
  ],
  webServer: external
    ? undefined
    : { command: 'bun run dev', url: baseURL, reuseExistingServer: true, timeout: 180_000 },
})
