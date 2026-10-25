---
title: "razbakov/wedance-2026 PR #401: fix(analytics): count magic-link sign-ups only for accounts that flow created"
type: Task
id: RAZ-634
status: in-progress
state: In Review
state_type: started
project: null
labels: []
assignee: null
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-20T14:47:34.557Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-634/razbakovwedance-2026-pr-401-fixanalytics-count-magic-link-sign-ups
exported: 2026-10-25
---

# RAZ-634 — razbakov/wedance-2026 PR #401: fix(analytics): count magic-link sign-ups only for accounts that flow created

Tracking issue for [https://github.com/razbakov/wedance-2026/pull/401](<https://github.com/razbakov/wedance-2026/pull/401>) (opened without a Linear issue). Merged → In Review; the Commander verifies the deploy and moves it to Done.

## Comments

### Forge · 2026-10-20 14:55 UTC

### 👀 Merged — ready for your review — Magic-link sign-ups now only count genuinely new accounts

**Live:** https://2026.wedance.vip
**PR:** https://github.com/razbakov/wedance-2026/pull/401

Nothing to try — internal change (Analytics fix — server-side signup_completed / server_signup_completed events no longer fire for returning passwordless or migrated users signing in via magic link).
