/**
 * Runs `drizzle-kit push` in non-interactive mode for production deploys.
 *
 * Called by the Vercel build command (`package.json` → `vercel-build`) so the
 * database schema stays in sync with the code being deployed. Only runs when
 * DATABASE_URL is available — local builds and preview deploys without a
 * database connection skip silently.
 *
 * Why this exists: PR #340 added `email_verified_at` to the Drizzle schema
 * but nobody ran `db:push` against production, breaking every INSERT into the
 * `dancers` table (forgot-password, registration). This script prevents that
 * class of bug by making schema sync part of the deploy pipeline.
 */
import { execSync } from 'node:child_process'

if (!process.env.DATABASE_URL) {
  console.log('[db-push] DATABASE_URL not set — skipping schema sync')
  process.exit(0)
}

console.log('[db-push] Syncing Drizzle schema with production database…')
try {
  execSync('npx drizzle-kit push --force', {
    stdio: 'inherit',
    env: { ...process.env },
  })
  console.log('[db-push] Schema sync complete')
} catch (err) {
  // Log the error but don't fail the build — a schema push failure shouldn't
  // prevent deploying a fix. The app may partially work with the old schema.
  console.error('[db-push] Schema sync failed — deploy continues but some features may break:', err)
}
