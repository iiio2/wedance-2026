# Invite / claim `/confirm/[token]` — signed-out entry audit

- **Example URLs:** `https://2026.wedance.vip/confirm/fake0000test0000token0000` (invalid token), `/confirm/abc` (truncated token),
  `/confirm/@montunoclub` (handle mode, signed out). Checked 2026-10-25. **No real token was opened**: the valid path is read
  from code (`app/pages/confirm/[token].vue`, `server/trpc/routers/artistInvites.ts`).
- **Arrives from:** organiser's "Copy message" (WhatsApp / Instagram DM / Messenger), the "Needs you" email, and per PostHog
  m.facebook.com / www.facebook.com (26 sessions in 30 days, 4th-biggest entry).
  **Personas:** (a) artist or venue invited by an organiser; (b) a stranger who got the link second-hand (forwarded, posted
  in a Facebook group or chat).
- **CUJ:** C5 — Pro — Get booked (also C6 for venue asks, C8 for the account) · **JTBD:** J5 — Get discovered and booked; J7 — Trust it's real
- **Related stories:** P901 Get Booked (partial), P902 Offer a Service (partial). No story covers invite-link security or expiry.
- **Code:** `app/pages/confirm/[token].vue` (506 lines, client-only load), `server/trpc/routers/artistInvites.ts` (`get` / `respond` / `claim`),
  `server/trpc/routers/venueAsks.ts` (venue asks use the same page), organiser side `app/components/business/BusinessConfirmDialog.vue`,
  `shared/utils/contacts.ts`, MCP `claim_profile` (`server/mcp/tools.ts:786-802`).

### Where the Facebook referrals probably come from
The organiser dialog offers the artist's contacts, Facebook/Messenger included (`shared/utils/contacts.ts:12`), next to a
pre-written "Hi <name>! … Approve or change anything here: <link>" (`BusinessConfirmDialog.vue:26`). An `m.facebook.com`
referrer fits a Messenger or Facebook in-app browser better than a public post. PostHog stores the `path` only, so a referrer
can't tell a DM from a group post. 🔒 *Security/privacy finding — redacted from this public doc until fixed; details reported privately.*

## Scenarios

| # | As a signed-out … I want to… | What happens today | Verdict |
|---|---|---|---|
| S1 | invited artist (unowned page), from a DM: understand what this is and answer | Code: H1 "<Host> added you to <Event>" + a short explanation. Then an event card (dates, venue, organiser link, line-up faces, "See the event page"). Then Are you in? → Your programme → Posts about you (consent checkbox) → name/city/styles → organiser changes → photos → videos → about/socials → message → **Send my answer** (`[token].vue:268-501`). It covers everything, but there are about 9 cards before the button on a phone, and validation errors only show by the button (`save()`, `:153-157`) | ⚠️ |
| S2 | invited artist: know what "make it mine" requires | After sending: "Make this page yours" → email + password, or "I already have an account" → sign-in. "Not now" skips. 🔒 *Security/privacy finding — redacted from this public doc until fixed; details reported privately.* | ⚠️ |
| S3 | stranger with a forwarded/posted link, page still unowned | 🔒 *Security/privacy finding — redacted from this public doc until fixed; details reported privately.* | ❌ |
| S4 | stranger, page already has an owner | 🔒 *Security/privacy finding — redacted from this public doc until fixed; details reported privately.* | ❌ |
| S5 | invited artist: see only this organiser's changes | 🔒 *Security/privacy finding — redacted from this public doc until fixed; details reported privately.* | ❌ |
| S6 | anyone: open a link that no longer works | "This link doesn't work any more. Ask the organizer for a new one." in a red box. No organiser name, no way to reach them, no link to the event or home ([14-invalid-token-mobile](screenshots/14-invalid-token-mobile.jpg)). In practice the token only dies when the event is deleted (FK cascade), so "expired / used" states don't exist | ⚠️ |
| S7 | anyone: open a link a chat app cut short | A token under 10 chars dumps **raw zod JSON** ("too_small… expected string to have >=10 characters") ([14-short-token-raw-error-mobile](screenshots/14-short-token-raw-error-mobile.jpg)); `error.value = e.message` (`[token].vue:63`) | ❌ |
| S8 | invited artist: see in the Messenger/WhatsApp preview who invited me | The page loads client-side only (`onMounted(load)`, `:66`). The server HTML has just `<title>Your answer \| WeDance</title>`: no og:title/description/image, no event or organiser name. The preview gives no reason to trust the link, and a spammy-looking link hurts J7 | ⚠️ |
| S9 | invited artist who **declines** | Thank-you screen: "Your page is up to date **and <Host> can use it for <Event>**" (`[token].vue:239`). That contradicts the "I can't make it" answer. There's no "change my answer" hint | ⚠️ |
| S10 | page manager, signed out, from the "Needs you" email (`/confirm/@handle`) | Only "You don't manage this profile." No sign-in prompt, even though the server knows the viewer is signed out ([14-handle-signed-out-mobile](screenshots/14-handle-signed-out-mobile.jpg); FORBIDDEN at `artistInvites.ts:88`) | ❌ |

Also worth noting:
- Opening the page writes `lastUsedAt` on every GET (`artistInvites.ts:349`).
- The account form validates with hand-written regex instead of the valibot `useFormValidation` convention (`[token].vue:209-210`).
- Signing up inside Messenger's in-app browser leaves the session in that webview. The artist is signed out the next time they open WeDance in their real browser.

## Data we have but don't show
- **On the error state:** nothing tells the visitor what WeDance is or what the link was for. The invite row is gone, but the 404 path could still offer "Are you an artist? Find your page / claim it" (`/business/claim`).
- **On the answer screen:** `respondedAt` / `status` (already answered on <date>) is prefilled silently (`[token].vue:119-127`) with no "You answered on …, change it?" banner. `notifiedAt` and the organiser's Instagram are fetched but not offered as a "question? message them" contact.

## Desktop differences
The same single 2xl column. The invalid-token state is a lone red box in a mostly empty viewport ([14-invalid-token-desktop](screenshots/14-invalid-token-desktop.jpg)). Desktop uses the top nav, mobile the bottom tab bar. Neither offers a next step.

## Top fixes (impact × effort)
1. **Harden invite links** (M): 🔒 *Security/privacy finding — redacted from this public doc until fixed; details reported privately.*
2. **Scope what the invite page returns** (S): 🔒 *Security/privacy finding — redacted from this public doc until fixed; details reported privately.*
3. **Keep tokens and emails out of analytics** (S): redact `/confirm/*`, `/auth/verify?token=`, `?email=` from the `$pageview` path before capture.
4. **Human error states** (S): map zod errors to "This link looks incomplete. Open it from the original message". Add a "What is WeDance" line plus home/claim links on not-found. For `/confirm/@handle` when signed out, show Sign in instead of "You don't manage this profile".
5. **SSR + OG meta** (S): render "<Host> invited you to <Event>" server-side, with og:title/description/image (flyer), so the DM preview earns trust.
6. **Fix the decline copy and shorten the form** (S/M): a decline gets "Thanks, <Host> will see you can't make it". Collapse the page-detail cards behind "Check your page details (optional)" once participation is answered.

Screenshots: `screenshots/14-*.jpg`
