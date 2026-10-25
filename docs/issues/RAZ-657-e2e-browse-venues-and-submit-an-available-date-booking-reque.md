---
title: "E2E: Browse venues and submit an available-date booking request"
type: Task
id: RAZ-657
status: in-progress
state: In Review
state_type: started
project: "WeDance CUJ"
labels: []
assignee: "Vitali"
creator: "Vitali"
priority: "No priority"
estimate: null
parent: "RAZ-644"
created: 2026-10-20T19:18:38.039Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/420"]
linear_url: https://linear.app/alosha/issue/RAZ-657/e2e-browse-venues-and-submit-an-available-date-booking-request
exported: 2026-10-25
---

# RAZ-657 — E2E: Browse venues and submit an available-date booking request

C6 E2E suite — minimum documented happy-path gap. Browse venues, select an available date, accept T&C and receive request-sent confirmation. Connected implementation: [RAZ-135](https://linear.app/alosha/issue/RAZ-135/request-a-date) and [RAZ-158](https://linear.app/alosha/issue/RAZ-158/booking-engine). Use isolated test data only, never shared production data. Do not introduce a sign-in requirement for public booking requests.

## Relations

- Parent: RAZ-644

## Links

- [test(e2e): browse venues and submit booking request (RAZ-657)](https://github.com/razbakov/wedance-2026/pull/420)

## Comments

### Linear · 2026-10-22 21:07 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-22 21:20 UTC

### 👀 Merged — ready for your review — E2E test for venue booking request happy path

**PR:** https://github.com/razbakov/wedance-2026/pull/420

Nothing to try — internal change (test-only: new E2E scenario covering venue browse → booking form → confirmation).
