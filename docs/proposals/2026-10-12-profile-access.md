---
status: proposal
created: 2026-10-12 15:20
---

# Profile access: claim, re-claim, join a team

Trigger: the Commander could not claim MontunoClub ("Already managed") because 226
v4-imported profiles carry `claimed = true` with no manager in 2026. Instead of patching
that one case, design for every way someone gets, shares, or loses access to a profile.

## The cases

| # | Situation | Who decides | Today |
|---|---|---|---|
| 1 | Nobody manages it, it's mine | WeDance admin | ✅ claim |
| 2 | Someone manages it, I want to **join the team** (Alex joins Javier's La Clave as promoter) | The profile's **owners** | ❌ blocked |
| 3 | Someone manages it, but **it's mine** (impostor, ex-partner, old employee) | WeDance admin (never the current owners) | ❌ blocked |
| 4 | I **lost access** (owner left, account gone) | WeDance admin | ❌ blocked |
| 5 | Owners **invite** someone directly | Owners | ❌ |
| 6 | Leave a team, remove someone, change a role, hand over ownership | Owners | ❌ |
| 7 | Owned in **v4** already | Automatic when the v4 owner has a 2026 account | ❌ |

## Model

**Roles** — what you may do (permission), separate from a public **title** ("Promoter",
"Resident DJ") shown on the team list:

| Role | Edit profile & events | Manage team | Remove profile |
|---|---|---|---|
| **Owner** | ✓ | ✓ | ✓ |
| **Editor** | ✓ | – | – |

Two roles are enough to start; add more only when a real team needs it. A profile always
keeps at least one owner (the last owner can't leave or be demoted).

**Requests** — one table for every "let me in" (`profile_claims` becomes
`profile_access_requests`): `kind` = `claim` (unmanaged) · `join` (managed, wants a role)
· `reclaim` (managed, says it's theirs); requested role, message / proof, status,
who decided and when.

- `claim`, `reclaim` → **admin** queue (`/admin/claims`). A reclaim that's approved can
  make the requester owner and remove or demote the others; the admin chooses.
- `join` → the **owners'** Home inbox in `/business` (admins can see and decide too).

**Invites** — owners invite by email with a role; the link works once and expires. If the
email has no account yet, the invite waits for sign-up.

**History** — every grant, removal, role change and ownership handover is logged (who, whom,
when, why), so a reclaim dispute can be judged on facts.

**"Managed" means** at least one `profile_members` row. `profiles.claimed` stays only as
"don't let the v3 sync overwrite this".

## What people see

- On a profile with no managers: **This is me** (claim).
- On a managed profile: **Join the team** (pick a role, say who you are) and, smaller,
  **This is my page — someone else has it** (reclaim, needs proof).
- `/business` → **Team** for each profile: members with role and title, pending join
  requests, Invite, Remove, Change role, Hand over ownership, Leave.
- Requester gets an email on every decision.

## v4 owners (case 7)

Match each v4 profile owner (`source_ref.v4ProfileId` → v4 user email) to a 2026 dancer by
email and grant owner. Run once as a script with a dry run first; owners without a 2026
account get the grant when they sign up.

## Order

1. Fix "managed" = has members (unblocks the 226 now). Small.
2. Requests with `kind` + Join the team + owners' approval in the Home inbox; Team section.
3. Reclaim (admin) + history log.
4. Invites by email.
5. v4 owner import.
