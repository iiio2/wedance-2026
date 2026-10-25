---
title: "🐞 I sign in, refresh the page - I am no longer signed in."
type: Task
id: RAZ-273
status: done
state: Done
state_type: completed
project: "WeDance Support"
labels: ["user-report"]
assignee: "Aleksey Razbakov"
creator: "Aleksey Razbakov"
priority: "Urgent"
estimate: null
parent: null
created: 2026-10-09T10:36:52.903Z
completed: "2026-10-16T16:33:23.650Z"
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/224","https://github.com/razbakov/wedance-2026/pull/208","https://github.com/razbakov/wedance-2026/pull/203"]
linear_url: https://linear.app/alosha/issue/RAZ-273/i-sign-in-refresh-the-page-i-am-no-longer-signed-in
exported: 2026-10-25
---

# RAZ-273 — 🐞 I sign in, refresh the page - I am no longer signed in.

I sign in, refresh the page - I am no longer signed in.

---

**Reported by:** Anonymous visitor · [[email redacted]](<mailto:[email redacted]>) · not signed in
**Page:** [https://2026.wedance.vip/my-plan](<https://2026.wedance.vip/my-plan>)
**Route:** `/my-plan`
**Environment:** UA: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 · viewport 1512×740 · screen 1512×982 · dpr 2 · lang en-US · tz Europe/Berlin · online · build fa5f494

---

*Filed automatically from the “Report a problem” widget on [2026.wedance.vip](<http://2026.wedance.vip>).*

## Links

- [fix(auth): eliminate signed-in header blink on page refresh](https://github.com/razbakov/wedance-2026/pull/224)
- [fix(auth): cache auth state to eliminate sign-in blink on refresh (RAZ-273)](https://github.com/razbakov/wedance-2026/pull/208)
- [fix(auth): preserve session cookie across page refreshes (RAZ-273)](https://github.com/razbakov/wedance-2026/pull/203)

## Comments

### Linear · 2026-10-09 10:37 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-09 11:05 UTC

### 👀 Merged — ready for your review — Sign-in now survives page refresh

**Live:** https://2026.wedance.vip/my-plan
**PR:** https://github.com/razbakov/wedance-2026/pull/203

**Try it**
1. Open https://2026.wedance.vip
2. Sign in with your account
3. Refresh the page
4. You should still be signed in

### Aleksey Razbakov · 2026-10-09 11:09 UTC

It blinks. It takes time to show that I am signed in. I think it should cache the state and read it first, while the actual auth check happens in background. We need to improve UX, and let user feel that page works fast.

### Linear · 2026-10-09 11:09 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-09 11:24 UTC

### 👀 Merged — ready for your review — Sign-in no longer blinks on page refresh

**Live:** https://2026.wedance.vip/my-plan
**PR:** https://github.com/razbakov/wedance-2026/pull/208

**Try it**
1. Open https://2026.wedance.vip
2. Sign in with your account
3. Refresh the page
4. You should stay signed in instantly — no blink or flash of signed-out UI

### Aleksey Razbakov · 2026-10-09 14:48 UTC

Still blinking: I am signed in. I reload page - I shortly see main nav as for not-logged-in. That shouldn't happen

### Linear · 2026-10-09 14:48 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-09 15:01 UTC

### 👀 Merged — ready for your review — Sign-in no longer blinks on page refresh

**Live:** https://2026.wedance.vip/my-plan
**PR:** https://github.com/razbakov/wedance-2026/pull/224

**Try it**
1. Open https://2026.wedance.vip
2. Sign in with your account
3. Refresh the page
4. You should stay signed in instantly — no blink or flash of signed-out UI
