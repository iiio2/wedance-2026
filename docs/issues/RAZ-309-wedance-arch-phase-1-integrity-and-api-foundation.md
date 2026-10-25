---
title: "WeDance arch Phase 1: Integrity and API foundation"
type: Task
id: RAZ-309
status: triage
state: Triage
state_type: triage
project: "WeDance CUJ"
labels: []
assignee: null
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: "RAZ-305"
created: 2026-10-12T12:47:30.691Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-309/wedance-arch-phase-1-integrity-and-api-foundation
exported: 2026-10-25
---

# RAZ-309 — WeDance arch Phase 1: Integrity and API foundation

Part of RAZ-305 · migration plan: [https://2026.wedance.vip/docs/architecture/decisions/migration-plan](<https://2026.wedance.vip/docs/architecture/decisions/migration-plan>)

**Status: proposed.** Nothing here starts until the Commander moves it to Todo (`ok RAZ-n`). When approved, each step below becomes its own ticket.

## Steps

* Step 7 · Transactions and atomic counters — M
* Step 8 · Column conventions sweep — L
* Step 9 · Election references — S
* Step 10 · API foundation — M
* Step 11 · Canonical cities — L

## Detail (from docs/architecture/target/migration-plan.md)

### Step 7 · Transactions and atomic counters — M

* **Scope:** ADR-002. Add `withTx` (Neon serverless Pool); use it for
  `booking.setAvailability` (broken today), election close, dinner grouping,
  festival free-spot and dinner joins (capacity under lock), video ELO votes;
  derive `hangouts.people_count`, `city_videos.vote_count`,
  `community_groups.report_count` (drop after reads move).
* **Tables:** hangouts, city_videos, community_groups (contract drops the counters).
* **Backfill:** none (counts are computed).
* **Risk:** low; a second driver to operate.
* **Rollback:** redeploy; counters remain until contract.
* **Stories:** RAZ-158, RAZ-118, map:meetup-2.2-free-spot-counter,
  map:meetup-5.1-dinner-sign-up.

### Step 8 · Column conventions sweep — L

* **Scope:** ADR-002, one migration per table group: `created_at`/`updated_at`
  `NOT NULL` with defaults (and added where missing); `is_admin NOT NULL`; `json` →
  `jsonb` or `text[]`; `CHECK` constraints for every closed value set (from
  `shared/enums.ts`); indexes on every FK column; `timestamp` → `timestamptz`
  (`USING … AT TIME ZONE 'UTC'`) on all tables except `events` (step 17);
  `availability_slots` and `booking_requests` times to `time`/`timestamptz`;
  `dinners` day/time text → `starts_at`; `dancer_styles` + `dance_styles`
  replace `dance_styles`/`dance_levels`; `festival_submissions.payload` → `jsonb`.
* **Tables:** all except `events`.
* **Backfill:** `CHECK`s are validated after a query shows zero violating rows; the
  existing mismatch (`review.ts` accepts `'event'`) is resolved first.
* **Risk:** medium — each `ALTER … TYPE` rewrites a table under an exclusive lock;
  run per table in a low-traffic window (largest: `profiles`, `dancers`, seconds at
  this size).
* **Rollback:** each migration has an inverse (`TYPE json`, `DROP CONSTRAINT`).
* **Stories:** RAZ-79 (style-level mix in SQL), RAZ-158, RAZ-118.

### Step 9 · Election references — S

* **Scope:** ADR-002. FK on `moderator_elections.winner_candidate_id`; composite
  FKs on votes and history; partial unique index "one open election per space";
  append-only history (UPDATE/DELETE revoked from the app role).
* **Tables:** moderator_elections, election_candidates, election_votes,
  election_vote_history.
* **Backfill:** verify no orphan candidate ids first.
* **Risk:** low (few rows).
* **Rollback:** drop the constraints.
* **Stories:** RAZ-152, RAZ-163, RAZ-165.

### Step 10 · API foundation — M

* **Scope:** ADR-011, without renaming anything yet: `dbError()`, auth-tier
  middlewares, bounded inputs, explicit DTOs, cursor pagination for
  `entity.listArtists`/`listVenues` and `gigs.list`, a server-side tRPC caller for
  SSR (retiring `/api/cities*` and `/api/festivals*` once pages use it), no N+1 in
  `dinner.list` and `hangouts.listTonight`.
* **Tables:** none.
* **Risk:** low; client changes for paged lists.
* **Rollback:** redeploy.
* **Stories:** RAZ-58, RAZ-64, RAZ-50, RAZ-40, RAZ-118, RAZ-139.

### Step 11 · Canonical cities — L

* **Scope:** ADR-005 = steps 1–6 of `docs/research/2026-10-12-city-canonicalisation.md`:
  apply `0024` as a journaled migration, backfill `cities` through Google Places
  (585 values), add nullable `city_id` to every city-bearing table, fill, dual-write
  from `<CityCombobox>` and the v3 sync, switch reads. Contract (dropping `city`,
  `city_slug`, `location`, `origin_city`) is its own approval.
* **Tables:** cities + 15 tables gaining `city_id`.
* **Backfill:** the v3 sync resolves venue localities through the city service
  from this step on; archived v4 events get `city_id` from their `city` text in the
  same batch job (no Places calls needed beyond the 585 distinct values).
* **Risk:** medium — Places quota and manual review of `no-match` values
  (e.g. München-Flughafen).
* **Rollback:** `city_id = NULL`; text columns are untouched until contract.
* **Stories:** RAZ-85, RAZ-64, RAZ-47, RAZ-139, RAZ-127, RAZ-45, RAZ-169.

## Relations

- Parent: RAZ-305
