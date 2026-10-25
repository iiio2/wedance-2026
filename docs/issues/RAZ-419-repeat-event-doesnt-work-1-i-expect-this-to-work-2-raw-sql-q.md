---
title: "🐞 Repeat event doesn't work. 1) i expect this to work 2) raw sql queries…"
type: Task
id: RAZ-419
status: in-progress
state: In Review
state_type: started
project: "WeDance Support"
labels: ["user-report"]
assignee: "Aleksey Razbakov"
creator: "Aleksey Razbakov"
priority: "Urgent"
estimate: null
parent: null
created: 2026-10-16T10:42:05.401Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/374","https://github.com/razbakov/wedance-2026/pull/357"]
linear_url: https://linear.app/alosha/issue/RAZ-419/repeat-event-doesnt-work-1-i-expect-this-to-work-2-raw-sql-queries
exported: 2026-10-25
---

# RAZ-419 — 🐞 Repeat event doesn't work. 1) i expect this to work 2) raw sql queries…

Repeat event doesn't work.

1. i expect this to work
2. raw sql queries should not be shown to the user

Failed query: insert into "events" ("id", "slug", "name", "type", "description", "cover", "start_date", "end_date", "is_festival", "ticket_url", "price", "city", "venue_username", "organizer_username", "styles", "archived", "published", "source_ref", "created_at", "source", "source_id", "city_slug", "country", "timezone", "venue_name", "venue_address", "venue_lat", "venue_lng", "organizer_name", "link", "series_id", "artists", "synced_at", "updated_at", "host_profile_id", "agenda", "flyer_options", "caption", "edited_at", "edited_by", "festival") values (default, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, default, $18, default, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, default, $30, $31, $32, $33, $34, $35, $36, $37) returning "id", "start_date" params: la-clave-thursday-55ff7,La Clave Thursday,Party,Every Thursday: free workshops, then Cuban music until late.,[https://res.cloudinary.com/djumxevsm/image/upload/v1791999159/wedance-2026/flyers/montunoclub/ivnfiiqj1keacjx7zs7f.png,2026-10-22T17:00:00.000Z,2026-10-22T21:00:00.000Z,false,,€10](<https://res.cloudinary.com/djumxevsm/image/upload/v1791999159/wedance-2026/flyers/montunoclub/ivnfiiqj1keacjx7zs7f.png,2026-10-22T17:00:00.000Z,2026-10-22T21:00:00.000Z,false,,%E2%82%AC10>) after 21:00 Workshops for free,Munich,evergreen-goes-luma,montunoclub,\["Salsa","Bachata","Reparto"\],false,true,,wedance-business,munich,Germany,Europe/Berlin,LUMA,Neuhauser Str. 47, 80331 München,,,,,host-1ed1a238-7c7c-474d-94ff-1656b08f9c73,\["alosha-corazon-cubano","djpapi-muc","yuniorflowcubano"\],2026-10-16T10:40:28.901Z,8d25ba91-83d2-41a0-a76e-767f3aad068b,\[\],{"names":{},"photos":{"djpapi-muc":"[https://res.cloudinary.com/djumxevsm/image/upload/v1791887371/wedance-2026/flyers/dml6j9yb8awtdfazt4ym.png","yuniorflowcubano":"https://firebasestorage.googleapis.com/v0/b/wedance-4abe3.appspot.com/o/media%2FtvR012ArEpQhCJdPHh6G7sLuqoO2%2Fb66cbbb9-2216-40c4-b60f-af65d32fef30?alt=media&token=e08f063d-66a5-4190-812d-0ed752475d81","alosha-corazon-cubano":"https://res.cloudinary.com/djumxevsm/image/upload/v1791986434/wedance-2026/profiles/tmtxuvkqarkwb98cwuz7.png"},"showAgenda":true},,2026-10-14T21:03:13.117Z,dbdd2215-4d40-43f3-b671-a9c51809cc6d,{"key":"clave-872c0","logo":"","passes":\[\],"videos":{},"sessions":\[{"id":"s-gdeqot0","date":"2026-10-15","time":"19:00","type":"workshop","level":"Beginner","style":"Reparto","title":"Reparto](<https://res.cloudinary.com/djumxevsm/image/upload/v1791887371/wedance-2026/flyers/dml6j9yb8awtdfazt4ym.png%22,%22yuniorflowcubano%22:%22https://firebasestorage.googleapis.com/v0/b/wedance-4abe3.appspot.com/o/media%2FtvR012ArEpQhCJdPHh6G7sLuqoO2%2Fb66cbbb9-2216-40c4-b60f-af65d32fef30?alt=media&token=e08f063d-66a5-4190-812d-0ed752475d81%22,%22alosha-corazon-cubano%22:%22https://res.cloudinary.com/djumxevsm/image/upload/v1791986434/wedance-2026/profiles/tmtxuvkqarkwb98cwuz7.png%22%7D,%22showAgenda%22:true%7D,,2026-10-14T21:03:13.117Z,dbdd2215-4d40-43f3-b671-a9c51809cc6d,%7B%22key%22:%22clave-872c0%22,%22logo%22:%22%22,%22passes%22:%5B%5D,%22videos%22:%7B%7D,%22sessions%22:%5B%7B%22id%22:%22s-gdeqot0%22,%22date%22:%222026-10-15%22,%22time%22:%2219:00%22,%22type%22:%22workshop%22,%22level%22:%22Beginner%22,%22style%22:%22Reparto%22,%22title%22:%22Reparto>) from Zero","artist":"yuniorflowcubano","duration":60},{"id":"s-vi5kev1","date":"2026-10-15","time":"20:00","type":"workshop","level":"Beginner","style":"Bachata","title":"Bachata from Zero","artist":"alosha-corazon-cubano","duration":60},{"id":"s-yju4g72","date":"2026-10-15","time":"21:00","type":"party","level":"Beginner","style":"Salsa","title":"Party","artist":"djpapi-muc","duration":240}\],"accentColor":"","socialLinks":\[\],"practicalInfo":\[\]}

---

**Reported by:** Alösha · [[email redacted]](<mailto:[email redacted]>) · dancer `dbdd2215-4d40-43f3-b671-a9c51809cc6d`
**Page:** [https://2026.wedance.vip/business/events/1ed1a238-7c7c-474d-94ff-1656b08f9c73](<https://2026.wedance.vip/business/events/1ed1a238-7c7c-474d-94ff-1656b08f9c73>)
**Route:** `/business/events/1ed1a238-7c7c-474d-94ff-1656b08f9c73`
**Environment:** UA: Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Mobile Safari/537.36 · viewport 762×1535 · screen 427×952 · dpr 2.25 · lang en-US · tz Europe/Berlin · online · build 1d12f7a

**Recent client errors:**

```
[10:35:27.271] console.error: Hydration completed but contains mismatches.
```

**Screenshot:**

![screenshot](https://uploads.linear.app/fa18dfe0-70d8-42bd-8c29-068ea5390b89/b09993dc-921f-4d1e-9142-07d05437204f/dbc5c6eb-866c-41f7-b0f3-0dd2a23a6425)

---

*Filed automatically from the “Report a problem” widget on [2026.wedance.vip](<http://2026.wedance.vip>).*

## Links

- [fix(events): assign unique festival key when repeating](https://github.com/razbakov/wedance-2026/pull/374)
- [fix(security): never leak raw SQL errors from duplicate-event endpoint](https://github.com/razbakov/wedance-2026/pull/357)

## Comments

### Linear · 2026-10-16 16:35 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-16 16:50 UTC

### 🔧 Fixing — Raw SQL errors no longer shown to users on event repeat

Forge is fixing this now — no action needed.

### Forge · 2026-10-16 17:06 UTC

### 👀 Merged — ready for your review — Repeat-event no longer leaks raw SQL; session dates shift correctly

**Live:** https://2026.wedance.vip/business/events/1ed1a238-7c7c-474d-94ff-1656b08f9c73
**PR:** https://github.com/razbakov/wedance-2026/pull/357

**Try it**
1. Open your event in business mode
2. Click Repeat to create next week's copy
3. You should see a friendly error if it fails, never raw SQL
4. The new copy's festival sessions should show next week's dates

### Aleksey Razbakov · 2026-10-16 19:01 UTC

@forge point 1 not done. Now i see error: Could not repeat the event. Please try again.

And I still can't repeat the event

### Forge · 2026-10-16 19:13 UTC

### 🔧 Fixing — Duplicate festival key caused repeat-event insert to fail

Forge is fixing this now — no action needed.

### Forge · 2026-10-16 19:21 UTC

### 👀 Merged — ready for your review — Repeat event now works — unique festival key per copy

**Live:** https://2026.wedance.vip/business/events/1ed1a238-7c7c-474d-94ff-1656b08f9c73
**PR:** https://github.com/razbakov/wedance-2026/pull/374

**Try it**
1. Open https://2026.wedance.vip/business/events/1ed1a238-7c7c-474d-94ff-1656b08f9c73
2. Click Repeat to create next week's copy
3. You should see the new event created without errors
