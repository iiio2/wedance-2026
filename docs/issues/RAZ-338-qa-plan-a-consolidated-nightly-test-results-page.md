---
title: "QA: plan a consolidated nightly test results page"
type: Task
id: RAZ-338
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
created: 2026-10-12T18:52:40.994Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-338/qa-plan-a-consolidated-nightly-test-results-page
exported: 2026-10-25
---

# RAZ-338 — QA: plan a consolidated nightly test results page

Plan a single page showing the results of WeDance nightly test runs. The originally proposed destination is [WeDance Docs](<https://2026.wedance.vip/docs>), but no changes to that page are authorized at this stage. Review and approve the destination and approach in triage before implementation.

The proposed overview shows the latest run, run history, tested commit, overall outcome, and results by test stage. Link to Allure, Playwright traces and screenshots, coverage, Lighthouse, k6, and security reports. Distinguish failures, skipped checks, and unavailable results.

Prefer a static overview backed by published reports and free, open-source tooling. Allure history is the initial trend mechanism; Grafana and Prometheus are optional later additions, not prerequisites. This issue is for triage only. Do not modify the Docs page.
