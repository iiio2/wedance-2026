---
title: "RAZ-635 follow-up: verify PostHog session replay masking settings"
type: Task
id: RAZ-636
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
created: 2026-10-20T15:33:07.721Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-636/raz-635-follow-up-verify-posthog-session-replay-masking-settings
exported: 2026-10-25
---

# RAZ-636 — RAZ-635 follow-up: verify PostHog session replay masking settings

The /open page (PR [https://github.com/razbakov/wedance-2026/pull/402](<https://github.com/razbakov/wedance-2026/pull/402>)) states 'Form inputs are masked' in session replay. This relies on PostHog's default maskAllInputs: true. Someone with PostHog project access should confirm both settings (replay enabled + maskAllInputs: true) match what the page claims.
