---
title: "Automated Tests"
type: Task
id: RAZ-629
status: todo
state: Todo
state_type: unstarted
project: "WeDance CUJ"
labels: []
assignee: "Vitali"
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-19T18:58:05.931Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-629/automated-tests
exported: 2026-10-25
---

# RAZ-629 — Automated Tests

**Forge:** wedance-2026 has five kinds of tests. I counted them from GitHub `main` today.

**1. Unit and integration tests (Vitest), 78 files.** These make up most of the suite.

* **API routers** (`server/trpc/routers`, 24 files): one per feature area, such as events, tickets and profiles.
* **Shared helpers** (`shared/utils`, 14 files; `server/utils`, 13 files including cities).
* **Integrations**: the Stripe webhook, OAuth and MCP server (`server/api`, `server/oauth`, `server/mcp`).
* **Frontend logic** (`app/lib`, `app/composables`).
* **Guard scripts** (`scripts/architecture`, `scripts/design-guardrails`, `scripts/ci`).
* CI runs them twice: once with coverage, and once against a real Postgres with seed data, where zero skipped tests are expected.

**2. End-to-end tests (BDD with Playwright), 3 feature files.**

* Sign up and sign in, password reset, and the "log in before marking Going" gate.
* They're written as Gherkin `.feature` files, with step code in `e2e/steps/`.
* CI runs only the `@smoke` tests, against a built preview server.

**3. Design-system tests (Playwright).**

* `contract.spec.ts` checks that pages follow the design system.
* `a11y.spec.ts` checks accessibility against a baseline file.
* `visual.spec.ts` compares desktop and mobile screenshots of pages to saved images.

**4. Visual history (Argos).** e2e/argos/pages.spec.ts runs from its own workflow, `visual-history.yml`, and records how pages change over time.

**5. Data checks.** `synced-events.check.ts` and `synced-profiles.check.ts` check the events and profiles imported from wedance.vip (v3).

**What's missing:** end-to-end coverage is thin. Only the login flows are covered. Checkout, adding events to your plan, festivals and organiser tools have no browser tests, only API-level tests.

**GitHub links:**

* All tests (end-to-end, design, visual): [https://github.com/razbakov/wedance-2026/tree/main/e2e](<https://github.com/razbakov/wedance-2026/tree/main/e2e>)
* BDD feature files: [https://github.com/razbakov/wedance-2026/tree/main/e2e/features](<https://github.com/razbakov/wedance-2026/tree/main/e2e/features>)
* API router tests: [https://github.com/razbakov/wedance-2026/tree/main/server/trpc/routers](<https://github.com/razbakov/wedance-2026/tree/main/server/trpc/routers>)
* CI workflow: [https://github.com/razbakov/wedance-2026/blob/main/.github/workflows/test.yml](<https://github.com/razbakov/wedance-2026/blob/main/.github/workflows/test.yml>)
