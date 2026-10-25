---
title: "Event page: 'Shall we dance?' renders empty with no empty state"
type: Task
id: RAZ-440
status: done
state: Done
state_type: completed
project: "WeDance Support"
labels: ["user-report"]
assignee: "Aleksey Razbakov"
creator: "Aleksey Razbakov"
priority: "Urgent"
estimate: null
parent: null
created: 2026-10-16T18:25:18.411Z
completed: "2026-10-17T11:32:23.844Z"
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/372","https://github.com/razbakov/wedance-2026/pull/370"]
linear_url: https://linear.app/alosha/issue/RAZ-440/event-page-shall-we-dance-renders-empty-with-no-empty-state
exported: 2026-10-25
---

# RAZ-440 — Event page: 'Shall we dance?' renders empty with no empty state

Reported by Alex 2026-10-16 on [https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1](<https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1>) — the 'Shall we dance?' section is empty and no empty state is defined. Regression of RAZ-397 ('never empty')? Define a proper empty state (explain + CTA, e.g. mark yourself going / invite friends) and fix why it is empty on this event.

## Links

- [fix(social): loading spinner + signed-out empty state for discover deck (RAZ-440)](https://github.com/razbakov/wedance-2026/pull/372)
- [fix(festival): rides, rooms and empty "Shall we dance?" on event-backed festivals (RAZ-437, RAZ-438, RAZ-440)](https://github.com/razbakov/wedance-2026/pull/370)

## Comments

### Linear · 2026-10-16 18:31 UTC

This thread is for an agent session with forge.

### Aleksey Razbakov · 2026-10-16 18:39 UTC

Not a code regression. #329 limited the deck to going dancers who chose to be visible, but #327 removed the only switch for that, so the deck is always empty and showed nothing. https://github.com/razbakov/wedance-2026/pull/370 adds an empty state with "I'm going, show me" and "Invite friends".

### Forge · 2026-10-16 18:46 UTC

### 🔧 Fixing — Added loading spinner and signed-out empty state to discover deck

Forge is fixing this now — no action needed.

### Forge · 2026-10-16 18:51 UTC

### 👀 Merged — ready for your review — Empty discover deck now shows loading spinner and sign-up CTA

**Live:** https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1
**PR:** https://github.com/razbakov/wedance-2026/pull/372

**Try it**
1. Open https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1
2. Scroll to the 'Shall we dance?' section
3. You should see a loading spinner while dancers load, then an empty-state card with a 'Sign up to join' button (signed out) or 'I'm going, show me' (signed in)
