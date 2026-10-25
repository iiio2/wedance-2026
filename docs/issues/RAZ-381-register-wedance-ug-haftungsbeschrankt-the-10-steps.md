---
title: "Register WeDance UG (haftungsbeschränkt): the 10 steps"
type: Task
id: RAZ-381
status: triage
state: Triage
state_type: triage
project: "WeDance Governance"
labels: ["commander"]
assignee: "Aleksey Razbakov"
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-14T10:51:05.563Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-381/register-wedance-ug-haftungsbeschrankt-the-10-steps
exported: 2026-10-25
---

# RAZ-381 — Register WeDance UG (haftungsbeschränkt): the 10 steps

**Tension.** WeDance runs as Alex's Einzelunternehmen. Ticketing ([RAZ-370](https://linear.app/alosha/issue/RAZ-370/ticketing-for-organizers-sell-passes-on-their-wedance-page-money-to)), live Stripe and partner contracts need a company with limited liability. Alex plans **WeDance UG (haftungsbeschränkt)** (2026-10-14).

**Requirement.** The UG is registered, has its tax numbers and bank account, owns WeDance's assets and accounts, is named on the site, and holds the live Stripe account.

**Steps, in order:**

 1. [RAZ-374](https://linear.app/alosha/issue/RAZ-374/ug-1-decide-the-setup-sole-founder-name-address-capital) · Decide the setup: Alex founds alone (sole shareholder and Geschäftsführer, Musterprotokoll); name, address, capital. *Commander*
 2. [RAZ-375](https://linear.app/alosha/issue/RAZ-375/ug-2-get-ommaxs-written-consent-for-the-wedance-ug-contract-62) · OMMAX written consent (contract § 6.2). *Commander*, before the notary
 3. [RAZ-371](https://linear.app/alosha/issue/RAZ-371/ug-3-check-the-name-handelsregister-ihk-wedance-trademark) · Name check: Handelsregister, IHK, trademark. *Agent + Commander*
 4. [RAZ-376](https://linear.app/alosha/issue/RAZ-376/ug-4-notarised-founding-and-handelsregister-entry-hrb) · Notarised founding → Handelsregister (HRB). *Commander*. Blocked by 1, 2, 3
 5. [RAZ-377](https://linear.app/alosha/issue/RAZ-377/ug-5-business-bank-account-and-pay-in-the-stammkapital) · Business bank account + Stammkapital. *Commander*. Alongside 4 (the notary needs the bank's confirmation)
 6. [RAZ-378](https://linear.app/alosha/issue/RAZ-378/ug-6-gewerbeanmeldung-finanzamt-steuernummer-ust-idnr) · Gewerbeanmeldung, Finanzamt (Steuernummer, USt-IdNr), Transparenzregister. *Commander*. After the HRB
 7. [RAZ-379](https://linear.app/alosha/issue/RAZ-379/ug-7-steuerberater-and-bookkeeping-for-the-ug) · Steuerberater and bookkeeping. *Commander*. Any time before the first UG invoice
 8. [RAZ-372](https://linear.app/alosha/issue/RAZ-372/ug-8-move-wedances-assets-and-accounts-into-the-ug) · Move WeDance's assets and accounts into the UG. *Agent inventory, Commander signs*. After 4 and 5
 9. [RAZ-373](https://linear.app/alosha/issue/RAZ-373/ug-9-legal-pages-and-email-footers-name-the-ug) · Legal pages and email footers name the UG. *Agent PR*. After 4 and 6
10. [RAZ-380](https://linear.app/alosha/issue/RAZ-380/ug-10-live-stripe-account-with-connect-in-the-ugs-name) · Live Stripe account with Connect in the UG's name. *Commander + agent*. After 4 and 5; unblocks [RAZ-370](https://linear.app/alosha/issue/RAZ-370/ticketing-for-organizers-sell-passes-on-their-wedance-page-money-to)

**Critical path:** 1 → 2 + 3 → 4 + 5 → 6, 8, 10. Steps 2 and 3 can run in parallel.

Steps marked Commander need you (signatures, appointments, accounts). Agent steps start only once you move them to Todo. All of these are a founder's checklist, not legal advice: confirm the setup with the notary or a startup lawyer, and the tax choices with the Steuerberater.

## Comments

### Forge · 2026-10-14 11:03 UTC

### 👀 Merged — ready for your review — WeDance governance updated: Alex as sole founder, Kirill retired

**Live:** https://org.wedance.vip
**PR:** https://github.com/razbakov/wedance-org/pull/19

**Try it**
1. Open https://org.wedance.vip
2. Navigate to any governance doc (roles, policies)
3. You should see Alex as sole founder, UG planned, Kirill's role marked Retired
