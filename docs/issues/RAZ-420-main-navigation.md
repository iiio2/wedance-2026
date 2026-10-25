---
title: "Main navigation"
type: Task
id: RAZ-420
status: in-progress
state: In Review
state_type: started
project: "WeDance UX"
labels: []
assignee: null
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-16T12:35:38.978Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-420/main-navigation
exported: 2026-10-25
---

# RAZ-420 — Main navigation

**Sketch:** [https://2026.wedance.vip/sketches/nav](<https://2026.wedance.vip/sketches/nav>)
**All sketches:** [https://2026.wedance.vip/sketches](<https://2026.wedance.vip/sketches>)

## Why

SiteHeader showed only Festivals + Cities; signed-in links were all hidden on phones, and Artists / Find your dance / My year weren't reachable from the header.

## Options

- [ ] **A · Clear top bar + account menu** — Public sections as links, personal and business links in one account menu.
- [ ] **B · App-style tab bar** — Bottom tab bar on phones (Explore · Cities · My plan · Me).
- [ ] **C · Dancers / Business split** — A switch changes the whole menu between two audiences.
- [ ] **D · Search-first** — One central search box; sections become chips.
- [X] **E · A on desktop + B on phones** — Desktop top bar with account menu; phone tab bar with section chips inside Explore.

**Recommendation:** E

## Decision

**E — A on desktop + B on phones.** Shipped in [https://github.com/razbakov/wedance-2026/pull/341](<https://github.com/razbakov/wedance-2026/pull/341>) (with RAZ-408). Recorded after the fact; verify and move to Done.
