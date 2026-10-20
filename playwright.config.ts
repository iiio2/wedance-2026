import { defineConfig, devices } from '@playwright/test'
import { defineBddConfig } from 'playwright-bdd'

const testDir = defineBddConfig({
  featuresRoot: './e2e/features',
  paths: ['./e2e/features/**/*.feature'],
  require: ['./e2e/steps/**/*.ts'],
  tags: 'not @wip',
})

export default defineConfig({
  testDir,
  outputDir: './e2e/test-results',
  // CI also writes JSON for the Grafana Loki push (scripts/ci/loki-test-results.ts).
  reporter: process.env.CI
    ? [['html'], ['json', { outputFile: 'test-results/playwright-smoke.json' }]]
    : 'html',
  /* Give CI builds extra time — nuxt preview cold-starts can be slow. */
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: process.env.CI
    ? undefined // CI starts the server in a prior workflow step
    : {
        command: 'bun run dev',
        url: process.env.BASE_URL || 'http://localhost:3000',
        reuseExistingServer: true,
        timeout: 120_000,
      },
})
