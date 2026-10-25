---
title: "RAZ-84 follow-up: GoingSection error handling + attendee refresh + SQL optimization"
type: Task
id: RAZ-297
status: backlog
state: Backlog
state_type: backlog
project: "WeDance CUJ"
labels: []
assignee: null
creator: "Aleksey Razbakov"
priority: "Medium"
estimate: null
parent: null
created: 2026-10-11T08:41:45.602Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/274"]
linear_url: https://linear.app/alosha/issue/RAZ-297/raz-84-follow-up-goingsection-error-handling-attendee-refresh-sql
exported: 2026-10-25
---

# RAZ-297 — RAZ-84 follow-up: GoingSection error handling + attendee refresh + SQL optimization

Follow-up improvements from CodeRabbit review on PR [https://github.com/razbakov/wedance-2026/pull/251](<https://github.com/razbakov/wedance-2026/pull/251>) (RAZ-84):

1. **GoingSection error handling** (app/components/GoingSection.vue:35-36): Distinguish between a failed request and an empty attendee list — show an error message with retry when the request fails, keep the empty-state CTA only after a successful zero-result response.
2. **Refresh attendee list after Going? change** (app/pages/festivals/\[slug\].vue:1314): After onPick mutates the plan, GoingSection should reload its data without requiring a page reload.
3. **Avatar overflow badge accuracy** (app/pages/festivals/index.vue:289): Return a separate count of attendees with public profiles alongside goingAvatars, and use that for the +N badge instead of signupCount.
4. **Limit avatar rows in SQL** (server/api/festivals.get.ts:70): The query fetches every public attendee for every festival; limit to 5 per slug in the database query instead of filtering in JS.

## Links

- [fix: GoingSection error handling, attendee refresh, avatar badge accuracy, SQL optimization (RAZ-297)](https://github.com/razbakov/wedance-2026/pull/274)

## Comments

### Linear · 2026-10-11 13:22 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-11 13:33 UTC

### 👀 Merged — ready for your review — GoingSection error handling, attendee refresh, avatar badge, SQL optimization

**Live:** https://2026.wedance.vip
**PR:** https://github.com/razbakov/wedance-2026/pull/274

**Try it**
1. Open https://2026.wedance.vip/festivals
2. Look at festival cards — the +N avatar badges now count only public-profile attendees
3. Open a festival detail page and tap Going — the attendee list updates without a page reload
4. If the attendee list fails to load, you should see an error message with a Retry button

### Aleksey Razbakov · 2026-10-11 22:52 UTC

@mezieuzor.amadike I found that `/api/festivals` crashes due to a bug in main's [RAZ-297](https://linear.app/alosha/issue/RAZ-297/raz-84-follow-up-goingsection-error-handling-attendee-refresh-sql) commit, where `any(...)` receives a list instead of an array, causing Postgres to reject it—likely breaking production right now. Investigating further.
