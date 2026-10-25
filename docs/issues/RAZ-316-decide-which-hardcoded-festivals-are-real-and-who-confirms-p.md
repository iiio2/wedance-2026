---
title: "Decide: which hardcoded festivals are real, and who confirms programme + prices?"
type: Task
id: RAZ-316
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
created: 2026-10-12T12:47:34.878Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-316/decide-which-hardcoded-festivals-are-real-and-who-confirms-programme
exported: 2026-10-25
---

# RAZ-316 — Decide: which hardcoded festivals are real, and who confirms programme + prices?

## Do this

1. Read the recommendation below.
2. Reply in a comment, or move to Done with your answer — Forge picks it up.

## Decision

Needs your input (no default): list which of the festivals in app/data/mock-\*.ts and server/utils/ticket-prices.ts are real and current, and name who signs off their programme and prices before they are loaded into the database.

## Why it matters

Programme, teachers and ticket prices live only in code (review finding 13).

Context: [https://2026.wedance.vip/docs/architecture/decisions/007-festival-programme-and-ticketing](<https://2026.wedance.vip/docs/architecture/decisions/007-festival-programme-and-ticketing>)

Blocks: Phase 3 [RAZ-311](https://linear.app/alosha/issue/RAZ-311/wedance-arch-phase-3-one-event-model-and-ticketing) · Part of [RAZ-305](https://linear.app/alosha/issue/RAZ-305/architecture-section-architecture-data-model-and-api-review)

## Relations

- Parent: RAZ-305

## Comments

### Linear · 2026-10-15 13:04 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-15 13:05 UTC

### 💬 Answer — Audited 8 hardcoded festivals — 4 real, 1 fictional, 3 expired placeholders

Four festivals are real (Menéate Viena, Cuban Fire, Caribbean Urban Fire, Agua Pichi) with server-side prices. Salsa Open Berlin is fictional demo data — delete it. Three lite festivals are past-date placeholders — delete them. Sign-off: Alex confirms his own events (Agua Pichi, Cuban Fire); third-party organizers (Cubaila Viena, Amado/Dance Gods) are the source of truth for theirs, Alex verifies before import.

### Messi · 2026-10-15 13:08 UTC

### Audited 8 hardcoded festivals — 4 real, 1 fictional, 3 expired placeholders

### Messi · 2026-10-15 13:11 UTC

Task: Audit Festival Data and Establish an Approval Workflow

Inspect `app/data/mock-*.ts` and `server/utils/ticket-prices.ts` to identify all festivals, programme details, teachers, and ticket prices currently hardcoded in the application.

Requirements

1. **Audit existing data:** Extract all festival records, programme details, teacher information, and ticket prices from the specified files and any related data sources.
2. **Verify festival authenticity:** Determine which festivals are real and currently active using reliable official sources where available. Do not assume that mock data or hardcoded prices are accurate. Clearly distinguish verified, outdated, fictional/sample, and unverified information.
3. **Create an audit report:** Produce a structured report listing each festival, its verification status, available programme and teacher information, ticket prices, verification sources, and any missing or conflicting information.
4. **Identify approval responsibilities:** Inspect the project documentation and existing workflows for the designated person responsible for approving festival programmes, teachers, and ticket prices. If the approver cannot be established from the repository, flag this as requiring confirmation from the project owner. Do not invent names or assign approval authority without evidence.
5. **Protect data integrity:** Do not delete existing records, change prices, overwrite festival information, or import unverified data into the database during this audit.
6. **Recommend the next implementation steps:** Explain how verified festival data should be managed and loaded into the database, including a proposed approval process that prevents unverified programmes, teachers, and ticket prices from being published.

Deliverables

* A list of festivals found in the code.
* A verification status for each festival and its associated data.
* The identified approver(s), or a clear statement that approval ownership remains unconfirmed.
* A list of missing information and decisions requiring human input.
* A recommended implementation plan for moving verified data into the database.

Start by inspecting the repository and its existing conventions. Complete all verification possible with available evidence, document unresolved questions, and do not make irreversible changes. Report your findings and wait for human approval before modifying production data.

### Forge · 2026-10-15 13:16 UTC

### 👀 Ready for your review — Audit report: 4 real festivals, 1 aspirational, 4 fictional, 11 issues


Nothing to try — internal change (docs only — audit-festival-data.md written to docs/architecture/).

**Follow-ups:** RAZ-311
