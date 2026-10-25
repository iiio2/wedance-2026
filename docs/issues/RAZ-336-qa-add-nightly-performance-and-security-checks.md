---
title: "QA: add nightly performance and security checks"
type: Task
id: RAZ-336
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
created: 2026-10-12T18:52:21.151Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-336/qa-add-nightly-performance-and-security-checks
exported: 2026-10-25
---

# RAZ-336 — QA: add nightly performance and security checks

Add performance and security stages to the WeDance nightly test pipeline using free, open-source tools wherever technically feasible.

Use k6 OSS for the public event feed, search, and relevant API workloads, and Lighthouse CI for central pages. Use OWASP ZAP against the isolated test application, Trivy for vulnerable dependencies, and Gitleaks for secrets detection.

Run load tests and active security scans only against the test environment, without production credentials or production data. Publish the native reports and machine-readable results even when checks fail, with links available to the consolidated test overview. This issue is for triage only; do not change the Docs page.
