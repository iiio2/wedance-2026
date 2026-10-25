---
title: "🐞 it says \"Add photo for @djpapi-muc\", but djpapi-muc has photos added a…"
type: Task
id: RAZ-410
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
created: 2026-10-15T16:05:32.994Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/359"]
linear_url: https://linear.app/alosha/issue/RAZ-410/it-says-add-photo-for-djpapi-muc-but-djpapi-muc-has-photos-added-a
exported: 2026-10-25
---

# RAZ-410 — 🐞 it says "Add photo for @djpapi-muc", but djpapi-muc has photos added a…

it says "Add photo for @djpapi-muc", but djpapi-muc has photos added and selected

---

**Reported by:** Alösha · [[email redacted]](<mailto:[email redacted]>) · dancer `dbdd2215-4d40-43f3-b671-a9c51809cc6d`
**Page:** [https://2026.wedance.vip/business/events/1ed1a238-7c7c-474d-94ff-1656b08f9c73](<https://2026.wedance.vip/business/events/1ed1a238-7c7c-474d-94ff-1656b08f9c73>)
**Route:** `/business/events/1ed1a238-7c7c-474d-94ff-1656b08f9c73`
**Environment:** UA: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 · viewport 1512×740 · screen 1512×982 · dpr 2 · lang en-US · tz Europe/Berlin · online · build e4614c6

**Recent client errors:**

```
[16:02:24.939] console.error: Hydration completed but contains mismatches.
```

**Screenshot:**

![screenshot](https://uploads.linear.app/fa18dfe0-70d8-42bd-8c29-068ea5390b89/653cf126-435d-421b-bcf3-d38878d24839/94c3a716-81be-4ede-a5c4-9d95ca9fdaac)

---

*Filed automatically from the “Report a problem” widget on [2026.wedance.vip](<http://2026.wedance.vip>).*

## Links

- [fix: checklist considers gallery photos and event-level overrides](https://github.com/razbakov/wedance-2026/pull/359)

## Comments

### Linear · 2026-10-16 17:41 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-16 17:51 UTC

### 👀 Merged — ready for your review — Event editor no longer falsely flags artists who have photos

**Live:** https://2026.wedance.vip/business/events/1ed1a238-7c7c-474d-94ff-1656b08f9c73
**PR:** https://github.com/razbakov/wedance-2026/pull/359

**Try it**
1. Open the event editor for any event with artist photos
2. Look at the checklist section
3. You should see no false 'Add photo' warnings for artists who have gallery or event-level photos
