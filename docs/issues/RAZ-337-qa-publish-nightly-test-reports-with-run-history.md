---
title: "QA: publish nightly test reports with run history"
type: Task
id: RAZ-337
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
created: 2026-10-12T18:52:30.106Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-337/qa-publish-nightly-test-reports-with-run-history
exported: 2026-10-25
---

# RAZ-337 — QA: publish nightly test reports with run history

Generate and publish reports for every WeDance nightly test run, including failed runs. Use Allure Report for compatible test results and retain native reports for tools without suitable Allure integration.

Include unit, component, integration, E2E, visual regression, accessibility, performance, and security results. Provide links to Playwright traces and screenshots, Vitest coverage, Lighthouse, k6, and security reports. Preserve Allure history between runs and identify each run by its tested commit, environment, and test data.

Provide stable report links and run metadata for the proposed consolidated results page. Use free, open-source reporting tools wherever technically feasible. This issue is for triage only; do not change the Docs page.
