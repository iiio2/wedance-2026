---
title: "Ticketing for organizers: sell passes on their WeDance page, money to them (Stripe Connect)"
type: Task
id: RAZ-370
status: triage
state: Triage
state_type: triage
project: "WeDance CUJ"
labels: ["commander"]
assignee: "Aleksey Razbakov"
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-14T10:29:04.332Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-370/ticketing-for-organizers-sell-passes-on-their-wedance-page-money-to
exported: 2026-10-25
---

# RAZ-370 — Ticketing for organizers: sell passes on their WeDance page, money to them (Stripe Connect)

**Tension.** Organizers can't sell tickets through WeDance. /for-organizers says so honestly ("keep selling where you sell now, link your ticket shop"), but ticketing is what organizers ask for first, and the festival planning flow (workshops → best-value pass) ends in a link to someone else's shop.

**Driver.** Revenue from organizers needs WeDance in the money flow, and dancers buy faster where they already plan.

**What exists today (checked 2026-10-14):**

* "Get tickets" links to the organizer's own ticket shop (`events.ticket_url`); passes, prices and what each covers show on the page.
* Stripe checkout exists (`festivalSignup.ticketCheckout`: combined passes, referral discount), but:
  * Stripe is in **test mode** (since RAZ-244);
  * prices come from a fixed list in code (`server/utils/ticket-prices.ts`) for 4 sample festivals, **not** from the passes organizers enter in the editor;
  * money lands in WeDance's Stripe account: no payout to organizers, no fee;
  * no ticket or QR for the buyer, no door check-in, no orders list, no refunds.

**Requirement.** An organizer sells their passes on their WeDance page and gets the money directly. The buyer gets a ticket. The door can check it. The organizer sees and refunds orders in Business.

**Plan:**

1. Checkout reads the passes from the event editor (RAZ-311 step 21–22: ticket catalogue, orders).
2. **Stripe Connect (Express):** the organizer connects their own Stripe account from Business, and each payment goes to them with a WeDance fee (destination charge + application fee). WeDance never holds their money, which keeps the Kleinunternehmer status and liability simple.
3. Ticket email with a QR code; a door check-in screen (scan / search by name); an orders list with refunds per event in Business.
4. Switch Stripe to live (live key + live webhook; see the project registry note).
5. /for-organizers: replace the "link your ticket shop" line with the real offer, once one event has sold live.

**Decisions for the Commander:**

* Should WeDance sell tickets at all? Yes / no.
* The fee, as a % per ticket and/or a fixed amount. Who pays it, organizer or buyer?
* The first real event to pilot on (one organizer, one event).
* Related open decisions: RAZ-323 (email verification before a ticket attaches), RAZ-314 (attendee faces = ticket holders only?).

**Response options:**

* A. Stripe Connect Express + application fee (recommended).
* B. WeDance as merchant of record, with manual payouts (simpler code; tax and liability are on WeDance, so not advised).
* C. Stay link-only and deepen integrations (e.g. Ticket Tailor API import of passes and sold counts) instead of selling.

Related: RAZ-311 (event model + ticketing architecture), RAZ-23 (referral discounts), RAZ-217 (canceled: wire real checkout).

## Comments

### Forge · 2026-10-14 10:31 UTC

### 👀 Merged — ready for your review — For-organizers page now explains how tickets work today

**Live:** https://2026.wedance.vip/for-organizers
**PR:** https://github.com/razbakov/wedance-2026/pull/310

**Try it**
1. Open https://2026.wedance.vip/for-organizers
2. Scroll to the 'Running a festival?' section
3. You should see a new 'Tickets:' paragraph explaining the link-your-shop flow

### Aleksey Razbakov · 2026-10-14 10:33 UTC

Commander · 2026-10-14: ticketing is to be highlighted as a WeDance feature. Alex plans to convert to **WeDance UG**.

Update from the agent:
- /for-organizers now has a "Sell your tickets on WeDance" section marked **Early access**, with an apply-by-email button (razbakov/wedance-2026 PR "For organizers: Ticketing on WeDance (early access)"). Drop the badge once one real event has sold live.
- With a UG, option B (WeDance as merchant of record) is no longer blocked by Kleinunternehmer status or personal liability. A UG means VAT on the fee, bookkeeping, and capped liability. **Stripe Connect (A) is still recommended**: the organizer remains the seller (their VAT, their refunds and chargebacks), WeDance only takes a fee, and payouts are automatic. With B, WeDance holds other people's money and owes every refund.
- New dependency: the Stripe live account should be opened in the UG's name, so going live waits for the UG to be registered (Handelsregister + bank account), or starts on the current account and is moved later (re-verification needed).

### Forge · 2026-10-14 10:35 UTC

### 👀 Merged — ready for your review — For-organizers page now offers ticketing as early-access feature

**Live:** https://2026.wedance.vip/for-organizers
**PR:** https://github.com/razbakov/wedance-2026/pull/311

**Try it**
1. Open https://2026.wedance.vip/for-organizers
2. Scroll to the 'Sell your tickets on WeDance' section
3. You should see an Early access badge, feature bullets, and a 'Get early access' email button

### Aleksey Razbakov · 2026-10-14 10:51 UTC

Agent · The live Stripe account with Connect in the UG's name is RAZ-380, part of the UG registration (umbrella issue linked from RAZ-380's steps). Ticketing going live depends on it.
