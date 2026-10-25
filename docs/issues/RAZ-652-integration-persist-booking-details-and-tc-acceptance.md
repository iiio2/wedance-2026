---
title: "Integration: Persist booking details and T&C acceptance"
type: Task
id: RAZ-652
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
created: 2026-10-20T19:18:37.259Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-652/integration-persist-booking-details-and-tandc-acceptance
exported: 2026-10-25
---

# RAZ-652 — Integration: Persist booking details and T&C acceptance

C6 integration suite. Persist booking date, area, headcount, message and T&C acceptance. Connected implementation: [RAZ-158](https://linear.app/alosha/issue/RAZ-158/booking-engine). Review existing tests first; candidate coverage gap.

## Relations

- Parent: RAZ-644

## Comments

### Linear · 2026-10-22 20:57 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-22 21:03 UTC

### 👀 Ready for your review — Tests already merged in PR #416, all 5 passing


Nothing to try — internal change (Integration tests for booking persistence (RAZ-652) were shipped as part of parent RAZ-644 in PR #416. 3 tests cover full-field round-trip, minimal booking nulls, and T&C timestamp accuracy. All pass.).
