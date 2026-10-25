---
title: "Event page: cannot add Dinners & activities; hangouts must be linked to an event; add Coffee type"
type: Task
id: RAZ-439
status: in-progress
state: In Review
state_type: started
project: "WeDance Support"
labels: ["user-report"]
assignee: "Aleksey Razbakov"
creator: "Aleksey Razbakov"
priority: "High"
estimate: null
parent: null
created: 2026-10-16T18:25:16.787Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/373"]
linear_url: https://linear.app/alosha/issue/RAZ-439/event-page-cannot-add-dinners-and-activities-hangouts-must-be-linked
exported: 2026-10-25
---

# RAZ-439 — Event page: cannot add Dinners & activities; hangouts must be linked to an event; add Coffee type

Reported by Alex 2026-10-16 on [https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1](<https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1>).

1. Bug: on the event page the Dinners & activities section does not let him add anything.
2. Requirement (Commander): every hangout shown in My Plan is always linked to an event — this promotes the event and local businesses (the venue of the hangout). No free-floating hangouts.
3. Requirement: hangout types include a 'Coffee' option.

## Links

- [feat(hangouts): event-linked hangouts + coffee kind](https://github.com/razbakov/wedance-2026/pull/373)

## Comments

### Linear · 2026-10-16 18:30 UTC

This thread is for an agent session with forge.

### Aleksey Razbakov · 2026-10-16 18:32 UTC

Commander · 2026-10-16: existing hangouts not linked to an event are to be DELETED (not kept). Back up to ~/Local/ikigai/wedance/backups/ first; deletion ships with the feature PR's migration.

### Aleksey Razbakov · 2026-10-16 18:39 UTC

There is no way to add dinners/activities. Dinners are seeded by an admin for the 6 old festivals, and activities are an empty list. Prod has 5 hangouts, none linked to an event (no event_id column yet), with 7 RSVPs. Backed up to ~/Local/ikigai/wedance/backups/2026-10-16-unlinked-hangouts.json: test (closed), Ritmo Luma, dinner with the salsa instructor, Dinner, Coffee about Dachau Festival. PR B (event link + Coffee + delete those 5) is on hold: another Forge session for this ticket is building it in parallel.

### Forge · 2026-10-16 18:50 UTC

### 👀 Merged — ready for your review — Event pages now let users create hangouts with coffee option

**Live:** https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1
**PR:** https://github.com/razbakov/wedance-2026/pull/373

**Try it**
1. Open https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1
2. Scroll to 'Dinners & activities' section
3. You should see a form to create hangouts (dinner, coffee, etc.) linked to this event
