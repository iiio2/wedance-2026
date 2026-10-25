---
title: "Venue cold-start: how does a venue get listed in a new city with no data?"
type: Task
id: RAZ-666
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
created: 2026-10-21T08:34:44.449Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-666/venue-cold-start-how-does-a-venue-get-listed-in-a-new-city-with-no
exported: 2026-10-25
---

# RAZ-666 — Venue cold-start: how does a venue get listed in a new city with no data?

**Tension**
In the 2026-10-21 WeDance dev daily, the team started role-playing the critical user journeys in a new city (Nigeria). The organizer has to invite a venue, but nobody could say whether any venue is listed there, who adds one, or how. Alex: "If it would be in Munich, you would already have some data. But if you're starting in a different city, that can be a big issue."

**Driver**
The organizer journey depends on venues being findable or addable. Every new city starts empty, so if there's no path in, the organizer path breaks at the venue step and WeDance can't grow beyond Munich.

**Requirement**

* A clear, documented answer to: in a city with no venue data, how does a venue get onto WeDance (organizer adds it? venue self-lists? import?), and who can do it.
* The organizer's "ask a venue" flow works when the venue doesn't exist yet: they can add it or invite it by email/Instagram.
* Checked against RAZ-321 (proof needed to hand someone a venue profile) so an organizer-added venue can later be claimed by its owner.

**Response Options**

1. Organizer creates an unclaimed venue stub while inviting; the venue claims it via the confirm link.
2. Venue self-listing landing page shared by the organizer.
3. Seed venues per city from public data (Google Places/OSM) before launching there.

Source: [https://github.com/razbakov/wedance-org/blob/main/ops/sessions/2026-10-21-wedance-dev-daily.md](<https://github.com/razbakov/wedance-org/blob/main/ops/sessions/2026-10-21-wedance-dev-daily.md>)
