---
title: "UG 9 · Legal pages and email footers name the UG"
type: Task
id: RAZ-373
status: triage
state: Triage
state_type: triage
project: "WeDance Governance"
labels: []
assignee: null
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-14T10:50:19.215Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-373/ug-9-legal-pages-and-email-footers-name-the-ug
exported: 2026-10-25
---

# RAZ-373 — UG 9 · Legal pages and email footers name the UG

**Tension.** The site's legal pages name the current operator. After the register entry they must name the UG: Impressum, terms, privacy policy, booking terms.

**Do (agent, wedance-2026):** update `app/pages/imprint.vue`, `terms.vue`, `privacy-policy.vue` and `booking-terms.vue` with:

* the company name, "WeDance UG (haftungsbeschränkt)";
* the address;
* the Geschäftsführer;
* Registergericht (Amtsgericht München) and HRB number;
* USt-IdNr.

Also update the transactional email footers. Open a PR.

**Blocked by:** HRB number and USt-IdNr.
