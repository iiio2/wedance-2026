---
title: "RAZ-305 follow-up: /architecture exposes unfixed security findings publicly"
type: Task
id: RAZ-306
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
created: 2026-10-12T11:48:07.223Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-306/raz-305-follow-up-architecture-exposes-unfixed-security-findings
exported: 2026-10-25
---

# RAZ-306 — RAZ-305 follow-up: /architecture exposes unfixed security findings publicly

The /architecture page is public (noindex) and the review doc lists 10 unfixed security weaknesses (plaintext tokens, unverified emails on paid tickets, unauthenticated uploads, private data leaks). PR author recommended merging after Phase 0 security fixes ship. From PR [https://github.com/razbakov/wedance-2026/pull/276](<https://github.com/razbakov/wedance-2026/pull/276>). Options: add auth gate to /architecture, or ship Phase 0 fixes first, or accept risk since page is noindex.
