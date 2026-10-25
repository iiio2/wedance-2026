---
title: "RAZ-121 follow-up: fix double URL-encoding in hotel search link"
type: Task
id: RAZ-296
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
created: 2026-10-10T19:20:55.322Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-296/raz-121-follow-up-fix-double-url-encoding-in-hotel-search-link
exported: 2026-10-25
---

# RAZ-296 — RAZ-121 follow-up: fix double URL-encoding in hotel search link

In festivals/\[slug\].vue:719-720, encodeURIComponent is called before passing loc to URLSearchParams, which encodes again. Remove the manual encodeURIComponent so the location is encoded only once. From PR [https://github.com/razbakov/wedance-2026/pull/239](<https://github.com/razbakov/wedance-2026/pull/239>) (CodeRabbit review).
