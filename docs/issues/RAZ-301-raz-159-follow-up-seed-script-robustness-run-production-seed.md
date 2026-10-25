---
title: "RAZ-159 follow-up: seed script robustness + run production seed"
type: Task
id: RAZ-301
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
created: 2026-10-11T13:31:14.785Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-301/raz-159-follow-up-seed-script-robustness-run-production-seed
exported: 2026-10-25
---

# RAZ-301 — RAZ-159 follow-up: seed script robustness + run production seed

From PR [https://github.com/razbakov/wedance-2026/pull/272](<https://github.com/razbakov/wedance-2026/pull/272>) — CodeRabbit review comments + post-merge action:

1. **Run seed against production**: `bun seed:pinakothek --write` must run once post-merge to create the venue profile. The /for-events showcase card links to /@pinakothek-der-moderne — it 404s until the seed runs. (app/pages/for-events.vue:142)
2. **Area-seeding deduplication**: Both area-seeding loops (existing-profile and bare-profile paths) use `areas.length` as starting index instead of checking which area names already exist. Could create duplicates if re-run after partial seed. (scripts/seed-pinakothek.ts:106-109)
3. **Completeness check missing bookingModel**: The existing-profile query checks `guidelines` but not `bookingModel`, so a profile with `bookingModel: 'commercial'` won't get corrected to `'free'`. (scripts/seed-pinakothek.ts:90)
4. **Type safety nitpick**: `bookingModel: 'free'` widens to string — add `as const`. (scripts/seed-pinakothek.ts:55)
