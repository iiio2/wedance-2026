---
title: "Ticketing referral discounts"
type: Task
id: RAZ-23
status: todo
state: Todo
state_type: unstarted
project: "WeDance CUJ"
labels: []
assignee: "Vitali"
creator: "Aleksey Razbakov"
priority: "Medium"
estimate: null
parent: null
created: 2026-07-16T06:43:53.583Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/194","https://github.com/razbakov/wedance-2026/pull/189","https://github.com/razbakov/wedance-2026/pull/188"]
linear_url: https://linear.app/alosha/issue/RAZ-23/ticketing-referral-discounts
exported: 2026-10-25
---

# RAZ-23 — Ticketing referral discounts

---

### P319 — Referral: Buy a ticket through a friend's link for a discount

As a traveling dancer viewing a friend's year, I want to buy a festival ticket through their link, so that we both get a discount.

## Acceptance Criteria

* When I view a friend's year, shared festivals show a referral link to buy the ticket.
* The offer states that both of us get a discount.
* Buying through the link applies the discount to my purchase.
* My friend is credited for the referral.
* Festivals without a referral offer simply show the normal ticket action.

*WSJF 1.4 (value 8 + time 5 + risk/opp 5 ÷ size 13) · CUJ C4 · JTBD J4 · page* `/my-year` *· status not-built · source: "Buy your ticket through \[name\]'s link — you both get a discount."*

---

*From the WeDance 2026 landing-page promise audit · source files in* `docs/issues/` *(razbakov/wedance-2026).*

## Links

- [feat(referral): wire my-year page to real data & dynamic discounts (RAZ-23)](https://github.com/razbakov/wedance-2026/pull/194)
- [feat(referral): add migration and webhook completion (RAZ-23)](https://github.com/razbakov/wedance-2026/pull/189)
- [feat: ticketing referral discounts (RAZ-23)](https://github.com/razbakov/wedance-2026/pull/188)

## Comments

### Tobiloba · 2026-09-29 10:58 UTC

This will be continued after the ticketing has been successfully put in place .

### Linear · 2026-10-09 08:00 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-09 08:18 UTC

### 👀 Merged — ready for your review — Referral discount links now give both parties 10% off tickets

**Live:** https://2026.wedance.vip
**PR:** https://github.com/razbakov/wedance-2026/pull/188

**Try it**
1. Open a festival page like https://2026.wedance.vip/festivals/meneate-viena-2026?ref=someuser
2. You should see a green 'Referral discount' banner showing the referrer's name and 10% off
3. Start ticket checkout — the discount line should appear in the checkout modal

**Follow-ups:** RAZ-266, RAZ-267

### Linear · 2026-10-09 08:30 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-09 08:46 UTC

### 👀 Merged — ready for your review — Referral discounts: migration, webhook completion, and tests added

**Live:** https://2026.wedance.vip
**PR:** https://github.com/razbakov/wedance-2026/pull/189

**Try it**
1. Open a festival page like https://2026.wedance.vip/festivals/meneate-viena-2026?ref=someuser
2. You should see a referral discount banner
3. Start ticket checkout — discount line should appear in the checkout modal

### Linear · 2026-10-09 09:18 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-09 09:33 UTC

### 👀 Merged — ready for your review — My-year page wired to real referral data with dynamic discounts

**Live:** https://2026.wedance.vip
**PR:** https://github.com/razbakov/wedance-2026/pull/194

**Try it**
1. Open https://2026.wedance.vip/festivals/meneate-viena-2026?ref=someuser
2. You should see a green referral discount banner with the referrer's name and discount %
3. Start ticket checkout — the discount line should appear in the checkout modal
