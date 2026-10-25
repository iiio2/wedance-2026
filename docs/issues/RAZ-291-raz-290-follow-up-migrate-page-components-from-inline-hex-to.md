---
title: "RAZ-290 follow-up: migrate page components from inline hex to design tokens (batches of ~10 files, ~80 total)"
type: Task
id: RAZ-291
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
created: 2026-10-10T11:33:16.698Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-291/raz-290-follow-up-migrate-page-components-from-inline-hex-to-design
exported: 2026-10-25
---

# RAZ-291 — RAZ-290 follow-up: migrate page components from inline hex to design tokens (batches of ~10 files, ~80 total)

Phase 2 of the design system work. RAZ-290 (PR [https://github.com/razbakov/wedance-2026/pull/231](<https://github.com/razbakov/wedance-2026/pull/231>)) extracted tokens and migrated shared components. \~80 page files still use inline style hex values (\~2,500 occurrences, 87 distinct colours). Migrate in batches of \~10 files per PR, using the tokens defined in app/assets/css/tailwind.css.
