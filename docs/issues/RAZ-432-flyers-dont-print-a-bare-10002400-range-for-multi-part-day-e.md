---
title: "Flyers: don't print a bare 10:00–24:00 range for multi-part day events"
type: Task
id: RAZ-432
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
created: 2026-10-16T17:34:56.280Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-432/flyers-dont-print-a-bare-1000-2400-range-for-multi-part-day-events
exported: 2026-10-25
---

# RAZ-432 — Flyers: don't print a bare 10:00–24:00 range for multi-part day events

**Tension**
The flyer for the 14 Nov joint party with Salsea shows the time as "10:00 – 24:00". Melvin Mori said people will read that as a 14-hour event and won't read further: "la gente no lee".

**Driver**
Long multi-part days (workshops in the day, party at night) are common for dance events. The flyer and event page have to say *what happens when*, not just the overall span, or they put people off.

**Requirement**

* For events that span many hours or have several parts, the generated flyer doesn't print the bare overall start–end range. It shows either the date only, or the key blocks (e.g. "Workshops desde 10:00 · Fiesta 21:00–24:00").
* The detailed schedule and lineup stay on the event page.

**Response Options**

1. Flyer generator rule: if duration > N hours or schedule blocks exist, render the date plus the main blocks instead of the range.
2. Let the organizer pick a "time display" option per flyer (date only / blocks / range).
3. Just fix the 14 Nov flyer by hand and treat this as a one-off.

Session: [https://github.com/razbakov/wedance-org/blob/main/ops/sessions/2026-10-16-melvin-mori-salsea-venue.md](<https://github.com/razbakov/wedance-org/blob/main/ops/sessions/2026-10-16-melvin-mori-salsea-venue.md>)
