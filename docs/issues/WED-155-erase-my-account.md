---
title: "Erase My Account"
type: Story
id: WED-155
p: E803
source_github: "razbakov/wedance-2026#48"
linear_url: https://linear.app/wedance/issue/WED-155
audience: All
cuj: "C8 — Member — Belong & connect (onboard, account, partners, community, trust)"
jtbd: "J7 — Trust it's real — real people, real faces, no fakes"
status: not-built
wsjf_business_value: 5
wsjf_time_criticality: 8
wsjf_risk_opportunity: 8
wsjf_job_size: 5
wsjf: 4.2
origin: engineering-backlog (migrated from GitHub Issues 2026-07-16)
linear: RAZ-155
linear_state: Done
linear_prs: ["https://github.com/razbakov/wedance-2026/pull/235","https://github.com/razbakov/wedance-2026/pull/217","https://github.com/razbakov/wedance-2026/pull/95"]
linear_url: https://linear.app/alosha/issue/RAZ-155/erase-my-account
---

> Migrated from GitHub [razbakov/wedance-2026#48](https://github.com/razbakov/wedance-2026/issues/48) · tracked in Linear **WED-155** (https://linear.app/wedance/issue/WED-155).

**Original title:** Account deletion (GDPR right to erasure) with FK-safe cascade

## Tension
Settings lets a dancer edit their profile and change password, but there's no way to **delete their account**. GDPR (German platform) grants a right to erasure.

## Driver
Legal requirement + user trust. Deletion is non-trivial: `dancers` is referenced by `sessions`, `cityVideos`, `festivalSignups`, `dinnerSignups`, `videoVotes` (voterDancerId) — a naive delete hits FK violations.

## Requirement
- `auth.deleteAccount` (protected): remove/anonymize the dancer and all referencing rows in FK-safe order (or null out where the row should survive, e.g. keep an approved video as anonymous).
- A 'Danger zone' in /settings with a confirm step.
- Session invalidated; user signed out.
- Documented what's hard-deleted vs anonymized.

## Response Options
1. Cascade delete in dependency order (recommended).
2. Soft-delete / anonymize (keep rows, scrub PII).

Related: #45, #46.

## Linear history — RAZ-155 (Done, exported 2026-10-25)

Exported from https://linear.app/alosha/issue/RAZ-155/erase-my-account on 2026-10-25.

<details><summary>Description, links and comments as they stood in Linear</summary>

> Migrated from GitHub [razbakov/wedance-2026#48](<https://github.com/razbakov/wedance-2026/issues/48>)

**Account deletion (GDPR right to erasure) with FK-safe cascade**

## Tension

Settings lets a dancer edit their profile and change password, but there's no way to **delete their account**. GDPR (German platform) grants a right to erasure.

## Driver

Legal requirement + user trust. Deletion is non-trivial: `dancers` is referenced by `sessions`, `cityVideos`, `festivalSignups`, `dinnerSignups`, `videoVotes` (voterDancerId) — a naive delete hits FK violations.

## Requirement

* `auth.deleteAccount` (protected): remove/anonymize the dancer and all referencing rows in FK-safe order (or null out where the row should survive, e.g. keep an approved video as anonymous).
* A 'Danger zone' in /settings with a confirm step.
* Session invalidated; user signed out.
* Documented what's hard-deleted vs anonymized.

## Response Options

1. Cascade delete in dependency order (recommended).
2. Soft-delete / anonymize (keep rows, scrub PII).

Related: #45, #46.

## Links

- [fix(auth): restrict giveaway email fallback to dancerId-null rows](https://github.com/razbakov/wedance-2026/pull/235)
- [fix(auth): complete FK-safe account deletion (GDPR erasure)](https://github.com/razbakov/wedance-2026/pull/217)
- [feat: GDPR account deletion with FK-safe cascade (RAZ-155)](https://github.com/razbakov/wedance-2026/pull/95)

## Comments

### Aleksey Razbakov · 2026-09-28 14:42 UTC

Merge gate · RED · PR https://github.com/razbakov/wedance-2026/pull/95 · head 620369f
Main-branch short-circuit: main has been red since 478c837 (#99, RAZ-126). The Vercel production build fails with `[@vue/compiler-sfc] Failed to resolve extends base type` in app/components/ui/button/Button.vue (dpl_Gp5HbCrLMqexhBdxg5yVPXTXdECn). No PR on this repo can pass checks 1 and 6 until that's fixed (tracked in RAZ-203). The gate did not run evidence or a ruling.
1 CI — red — main is red
2 Threads — not evaluated
3 Commander comments — not evaluated
4 Requirement — not evaluated
5 Conventions — not evaluated
6 Deploy — red — main build broken
7 Carve-outs — not evaluated. Heads-up for the real ruling: "Erase My Account" deletes user data. The gate will check whether it touches the privacy policy or other legally constrained claims.
Issue stays In Progress. The gate re-runs on this PR once main is green or the head SHA changes.

### Aleksey Razbakov · 2026-09-28 17:21 UTC

Merge gate · RED · PR https://github.com/razbakov/wedance-2026/pull/95 · head 620369f
1 CI — red — GitHub statuses are green, but CodeRabbit hit its rate limit, so its pass carries no review. The repo has no Actions workflows. A clean local `bun run test` passed 114/114 tests, but 2 files fail (admin.test.ts, dinner.test.ts) because DATABASE_URL is unset. No test covers deleteAccount.
2 Threads — red — 5 P1 threads are unresolved, and /code-review confirmed all 5 independently.
3 Commander comments — green — there are no human Commander comments on the issue.
4 Requirement — red — FK-safe removal → server/trpc/routers/auth.ts:406-441. It fails for past moderators: guideline_versions.moderator_dancer_id (schema.ts:456) is never nulled. It also fails for candidates who received votes (auth.ts:411). The writes are not atomic, and tickettailor_buyer_email and submitted_by_email are never cleared (auth.ts:425-428). · Danger zone → app/pages/settings.vue:271-317, but it can't be used: :313 compares against `dancerName.value`, which is undefined, so the button stays disabled and the placeholder shows "Type: undefined". · Session invalidated → useAuth.ts, but that code is never reached. · Hard-deleted vs anonymized documented → settings.vue:276 and the PR body, but the claim is partly false because the emails remain.
5 Conventions — red — the PR body has the "Generated with Claude Code" attribution.
6 Deploy — blocked (counts as red) — the dispatched agent's "Danger zone visible" claim was false: it fetched the production alias (wedance-2026.vercel.app), which does not contain "Danger zone". The real branch preview (wedance-2026-5gig5nlef-wedance.vercel.app/settings) redirects to Vercel SSO.
7 Carve-outs — **RESERVED: legally constrained public claims.** The UI states what is permanently deleted and what is anonymized under GDPR erasure. Once checks 1–6 are green, this PR is HELD for the Commander, not merged by an agent.
Needed: fix the 5 P1 defects (unwrap the ref, null moderator_dancer_id, handle incoming candidate_id votes and winnerCandidateId, one atomic transaction, clear both email columns); resolve the threads; add deletion-order and rollback tests; remove the attribution; verify the Danger zone on the real branch preview (needs a Vercel bypass); then hold for the Commander.
PR comment: https://github.com/razbakov/wedance-2026/pull/95#issuecomment-5875043495
The issue stays In Progress, and the fix continues on the same branch.

### Aleksey Razbakov · 2026-09-28 17:40 UTC

Fix dispatched for 620369f

### Aleksey Razbakov · 2026-09-29 23:53 UTC

Merge gate · RED · PR https://github.com/razbakov/wedance-2026/pull/95 · head 6090ced
1 CI — RED: Vercel passes. CodeRabbit was rate-limited and never reviewed. The build exits 0, but `bun run test` exits 1 (admin.test.ts and dinner.test.ts need DATABASE_URL). The deleteAccount tests use a FakeDb, which misses the wrong-column defect.
2 Threads — RED: 5 unresolved (auth.ts:431, :456, :462, :480; settings.vue:281).
3 Commander comments — green: none posted since the last gate.
4 Requirement — RED:
- auth.ts:431 filters on `electionVoteHistory.candidateId`, which doesn't exist (schema.ts:438-447 has only from/toCandidateId). Deletion fails with a 500 for any candidate.
- auth.ts:475-480 clears festivalSignups/cityVideos emails only by dancerId, so email-only rows keep the address.
- festivalSubmissions rows that carry only the user's email survive (schema.ts:374).
- settings.vue:281 says recommendations are anonymized, but the code deletes them.
5 Conventions — green: summary and "Fixes RAZ-155" present; no Test plan; no AI attribution.
6 Deploy — RED: the preview /settings serves the Vercel SSO login page (HTTP 200), so the content isn't verified.
7 Carve-outs — RESERVED (legally constrained public claims), re-affirmed: the page tells users what is erased and what is anonymized under GDPR. It's held for the Commander even once 1–6 are green.
Needed: fix the four check-4 defects; resolve the 5 threads; add a test that fails on a wrong column; get a green suite (or run it with DATABASE_URL set); get preview evidence past Vercel protection. Continue on the same branch.
PR comment: https://github.com/razbakov/wedance-2026/pull/95#issuecomment-5901284943
Issue stays In Progress.

### Aleksey Razbakov · 2026-09-30 00:41 UTC

Fix dispatched for 6090ced

### Aleksey Razbakov · 2026-09-30 00:51 UTC

Dispatcher (fix lane, attempt 2 of 2): fix pushed to https://github.com/razbakov/wedance-2026/pull/95. New head **d1e0fe0** (was 6090ced). Routed Matrix → Neo.

**What the dispatcher checked itself:**
- Head d1e0fe0 is confirmed with gh, and the PR is open. The diff touches `useAuth.ts`, `settings.vue`, `auth.ts` and `auth.test.ts`. There is no `@vue-ignore` and no lockfile churn.
- CI statuses on d1e0fe0: CodeRabbit, Vercel and Vercel Preview Comments all report SUCCESS.
- PR body: no Test plan section and no AI attribution.
- **Review threads: 4 are UNRESOLVED (GraphQL).** The agent reported "all GREEN", which is false.
  - 2 are older Codex P1s: scrubbing posterName and other fields when anonymizing gigs (auth.ts ~470), and including every public email-only submission (giveaway, booking) in erasure.
  - 2 are **new** Codex P1s on this head: clearing the denormalized moderator identity that `election.close` copies, and matching email-only submissions case-insensitively.

**Agent's claims, not verified:**
- The agent says it fixed the four defects the gate listed: fromCandidateId/toCandidateId, email-matched scrubbing on festivalSignups/cityVideos/festivalSubmissions, and settings copy that now says recommendations are "permanently deleted".
- The agent ran only `bun run test -- auth.test.ts` (24 passed, exit 0) and `bun run build` (exit 0). **The full suite was not run.** This PR does not touch admin.test.ts or dinner.test.ts, so a bare `bun run test` very likely still exits 1 on DATABASE_URL. The RAZ-33 PR #107 adds the skipIf fix for that.
- "Deploy verified" in the agent's report refers only to the Vercel status. The branch preview is still behind Vercel SSO, so check 6 is still blocked.

**Reserved class** (legally constrained public claims): held for the Commander even when checks 1–6 are green.

Both fix attempts are now used. If the gate rules RED again, the fix lane is exhausted. The issue stays In Progress. Not merged.

### Aleksey Razbakov · 2026-09-30 01:24 UTC

Merge gate · RED · PR https://github.com/razbakov/wedance-2026/pull/95 · head d1e0fe0
1 CI — red. The gh checks are green (CodeRabbit, Vercel, Vercel Preview Comments). But the repo suite, run from a clean worktree at d1e0fe0 without DATABASE_URL, fails: `bun run test` exits 1. 2 files fail (admin.test.ts and dinner.test.ts, "DATABASE_URL required for tests"), 12 pass, 120 tests pass. The branch lacks main's skipIf fix. Agent's "135 pass, no failures" did not reproduce.
2 Threads — red. 4 unresolved, non-outdated Codex P1 threads, all confirmed in code:
- auth.ts:470: gig anonymization nulls only dancerId, so posterName/contactEmail/contactUrl survive.
- auth.ts:476: email-only rows (dancerId null, email matches) are not erased.
- auth.ts:484: profiles.moderatorName/moderatorHandle are not cleared.
- auth.ts:500: the festivalSubmissions email match is a case-sensitive eq.
3 Commander comments — green. No human Commander comments; all are dispatcher or gate posts.
4 Requirement:
- (a) red: auth.deleteAccount in server/trpc/routers/auth.ts leaves identity in gigs, email-only rows and moderator fields (see 2).
- (b) present in app/pages/settings.vue (Danger zone + confirm), but not verified rendered.
- (c) sessions are deleted in the same batch (auth.ts), with signout in app/composables/useAuth.ts. Code only, not verified live.
- (d) red: the PR body and settings copy say gigs/videos have "identity removed", but name and email survive.
5 Conventions — red. The PR body is OK (summary, links, "Fixes RAZ-155", no Test plan). But 3 commits carry "Co-Authored-By: Claude Haiku 4.5" trailers; Agent reported none.
6 Deploy — blocked, counted as red. Preview /settings → 302 Vercel SSO → login page. No evidence that the Danger zone renders.
7 Carve-outs — RESERVED: legally constrained public claims (GDPR erasure copy). HOLD for the Commander even once 1–6 are green.
Needed:
- Rebase onto main (skipIf fix) so `bun run test` exits 0.
- Fix all 4 P1 threads, each with a test that fails without the fix, then resolve the threads.
- Correct the (d) copy to match behaviour.
- Squash message without AI trailers.
- Preview evidence past Vercel protection (a bypass token, or an authenticated fetch showing the Danger zone).
Non-blocking: candidate deletion wipes other dancers' votes and closed-election winners (anonymize instead); the outer catch turns NOT_FOUND into a 500 (rethrow TRPCError).
PR comment: https://github.com/razbakov/wedance-2026/pull/95#issuecomment-5902213027
Both fix-lane attempts are used, so the issue moves to **Backlog** for a fresh dispatch. It does not go to Todo. Say ok to re-dispatch.

### Linear · 2026-10-01 11:31 UTC

This thread is for an agent session with forge.

### Tobiloba · 2026-10-09 11:36 UTC

@razbakov.aleksey  I'm also having issues with this . When I click 'delete permanently ' it returns "Could not delete your account. Please try again or contact support"

### Aleksey Razbakov · 2026-10-09 14:26 UTC

@forge

### Aleksey Razbakov · 2026-10-09 14:26 UTC

@forge

### Forge · 2026-10-09 14:44 UTC

### 👀 Merged — ready for your review — Account deletion fixed — all FK tables handled, GDPR leaks plugged

**Live:** https://2026.wedance.vip/settings
**PR:** https://github.com/razbakov/wedance-2026/pull/217

**Try it**
1. Open https://2026.wedance.vip/settings
2. Scroll to Danger Zone
3. Click Delete Account and confirm
4. You should see account deleted and be signed out

**Follow-ups:** RAZ-286

</details>
