---
title: "wedance-2026: push CI test results to Grafana Loki"
type: Task
id: RAZ-631
status: in-progress
state: In Review
state_type: started
project: null
labels: []
assignee: "Vitali"
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-20T10:19:09.694Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/399"]
linear_url: https://linear.app/alosha/issue/RAZ-631/wedance-2026-push-ci-test-results-to-grafana-loki
exported: 2026-10-25
---

# RAZ-631 — wedance-2026: push CI test results to Grafana Loki

**Tension** — Test results only live in GitHub Actions logs; no way to see flaky tests, pass-rate trend, slow tests or failures per PR over time.

**Driver** — Test-suite health must be measurable to improve it (coverage audit 2026-10-19: 45% headline overstates reality).

**Requirement** — Every CI run on razbakov/wedance-2026 pushes one JSON log line per test to Grafana Cloud Loki (stack sturdydeer385, EU). Push never fails the build. Starter dashboard in the repo.

**Response options** — Loki push from CI (chosen) · GitHub datasource plugin (run-level only) · OTel traces (CI timing, not flakiness).

---

## ✅ Status (2026-10-20): live

PR [https://github.com/razbakov/wedance-2026/pull/399](<https://github.com/razbakov/wedance-2026/pull/399>) merged. The first run pushed 757 vitest + 3 playwright-smoke + 174 playwright-design results. Dashboard imported.

## Where to see it

* **Dashboard:** [https://sturdydeer385.grafana.net/d/wedance-ci-tests](<https://sturdydeer385.grafana.net/d/wedance-ci-tests>)
* **Ad-hoc queries (Explore):** [https://sturdydeer385.grafana.net/explore](<https://sturdydeer385.grafana.net/explore>) → data source `grafanacloud-sturdydeer385-logs`
* **Docs + dashboard JSON in the repo:** [https://github.com/razbakov/wedance-2026/tree/main/docs/grafana](<https://github.com/razbakov/wedance-2026/tree/main/docs/grafana>)
* **Access:** Grafana org `sturdydeer385` is invite-only. Ask Alex for a Viewer invite.

## What gets pushed

| Suite | CI job | When |
| -- | -- | -- |
| `vitest` (unit + integration) | `integration` | every PR + every merge to main |
| `playwright-smoke` (login E2E) | `e2e-smoke` | merge to main |
| `playwright-design` (design contract + a11y) | `e2e-smoke` | merge to main |

Fields on every line: `name`, `file`, `status` (passed / failed / flaky / skipped), `duration_ms`, `retries`, `error` (failures only), `sha`, `pr`, `branch`, `run_url`.

## How to use the dashboard

* **Suite** filter (top left) and time range (top right, default 14 days).
* **Pass rate / Failed / Flaky:** suite health over the selected range. "No data" on Failed/Flaky means nothing failed.
* **Results over time:** a red bar means a run had failures. Click it to zoom in.
* **Most failing tests:** fix these first. A test that's here but passes locally is flaky.
* **Slowest tests:** where to look when CI gets slow.
* **Recent failures:** status · test · PR · branch · error · link to the CI run.

## Useful queries (Explore)

* Failed on one PR: `{service_name="ci-tests"} | json | pr="312" | status="failed"`
* Failures on main only: `sum by (name) (count_over_time({service_name="ci-tests", event="push"} | json | status="failed" [7d]))`
* One test's history: `{service_name="ci-tests"} | json | name=~".*seriesDates.*"`

## Setup (for reference)

* Code: `scripts/ci/loki-test-results.ts` (+ tests), wired into `.github/workflows/test.yml`
* Repo secrets: `LOKI_URL`, `LOKI_USER`, `LOKI_TOKEN`. The token comes from Grafana access policy `wedance-2026-ci-tests` (scope `logs:write` only).
* Missing secrets (fork PRs) or a Loki outage only print a warning. The build never fails because of this.

⚠️ **The Grafana Cloud trial ends Nov 2, 2026.** Check the plan before then so the push doesn't stop quietly.

## Links

- [ci: push test results to Grafana Loki (RAZ-631)](https://github.com/razbakov/wedance-2026/pull/399)

## Comments

### Forge · 2026-10-20 10:29 UTC

### 👀 Merged — ready for your review — CI test results now pushed to Grafana Loki for trend tracking

**PR:** https://github.com/razbakov/wedance-2026/pull/399

Nothing to try — internal change (CI infrastructure only — adds Loki log push from GitHub Actions test runs; no user-facing change).

**Follow-ups:** RAZ-632

### Aleksey Razbakov · 2026-10-20 14:44 UTC

## Where to see it in Grafana

- **Grafana (stack sturdydeer385, EU):** https://sturdydeer385.grafana.net
- **Dashboard** (after the one-time import below): https://sturdydeer385.grafana.net/d/wedance-ci-tests
- **Ad-hoc queries:** https://sturdydeer385.grafana.net/explore → data source `grafanacloud-sturdydeer385-logs`
- **Setup + field reference in the repo:** https://github.com/razbakov/wedance-2026/tree/main/docs/grafana

## ⚠️ Before any data arrives
The repo secret was saved as `LOGI_TOKEN`. Re-add it as **`LOKI_TOKEN`**: https://github.com/razbakov/wedance-2026/settings/secrets/actions/new. Until then CI prints a warning and pushes nothing (the build stays green). The next CI run after the fix pushes the first results.

## One-time: import the dashboard
1. Open https://sturdydeer385.grafana.net/dashboard/import
2. Paste the contents of https://github.com/razbakov/wedance-2026/blob/main/docs/grafana/ci-tests-dashboard.json
3. Pick the `grafanacloud-sturdydeer385-logs` data source → **Import**.

## How to use it
- **Pass rate / Failed / Flaky:** the health of the suite over the selected time range (top right; default 14 days).
- **Suite filter** (top left): `vitest` = unit + integration (every PR and main), `playwright-smoke` and `playwright-design` = browser tests (main only).
- **Results over time:** a red bar means a run had failures. Click it to zoom in.
- **Most failing tests:** fix these first. A test that shows up here but passes locally is flaky.
- **Slowest tests:** candidates to speed up when CI gets slow.
- **Recent failures:** each line shows status · test · PR · branch · error · link to the CI run.

## Useful queries (Explore)
- Everything that failed on one PR: `{service_name="ci-tests"} | json | pr="312" | status="failed"`
- Failures on main only (excludes WIP PRs): `sum by (name) (count_over_time({service_name="ci-tests", event="push"} | json | status="failed" [7d]))`
- One test's history: `{service_name="ci-tests"} | json | name=~".*seriesDates.*"`

Fields on every line: `name`, `file`, `status` (passed / failed / flaky / skipped), `duration_ms`, `retries`, `error` (failures only), `sha`, `pr`, `branch`, `run_url`.

**Note:** the Grafana Cloud trial ends **Nov 2, 2026**. Check the plan before then so the push doesn't stop quietly.

### Aleksey Razbakov · 2026-10-20 14:44 UTC

@vitali.weinstein.wedance please review.

### Aleksey Razbakov · 2026-10-20 14:56 UTC

Live as of 2026-10-20: re-run of main CI (run 39408979106) pushed 757 vitest + 3 playwright-smoke + 174 playwright-design results to Loki. Dashboard imported: https://sturdydeer385.grafana.net/d/wedance-ci-tests. LOKI_TOKEN fixed, LOGI_TOKEN removed.

### Aleksey Razbakov · 2026-10-20 14:59 UTC

Guide moved into the issue description and updated (dashboard is live, token fixed). Ignore the setup steps in the 14:44 comment above; they're done.
