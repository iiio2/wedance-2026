---
title: "UG 10 · Live Stripe account with Connect, in the UG's name"
type: Task
id: RAZ-380
status: triage
state: Triage
state_type: triage
project: "WeDance Governance"
labels: ["commander"]
assignee: null
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-14T10:50:47.342Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-380/ug-10-live-stripe-account-with-connect-in-the-ugs-name
exported: 2026-10-25
---

# RAZ-380 — UG 10 · Live Stripe account with Connect, in the UG's name

**Tension.** Stripe is in test mode (RAZ-244). Ticketing for organizers (RAZ-370) needs a live Stripe account with Connect, and that account should be in the UG's name: changing the legal entity on a live account later means verifying again.

**Do:**

* Commander: activate a live Stripe account for WeDance UG, using the HRB number, business account, Geschäftsführer ID and website. Enable **Connect** (platform). Set the WeDance fee per RAZ-370.
* Agent: put the live keys and a live webhook into Vercel production (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`), keep test keys in preview, and update the project registry note.

**Blocked by:** HRB number and business account. Related: RAZ-370, RAZ-244.
