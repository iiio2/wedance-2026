---
title: "RAZ-662 follow-up: fix flaky businessEvents integration tests"
type: Task
id: RAZ-667
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
created: 2026-10-22T23:32:22.771Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-667/raz-662-follow-up-fix-flaky-businessevents-integration-tests
exported: 2026-10-25
---

# RAZ-667 — RAZ-662 follow-up: fix flaky businessEvents integration tests

## Tension

3 integration tests in `server/trpc/routers/businessEvents.test.ts` fail intermittently — `Cannot read properties of undefined (reading 'id')` at lines 77, 86, 109. The tests create events then immediately list/find them, but the list returns empty.

## Driver

Flaky CI erodes confidence in the green/red signal and slows down merge gates.

## Requirement

The 3 businessEvents tests pass reliably on every CI run.

## Context

Surfaced during PR [https://github.com/razbakov/wedance-2026/pull/424](<https://github.com/razbakov/wedance-2026/pull/424>) gate (RAZ-662). The PR touched only `e2e/` files — the failures are pre-existing. Main's most recent run (39857837556) passed, confirming flakiness rather than a permanent break.

Failing tests:

* `only lets managers of the host profile edit` (line 77)
* `repeats weekly at the same local time across the clock change` (line 86)
* `shifts festival session dates when repeating` (line 109)
