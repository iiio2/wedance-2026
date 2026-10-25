---
title: "Festival page: Connect with dancers is a dead end: wire ride/room/dinners to the DB with a contact action"
type: Task
id: RAZ-359
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
created: 2026-10-14T08:33:52.075Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-359/festival-page-connect-with-dancers-is-a-dead-end-wire-rideroomdinners
exported: 2026-10-25
---

# RAZ-359 — Festival page: Connect with dancers is a dead end: wire ride/room/dinners to the DB with a contact action

**Tension**
On a festival page, the "Connect with dancers" section is a dead end. In the 2026-10-14 daily Alex walked through it: a dancer can see someone offering a ride or a room but has no way to contact them. Share room has no connect action at all, even though [RAZ-121](https://linear.app/alosha/issue/RAZ-121) (Share A Room) is Done. Dinners and activities work, but they sit behind the paywall. Parts of the section are still hard-coded from the Figma prototype and are not saved to the database.

**Driver**
Rides, rooms and dinners are what WeDance adds around a festival: things the community builds, not the organizer. They only have value if one dancer can reach another. The festival data itself now comes from the database and can be edited. This section still needs the same move from prototype to full stack.

**Requirement**

* Every block in the section (share ride, share room, dinners, activities) is read from the database, and a dancer can create, edit and delete their own entries. Nothing is hard-coded.
* Every ride and room entry has a working way to contact the person who posted it (same pattern as [RAZ-339](https://linear.app/alosha/issue/RAZ-339) for rides: WhatsApp/Telegram link, visible only to signed-in users, enforced on the server).
* The section is owned by the community, not editable by the organizer.
* Decide on purpose what stays behind the paywall. Right now dinners and activities are behind it, and that should be a deliberate choice.
* Any schema change ships with its migration applied on production.

**Response Options**

1. Extend RAZ-339's contact-link pattern to rooms, then audit the rest of the section for hard-coded data and wire it to the database (recommended).
2. Rebuild the whole Connect section as one community module with a shared post-and-contact model for rides, rooms and dinners.

Owner: Alex said he is taking this over from Tobi ("I will handle it"); Tobi stops work on RAZ-339 and the room contact list.

Source: [https://github.com/razbakov/wedance-org/blob/main/ops/sessions/2026-10-14-wedance-dev-daily.md](<https://github.com/razbakov/wedance-org/blob/main/ops/sessions/2026-10-14-wedance-dev-daily.md>)
