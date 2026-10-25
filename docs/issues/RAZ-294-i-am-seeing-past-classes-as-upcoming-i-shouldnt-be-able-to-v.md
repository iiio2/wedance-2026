---
title: "🐞 I am seeing past classes as upcoming. I shouldn't be able to view or e…"
type: Task
id: RAZ-294
status: done
state: Done
state_type: completed
project: "WeDance Support"
labels: ["user-report"]
assignee: "Tobiloba"
creator: "Aleksey Razbakov"
priority: "Medium"
estimate: null
parent: null
created: 2026-10-10T18:22:02.679Z
completed: "2026-10-10T19:16:26.958Z"
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/238","https://github.com/razbakov/wedance-2026/pull/236"]
linear_url: https://linear.app/alosha/issue/RAZ-294/i-am-seeing-past-classes-as-upcoming-i-shouldnt-be-able-to-view-or-e
exported: 2026-10-25
---

# RAZ-294 — 🐞 I am seeing past classes as upcoming. I shouldn't be able to view or e…

I am seeing past classes as upcoming. I shouldn't be able to view or enroll for classes that have happened already. I should only see upcoming classes when I click on enroll.

---

**Reported by:** tobi555 · [[email redacted]](<mailto:[email redacted]>) · dancer `753c4884-52a4-44be-82be-90c8b3bba034`
**Page:** [https://2026.wedance.vip/my-plan](<https://2026.wedance.vip/my-plan>)
**Route:** `/my-plan`
**Referrer:** android-app://com.google.android.gm/
**Environment:** UA: Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36 · viewport 360×714 · screen 360×820 · dpr 2 · lang en-US · tz Africa/Lagos · online · build fa28c64

---

*Filed automatically from the “Report a problem” widget on [2026.wedance.vip](<http://2026.wedance.vip>).*

## Links

- [fix(my-plan): replace mock classes with real DB events (RAZ-294)](https://github.com/razbakov/wedance-2026/pull/238)
- [fix(my-plan): filter past events and show next class dates (RAZ-294)](https://github.com/razbakov/wedance-2026/pull/236)

## Comments

### Linear · 2026-10-10 18:24 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-10 18:37 UTC

### 👀 Ready for your review — Past classes filtered out, next-class dates shown on my-plan

**Live:** https://2026.wedance.vip/my-plan

**Try it**
1. Open https://2026.wedance.vip/my-plan
2. Click '+ Enroll' in the courses section
3. You should see only upcoming classes with actual dates (e.g. 'Mon Oct 13, 19:00')

### Tobiloba · 2026-10-10 18:50 UTC

It still shows classes which just time not actual dates. And all the classes are past

### Forge · 2026-10-10 18:50 UTC

### 👀 Merged — ready for your review — Past classes no longer show as upcoming on my-plan

**Live:** https://2026.wedance.vip/my-plan
**PR:** https://github.com/razbakov/wedance-2026/pull/236

**Try it**
1. Open https://2026.wedance.vip/my-plan
2. Click '+ Enroll' in the courses section
3. You should see only upcoming classes with actual dates (e.g. 'Mon Oct 13, 19:00')

### Forge · 2026-10-10 18:57 UTC

### 👀 Ready for your review — Enrollment picker now loads real upcoming events from the database

**Live:** https://2026.wedance.vip/my-plan

**Try it**
1. Open https://2026.wedance.vip/my-plan
2. Sign in and set your city
3. Click '+ Enroll' in the courses section
4. You should see only real upcoming classes with actual dates (e.g. 'Mon Oct 13, 19:00')

### Forge · 2026-10-10 19:00 UTC

### 👀 Merged — ready for your review — My-plan now shows real upcoming classes instead of mock data

**Live:** https://2026.wedance.vip/my-plan
**PR:** https://github.com/razbakov/wedance-2026/pull/238

**Try it**
1. Open https://2026.wedance.vip/my-plan
2. Click '+ Enroll' in the courses section
3. You should see only upcoming classes with real dates (e.g. 'Mon Oct 13, 19:00')
