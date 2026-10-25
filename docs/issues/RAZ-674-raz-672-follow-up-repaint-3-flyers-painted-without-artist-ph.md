---
title: "RAZ-672 follow-up: repaint 3 flyers painted without artist photo; fix-prompt vs. person edits"
type: Task
id: RAZ-674
status: triage
state: Triage
state_type: triage
project: null
labels: []
assignee: null
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-25T10:18:18.977Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-674/raz-672-follow-up-repaint-3-flyers-painted-without-artist-photo-fix
exported: 2026-10-25
---

# RAZ-674 — RAZ-672 follow-up: repaint 3 flyers painted without artist photo; fix-prompt vs. person edits

Leftovers from PR [https://github.com/razbakov/wedance-2026/pull/430](<https://github.com/razbakov/wedance-2026/pull/430>) (merged cbde42b):

1. The PR body says 3 production flyers were already painted without their artist's photo and need a repaint after deploy. Identify them and repaint them, or let their owners know.
2. shared/utils/flyer.ts:205: SAME_PEOPLE ('Leave every person exactly as they are… Do not redraw them.') is also added to fixPrompt (shared/utils/flyer.ts:221). That clashes with fix notes that ask to change a person (e.g. 'make the DJ bigger', 'move the artist left'). Decide which instruction wins and test one such fix.
3. Reserved class: infra. Migration 0052_ai_usage_prompt.sql adds two nullable columns and runs on the first production deploy. Confirm it applied.
4. CodeRabbit review was still pending at merge time. Check it for unresolved threads.
