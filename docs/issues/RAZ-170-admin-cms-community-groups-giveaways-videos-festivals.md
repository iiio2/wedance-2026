---
title: "Admin CMS — community groups / giveaways / videos / festivals"
type: Task
id: RAZ-170
status: backlog
state: Backlog
state_type: backlog
project: "WeDance CUJ"
labels: ["aud:Organizer","jtbd:J6","cuj:C7","status:built","Feature"]
assignee: null
creator: "Aleksey Razbakov"
priority: "Medium"
estimate: null
parent: null
created: 2026-07-18T11:36:42.882Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-170/admin-cms-community-groups-giveaways-videos-festivals
exported: 2026-10-25
---

# RAZ-170 — Admin CMS — community groups / giveaways / videos / festivals

As an operator, I want an admin section to manage seeded/community content, so I can curate community groups, giveaways, videos, and festivals without direct DB edits.

Shipped 2026-07-18 in [razbakov/wedance-2026@01d0282](<https://github.com/razbakov/wedance-2026/commit/01d0282>).

## What shipped

* Admin layout (`app/layouts/admin.vue`) + `admin/{index,community-groups,giveaways,videos,festivals}` pages.
* Admin tRPC router + supporting router changes (communityGroup, giveaway).
* Giveaways surfaced as an admin-managed ad/lottery format (per the cities ad-format idea).

## Acceptance Criteria

* Admin can link Internal ops tooling. Not a landing-promise. WSJF: to score.
* st/manage community groups, giveaways, videos, and festivals from a dedicated admin section.
* Actions are backed by the admin tRPC router.

---
