---
title: Security hygiene — hashed tokens, verified email, server-owned sessions, guarded public writes
status: proposed
date: 2026-10-12
---

## Context

The auth layer was ported from wedance-v4 for continuity (FirebaseScrypt hashes
verify unchanged — `docs/data-migration-plan.md` §0). The port kept v4's weak
spots and added a few. Evidence, without exploitation detail:

- **Secrets stored in plaintext.** `dancers.magic_token` (`schema.ts:41`) and
  `sessions.token` (`schema.ts:49`) hold the bearer secrets themselves; the request
  context compares them directly (`server/trpc/context.ts:32-40`). A read-only
  database leak (backup, log, a preview deploy — see ADR-001) is an account
  takeover for every active session.
- **Magic-link requests change existing accounts.** `auth.requestMagicLink` is
  public and upserts on email, overwriting `name`, `dance_styles`, `role` and
  `city` of an existing dancer before anyone proves they own the address
  (`routers/auth.ts:73-96`).
- **Email is trusted but never verified.** `auth.register` creates a password
  account for any address without confirmation (`auth.ts:248-325`), yet the email
  is treated as proof of identity: the TicketTailor webhook links paid orders to
  the dancer with that email (`api/webhooks/tickettailor.lib.ts:137-142`) and
  `claim.claimMyTicketHolderRows` hands ticket rows to whoever is signed in with a
  matching email (`routers/claim.ts:46-57`). There is no `email_verified_at`.
- **Login and reset share one token.** Any magic token can also set a new password
  (`auth.ts:161-200`); there is no purpose on the token.
- **Salts come from `Math.random`.** `auth.ts:189`, `274`, `350` build the salt from
  a few digits of `Math.random()` — not a CSPRNG, low entropy.
- **Sessions are client-owned.** The session token lives in a cookie written by
  client-side JavaScript (`app/plugins/01.trpc.ts:22-26`), so it cannot be
  `HttpOnly` and any XSS can read it. Signing out only clears the browser
  (`app/composables/useAuth.ts:349-350`); there is no server-side sign-out in
  `authRouter`, and neither `resetPassword` nor `changePassword` revokes existing
  sessions (`auth.ts:194-199`, `352`).
- **Unauthenticated upload.** `POST /api/media/image` accepts any multipart file
  from anyone and stores it on Cloudinary with no size or type check
  (`server/api/media/image.post.ts:4-38`; tracked as RAZ-288).
- **No rate limits on public writes.** `auth.login`, `auth.requestMagicLink`
  (sends email), `feedback.report` (accepts a 6.5 MB screenshot and files a Linear
  issue, `feedback.ts:169`), `feedback.inquiry`, `booking.request`,
  `festival.submitDraft`, `giveaway.enter` and `cityVideo.submit` are public
  mutations with no throttling.
- **PII in public responses.**
  - `gigs.list` returns whole rows including `contact_email` (`gigs.ts:20-41`).
  - `booking.scheduleForProfile` and `booking.getEvent` return the requester's
    name and private message (`booking.ts:72`, `130-131`).
  - `rideShare.list` and `roommate.list` list dancers regardless of
    `profile_public` (`rideShare.ts:18-42`, `roommate.ts:31-53`).
  - `plan.discover` shows which festivals other dancers plan even when they did
    not opt in to being listed (`plan.ts:563-646` has no `share_going` filter,
    unlike `goingList` at `177`).
  - `claim.getClaimStatus` tells anyone whether an email address holds a ticket
    (`claim.ts:103-140`).

## Options

1. **Patch each hole in place** (salt fix, a size check, a `where` clause). Needed
   anyway, but leaves the model (plaintext secrets, client-owned sessions,
   unverified email) intact.
2. **Adopt a hosted auth provider** (the dormant `dancers.neon_auth_id`,
   `schema.ts:15`, points at Neon Auth). Solves sessions and verification, but
   breaks password continuity for 2,339 migrated v4 hashes unless every user
   resets, and it is a product decision (social login, map:meetup-2.4).
3. **Harden the existing auth model**: hashed single-purpose tokens, verified
   email as a gate, server-owned `HttpOnly` sessions with revocation, CSPRNG
   salts, guarded public writes, explicit output shapes.

## Decision

Option 3 now; option 2 stays possible later because the session and token tables
below are provider-agnostic.

- **`auth_tokens`** replaces `dancers.magic_token*`: `id`, `dancer_id` (nullable for
  sign-up), `email`, `purpose` (`login` · `reset_password` · `verify_email`),
  `token_hash bytea` (SHA-256 of 32 random bytes; the raw token only ever appears
  in the email link), `payload jsonb` (sign-up fields for a not-yet-existing
  account), `expires_at`, `used_at`. Consuming a token is a single
  `UPDATE … SET used_at = now() WHERE token_hash = $1 AND used_at IS NULL AND expires_at > now() RETURNING …`.
  Requesting a link **never** writes to `dancers`; profile fields from the request
  are applied only when the token is consumed.
- **`dancers.email_verified_at timestamptz`.** Set when a `login` or `verify_email`
  token is consumed; backfilled for v4 users whose v4 record was verified and for
  dancers who already signed in via magic link. Password registration sends a
  `verify_email` token. **Verified email is required** for webhook auto-linking
  (otherwise the row stays an unclaimed stub) and for claiming ticket rows.
- **`sessions.token_hash bytea`** replaces `sessions.token`; add `last_seen_at`,
  `revoked_at`, `user_agent`. The server sets the session cookie (`HttpOnly`,
  `Secure`, `SameSite=Lax`) from the auth mutations; `auth.signOut` revokes the
  row; password reset/change revokes all other sessions. The `Authorization:
  Bearer` header stays accepted for one release while clients move to the cookie.
  Existing plaintext sessions are hashed in place (expand: add `token_hash`,
  backfill `sha256(token)`, read by hash, then drop `token`), so nobody is signed
  out.
- **Salts from `crypto.randomBytes(16)`**. FirebaseScrypt parameters stay identical
  so v4 hashes keep verifying.
- **Upload** becomes protected, capped at 5 MB, accepts only `image/jpeg`,
  `image/png`, `image/webp` (sniffed, not trusted from the header) and uploads into
  a per-dancer folder.
- **Rate limits** via one tRPC middleware backed by a Postgres table
  `rate_limits(key text, window_start timestamptz, hits int, PRIMARY KEY (key, window_start))`
  and a single `INSERT … ON CONFLICT DO UPDATE SET hits = hits + 1 RETURNING hits`.
  No new infrastructure. Keys combine procedure, client IP and, for auth, the
  email.
- **Public outputs are explicit and privacy-filtered.** No `select()` of whole rows
  in public procedures (ADR-011). One shared predicate decides whether a dancer may
  appear in any public list (`profile_public` and the per-event visibility of
  ADR-008); `getClaimStatus` is removed (the claim page asks the signed-in user).
- **Previews never see production** (ADR-001).

```mermaid
erDiagram
  dancers ||--o{ sessions : "has (CASCADE)"
  dancers |o--o{ auth_tokens : "requests (CASCADE)"
  sessions {
    uuid id PK
    uuid dancer_id FK
    bytea token_hash UK
    timestamptz expires_at
    timestamptz revoked_at
  }
  auth_tokens {
    uuid id PK
    text purpose "login, reset_password, verify_email"
    bytea token_hash UK
    jsonb payload
    timestamptz expires_at
    timestamptz used_at
  }
```

## Consequences

- A leaked database no longer yields usable sessions or links.
- Dancers who registered with a password but never verified their email must
  verify before their purchased tickets attach to the account; the UI explains it.
- One more round trip on magic-link sign-up (account created on consume, not on
  request).
- Some public pages lose data they showed before (gig contact email moves behind
  "Apply", booking messages stay with the venue).

## Stories unblocked

RAZ-275 and RAZ-288 (safe photo upload), RAZ-241 (reset with a purpose-bound
token), map:meetup-2.1-sign-up, RAZ-83 (verified ticket claims), RAZ-155
(sign-out and erasure revoke sessions).
