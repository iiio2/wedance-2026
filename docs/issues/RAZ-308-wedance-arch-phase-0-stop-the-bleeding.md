---
title: "WeDance arch Phase 0: Stop the bleeding"
type: Task
id: RAZ-308
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
created: 2026-10-12T12:47:30.171Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/346"]
linear_url: https://linear.app/alosha/issue/RAZ-308/wedance-arch-phase-0-stop-the-bleeding
exported: 2026-10-25
---

# RAZ-308 — WeDance arch Phase 0: Stop the bleeding

Part of RAZ-305 · migration plan: [https://2026.wedance.vip/docs/architecture/decisions/migration-plan](<https://2026.wedance.vip/docs/architecture/decisions/migration-plan>)

**Status: proposed.** Nothing here starts until the Commander moves it to Todo (`ok RAZ-n`). When approved, each step below becomes its own ticket.

## Steps

* Step 0 · Repair the migration journal and baseline it — M
* Step 1 · Previews on their own Neon branch — S
* Step 2 · Hash session tokens; server-owned cookie; sign-out — M
* Step 3 · Purpose-bound tokens and verified email — M
* Step 4 · Upload auth, rate limits, private data out of public responses — M
* Step 5 · Delete rules on every FK — fix account erasure — S
* Step 6 · Payment hotfixes and the webhook ledger — M

## Detail (from docs/architecture/target/migration-plan.md)

### Step 0 · Repair the migration journal and baseline it — M

* **Scope:** ADR-001. Introspect a Neon branch of production; reconcile `schema.ts`
  (add `dancers.source_ref`, the production-only `follows` table; keep `cities` out
  of the baseline); generate a single `0000_baseline.sql`; record it as applied in
  production's `drizzle.__drizzle_migrations` without executing; archive the old
  files; remove `db:push`; CI runs `drizzle-kit migrate` before promotion.
  `scripts/sync-v3-events.ts` stops applying SQL files (it checks for the columns it
  needs and exits with a clear error), which restores the daily sync broken since
  2026-10-10.
* **Tables:** none changed in production.
* **Backfill:** none.
* **Risk:** low — no DDL runs in production; the risk is a baseline that does not
  match production, caught by diffing `drizzle-kit introspect` output against the
  baseline on the branch.
* **Rollback:** restore the archived migration folder and journal from git.
* **Stories:** restores RAZ-251, RAZ-253, RAZ-162 (sync); prerequisite for all
  other steps.

### Step 1 · Previews on their own Neon branch — S

* **Scope:** ADR-001. Neon's Vercel integration creates a branch per preview
  deployment; `DATABASE_URL` for Preview points at it; branches are deleted with
  the PR.
* **Tables / backfill:** none.
* **Risk:** previews of PRs that need fresh production data see the branch's
  copy-at-creation; acceptable.
* **Rollback:** point Preview back at the production URL (not recommended).
* **Stories:** none directly; protects every story's production data.

### Step 2 · Hash session tokens; server-owned cookie; sign-out — M

* **Scope:** ADR-003. Expand: `sessions.token_hash`, `last_seen_at`, `revoked_at`,
  `user_agent`. Backfill `token_hash = sha256(token)` for live sessions. Switch:
  context looks up by hash; the server sets an `HttpOnly; Secure; SameSite=Lax`
  cookie; `identity.signOut` revokes; Bearer header still accepted for one release.
  Contract: drop `sessions.token`.
* **Tables:** sessions.
* **Backfill:** one `UPDATE`; nobody is signed out.
* **Risk:** medium — a cookie-handling bug signs everyone out; mitigated by
  accepting both header and cookie during the release.
* **Rollback:** before contract, redeploy (plaintext column still written).
* **Stories:** map:meetup-2.1-sign-up, RAZ-155.

### Step 3 · Purpose-bound tokens and verified email — M

* **Scope:** ADR-003. New `auth_tokens`; `dancers.email_verified_at`. Magic-link
  requests stop writing to `dancers`; register sends a verify link; claim and the
  TicketTailor auto-link require a verified email; salts from
  `crypto.randomBytes`. Contract: drop `dancers.magic_token*`.
* **Tables:** auth_tokens (new), dancers.
* **Backfill:** `email_verified_at = coalesce(v4 verified date, first magic-link sign-in)`; dancers who only ever used a password stay unverified and are asked
  once.
* **Risk:** medium — some ticket holders must verify before their ticket attaches;
  the claim page explains it.
* **Rollback:** redeploy; columns are additive until contract.
* **Stories:** RAZ-241, RAZ-83, map:meetup-2.1-sign-up.

### Step 4 · Upload auth, rate limits, private data out of public responses — M

* **Scope:** ADR-003, ADR-011. `/api/media/image` authed + limits (RAZ-288);
  `rate_limits` table + middleware on public writes; explicit public DTOs for
  `gigs.list`/`getById` (no contact email), `booking.scheduleForProfile`/`getEvent`
  (no requester name or message); `rideShare.list`, `roommate.list` and
  `plan.discover` apply `profile_public`/`share_going`; remove
  `claim.getClaimStatus`.
* **Tables:** rate_limits (new).
* **Backfill:** none.
* **Risk:** low; some public pages show less.
* **Rollback:** redeploy.
* **Stories:** RAZ-275, RAZ-41, RAZ-121, RAZ-116, RAZ-127, RAZ-83.

### Step 5 · Delete rules on every FK — fix account erasure — S

* **Scope:** ADR-002. Re-create every FK that points at `dancers` (and their
  children) with the ownership rule (`CASCADE` / `SET NULL` + scrub / `RESTRICT`),
  added `NOT VALID` then validated; `auth.deleteAccount` shrinks to delete + scrub;
  a test asserts every FK to `dancers` has a rule (this is what silently broke
  erasure when `artist_follows` and `festival_waves` were added).
* **Tables:** all 26 tables with an FK to `dancers` (plus the production-only `follows`).
* **Backfill:** none.
* **Risk:** low — rules only matter on delete; reviewed per FK.
* **Rollback:** re-create the FKs as `NO ACTION`.
* **Stories:** RAZ-155.

### Step 6 · Payment hotfixes and the webhook ledger — M

* **Scope:** ADR-007, ahead of the full order model. `webhook_events` table; the
  Stripe webhook upgrades an existing sign-up (sets paid amount, session id,
  `verified_ticket_holder`) instead of treating the conflict as "done";
  `festivalSignup.myTickets` counts verified rows regardless of `paid_amount`
  (TicketTailor); referral credits are marked spent on payment, released on
  expiry; unique-violation detection by SQLSTATE.
* **Tables:** webhook_events (new), festival_signups, referrals.
* **Backfill:** find Stripe sessions in test mode whose payment never reached a
  sign-up (Stripe list API vs. `festival_signups.stripe_session_id`) and repair
  them; release credits held by expired sessions.
* **Risk:** medium (money paths); covered by the existing webhook tests plus the
  conflict case.
* **Rollback:** redeploy; the ledger table is additive.
* **Stories:** RAZ-110, RAZ-130, RAZ-247, RAZ-248, RAZ-99, RAZ-23.

## Relations

- Parent: RAZ-305

## Links

- [fix(db): baseline migration journal and reconcile schema with production](https://github.com/razbakov/wedance-2026/pull/346)

## Comments

### Linear · 2026-10-15 16:44 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-15 17:14 UTC

### 👀 Merged — ready for your review — Baseline migration journal — reconcile schema with production

**PR:** https://github.com/razbakov/wedance-2026/pull/346

Nothing to try — internal change (infra: database migration baseline — manual SQL steps required before deploy takes effect).
