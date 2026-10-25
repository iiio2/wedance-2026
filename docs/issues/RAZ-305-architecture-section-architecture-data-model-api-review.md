---
title: "Architecture section (/architecture) + data model & API review"
type: Task
id: RAZ-305
status: in-progress
state: In Review
state_type: started
project: "WeDance CUJ"
labels: []
assignee: "Aleksey Razbakov"
creator: "Aleksey Razbakov"
priority: "High"
estimate: null
parent: null
created: 2026-10-12T10:17:39.988Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/278","https://github.com/razbakov/wedance-2026/pull/276","https://github.com/razbakov/wedance-2026/pull/275"]
linear_url: https://linear.app/alosha/issue/RAZ-305/architecture-section-architecture-data-model-and-api-review
exported: 2026-10-25
---

# RAZ-305 — Architecture section (/architecture) + data model & API review

**Tension** — Nobody can see the whole WeDance 2026 system at once. There are 37 tables, about 40 tRPC routers and roughly 140 stories spread across Linear, docs/issues and org story maps, and nothing maps one to another. Agents build without a reference, and the data model has grown without review.

**Driver** — Agents and humans need one up-to-date reference for the architecture, data structures and API, plus a reviewed target model, before the next round of features adds more structure on top.

**Requirement**

1. A `/architecture` section on [2026.wedance.vip](<http://2026.wedance.vip>), a sibling of `/design` (noindex, internal), generated from code so it cannot drift: Overview · Data model (generated from schema.ts) · API (generated from the tRPC routers and server/api; admin procedures visible to admins only) · Stories (story → journey → tables → API call → whether built) · Decisions (docs/architecture/adr).
2. Analysis published there and marked *Proposed*: story inventory, review of the current design with file:line evidence, target data model and decision records, API plan with gaps, reversible migration steps.
3. Migration steps become separate Linear tickets after the Commander approves them.

**Response options** — the stack stays as it is (Nuxt/tRPC/Drizzle/Neon/Vercel). Generated docs rather than hand-written ones, because hand-written docs rot.

## Relations

- Sub-issue: RAZ-324
- Sub-issue: RAZ-323
- Sub-issue: RAZ-322
- Sub-issue: RAZ-321
- Sub-issue: RAZ-320
- Sub-issue: RAZ-319
- Sub-issue: RAZ-318
- Sub-issue: RAZ-317
- Sub-issue: RAZ-316
- Sub-issue: RAZ-315
- Sub-issue: RAZ-314
- Sub-issue: RAZ-313
- Sub-issue: RAZ-312
- Sub-issue: RAZ-311
- Sub-issue: RAZ-310
- Sub-issue: RAZ-309
- Sub-issue: RAZ-308

## Links

- [RAZ-305: /docs — open-source docs hub (design system + generated architecture), AGPL-3.0](https://github.com/razbakov/wedance-2026/pull/278)
- [RAZ-305: architecture review, target data model & API plan (proposed)](https://github.com/razbakov/wedance-2026/pull/276)
- [RAZ-305: /architecture section — generated data model, API & stories docs](https://github.com/razbakov/wedance-2026/pull/275)

## Comments

### Forge · 2026-10-12 10:49 UTC

### 👀 Merged — ready for your review — Architecture docs section added to WeDance 2026

**Live:** https://2026.wedance.vip/architecture
**PR:** https://github.com/razbakov/wedance-2026/pull/275

**Try it**
1. Open https://2026.wedance.vip/architecture
2. Browse data model, API docs, and decisions tabs
3. You should see generated documentation for all 38 tables, tRPC procedures, and ADR-000

### Forge · 2026-10-12 11:23 UTC

### 🔧 Fixing — Rebase needed — stacked base branch was squash-merged, causing conflicts

Forge is fixing this now — no action needed.

**PR:** https://github.com/razbakov/wedance-2026/pull/276

### Linear · 2026-10-12 11:23 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-12 11:29 UTC

### 🔧 Fixing — Rebased PR #276 onto main — conflicts resolved, all checks green

Forge is fixing this now — no action needed.

### Forge · 2026-10-12 11:32 UTC

### 👀 Merged — ready for your review — V3 events sync fixed — was crashing since Oct 10

**Live:** https://2026.wedance.vip
**PR:** https://github.com/razbakov/wedance-2026/pull/277

**Try it**
1. Open https://2026.wedance.vip
2. Browse any city page
3. You should see up-to-date events synced from wedance.vip

### Forge · 2026-10-12 11:48 UTC

### 👀 Merged — ready for your review — Architecture review, data model & API plan docs added

**Live:** https://2026.wedance.vip/architecture/decisions
**PR:** https://github.com/razbakov/wedance-2026/pull/276

**Try it**
1. Open https://2026.wedance.vip/architecture/decisions
2. Browse review, ADRs, target data model tabs
3. You should see the current-state review with 36 findings and 11 decision records

**Follow-ups:** RAZ-306

### Forge · 2026-10-12 12:30 UTC

### 👀 Merged — ready for your review — Open-source docs hub and AGPL-3.0 license added

**Live:** https://2026.wedance.vip/docs
**PR:** https://github.com/razbakov/wedance-2026/pull/278

**Try it**
1. Open https://2026.wedance.vip/docs
2. Browse Design and Architecture tabs
3. You should see the unified docs hub with getting-started guide, design system, and generated architecture docs
