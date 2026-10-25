---
title: "Event page: posting a ride (offering / looking) does not work"
type: Task
id: RAZ-437
status: in-progress
state: In Review
state_type: started
project: "WeDance Support"
labels: ["user-report"]
assignee: "Aleksey Razbakov"
creator: "Aleksey Razbakov"
priority: "Urgent"
estimate: null
parent: null
created: 2026-10-16T18:25:14.079Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/370"]
linear_url: https://linear.app/alosha/issue/RAZ-437/event-page-posting-a-ride-offering-looking-does-not-work
exported: 2026-10-25
---

# RAZ-437 — Event page: posting a ride (offering / looking) does not work

Reported by Alex 2026-10-16 on [https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1](<https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1>) — 'looking / offering a ride is not working'. Reproduce on the event page (not only festivals/\[slug\]), find the root cause (missing migration? event vs festival id? auth?), fix, verify on prod as signed-in user.

## Links

- [fix(festival): rides, rooms and empty "Shall we dance?" on event-backed festivals (RAZ-437, RAZ-438, RAZ-440)](https://github.com/razbakov/wedance-2026/pull/370)

## Comments

### Linear · 2026-10-16 18:30 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-16 18:38 UTC

### 👀 Merged — ready for your review — Ride-share and roommate posting now works on event pages

**Live:** https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1
**PR:** https://github.com/razbakov/wedance-2026/pull/370

**Try it**
1. Open https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1
2. Sign in and scroll to the Activities tab
3. Try posting a ride offer or toggling roommate — you should see it save successfully

### Aleksey Razbakov · 2026-10-16 18:38 UTC

Root cause: rides look the festival up in the old festivals table (6 rows). DDF only exists as an event, so posting a ride failed with "not found" and the page hid the error. Fix: https://github.com/razbakov/wedance-2026/pull/370 (#371 is a duplicate, merge only one).
