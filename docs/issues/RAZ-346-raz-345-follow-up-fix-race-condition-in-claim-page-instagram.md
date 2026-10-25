---
title: "RAZ-345 follow-up: fix race condition in claim page Instagram search"
type: Task
id: RAZ-346
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
created: 2026-10-13T10:47:59.599Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-346/raz-345-follow-up-fix-race-condition-in-claim-page-instagram-search
exported: 2026-10-25
---

# RAZ-346 — RAZ-345 follow-up: fix race condition in claim page Instagram search

CodeRabbit flagged a race condition in the search flow on claim.vue: when the user types fast, stale search results can qualify a newly entered igHandle. The search keyed by q should clear searched/results when the term changes and associate each response with the term that initiated it. Only show the import offer when the completed search term matches the current q. From PR [https://github.com/razbakov/wedance-2026/pull/289](<https://github.com/razbakov/wedance-2026/pull/289>), file: app/pages/business/claim.vue:107
