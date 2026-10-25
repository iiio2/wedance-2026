---
title: "Integration: Repeat showcase seeding without duplicate areas"
type: Task
id: RAZ-654
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
created: 2026-10-20T19:18:37.571Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/419"]
linear_url: https://linear.app/alosha/issue/RAZ-654/integration-repeat-showcase-seeding-without-duplicate-areas
exported: 2026-10-25
---

# RAZ-654 — Integration: Repeat showcase seeding without duplicate areas

C6 integration suite. Connected implementation: [RAZ-301](https://linear.app/alosha/issue/RAZ-301/raz-159-follow-up-seed-script-robustness-run-production-seed). Review existing tests first; candidate coverage gap. Use verified synthetic fixtures.

## Relations

- Parent: RAZ-644

## Links

- [test(c6): strengthen RAZ-654 duplicate-area assertions](https://github.com/razbakov/wedance-2026/pull/419)

## Comments

### Linear · 2026-10-22 21:05 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-22 21:11 UTC

### 👀 Ready for your review — Strengthened seed idempotency tests to verify area uniqueness, not just count


Nothing to try — internal change (test-only — added uniqueness, sortOrder, identity-stability, and phantom-growth assertions to seed-pinakothek.test.ts).

### Forge · 2026-10-22 21:19 UTC

### 👀 Merged — ready for your review — Seed tests now catch duplicate areas and phantom growth

**PR:** https://github.com/razbakov/wedance-2026/pull/419

Nothing to try — internal change (test-only — no user-visible change).
