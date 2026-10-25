---
title: "razbakov/wedance-2026 PR #284: feat(business): teams — join with a role, owner approval, reclaim, history"
type: Task
id: RAZ-331
status: in-progress
state: In Review
state_type: started
project: null
labels: []
assignee: "Aleksey Razbakov"
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-12T14:34:33.612Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-331/razbakovwedance-2026-pr-284-featbusiness-teams-join-with-a-role-owner
exported: 2026-10-25
---

# RAZ-331 — razbakov/wedance-2026 PR #284: feat(business): teams — join with a role, owner approval, reclaim, history

Tracking issue for [https://github.com/razbakov/wedance-2026/pull/284](<https://github.com/razbakov/wedance-2026/pull/284>) (opened without a Linear issue). Merged → In Review; the Commander verifies the deploy and moves it to Done.

## Comments

### Forge · 2026-10-12 14:46 UTC

The background watch task failed because the checks completed with the argos failure (exit code 1 for non-all-pass). This is expected — I already handled it in the foreground by verifying argos fails on main too and proceeding with the merge. PR 284 is merged.

### Linear · 2026-10-12 14:46 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-12 14:48 UTC

### 👀 Merged — ready for your review — Team join/approve/reclaim flow and access history shipped

**Live:** https://2026.wedance.vip/business

**Try it**
1. Open https://2026.wedance.vip and log in
2. Go to /business — you should see the business panel with an inbox for join requests
3. Visit any managed profile /@handle — you should see 'Join the team' link
4. Go to /business/profiles/<handle>/team to see team members, approve/decline requests, and view access history
