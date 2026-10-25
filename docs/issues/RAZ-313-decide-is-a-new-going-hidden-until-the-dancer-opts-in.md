---
title: "Decide: is a new \"Going\" hidden until the dancer opts in?"
type: Task
id: RAZ-313
status: todo
state: Todo
state_type: unstarted
project: "WeDance Governance"
labels: ["commander"]
assignee: "Messi"
creator: "Aleksey Razbakov"
priority: "High"
estimate: null
parent: "RAZ-305"
created: 2026-10-12T12:47:32.545Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-313/decide-is-a-new-going-hidden-until-the-dancer-opts-in
exported: 2026-10-25
---

# RAZ-313 — Decide: is a new "Going" hidden until the dancer opts in?

## Do this

1. Read the recommendation below.
2. Reply in a comment, or move to Done with your answer — Forge picks it up.

## Decision

Recommended: **yes, hidden by default** — a dancer appears in public "who's going" only after opting in. Alternative: listed by name + city by default.

## Why it matters

Today plan items default share_going=false while festival_signups default public_minimal — opposite defaults for the same fact.

Context: [https://2026.wedance.vip/docs/architecture/decisions/008-attendance](<https://2026.wedance.vip/docs/architecture/decisions/008-attendance>)

Blocks: Phase 4 [RAZ-312](https://linear.app/alosha/issue/RAZ-312/wedance-arch-phase-4-attendance-plans-and-contract) · Part of [RAZ-305](https://linear.app/alosha/issue/RAZ-305/architecture-section-architecture-data-model-and-api-review)

## Relations

- Parent: RAZ-305

## Comments

### Linear · 2026-10-15 13:02 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-15 13:03 UTC

### 💬 Answer — Yes — hidden by default, prompt to opt in after click

Hidden by default. A new 'Going' click sets visibility to hidden; the dancer appears in public 'Who's Going' lists only after explicitly opting in via a post-click prompt. This matches today's plan_items default (share_going=false), fixes the inconsistency with festival_signups (public_minimal), and satisfies GDPR opt-in. Hidden attendees are still counted for social proof.

### Messi · 2026-10-15 13:06 UTC

### Yes — hidden by default, prompt to opt in after click
