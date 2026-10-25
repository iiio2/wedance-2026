---
title: "RAZ-252 follow-up: archive wedance-festival rows with invented dates on city pages"
type: Task
id: RAZ-417
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
created: 2026-10-16T09:58:55.087Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-417/raz-252-follow-up-archive-wedance-festival-rows-with-invented-dates-on
exported: 2026-10-25
---

# RAZ-417 — RAZ-252 follow-up: archive wedance-festival rows with invented dates on city pages

From PR [https://github.com/razbakov/wedance-2026/pull/350](<https://github.com/razbakov/wedance-2026/pull/350>) — the wedance-festival imported rows are still live on city pages and direct links (e.g. Caribbean Urban Fire under Munich 'Coming up', Oct 21–22) with invented dates. To hide them (reversible): UPDATE events SET archived = true WHERE source = 'wedance-festival' AND edited_at IS NULL;
