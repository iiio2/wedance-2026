---
title: "Automate C6 host and venue journey QA tests"
type: Task
id: RAZ-644
status: in-progress
state: In Review
state_type: started
project: "WeDance CUJ"
labels: ["qa","cuj:C6"]
assignee: "Vitali"
creator: "Vitali"
priority: "Medium"
estimate: null
parent: null
created: 2026-10-20T19:17:44.563Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/416"]
linear_url: https://linear.app/alosha/issue/RAZ-644/automate-c6-host-and-venue-journey-qa-tests
exported: 2026-10-25
---

# RAZ-644 — Automate C6 host and venue journey QA tests

Automate the 18 identified C6 test cases across unit, integration and E2E suites, following the WeDance test concept in [RAZ-268](https://linear.app/alosha/issue/RAZ-268/wedance-test-concept-qa-strategy-for-wedance-2026).

C6 covers hosting private events and booking venues. Existing booking unit tests must be reviewed before adding tests: unit and integration cases are candidate gaps, not confirmed missing tests. A C6 happy-path E2E gap is documented; current repository coverage has not been measured.

Run write-path E2E tests only against isolated test data, never shared production data. Keep anonymous booking requests supported; do not introduce a sign-in requirement. No payment tests are in scope.

## Relations

- Sub-issue: RAZ-662
- Sub-issue: RAZ-661
- Sub-issue: RAZ-660
- Sub-issue: RAZ-659
- Sub-issue: RAZ-658
- Sub-issue: RAZ-657
- Sub-issue: RAZ-656
- Sub-issue: RAZ-655
- Sub-issue: RAZ-654
- Sub-issue: RAZ-653
- Sub-issue: RAZ-652
- Sub-issue: RAZ-651
- Sub-issue: RAZ-650
- Sub-issue: RAZ-649
- Sub-issue: RAZ-648
- Sub-issue: RAZ-647
- Sub-issue: RAZ-646
- Sub-issue: RAZ-645

## Links

- [test(c6): automate host and venue journey QA tests](https://github.com/razbakov/wedance-2026/pull/416)

## Comments

### Linear · 2026-10-22 20:41 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-22 21:01 UTC

### 👀 Merged — ready for your review — C6 host & venue QA tests added — 21 new tests across integration and E2E

**PR:** https://github.com/razbakov/wedance-2026/pull/416

Nothing to try — internal change (test-only — no user-visible changes; adds integration and E2E test coverage for venue booking journey).
