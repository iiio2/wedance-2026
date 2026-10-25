---
title: "Implement organizer billing: Pro (5% per ticket) and Network (€199/year + 2%)"
type: Task
id: RAZ-665
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
created: 2026-10-20T20:50:40.688Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-665/implement-organizer-billing-pro-5percent-per-ticket-and-network
exported: 2026-10-25
---

# RAZ-665 — Implement organizer billing: Pro (5% per ticket) and Network (€199/year + 2%)

**Tension** — RAZ-320 decided the pricing (Pro = 5% platform fee per ticket, Network = €199/year + 2%), but there is no billing in the product. The organizer_subscriptions table exists for Network but STRIPE_NETWORK_PRICE_ID is unset; Pro has no schema or checkout at all. Organizers cannot pay, and WeDance cannot earn.

**Driver** — Revenue depends on billing being live. Phase 3 (RAZ-311) and the UG formation (RAZ-381) both need a working payment flow before WeDance can take real money.

**Requirement**

1. **Pro tier (transaction-based):** No subscription. Apply a 5% application_fee_percent via Stripe Connect on every ticket sold through WeDance built-in ticketing. No new DB table needed — the fee is a Stripe Connect parameter at checkout time.
2. **Network tier (€199/year subscription):** Create the Stripe Price object in the WeDance Stripe account (recurring, €199/year). Set STRIPE_NETWORK_PRICE_ID in Vercel production env. The existing organizer_subscriptions table + organizerSubscriptionRouter.createCheckout already handle the checkout flow — wire the success/cancel URLs to the current /for-organizers page.
3. **Network reduced fee:** When an organizer has an active Network subscription, apply 2% application_fee_percent instead of 5% at ticket checkout.
4. **Feature gates:** AI flyer generation: Free = none, Pro = 3 per event, Network = unlimited. Year Planner featured badge for Network subscribers.
5. **Update /for-organizers page:** Replace the mailto CTA on the Network card with a real checkout button (for logged-in organizer profile owners). Add a Pro section explaining the transaction fee model.
6. Stripe stays in TEST mode until the UG is formed (RAZ-381) — this ticket builds and tests the flow, it does not flip the live switch.

**Response options**

* Option A (recommended): Implement Stripe Connect application fees for Pro, wire existing Network subscription flow, gate features by plan. All pieces exist in the codebase already — this connects them.
* Option B: Defer until UG is formed. Risk: billing code isn't tested when Stripe goes live.

**Pricing decision:** RAZ-320
**Blocks:** going live with Stripe (RAZ-381 prerequisite)
**Depends on:** RAZ-311 (one event model — ticket_types table needed for per-ticket fees)
