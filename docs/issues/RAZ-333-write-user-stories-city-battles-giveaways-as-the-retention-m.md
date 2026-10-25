---
title: "Write user stories: city battles + giveaways as the retention & marketing loop"
type: Task
id: RAZ-333
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
created: 2026-10-12T15:21:31.867Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-333/write-user-stories-city-battles-giveaways-as-the-retention-and
exported: 2026-10-25
---

# RAZ-333 — Write user stories: city battles + giveaways as the retention & marketing loop

**Tension** — City video battles and giveaways are built (8 cityVideo.\* + 2 giveaway.\* procedures; tables city_videos, video_votes, city_battle_votes, giveaways, giveaway_entries), but no user story covers them, so they appear as 'unmapped' on /docs/architecture/stories and nearly got cut in the RAZ-305 review.

**Driver** — Commander decision RAZ-317 (2026-10-12): pre-launch, these are the main marketing play. They give people a reason to come back regularly and inspire them.

**Requirement** — Stories (actor, trigger, cadence, reward, share moment) for: weekly city battle (submit, vote, results, share); giveaways (enter, draw, winner announcement, organiser/sponsor side); the return loop (what brings a dancer back next week). Add them to docs/architecture/stories.json mapped to existing procedures, and list any gaps.

**Response options** — Draft from the existing code + /for-sponsors page, then review with the Commander.

Part of RAZ-305 (follow-up to RAZ-317).
