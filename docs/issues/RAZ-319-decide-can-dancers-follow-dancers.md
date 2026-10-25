---
title: "Decide: can dancers follow dancers?"
type: Task
id: RAZ-319
status: in-progress
state: In Review
state_type: started
project: "WeDance Governance"
labels: ["commander"]
assignee: "Aleksey Razbakov"
creator: "Aleksey Razbakov"
priority: "High"
estimate: null
parent: "RAZ-305"
created: 2026-10-12T12:47:38.278Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-319/decide-can-dancers-follow-dancers
exported: 2026-10-25
---

# RAZ-319 — Decide: can dancers follow dancers?

## Do this

1. Read the recommendation below.
2. Reply in a comment, or move to Done with your answer — Forge picks it up.

## Decision

Needs your input. Options: allow dancer→dancer follows (friends, crews), or keep the v4 dancer follows parked and follow profiles only.

## Why it matters

v4 follow edges live in a prod-only `follows` table; 2026 only has artist_follows.

Context: [https://2026.wedance.vip/docs/architecture/decisions/004-identity-and-profile-ownership](<https://2026.wedance.vip/docs/architecture/decisions/004-identity-and-profile-ownership>)

Blocks: Phase 2 [RAZ-310](https://linear.app/alosha/issue/RAZ-310/wedance-arch-phase-2-identity-and-ownership) · Part of RAZ-305

## Relations

- Parent: RAZ-305

## Comments

### Aleksey Razbakov · 2026-10-12 15:21 UTC

Commander · decision 2026-10-12 (given in chat, recorded by Forge): **YES, dancers can follow dancers**, as recommended. A mutual follow means friends; one-way follows are allowed; a dancer's Going can be visible to friends only (ties to RAZ-313). Bring the v4 follow edges (prod-only `follows` table, 667 edges) into the one follow graph in Phase 2 step 15 (RAZ-310). The follow table must support dancer targets from day one, even if the screens ship later.

### Forge · 2026-10-17 02:30 UTC

### 👀 Merged — ready for your review — Real week socials, persisted RSVPs and discover swipes on /my-plan

**Live:** https://2026.wedance.vip/my-plan
**PR:** https://github.com/razbakov/wedance-2026/pull/377

**Try it**
1. Open https://2026.wedance.vip/my-plan
2. Scroll to 'This week' — you should see real local socials with RSVP buttons
3. Scroll to 'Widen your year' — swipe Yes/Skip on real dancers and events, decisions persist after reload
