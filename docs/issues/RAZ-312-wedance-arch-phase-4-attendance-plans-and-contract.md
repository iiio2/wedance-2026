---
title: "WeDance arch Phase 4: Attendance, plans and contract"
type: Task
id: RAZ-312
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
created: 2026-10-12T12:47:32.194Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/345"]
linear_url: https://linear.app/alosha/issue/RAZ-312/wedance-arch-phase-4-attendance-plans-and-contract
exported: 2026-10-25
---

# RAZ-312 — WeDance arch Phase 4: Attendance, plans and contract

Part of RAZ-305 · migration plan: [https://2026.wedance.vip/docs/architecture/decisions/migration-plan](<https://2026.wedance.vip/docs/architecture/decisions/migration-plan>)

**Status: proposed.** Nothing here starts until the Commander moves it to Todo (`ok RAZ-n`). When approved, each step below becomes its own ticket.

## Steps

* Step 24 · One attendance record — L
* Step 25 · Typed plan tables — M
* Step 26 · Routers per context — L
* Step 27 · Contract — M (explicit approval)

## Detail (from docs/architecture/target/migration-plan.md)

### Step 24 · One attendance record — L

* **Scope:** ADR-008. `attendances`; backfill from `plan_items` (festival/event)
  and `festival_signups`; one public rule; waves, ride shares and roommate
  requests move to `event_id` and are renamed; logistics toggles move from
  localStorage (imported on the dancer's next visit).
* **Tables:** attendances (new), waves, ride_shares, roommate_requests.
* **Backfill:** merge per (dancer, event), higher status and more private
  visibility win; booking-id plan rows map via `booking_requests.event_id`, the
  rest go to a report table.
* **Risk:** medium — public lists change (some faces disappear if the visibility
  default is `hidden`).
* **Rollback:** reads fall back to `plan_items`/`festival_signups` until step 27.
* **Stories:** RAZ-83, RAZ-62, RAZ-86, RAZ-115, RAZ-34, RAZ-77, RAZ-82, RAZ-65,
  RAZ-61, RAZ-124, RAZ-102, RAZ-128, map:meetup-1.7-activity-check-in.

### Step 25 · Typed plan tables — M

* **Scope:** ADR-009. `session_picks`, `series_enrolments`, `dancer_goals`; the My
  Plan workshop picker stops using localStorage; `plan.*` procedures become
  adapters.
* **Tables:** session_picks, series_enrolments, dancer_goals (new).
* **Backfill:** workshop rows via the seeded sessions' `source_ref`; class rows via
  the event's series; goals with their metadata; unmapped rows to the report table.
* **Risk:** low.
* **Rollback:** adapters keep `plan_items` written until step 27.
* **Stories:** RAZ-97, RAZ-36, RAZ-74, RAZ-108, RAZ-113, RAZ-287, RAZ-91, RAZ-140.

### Step 26 · Routers per context — L

* **Scope:** ADR-011. Rename routers and procedures to the catalogue in
  [api-plan](</architecture/decisions/api-plan>), context by context, old names
  delegating for one release; remove the unmapped procedures marked "remove".
* **Tables:** none.
* **Risk:** low per context; large surface overall.
* **Rollback:** adapters.
* **Stories:** all API-backed stories (no behaviour change).

### Step 27 · Contract — M (explicit approval)

* **Scope:** drop `plan_items`, `festival_signups`, `festivals`, the production-only
  v4 `follows`, and every column marked "removed" in the data model, after their
  switch steps have run for at least a week and the reports are empty or accepted.
* **Tables:** as listed.
* **Backfill:** none; final reconciliation queries archived in the PR.
* **Risk:** irreversible without PITR — that is why it is last and separate.
* **Rollback:** Neon PITR restore point taken immediately before.
* **Stories:** none new; removes the drift sources behind RAZ-83 and RAZ-97.

## Relations

- Parent: RAZ-305

## Links

- [feat(attendance): Phase 4 expand — attendances table, router, dual-write (RAZ-312)](https://github.com/razbakov/wedance-2026/pull/345)

## Comments

### Aleksey Razbakov · 2026-10-12 15:21 UTC

Scope update (RAZ-317 decided): city battles and giveaways are KEPT. Remove them from the step 27 contract/removal list.

### Linear · 2026-10-15 16:44 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-15 17:06 UTC

### 👀 Merged — ready for your review — Attendance table, router, and dual-write shipped (Phase 4 expand)

**PR:** https://github.com/razbakov/wedance-2026/pull/345

Nothing to try — internal change (backend schema + tRPC router — no user-facing UI change yet).
