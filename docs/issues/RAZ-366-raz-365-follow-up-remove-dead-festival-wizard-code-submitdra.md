---
title: "RAZ-365 follow-up: remove dead festival wizard code (submitDraft, festival_submissions)"
type: Task
id: RAZ-366
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
created: 2026-10-14T10:02:24.193Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-366/raz-365-follow-up-remove-dead-festival-wizard-code-submitdraft
exported: 2026-10-25
---

# RAZ-366 — RAZ-365 follow-up: remove dead festival wizard code (submitDraft, festival_submissions)

The /organizers/create wizard was retired in PR [https://github.com/razbakov/wedance-2026/pull/307](<https://github.com/razbakov/wedance-2026/pull/307>). The PR author noted these are now unused by the app:

* `festival.submitDraft` (action/composable)
* `festival_submissions` insights that read the wizard's drafts

Clean up the dead code paths.

From PR [https://github.com/razbakov/wedance-2026/pull/307](<https://github.com/razbakov/wedance-2026/pull/307>) (RAZ-365).
