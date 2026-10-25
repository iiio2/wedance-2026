# Token links `/charanga/claim` + `/auth/verify` — signed-out entry audit

- **Example URLs (fake values only):** `https://2026.wedance.vip/charanga/claim`, `/charanga/claim?email=someone%40example.com`,
  `/auth/verify`, `/auth/verify?token=fake-0000-test-token`, `/auth/verify?token=fake-0000-test-token&mode=reset`
  (form opened, not submitted). Checked 2026-10-25. The valid-token paths are read from code.
- **Arrives from:** `/auth/verify` comes from the magic-link / password-reset email (8 sessions in 30 days, direct + Gmail).
  `/charanga/claim` comes from the TicketTailor "Connect on WeDance" email link, and from "Be the first to claim your spot" in
  the roster on the Charanga event page. It isn't among the PostHog entry paths.
  **Personas:** a ticket buyer who never had a WeDance account; a returning dancer who asked for a sign-in / reset link,
  maybe on another device.
- **CUJ:** C8 — Member — account & trust; C4 — Traveler (ticket → roster) · **JTBD:** J7 — Trust it's real (verified faces); J3
- **Related stories:** P206 Tickets become faces (not-built), P211 See who else is going (not-built), RAZ-242 (magic-link `purpose`, done)
- **Code:** `app/pages/charanga/claim.vue`, `server/trpc/routers/claim.ts`, `app/pages/auth/verify.vue`,
  `server/trpc/routers/auth.ts:64-262` (`requestMagicLink`, `verifyMagicLink`, `resetPassword`), `app/composables/useAuth.ts:3-5`
  (magic link "retained but dormant")

## Scenarios — `/charanga/claim`

| # | As a signed-out ticket buyer from the TicketTailor email, I want to… | What happens today | Verdict |
|---|---|---|---|
| T1 | recognise what I'm connecting | "Connect your ticket to WeDance" + my email prefilled from `?email=` ([15-charanga-claim-mobile](screenshots/15-charanga-claim-mobile.jpg)). It never says *which* event (Charanga Habanera, La Rumba, 23 May) or what the "verified attendee roster" gets me | ⚠️ |
| T2 | finish in one go | "Send magic link" → email → `/auth/verify` → **always `/my-plan`**. The server builds the link without `redirect` (`auth.ts:144-146`), so `verify.vue:47-49` never gets one. The page tells you to "click the 'Connect on WeDance' link … **a second time**" (`claim.vue:226-229`, `:300-303`). A 2-email, 3-hop flow for one claim | ❌ |
| T3 | claim on another device (email read on laptop, ticket mail on phone) | The magic link signs in whichever device opens it. The original tab sits on "Check your email" for good (no polling), and the TicketTailor link has to be re-opened on the device that is now signed in. Nothing explains that | ❌ |
| T4 | use a different email than at checkout | Sign-in succeeds, then "No pending ticket found… please contact support". There's **no support link or address**. Its only link goes to TicketTailor event `wedancevip/1796869` (`claim.vue:168`), while the seed's Charanga ticket URL is `montunoclub/2183096` (`server/database/seed.ts:24`). It may be the wrong event | ❌ |
| T5 | arrive months later (today) | The concert was **2026-05-23**. The page is still live with nothing marking it as past. The roster CTA "Be the first to claim your spot" still links here (`AttendeeRoster.vue:90`). Hard-coded Charanga flow, `FestivalView.vue:1193` | ❌ |
| T6 | keep my email private | `?email=` reaches analytics via the full-path `$pageview` (breaks the CLAUDE.md "never send emails" rule). 🔒 *Security/privacy finding — redacted from this public doc until fixed; details reported privately.* | ❌ |
| T7 | already signed in with a password (email unverified) | "Verify your email to claim your ticket", with a clear reason and a "Send verification link" button (`claim.vue:180-235`) | ✅ |
| T8 | see it worked | "You're on the verified roster" + "Continue to <festival>" (`/events/<slug>`); `tickets_claimed` fires (`claim.vue:67`). No server-side twin, though: the conversion isn't counted on `server_*` | ⚠️ |

The page also has different chrome from the rest of the site: plain "WeDance" wordmark with Festivals / Cities / Sign in, no
bottom tab bar ([15-charanga-claim-desktop](screenshots/15-charanga-claim-desktop.jpg)), and an emoji 🎫 instead of the
design-system icon.

## Scenarios — `/auth/verify`

| # | As a signed-out dancer from a sign-in / reset email, I want to… | What happens today | Verdict |
|---|---|---|---|
| V1 | click the link and continue what I was doing | "Welcome, <name>! … Taking you to your plan…", then after 2 s **always `/my-plan`**. Where I started (an event, a festival, the claim page) is lost: `redirect` is supported (`verify.vue:47`) but never sent. Brand-new magic-link users land on `/my-plan` with an onboarding banner instead of onboarding | ⚠️ |
| V2 | open the link on my phone after asking on my laptop | Works: the token is a bearer and single-use (`auth.ts:203-205`), so the phone gets signed in. The laptop isn't told anything | ⚠️ |
| V3 | open a link that expired (15 min, `auth.ts:81`) or was replaced by a newer request | "SOMETHING WENT WRONG · Link expired or invalid · Invalid or expired link. Please request a new one." The only action is "Go to homepage": no "send a new link" form, no sign-in button, no email prefill ([15-verify-expired-mobile](screenshots/15-verify-expired-mobile.jpg)). Each new request silently kills the previous email's link (`auth.ts:83-87`), so "I clicked the first email" fails | ❌ |
| V4 | open the bare page (`/auth/verify`) | "No verification token found." The word "token" is jargon. A sketch page links "Sign in" here (`app/pages/sketches/landing/index.vue:146`) | ⚠️ |
| V5 | reset my password with a link that turns out to be stale | The form opens whatever the token ([15-verify-reset-fake-token-mobile](screenshots/15-verify-reset-fake-token-mobile.jpg)). The token is only checked **on submit** (`verify.vue:35-38`, `:68`), so you type a new password twice and only then learn the link is dead | ❌ |
| V6 | not have a mail scanner burn my link | Verification runs client-side in `onMounted` (`verify.vue:26-57`), so scanners that only GET the HTML don't consume it | ✅ |
| V7 | trust the page | No `<title>` (blank tab), no `robots: noindex`, and a hard-coded `style="background:white"` card (`verify.vue:96`) that ignores theming. The token in the URL also lands in PostHog (`fullPath`). That matters for **reset** tokens, which stay valid until submit for 15 min | ⚠️ |

Not on the page itself but triggered from it:
- 🔒 *Security/privacy finding — redacted from this public doc until fixed; details reported privately.*
- A crafted `redirect=//host` passes the `startsWith('/')` check (`verify.vue:47`). Nuxt's `navigateTo` refuses external URLs without `external: true`, so the user just hangs on "Taking you to your plan…". It isn't an open redirect, but it's a broken state.

## Data we have but don't show
- **Claim page:** the festival name/date (the server knows it as soon as the stub matches) and which email bought the ticket. A masked "j***@gmail.com bought 2 tickets" after sign-in would explain T4.
- **Verify page:** the dancer's email on the expired screen. It is unknown for a dead token, but the reset/login form could ask for it and resend in place. `isNew` is returned (`auth.ts:211`) but not used to send new users to onboarding.
- `server_ticket_claimed` doesn't exist. Claims can't be counted on the server.

## Desktop differences
`/charanga/claim` gets the legacy top bar (wordmark + Festivals/Cities) instead of the site header, with a narrow centred column.
`/auth/verify` is identical on desktop: a centred card, no nav at all, so the only exit is "Go to homepage".

## Top fixes (impact × effort)
1. **Carry the destination through the email** (S): add a `redirect` (path-only, validated server-side) to `requestMagicLink` and append it to `magicLinkUrl`. `/charanga/claim` passes `/charanga/claim`, so the claim finishes automatically after one click and the "click a second time" box goes away.
2. **Resend in place** (S): the expired screen gets an email field + "Send me a new link" (login or reset, by `mode`). Validate reset tokens on load (a `checkResetToken` query) before showing the form.
3. **Redact tokens and emails from analytics** (S): strip `token`, `email` and `/confirm/<token>` from the `$pageview` path and set posthog `sanitize_properties` for `$current_url`. The same fix covers `/confirm` (see 14).
4. **Stop `requestMagicLink` from editing existing accounts** (S): apply `name/city/styles/role` only on insert, never in `onConflictDoUpdate`.
5. **Retire or generalise `/charanga/claim`** (M): the event is past. Either redirect it to the event page with a "this claim window has closed" note, or turn it into `/tickets/claim` for any TicketTailor event, with the event named on the page, a real support contact, and a server-side `server_tickets_claimed`.
6. **Polish** (S): add `useHead` title + noindex to `/auth/verify`, use theme tokens instead of the inline white, and "Link not found" copy without the word "token".

Screenshots: `screenshots/15-*.jpg`
