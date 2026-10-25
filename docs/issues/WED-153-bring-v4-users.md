---
title: "Bring v4 Users"
type: Story
id: WED-153
p: E801
source_github: "razbakov/wedance-2026#42"
linear_url: https://linear.app/wedance/issue/WED-153
audience: All
cuj: "C8 — Member — Belong & connect (onboard, account, partners, community, trust)"
jtbd: "J7 — Trust it's real — real people, real faces, no fakes"
status: built
wsjf_business_value: 8
wsjf_time_criticality: 8
wsjf_risk_opportunity: 8
wsjf_job_size: 8
wsjf: 3.0
origin: engineering-backlog (migrated from GitHub Issues 2026-07-16)
linear: RAZ-153
linear_state: Backlog
linear_prs: []
linear_url: https://linear.app/alosha/issue/RAZ-153/bring-v4-users
---

> Migrated from GitHub [razbakov/wedance-2026#42](https://github.com/razbakov/wedance-2026/issues/42) · tracked in Linear **WED-153** (https://linear.app/wedance/issue/WED-153).

**Original title:** Migrate existing v4 users into 2026 Neon DB (email+salt+hash)

## Tension
2026 now has email+password auth (ported v4's FirebaseScrypt), but existing WeDance/v4 users physically live in **v4's Postgres**, not 2026's Neon DB. Porting the scrypt verifier made their hashes *verifiable* — but there are no rows to verify against in 2026. Today a returning v4 user cannot log in to 2026; only brand-new signups work.

## Driver
For 2026 to replace v4 (and for the migrated feature set — cities video voting, my-plan, festivals — to have a real user base rather than starting from zero), the existing user accounts must exist in 2026's database so people log in with the credentials they already have.

## Requirement
- Copy existing users from v4's Postgres into 2026's Neon `dancers` table: at minimum `email`, `salt`, `hash`, `name` (map v4 `firstName`/`lastName` → 2026 `name`), and `createdAt`.
- Verify a migrated user can log in to 2026 with their **existing v4 password** end-to-end (scrypt verify against the copied salt/hash, session mints).
- Idempotent + re-runnable: safe to run more than once (upsert on email, no dupes).
- Preserve `isAdmin` where it maps.
- Decide + document handling of: users with no password (OAuth-only in v4), duplicate emails, and profile data not modeled in 2026 (defer, don't drop silently).
- Zero data loss on either DB; the v4 DB is read-only in this job.

## Response Options
1. **One-off migration script** (`server/scripts/migrate-v4-users.ts`) that reads v4 Postgres (read-only conn string) and upserts into Neon in batches. Run once at cutover, re-runnable for stragglers. — simplest, recommended.
2. **Dual-read fallback at login**: on failed 2026 lookup, check v4 and lazily copy the row on first successful login. — spreads migration over time, no big-bang, but keeps a v4 DB dependency alive.
3. **Full ETL** of users + profiles + related data. — only if 2026 grows a profile model that needs it; overkill now.

Prereqs: read-only connection string to v4's Postgres; confirm the `FIREBASE_SALT_SEPARATOR`/`FIREBASE_SIGNER_KEY` in 2026 match v4's (already copied). Blocks: none (auth is live in prod as of 2026-07-04).

## Linear history — RAZ-153 (Backlog, exported 2026-10-25)

Exported from https://linear.app/alosha/issue/RAZ-153/bring-v4-users on 2026-10-25.

<details><summary>Description, links and comments as they stood in Linear</summary>

> Migrated from GitHub [razbakov/wedance-2026#42](<https://github.com/razbakov/wedance-2026/issues/42>)

**Migrate existing v4 users into 2026 Neon DB (email+salt+hash)**

## Tension

2026 now has email+password auth (ported v4's FirebaseScrypt), but existing WeDance/v4 users physically live in **v4's Postgres**, not 2026's Neon DB. Porting the scrypt verifier made their hashes *verifiable* — but there are no rows to verify against in 2026. Today a returning v4 user cannot log in to 2026; only brand-new signups work.

## Driver

For 2026 to replace v4 (and for the migrated feature set — cities video voting, my-plan, festivals — to have a real user base rather than starting from zero), the existing user accounts must exist in 2026's database so people log in with the credentials they already have.

## Requirement

* Copy existing users from v4's Postgres into 2026's Neon `dancers` table: at minimum `email`, `salt`, `hash`, `name` (map v4 `firstName`/`lastName` → 2026 `name`), and `createdAt`.
* Verify a migrated user can log in to 2026 with their **existing v4 password** end-to-end (scrypt verify against the copied salt/hash, session mints).
* Idempotent + re-runnable: safe to run more than once (upsert on email, no dupes).
* Preserve `isAdmin` where it maps.
* Decide + document handling of: users with no password (OAuth-only in v4), duplicate emails, and profile data not modeled in 2026 (defer, don't drop silently).
* Zero data loss on either DB; the v4 DB is read-only in this job.

## Response Options

1. **One-off migration script** (`server/scripts/migrate-v4-users.ts`) that reads v4 Postgres (read-only conn string) and upserts into Neon in batches. Run once at cutover, re-runnable for stragglers. — simplest, recommended.
2. **Dual-read fallback at login**: on failed 2026 lookup, check v4 and lazily copy the row on first successful login. — spreads migration over time, no big-bang, but keeps a v4 DB dependency alive.
3. **Full ETL** of users + profiles + related data. — only if 2026 grows a profile model that needs it; overkill now.

Prereqs: read-only connection string to v4's Postgres; confirm the `FIREBASE_SALT_SEPARATOR`/`FIREBASE_SIGNER_KEY` in 2026 match v4's (already copied). Blocks: none (auth is live in prod as of 2026-07-04).

---

*Status: the v4→2026 user migration was executed and verified this session (real users/profiles now in the 2026 Neon DB).*

</details>
