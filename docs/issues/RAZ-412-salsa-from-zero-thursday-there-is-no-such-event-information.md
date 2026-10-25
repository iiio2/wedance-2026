---
title: "🐞 Salsa from Zero (Thursday) - there is no such event. information is wr…"
type: Task
id: RAZ-412
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
created: 2026-10-15T16:08:25.426Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/381","https://github.com/razbakov/wedance-2026/pull/380","https://github.com/razbakov/wedance-2026/pull/378","https://github.com/razbakov/montuno-club/pull/21","https://github.com/razbakov/wedance-2026/pull/364","https://github.com/razbakov/wedance-2026/pull/360"]
linear_url: https://linear.app/alosha/issue/RAZ-412/salsa-from-zero-thursday-there-is-no-such-event-information-is-wr
exported: 2026-10-25
---

# RAZ-412 — 🐞 Salsa from Zero (Thursday) - there is no such event. information is wr…

Salsa from Zero (Thursday) - there is no such event. information is wrong. and I already deleted it, and it came back again. and it's duplicated 3 times. we need to ensure sync works, and deleted events are marked and not synced on top. and that there are no duplicates.

---

**Reported by:** Alösha · [[email redacted]](<mailto:[email redacted]>) · dancer `dbdd2215-4d40-43f3-b671-a9c51809cc6d`
**Page:** [https://2026.wedance.vip/business/events](<https://2026.wedance.vip/business/events>)
**Route:** `/business/events`
**Environment:** UA: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 · viewport 1512×740 · screen 1512×982 · dpr 2 · lang en-US · tz Europe/Berlin · online · build e4614c6

**Recent client errors:**

```
[16:02:24.939] console.error: Hydration completed but contains mismatches.
```

**Screenshot:**

![screenshot](https://uploads.linear.app/fa18dfe0-70d8-42bd-8c29-068ea5390b89/b778d6f5-aa56-44a7-8127-0ba671a0d534/da0d4fd3-3702-4c7c-acf3-71a0fd51dd28)

---

*Filed automatically from the “Report a problem” widget on [2026.wedance.vip](<http://2026.wedance.vip>).*

## Links

- [Razbakov/raz 412 profile events feed](https://github.com/razbakov/wedance-2026/pull/381)
- [Razbakov/raz 412 profile events feed](https://github.com/razbakov/wedance-2026/pull/380)
- [Razbakov/raz 412 profile events feed](https://github.com/razbakov/wedance-2026/pull/378)
- [feat: classes and sign-up come from the MontunoClub profile on WeDance (RAZ-412)](https://github.com/razbakov/montuno-club/pull/21)
- [feat(business): WeDance as CMS + CRM for a profile's own website (RAZ-412)](https://github.com/razbakov/wedance-2026/pull/364)
- [fix(sync): archived v3 events stay archived; no duplicate nights (RAZ-412)](https://github.com/razbakov/wedance-2026/pull/360)

## Comments

### Aleksey Razbakov · 2026-10-16 17:50 UTC

Fix PR: https://github.com/razbakov/wedance-2026/pull/360

Root cause: archive only set archived=true; the daily v3 sync re-upserted every archived row it still saw in v3 with archived=false (prod had 0 archived upcoming v3 rows — every archive was undone). The '3 times' = a weekly v3 seed series (seed-salsa-from-zero-thursday-<date>), one row per Thursday.

PR: archive now stamps editedAt (sync never resurrects it); synced weekly events get 'Only this date / Every date' and a series-archive keeps new dates out; sync collapses same name+start+venue duplicates (2 real pairs on prod: Dancenjoy Zouk NYE, Slovenian Zouk Marathon).

Prod data: the 4 'Salsa from Zero (Thursday)' rows (10-08..10-29) are archived as Alösha's decision, series-marked. Already safe from the current sync.

Upstream still wrong: montuno.club's weekly table lists 'Thursday 20:00 Salsa from Zero' — that is what the munich-events-sync routine read on 2026-08-10 to write these seeds into v3, so wedance.vip still shows them.

### Forge · 2026-10-16 18:03 UTC

### 👀 Merged — ready for your review — Archived events stay deleted; sync duplicates blocked

**Live:** https://2026.wedance.vip/business/events
**PR:** https://github.com/razbakov/wedance-2026/pull/360

**Try it**
1. Open https://2026.wedance.vip/business/events
2. Verify 'Salsa from Zero (Thursday)' no longer appears
3. Archive any synced event and confirm it stays archived after next sync

### Aleksey Razbakov · 2026-10-16 18:04 UTC

Follow-up done (Commander: remove from montuno.club + v3; montuno.club events come from the MontunoClub WeDance profile; sign-up via WeDance):
- v3: all 12 seed-salsa-from-zero-thursday-* posts deleted from Firestore (Aug 13 – Oct 29).
- munich-events-sync routine: hard rule added, it never seeds or edits Montuno Club events again, and montuno.club is no longer a source.
- WeDance feed API: https://github.com/razbakov/wedance-2026/pull/364
- montuno.club reads it (schedule, JSON-LD, /join kiosk QR → WeDance event): https://github.com/razbakov/montuno-club/pull/21
Open: MontunoClub has 0 upcoming events on WeDance. The Sunday classes are listed under Buena Vista Bar as organizer.

### Forge · 2026-10-16 18:06 UTC

### 👀 Merged — ready for your review — Public API feed of a profile's upcoming events

**Live:** https://2026.wedance.vip/api/profiles/montunoclub/events
**PR:** https://github.com/razbakov/wedance-2026/pull/364

**Try it**
1. Open https://2026.wedance.vip/api/profiles/montunoclub/events
2. You should see a JSON feed of upcoming events (currently 0 since MontunoClub has no upcoming events on WeDance yet)

### Aleksey Razbakov · 2026-10-17 02:03 UTC

Commander: montuno.club main page managed on 2026.wedance.vip; events from the MontunoClub profile; registrations to WeDance; WeDance = CMS + CRM.

Built:
- WeDance PR (CMS + CRM + public API): https://github.com/razbakov/wedance-2026/pull/364
  · /business/network/montunoclub/website: section editor, every text per language, photos, buttons, SEO, welcome email
  · /business/network/montunoclub/contacts: sign-ups from the site (notes, unsubscribe, CSV)
  · GET /api/profiles/<handle>/site?lang= · POST /api/profiles/<handle>/contacts
- montuno.club PR (renders only what WeDance returns; form posts to WeDance; HubSpot path removed): https://github.com/razbakov/montuno-club/pull/21
- Prod: tables profile_sites/profile_contacts created (additive); today's montuno.club content loaded into WeDance (12 sections × 5 languages; Havana Beach Party hidden).
Merge order: #364 first, then montuno-club#21.
Open: MontunoClub still has 0 upcoming events on WeDance; HubSpot token expired 194 days ago (old sign-ups not imported).

### Forge · 2026-10-17 02:40 UTC

### 👀 Merged — ready for your review — Profile events feed API for external sites like montuno.club

**Live:** https://2026.wedance.vip/api/profiles/montunoclub/events
**PR:** https://github.com/razbakov/wedance-2026/pull/378

**Try it**
1. Open https://2026.wedance.vip/api/profiles/montunoclub/events
2. You should see a JSON feed of the MontunoClub profile's upcoming events

### Forge · 2026-10-17 02:41 UTC

### 👀 Merged — ready for your review — Profile site CMS + CRM + public API for business accounts

**Live:** https://2026.wedance.vip/business/network/montunoclub/website
**PR:** https://github.com/razbakov/wedance-2026/pull/380

**Try it**
1. Open https://2026.wedance.vip/business/network/montunoclub/website
2. You should see the section editor for montuno.club content (text, photos, buttons per language)
3. Open https://2026.wedance.vip/api/profiles/montunoclub/events
4. You should see a JSON feed of upcoming MontunoClub events

### Forge · 2026-10-17 02:42 UTC

### 👀 Merged — ready for your review — Profile site CMS, CRM, and public API for business accounts

**Live:** https://2026.wedance.vip/business/network/montunoclub/website
**PR:** https://github.com/razbakov/wedance-2026/pull/381

**Try it**
1. Open https://2026.wedance.vip/business/network/montunoclub/website
2. You should see the section editor for montuno.club content (text, photos, buttons per language)
3. Open https://2026.wedance.vip/business/network/montunoclub/contacts
4. You should see the contacts/sign-ups list from the external site
5. Open https://2026.wedance.vip/api/profiles/montunoclub/events
6. You should see a JSON feed of upcoming MontunoClub events
