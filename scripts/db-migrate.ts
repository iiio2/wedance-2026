#!/usr/bin/env bun
/**
 * Deploy-time schema migrations — applies the numbered SQL files in
 * server/database/migrations/ (not _archive/) that production hasn't run yet.
 *
 * Why this exists: the Vercel project builds with `nuxt build` (its build
 * command overrides package.json's `vercel-build`), so scripts/db-push-production.ts
 * never ran and production silently fell behind the code — e.g. 0046/0047 were
 * merged but missing, and /my-plan's hangouts 500'd (2026-10-17). And
 * `drizzle-kit push --force` is the wrong tool for an unattended deploy: it
 * auto-approves data-loss statements and can't answer rename prompts without a TTY.
 *
 * How it works:
 *   - Applied files are recorded in `_schema_migrations (name, applied_at)`.
 *   - On the first run (empty table) the files in BASELINE — verified present in
 *     production on 2026-10-18 — are recorded WITHOUT running them.
 *   - Every other file runs once, in name order, each in its own transaction
 *     (files may also carry their own BEGIN/COMMIT). A failing file stops the
 *     run with a non-zero exit, so the deploy fails and the previous version
 *     keeps serving — never new code on an old schema.
 *   - Migration files must be idempotent (IF NOT EXISTS / guarded DO blocks).
 *
 * Runs only for Vercel PRODUCTION builds (vercel.json passes --deploy, and
 * VERCEL_ENV must be production), because preview deployments share the
 * production DATABASE_URL — a branch's migration must never reach production
 * before it's merged.
 *
 *   bun scripts/db-migrate.ts --deploy                 # the Vercel build command (production only)
 *   bun scripts/db-migrate.ts --force-env --dry-run    # list what would run against DATABASE_URL
 *   bun scripts/db-migrate.ts --force-env              # apply against DATABASE_URL (check it first!)
 *
 * Rollback: each file documents its own rollback; then
 *   DELETE FROM _schema_migrations WHERE name = '<file>';
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const args = new Set(process.argv.slice(2))
const DRY = args.has('--dry-run')

/** Files already present in production when this runner was introduced (checked 2026-10-18). */
export const BASELINE = [
  '0000_baseline.sql',
  '0042_claim_verification.sql',
  '0044_attendances_and_goals.sql',
  // Partly applied (handles, roles, affiliations); its follows step failed and
  // is superseded by 0048_follows_reconcile.sql.
  '0044_identity_ownership_phase2.sql',
  '0045_hangout_event_link_and_coffee.sql',
  '0045_profile_sites_contacts.sql',
  '0046_discover_swipes.sql',
  '0047_hangout_place.sql',
]

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) { console.log('[db-migrate] DATABASE_URL not set — skipping'); process.exit(0) }
// `--deploy` comes only from the Vercel build command (vercel.json). VERCEL_ENV
// alone isn't enough: a `vercel env pull`ed .env carries VERCEL_ENV=production
// and the production DATABASE_URL, and bun loads .env automatically.
const deployRun = args.has('--deploy') && process.env.VERCEL_ENV === 'production'
if (!deployRun && !args.has('--force-env')) {
  console.log(`[db-migrate] not a production deploy build (--deploy + VERCEL_ENV=production) — skipping`)
  process.exit(0)
}

const dir = fileURLToPath(new URL('../server/database/migrations/', import.meta.url))
const files = readdirSync(dir).filter(f => /^\d{4}_.+\.sql$/.test(f)).sort()

const client = new pg.Client({ connectionString: dbUrl })
await client.connect()
try {
  if (!DRY) await client.query('CREATE TABLE IF NOT EXISTS "_schema_migrations" ("name" text PRIMARY KEY, "applied_at" timestamp NOT NULL DEFAULT now(), "baseline" boolean NOT NULL DEFAULT false)')
  const exists = (await client.query(`SELECT to_regclass('public._schema_migrations') AS t`)).rows[0]?.t
  const { rows } = exists ? await client.query('SELECT name FROM "_schema_migrations"') : { rows: [] as { name: string }[] }
  const applied = new Set<string>(rows.map(r => r.name))

  if (applied.size === 0) {
    const base = BASELINE.filter(f => files.includes(f))
    console.log(`[db-migrate] first run — recording ${base.length} baseline files as applied: ${base.join(', ')}`)
    if (!DRY) for (const f of base) await client.query('INSERT INTO "_schema_migrations" (name, baseline) VALUES ($1, true) ON CONFLICT DO NOTHING', [f])
    base.forEach(f => applied.add(f))
  }

  const pending = files.filter(f => !applied.has(f))
  if (!pending.length) { console.log('[db-migrate] schema up to date'); process.exit(0) }
  console.log(`[db-migrate] ${DRY ? 'would apply' : 'applying'} ${pending.length}: ${pending.join(', ')}`)
  if (DRY) process.exit(0)

  for (const f of pending) {
    const sqlText = readFileSync(join(dir, f), 'utf8')
    const ownTx = /^\s*BEGIN\s*;/im.test(sqlText)
    try {
      if (!ownTx) await client.query('BEGIN')
      await client.query(sqlText)
      if (!ownTx) await client.query('COMMIT')
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {})
      console.error(`[db-migrate] ${f} FAILED — deploy stopped, nothing from this file was kept:`, (err as Error).message)
      process.exit(1)
    }
    await client.query('INSERT INTO "_schema_migrations" (name) VALUES ($1)', [f])
    console.log(`[db-migrate] applied ${f}`)
  }
} finally {
  await client.end().catch(() => {})
}
