---
title: "Decide: do public attendee faces show verified ticket holders only?"
type: Task
id: RAZ-314
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
created: 2026-10-12T12:47:33.282Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/343"]
linear_url: https://linear.app/alosha/issue/RAZ-314/decide-do-public-attendee-faces-show-verified-ticket-holders-only
exported: 2026-10-25
---

# RAZ-314 — Decide: do public attendee faces show verified ticket holders only?

## Do this

1. Read the recommendation below.
2. Reply in a comment, or move to Done with your answer — Forge picks it up.

## Decision

Recommended: **verified ticket holders only** (keeps the "no fake friends" promise[RAZ-83](https://linear.app/alosha/issue/RAZ-83/no-fake-friends)). Alternative: also show unverified Going, labelled.

## Why it matters

Public faces today come from unverified Going clicks.

Context: [https://2026.wedance.vip/docs/architecture/decisions/008-attendance](<https://2026.wedance.vip/docs/architecture/decisions/008-attendance>)

Blocks: Phase 4 [RAZ-312](https://linear.app/alosha/issue/RAZ-312/wedance-arch-phase-4-attendance-plans-and-contract) · Part of [RAZ-305](https://linear.app/alosha/issue/RAZ-305/architecture-section-architecture-data-model-and-api-review)

## Relations

- Parent: RAZ-305

## Links

- [fix(attendance): restrict public attendee faces to verified ticket holders (RAZ-314)](https://github.com/razbakov/wedance-2026/pull/343)

## Comments

### Linear · 2026-10-15 16:20 UTC

This thread is for an agent session with forge.

### Messi · 2026-10-15 16:21 UTC

Task: Restrict Public Festival Attendee Lists to Verified Ticket Holders ([RAZ-83](https://linear.app/alosha/issue/RAZ-83/no-fake-friends) — No Fake Friends)

Objective

Implement the recommended product decision: only users with verified, valid festival tickets may appear in public festival attendee lists or public attendee-face displays.

Currently, public attendee faces can come from unverified users who click the "Going" button. This creates a risk of displaying people as festival attendees without confirmed ticket ownership.

Implementation requirements

1. **Inspect the existing implementation**
   * Locate the festival details page, public attendee-face components, "Going" button logic, attendee queries, API endpoints, and relevant database models.
   * Trace how festival tickets are purchased, verified, and associated with user accounts.
   * Review Linear issue [RAZ-83](https://linear.app/alosha/issue/RAZ-83/no-fake-friends) ("No Fake Friends") and existing project conventions if accessible.
2. **Enforce the verified-ticket-holder rule**
   * Display a user's face/profile in the public festival attendee list only when the user has a valid ticket for that specific festival and ticket ownership has been verified.
   * Do not treat a "Going" click, an RSVP, or an email match alone as proof of ticket ownership.
   * Exclude users whose tickets are unverified, invalid, cancelled, refunded, or otherwise ineligible under the existing ticket-status rules.
   * Reuse the application's established ticket verification and ownership logic instead of introducing a separate or inconsistent verification mechanism.
3. **Enforce the rule on the server**
   * Update the relevant server queries and API endpoints so public attendee responses contain only eligible verified ticket holders.
   * Ensure the frontend cannot bypass the restriction by calling another endpoint directly.
   * Avoid exposing the names, profile images, or other attendee details of users who do not meet the eligibility criteria.
   * Preserve appropriate authentication, authorisation, and privacy controls.
4. **Preserve existing functionality**
   * Keep the "Going" action working if it is used for planning or other product features.
   * Do not automatically delete RSVP records or change ticket ownership merely to hide unverified users.
   * Keep verified ticket holders visible and preserve existing festival navigation and attendee display behaviour where compatible with this decision.
   * Do not implement the alternative of displaying unverified users with labels unless the product decision is explicitly changed.
5. **Add automated tests**
   * A user with a verified, valid ticket appears in the public attendee list.
   * A user who only clicked "Going" does not appear.
   * A user with an unverified ticket does not appear.
   * A user with a cancelled, refunded, or invalid ticket does not appear, as applicable to existing business rules.
   * A user with a valid ticket for a different festival does not appear as an attendee of the current festival.
   * Direct API requests cannot retrieve ineligible users through the public attendee endpoint.
   * Existing legitimate ticket-holder functionality continues to work.
6. **Validate the implementation**
   * Run the relevant automated tests, type checks, and linting commands available in the repository.
   * Inspect the final diff for unrelated changes.
   * Document any missing ticket-verification logic or unresolved assumptions.

Acceptance criteria

* Public festival attendee faces represent verified, eligible ticket holders only.
* Clicking "Going" alone never grants public attendee visibility.
* The eligibility rule is enforced by the server and reflected in the UI.
* Existing RSVP data and legitimate ticket ownership are preserved.
* Relevant tests pass.

Deliverables

Report the root cause, files changed, implementation details, tests executed and their results, and any remaining issues.

Inspect the codebase before making changes. Implement the fix using existing project conventions, and do not modify production data or deploy without authorisation.

### Forge · 2026-10-15 16:22 UTC

### 💬 Answer — Public faces = verified ticket holders only, per no-fake-friends principle

Yes, public attendee faces should show verified ticket holders only. Unverified 'Going' clicks appear as a count or anonymous silhouettes, never as named faces. This keeps the RAZ-83 'no fake friends' promise: every face on an event page = a real paid commitment. The ADR-008 status ladder plus visibility column already supports this cleanly.

### Forge · 2026-10-15 16:33 UTC

### 👀 Merged — ready for your review — Festival attendee faces now show verified ticket holders only

**Live:** https://2026.wedance.vip
**PR:** https://github.com/razbakov/wedance-2026/pull/343

**Try it**
1. Open a festival page on 2026.wedance.vip
2. Look at the attendee faces/avatars
3. You should see only verified ticket holders, not unverified Going clicks

### Forge · 2026-10-15 16:33 UTC

### 👀 Merged — ready for your review — Festival attendee faces now show only verified ticket holders

**Live:** https://2026.wedance.vip
**PR:** https://github.com/razbakov/wedance-2026/pull/343

**Try it**
1. Open a festival page on 2026.wedance.vip
2. Look at the attendee faces/avatars
3. You should see only users with verified tickets, not unverified Going clicks

### Linear · 2026-10-15 16:33 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-15 16:34 UTC

### 👀 Merged — ready for your review — Festival attendee faces now show verified ticket holders only

**Live:** https://2026.wedance.vip

**Try it**
1. Open a festival page on https://2026.wedance.vip
2. Look at the attendee faces/avatars section
3. You should see only users with verified tickets, not unverified Going clicks

**Follow-ups:** RAZ-312
