---
title: "Find Your Dance: replace the question survey with the v4 video + music quiz"
type: Task
id: RAZ-341
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
created: 2026-10-13T08:34:00.266Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-341/find-your-dance-replace-the-question-survey-with-the-v4-video-music
exported: 2026-10-25
---

# RAZ-341 — Find Your Dance: replace the question survey with the v4 video + music quiz

**Tension**
The live Find Your Dance quiz asks text questions. In the 2026-10-13 daily Alex rejected it: nobody can pick a dance by answering questions — you choose by watching and listening. RAZ-46 (Dance-Match Quiz) is Done, but what shipped doesn't meet the intent.

**Driver**
Beginners (CUJ C1 / JTBD J1) need to find a dance that feels right without knowing any dance terms.

**Requirement**

* Find Your Dance is a pairwise visual quiz: show two dance videos (e.g. bachata vs salsa), with their music, and the user picks the one they like more, repeated until a style wins.
* Reuse the existing v4 sorting algorithm (it took a week to build) instead of reinventing it. Alex shared the v4 link in the team Telegram.
* The result suggests a dance style and links to beginner-friendly classes for it.

**Response Options**

1. Port the v4 quiz component + algorithm into wedance-2026 (recommended).
2. Rebuild the UI in the 2026 design system and port only the algorithm.

Source: [https://github.com/razbakov/wedance-org/blob/main/ops/sessions/2026-10-13-wedance-dev-daily.md](<https://github.com/razbakov/wedance-org/blob/main/ops/sessions/2026-10-13-wedance-dev-daily.md>)

## Comments

### Aleksey Razbakov · 2026-10-14 08:34 UTC

From the 2026-10-14 daily: Alex again rejected the 5-question Find Your Dance quiz. 150 dances can't be narrowed down by 5 questions, and the result reads like an AI hallucination. This confirms the move to the v4 video and music quiz. Source: https://github.com/razbakov/wedance-org/blob/main/ops/sessions/2026-10-14-wedance-dev-daily.md
