# Signed-out entry-page audits (2026-10-25)

How a visitor who is **not signed in** experiences each page people land on from outside
(partner schedules, Instagram/Facebook, flyer QR codes, promoter `?via=` links, shared plans,
search, invite emails). One file per page; `SYNTHESIS.md` holds the cross-cutting findings.

Method: real production URLs, fresh browser context (no cookies), 375px mobile first plus one
desktop pass. CTAs are tapped; sign-up / booking / payment forms are opened but **never submitted**.
CUJ / JTBD ids come from `docs/issues/_reference-cuj-jtbd.md`.

## Entry traffic (PostHog, 30 days to 2026-10-25, `app = wedance-2026`, first pageview per session)

| Entry path | Sessions | Top referrers / UTM |
|---|---|---|
| `/` | 152 | direct, facebook · utm montuno.club |
| `/events/[id]` | 68 | montuno.club, l.instagram.com, m.facebook.com · utm montuno.club, ig |
| `/business/**` | 55 | direct, montuno.club |
| `/confirm/[token]` | 26 | direct, m.facebook.com, www.facebook.com |
| `/my-plan` | 23 | direct, checkout.stripe.com |
| `/festivals` | 16 | direct, l.instagram.com |
| `/cities/[city]` | 15 | direct (14 × `/cities/munich`) |
| `/for-events` | 12 | l.instagram.com, m.facebook.com · utm ig, card |
| `/find-your-dance` | 10 | direct |
| `/@handle` | 9 | direct, Gmail |
| `/my-year` | 9 | direct, checkout.stripe.com |
| `/auth/verify` | 8 | direct, Gmail |
| `/gigs` | 6 | direct |
| `/festivals/<slug>` (legacy) | ~17 | direct, ig, checkout.stripe.com |

Top concrete event entries: `la-clave-thursday-*` (24, montuno.club), `ddf-deutschland-dance-festival-2026-*`
(18, Instagram), `salsa-from-zero-*` (12, montuno.club), `ldc-november-rave-*` (4).
Volumes are small; they set the order, not the verdicts.

## Template (every audit file)

```markdown
# <Page> — signed-out entry audit
- **Example URL(s):** … (date checked)
- **Arrives from:** … · **Persona:** …
- **CUJ:** C# — … · **JTBD:** J# — … · **Related stories:** P### (status) …
- **Code:** `app/pages/…`, key components

## Scenarios
| # | As a signed-out <persona> from <source>, I want to… | What happens today | Verdict |
(✅ works · ⚠️ works with friction · ❌ fails / missing; cite screenshot or `file:line`)

## Data we have but don't show
## Desktop differences
## Top fixes (impact × effort)
1. … (S/M/L)

Screenshots: `screenshots/<page-slug>-*.png`
```

## Index

| # | Tier | Page | File |
|---|---|---|---|
| 0 | ref | Course event via partner schedule (Salsa From Zero) | `00-event-course-partner-schedule.md` |
| 1 | 1 | Weekly social / party event | `01-event-weekly-social.md` |
| 2 | 1 | Event via promoter `?via=` link | `02-event-promoter-link.md` |
| 3 | 1 | Festival page | `03-festival.md` |
| 4 | 1 | Festival shared plan (`?invite=` / `?ref=`) | `04-festival-shared-plan.md` |
| 5 | 1 | Business profile `/@handle` | `05-business-profile.md` |
| 6 | 1 | City page `/cities/[city]` | `06-city.md` |
| 7 | 2 | Landing `/` | `07-landing.md` |
| 8 | 2 | `/find-your-dance` | `08-find-your-dance.md` |
| 9 | 2 | Shared year plan `/my-year?user=` (+ `/my-plan` cold entry) | `09-shared-year-plan.md` |
| 10 | 2 | Booking `/@handle/book` | `10-booking.md` |
| 11 | 2 | `/gigs` | `11-gigs.md` |
| 12 | 2 | Dancer profile `/u/[username]` | `12-dancer-profile.md` |
| 13 | 2 | Directories `/festivals`, `/artists`, `/venues`, `/cities`, `/cities/*/…` | `13-directories.md` |
| 14 | 3 | Invite / claim `/confirm/[token]` | `14-confirm-invite.md` |
| 15 | 3 | `/charanga/claim` + `/auth/verify` | `15-token-links.md` |
| 16 | 3 | `/elections/[handle]`, `/battle` | `16-community-votes.md` |
| 17 | 2 | `/for-events` (paid-social landing) | `17-for-events.md` |
|  | — | Cross-cutting synthesis + ranked fixes | `SYNTHESIS.md` |
