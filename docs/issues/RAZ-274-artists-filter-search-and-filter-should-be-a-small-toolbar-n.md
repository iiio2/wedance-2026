---
title: "🐞 Artists filter Search and filter should be a small toolbar, not takin…"
type: Task
id: RAZ-274
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
created: 2026-10-09T10:49:34.292Z
completed: "2026-10-09T14:50:39.705Z"
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/209","https://github.com/razbakov/wedance-2026/pull/205"]
linear_url: https://linear.app/alosha/issue/RAZ-274/artists-filter-search-and-filter-should-be-a-small-toolbar-not-takin
exported: 2026-10-25
---

# RAZ-274 — 🐞 Artists filter Search and filter should be a small toolbar, not takin…

Artists filter

Search and filter should be a small toolbar, not taking the full page. I should already see all nice cards of artists when I enter the page

---

**Reported by:** Anonymous visitor · not signed in
**Page:** [https://2026.wedance.vip/artists](<https://2026.wedance.vip/artists>)
**Route:** `/artists`
**Environment:** UA: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 · viewport 1512×740 · screen 1512×982 · dpr 2 · lang en-US · tz Europe/Berlin · online · build 9b714b7

---

*Filed automatically from the “Report a problem” widget on [2026.wedance.vip](<http://2026.wedance.vip>).*

## Links

- [fix(artists): restore hero + dropdown filters (RAZ-274)](https://github.com/razbakov/wedance-2026/pull/209)
- [fix(artists): collapse hero into compact sticky toolbar](https://github.com/razbakov/wedance-2026/pull/205)

## Comments

### Linear · 2026-10-09 10:58 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-09 11:08 UTC

### 👀 Ready for your review — Artists page shows cards immediately — hero collapsed to sticky toolbar

**Live:** https://2026.wedance.vip/artists

**Try it**
1. Open https://2026.wedance.vip/artists
2. You should see artist cards immediately without scrolling
3. Search, city, and style filters are in a compact toolbar at the top
4. Scroll down — the toolbar sticks to the top so filters stay accessible

### Forge · 2026-10-09 11:09 UTC

### 👀 Merged — ready for your review — Artists page shows cards immediately — hero collapsed to sticky toolbar

**Live:** https://2026.wedance.vip/artists
**PR:** https://github.com/razbakov/wedance-2026/pull/205

**Try it**
1. Open https://2026.wedance.vip/artists
2. You should see artist cards immediately without scrolling
3. Search, city, and style filters are in a compact toolbar at the top
4. Scroll down — the toolbar sticks to the top so filters stay accessible

### Aleksey Razbakov · 2026-10-09 11:12 UTC

Instead of long lines of cities and dance styles, can be dropdown, no? And the hero of the page was good, it was explaining what the page is about - now it's gone.

### Aleksey Razbakov · 2026-10-09 11:13 UTC

@forge

### Aleksey Razbakov · 2026-10-09 11:13 UTC

@forge

### Forge · 2026-10-09 11:25 UTC

### 👀 Merged — ready for your review — Artists page hero restored, filters changed to compact dropdowns

**Live:** https://2026.wedance.vip/artists
**PR:** https://github.com/razbakov/wedance-2026/pull/209

**Try it**
1. Open https://2026.wedance.vip/artists
2. You should see the 'Who moves the floor' hero heading at the top
3. City and style filters appear as dropdown selects, not long chip rows
4. Artist cards are visible immediately below the filters
