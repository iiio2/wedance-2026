---
title: Schema changes go through journaled, expand/contract migrations
status: accepted
date: 2026-10-12
accepted: 2026-10-15
---

## Context

The schema in `server/database/schema.ts` and the production database have
drifted apart, and three different mechanisms change production:

- **The drizzle journal stops at 0017.** `server/database/migrations/meta/_journal.json`
  has 18 entries (`0000`–`0017`). `0018_catch_up_and_report_dedupe.sql` and its
  snapshot exist but are not journaled; there is no `0019`; there are two `0020`
  files (`0020_early_bird_columns.sql`, `0020_opt_in_attendees.sql`); `0021`–`0024`
  are hand-written, idempotent SQL applied by hand (`0023_profile_languages.sql:1-3`
  says so explicitly).
- **`0018` cannot be applied to production.** It runs `CREATE TABLE "events"`
  (`0018_catch_up_and_report_dedupe.sql:31`) without `IF NOT EXISTS`, but `events`
  was created out of band by `scripts/migrate/00-schema.mjs:8` on 2026-07-15.
- **Out-of-band DDL lives in scripts.** `scripts/migrate/00-schema.mjs` adds
  `dancers.source_ref` (line 5) and a `follows` table (line 32) that are **not in
  `schema.ts`**. `scripts/sync-v3-events.ts:65` applies migration files at runtime.
- **That coupling just broke production.** PR #202 (commit `4728250`) deleted
  `0021_events_v3_sync.sql` and `0022_v3_profile_sync.sql` while folding them into
  `0018`. `sync-v3-events.ts:65` still reads them, so the daily wedance.vip sync has
  failed with `ENOENT` on 2026-10-10, 10-11 and 10-12 (`~/.config/wedance/v3-sync.log`):
  no new or updated v3 events for three days (stories RAZ-251, RAZ-162, RAZ-28).
- **The app tolerates missing columns at runtime.** `server/trpc/routers/events.ts:36-54`
  catches Postgres `42703` ("column does not exist") and retries without `artists`;
  `plan.ts:51-52` avoids selecting `metadata` "so the query works even if migration
  0023 hasn't been applied yet". Code that has to guess the schema is a symptom.
- **`schema.ts` declares a table production does not have.** `cities` (`schema.ts:739`)
  is not in production yet (`docs/research/2026-10-12-city-canonicalisation.md:18`).
- **`db:push` is a loaded gun.** `package.json:20` maps `db:push` to `drizzle-kit push`.
  Pushed at production, it diffs against `schema.ts` and proposes dropping
  `follows` (667 migrated edges, `CLAUDE.md` "Data") and `dancers.source_ref` (the
  rollback key for 3,910 migrated users).
- **Previews write to production.** `CLAUDE.md:131-134`: Vercel preview deployments
  share the production `DATABASE_URL`. Every PR's unreviewed code can write to
  production rows, including real dancers and Stripe test payments.

## Options

1. **Keep hand-applied SQL** and document the order. Cheapest today; it is what
   produced every problem above.
2. **`drizzle-kit push` everywhere.** Fast for prototypes; no review artefact, no
   rollback, destructive diffs on drift (see above). Not acceptable with live data.
3. **Journaled `drizzle-kit generate` + `drizzle-kit migrate`**, one baseline,
   expand/contract for every breaking change, and a separate Neon branch per
   preview.

## Decision

Option 3.

- **Baseline once (migration step 0).** Introspect production
  (`drizzle-kit introspect` against a Neon branch of prod), reconcile `schema.ts`
  with it (add `dancers.source_ref` and the legacy `follows` table to `schema.ts`
  so nothing proposes dropping them; keep `cities` as the first real migration),
  then replace the folder with a single journaled `0000_baseline.sql` and mark it
  applied in production's `drizzle.__drizzle_migrations` without executing it. The
  old files move to `server/database/migrations/_archive/` for history.
- **One path to production:** `drizzle-kit generate` → review the SQL in the PR →
  `drizzle-kit migrate` from CI on merge, before the deploy is promoted. `db:push`
  is removed from `package.json`; local work uses a throwaway Docker database.
- **Runtime code never runs DDL.** `scripts/sync-v3-events.ts` checks that the
  schema it needs exists and exits with a clear error otherwise; it does not apply
  migration files. The `42703` fallbacks in `events.ts` and the `metadata` caveat in
  `plan.ts` are removed once the baseline is in.
- **Expand → backfill → switch reads → contract.** Every change that removes,
  renames or tightens something ships as at least two migrations in two deploys:
  additive first (new columns/tables nullable or defaulted, dual-write in code),
  a re-runnable backfill (batched, `WHERE new_col IS NULL`), a deploy that reads
  the new shape, and only then a contract migration that drops the old shape. A
  contract step needs the Commander's explicit approval and a Neon PITR restore
  point taken immediately before it.
- **Constraints land `NOT VALID` first.** New foreign keys and check constraints are
  added `NOT VALID` (no table scan, no long lock) and `VALIDATE`d in a later
  migration after the backfill; new indexes on large tables use
  `CREATE INDEX CONCURRENTLY` (drizzle-kit emits plain `CREATE INDEX`, so those
  statements are hand-edited and the migration is marked non-transactional).
- **Previews get their own database.** Each Vercel preview uses a Neon branch
  created from production (Neon's Vercel integration does this per deploy), so a
  PR can read realistic data and write without touching production.

```mermaid
flowchart LR
  A[Edit schema.ts] --> B[drizzle-kit generate]
  B --> C[PR: review SQL + code]
  C --> D[Preview on a Neon branch]
  D --> E[Merge]
  E --> F[CI: drizzle-kit migrate on prod]
  F --> G[Promote deploy]
```

## Consequences

- Schema drift becomes visible in review instead of in production.
- Breaking changes cost two deploys. That is the price of a live database.
- The sync script stops being a migration runner; the v3 sync outage cannot recur
  this way.
- Neon branches per preview cost storage; branches are deleted when the PR closes.

## Stories unblocked

None directly — every other migration step depends on this one. It restores
RAZ-251, RAZ-253 and RAZ-162 (the v3 sync) once the sync no longer reads deleted
migration files.
