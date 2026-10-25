---
title: "🐞 /my-year stopped syncing with the rest of the application"
type: Task
id: RAZ-300
status: in-progress
state: In Review
state_type: started
project: "WeDance Support"
labels: ["user-report"]
assignee: "Tobiloba"
creator: "Aleksey Razbakov"
priority: "Medium"
estimate: null
parent: null
created: 2026-10-11T10:05:42.408Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/263"]
linear_url: https://linear.app/alosha/issue/RAZ-300/my-year-stopped-syncing-with-the-rest-of-the-application
exported: 2026-10-25
---

# RAZ-300 — 🐞 /my-year stopped syncing with the rest of the application

/my-year stopped syncing with the rest of the application

---

**Reported by:** Tobiloba Eleto · [[email redacted]](<mailto:[email redacted]>) · dancer `5ad74cef-9a29-4700-aec2-9489b63eee66`
**Page:** [https://2026.wedance.vip/my-year](<https://2026.wedance.vip/my-year>)
**Route:** `/my-year`
**Environment:** UA: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36 · viewport 980×1944 · screen 360×820 · dpr 2 · lang en-US · tz Africa/Lagos · online · build 1849143

**Recent client errors:**

```
[10:04:46.739] console.error: Hydration completed but contains mismatches.
```

---

*Filed automatically from the “Report a problem” widget on [2026.wedance.vip](<http://2026.wedance.vip>).*

## Links

- [fix(my-year): resolve hydration mismatch that broke reactivity sync](https://github.com/razbakov/wedance-2026/pull/263)

## Comments

### Linear · 2026-10-11 10:14 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-11 10:25 UTC

### 👀 Merged — ready for your review — Fixed /my-year page freezing due to hydration mismatch

**Live:** https://2026.wedance.vip/my-year
**PR:** https://github.com/razbakov/wedance-2026/pull/263

**Try it**
1. Open https://2026.wedance.vip/my-year
2. Log in and interact with the year plan
3. You should see the page responds normally — no freezing or stale data
