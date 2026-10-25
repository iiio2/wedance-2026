---
title: "RAZ-631 follow-up: harden Loki reporter + fix dashboard query"
type: Task
id: RAZ-632
status: triage
state: Triage
state_type: triage
project: "WeDance CUJ"
labels: []
assignee: null
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-20T10:29:27.750Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-632/raz-631-follow-up-harden-loki-reporter-fix-dashboard-query
exported: 2026-10-25
---

# RAZ-632 — RAZ-631 follow-up: harden Loki reporter + fix dashboard query

**From PR** [https://github.com/razbakov/wedance-2026/pull/399](<https://github.com/razbakov/wedance-2026/pull/399>) (RAZ-631)

Two CodeRabbit suggestions deferred at merge:

1. **Dashboard JSON** (docs/grafana/ci-tests-dashboard.json:121): The failed-run panel query should count distinct run_id values, not individual failed test records. Group count_over_time results by run_id before the outer count.
2. **loki-test-results.ts** (scripts/ci/loki-test-results.ts:144): Handle JSON.parse failures in the report-loading flow (catch malformed/empty input, return warn result). Add a finite timeout to the Loki fetch request. Catch unexpected main() rejections at the entry point so reporting emits a warning without failing the step.

Also: PR body notes LOKI_TOKEN was initially added as LOGI_TOKEN (typo). Verify the secret name is correct in repo settings.
