---
id: TARGET-MIGRATION
title: Migration plan
status: proposed
date: 2026-10-12
summary: 28 reversible steps in five phases from today's schema to the target — security first, every step expand → backfill → switch → contract.
---

From today's schema to the [target data model](/architecture/decisions/data-model),
on a live database (11,192 events — 9,580 archived v4 imports plus the daily v3
mirror —, 6,589 profiles, 3,932 dancers, real ticket payments in Stripe test mode).
Nothing here is approved yet: each step becomes a ticket only after the Commander
approves it.

## Rules for every step

- **Expand → backfill → switch reads → contract** (ADR-001). Expand migrations are
  additive and safe to run while the old code serves traffic; backfills are
  batched, idempotent (`WHERE new_col IS NULL`) and re-runnable; the switch is a
  normal deploy; the contract migration runs only after the switch has been live
  for at least a week and needs the Commander's explicit approval plus a Neon PITR
  restore point taken right before it.
- **Rollback** before the contract step = redeploy the previous app version (the
  old columns are still there and still written). After a contract step = restore
  from the PITR point; that is why contract steps are rare and separate.
- **Constraints** are added `NOT VALID`, validated later; large indexes
  `CONCURRENTLY` (ADR-001).
- **v3 sync**: while a step changes a table the sync writes (`events`, `profiles`),
  the sync dual-writes old and new columns; the step's backfill runs after a sync
  run, and the sync is paused (one skipped day) only for the contract migration.
- **Archived v4 events** keep their rows; they move to `status = 'archived'` and are
  never shown publicly, so their backfills can run slowly and last.
- **Sizes**: S ≤ 1 day, M ≤ 3 days, L ≤ 2 weeks of agent work including tests.

## Phases at a glance

| Phase | Steps | Ships |
|---|---|---|
| 0 · Stop the bleeding | 0–6 | a trustworthy migration path, no plaintext secrets, verified email, safe uploads, working account erasure, no lost payments |
| 1 · Integrity and API foundation | 7–11 | transactions, real constraints, typed times, error/paging conventions, canonical cities |
| 2 · Identity and ownership | 12–16 | one handle namespace, venue/organiser accounts, artist roles, one follow graph, delivered enquiries and booking notifications |
| 3 · One event model and ticketing | 17–23 | one events table, series, festivals as events, bookings → events, programme and ticket catalogue in the DB, orders |
| 4 · Attendance, plans and contract | 24–27 | one attendance record, typed plans, routers per context, legacy tables dropped |

## Phase 0 — Stop the bleeding

### Step 0 · Repair the migration journal and baseline it — M

- **Scope:** ADR-001. Introspect a Neon branch of production; reconcile `schema.ts`
  (add `dancers.source_ref`, the production-only `follows` table; keep `cities` out
  of the baseline); generate a single `0000_baseline.sql`; record it as applied in
  production's `drizzle.__drizzle_migrations` without executing; archive the old
  files; remove `db:push`; CI runs `drizzle-kit migrate` before promotion.
  `scripts/sync-v3-events.ts` stops applying SQL files (it checks for the columns it
  needs and exits with a clear error), which restores the daily sync broken since
  2026-10-10.
- **Tables:** none changed in production.
- **Backfill:** none.
- **Risk:** low — no DDL runs in production; the risk is a baseline that does not
  match production, caught by diffing `drizzle-kit introspect` output against the
  baseline on the branch.
- **Rollback:** restore the archived migration folder and journal from git.
- **Stories:** restores RAZ-251, RAZ-253, RAZ-162 (sync); prerequisite for all
  other steps.

### Step 1 · Previews on their own Neon branch — S

- **Scope:** ADR-001. Neon's Vercel integration creates a branch per preview
  deployment; `DATABASE_URL` for Preview points at it; branches are deleted with
  the PR.
- **Tables / backfill:** none.
- **Risk:** previews of PRs that need fresh production data see the branch's
  copy-at-creation; acceptable.
- **Rollback:** point Preview back at the production URL (not recommended).
- **Stories:** none directly; protects every story's production data.

### Step 2 · Hash session tokens; server-owned cookie; sign-out — M

- **Scope:** ADR-003. Expand: `sessions.token_hash`, `last_seen_at`, `revoked_at`,
  `user_agent`. Backfill `token_hash = sha256(token)` for live sessions. Switch:
  context looks up by hash; the server sets an `HttpOnly; Secure; SameSite=Lax`
  cookie; `identity.signOut` revokes; Bearer header still accepted for one release.
  Contract: drop `sessions.token`.
- **Tables:** sessions.
- **Backfill:** one `UPDATE`; nobody is signed out.
- **Risk:** medium — a cookie-handling bug signs everyone out; mitigated by
  accepting both header and cookie during the release.
- **Rollback:** before contract, redeploy (plaintext column still written).
- **Stories:** map:meetup-2.1-sign-up, RAZ-155.

### Step 3 · Purpose-bound tokens and verified email — M

- **Scope:** ADR-003. New `auth_tokens`; `dancers.email_verified_at`. Magic-link
  requests stop writing to `dancers`; register sends a verify link; claim and the
  TicketTailor auto-link require a verified email; salts from
  `crypto.randomBytes`. Contract: drop `dancers.magic_token*`.
- **Tables:** auth_tokens (new), dancers.
- **Backfill:** `email_verified_at = coalesce(v4 verified date, first magic-link
  sign-in)`; dancers who only ever used a password stay unverified and are asked
  once.
- **Risk:** medium — some ticket holders must verify before their ticket attaches;
  the claim page explains it.
- **Rollback:** redeploy; columns are additive until contract.
- **Stories:** RAZ-241, RAZ-83, map:meetup-2.1-sign-up.

### Step 4 · Upload auth, rate limits, private data out of public responses — M

- **Scope:** ADR-003, ADR-011. `/api/media/image` authed + limits (RAZ-288);
  `rate_limits` table + middleware on public writes; explicit public DTOs for
  `gigs.list`/`getById` (no contact email), `booking.scheduleForProfile`/`getEvent`
  (no requester name or message); `rideShare.list`, `roommate.list` and
  `plan.discover` apply `profile_public`/`share_going`; remove
  `claim.getClaimStatus`.
- **Tables:** rate_limits (new).
- **Backfill:** none.
- **Risk:** low; some public pages show less.
- **Rollback:** redeploy.
- **Stories:** RAZ-275, RAZ-41, RAZ-121, RAZ-116, RAZ-127, RAZ-83.

### Step 5 · Delete rules on every FK — fix account erasure — S

- **Scope:** ADR-002. Re-create every FK that points at `dancers` (and their
  children) with the ownership rule (`CASCADE` / `SET NULL` + scrub / `RESTRICT`),
  added `NOT VALID` then validated; `auth.deleteAccount` shrinks to delete + scrub;
  a test asserts every FK to `dancers` has a rule (this is what silently broke
  erasure when `artist_follows` and `festival_waves` were added).
- **Tables:** all 26 tables with an FK to `dancers` (plus the production-only `follows`).
- **Backfill:** none.
- **Risk:** low — rules only matter on delete; reviewed per FK.
- **Rollback:** re-create the FKs as `NO ACTION`.
- **Stories:** RAZ-155.

### Step 6 · Payment hotfixes and the webhook ledger — M

- **Scope:** ADR-007, ahead of the full order model. `webhook_events` table; the
  Stripe webhook upgrades an existing sign-up (sets paid amount, session id,
  `verified_ticket_holder`) instead of treating the conflict as "done";
  `festivalSignup.myTickets` counts verified rows regardless of `paid_amount`
  (TicketTailor); referral credits are marked spent on payment, released on
  expiry; unique-violation detection by SQLSTATE.
- **Tables:** webhook_events (new), festival_signups, referrals.
- **Backfill:** find Stripe sessions in test mode whose payment never reached a
  sign-up (Stripe list API vs. `festival_signups.stripe_session_id`) and repair
  them; release credits held by expired sessions.
- **Risk:** medium (money paths); covered by the existing webhook tests plus the
  conflict case.
- **Rollback:** redeploy; the ledger table is additive.
- **Stories:** RAZ-110, RAZ-130, RAZ-247, RAZ-248, RAZ-99, RAZ-23.

## Phase 1 — Integrity and API foundation

### Step 7 · Transactions and atomic counters — M

- **Scope:** ADR-002. Add `withTx` (Neon serverless Pool); use it for
  `booking.setAvailability` (broken today), election close, dinner grouping,
  festival free-spot and dinner joins (capacity under lock), video ELO votes;
  derive `hangouts.people_count`, `city_videos.vote_count`,
  `community_groups.report_count` (drop after reads move).
- **Tables:** hangouts, city_videos, community_groups (contract drops the counters).
- **Backfill:** none (counts are computed).
- **Risk:** low; a second driver to operate.
- **Rollback:** redeploy; counters remain until contract.
- **Stories:** RAZ-158, RAZ-118, map:meetup-2.2-free-spot-counter,
  map:meetup-5.1-dinner-sign-up.

### Step 8 · Column conventions sweep — L

- **Scope:** ADR-002, one migration per table group: `created_at`/`updated_at`
  `NOT NULL` with defaults (and added where missing); `is_admin NOT NULL`; `json` →
  `jsonb` or `text[]`; `CHECK` constraints for every closed value set (from
  `shared/enums.ts`); indexes on every FK column; `timestamp` → `timestamptz`
  (`USING … AT TIME ZONE 'UTC'`) on all tables except `events` (step 17);
  `availability_slots` and `booking_requests` times to `time`/`timestamptz`;
  `dinners` day/time text → `starts_at`; `dancer_styles` + `dance_styles`
  replace `dance_styles`/`dance_levels`; `festival_submissions.payload` → `jsonb`.
- **Tables:** all except `events`.
- **Backfill:** `CHECK`s are validated after a query shows zero violating rows; the
  existing mismatch (`review.ts` accepts `'event'`) is resolved first.
- **Risk:** medium — each `ALTER … TYPE` rewrites a table under an exclusive lock;
  run per table in a low-traffic window (largest: `profiles`, `dancers`, seconds at
  this size).
- **Rollback:** each migration has an inverse (`TYPE json`, `DROP CONSTRAINT`).
- **Stories:** RAZ-79 (style-level mix in SQL), RAZ-158, RAZ-118.

### Step 9 · Election references — S

- **Scope:** ADR-002. FK on `moderator_elections.winner_candidate_id`; composite
  FKs on votes and history; partial unique index "one open election per space";
  append-only history (UPDATE/DELETE revoked from the app role).
- **Tables:** moderator_elections, election_candidates, election_votes,
  election_vote_history.
- **Backfill:** verify no orphan candidate ids first.
- **Risk:** low (few rows).
- **Rollback:** drop the constraints.
- **Stories:** RAZ-152, RAZ-163, RAZ-165.

### Step 10 · API foundation — M

- **Scope:** ADR-011, without renaming anything yet: `dbError()`, auth-tier
  middlewares, bounded inputs, explicit DTOs, cursor pagination for
  `entity.listArtists`/`listVenues` and `gigs.list`, a server-side tRPC caller for
  SSR (retiring `/api/cities*` and `/api/festivals*` once pages use it), no N+1 in
  `dinner.list` and `hangouts.listTonight`.
- **Tables:** none.
- **Risk:** low; client changes for paged lists.
- **Rollback:** redeploy.
- **Stories:** RAZ-58, RAZ-64, RAZ-50, RAZ-40, RAZ-118, RAZ-139.

### Step 11 · Canonical cities — L

- **Scope:** ADR-005 = steps 1–6 of `docs/research/2026-10-12-city-canonicalisation.md`:
  apply `0024` as a journaled migration, backfill `cities` through Google Places
  (585 values), add nullable `city_id` to every city-bearing table, fill, dual-write
  from `<CityCombobox>` and the v3 sync, switch reads. Contract (dropping `city`,
  `city_slug`, `location`, `origin_city`) is its own approval.
- **Tables:** cities + 15 tables gaining `city_id`.
- **Backfill:** the v3 sync resolves venue localities through the city service
  from this step on; archived v4 events get `city_id` from their `city` text in the
  same batch job (no Places calls needed beyond the 585 distinct values).
- **Risk:** medium — Places quota and manual review of `no-match` values
  (e.g. München-Flughafen).
- **Rollback:** `city_id = NULL`; text columns are untouched until contract.
- **Stories:** RAZ-85, RAZ-64, RAZ-47, RAZ-139, RAZ-127, RAZ-45, RAZ-169.

## Phase 2 — Identity and ownership

### Step 12 · Handle registry — M

- **Scope:** ADR-004. `citext` extension; `handles` table; backfill profiles then
  dancers; collisions reported before writing (dancers get a suffix and a notice);
  every new dancer gets a handle at sign-up; `/@handle` resolves through `handles`.
  Contract: drop `dancers.username`, `profiles.username`.
- **Tables:** handles (new), dancers, profiles.
- **Backfill:** v3 sync creates profiles through the registry from this step on.
- **Risk:** medium — URL changes for colliding dancers; old handles redirect for a
  release.
- **Rollback:** before contract, reads fall back to the username columns.
- **Stories:** RAZ-154, RAZ-253, RAZ-303.

### Step 13 · Profile memberships and claims — M

- **Scope:** ADR-004. `profile_members`, `profile_claims`, admin claim review;
  `requireProfileRole` replaces the handle comparisons in booking and elections;
  `election.close` grants a `moderator` membership. Contract: drop
  `profiles.moderator_*`, `claimed`.
- **Tables:** profile_members, profile_claims (new), profiles.
- **Backfill:** current moderators (from `moderator_handle` matched to a dancer)
  become `moderator` members with the election term; `claimed = true` profiles get
  `claimed_at = created_at` and are listed for owner assignment.
- **Risk:** low.
- **Rollback:** reads fall back to the flat columns until contract.
- **Stories:** RAZ-129, RAZ-135, RAZ-158, RAZ-152, RAZ-166, RAZ-79, RAZ-150.

### Step 14 · Artist roles, affiliations, venue address; one artist model — M

- **Scope:** ADR-004, ADR-005. `profiles.roles`, `amenities`, structured address;
  `profile_affiliations`; `gigs.poster_profile_id`; `app/data/artists.ts` artists
  matched or created as profiles; `/artists/[id]` redirects to `/@handle`.
- **Tables:** profiles, profile_affiliations (new), gigs.
- **Backfill:** roles from v3/v4 provenance (`source_ref.v4Type`, v3 profile type)
  where it says DJ/teacher; the rest stays empty for owners to fill.
- **Risk:** low.
- **Rollback:** redeploy; columns are additive.
- **Stories:** RAZ-303, RAZ-66, RAZ-302, RAZ-145, RAZ-55.

### Step 15 · One follow graph — S

- **Scope:** ADR-004. Rename `artist_follows` → `follows`; merge the production-only
  v4 `follows` edges by resolving `target_username` to a profile; dancer targets go
  to `legacy_follows`. Contract: drop the old v4 table.
- **Tables:** follows, legacy_follows (new).
- **Backfill:** 667 v4 edges; idempotent on `(dancer_id, profile_id)`.
- **Risk:** low.
- **Rollback:** the v4 table is kept until contract.
- **Stories:** RAZ-55.

### Step 16 · Inbound requests and delivery outbox — M

- **Scope:** ADR-010. `inbound_requests`, `deliveries`, cron route; enquiries and
  reports stored first, delivered to Linear by the outbox; booking requests notify
  venue members and moderators; gig applications stored and emailed to posters.
- **Tables:** inbound_requests, deliveries (new), booking_requests (`notified_at`).
- **Backfill:** none (past enquiries stay in Linear).
- **Risk:** low; email deliverability for new recipients.
- **Rollback:** redeploy; tables are additive.
- **Stories:** RAZ-41, RAZ-42, RAZ-129, RAZ-135, RAZ-142, RAZ-158, RAZ-57, RAZ-107,
  RAZ-114, RAZ-272.

## Phase 3 — One event model and ticketing

### Step 17 · Reshape `events` — L

- **Scope:** ADR-006. Expand: `status`, `kind`, `title`, `starts_at`/`ends_at`
  `timestamptz`, `venue_profile_id`, `organizer_profile_id`, `event_artists`,
  `price_from_cents`, uniform `source`, `sync_locked_at`. The v3 sync dual-writes
  the old and new columns and resolves venue/organiser/artist handles to FKs.
  Switch reads. Contract: drop `archived`, `published`, `is_festival`, `type`,
  `*_username`, `artists`, `city`, `city_slug`.
- **Tables:** events, event_artists (new).
- **Backfill:** v4 rows (9,580): `status = 'archived'`, `source = 'wedance-v4'`,
  `source_id` from `source_ref`, slug generated where missing; v3 rows:
  `published` → `status = 'published'`, delisted → `archived`; `kind` from `type`
  and `is_festival`; artist JSON → `event_artists` (profile match by handle, else
  `display_name`).
- **Risk:** medium — the largest table and the live sync; batched in 1,000-row
  chunks, run after the daily sync.
- **Rollback:** before contract, redeploy; old columns are still written.
- **Stories:** RAZ-162, RAZ-251, RAZ-253, RAZ-55, RAZ-161, RAZ-28, RAZ-30.

### Step 18 · Event series — M

- **Scope:** ADR-006. `event_series`; `events.series_id` uuid FK; v3 `series_id`
  text becomes a series row; a cron materialises native series weeks ahead.
- **Tables:** event_series (new), events.
- **Backfill:** one series per distinct v3 `series_id`; `rrule` left NULL for
  imported irregular series.
- **Risk:** low.
- **Rollback:** the text column stays until contract.
- **Stories:** RAZ-108, RAZ-113, RAZ-126.

### Step 19 · Festivals become events — L

- **Scope:** ADR-006. `festival_details`; each `festivals` row → an `events` row
  (or attaches to the matching v3 festival event) + details; add `event_id` to
  dinners, festival_signups, festival_ride_shares, festival_roommate_lookups,
  referrals and festival_waves (from the slug); reviews move to the
  `event_id`/`profile_id` arc; `/festivals/<slug>` reads events. Contract: drop the
  `festival_id`/`festival_slug` columns and `festivals`.
- **Tables:** festival_details (new), events, festivals, and the six child tables,
  reviews.
- **Backfill:** 6 festivals; matches with v3 festival rows by title + start date +
  city, ambiguous ones listed for a human; `legacy_festival_id` maps children.
- **Risk:** medium — touches every festival feature; small row counts.
- **Rollback:** before contract, reads fall back to `festival_id`.
- **Stories:** RAZ-105, RAZ-32, RAZ-65, RAZ-89, map:meetup-8.1-rate-festival.

### Step 20 · Bookings become events on acceptance — M

- **Scope:** ADR-006. `booking_requests.event_id`; deciding a request creates the
  event in one transaction; public feeds stop reading `booking_requests`.
- **Tables:** booking_requests, events.
- **Backfill:** every `accepted` booking gets its event (`source = 'booking'`);
  pending ones stay requests (they disappear from public feeds — intended).
- **Risk:** low; product-visible change for pending requests (open question).
- **Rollback:** redeploy; feed can union bookings again.
- **Stories:** RAZ-129, RAZ-158, RAZ-162, RAZ-304.

### Step 21 · Programme and ticket catalogue — L

- **Scope:** ADR-007. `programme_sessions`, `session_artists`, `ticket_types`;
  seed the mock festivals' sessions, teachers and ticket tiers (after the organiser
  confirms each is current); festival pages and the workshop picker read the
  database; delete `app/data/mock-*.ts` festival files and
  `server/utils/ticket-prices.ts`.
- **Tables:** programme_sessions, session_artists, ticket_types (new).
- **Backfill:** idempotent seed keyed on `source_ref` (file + id); free spots and
  the €1 unlock become `social_pass` ticket types per festival.
- **Risk:** medium — publishing stale festival data; gated on organiser
  confirmation.
- **Rollback:** pages fall back to the mock files until they are deleted.
- **Stories:** RAZ-36, RAZ-54, RAZ-97, RAZ-69, RAZ-149, RAZ-33, RAZ-144, RAZ-74.

### Step 22 · Orders and checkout — L

- **Scope:** ADR-007. `orders`, `order_items`; one `ticketing.checkout`; webhooks
  write orders through the ledger; TicketTailor mapping from
  `festival_details.tickettailor_event_id`; referrals point at orders.
- **Tables:** orders, order_items (new), referrals, festival_signups (read-only
  from here).
- **Backfill:** every paid or verified `festival_signups` row → an order
  (`provider` from `stripe_session_id`/`tickettailor_order_id`, amount from
  `paid_amount`) with one item on the matching ticket type; free joins → 0-cent
  `social_pass` orders.
- **Risk:** high (money) — dual-run: the new checkout writes orders *and* the old
  sign-up row for one release; a reconciliation query compares them daily.
- **Rollback:** redeploy; `festival_signups` is still written during the release.
- **Stories:** RAZ-110, RAZ-130, RAZ-23, RAZ-246, RAZ-99,
  map:meetup-2.2-free-spot-counter, map:meetup-2.3-social-paywall.

### Step 23 · Submission onboarding creates the listing — S

- **Scope:** ADR-007. `festival_submissions.event_id`, `reviewed_by/at`;
  `admin.festivals.onboard` creates event + details + owner membership.
- **Tables:** festival_submissions.
- **Backfill:** link already-onboarded submissions to their festival events by slug.
- **Risk:** low.
- **Rollback:** redeploy.
- **Stories:** RAZ-95, RAZ-112, RAZ-122, RAZ-141, RAZ-170.

## Phase 4 — Attendance, plans and contract

### Step 24 · One attendance record — L

- **Scope:** ADR-008. `attendances`; backfill from `plan_items` (festival/event)
  and `festival_signups`; one public rule; waves, ride shares and roommate
  requests move to `event_id` and are renamed; logistics toggles move from
  localStorage (imported on the dancer's next visit).
- **Tables:** attendances (new), waves, ride_shares, roommate_requests.
- **Backfill:** merge per (dancer, event), higher status and more private
  visibility win; booking-id plan rows map via `booking_requests.event_id`, the
  rest go to a report table.
- **Risk:** medium — public lists change (some faces disappear if the visibility
  default is `hidden`).
- **Rollback:** reads fall back to `plan_items`/`festival_signups` until step 27.
- **Stories:** RAZ-83, RAZ-62, RAZ-86, RAZ-115, RAZ-34, RAZ-77, RAZ-82, RAZ-65,
  RAZ-61, RAZ-124, RAZ-102, RAZ-128, map:meetup-1.7-activity-check-in.

### Step 25 · Typed plan tables — M

- **Scope:** ADR-009. `session_picks`, `series_enrolments`, `dancer_goals`; the My
  Plan workshop picker stops using localStorage; `plan.*` procedures become
  adapters.
- **Tables:** session_picks, series_enrolments, dancer_goals (new).
- **Backfill:** workshop rows via the seeded sessions' `source_ref`; class rows via
  the event's series; goals with their metadata; unmapped rows to the report table.
- **Risk:** low.
- **Rollback:** adapters keep `plan_items` written until step 27.
- **Stories:** RAZ-97, RAZ-36, RAZ-74, RAZ-108, RAZ-113, RAZ-287, RAZ-91, RAZ-140.

### Step 26 · Routers per context — L

- **Scope:** ADR-011. Rename routers and procedures to the catalogue in
  [api-plan](/architecture/decisions/api-plan), context by context, old names
  delegating for one release; remove the unmapped procedures marked "remove".
- **Tables:** none.
- **Risk:** low per context; large surface overall.
- **Rollback:** adapters.
- **Stories:** all API-backed stories (no behaviour change).

### Step 27 · Contract — M (explicit approval)

- **Scope:** drop `plan_items`, `festival_signups`, `festivals`, the production-only
  v4 `follows`, and every column marked "removed" in the data model, after their
  switch steps have run for at least a week and the reports are empty or accepted.
- **Tables:** as listed.
- **Backfill:** none; final reconciliation queries archived in the PR.
- **Risk:** irreversible without PITR — that is why it is last and separate.
- **Rollback:** Neon PITR restore point taken immediately before.
- **Stories:** none new; removes the drift sources behind RAZ-83 and RAZ-97.
