---
title: "RAZ-670 follow-up: use bun.lockb hash for Playwright cache key"
type: Task
id: RAZ-671
status: triage
state: Triage
state_type: triage
project: "WeDance CUJ"
labels: []
assignee: null
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-23T21:34:01.523Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-671/raz-670-follow-up-use-bunlockb-hash-for-playwright-cache-key
exported: 2026-10-25
---

# RAZ-671 — RAZ-670 follow-up: use bun.lockb hash for Playwright cache key

CodeRabbit suggested using hashFiles('bun.lockb') instead of hashFiles('package.json') for the Playwright browser cache key in .github/workflows/test.yml:212. The lockfile hash invalidates the cache when the resolved Playwright version changes (e.g. via patch bump), whereas package.json only changes on a semver range edit. From PR [https://github.com/razbakov/wedance-2026/pull/429](<https://github.com/razbakov/wedance-2026/pull/429>)
