---
title: "E2E: Start a private-event request from For Events"
type: Task
id: RAZ-658
status: in-progress
state: In Review
state_type: started
project: "WeDance CUJ"
labels: []
assignee: "Vitali"
creator: "Vitali"
priority: "No priority"
estimate: null
parent: "RAZ-644"
created: 2026-10-20T19:18:38.192Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-658/e2e-start-a-private-event-request-from-for-events
exported: 2026-10-25
---

# RAZ-658 — E2E: Start a private-event request from For Events

C6 E2E suite — host journey. Connected implementation: [RAZ-138](https://linear.app/alosha/issue/RAZ-138/host-dont-dance). Verify current implementation and existing tests before adding coverage. Run write paths against isolated test data only.

## Relations

- Parent: RAZ-644

## Comments

### Linear · 2026-10-22 22:14 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-22 23:25 UTC

RAZ-658 is already complete. The E2E test was shipped in PR #416 (`e405423`) and verified passing against production just now:

- **Feature**: `e2e/features/c6-venue-booking.feature:23-28` — scenario "Start a private-event request from the For Events page"
- **Steps used**: `When I go to the for-events page` (`venue-booking.ts:122`), `Then I see {string}` (`auth.ts:310`), `When I click "Tell us about your event"` (`venue-booking.ts:143`), `Then I see the event inquiry form` (`venue-booking.ts:192`)
- **Result**: 1 passed (5.5s) against `https://2026.wedance.vip`

The test navigates to `/for-events`, verifies the hero text "Hosting the night" is visible, clicks the CTA button "Tell us about your event", and confirms the inquiry form appears (checks "What do you need?" and "Your email" fields are visible). No PR needed — the implementation landed on main via PR #416.

{"status": "done", "h
