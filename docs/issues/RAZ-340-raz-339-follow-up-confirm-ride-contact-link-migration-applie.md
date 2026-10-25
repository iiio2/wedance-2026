---
title: "RAZ-339 follow-up: confirm ride contact_link migration applied on production"
type: Task
id: RAZ-340
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
created: 2026-10-12T21:24:53.677Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-340/raz-339-follow-up-confirm-ride-contact-link-migration-applied-on
exported: 2026-10-25
---

# RAZ-340 — RAZ-339 follow-up: confirm ride contact_link migration applied on production

The PR [https://github.com/razbakov/wedance-2026/pull/286](<https://github.com/razbakov/wedance-2026/pull/286>) added migration 0028_ride_contact_link.sql (nullable contact_link column on festival_ride_shares). The PR body states: "Needs db:push or manual SQL on production before the deploy goes live."

RAZ-339 explicitly warned about this: the hangouts feature previously went live without its migration and broke. Confirm db:push has been run on production Neon, or run it now.

Steps:

1. Check if column exists: query festival_ride_shares for contact_link column
2. If missing, run db:push from the wedance-2026 project against prod
3. Test: post a ride with a WhatsApp link on [https://2026.wedance.vip/festivals/cuban-fire-munich-2026](<https://2026.wedance.vip/festivals/cuban-fire-munich-2026>)
