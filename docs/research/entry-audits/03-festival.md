# Festival page — signed-out entry audit

- **Example URLs (checked 2026-10-25):**
  - https://2026.wedance.vip/events/ddf-deutschland-dance-festival-2026-ba45acd1 (top Instagram entry, 18 sessions; festival was Oct 16–18, so **already over**)
  - https://2026.wedance.vip/events/meneate-viena-2026-8a2883b2 (current occurrence, Nov 26–29; one of the 4 festivals that sell passes through WeDance Stripe)
  - Legacy: `/festivals/cuban-fire-munich-2026`, `/festivals/meneate-viena-2026` (~17 sessions)
- **Arrives from:** l.instagram.com (organiser/artist bio or story link), checkout.stripe.com, direct · **Persona:** dancer who travels for festivals and is deciding whether to go and which pass to buy
- **CUJ:** C4 — Traveler — Plan your festival year · **JTBD:** J4 — Plan and afford my dance travel (also J3 never dance alone, J7 trust it's real)
- **Related stories:** P210 buy ticket one tap (not-built, but a checkout exists), P206 tickets become faces (not-built), P205/P306 see who's going before you book (not-built), P228 pick workshops from schedule (partial), P304 plan the trip together (not-built)
- **Code:** `app/pages/events/[id].vue` → `app/components/festival/FestivalView.vue`; hero `app/components/FestivalHero.vue`; checkout `server/trpc/routers/festivalSignup.ts:193` (`ticketCheckout`), price list `server/utils/ticket-prices.ts`; data `server/utils/festivalView.ts`

## Scenarios

| # | As a signed-out traveller from Instagram, I want to… | What happens today | Verdict |
|---|---|---|---|
| S1 | land on the festival from an old link | `/festivals/<slug>` returns the **unbranded Nuxt 404** ("Page not found: /festivals/meneate-viena-2026", no header, "Go back home") — [03-legacy-404](screenshots/03-legacy-404.jpg). The route was deleted in #297 with no `routeRules` redirect (`nuxt.config.ts:35-51`). `/events/meneate-viena-2026` (the festival key) *does* resolve and canonicalises, so a one-line redirect would rescue it. `cuban-fire-munich-2026` 404s on both paths (no event exists, yet it is still in the Stripe price list). | ❌ |
| S2 | see dates, city and price at a glance | Hero shows dates, venue, city, "In 5 weeks" / "Past" ([03-hero-mobile](screenshots/03-hero-mobile.jpg)). **No price** in the hero: DDF has `price: "From €10 · Full pass from €135"` in the data, Menéate has the passes, but the first price appears ~6 screens down in Passes. | ⚠️ |
| S3 | land from a link preview (Instagram/WhatsApp) that tells me what this is | SSR HTML has `<title>WeDance — Event</title>` and **no description / og:title / og:image** (curl with a WhatsApp UA). Data loads client-side (`[id].vue:93-117`), the real title is set only after hydration (`FestivalView.vue:1066`). Every shared festival link previews as a bare "WeDance — Event". | ❌ |
| S4 | arrive from an Instagram post about a festival that already happened (DDF) | Hero says "— Past" but keeps **GET TICKETS**, **GOING?**, "1 planning", every "Get this pass" button, the dance card and ride/room sharing ([03-ddf-past-hero](screenshots/03-ddf-past-hero.jpg)). No "next edition", no other Lionsnight / Urbankiz festivals, no ask for a review. 18 sessions in 30 days landed on this stale page. | ❌ |
| S5 | understand how to buy a pass | **Two competing paths with conflicting copy.** Hero "GET TICKETS" → organiser's shop (cubailaviena.at / lionsnight.info). Passes "Get this pass" → "Checkout on WeDance · secure payment · instant confirmation", while Practical info says "Payment by bank transfer within 7 days after invoice" (Menéate). For DDF the description says "tickets on the organiser's site", yet every pass has "Get this pass": DDF is **not** in `ticket-prices.ts`, so after sign-up `ticketCheckout` throws `Ticket not found` and the user sees "Something went wrong — please try again" (`festivalSignup.ts:201-205`, `FestivalView.vue:894-897`). | ❌ |
| S6 | buy a pass signed out (Stripe festival) | "Get this pass" → checkout sheet → "SIGN IN & PAY €120" opens the sign-up dialog **underneath** the checkout sheet: checkout is `z-[70]` (`FestivalView.vue:1584`), the dialog `z-50` (`ui/dialog/DialogContent.vue:28`). The visible sheet is dead (body `pointer-events:none`; "Maybe later" not clickable in Playwright), and taps fall through to an invisible form ([03-checkout-signup-stacked](screenshots/03-checkout-signup-stacked.jpg)). Even when it works: headline is generic "Join WeDance" (no `ticket` key in `SignUpModal.vue:35-47`), and `onSignedIn` does not resume checkout (`FestivalView.vue:712-718`) — the buyer starts over. | ❌ |
| S7 | see the line-up and trust it | 10 artists on Menéate, 46 on DDF, with photos and "See sessions" filter. **Every card says "TO BE CONFIRMED"**: `tbc` = the artist hasn't clicked "I'm in" on WeDance (`festivalView.ts:69-72`), not "the organiser hasn't confirmed". To a traveller it reads as "this line-up may not happen". | ⚠️ |
| S8 | plan workshops signed out and get a pass recommendation | Works: schedule "Going?" → role → partner → "1 in your plan", and Passes shows "Best value for your plan: Friday Pass €60, covers your 1 workshop" (no sign-up needed). Plan only lives in this browser. "BEST VALUE" badge appears on two passes at once on both festivals (Full Pass and a party pass). | ✅ |
| S9 | see who's going / find people to go with | "2 planning" chip and "1 going" per session, **no faces, no names** (P205/P306 not built). Activities: one ride offered (by the founder, "Alösha from Munich"), "2 looking" for a room, "4 events" dinners — every action is "Sign in". "Shall we dance?" asks a stranger to rate 17 styles with chili levels before showing anything. | ⚠️ |
| S10 | judge whether it's legit | Organiser socials icons, venue + practical info (excellent on DDF: S-Bahn, parking, hotel, dress code, refund rules). But the only review on Menéate 2026 is "Alösha Uno — Best festival ever", dated 7/7/2026 for an edition that hasn't happened yet, shown as ★ 5.0 · 1 in the hero. Organiser profile (`organizerUsername`) is not linked from the hero. | ⚠️ |

## Data we have but don't show
- `price` summary ("From €10 · Full pass from €135") — not in the hero.
- `organizerUsername` (`lionsnight`, `cubaila.viena`) — no "by Lionsnight" chip linking `/@handle`.
- Which artists have actually confirmed vs. are only listed — rendered as one blanket "To be confirmed".
- Whether the festival is sold through WeDance (`ticket-prices.ts` registry) — the UI shows the WeDance checkout for every festival with `tickets`, registry or not.
- Past state: the page knows the end date but keeps every buy/plan CTA live.

## Desktop differences
Same content; hero sits on one wide row with nav (Festivals, Cities, Artists, Find your dance). Checkout sheet becomes a centred card but has the same stacking bug (both use the same `z-[70]` wrapper). No desktop-only issues found.

## Top fixes (impact × effort)
1. Server-render title, description and og:image for `/events/[id]` (fetch in `useAsyncData` or `/api/event-status` returning name/flyer) — fixes every Instagram/WhatsApp preview (M).
2. Redirect `/festivals/**` → `/events/**` in `routeRules` and brand the 404 with search + festivals list (S).
3. Fix checkout → sign-up: close the checkout sheet before opening sign-up (or raise the dialog z-index), add a `ticket` headline ("Create your account to pay for the Saturday Pass"), and resume checkout after sign-in (S).
4. Show "Get this pass" (WeDance checkout) only for festivals in the price registry; otherwise route pass buttons to `ticketUrl`. Remove the conflicting "bank transfer" line or the "Checkout on WeDance" claim (S).
5. Past mode: hide buy/plan CTAs, show "Next edition / more by this organiser / similar upcoming festivals" and "Were you there? Review it" (M).
6. Hero facts: price from, organiser chip; relabel TBC as "Not yet on WeDance" or drop it from the public view (S).
7. Don't show founder/test reviews and rides as social proof on live festivals (S).

Screenshots: `screenshots/03-hero-mobile.jpg`, `screenshots/03-checkout-signup-stacked.jpg`, `screenshots/03-legacy-404.jpg`, `screenshots/03-ddf-past-hero.jpg`
