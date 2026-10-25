---
title: "Event page: Share a room does not work"
type: Task
id: RAZ-438
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
created: 2026-10-16T18:25:15.358Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/370","https://github.com/razbakov/wedance-2026/pull/371"]
linear_url: https://linear.app/alosha/issue/RAZ-438/event-page-share-a-room-does-not-work
exported: 2026-10-25
---

# RAZ-438 — Event page: Share a room does not work

Reported by Alex 2026-10-16 on [https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1](<https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1>) — 'Share a room - neither' (does not work, same as rides). Reproduce, root-cause, fix, verify on prod.

## Links

- [fix(festival): rides, rooms and empty "Shall we dance?" on event-backed festivals (RAZ-437, RAZ-438, RAZ-440)](https://github.com/razbakov/wedance-2026/pull/370)
- [fix: auto-create festivals row for roommate and ride share (RAZ-438)](https://github.com/razbakov/wedance-2026/pull/371)

## Comments

### Linear · 2026-10-16 18:30 UTC

This thread is for an agent session with forge.

### Aleksey Razbakov · 2026-10-16 18:38 UTC

Same root cause as RAZ-437: the room toggle couldn't find DDF in the old festivals table and failed silently. Fixed in https://github.com/razbakov/wedance-2026/pull/370 (#371 is a duplicate of it).

### Forge · 2026-10-16 18:40 UTC

### 👀 Ready for your review — Share a room and ride share now work on all festival events

**Live:** https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1

**Try it**
1. Open https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1
2. Scroll to Activities section, expand Share a room
3. Sign in and toggle 'Looking for a roommate?' — it should stay on
4. Expand Share a ride, post a ride — it should save

### Forge · 2026-10-16 18:51 UTC

### 👀 Merged — ready for your review — Duplicate — fix already delivered via PR #370

**Live:** https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1
**PR:** https://github.com/razbakov/wedance-2026/pull/371

**Try it**
1. Open https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1
2. Scroll to Activities, expand Share a room
3. Toggle 'Looking for a roommate?' — it should stay on
4. Expand Share a ride, post a ride — it should save
