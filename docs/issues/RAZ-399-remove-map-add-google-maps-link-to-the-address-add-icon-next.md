---
title: "🐞 remove map, add google maps link to the address, add icon next"
type: Task
id: RAZ-399
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
created: 2026-10-14T18:21:32.517Z
completed: "2026-10-14T23:14:44.091Z"
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/337","https://github.com/razbakov/wedance-2026/pull/336"]
linear_url: https://linear.app/alosha/issue/RAZ-399/remove-map-add-google-maps-link-to-the-address-add-icon-next
exported: 2026-10-25
---

# RAZ-399 — 🐞 remove map, add google maps link to the address, add icon next

remove map, add google maps link to the address, add icon next

---

**Reported by:** Alösha · [[email redacted]](<mailto:[email redacted]>) · dancer `dbdd2215-4d40-43f3-b671-a9c51809cc6d`
**Page:** [https://2026.wedance.vip/events/la-clave-thursday-1ed1a238](<https://2026.wedance.vip/events/la-clave-thursday-1ed1a238>)
**Route:** `/events/la-clave-thursday-1ed1a238`
**Environment:** UA: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 · viewport 1216×740 · screen 1512×982 · dpr 2 · lang en-US · tz Europe/Berlin · online · build ea9ffbf

**Recent client errors:**

```
[18:20:21.611] console.error: Hydration completed but contains mismatches.
```

**Screenshot:**

![screenshot](https://uploads.linear.app/fa18dfe0-70d8-42bd-8c29-068ea5390b89/90a0a298-c450-4ee9-8ffc-fc78be67a5b6/347e13d7-e2fd-4206-8d46-5542be4b743d)

---

*Filed automatically from the “Report a problem” widget on [2026.wedance.vip](<http://2026.wedance.vip>).*

## Links

- [fix: use venue name+address for Google Maps links instead of 0,0 coords](https://github.com/razbakov/wedance-2026/pull/337)
- [fix: replace map embed with Google Maps link on venue address](https://github.com/razbakov/wedance-2026/pull/336)

## Comments

### Linear · 2026-10-14 22:24 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-14 22:35 UTC

### 👀 Merged — ready for your review — Venue address is now a clickable Google Maps link

**Live:** https://2026.wedance.vip/events/la-clave-thursday-1ed1a238
**PR:** https://github.com/razbakov/wedance-2026/pull/336

**Try it**
1. Open https://2026.wedance.vip/events/la-clave-thursday-1ed1a238
2. Scroll to the venue address
3. You should see the address as a clickable link with an external-link icon — no map embed

### Aleksey Razbakov · 2026-10-14 22:48 UTC

@forge link to map opens coordinates 0,0. It should open the venue name + address on google maps

### Forge · 2026-10-14 22:56 UTC

### 👀 Merged — ready for your review — Venue address now links to Google Maps by name, not 0,0 coords

**Live:** https://2026.wedance.vip/events/la-clave-thursday-1ed1a238
**PR:** https://github.com/razbakov/wedance-2026/pull/337

**Try it**
1. Open https://2026.wedance.vip/events/la-clave-thursday-1ed1a238
2. Scroll to the venue address section
3. Click the address link — it should open Google Maps searching for the venue name + address (e.g. Luma, Neuhauser Str. 47, München), not coordinates 0,0
