# Shared year plan `/my-year?user=` (+ cold `/my-year`, `/my-plan`) — signed-out entry audit

- **Example URLs** (checked 2026-10-25, fresh signed-out context, 375px + 1280px):
  - `https://2026.wedance.vip/my-year?user=alosha&ref=alosha`. This is the link `ShareYearPlanModal` builds (`app/components/ShareYearPlanModal.vue:30-39`). `alosha` is a real public dancer: the name appears on the public Menéate roster and in event line-ups.
  - `/my-year?user=nobody-fake-zz9` (not found), `/my-year?user=shared` (what a sharer without a username gets), cold `/my-year`, cold `/my-plan`, `/my-plan?preview=1`.
- **Arrives from:** a friend's WhatsApp/Telegram share; cold `/my-plan` (23 sessions) and `/my-year` (9) come direct or from `checkout.stripe.com`. **Persona:** a dancer friend who got "check out my festival year", or a buyer who paid on one device and opened the link on another.
- **CUJ:** C4 (Traveler: plan your festival year) · **JTBD:** J3 (go with people I know), J4 (plan and afford dance travel). C8 for sign-up.
- **Related stories:** P314 My 2026 Dance Year (partial), P317 Year in Numbers (partial), P318 overlap in the shared view (partial), P236 Be their partner (not built), P319 referral discount link (not built), P235 track your dance year signed out (partial), P305 arrive with friends (not built)
- **Code:** `app/pages/my-year.vue`, `app/components/SharedYearPlan.vue`, `app/components/YearPlan.vue`, `app/components/ShareYearPlanModal.vue`, `server/trpc/routers/plan.ts` (`sharedPlan` :461, `suggestions` :879, `goingBatch` :668), `app/pages/my-plan.vue` (signed-out block :1697), `nuxt.config.ts:57-58` (`ssr: false`)

## Scenarios — shared plan (friend receiving the link)

| # | As a signed-out friend opening a shared year plan, I want to… | What happens today | Verdict |
|---|---|---|---|
| S1 | see a link preview in WhatsApp/Telegram that says whose plan this is | `/my-year` is client-only (`nuxt.config.ts:57`). The server HTML has **no `<title>`, no description, no OG tags**, so the chat preview is a bare URL. After hydration the tab title still reads **"A dancer's 2026 Dance Year"**: `useHead` is evaluated once at setup, before the data arrives (`my-year.vue:348-352`, not reactive) | ❌ |
| S2 | know whose plan I'm looking at | For about 1 s the page says **"This year plan is not available."** with no loading state, because `sharedData` is null until the query returns (`my-year.vue:374-379`). Then it shows the photo, "Alösha's 2026 Dance Year", the Lead chip and "1 festivals" (grammar) ([shot](screenshots/09-shared-plan-mobile.jpg)). Nothing links to `/u/alosha` or his artist page | ⚠️ |
| S3 | see which festivals they're going to | It lists **only DDF (Oct 16–18, already over)**, with an active "See plan" button. The same person is a **verified ticket holder for ¡Menéate Viena! (Nov 26–29)** on the public roster (`festivalSignup.publicRoster`), but `sharedPlan` reads only `plan_items` and ignores `festival_signups`/`attendances`. Past festivals are not filtered or marked. "Year in Numbers" shows **0 countries** for a festival in Dachau, because DDF has no `country` | ❌ |
| S4 | see where we overlap | Signed out it always says "No festival overlap yet — Add festivals to your plan…". Overlap only uses the server plan of a signed-in viewer (`my-year.vue:199`), so a signed-out friend can't add anything to compare | ⚠️ |
| S5 | add them as a friend | "Add Alösha as friend" opens the generic **"Join the community"** sign-up (name/email/password, `SignUpModal.vue:45`). No reason given and no mention of Alösha. After sign-up, `onAddFriend` just sends you to `/onboarding` (`my-year.vue:339-346`). **No friend relation is created**, and `friendAdded` is never set to true (`SharedYearPlan.vue:21`) | ❌ |
| S6 | copy their festivals into my own plan without an account | Not possible. There's no per-festival "Going?" in the shared view, only "See plan" and a final "Start My Dance Year", which opens the generic sign-up | ❌ |
| S7 | open their plan for one festival ("See plan") | Goes to `/events/ddf-…?plan=shared&ref=alosha`: the **legacy** shared path without the sharer, so FestivalView falls back to **"A dancer's Plan", a generic "WD" avatar, a "Follow" role (he is a Lead) and "0 workshops"** (my-year said 8), plus "Add A dancer as friend" (`FestivalView.vue:63,90`). It also shows **"A dancer shared a referral link — you both get 10% off"** on a festival that ended a week ago, while `/my-year` reported `referralDiscountPercent: 0` for it ([shot](screenshots/09-see-plan-identity-lost.jpg)) | ❌ |
| S8 | be their partner where they need one | "needs partner" and "Be their partner" never render: `lookingCount` is hard-coded to `0` in the mapping (`my-year.vue:144`) | ❌ |
| S9 | open a link from someone with no username, or a stale one | A sharer without a username gets `/my-year?user=<dancerId>`, but `sharedPlan` looks up **by username only** (`plan.ts:465-473`), so the link is dead. A sharer with no ID at all gets `?user=shared`, also "not available". The not-found state gives no reason and no festivals, just "Create your own year plan", which opens sign-up | ❌ |

## Scenarios — cold `/my-year` and `/my-plan`

| # | As a signed-out visitor landing cold (direct / after Stripe on another device), I want to… | What happens today | Verdict |
|---|---|---|---|
| C1 | understand `/my-year` | "My 2026 Dance Year · Your year in dance, unwrapped", 2 "Discover festivals" (the whole upcoming catalogue: Menéate, Agua Pichi 2027 under a "2026" heading), then "Sign in to save your plans" | ⚠️ |
| C2 | share (the button is visible signed out) | Opens "Share your **0** festival plan" with the link **`/my-year?user=shared`**, which resolves to "This year plan is not available" ([shot](screenshots/09-share-signed-out-dead-link.jpg)). Every copy is a dead link | ❌ |
| C3 | tap GOING? on a suggested festival | Sign-up modal titled **"Join to save your workshop plan"** (`action: 'going'`), the wrong noun for a festival. Nothing is kept locally, so the choice is lost | ⚠️ |
| C4 | see my ticket / plan after paying (Stripe return on another device) | Checkout is `protectedProcedure` (`festivalSignup.ts:124,193`) and Stripe returns to the **festival page** `?payment=success` (`festivalSignup.ts:178`), so no code path sends Stripe to `/my-plan`. Those entries are buyers continuing in a new session or browser (in-app browser to Safari, a laptop). They land on the generic pitch "Your picks, your partners, your tickets — one dashboard" with "Join & build my dashboard". There's **no "Bought a ticket? Sign in with the email you paid with"**, and "Join" invites a duplicate account | ❌ |
| C5 | sign in from `/my-plan` | "Sign in" and "Join" both work. The value proposition is clear (picks / partners / tickets / one next step) | ✅ |
| C6 | (trust) not see fake data | `/my-plan?preview=1` is a dev shortcut that is **live on production for anyone**: "Hey, Alex", fake goals, "Emilia, Sasha heading to Timba Fest London", "€255 still owed", and past festivals ("— Happened", Mar 26–29) with "Buy €145 →" (`my-plan.vue:48-55`) ([shot](screenshots/09-my-plan-preview-mock.jpg)) | ⚠️ |

## Privacy note (affects S3 and `/u/`)
🔒 *Security/privacy finding — redacted from this public doc until fixed; details reported privately.*

## Data we have but don't show
The sharer's verified tickets (`festival_signups` / `attendances`); their username (no link to `/u/` or their artist page); per-festival role and partner status (`attendances.partner_status`); `goingBatch` friends (fetched but only used signed-in); whether a festival is past; DDF country; the real referral state for the sharer's code.

## Desktop differences
Same single column centred at max-w-3xl, with the top nav added (Festivals / Cities / Artists). No extra content, and the dead link, wrong title and loading flash are identical.

## Top fixes (impact × effort)
1. **Close the privacy gap in shared plans** (S): 🔒 *Security/privacy finding — redacted from this public doc until fixed; details reported privately.*
2. **Make shared links survive:** generate the link only once a username exists. Signed out, hide Share or replace it with "Sign in to share". Resolve `?user=` by username or ID (S).
3. **"See plan" carries the sharer:** pass an `invite` token (or `user`) instead of the legacy `?plan=shared`. Hide the referral banner on past festivals and when the code isn't valid for this festival (S).
4. **SSR or prerender `/my-year?user=`** with OG title, description and image ("Alösha's dance year: 2 festivals"), and a reactive `useHead`. Add a loading state instead of "not available" (M).
5. **Honest content:** merge tickets and attendances into the shared plan, and mark or hide past festivals. Make "Add as friend" real (create the relation after sign-up, with contextual copy "Join to add Alösha and see where you overlap") (M).
6. **Stripe-return path:** on `/my-plan` signed out, add a "Paid for a ticket? Sign in with the email you used at checkout" line (magic link). Remove `?preview=1` from production builds (S).
