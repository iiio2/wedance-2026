---
title: "Regression: 'Not sure which dance' link gone from city/festival dance-style chips; unify quick picks"
type: Task
id: RAZ-343
status: triage
state: Triage
state_type: triage
project: "WeDance CUJ"
labels: []
assignee: null
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-13T08:34:02.566Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-343/regression-not-sure-which-dance-link-gone-from-cityfestival-dance
exported: 2026-10-25
---

# RAZ-343 — Regression: 'Not sure which dance' link gone from city/festival dance-style chips; unify quick picks

**Tension**
On city and festival pages, the dance-style chips (Salsa, Bachata…) near the search used to have a 'Not sure which dance' link that opened a quick pick (e.g. 'as a beginner, try this class'). In the 2026-10-13 daily it was gone, probably broken by a later change. Also, Salsa, Bachata and Kizomba quick picks were split into separate tickets (RAZ-25/26/27) that behave differently.

**Driver**
Beginners landing on a city page need a one-click way in when they don't know which style to choose. Regressions need to be caught by tests, not by Alex in a daily.

**Requirement**

* The 'Not sure which dance' link is back on city and festival pages and opens the quick pick.
* Quick pick is one component with a single variable (dance style); every style behaves the same.
* A test covers the link's presence, so the next change that removes it fails CI.

**Response Options**

1. Find the commit that removed the link (git bisect), restore it, merge the per-style quick picks into one parametrized component, add a regression test (recommended).
2. Re-implement the link on top of the current chip component.

Source: [https://github.com/razbakov/wedance-org/blob/main/ops/sessions/2026-10-13-wedance-dev-daily.md](<https://github.com/razbakov/wedance-org/blob/main/ops/sessions/2026-10-13-wedance-dev-daily.md>)

## Comments

### Aleksey Razbakov · 2026-10-14 08:34 UTC

From the 2026-10-14 daily: the Salsa, Bachata and Kizomba quick peeks all work and are the same feature from the backend. Alex doesn't see why there are several tickets for it. The task is about beginner-friendly options for someone who hasn't picked a style yet, not any class in that style. Source: https://github.com/razbakov/wedance-org/blob/main/ops/sessions/2026-10-14-wedance-dev-daily.md
