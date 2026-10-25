---
title: "razbakov/wedance-2026 PR #430: fix(flyer): keep the real artist on flyers; log every LLM prompt for admins"
type: Task
id: RAZ-672
status: in-progress
state: In Review
state_type: started
project: null
labels: []
assignee: null
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-25T10:07:17.346Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-672/razbakovwedance-2026-pr-430-fixflyer-keep-the-real-artist-on-flyers
exported: 2026-10-25
---

# RAZ-672 — razbakov/wedance-2026 PR #430: fix(flyer): keep the real artist on flyers; log every LLM prompt for admins

Tracking issue for [https://github.com/razbakov/wedance-2026/pull/430](<https://github.com/razbakov/wedance-2026/pull/430>) (opened without a Linear issue). Merged → In Review; the Commander verifies the deploy and moves it to Done.

## Comments

### Forge · 2026-10-25 10:18 UTC

### 👀 Merged — ready for your review — Flyers keep the real artist photo; admins can read every AI prompt

**Live:** https://2026.wedance.vip/admin/ai-usage
**PR:** https://github.com/razbakov/wedance-2026/pull/430

**Try it**
1. Open https://2026.wedance.vip/admin/ai-usage as an admin
2. Click any recent AI call that shows "Prompt" under its cost
3. You should see the exact prompt that was sent, with [image N: …] markers where the photos were
4. Make a flyer for an event with a pictured artist: the flyer shows that artist, not a different person

**Follow-ups:** RAZ-674
