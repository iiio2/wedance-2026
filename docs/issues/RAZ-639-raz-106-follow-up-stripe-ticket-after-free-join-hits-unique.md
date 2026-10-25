---
title: "RAZ-106 follow-up: Stripe ticket after free join hits unique constraint"
type: Task
id: RAZ-639
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
created: 2026-10-20T18:22:08.638Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-639/raz-106-follow-up-stripe-ticket-after-free-join-hits-unique-constraint
exported: 2026-10-25
---

# RAZ-639 — RAZ-106 follow-up: Stripe ticket after free join hits unique constraint

From PR [https://github.com/razbakov/wedance-2026/pull/404](<https://github.com/razbakov/wedance-2026/pull/404>)

When a dancer first joins a festival for free and later buys a ticket via Stripe, the webhook insert hits the unique(festival, dancer) constraint. The row is never marked verified_ticket_holder and no confirmation email goes out. The purchase IS counted in PostHog, but the database state is wrong.

Fix: the webhook handler should upsert (update on conflict) instead of insert, so a paid ticket upgrades the existing free-join row.
