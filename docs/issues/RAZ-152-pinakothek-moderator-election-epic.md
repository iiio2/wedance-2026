---
title: "Pinakothek Moderator Election (epic)"
type: Task
id: RAZ-152
status: backlog
state: Backlog
state_type: backlog
project: "WeDance CUJ"
labels: ["from-github","cuj:C8","jtbd:J7","aud:All","status:not-built","governance"]
assignee: null
creator: "Aleksey Razbakov"
priority: "Low"
estimate: null
parent: null
created: 2026-07-16T16:10:14.393Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-152/pinakothek-moderator-election-epic
exported: 2026-10-25
---

# RAZ-152 — Pinakothek Moderator Election (epic)

**Epic (id G800)** — community governance for free/OpenAir commons. CUJ **C8 — Member: Belong & connect (community, trust)** · JTBD **J6 — Run a great event/space**. Non-landing: ported from GitHub **razbakov/wedance-2026#60**, tracked in the governance namespace (`G8xx`), not the Landing Promises set.

## Driver

The free-booking model only works if the community owns the rules. This is a governance primitive tied to the Agora / liquid-democracy vision (`~/Orgs/Agora`).

## The whole loop

A free/OpenAir space (e.g. the **Pinakothek der Moderne** Open Air commons) is run by a moderator the community **elects each year**, who is elected **on the basis of the guidelines they propose**; the winner's guidelines become the space's rules, and the moderator runs the free-booking queue against them.

## Broken into 4 stories (INVEST)

* **G801 — Elect the Steward** — annual moderator election tied to real profiles. (WSJF 1.25)
* **G802 — Run on Rules** — candidates propose the guidelines they'd run by. (WSJF 1.4)
* **G803 — The Floor Votes** — community votes; winner's proposal becomes the active ruleset. (WSJF 1.25)
* **G804 — Steward the Queue** — moderator approves/declines free bookings against the guidelines; guidelines versioned per term. (WSJF 0.69)

Story files: `~/Projects/wedance-2026/docs/issues/G80{1..4}-*.md`. Each mapped 1:1 to a Linear child story and a governance row in the WeDance 2026 UX sheet.

## Sequencing

Outside Cycle 1 (the festival-schedule experiment). Backend-heavy; low WSJF → sequence after the booking primitives it depends on.

## Relations

- Sub-issue: RAZ-166
- Sub-issue: RAZ-165
- Sub-issue: RAZ-164
- Sub-issue: RAZ-163

## Links

- [we-dance/v3 #306 — Book pina via WeDance (booking side)](https://github.com/we-dance/v3/issues/306)
- [GitHub #60 — Community governance: elected moderator + guidelines](https://github.com/razbakov/wedance-2026/issues/60)
