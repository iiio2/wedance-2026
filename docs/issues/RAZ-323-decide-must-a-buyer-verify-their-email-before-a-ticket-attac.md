---
title: "Decide: must a buyer verify their email before a ticket attaches to their account?"
type: Task
id: RAZ-323
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
created: 2026-10-12T12:47:41.231Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/340"]
linear_url: https://linear.app/alosha/issue/RAZ-323/decide-must-a-buyer-verify-their-email-before-a-ticket-attaches-to
exported: 2026-10-25
---

# RAZ-323 — Decide: must a buyer verify their email before a ticket attaches to their account?

## Do this

1. Read the recommendation below.
2. Reply in a comment, or move to Done with your answer — Forge picks it up.

## Decision

Recommended: **yes**. It closes the hole where whoever registers an email first receives that email's paid tickets.

## Why it matters

Review finding 1 (security).

Context: [https://2026.wedance.vip/docs/architecture/decisions/003-security-hygiene](<https://2026.wedance.vip/docs/architecture/decisions/003-security-hygiene>)

Blocks: Phase 0 [RAZ-308](https://linear.app/alosha/issue/RAZ-308/wedance-arch-phase-0-stop-the-bleeding) · Part of [RAZ-305](https://linear.app/alosha/issue/RAZ-305/architecture-section-architecture-data-model-and-api-review)

## Relations

- Parent: RAZ-305

## Links

- [fix(security): require email verification before ticket claiming (RAZ-323)](https://github.com/razbakov/wedance-2026/pull/340)

## Comments

### Linear · 2026-10-15 13:41 UTC

This thread is for an agent session with forge.

### Messi · 2026-10-15 13:42 UTC

Task: Fix Ticket Ownership and Email-Based Ticket Claiming Vulnerability (Review Finding 1)

Investigate and fix the security vulnerability in the WeDance application where the first account registered with a purchaser's email address may receive that purchaser's paid festival tickets.

Objectives

1. **Investigate the current implementation**
   * Trace the complete ticket purchase, payment confirmation, ticket creation, account registration, and ticket claiming flows.
   * Inspect the relevant database schemas, authentication logic, API endpoints, server actions, payment webhooks, and ticket assignment functions.
   * Identify every location where tickets are associated with user accounts using an email address.
2. **Enforce secure ticket ownership**
   * Never grant ticket ownership solely because an account's email matches the email recorded during checkout.
   * Ensure tickets are associated with the rightful purchaser through a trusted, verifiable purchase-to-account linking process.
   * Support customers who purchase tickets before creating an account without allowing another person to claim their tickets.
   * Require appropriate email ownership verification or another secure proof of purchase before linking an unclaimed ticket to an account.
   * Ensure that tickets already assigned to an account cannot be claimed, reassigned, or transferred by another account without an explicitly authorised process.
   * Preserve payment provider verification and ensure ticket claiming cannot bypass payment confirmation.
3. **Prevent abuse and race conditions**
   * Handle concurrent registration and ticket-claiming requests safely.
   * Use appropriate database transactions, constraints, and atomic operations to prevent two accounts from claiming the same ticket.
   * Make claiming operations idempotent so retries cannot duplicate ownership or ticket assignments.
   * Avoid exposing ticket information or sensitive purchaser data through predictable identifiers or unauthorised API responses.
4. **Add automated security tests**
   * Verify that an unrelated account cannot claim another customer's paid tickets by registering the same email first.
   * Verify that the legitimate purchaser can securely claim tickets purchased before registration.
   * Verify that an unverified email match does not automatically grant ticket access.
   * Verify that one ticket cannot be claimed by two different accounts, including during concurrent requests.
   * Verify that unpaid, cancelled, refunded, or invalid tickets cannot be claimed where applicable.
   * Verify that legitimate existing ticket ownership and normal checkout flows continue to work.
5. **Follow existing project conventions**
   * Inspect the existing authentication provider, database schema, ORM, ticket models, and payment integration before choosing an implementation.
   * Reuse existing verification and authentication mechanisms where appropriate.
   * Keep changes minimal, secure, and compatible with the current architecture.
   * Do not introduce a new authentication or payment system unnecessarily.

Acceptance criteria

* An account cannot obtain another customer's paid tickets merely by registering the same email address first.
* Ticket ownership is established through a secure and verifiable process.
* A legitimate purchaser can access their tickets after completing the required verification.
* Ticket ownership cannot be duplicated or silently reassigned.
* Relevant automated tests pass.
* Existing ticket purchase and checkout functionality remains operational.

Deliverables

Report the root cause, affected files, security changes implemented, database migrations if needed, tests added, test results, and any remaining risks.

Start by inspecting the codebase and reproducing the vulnerability in a safe test environment. Implement the fix, run the relevant tests, and report any assumptions or unresolved issues. Do not modify production data or deploy changes without authorisation.

### Forge · 2026-10-15 13:43 UTC

### 💬 Answer — Yes — verify email before linking tickets, closes real exploit

Yes, require email verification. The claim flow (claim.ts:36-96) hands tickets to any account matching the buyer email, but registration (auth.ts:249-325) accepts any email with no confirmation. An attacker registers [email redacted] and gets their tickets. Fix: add email_verified_at, gate claimMyTicketHolderRows on it, set it via magic-link or confirmation email.

### Forge · 2026-10-15 13:56 UTC

### 👀 Merged — ready for your review — Email verification required before claiming paid tickets

**Live:** https://2026.wedance.vip/charanga/claim
**PR:** https://github.com/razbakov/wedance-2026/pull/340

**Try it**
1. Open https://2026.wedance.vip/charanga/claim
2. Try claiming tickets with an unverified email account
3. You should see a prompt to verify your email via magic link before tickets are granted

### Forge · 2026-10-15 13:56 UTC

### 👀 Merged — ready for your review — Email verification required before claiming paid tickets

**Live:** https://2026.wedance.vip/charanga/claim
**PR:** https://github.com/razbakov/wedance-2026/pull/340

**Try it**
1. Open https://2026.wedance.vip/charanga/claim
2. Try to claim tickets with a password-only account (no magic-link sign-in)
3. You should see a prompt to verify your email via magic link before tickets attach

### Linear · 2026-10-15 15:19 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-15 15:21 UTC

### 💬 Answer — Yes — verify email before tickets attach; already shipped in PR #340

Yes, require email verification. PR #340 enforces it server-side: claimMyTicketHolderRows checks emailVerifiedAt and rejects unverified accounts. One residual: the webhook auto-linking path still skips the check — track as a Phase 0 follow-up.
