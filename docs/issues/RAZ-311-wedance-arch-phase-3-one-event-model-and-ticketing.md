---
title: "WeDance arch Phase 3: One event model and ticketing"
type: Task
id: RAZ-311
status: in-progress
state: In Review
state_type: started
project: "WeDance CUJ"
labels: []
assignee: "Aleksey Razbakov"
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: "RAZ-305"
created: 2026-10-12T12:47:31.424Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-311/wedance-arch-phase-3-one-event-model-and-ticketing
exported: 2026-10-25
---

# RAZ-311 — WeDance arch Phase 3: One event model and ticketing

Part of RAZ-305 · migration plan: [https://2026.wedance.vip/docs/architecture/decisions/migration-plan](<https://2026.wedance.vip/docs/architecture/decisions/migration-plan>)

**Status: proposed.** Nothing here starts until the Commander moves it to Todo (`ok RAZ-n`). When approved, each step below becomes its own ticket.

## Steps

* Step 17 · Reshape `events` — L
* Step 18 · Event series — M
* Step 19 · Festivals become events — L
* Step 20 · Bookings become events on acceptance — M
* Step 21 · Programme and ticket catalogue — L
* Step 22 · Orders and checkout — L
* Step 23 · Submission onboarding creates the listing — S

## Detail (from docs/architecture/target/migration-plan.md)

### Step 17 · Reshape `events` — L

* **Scope:** ADR-006. Expand: `status`, `kind`, `title`, `starts_at`/`ends_at`
  `timestamptz`, `venue_profile_id`, `organizer_profile_id`, `event_artists`,
  `price_from_cents`, uniform `source`, `sync_locked_at`. The v3 sync dual-writes
  the old and new columns and resolves venue/organiser/artist handles to FKs.
  Switch reads. Contract: drop `archived`, `published`, `is_festival`, `type`,
  `*_username`, `artists`, `city`, `city_slug`.
* **Tables:** events, event_artists (new).
* **Backfill:** v4 rows (9,580): `status = 'archived'`, `source = 'wedance-v4'`,
  `source_id` from `source_ref`, slug generated where missing; v3 rows:
  `published` → `status = 'published'`, delisted → `archived`; `kind` from `type`
  and `is_festival`; artist JSON → `event_artists` (profile match by handle, else
  `display_name`).
* **Risk:** medium — the largest table and the live sync; batched in 1,000-row
  chunks, run after the daily sync.
* **Rollback:** before contract, redeploy; old columns are still written.
* **Stories:** RAZ-162, RAZ-251, RAZ-253, RAZ-55, RAZ-161, RAZ-28, RAZ-30.

### Step 18 · Event series — M

* **Scope:** ADR-006. `event_series`; `events.series_id` uuid FK; v3 `series_id`
  text becomes a series row; a cron materialises native series weeks ahead.
* **Tables:** event_series (new), events.
* **Backfill:** one series per distinct v3 `series_id`; `rrule` left NULL for
  imported irregular series.
* **Risk:** low.
* **Rollback:** the text column stays until contract.
* **Stories:** RAZ-108, RAZ-113, RAZ-126.

### Step 19 · Festivals become events — L

* **Scope:** ADR-006. `festival_details`; each `festivals` row → an `events` row
  (or attaches to the matching v3 festival event) + details; add `event_id` to
  dinners, festival_signups, festival_ride_shares, festival_roommate_lookups,
  referrals and festival_waves (from the slug); reviews move to the
  `event_id`/`profile_id` arc; `/festivals/<slug>` reads events. Contract: drop the
  `festival_id`/`festival_slug` columns and `festivals`.
* **Tables:** festival_details (new), events, festivals, and the six child tables,
  reviews.
* **Backfill:** 6 festivals; matches with v3 festival rows by title + start date +
  city, ambiguous ones listed for a human; `legacy_festival_id` maps children.
* **Risk:** medium — touches every festival feature; small row counts.
* **Rollback:** before contract, reads fall back to `festival_id`.
* **Stories:** RAZ-105, RAZ-32, RAZ-65, RAZ-89, map:meetup-8.1-rate-festival.

### Step 20 · Bookings become events on acceptance — M

* **Scope:** ADR-006. `booking_requests.event_id`; deciding a request creates the
  event in one transaction; public feeds stop reading `booking_requests`.
* **Tables:** booking_requests, events.
* **Backfill:** every `accepted` booking gets its event (`source = 'booking'`);
  pending ones stay requests (they disappear from public feeds — intended).
* **Risk:** low; product-visible change for pending requests (open question).
* **Rollback:** redeploy; feed can union bookings again.
* **Stories:** RAZ-129, RAZ-158, RAZ-162, RAZ-304.

### Step 21 · Programme and ticket catalogue — L

* **Scope:** ADR-007. `programme_sessions`, `session_artists`, `ticket_types`;
  seed the mock festivals' sessions, teachers and ticket tiers (after the organiser
  confirms each is current); festival pages and the workshop picker read the
  database; delete `app/data/mock-*.ts` festival files and
  `server/utils/ticket-prices.ts`.
* **Tables:** programme_sessions, session_artists, ticket_types (new).
* **Backfill:** idempotent seed keyed on `source_ref` (file + id); free spots and
  the €1 unlock become `social_pass` ticket types per festival.
* **Risk:** medium — publishing stale festival data; gated on organiser
  confirmation.
* **Rollback:** pages fall back to the mock files until they are deleted.
* **Stories:** RAZ-36, RAZ-54, RAZ-97, RAZ-69, RAZ-149, RAZ-33, RAZ-144, RAZ-74.

### Step 22 · Orders and checkout — L

* **Scope:** ADR-007. `orders`, `order_items`; one `ticketing.checkout`; webhooks
  write orders through the ledger; TicketTailor mapping from
  `festival_details.tickettailor_event_id`; referrals point at orders.
* **Tables:** orders, order_items (new), referrals, festival_signups (read-only
  from here).
* **Backfill:** every paid or verified `festival_signups` row → an order
  (`provider` from `stripe_session_id`/`tickettailor_order_id`, amount from
  `paid_amount`) with one item on the matching ticket type; free joins → 0-cent
  `social_pass` orders.
* **Risk:** high (money) — dual-run: the new checkout writes orders *and* the old
  sign-up row for one release; a reconciliation query compares them daily.
* **Rollback:** redeploy; `festival_signups` is still written during the release.
* **Stories:** RAZ-110, RAZ-130, RAZ-23, RAZ-246, RAZ-99,
  map:meetup-2.2-free-spot-counter, map:meetup-2.3-social-paywall.

### Step 23 · Submission onboarding creates the listing — S

* **Scope:** ADR-007. `festival_submissions.event_id`, `reviewed_by/at`;
  `admin.festivals.onboard` creates event + details + owner membership.
* **Tables:** festival_submissions.
* **Backfill:** link already-onboarded submissions to their festival events by slug.
* **Risk:** low.
* **Rollback:** redeploy.
* **Stories:** RAZ-95, RAZ-112, RAZ-122, RAZ-141, RAZ-170.

## Relations

- Parent: RAZ-305

## Comments

### Linear · 2026-10-15 16:44 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-15 16:48 UTC

### 💬 Answer — Blocked — Phases 0-2 and two commander decisions must complete first

Phase 3 (Steps 17-23) cannot start: Phase 0 is still In Progress, Phases 1-2 are in Triage, and two commander decisions (RAZ-315 on booking privacy, RAZ-320 on plan pricing) are pending. The ADRs and migration steps are fully specified and ready to become individual tickets once predecessors complete.
