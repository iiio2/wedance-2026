# CI test results in Grafana

Every CI run pushes one JSON log line per test to Grafana Cloud Loki
(`scripts/ci/loki-test-results.ts`, RAZ-631):

| Suite | Job | When |
|---|---|---|
| `vitest` | `integration` | every PR + every push to main |
| `playwright-smoke` | `e2e-smoke` | push to main |
| `playwright-design` | `e2e-smoke` | push to main |

- **Labels** (low-cardinality): `service_name="ci-tests"`, `repo`, `suite`, `event` (`pull_request` / `push`).
- **Line fields** (filter with `| json`): `name`, `file`, `status` (`passed` / `failed` / `flaky` / `skipped`), `duration_ms`, `retries`, `error` (failures only, 500 chars), `sha`, `pr`, `branch`, `run_id`, `run_attempt`, `run_url`.
- **Secrets**: `LOKI_URL`, `LOKI_USER`, `LOKI_TOKEN` (access policy `wedance-2026-ci-tests`, scope `logs:write` only). The push never fails the build — fork PRs (no secrets) and Loki outages only print a warning.

## Dashboard

Import `ci-tests-dashboard.json` (Dashboards → New → Import) and pick the Loki data source.
It shows pass rate, failures, flaky tests, results over time, most failing tests, slowest
tests and recent failures with their PR, branch, error and run link.

## Handy queries

```logql
# What failed on PR 312
{service_name="ci-tests"} | json | pr="312" | status="failed"

# Tests failing on main (not PR noise)
sum by (name) (count_over_time({service_name="ci-tests", event="push"} | json | status="failed" [7d]))
```
