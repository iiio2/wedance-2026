# Load & Performance Test Concept: WeDance 2026

## Version 0.1 (provisional) | 2026-10-13 | Owner: Forge

This document defines the **concept** for load and performance testing of
2026.wedance.vip. It covers scope, risks, scenarios, tooling, data, measurements,
acceptance criteria, and reporting. All thresholds are provisional until a baseline
run establishes real numbers.

This is a triage and definition document. It does not implement any test.

Related: [QA Strategy](qa-strategy.md) (the parent testing strategy),
RAZ-336 (nightly performance and security checks).

---

## 1. User Model: What "1,000 Users" Means

Before setting request rates we must define the user model. WeDance traffic has
two distinct patterns:

| Pattern | Definition | Example |
|---|---|---|
| **Steady state** | Total unique visitors per day, with sessions spread across hours | Dancers browsing city pages, checking plans |
| **Spike** | Concurrent active users during a time-bounded event | Festival ticket on-sale, Charanga announcement |

**For this concept, "1,000 users" means 1,000 concurrent virtual users (VUs)
generating requests simultaneously.** This is the worst-case spike scenario.
Steady-state daily traffic of 1,000 unique visitors at typical session durations
(~3 min) produces far lower concurrency (~20-50 VUs) and is covered by the
"normal load" profile below.

Current production baseline (PostHog, October 2026): ~200 unique visitors/day,
peak concurrency estimated at 10-30 simultaneous users. The 1,000 VU target
provides ~30-50x headroom over current peaks.

---

## 2. Risks

| # | Risk | Impact | Likelihood | Score | Mitigation via load testing |
|---|---|---|---|---|---|
| R1 | Database connection pool exhaustion under spike load | Neon serverless has a connection limit; pool saturation → 500s for all users | Possible (3) | 12 HIGH | Stress test with ramping VUs; measure connection count and error rate at pool boundary |
| R2 | Slow city/event queries under concurrent reads with 1,300+ events | Pages take >3s, users bounce | Likely (4) | 8 MED | Baseline + normal load on city page queries; monitor p95 query time |
| R3 | tRPC batch requests amplify server load | A single page load fires 3-8 tRPC calls; 100 VUs = 300-800 concurrent DB queries | Possible (3) | 9 MED | Measure actual multiplier in baseline; stress test with realistic batch patterns |
| R4 | Write contention on plan items during festival on-sale | Many users clicking "Going" on the same festival simultaneously | Possible (3) | 9 MED | Spike test on plan.toggle for a single festival ID |
| R5 | Vercel serverless cold starts degrade p99 latency | Nuxt SSR functions cold-start at ~1-3s; under sustained load most stay warm, but a spike after quiet hours hits cold paths | Possible (3) | 6 MED | Soak test measuring p99 over hours; spike test after quiet period |
| R6 | Memory leak in Nuxt SSR under sustained load | Server-side rendering accumulates memory across requests; Vercel functions recycle but Neon connections may not | Unlikely (2) | 6 MED | Soak test monitoring response time drift over 30+ minutes |
| R7 | External service degradation cascades (Stripe, TicketTailor, Cloudinary) | Slow/down upstream → blocked requests pile up → timeouts cascade | Unlikely (2) | 8 MED | Stub externals; separately test with artificial latency injection |
| R8 | Data integrity loss after load spike | Plan items, signups, or votes lost or duplicated under concurrent writes | Possible (3) | 15 CRIT | Post-spike data integrity check: count rows, verify no duplicates, confirm referential integrity |

---

## 3. Scenarios and Workload Distribution

### 3.1 User Journeys Under Test

Only journeys with implemented endpoints are included. Each journey maps to
specific tRPC procedures and REST endpoints.

| # | Journey | Key Endpoints | Read/Write | Weight in workload |
|---|---|---|---|---|
| S1 | Event discovery (city page) | `events.upcoming`, `events.upcomingByCity`, `plan.countBatch`, `GET /api/cities/[slug]` | Read | 35% |
| S2 | Festival details (popular festival) | `festival.bySlug`, `festivalSignup.stats`, `plan.count` | Read | 15% |
| S3 | Personal plan (my-plan, my-year) | `plan.myPlan`, `plan.myYear`, `plan.goals` | Read (auth) | 10% |
| S4 | Going action | `plan.toggle` | Write (auth) | 10% |
| S5 | Goal creation | `plan.addGoal` | Write (auth) | 5% |
| S6 | Ride share / roommate | `rideShare.list`, `rideShare.create`, `roommate.list`, `roommate.create` | Mixed (auth) | 5% |
| S7 | Search (city search) | `GET /api/city-search`, `GET /api/city-options` | Read | 10% |
| S8 | Organizer festival submission | `festivalSignup.submit` (draft) | Write (auth) | 5% |
| S9 | Profile view | `profile.getByUsername` | Read | 5% |

**Authentication model:** Scenarios S3-S6 and S8 require authenticated sessions.
k6 scripts will pre-create test accounts and obtain session tokens during a setup
phase. Tokens are distributed across VUs so each VU has its own session (no
shared-session bottleneck). Test accounts use the `@loadtest.wedance.vip` email
domain.

### 3.2 Load Profiles

All profiles target the **isolated test environment** (section 5), never
production.

| Profile | VUs | Duration | Ramp | Purpose |
|---|---|---|---|---|
| **Baseline** | 1 | 2 min | Instant | Establish single-user latency floor. Every scenario runs sequentially. |
| **Normal** | 50 | 10 min | 30s ramp-up | Simulates a busy day (~500-1,000 daily visitors at typical concurrency). |
| **Peak** | 200 | 10 min | 1 min ramp-up | Simulates a festival on-sale announcement hitting social media. |
| **Spike** | 1,000 | 5 min sustained, 2 min ramp | 2 min ramp from 50 → 1,000 | The target ceiling. Tests whether the system stays available under 1,000 concurrent users. |
| **Stress** | 1,000 → 1,500 | 15 min | Stepped: 200/min | Finds the breaking point beyond the target. Identify where errors exceed 1%. |
| **Soak** | 100 | 60 min | 1 min ramp-up | Detects memory leaks, connection pool drift, and response time degradation over sustained moderate load. |

**Spike recovery:** After the spike profile, VUs drop to 50 for 5 additional
minutes. Measurements during this recovery period verify the system returns to
normal latency and error rate within 2 minutes.

---

## 4. Tooling

### 4.1 Load Testing: k6 OSS

- **Why k6:** Free, open-source, scriptable in JavaScript (team already knows JS/TS),
  built-in thresholds, checks, and scenarios, excellent for API-level load testing.
  Runs locally or in CI without a SaaS dependency.
- **Script location:** `tests/load/` in the repo (to be created at implementation time).
- **Execution:** CLI `k6 run` with `--env` for target URL and auth tokens.
- **Output:** k6 JSON summary + stdout summary. For CI, `k6 run --out json=results.json`.

### 4.2 Frontend Performance: Lighthouse CI

- **Why Lighthouse CI:** Free, open-source, measures real Core Web Vitals (LCP, CLS,
  TBT/INP), runs in CI via `lhci autorun`, produces HTML reports.
- **Pages measured:** `/` (home), `/cities/munich`, `/festivals`, `/festivals/[slug]`,
  `/my-plan` (authenticated), `/events/[id]`.
- **Execution:** `lhci autorun` against the Nuxt preview build in CI. Not a load test;
  measures single-user frontend performance budget.
- **Thresholds (provisional):**
  - LCP < 2.5s (Good)
  - CLS < 0.1
  - TBT < 200ms
  - Performance score >= 70

### 4.3 What Each Tool Does NOT Cover

- **k6** does not render pages or measure frontend metrics (LCP, CLS). It tests API
  and SSR response times under load.
- **Lighthouse CI** does not test under load. It measures single-user frontend
  performance.
- Together they cover the full stack: k6 proves the backend holds under concurrency;
  Lighthouse CI proves the frontend delivers a fast experience to each user.

---

## 5. Test Environment

### 5.1 Isolation Requirements

Load tests run against an **isolated environment**, never production.

| Component | Production | Load Test Environment |
|---|---|---|
| Application | Vercel (2026.wedance.vip) | Vercel preview deployment OR local `nuxt build && nuxt preview` on a CI runner |
| Database | Neon (production branch) | Neon development branch (free tier) OR Docker Postgres 17 on the CI runner |
| Stripe | Live mode | **Not called.** Stubbed in the test environment with a mock endpoint that returns 200 after 50ms. |
| TicketTailor | Live API | **Not called.** Stubbed. |
| Cloudinary | Live | **Not called.** Image URLs resolve to static placeholders. |
| PostHog | EU production | Disabled (`NUXT_PUBLIC_POSTHOG_KEY` unset). |

### 5.2 Synthetic Test Data

Seeded into the isolated database before each test run:

| Entity | Volume | Rationale |
|---|---|---|
| `dancers` | 5,000 | Exceeds the 3,900 production accounts to test at realistic+ scale |
| `events` | 2,000 | Exceeds the ~1,300 production events |
| `festivals` | 20 | Covers the listing and detail pages |
| `planItems` | 10,000 | Realistic ratio of ~2 plan items per dancer |
| `profiles` (organizers, venues, artists) | 200 | Populates city pages and search |
| `cities` | 50 | Covers the city directory |
| `festivalRideShares` | 100 | For ride share list queries |
| `festivalRoommateLookups` | 100 | For roommate list queries |

A seed script (`tests/load/seed.ts`) generates this data deterministically from a
fixed random seed so runs are reproducible. Personal data fields use faker-style
generated values, never production data.

### 5.3 External Service Stubs

External services are replaced by lightweight HTTP stubs that return canned
responses with configurable latency:

- **Stripe webhook:** Returns `{ received: true }` after 50ms.
- **TicketTailor API:** Returns a static order payload.
- **Cloudinary:** Not called (image URLs are static strings in seed data).

The stubs run as a tiny Express/Hono server in the CI job, or as k6's
`http.Server` in local runs. They must never forward requests to real services.

---

## 6. Measurements and Acceptance Criteria

### 6.1 Backend Metrics (k6)

All thresholds are **provisional** until the baseline run establishes actual
values. After the first baseline, thresholds will be tightened to baseline + 20%
margin.

| Metric | Baseline | Normal (50 VU) | Peak (200 VU) | Spike (1,000 VU) | Stress (1,500 VU) | Soak (100 VU, 60 min) |
|---|---|---|---|---|---|---|
| **p50 response time** | < 200ms | < 300ms | < 500ms | < 1,000ms | Measure only | < 300ms |
| **p95 response time** | < 500ms | < 800ms | < 1,500ms | < 3,000ms | Measure only | < 800ms |
| **p99 response time** | < 1,000ms | < 1,500ms | < 3,000ms | < 5,000ms | Measure only | < 1,500ms |
| **Throughput (req/s)** | Measure | > 100 req/s | > 300 req/s | > 500 req/s | Measure only | > 100 req/s |
| **Error rate (non-2xx)** | 0% | < 0.1% | < 0.5% | < 1% | Find ceiling | < 0.1% |
| **Timeout rate (>10s)** | 0% | 0% | < 0.1% | < 0.5% | Measure only | 0% |

**Per-scenario thresholds** (Normal profile):

| Scenario | p95 target | Notes |
|---|---|---|
| S1 Event discovery | < 600ms | The most-hit page; includes tRPC batch |
| S2 Festival details | < 500ms | Single record fetch |
| S3 Personal plan | < 800ms | Auth overhead + multiple queries |
| S4 Going action | < 400ms | Single write, must feel instant |
| S7 Search | < 300ms | Must feel interactive |

### 6.2 Database Metrics

Collected via Neon dashboard or `pg_stat_activity` queries during the test run:

| Metric | Threshold (provisional) |
|---|---|
| Active connections | < 80% of pool limit |
| Connection wait time | < 100ms p95 |
| Query duration p95 | < 200ms |
| Deadlocks | 0 |
| Rows affected per second | Measure (baseline) |

### 6.3 Frontend Metrics (Lighthouse CI)

Measured per page, single user, no load. These are performance budgets, not load
test results.

| Metric | Target | Applies to |
|---|---|---|
| Largest Contentful Paint (LCP) | < 2.5s | All measured pages |
| Cumulative Layout Shift (CLS) | < 0.1 | All measured pages |
| Total Blocking Time (TBT) | < 200ms | All measured pages |
| Performance score | >= 70 | All measured pages |
| Time to First Byte (TTFB) | < 800ms | All measured pages |

### 6.4 Data Integrity Checks (Post-Spike)

After every spike and stress profile, run a verification query:

| Check | Assertion |
|---|---|
| Plan item duplicates | `SELECT dancer_id, item_type, item_id, COUNT(*) FROM plan_items GROUP BY 1,2,3 HAVING COUNT(*) > 1` returns 0 rows |
| Orphaned plan items | All `dancer_id` values exist in `dancers` |
| Festival signup duplicates | No duplicate `(festival_id, dancer_id)` pairs |
| Row count delta | Actual inserts = expected inserts (k6 checks count * success rate) |

### 6.5 Recovery Criteria

After a spike (1,000 VUs → 50 VUs):

| Metric | Threshold |
|---|---|
| Time to return to normal p95 | < 2 minutes |
| Error rate during recovery | < 0.1% within 60s of ramp-down |
| No data loss | Data integrity checks pass |

---

## 7. Nightly Regression vs. High-Load Tests

These are two distinct test types with different triggers, scope, and controls.

| Aspect | Nightly Regression | High-Load Test |
|---|---|---|
| **Trigger** | Scheduled GitHub Action (03:00 Europe/Berlin), alongside existing nightly suite | Manual dispatch or pre-festival milestone |
| **Profile** | Normal (50 VU, 5 min) | Peak, Spike, Stress, Soak (as defined in 3.2) |
| **Duration** | ~7 min (including setup/teardown) | 30-90 min depending on profile |
| **Environment** | CI runner + Docker Postgres | CI runner + Neon dev branch (or dedicated Docker Postgres with more resources) |
| **Cost** | Free (GitHub Actions minutes, Docker Postgres) | Free (k6 OSS, self-hosted); Neon dev branch stays on free tier |
| **Abort conditions** | Error rate > 5% for 60s → abort and fail the workflow | Error rate > 10% for 30s → abort; p99 > 15s for 60s → abort |
| **Who reviews** | Automated: pass/fail in the nightly workflow; failures create a Linear issue | Engineer reviews the full report before a festival on-sale |
| **Frequency** | Daily | Before each festival on-sale event; quarterly otherwise |

### 7.1 Abort Conditions (Safety Rails)

| Condition | Action |
|---|---|
| Error rate > 5% sustained for 60s (nightly) | k6 `abortOnFail` threshold; workflow fails |
| Error rate > 10% sustained for 30s (high-load) | k6 `abortOnFail`; test stops, partial results saved |
| p99 > 15s sustained for 60s | k6 `abortOnFail` |
| CI job exceeds 20 min (nightly) | GitHub Actions `timeout-minutes: 20` |
| CI job exceeds 120 min (high-load) | GitHub Actions `timeout-minutes: 120` |

### 7.2 Cost Limits

| Resource | Limit |
|---|---|
| GitHub Actions minutes | Nightly: ~7 min/day = ~210 min/month (within free tier for public repos) |
| Neon dev branch | Free tier (0.25 CU, 0.5 GB); no paid branching needed |
| Vercel preview | Not used for load tests (tests hit the local preview build); zero Vercel function invocations |
| External services | Zero (all stubbed) |

**Maximum load cap:** No test profile exceeds 1,500 VUs. The stress profile is the
ceiling and exists only to find the breaking point; it is never run unattended.

---

## 8. Report Contents

Every load test run produces a report file at `tests/load/reports/YYYY-MM-DD-HH-MM-<profile>.json`
(k6 JSON output) and a summary committed to the CI artifact or printed to stdout.

### 8.1 Report Fields

| Field | Source | Example |
|---|---|---|
| **Commit SHA** | `$GITHUB_SHA` or `git rev-parse HEAD` | `a4d9c23` |
| **Branch** | `$GITHUB_REF_NAME` | `main` |
| **Environment** | Config var | `ci-docker-pg17` |
| **Data volume** | Seed script output | `5,000 dancers, 2,000 events, 20 festivals` |
| **Workload profile** | k6 scenario name | `normal-50vu` |
| **Duration** | k6 summary | `10m0s` |
| **Total requests** | k6 `http_reqs` | `62,340` |
| **p50 / p95 / p99 response time** | k6 `http_req_duration` | `180ms / 420ms / 890ms` |
| **Throughput** | k6 `http_reqs` rate | `103.9 req/s` |
| **Error rate** | k6 `http_req_failed` | `0.02%` |
| **Timeout count** | k6 custom counter | `0` |
| **Threshold violations** | k6 `thresholds` | `p95_festival_details: PASS (320ms < 500ms)` |
| **Database connections (peak)** | pg_stat query or Neon dashboard | `42 / 100` |
| **Data integrity** | Post-test SQL checks | `PASS: 0 duplicate plan items` |

### 8.2 Lighthouse CI Report

Lighthouse CI produces an HTML report per page. In CI, `lhci upload` stores
results in temporary storage (LHCI server not required for this concept; local
JSON + HTML artifacts suffice).

| Field | Source |
|---|---|
| Page URL | LHCI config |
| LCP / CLS / TBT / TTFB | Lighthouse audit |
| Performance score | Lighthouse audit |
| Commit SHA | `$GITHUB_SHA` |

### 8.3 Nightly Report Routing

- **Pass:** Silent. No notification.
- **Fail (threshold violation):** GitHub Actions workflow posts a comment on the
  QA tracking issue (RAZ-268) with the violated thresholds and a link to the
  workflow run artifacts.

---

## 9. What This Concept Does NOT Cover

- **Implementation.** No k6 scripts, no CI workflow, no seed script. Those are
  separate implementation tickets.
- **CDN and edge caching.** Vercel's edge network sits in front of production but
  is bypassed when testing the local preview build. CDN performance is not
  measured here.
- **Mobile network simulation.** Lighthouse CI runs on a wired CI runner. Real
  mobile network conditions (3G/4G) are out of scope; the budgets above assume
  a fast connection.
- **Multi-region testing.** All VUs originate from the CI runner (single
  region). Geographic latency is not measured.
- **DDoS or adversarial traffic.** This concept tests realistic user behavior,
  not attack patterns.
- **Changes to `docs/qa-strategy.md`.** This document supplements the QA
  strategy; it does not modify it.

---

## 10. Relationship to the QA Strategy

The [QA Strategy](qa-strategy.md) (section 2) explicitly puts load testing out of
scope with a re-evaluation trigger at "~100 concurrent buyers." This concept is
that re-evaluation: it defines how load testing would work so that implementation
can begin when the trigger is pulled (a festival on-sale expecting significant
traffic, or a general growth milestone).

The nightly regression check (section 7) is designed to slot into the existing
nightly GitHub Actions workflow defined in the QA strategy (section 9, "Nightly
gate"). It adds a lightweight 50-VU smoke run alongside the existing E2E,
accessibility, and dependency audit jobs.

---

## 11. Next Steps (Implementation Tickets, Not Part of This Concept)

When this concept is approved, implementation work would be tracked as sub-issues:

1. **k6 baseline scripts** — Write k6 scenarios for S1-S9, run baseline profile,
   establish real thresholds.
2. **Seed script** — `tests/load/seed.ts` for deterministic synthetic data.
3. **External service stubs** — Lightweight stub server for Stripe/TicketTailor.
4. **Nightly CI integration** — Add the 50-VU regression to the nightly workflow.
5. **Lighthouse CI setup** — `lighthouserc.js` config, `lhci autorun` in CI.
6. **High-load runbook** — Document how to run peak/spike/stress manually before
   a festival on-sale.

---

## 12. Revision History

| Version | Date | Author | Change |
|---|---|---|---|
| 0.1 | 2026-10-13 | Forge | Initial concept: user model, risks, scenarios, tooling, thresholds, reporting |

Next review: after baseline run establishes real thresholds, or before the next
festival on-sale, whichever comes first.
