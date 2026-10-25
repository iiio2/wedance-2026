---
title: "Talk to us widget: real reports fail with 'Internal server error' (500)"
type: Task
id: RAZ-618
status: in-progress
state: In Review
state_type: started
project: "WeDance Support"
labels: ["user-report"]
assignee: "Aleksey Razbakov"
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-18T14:51:52.755Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/394"]
linear_url: https://linear.app/alosha/issue/RAZ-618/talk-to-us-widget-real-reports-fail-with-internal-server-error-500
exported: 2026-10-25
---

# RAZ-618 — Talk to us widget: real reports fail with 'Internal server error' (500)

**Tension:** Every real Report a problem / Share an idea submission since 2026-10-17 18:40 returned HTTP 500 'Internal server error' (6 attempts on Vercel logs: 10-17 18:40 ×2, 10-18 16:42–16:44 ×4). Nothing lands in WeDance Support.

**Driver:** The widget is the only channel users have to reach us; a silent failure loses every report.

**Findings:** Linear key, team, Support project, labels and triage state are all valid. Synthetic submissions all succeed (anon, signed-in via createCaller, idea, bug, 3 MB screenshot, 30 long console errors, NUL/surrogate chars — RAZ-609..617, test tickets to cancel). >4.5 MB bodies give 413, not 500. The server logs nothing for the 500 (tRPC handler has no onError), so the real cause is invisible.

**Requirement:** (1) A report always lands — if issueCreate fails, retry with a minimal payload and keep the full context as a comment. (2) The real error is logged server-side so the root cause is visible in Vercel logs.

## Links

- [fix(feedback): Talk to us reports never get lost; log tRPC 500s (RAZ-618)](https://github.com/razbakov/wedance-2026/pull/394)

## Comments

### Forge · 2026-10-18 14:58 UTC

### 👀 Merged — ready for your review — Talk to us widget reports never lost; server 500s now logged

**Live:** https://2026.wedance.vip
**PR:** https://github.com/razbakov/wedance-2026/pull/394

**Try it**
1. Open https://2026.wedance.vip
2. Click the 'Talk to us' widget
3. Submit a report — it should succeed without error
