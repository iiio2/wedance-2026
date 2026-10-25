---
title: "🐞 I'm not seeing the images of the artists in the lineup section"
type: Task
id: RAZ-298
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
created: 2026-10-11T09:42:38.666Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/273"]
linear_url: https://linear.app/alosha/issue/RAZ-298/im-not-seeing-the-images-of-the-artists-in-the-lineup-section
exported: 2026-10-25
---

# RAZ-298 — 🐞 I'm not seeing the images of the artists in the lineup section

I'm not seeing the images of the artists in the lineup section

---

**Reported by:** Tobiloba Eleto · [[email redacted]](<mailto:[email redacted]>) · dancer `5ad74cef-9a29-4700-aec2-9489b63eee66`
**Page:** [https://2026.wedance.vip/festivals/cuban-fire-munich-2026#discover](<https://2026.wedance.vip/festivals/cuban-fire-munich-2026#discover>)
**Route:** `/festivals/cuban-fire-munich-2026#discover`
**Environment:** UA: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 · viewport 1041×636 · screen 1280×720 · dpr 1.5 · lang en-US · tz Africa/Lagos · online · build c1b38c9

**Recent client errors:**

```
[09:38:31.517] console.error: Hydration completed but contains mismatches.
```

---

*Filed automatically from the “Report a problem” widget on [2026.wedance.vip](<http://2026.wedance.vip>).*

## Links

- [fix: add image fallback for artist photos when loading fails](https://github.com/razbakov/wedance-2026/pull/273)

## Comments

### Linear · 2026-10-11 13:19 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-11 13:29 UTC

### 👀 Merged — ready for your review — Artist images now show initials fallback when loading fails

**Live:** https://2026.wedance.vip/festivals/cuban-fire-munich-2026#discover
**PR:** https://github.com/razbakov/wedance-2026/pull/273

**Try it**
1. Open https://2026.wedance.vip/festivals/cuban-fire-munich-2026#discover
2. Scroll to the lineup section
3. You should see artist photos or their initials in a styled circle if the image can't load

### Aleksey Razbakov · 2026-10-16 16:44 UTC

@tobilobaeleto595 now we have event editor where organizers can upload artists photos
