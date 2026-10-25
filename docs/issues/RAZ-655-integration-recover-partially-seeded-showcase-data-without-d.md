---
title: "Integration: Recover partially seeded showcase data without duplicates"
type: Task
id: RAZ-655
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
created: 2026-10-20T19:18:37.723Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/421"]
linear_url: https://linear.app/alosha/issue/RAZ-655/integration-recover-partially-seeded-showcase-data-without-duplicates
exported: 2026-10-25
---

# RAZ-655 — Integration: Recover partially seeded showcase data without duplicates

C6 integration suite. Connected implementation: [RAZ-301](https://linear.app/alosha/issue/RAZ-301/raz-159-follow-up-seed-script-robustness-run-production-seed). Review existing tests first; candidate coverage gap. Use verified synthetic fixtures.

## Relations

- Parent: RAZ-644

## Links

- [test(c6): strengthen RAZ-655 partial-seed recovery assertions](https://github.com/razbakov/wedance-2026/pull/421)

## Comments

### Linear · 2026-10-22 21:05 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-22 21:19 UTC

### 👀 Ready for your review — Strengthened partial-seed recovery tests with uniqueness assertions


Nothing to try — internal change (test-only — added name-uniqueness and sortOrder assertions to 4 existing RAZ-655 tests, plus 2 new edge-case tests (5-of-6 recovery, bare profile with pre-existing areas)).

### Forge · 2026-10-22 21:30 UTC

### 👀 Merged — ready for your review — Stronger test assertions for partial-seed recovery without duplicates

**PR:** https://github.com/razbakov/wedance-2026/pull/421

Nothing to try — internal change (test-only: 6 integration tests strengthened/added, no production code changed).
