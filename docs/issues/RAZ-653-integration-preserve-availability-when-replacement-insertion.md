---
title: "Integration: Preserve availability when replacement insertion fails"
type: Task
id: RAZ-653
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
created: 2026-10-20T19:18:37.420Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-653/integration-preserve-availability-when-replacement-insertion-fails
exported: 2026-10-25
---

# RAZ-653 — Integration: Preserve availability when replacement insertion fails

C6 integration suite. Verify previous availability remains intact when replacement insertion fails. Connected implementation: [RAZ-257](https://linear.app/alosha/issue/RAZ-257/raz-158-follow-up-booking-security-timezone-and-validation-hardening). Review existing tests first; candidate coverage gap.

## Relations

- Parent: RAZ-644

## Comments

### Linear · 2026-10-22 20:58 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-22 21:06 UTC

### 👀 Ready for your review — Transaction-safety test already merged in PR #416


Nothing to try — internal change (Integration test for availability transaction safety (RAZ-653) was shipped inside PR #416 (RAZ-644 parent batch). File: server/trpc/routers/booking.integration.test.ts:207-243. Two test cases: insert-failure rollback + successful replacement. All 5 tests pass on main.).
