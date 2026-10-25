---
title: "WeDance arch Phase 2: Identity and ownership"
type: Task
id: RAZ-310
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
created: 2026-10-12T12:47:31.085Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/344"]
linear_url: https://linear.app/alosha/issue/RAZ-310/wedance-arch-phase-2-identity-and-ownership
exported: 2026-10-25
---

# RAZ-310 — WeDance arch Phase 2: Identity and ownership

Part of RAZ-305 · migration plan: [https://2026.wedance.vip/docs/architecture/decisions/migration-plan](<https://2026.wedance.vip/docs/architecture/decisions/migration-plan>)

**Status: proposed.** Nothing here starts until the Commander moves it to Todo (`ok RAZ-n`). When approved, each step below becomes its own ticket.

## Steps

* Step 12 · Handle registry — M
* Step 13 · Profile memberships and claims — M
* Step 14 · Artist roles, affiliations, venue address; one artist model — M
* Step 15 · One follow graph — S
* Step 16 · Inbound requests and delivery outbox — M

## Detail (from docs/architecture/target/migration-plan.md)

### Step 12 · Handle registry — M

* **Scope:** ADR-004. `citext` extension; `handles` table; backfill profiles then
  dancers; collisions reported before writing (dancers get a suffix and a notice);
  every new dancer gets a handle at sign-up; `/@handle` resolves through `handles`.
  Contract: drop `dancers.username`, `profiles.username`.
* **Tables:** handles (new), dancers, profiles.
* **Backfill:** v3 sync creates profiles through the registry from this step on.
* **Risk:** medium — URL changes for colliding dancers; old handles redirect for a
  release.
* **Rollback:** before contract, reads fall back to the username columns.
* **Stories:** RAZ-154, RAZ-253, RAZ-303.

### Step 13 · Profile memberships and claims — M

* **Scope:** ADR-004. `profile_members`, `profile_claims`, admin claim review;
  `requireProfileRole` replaces the handle comparisons in booking and elections;
  `election.close` grants a `moderator` membership. Contract: drop
  `profiles.moderator_*`, `claimed`.
* **Tables:** profile_members, profile_claims (new), profiles.
* **Backfill:** current moderators (from `moderator_handle` matched to a dancer)
  become `moderator` members with the election term; `claimed = true` profiles get
  `claimed_at = created_at` and are listed for owner assignment.
* **Risk:** low.
* **Rollback:** reads fall back to the flat columns until contract.
* **Stories:** RAZ-129, RAZ-135, RAZ-158, RAZ-152, RAZ-166, RAZ-79, RAZ-150.

### Step 14 · Artist roles, affiliations, venue address; one artist model — M

* **Scope:** ADR-004, ADR-005. `profiles.roles`, `amenities`, structured address;
  `profile_affiliations`; `gigs.poster_profile_id`; `app/data/artists.ts` artists
  matched or created as profiles; `/artists/[id]` redirects to `/@handle`.
* **Tables:** profiles, profile_affiliations (new), gigs.
* **Backfill:** roles from v3/v4 provenance (`source_ref.v4Type`, v3 profile type)
  where it says DJ/teacher; the rest stays empty for owners to fill.
* **Risk:** low.
* **Rollback:** redeploy; columns are additive.
* **Stories:** RAZ-303, RAZ-66, RAZ-302, RAZ-145, RAZ-55.

### Step 15 · One follow graph — S

* **Scope:** ADR-004. Rename `artist_follows` → `follows`; merge the production-only
  v4 `follows` edges by resolving `target_username` to a profile; dancer targets go
  to `legacy_follows`. Contract: drop the old v4 table.
* **Tables:** follows, legacy_follows (new).
* **Backfill:** 667 v4 edges; idempotent on `(dancer_id, profile_id)`.
* **Risk:** low.
* **Rollback:** the v4 table is kept until contract.
* **Stories:** RAZ-55.

### Step 16 · Inbound requests and delivery outbox — M

* **Scope:** ADR-010. `inbound_requests`, `deliveries`, cron route; enquiries and
  reports stored first, delivered to Linear by the outbox; booking requests notify
  venue members and moderators; gig applications stored and emailed to posters.
* **Tables:** inbound_requests, deliveries (new), booking_requests (`notified_at`).
* **Backfill:** none (past enquiries stay in Linear).
* **Risk:** low; email deliverability for new recipients.
* **Rollback:** redeploy; tables are additive.
* **Stories:** RAZ-41, RAZ-42, RAZ-129, RAZ-135, RAZ-142, RAZ-158, RAZ-57, RAZ-107,
  RAZ-114, RAZ-272.

## Relations

- Parent: RAZ-305

## Links

- [feat(schema): identity & ownership phase 2 (RAZ-310)](https://github.com/razbakov/wedance-2026/pull/344)

## Comments

### Aleksey Razbakov · 2026-10-12 15:21 UTC

Scope update (RAZ-319 decided): step 15 'One follow graph' includes dancer→dancer follows (mutual = friends) and migrates the v4 `follows` edges. Design for dancer targets from the start.

### Linear · 2026-10-15 16:44 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-15 17:05 UTC

### 👀 Merged — ready for your review — Database schema for handles, memberships, follows, and request inbox

**PR:** https://github.com/razbakov/wedance-2026/pull/344

Nothing to try — internal change (Backend schema migration + backfill scripts + router refactors; no UI changes until migration is applied to prod).
