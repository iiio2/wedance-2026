---
title: "🐞 There's a Festival here that has already happened, and even though I c…"
type: Task
id: RAZ-285
status: in-progress
state: In Review
state_type: started
project: "WeDance Support"
labels: ["user-report"]
assignee: "Tobiloba"
creator: "Aleksey Razbakov"
priority: "Low"
estimate: null
parent: null
created: 2026-10-09T14:14:02.955Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/358"]
linear_url: https://linear.app/alosha/issue/RAZ-285/theres-a-festival-here-that-has-already-happened-and-even-though-i-c
exported: 2026-10-25
---

# RAZ-285 — 🐞 There's a Festival here that has already happened, and even though I c…

There's a Festival here that has already happened, and even though I click on remove , any time I refresh it comes back.

---

**Reported by:** Tobiloba595 · [[email redacted]](<mailto:[email redacted]>) · dancer `b0d11a3a-bcde-4e00-912f-ef0681a3ba2c`
**Page:** [https://2026.wedance.vip/my-plan](<https://2026.wedance.vip/my-plan>)
**Route:** `/my-plan`
**Referrer:** [https://checkout.stripe.com/](<https://checkout.stripe.com/>)
**Environment:** UA: Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36 · viewport 360×714 · screen 360×820 · dpr 2 · lang en-US · tz Africa/Lagos · online · build 9024edb

**Recent client errors:**

```
[14:12:49.480] console.error: Hydration completed but contains mismatches.
```

---

*Filed automatically from the “Report a problem” widget on [2026.wedance.vip](<http://2026.wedance.vip>).*

## Links

- [fix(my-plan): festival remove button now persists across refresh (RAZ-285)](https://github.com/razbakov/wedance-2026/pull/358)

## Comments

### Aleksey Razbakov · 2026-10-09 16:04 UTC

@tobilobaeleto595 which one? does it have a name and date?

### Linear · 2026-10-16 16:45 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-16 16:56 UTC

### 👀 Merged — ready for your review — Removing a festival from My Plan now sticks after refresh

**Live:** https://2026.wedance.vip/my-plan
**PR:** https://github.com/razbakov/wedance-2026/pull/358

**Try it**
1. Open https://2026.wedance.vip/my-plan
2. Click remove on any festival
3. Refresh the page
4. You should see the festival stays removed
