---
title: "🐞 Where you're dancing - this section seems to be hardcoded"
type: Task
id: RAZ-403
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
created: 2026-10-14T22:30:55.553Z
completed: "2026-10-19T15:19:58.336Z"
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/397"]
linear_url: https://linear.app/alosha/issue/RAZ-403/where-youre-dancing-this-section-seems-to-be-hardcoded
exported: 2026-10-25
---

# RAZ-403 — 🐞 Where you're dancing - this section seems to be hardcoded

Where you're dancing - this section seems to be hardcoded

---

**Reported by:** Alösha · [[email redacted]](<mailto:[email redacted]>) · dancer `dbdd2215-4d40-43f3-b671-a9c51809cc6d`
**Page:** [https://2026.wedance.vip/my-plan](<https://2026.wedance.vip/my-plan>)
**Route:** `/my-plan`
**Referrer:** [https://2026.wedance.vip/](<https://2026.wedance.vip/>)
**Environment:** UA: Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36 · viewport 426×804 · screen 427×952 · dpr 2.25 · lang en-US · tz Europe/Berlin · online · build 2f1840c

**Recent client errors:**

```
[22:28:29.272] console.error: Hydration completed but contains mismatches.
```

**Screenshot:**

![screenshot](https://uploads.linear.app/fa18dfe0-70d8-42bd-8c29-068ea5390b89/67fea75b-124c-4d3c-8438-9e3f741304eb/3b35f003-42fd-468e-b435-bc9fbd5bf672)

---

*Filed automatically from the “Report a problem” widget on [2026.wedance.vip](<http://2026.wedance.vip>).*

## Links

- [fix(my-plan): "Where you're dancing" no longer hardcoded to Munich/Berlin](https://github.com/razbakov/wedance-2026/pull/397)

## Comments

### Forge · 2026-10-19 14:40 UTC

### 👀 Merged — ready for your review — My-plan city links and hydration mismatches fixed for all cities

**Live:** https://2026.wedance.vip/my-plan
**PR:** https://github.com/razbakov/wedance-2026/pull/397

**Try it**
1. Open https://2026.wedance.vip/my-plan while signed in
2. Look at the 'Where you're dancing' section
3. You should see your city's weekly socials with a working 'Full week' link to your city page, regardless of which city you're in
