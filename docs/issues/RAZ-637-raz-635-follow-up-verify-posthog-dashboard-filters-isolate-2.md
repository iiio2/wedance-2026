---
title: "RAZ-635 follow-up: verify PostHog dashboard filters isolate 2026 data"
type: Task
id: RAZ-637
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
created: 2026-10-20T15:33:12.754Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-637/raz-635-follow-up-verify-posthog-dashboard-filters-isolate-2026-data
exported: 2026-10-25
---

# RAZ-637 — RAZ-635 follow-up: verify PostHog dashboard filters isolate 2026 data

The /open page (PR [https://github.com/razbakov/wedance-2026/pull/402](<https://github.com/razbakov/wedance-2026/pull/402>)) says 'the dashboard only counts traffic on [2026.wedance.vip](<http://2026.wedance.vip>)'. The PostHog project 29269 is shared with v4. Each dashboard tile should filter by app=wedance-2026 or by host. Verify all tiles before promoting the page.
