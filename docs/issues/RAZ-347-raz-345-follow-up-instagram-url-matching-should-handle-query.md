---
title: "RAZ-345 follow-up: Instagram URL matching should handle query params and trailing slashes"
type: Task
id: RAZ-347
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
created: 2026-10-13T10:48:07.983Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-347/raz-345-follow-up-instagram-url-matching-should-handle-query-params
exported: 2026-10-25
---

# RAZ-347 — RAZ-345 follow-up: Instagram URL matching should handle query params and trailing slashes

CodeRabbit flagged that the Instagram account-link matching in business.ts linksInstagram query does not handle stored profile URLs with query parameters or trailing slashes after the handle. Stored URLs like [instagram.com/handle?igsh=xxx](<http://instagram.com/handle?igsh=xxx>) or [instagram.com/handle/](<http://instagram.com/handle/>) won't match the searched username. From PR [https://github.com/razbakov/wedance-2026/pull/289](<https://github.com/razbakov/wedance-2026/pull/289>), file: server/trpc/routers/business.ts:150
