---
title: "🐞 i always have to refresh before i see the real stats"
type: Task
id: RAZ-299
status: in-progress
state: In Review
state_type: started
project: "WeDance Support"
labels: ["user-report"]
assignee: "Tobiloba"
creator: "Aleksey Razbakov"
priority: "High"
estimate: null
parent: null
created: 2026-10-11T10:00:40.361Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/262"]
linear_url: https://linear.app/alosha/issue/RAZ-299/i-always-have-to-refresh-before-i-see-the-real-stats
exported: 2026-10-25
---

# RAZ-299 — 🐞 i always have to refresh before i see the real stats

i always have  to refresh before i see the real stats

---

**Reported by:** Tobiloba Eleto · [[email redacted]](<mailto:[email redacted]>) · dancer `5ad74cef-9a29-4700-aec2-9489b63eee66`
**Page:** [https://2026.wedance.vip/my-year](<https://2026.wedance.vip/my-year>)
**Route:** `/my-year`
**Environment:** UA: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 · viewport 1041×636 · screen 1280×720 · dpr 1.5 · lang en-US · tz Africa/Lagos · online · build 31bdf10

**Recent client errors:**

```
[09:56:10.712] console.error: Hydration completed but contains mismatches.
```

---

*Filed automatically from the “Report a problem” widget on [2026.wedance.vip](<http://2026.wedance.vip>).*

## Links

- [fix(my-year): disable SSR for auth-gated pages to fix hydration mismatch](https://github.com/razbakov/wedance-2026/pull/262)

## Comments

### Linear · 2026-10-11 10:15 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-11 10:24 UTC

### 👀 Merged — ready for your review — Stats page no longer needs hard refresh to show real data

**Live:** https://2026.wedance.vip/my-year
**PR:** https://github.com/razbakov/wedance-2026/pull/262

**Try it**
1. Open https://2026.wedance.vip/my-year
2. Log in if needed
3. You should see your real stats immediately without refreshing
