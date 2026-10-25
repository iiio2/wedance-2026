---
title: "🐞 Photo URL This is not user friendly. See in v4 we already have a good…"
type: Task
id: RAZ-275
status: done
state: Done
state_type: completed
project: "WeDance Support"
labels: ["user-report"]
assignee: "Tobiloba"
creator: "Aleksey Razbakov"
priority: "High"
estimate: null
parent: null
created: 2026-10-09T11:06:16.484Z
completed: "2026-10-12T14:26:12.158Z"
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/225"]
linear_url: https://linear.app/alosha/issue/RAZ-275/photo-url-this-is-not-user-friendly-see-in-v4-we-already-have-a-good
exported: 2026-10-25
---

# RAZ-275 — 🐞 Photo URL This is not user friendly. See in v4 we already have a good…

Photo URL

This is not user friendly. See in v4 we already have a good way of uploading photo and storing it in Cloudinary.

---

**Reported by:** Alösha · [[email redacted]](<mailto:[email redacted]>) · dancer `48e7c709-2e54-47a8-a026-f862972318f1`
**Page:** [https://2026.wedance.vip/settings](<https://2026.wedance.vip/settings>)
**Route:** `/settings`
**Environment:** UA: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 · viewport 1512×740 · screen 1512×982 · dpr 2 · lang en-US · tz Europe/Berlin · online · build ca7ba60

**Recent client errors:**

```
[11:02:26.020] console.error: Hydration completed but contains mismatches.
[11:02:26.500] console.error: Failed to fetch hangouts: TRPCClientError: Failed query: select "id", "kind", "title", "time", "venue", "host", "people_count", "status", "dancer_id", "created_at" from "hangouts" where ("hangouts"."city_slug" = $1 and "hangouts"."status" = $2) order by "hangouts"."created_at" desc
params: munich,active
TRPCClientError: Failed query: select "id", "kind", "title", "time", "venue", "host", "people_count", "status", "dancer_id", "created_at" from "hangouts" where ("hangouts"."city_slug" = $1 and "hangouts"."status" = $2) order by "hangouts"."created_at" desc
params: munich,active
    at Nc.from (https://2026.wedance.vip/_nuxt/4HjQCKps.js:7:10261)
    at https://2026.wedance.vip/_nuxt/4HjQCKps.js:7:15462
[11:02:57.767] console.error: Failed to fetch hangouts: TRPCClientError: Failed query: select "id", "kind", "title", "time", "venue", "host", "people_count", "status", "dancer_id", "created_at" from "hangouts" where ("hangouts"."city_slug" = $1 and "hangouts"."status" = $2) order by "hangouts"."created_at" desc
params: munich,active
TRPCClientError: Failed query: select "id", "kind", "title", "time", "venue", "host", "people_count", "status", "dancer_id", "created_at" from "hangouts" where ("hangouts"."city_slug" = $1 and "hangouts"."status" = $2) order by "hangouts"."created_at" desc
params: munich,active
    at Nc.from (https://2026.wedance.vip/_nuxt/4HjQCKps.js:7:10261)
    at https://2026.wedance.vip/_nuxt/4HjQCKps.js:7:15462
[11:03:00.247] console.error: Failed to fetch hangouts: TRPCClientError: Failed query: select "id", "kind", "title", "time", "venue", "host", "people_count", "status", "dancer_id", "created_at" from "hangouts" where ("hangouts"."city_slug" = $1 and "hangouts"."status" = $2) order by "hangouts"."created_at" desc
params: munich,active
TRPCClientError: Failed query: select "id", "kind", "title", "time", "venue", "host", "people_count", "status", "dancer_id", "created_at" from "hangouts" where ("hangouts"."city_slug" = $1 and "hangouts"."status" = $2) order by "hangouts"."created_at" desc
params: munich,active
    at Nc.from (https://2026.wedance.vip/_nuxt/4HjQCKps.js:7:10261)
    at https://2026.wedance.vip/_nuxt/4HjQCKps.js:7:15462
[11:03:03.817] console.error: Failed to fetch hangouts: TRPCClientError: Failed query: select "id", "kind", "title", "time", "venue", "host", "people_count", "status", "dancer_id", "created_at" from "hangouts" where ("hangouts"."city_slug" = $1 and "hangouts"."status" = $2) order by "hangouts"."created_at" desc
params: munich,active
TRPCClientError: Failed query: select "id", "kind", "title", "time", "venue", "host", "people_count", "status", "dancer_id", "created_at" from "hangouts" where ("hangouts"."city_slug" = $1 and "hangouts"."status" = $2) order by "hangouts"."created_at" desc
params: munich,active
    at Nc.from (https://2026.wedance.vip/_nuxt/4HjQCKps.js:7:10261)
    at https://2026.wedance.vip/_nuxt/4HjQCKps.js:7:15462
[11:03:07.284] console.error: Failed to fetch hangouts: TRPCClientError: Failed query: select "id", "kind", "title", "time", "venue", "host", "people_count", "status", "dancer_id", "created_at" from "hangouts" where ("hangouts"."city_slug" = $1 and "hangouts"."status" = $2) order by "hangouts"."created_at" desc
params: munich,active
TRPCClientError: Failed query: select "id", "kind", "title", "time", "venue", "host", "people_count", "status", "dancer_id", "created_at" from "hangouts" where ("hangouts"."city_slug" = $1 and "hangouts"."status" = $2) order by "hangouts"."created_at" desc
params: munich,active
    at Nc.from (https://2026.wedance.vip/_nuxt/4HjQCKps.js:7:10261)
    at https://2026.wedance.vip/_nuxt/4HjQCKps.js:7:15462
[11:03:16.836] console.error: Failed to fetch hangouts: TRPCClientError: Failed query: select "id", "kind", "title", "time", "venue", "host", "people_count", "status", "dancer_id", "created_at" from "hangouts" where ("hangouts"."city_slug" = $1 and "hangouts"."status" = $2) order by "hangouts"."created_at" desc
params: munich,active
TRPCClientError: Failed query: select "id", "kind", "title", "time", "venue", "host", "people_count", "status", "dancer_id", "created_at" from "hangouts" where ("hangouts"."city_slug" = $1 and "hangouts"."status" = $2) order by "hangouts"."created_at" desc
params: munich,active
    at Nc.from (https://2026.wedance.vip/_nuxt/4HjQCKps.js:7:10261)
    at https://2026.wedance.vip/_nuxt/4HjQCKps.js:7:15462
```

---

*Filed automatically from the “Report a problem” widget on [2026.wedance.vip](<http://2026.wedance.vip>).*

## Links

- [Replace Photo URL input with drag-drop image upload](https://github.com/razbakov/wedance-2026/pull/225)

## Comments

### Linear · 2026-10-09 16:02 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-09 16:10 UTC

### 👀 Ready for your review — Photo upload replaces raw URL input on settings page

**Live:** https://2026.wedance.vip/settings

**Try it**
1. Open https://2026.wedance.vip/settings
2. Scroll to the Photo field — you should see a drag-drop upload zone instead of a URL text box
3. Drop or click to upload an image — it uploads to Cloudinary and shows a preview
4. Click Save changes — the photo persists and shows on your profile

### Forge · 2026-10-09 16:18 UTC

### 👀 Merged — ready for your review — Photo upload replaces raw URL input on settings page

**Live:** https://2026.wedance.vip/settings
**PR:** https://github.com/razbakov/wedance-2026/pull/225

**Try it**
1. Open https://2026.wedance.vip/settings
2. Scroll to the Photo field — you should see a drag-drop upload zone instead of a URL text box
3. Drop or click to upload an image — it uploads to Cloudinary and shows a preview
4. Click Save changes — the photo persists and shows on your profile

**Follow-ups:** RAZ-288, RAZ-289

### Tobiloba · 2026-10-12 14:17 UTC

@forge  configure  the image upload. When I click on upload picture and I choose the image that I want to upload it shows a loading stage that says uploading and then returns an error message  saying "image upload is not configured"

### Tobiloba · 2026-10-12 14:17 UTC

@forge  configure  the image upload. When I click on upload picture and I choose the image that I want to upload it shows a loading stage that says uploading and then returns an error message  saying "image upload is not configured"

### Forge · 2026-10-12 14:22 UTC

### 👀 Ready for your review — Cloudinary env vars added to Vercel — photo upload works

**Live:** https://2026.wedance.vip/settings

**Try it**
1. Open https://2026.wedance.vip/settings
2. Click 'Upload picture' and select an image
3. You should see the image preview appear (no error)
