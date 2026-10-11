import { neonConfig } from '@neondatabase/serverless'

// Safety: vitest loads .env, and a dev .env points at the PRODUCTION database.
// The DB tests update and delete rows, so they may only ever run against a local
// Postgres (CI and local Docker use localhost). Any other DATABASE_URL is dropped
// here, before test files read it, and every DB suite skips. Override only with
// ALLOW_REMOTE_TEST_DB=1 against a disposable database — never production.
const dbUrl = process.env.DATABASE_URL
if (dbUrl && process.env.ALLOW_REMOTE_TEST_DB !== '1') {
  let host = ''
  try { host = new URL(dbUrl).hostname }
  catch { /* unparsable → treated as remote */ }
  if (!['localhost', '127.0.0.1', '::1'].includes(host)) {
    delete process.env.DATABASE_URL
    console.warn(`[test-setup] DATABASE_URL points at ${host || 'a remote host'} — DB tests skipped (they write data). Use a local Postgres; see .github/workflows/test.yml.`)
  }
}

// Route the Neon HTTP driver to the local proxy when running integration tests
// against a real Postgres (CI or local Docker). No-op when the env var is unset.
if (process.env.NEON_FETCH_ENDPOINT) {
  neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT
}
