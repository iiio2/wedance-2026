---
title: "🐞 When I click Forgot password, it doesn't work. I don't receive an emai…"
type: Task
id: RAZ-413
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
created: 2026-10-15T16:12:22.131Z
completed: "2026-10-16T10:46:29.375Z"
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/347","https://github.com/razbakov/wedance-2026/pull/342"]
linear_url: https://linear.app/alosha/issue/RAZ-413/when-i-click-forgot-password-it-doesnt-work-i-dont-receive-an-emai
exported: 2026-10-25
---

# RAZ-413 — 🐞 When I click Forgot password, it doesn't work. I don't receive an emai…

When I click Forgot password, it doesn't work.
I don't receive an email.
And I see exposed raw sql error:
Failed query: insert into "dancers" ("id", "email", "name", "photo", "dance_styles", "dance_levels", "role", "city", "neon_auth_id", "is_admin", "username", "old_usernames", "bio", "instagram", "youtube", "website", "profile_public", "salt", "hash", "intent", "onboarded_at", "magic_token", "magic_token_expires_at", "email_verified_at", "created_at") values (default, $1, $2, default, $3, default, $4, $5, default, default, default, default, default, default, default, default, default, default, default, default, default, $6, $7, default, default) on conflict ("email") do update set "magic_token" = $8, "magic_token_expires_at" = $9 params: [[email redacted]](<mailto:[email redacted]>),razbakov.aleksey,\[\],,,f2a5b28b-3895-48dc-936e-b19c5ff25b87,2026-10-15T16:26:37.914Z,f2a5b28b-3895-48dc-936e-b19c5ff25b87,2026-10-15T16:26:37.914Z

---

**Reported by:** Anonymous visitor · [[email redacted]](<mailto:[email redacted]>) · not signed in
**Page:** [https://2026.wedance.vip/](<https://2026.wedance.vip/>)
**Route:** `/`
**Environment:** UA: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 · viewport 1512×740 · screen 1512×982 · dpr 2 · lang en-US · tz Europe/Berlin · online · build e4614c6

**Recent client errors:**

```
[16:02:24.939] console.error: Hydration completed but contains mismatches.
```

---

*Filed automatically from the “Report a problem” widget on [2026.wedance.vip](<http://2026.wedance.vip>).*

## Links

- [fix(auth): forgot-password email never sent — missing DB column](https://github.com/razbakov/wedance-2026/pull/347)
- [fix(security): never leak raw SQL from forgot-password (RAZ-413)](https://github.com/razbakov/wedance-2026/pull/342)

## Comments

### Linear · 2026-10-15 16:12 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-15 16:25 UTC

### 🔧 Fixing — Raw SQL error no longer leaks from forgot-password endpoint

Forge is fixing this now — no action needed.

### Forge · 2026-10-15 16:30 UTC

### 👀 Merged — ready for your review — Forgot-password no longer leaks raw SQL errors to users

**Live:** https://2026.wedance.vip
**PR:** https://github.com/razbakov/wedance-2026/pull/342

**Try it**
1. Open https://2026.wedance.vip
2. Click 'Forgot password' and enter any email
3. You should see a generic success message, never a SQL error

### Aleksey Razbakov · 2026-10-15 17:12 UTC

@forge I see message: If [email redacted] has an account, a password reset link is on its way. The link expires in 15 minutes.

But i don't receive an email

### Forge · 2026-10-15 17:25 UTC

### 👀 Merged — ready for your review — Forgot-password email now sends — missing DB column applied

**Live:** https://2026.wedance.vip
**PR:** https://github.com/razbakov/wedance-2026/pull/347

**Try it**
1. Open https://2026.wedance.vip
2. Click 'Forgot password' and enter your email
3. You should receive a password-reset email within a minute
