---
title: "E2E: Send an event brief without a long form"
type: Task
id: RAZ-659
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
created: 2026-10-20T19:18:38.340Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/423"]
linear_url: https://linear.app/alosha/issue/RAZ-659/e2e-send-an-event-brief-without-a-long-form
exported: 2026-10-25
---

# RAZ-659 — E2E: Send an event brief without a long form

C6 E2E suite — host journey. Send an event brief in one message without completing a long form. Connected implementation: [RAZ-107](https://linear.app/alosha/issue/RAZ-107/plan-no-forms). Verify current implementation and existing tests. Run write paths against isolated test data only.

## Relations

- Parent: RAZ-644

## Links

- [test(c6): mock Linear API in event-inquiry E2E test (RAZ-659)](https://github.com/razbakov/wedance-2026/pull/423)

## Comments

### Linear · 2026-10-22 22:14 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-22 23:37 UTC

### 👀 Merged — ready for your review — E2E event inquiry test now mocks Linear API instead of calling production

**PR:** https://github.com/razbakov/wedance-2026/pull/423

Nothing to try — internal change (test-only change — adds Playwright route intercept for tRPC feedback.inquiry in E2E steps).
