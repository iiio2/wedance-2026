---
title: "The Floor Votes"
type: Story
id: G803
page: "— (governance / free-OpenAir commons)"
audience: Member
p: G803
cuj: "C8 — Member — Belong & connect (community, trust)"
jtbd: "J6 — Run a great event / throw a great night"
status: not-built
wsjf_business_value: 5
wsjf_time_criticality: 2
wsjf_risk_opportunity: 3
wsjf_job_size: 8
wsjf: 1.25
source: "Non-landing. Ported from governance issue razbakov/wedance-2026#60."
linear: RAZ-165
linear_state: Backlog
linear_prs: []
linear_url: https://linear.app/alosha/issue/RAZ-165/the-floor-votes
---

As a community member, I want to vote for the candidate whose guidelines I support, so that the winning proposal becomes the space's active rules — and I want the ballot to be openly verifiable, so the community trusts the result.

## Acceptance Criteria
- Only eligible dancers (real profile; one vote per election) can vote.
- Every vote is recorded with a **timestamp** and is **attributable to the voter** — this is an **open ballot** by design.
- The results view shows each vote with its timestamp. The voter's **profile link is visible only to logged-in members**; anonymous/public visitors see the vote and timestamp but no linked profile.
- A voter can **change their vote until the election closes**; every change is written as an **immutable history entry** (previous choice → new choice, with timestamp). Votes are never silently overwritten.
- Any member can verify their own — or a friend's — **current vote and its full change history**, so "is my vote still X?" is answerable.
- When the election closes, the tally uses the **latest vote per voter**; the winner's guidelines become the active ruleset (feeds G804).

## Design note — open ballot (deliberate)
Chosen: an **always-open, verifiable ledger** (no secret-ballot mode). The trade is explicit — transparency makes the *count* trustworthy (no silent flips, no unnoticed stuffing, friends can audit each other) at the cost of making the *choice* coercible (in a tight community, others can see how you voted). Accepted for this **low-stakes, unpaid community-moderator** role, where buy-in and auditability outweigh ballot secrecy, and it aligns with the Agora liquid-democracy model. The "profile only for logged-in users" rule is an **anti-scraping privacy floor, not a coercion defense** (coercers are logged-in members). If a future space needs secrecy, that's a separate story, not this one.

## Linear history — RAZ-165 (Backlog, exported 2026-10-25)

Exported from https://linear.app/alosha/issue/RAZ-165/the-floor-votes on 2026-10-25.

<details><summary>Description, links and comments as they stood in Linear</summary>

As a community member, I want to vote for the candidate whose guidelines I support, so that the winning proposal becomes the space's active rules — and I want the ballot to be openly verifiable, so the community trusts the result.

## Acceptance Criteria

* Only eligible dancers (real profile; one vote per election) can vote.
* Every vote is recorded with a **timestamp** and is **attributable to the voter** — an **open ballot** by design.
* The results view shows each vote with its timestamp. The voter's **profile link is visible only to logged-in members**; anonymous/public visitors see the vote + timestamp but no linked profile.
* A voter can **change their vote until the election closes**; every change is written as an **immutable history entry** (previous → new, with timestamp). Votes are never silently overwritten.
* Any member can verify their own — or a friend's — **current vote and full change history** ("is my vote still X?").
* On close, the tally uses the **latest vote per voter**; the winner's guidelines become the active ruleset (feeds G804 · [WED-166](https://linear.app/wedance/issue/WED-166/steward-the-queue)).

## Design note — open ballot (deliberate)

Always-open verifiable ledger, no secret-ballot mode. Explicit trade: transparency makes the *count* trustworthy (no silent flips / unnoticed stuffing; friends can audit each other) at the cost of making the *choice* coercible in a tight community. Accepted for this low-stakes unpaid community-moderator role; aligns with the Agora liquid-democracy model. "Profile only for logged-in users" is an anti-scraping privacy floor, **not** a coercion defense.

---

id **G803** · CUJ **C8** · JTBD **J6** · status **not-built** · WSJF **1.25** (BV5/TC2/RO3 ÷ JS8)
Story file: `docs/issues/G803-community-vote-ruleset.md` · epic [WED-152](https://linear.app/wedance/issue/WED-152/pinakothek-moderator-election-epic) · source: governance #60 (non-landing)

## Relations

- Parent: RAZ-152

</details>
