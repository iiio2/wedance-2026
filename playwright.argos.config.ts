import { defineConfig, devices } from '@playwright/test'

/**
 * Visual history in Argos (docs/visual-history.md) — a record, never a gate.
 * CI runs this after every production deploy (.github/workflows/visual-history.yml)
 * and uploads full-page screenshots of the live site as an Argos build on main.
 *
 *   ARGOS_BASE_URL=https://2026.wedance.vip bun run test:argos
 *
 * Read-only: nothing is clicked or submitted.
 */
// Argos-recommended: consistent font rendering between runs.
const STABLE_FONTS = ['--disable-lcd-text', '--font-render-hinting=none']

const baseURL = process.env.ARGOS_BASE_URL || 'https://2026.wedance.vip'

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
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 }, launchOptions: { args: STABLE_FONTS } } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, launchOptions: { args: STABLE_FONTS } } },
  ],
})
