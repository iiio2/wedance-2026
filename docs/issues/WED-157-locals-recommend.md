---
title: "Locals Recommend"
type: Story
id: WED-157
p: E805
source_github: "razbakov/wedance-2026#51"
linear_url: https://linear.app/wedance/issue/WED-157
audience: All
cuj: "C8 — Member — Belong & connect (onboard, account, partners, community, trust)"
jtbd: "J7 — Trust it's real — real people, real faces, no fakes"
status: partial
wsjf_business_value: 5
wsjf_time_criticality: 3
wsjf_risk_opportunity: 5
wsjf_job_size: 5
wsjf: 2.6
origin: engineering-backlog (migrated from GitHub Issues 2026-07-16)
linear: RAZ-157
linear_state: Backlog
linear_prs: []
linear_url: https://linear.app/alosha/issue/RAZ-157/locals-recommend
---

> Migrated from GitHub [razbakov/wedance-2026#51](https://github.com/razbakov/wedance-2026/issues/51) · tracked in Linear **WED-157** (https://linear.app/wedance/issue/WED-157).

**Original title:** Ask locals → recommendations (auto 5-star review) for organizers/venues

## Tension
Newcomers to a city have no way to ask 'who's good here?' and get trusted local picks.

## Driver
Recommendations bootstrap the reviews spine (#1) and the local scene in empty cities (with #2).

## Requirement
- `recommendation_requests` table: citySlug, askerId, question.
- A recommendation names an organizer/venue (+ description) → creates a review with source='recommendation', rating=5, auto-stubbing the target if new.
- City-page 'Ask locals' section: post a question, see questions, respond with a recommendation.
- Abuse guard: signed-in, one recommendation per user per target.

## Response Options
1. Requests table + recommend() that writes into the reviews spine (recommended).
Depends on: #1.

## Linear history — RAZ-157 (Backlog, exported 2026-10-25)

Exported from https://linear.app/alosha/issue/RAZ-157/locals-recommend on 2026-10-25.

<details><summary>Description, links and comments as they stood in Linear</summary>

> Migrated from GitHub [razbakov/wedance-2026#51](<https://github.com/razbakov/wedance-2026/issues/51>)

**Ask locals → recommendations (auto 5-star review) for organizers/venues**

## Tension

Newcomers to a city have no way to ask 'who's good here?' and get trusted local picks.

## Driver

Recommendations bootstrap the reviews spine (#1) and the local scene in empty cities (with #2).

## Requirement

* `recommendation_requests` table: citySlug, askerId, question.
* A recommendation names an organizer/venue (+ description) → creates a review with source='recommendation', rating=5, auto-stubbing the target if new.
* City-page 'Ask locals' section: post a question, see questions, respond with a recommendation.
* Abuse guard: signed-in, one recommendation per user per target.

## Response Options

1. Requests table + recommend() that writes into the reviews spine (recommended).
   Depends on: #1.

</details>
