# Gigs board `/gigs` — signed-out entry audit

- **Example URL:** https://2026.wedance.vip/gigs (also `?kind=role`) — checked 2026-10-25
- **Arrives from:** direct (6 entry sessions / 30 days), footer "Get booked → Gigs", `/@handle` and artist pages · **Persona:** (a) teacher / DJ / performer looking for paid work; (b) organiser who wants to post an open role
- **CUJ:** C5 — Pro — Take the stage / get booked · **JTBD:** J5 — Get discovered and booked as an artist (organiser side: J6-adjacent hiring)
- **Related stories:** P102 Open roles and services (partial), P103 Apply or contact (done), P737 Post a gig (partial), P738 Organizer posts open role (partial), P901 Get booked / book talent (partial)
- **Code:** `app/pages/gigs/index.vue` (single page: hero, filters, post form, board), `server/trpc/routers/gigs.ts` (`list` public, `create` / `applyTo` protected)

## Scenarios

| # | As a signed-out artist / organiser, I want to… | What happens today | Verdict |
|---|---|---|---|
| S1 | see real, current paid work | Board shows **7 gigs, only 2 "Wanted"** roles ([board](screenshots/11-board-mobile.jpg)). One role ("Salsa" by poster "Munich", when `oct. - 16 - 2026`, pay "travel") is already in the past but still listed — the date is free text and `list` only filters `status='open'` (`server/trpc/routers/gigs.ts:30-56`); `deadline` is null on all 7, so the "Closes in…" badge never shows. 3 of 5 offers are by **"Deleted user"**, one titled "Timba testing", another "snap" in location "Qta" — test data on a public board | ❌ |
| S2 | trust who posted it | Poster is a free-text `posterName` + `posterType` ("Rocky Star · Photographer" offering a "Show" called "Workshop"). No link to a WeDance profile (`posterProfileId` null on all rows), no verified mark, no posting date shown. Only DJ Alösha has a "Profile" link (to montuno.club) | ❌ |
| S3 | filter to what I do (teacher / DJ / roles only) | Kind toggle + category chips work and the result count updates. But chips are derived from the *filtered* result (`categories` computed from `allGigs`, `index.vue:61`): pick "Teacher" and every other chip disappears ([filtered](screenshots/11-filter-collapses-chips.jpg)) — to switch you must un-tap first. No city / style / date filter, and the filter isn't written to the URL (only `?kind=` is read on load), so a filtered view can't be shared | ⚠️ |
| S4 | apply to a role | Signed out, **Apply is a `mailto:`** prefilled with subject + a template body (`gigMailto`, `index.vue:164-174`) — no sign-up needed, which is low-friction. But nothing tells me that an in-app application (tracked status, decision email) exists once signed in (`index.vue:700-711`); on a phone without a mail client the tap does nothing visible except the "Email draft opened" banner | ⚠️ |
| S5 | contact an artist offering a service | "Contact" is a mailto. For the 3 "Deleted user" offers it opens a draft to **`anonymized@wedance.local`** — a dead address, while the UI says "send it to reach Deleted user directly" | ❌ |
| S6 | (privacy) — what the board exposes | 🔒 *Security/privacy finding — redacted from this public doc until fixed; details reported privately.* | ❌ |
| S7 | post a gig (organiser) | Only CTA is **"Sign in to post" → `/auth/signin`, which is a 404** ("Page not found: /auth/signin") ([404](screenshots/11-signin-to-post-404.jpg), `index.vue:288-290`). There is no `app/pages/auth/signin.vue`; the header "Sign in" opens the working modal instead. So the organiser path from this page is broken | ❌ |
| S8 | know what posting involves before signing up | Nothing: no "free", no example, no "who sees it / how applicants reach you". The form (role / category / title / location / styles / when / pay / deadline / contact email) is only rendered for signed-in users | ⚠️ |
| S9 | empty / error states | "Loading gigs…", "Couldn't load gigs · Try again", and "No gigs match your filters yet · Clear filters" are all handled (`index.vue:587-600`). The board is client-only (`server: false`), so the SSR HTML and link previews contain no gigs | ⚠️ |

## Data we have but don't show
`createdAt` (no "posted 3 weeks ago" — staleness invisible), `posterProfileId` / `dancerId` → could link a WeDance profile, `entityUrl`, `status`. Applications count (would signal liveness). Nothing ties gigs to real upcoming events in `events` even though "role" gigs are usually for an event.

## Desktop differences
Same content in a 2-column grid ([desktop](screenshots/11-desktop.jpg)); header shows "For organizers". Same 404 on "Sign in to post". The "Talk to us" chat bubble overlaps the first card's poster line on mobile (visible in the board screenshot), not on desktop.

## Top fixes (impact × effort)
1. Fix "Sign in to post": open the sign-in modal (or `/?signin=1`) and return to the form, with copy like "Sign in to post a role — free" (S).
2. 🔒 *Security/privacy finding — redacted from this public doc until fixed; details reported privately.* Also close gigs whose poster account was deleted (S).
3. Clean the board: delete test rows ("Timba testing", "snap"), auto-close roles whose date passed, make `deadline` (or a real date) required for roles (S/M).
4. Show "posted X ago" + poster's WeDance profile link; badge gigs posted by a claimed business page (S).
5. Keep all category chips visible when one is selected; sync `kind`/`category` to the URL (S).
6. Tell signed-out artists that signing in lets them apply in-app and track status (S).
7. SSR the board (or at least a count) so shared `/gigs` links preview real work (M).

Screenshots: `screenshots/11-*.jpg`
