---
status: open
created: 2026-10-10 16:20
---

# Prod DB is missing `community_groups.report_count`

## Tension

`/admin/community-groups` fails with `Failed query: select "id", ..., "report_count", ... from "community_groups"`.
Migration `0018_catch_up_and_report_dedupe.sql` (PR #202, merged 2026-10-09) adds the column,
but production Neon never got it. Every other part of 0018 exists in prod; only this
`ALTER TABLE` is missing (checked read-only via `information_schema` on 2026-10-10).
`drizzle.__drizzle_migrations` has 0 rows in prod, so the migrations are not tracked there.

Broken on prod because of it:

- `communityGroup.listAll` (admin list, `select *`)
- `communityGroup.create` (admin create: drizzle inserts `default` for every column, including `report_count`)
- `communityGroup.report` (user "report this group": increments `report_count`)

Still working: the public per-city list, which selects only explicit columns.

## Driver

Admins need to manage the WhatsApp/Telegram groups shown on city pages, and dancers need
to be able to flag dead or spam links.

## Requirement

- Run on prod: `ALTER TABLE "community_groups" ADD COLUMN IF NOT EXISTS "report_count" integer DEFAULT 0;`
  (additive, nullable, default 0, so no data loss).
- Root cause (found 2026-10-10): `0018_catch_up_and_report_dedupe` was never registered in
  `migrations/meta/_journal.json`, so `drizzle-kit migrate` skips it. Main has since moved to
  hand-applied SQL files (0019–0025, journal still ends at 0017), so this one `ALTER TABLE`
  was simply never run on prod.
- Follow-up: decide how prod migrations get tracked (`drizzle.__drizzle_migrations` is empty
  in prod) so a hand-applied file can't be skipped again.

Local dev DB (Docker `wedance-dev-db`) was patched with the same statement on 2026-10-10.
