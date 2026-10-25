---
title: "RAZ-325 follow-up: apply business-mode database migrations on prod"
type: Task
id: RAZ-326
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
created: 2026-10-12T12:57:13.845Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-326/raz-325-follow-up-apply-business-mode-database-migrations-on-prod
exported: 2026-10-25
---

# RAZ-326 — RAZ-325 follow-up: apply business-mode database migrations on prod

From PR [https://github.com/razbakov/wedance-2026/pull/281](<https://github.com/razbakov/wedance-2026/pull/281>) — three migrations must be applied on production before the business panel works:

1. ALTER TABLE community_groups ADD COLUMN report_count (missing since 0018; /admin/community-groups is broken without it)
2. server/database/migrations/0025_business_profiles.sql — profile_members, profile_claims, [profiles.photos](<http://profiles.photos>)
3. server/database/migrations/0026_event_host_profile.sql — events.host_profile_id

All additive; rollback notes are in each migration file.
