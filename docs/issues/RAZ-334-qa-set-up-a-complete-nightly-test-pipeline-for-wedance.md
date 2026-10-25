---
title: "QA: set up a complete nightly test pipeline for WeDance"
type: Task
id: RAZ-334
status: triage
state: Triage
state_type: triage
project: "WeDance CUJ"
labels: []
assignee: null
creator: "Vitali"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-12T17:15:16.758Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-334/qa-set-up-a-complete-nightly-test-pipeline-for-wedance
exported: 2026-10-25
---

# RAZ-334 — QA: set up a complete nightly test pipeline for WeDance

Extend the existing CI with an automated nightly run against a fixed commit. Use free, open-source testing tools wherever technically feasible and reuse the existing GitHub Actions CI.

Workflow: install dependencies, start an isolated Postgres test environment, apply migrations and load deterministic synthetic test data, then run static checks, unit tests, component tests, and tRPC/Drizzle integration tests. Follow with E2E, visual regression, accessibility, performance, and security checks. Reuse the tests and CI from the linked issues after verifying their implementation.

Do not use production data or production credentials. Simulate external actions or use suitable sandboxes; account for the Neon transport when connecting to local Postgres. Publish reports even when tests fail, then clean up the test environment. Each run records the commit, environment, and test data and produces results for the proposed overview at [WeDance Docs](<https://2026.wedance.vip/docs>).

This issue is for triage only. Do not make changes to the Docs page before the proposed work has been reviewed and approved.
