---
title: "QA: extend nightly browser and user journey coverage"
type: Task
id: RAZ-335
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
created: 2026-10-12T18:52:11.351Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-335/qa-extend-nightly-browser-and-user-journey-coverage
exported: 2026-10-25
---

# RAZ-335 — QA: extend nightly browser and user journey coverage

Extend the existing Playwright smoke tests for the nightly pipeline. Cover sign-in, sign-out, password reset, event discovery, and Going, then expand coverage across the eight documented WeDance user journeys where implemented.

Run Chromium, Firefox, and WebKit with desktop and mobile viewports. Add Playwright visual regression checks for central pages and axe-core accessibility checks. Use deterministic synthetic fixtures and isolated test data; simulate external actions or use suitable sandboxes. Capture screenshots, traces, and test results for reporting, including failed runs.

Reuse and verify the existing E2E implementation rather than recreating the completed foundation work. Use free, open-source tools wherever technically feasible. This issue is for triage only; do not change the Docs page.
