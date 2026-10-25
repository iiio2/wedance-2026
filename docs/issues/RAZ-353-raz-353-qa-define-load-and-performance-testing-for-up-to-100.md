---
title: "RAZ-353 QA: define load and performance testing for up to 1,000 users"
type: Task
id: RAZ-353
status: in-progress
state: In Review
state_type: started
project: "WeDance CUJ"
labels: ["qa"]
assignee: "Vitali"
creator: "Vitali"
priority: "High"
estimate: null
parent: null
created: 2026-10-13T19:02:47.217Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/296"]
linear_url: https://linear.app/alosha/issue/RAZ-353/raz-353-qa-define-load-and-performance-testing-for-up-to-1000-users
exported: 2026-10-25
---

# RAZ-353 — RAZ-353 QA: define load and performance testing for up to 1,000 users

Create a load and performance test concept for WeDance covering up to 1,000 users. Clarify whether this means concurrent active users or total visitors over a defined period before setting request rates and acceptance thresholds.

Define risks, scenarios, test data, workload distribution, measurements, and acceptance criteria for event discovery and search, popular festival details, personal plans, Going actions, goals, ride/roommate actions, and organizer submissions where implemented. Cover baseline, normal load, peak, spike, stress, and soak profiles, including data integrity and recovery after load spikes.

Prefer free, open-source tools: k6 OSS for load tests and Lighthouse CI for frontend performance. Specify p50/p95/p99 response times, throughput, unexpected errors, timeouts, database metrics, and frontend loading metrics. Treat proposed thresholds as provisional until a baseline and expected traffic profile are established.

Use an isolated application and database with synthetic data. Simulate external services or use explicitly permitted sandboxes; do not generate load against production or third-party services. Define maximum load, cost limits, and abort conditions. Distinguish lightweight nightly regression checks from separately controlled high-load tests.

Specify report contents and links, including commit, environment, data volume, workload profile, results, and threshold violations. This issue is for triage and test-concept definition only, not implementation. Do not change the Docs page.

## Links

- [docs(qa): load and performance test concept for 1,000 users](https://github.com/razbakov/wedance-2026/pull/296)

## Comments

### Linear · 2026-10-13 21:47 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-13 22:03 UTC

### 👀 Merged — ready for your review — Load & performance test concept document added

**PR:** https://github.com/razbakov/wedance-2026/pull/296

Nothing to try — internal change (docs only — adds docs/load-test-concept.md defining load test scenarios, tooling, and thresholds for up to 1,000 concurrent users).
