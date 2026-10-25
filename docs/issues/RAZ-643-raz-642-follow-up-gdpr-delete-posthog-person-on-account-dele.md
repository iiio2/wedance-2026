---
title: "RAZ-642 follow-up: GDPR — delete PostHog person on account deletion"
type: Task
id: RAZ-643
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
created: 2026-10-20T18:41:06.239Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-643/raz-642-follow-up-gdpr-delete-posthog-person-on-account-deletion
exported: 2026-10-25
---

# RAZ-643 — RAZ-642 follow-up: GDPR — delete PostHog person on account deletion

**Tension:** Account deletion (auth.deleteAccount) does not remove the person record in PostHog. The dancer's id + non-PII person props persist indefinitely.

**Driver:** GDPR right to erasure. A deleted account should also delete the PostHog person.

**Requirement:** Call PostHog's person-delete API from the deleteAccount tRPC mutation. Needs a PostHog personal API key stored as a server secret.

**From:** PR [https://github.com/razbakov/wedance-2026/pull/407](<https://github.com/razbakov/wedance-2026/pull/407>) (Tensions section)
