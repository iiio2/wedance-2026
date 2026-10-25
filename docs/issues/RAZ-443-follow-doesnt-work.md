---
title: "🐞 Follow doesn't work"
type: Task
id: RAZ-443
status: done
state: Done
state_type: completed
project: "WeDance Support"
labels: ["user-report"]
assignee: "Mr. Abir"
creator: "Aleksey Razbakov"
priority: "Medium"
estimate: null
parent: null
created: 2026-10-16T19:38:07.606Z
completed: "2026-10-17T16:40:54.088Z"
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/388"]
linear_url: https://linear.app/alosha/issue/RAZ-443/follow-doesnt-work
exported: 2026-10-25
---

# RAZ-443 — 🐞 Follow doesn't work

Follow doesn't work

---

**Reported by:** Alösha · [[email redacted]](<mailto:[email redacted]>) · dancer `dbdd2215-4d40-43f3-b671-a9c51809cc6d`
**Page:** [https://2026.wedance.vip/@david-calzado-y-la-charanga-habanera](<https://2026.wedance.vip/@david-calzado-y-la-charanga-habanera>)
**Route:** `/@david-calzado-y-la-charanga-habanera`
**Environment:** UA: Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36 · viewport 426×804 · screen 427×952 · dpr 2.25 · lang en-US · tz Europe/Berlin · online · build 3ef788f

**Recent client errors:**

```
[19:37:48.044] console.error: Hydration completed but contains mismatches.
```

**Screenshot:**

![screenshot](https://uploads.linear.app/fa18dfe0-70d8-42bd-8c29-068ea5390b89/74ae3cb6-2636-4b0d-9c63-6e6645abc4e6/2fec2440-b8c0-4949-915a-8985b4190be8)

---

*Filed automatically from the “Report a problem” widget on [2026.wedance.vip](<http://2026.wedance.vip>).*

## Links

- [fix(follow): Follow does nothing on /@handle; hydration-safe signed-in header](https://github.com/razbakov/wedance-2026/pull/388)

## Comments

### Forge · 2026-10-17 16:27 UTC

### 👀 Merged — ready for your review — Follow button fixed; hydration mismatches eliminated

**Live:** https://2026.wedance.vip/@david-calzado-y-la-charanga-habanera
**PR:** https://github.com/razbakov/wedance-2026/pull/388

**Try it**
1. Open https://2026.wedance.vip/@david-calzado-y-la-charanga-habanera
2. Click Follow
3. You should see the follower count update (only after migration 0048 is applied to prod)

**Follow-ups:** (Linear rate-limited) Apply migration 0048_follows_reconcile.sql to prod — Follow stays broken until then, (Linear rate-limited) Vercel Git integration needs re-authorization — preview deploys failing on all PRs
