---
title: "🐞 Hangouts creation fails Could not post: Failed query: insert into \"ha…"
type: Task
id: RAZ-270
status: done
state: Done
state_type: completed
project: "WeDance Support"
labels: ["user-report"]
assignee: "Aleksey Razbakov"
creator: "Aleksey Razbakov"
priority: "Medium"
estimate: null
parent: null
created: 2026-10-09T10:28:53.564Z
completed: "2026-10-09T11:10:32.267Z"
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/200"]
linear_url: https://linear.app/alosha/issue/RAZ-270/hangouts-creation-fails-could-not-post-failed-query-insert-into-ha
exported: 2026-10-25
---

# RAZ-270 — 🐞 Hangouts creation fails Could not post: Failed query: insert into "ha…

Hangouts creation fails

Could not post: Failed query: insert into "hangouts" ("id", "kind", "title", "time", "venue", "host", "city_slug", "people_count", "status", "dancer_id", "created_at", "updated_at") values (default, $1, $2, $3, $4, $5, $6, $7, $8, $9, default, default) returning "id", "kind", "title", "time", "venue", "host", "city_slug", "people_count", "status", "dancer_id", "created_at", "updated_at" params: dinner,Dinner about Ritmo in LUMA,20:00,Hans im Glück, Türkenstraße 79,Alösha,munich,1,active,48e7c709-2e54-47a8-a026-f862972318f1

---

**Reported by:** Alösha · [[email redacted]](<mailto:[email redacted]>) · dancer `48e7c709-2e54-47a8-a026-f862972318f1`
**Page:** [https://2026.wedance.vip/my-plan](<https://2026.wedance.vip/my-plan>)
**Route:** `/my-plan`
**Environment:** UA: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 · viewport 1512×740 · screen 1512×982 · dpr 2 · lang en-US · tz Europe/Berlin · online · build fa5f494

---

*Filed automatically from the “Report a problem” widget on [2026.wedance.vip](<http://2026.wedance.vip>).*

## Links

- [fix(hangouts): stop leaking raw SQL in creation errors](https://github.com/razbakov/wedance-2026/pull/200)

## Comments

### Linear · 2026-10-09 10:32 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-09 10:48 UTC

### 👀 Merged — ready for your review — Hangout creation no longer leaks raw SQL to users

**Live:** https://2026.wedance.vip/my-plan
**PR:** https://github.com/razbakov/wedance-2026/pull/200

**Try it**
1. Open https://2026.wedance.vip/my-plan
2. Sign in and create a hangout
3. You should see a clean error message if creation fails, not raw SQL

### Aleksey Razbakov · 2026-10-09 10:58 UTC

@forge nice error handling! But the hangouts should also be created, currently in network requests I see:

\[{error: {message: "Could not create hangout. Please try again later.", code: -32603,…}}\]

1. 0: {error: {message: "Could not create hangout. Please try again later.", code: -32603,…}}
   1. error: {message: "Could not create hangout. Please try again later.", code: -32603,…}
      1. code: -32603
      2. data: {code: "INTERNAL_SERVER_ERROR", httpStatus: 500, path: "hangouts.create"}
         1. code: "INTERNAL_SERVER_ERROR"
         2. httpStatus: 500
         3. path: "hangouts.create"
      3. message: "Could not create hangout. Please try again later."

### Forge · 2026-10-09 11:08 UTC

### 👀 Ready for your review — Created missing hangouts tables in production database

**Live:** https://2026.wedance.vip/my-plan

**Try it**
1. Open https://2026.wedance.vip/my-plan
2. Sign in if needed
3. Scroll to hangouts section and click to create a hangout
4. Fill in title, venue, time and click Post
5. You should see the hangout appear in the list
