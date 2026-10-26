import { test as base, createBdd } from 'playwright-bdd'

/**
 * Shared test fixtures for smoke E2E tests.
 *
 * - `testEmail`: a unique @test.wedance.vip email generated per test run
 * - `resetUserEmail` / `resetUserPassword`: credentials for the pre-seeded
 *    password-reset test user (set up via the "a test user exists" step)
 * - `c3`: per-scenario scratch for the C3 steps (e2e/steps/c3.ts) — a run id,
 *    the fixture ids it seeded and the cleanups that remove them afterwards
 * - `timezoneId`: a scenario tagged `@tz:<Area/City>` runs the browser in that
 *    zone (e.g. `@tz:America/New_York`), to prove times render in the event's zone
 */
export type C3World = {
  run: string
  ids: Record<string, string>
  data: Record<string, any>
  cleanup: (() => Promise<void>)[]
}

export const test = base.extend<{
  testEmail: string
  resetUserEmail: string
  resetUserPassword: string
  c3: C3World
}>({
  testEmail: [
    async ({}, use) => {
      const ts = Date.now()
      const rand = Math.random().toString(36).slice(2, 6)
      await use(`smoke-${ts}-${rand}@test.wedance.vip`)
    },
    { scope: 'test' },
  ],
  resetUserEmail: ['', { option: true }],
  resetUserPassword: ['', { option: true }],
  c3: [
    async ({}, use) => {
      const world: C3World = { run: Math.random().toString(36).slice(2, 8), ids: {}, data: {}, cleanup: [] }
      await use(world)
      // Run every cleanup even if one fails, then report the failures.
      const errors: unknown[] = []
      for (const fn of world.cleanup.reverse()) {
        try { await fn() } catch (e) { errors.push(e) }
      }
      if (errors.length) throw new AggregateError(errors, `${errors.length} C3 cleanup(s) failed`)
    },
    { scope: 'test' },
  ],
  timezoneId: async ({ $tags }, use) => {
    const tag = $tags.find(t => t.startsWith('@tz:'))
    await use(tag ? tag.slice(4) : undefined)
  },
})

export const { Given, When, Then } = createBdd(test)
