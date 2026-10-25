---
title: "User Feedback: Include pricing information in generated flyers"
type: Task
id: RAZ-668
status: in-progress
state: In Review
state_type: started
project: "WeDance Support"
labels: []
assignee: "Aleksey Razbakov"
creator: null
priority: "No priority"
estimate: null
parent: null
created: 2026-10-23T17:03:27.157Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/426","https://github.com/razbakov/wedance-2026/pull/425"]
linear_url: https://linear.app/alosha/issue/RAZ-668/user-feedback-include-pricing-information-in-generated-flyers
exported: 2026-10-25
---

# RAZ-668 — User Feedback: Include pricing information in generated flyers

Sentry Feedback: [WEDANCE-2026-E](<https://razbakov.sentry.io/feedback/?feedbackSlug=wedance-2026%3A7809156650&project=4512289226424320&referrer=Linear>)

🐞 Price should be shown in the generated flyer. Currently ignored

|  |  |
| -- | -- |
| **contact_email** | [[email redacted]](<mailto:[email redacted]>) |
| **name** | [name redacted] |
| **source** | new_feedback_envelope |

## Links

- [fix(flyer): revert event form relabel, show passes and promotions on flyer (RAZ-668)](https://github.com/razbakov/wedance-2026/pull/426)
- [fix(flyer): include pricing on generated flyers](https://github.com/razbakov/wedance-2026/pull/425)
- [User Feedback: Include pricing information in generated flyers](https://razbakov.sentry.io/feedback/?feedbackSlug=wedance-2026%3A7809156650&project=4512289226424320)

## Comments

### Linear · 2026-10-23 17:03 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-23 17:15 UTC

### 👀 Merged — ready for your review — Flyers now show pricing from festival passes when free-text price is empty

**Live:** https://2026.wedance.vip
**PR:** https://github.com/razbakov/wedance-2026/pull/425

**Try it**
1. Open https://2026.wedance.vip/business/events
2. Edit an event with festival passes but no free-text price
3. Generate a flyer
4. You should see pass prices listed on the flyer

### Forge · 2026-10-23 17:52 UTC

### 👀 Merged — ready for your review — Flyers now show festival pass prices alongside promotions

**Live:** https://2026.wedance.vip
**PR:** https://github.com/razbakov/wedance-2026/pull/426

**Try it**
1. Open https://2026.wedance.vip/business/events
2. Edit an event that has festival passes but no free-text price
3. Generate a flyer
4. You should see pass prices listed on the flyer
