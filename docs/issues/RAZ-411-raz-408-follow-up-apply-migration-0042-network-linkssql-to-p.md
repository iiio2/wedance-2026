---
title: "RAZ-408 follow-up: apply migration 0042_network_links.sql to prod Neon"
type: Task
id: RAZ-411
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
created: 2026-10-15T16:07:49.199Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-411/raz-408-follow-up-apply-migration-0042-network-linkssql-to-prod-neon
exported: 2026-10-25
---

# RAZ-411 — RAZ-408 follow-up: apply migration 0042_network_links.sql to prod Neon

**Tension**
PR [https://github.com/razbakov/wedance-2026/pull/341](<https://github.com/razbakov/wedance-2026/pull/341>) merged but the new `network_links` table and GIN index on `events.artists` don't exist in prod yet.

**Driver**
The /business/network page and businessNetwork router will error on prod until the migration runs.

**Requirement**
Run `server/database/migrations/0042_network_links.sql` against the prod Neon database. Verify the table exists and the network page loads.

**Response Options**

1. Apply via `psql` against prod connection string (standard approach).
2. If the app has an auto-migration runner, confirm it ran on deploy.

From PR [https://github.com/razbakov/wedance-2026/pull/341](<https://github.com/razbakov/wedance-2026/pull/341>)
