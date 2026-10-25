---
title: "RAZ-27 follow-up: YouTube embed referrerpolicy + keyboard focus"
type: Task
id: RAZ-354
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
created: 2026-10-13T20:24:57.848Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-354/raz-27-follow-up-youtube-embed-referrerpolicy-keyboard-focus
exported: 2026-10-25
---

# RAZ-354 — RAZ-27 follow-up: YouTube embed referrerpolicy + keyboard focus

From PR [https://github.com/razbakov/wedance-2026/pull/295](<https://github.com/razbakov/wedance-2026/pull/295>) CodeRabbit review:

1. Add referrerpolicy="strict-origin-when-cross-origin" to the YouTube iframe in app/pages/find-your-dance.vue:285-294 — prevents playback error 153 on some browsers. Also remove deprecated frameborder attribute (use border-0 class instead).
2. Retain keyboard focus when play button is replaced by iframe: add a ref to the iframe and use nextTick to focus it after the active video renders (app/pages/find-your-dance.vue:295-314).

Both are minor accessibility/robustness improvements.
