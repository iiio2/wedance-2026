---
title: "🐞 Changes in my plan are not persistent Go to festivals select an even…"
type: Task
id: RAZ-414
status: in-progress
state: In Review
state_type: started
project: "WeDance Support"
labels: ["user-report"]
assignee: "Aleksey Razbakov"
creator: "Aleksey Razbakov"
priority: "Medium"
estimate: null
parent: null
created: 2026-10-15T16:52:45.766Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/366"]
linear_url: https://linear.app/alosha/issue/RAZ-414/changes-in-my-plan-are-not-persistent-go-to-festivals-select-an-even
exported: 2026-10-25
---

# RAZ-414 — 🐞 Changes in my plan are not persistent Go to festivals select an even…

Changes in my plan are not persistent 
Go to festivals 
select an event to join 
Scrolll up and down 
Expect:Event remains selected 
Actually: Event is not selected

---

**Reported by:** Vamos_a_bailar · [[email redacted]](<mailto:[email redacted]>) · dancer `8b03b1ce-d791-4dd9-ab13-2a94b12d0fb9`
**Page:** [https://2026.wedance.vip/my-plan](<https://2026.wedance.vip/my-plan>)
**Route:** `/my-plan`
**Referrer:** [https://2026.wedance.vip/my-plan](<https://2026.wedance.vip/my-plan>)
**Environment:** UA: Mozilla/5.0 (iPhone; CPU iPhone OS 26_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/155.0.8059.37 Mobile/15E148 Safari/604.1 · viewport 344×677 · screen 393×852 · dpr 3 · lang en-GB · tz Europe/Berlin · online · build a543dde

**Recent client errors:**

```
[16:47:21.809] console.error: Hydration completed but contains mismatches.
```

**Screenshot:**

![screenshot](https://uploads.linear.app/fa18dfe0-70d8-42bd-8c29-068ea5390b89/acdeddfc-7d80-428f-b8c2-ec7c92f8e144/44ae0bce-c37d-44b8-9068-8effb7579a6b)

---

*Filed automatically from the “Report a problem” widget on [2026.wedance.vip](<http://2026.wedance.vip>).*

## Links

- [fix(plan): preserve optimistic updates during initial DB load (RAZ-414)](https://github.com/razbakov/wedance-2026/pull/366)

## Comments

### Linear · 2026-10-16 17:44 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-16 18:08 UTC

### 👀 Merged — ready for your review — Plan selections no longer revert after scrolling on festivals page

**Live:** https://2026.wedance.vip/my-plan
**PR:** https://github.com/razbakov/wedance-2026/pull/366

**Try it**
1. Open https://2026.wedance.vip/festivals
2. Tap 'Going?' on any event
3. Scroll up and down
4. You should see the event stays selected
