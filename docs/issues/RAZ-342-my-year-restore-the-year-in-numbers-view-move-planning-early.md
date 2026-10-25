---
title: "My Year: restore the year-in-numbers view; move planning + early-bird alerts to My Plan"
type: Task
id: RAZ-342
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
created: 2026-10-13T08:34:01.508Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-342/my-year-restore-the-year-in-numbers-view-move-planning-early-bird
exported: 2026-10-25
---

# RAZ-342 — My Year: restore the year-in-numbers view; move planning + early-bird alerts to My Plan

**Tension**
My Year used to show numbers; now it shows 'Discover Festival' and planning content. In the 2026-10-13 daily Alex said it was better before. RAZ-38 (Year Planning) is Done, and the page was probably confused with My Plan. Mezie also found early-bird alerts (RAZ-144) living on My Year.

**Driver**
Dancers want a shareable recap of their dance year (Spotify-Wrapped style). Planning is a separate job (My Plan).

**Requirement**

* My Year = past only: highlights in numbers (cities visited, festivals and events attended, achievements), shareable.
* Planning features (adding festivals for the year, year plan) live on My Plan.
* Early-bird alerts live on My Plan, not My Year.
* Any ticket whose acceptance criteria say 'My Year' for planning is re-pointed to My Plan.

**Response Options**

1. Restore the previous numbers-based My Year from git history and improve it; move the planning sections to My Plan (recommended).
2. Redesign My Year from scratch as a Wrapped-style recap.

Source: [https://github.com/razbakov/wedance-org/blob/main/ops/sessions/2026-10-13-wedance-dev-daily.md](<https://github.com/razbakov/wedance-org/blob/main/ops/sessions/2026-10-13-wedance-dev-daily.md>)

## Comments

### Aleksey Razbakov · 2026-10-14 08:34 UTC

From the 2026-10-14 daily: (1) Remove the question at the top of My Year, because it is not needed. (2) The model is Spotify Wrapped, but without the stories. The output is one shareable post of the dancer's year in numbers (countries visited, dances, achievements). Mezie will research Wrapped. Source: https://github.com/razbakov/wedance-org/blob/main/ops/sessions/2026-10-14-wedance-dev-daily.md
