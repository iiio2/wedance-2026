---
title: "razbakov/wedance-2026 PR #317: Fix \"Copy flyer styles\" after changing an event's organizer"
type: Task
id: RAZ-388
status: in-progress
state: In Review
state_type: started
project: null
labels: []
assignee: "Aleksey Razbakov"
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-14T14:38:04.577Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-388/razbakovwedance-2026-pr-317-fix-copy-flyer-styles-after-changing-an
exported: 2026-10-25
---

# RAZ-388 — razbakov/wedance-2026 PR #317: Fix "Copy flyer styles" after changing an event's organizer

Tracking issue for [https://github.com/razbakov/wedance-2026/pull/317](<https://github.com/razbakov/wedance-2026/pull/317>) (opened without a Linear issue). Merged → In Review; the Commander verifies the deploy and moves it to Done.

## Comments

### Forge · 2026-10-14 14:53 UTC

The background `gh pr checks --watch` timed out (exit 124) because CodeRabbit never finished, but that's moot — the PR was already merged before the timeout. Gate complete, nothing to do.

### Linear · 2026-10-14 14:53 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-14 14:54 UTC

PR #317 is merged to main. The fix corrected a bug where "Copy flyer styles" failed with a validation error because the page sent `{ from, to }` instead of `{ fromUsername, toUsername }`. It also improved the prompt to name both profiles.

```json
{"status": "merged",
 "headline": "Copy flyer styles no longer fails after switching organizer",
 "live_url": "https://2026.wedance.vip/business/events",
 "steps": ["Open https://2026.wedance.vip/business/events/<id> for an event with an organizer", "Change the organizer to a different profile", "When prompted 'Copy flyer styles from X to Y?', click Copy styles", "You should see styles copied without error"],
 "internal": "",
 "answer": "",
 "followups": []}
```
