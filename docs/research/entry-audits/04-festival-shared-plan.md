# Festival shared plan (`?invite=` / `?plan=shared` / `?ref=`) — signed-out entry audit

- **Example URLs (checked 2026-10-25):** constructed the way `useSharePlan.buildShareUrl` does (the token is plain base64 JSON, not a secret):
  - `https://2026.wedance.vip/events/meneate-viena-2026-8a2883b2?invite=<base64 {n:"Maria", r:"follow", w:[thu-party, fri-1, fri-2 (looking)]}>`
  - same + `&ref=not-a-real-user-zz` (fake referral code, invalid path)
  - legacy `?plan=shared`, broken `?invite=garbage123`, festival-key form `/events/meneate-viena-2026?invite=…`
- **Arrives from:** a friend's WhatsApp/Telegram message (SharePlanModal "copy link" / native share) · **Persona:** friend who dances, isn't on WeDance, wants to join someone at a festival
- **CUJ:** C4 — Traveler — Plan your festival year · **JTBD:** J3 — Never dance alone (also J4 afford it, J7 trust)
- **Related stories:** P723 plan sharing (partial), P236 be their partner (not-built per backlog, but the button exists), P319 referral discount link (backlog says not-built, code has it — backlog drift), P305 arrive with friends (not-built)
- **Code:** `app/components/festival/FestivalView.vue:53-180` (decode, sharer, add-friend), `:1076-1093` (renders `SharedPlanView` *instead of* the festival page), `app/components/SharedPlanView.vue`, `app/composables/useSharePlan.ts`, `app/components/SharePlanModal.vue:26-44` (plan link and referral link are two separate URLs), `server/trpc/routers/referral.ts:81-121` (`validate`)

## Scenarios

| # | As a signed-out friend from WhatsApp, I want to… | What happens today | Verdict |
|---|---|---|---|
| S1 | see a useful link preview in WhatsApp | SSR title is "WeDance — Event" with no og tags (same as 03-S3). The preview doesn't say "Maria's plan for ¡Menéate Viena!", which is what makes people open it. | ❌ |
| S2 | see whose plan this is and what they picked | Clear: "Maria's Plan · ¡Menéate Viena! 2026 · Follow · 3 workshops · 1 needs partner", then picks grouped by day with time, room, teacher, role ([04-shared-plan-ref-mobile](screenshots/04-shared-plan-ref-mobile.jpg)). Avatar is a Dicebear initials image (sharer's name sent to api.dicebear.com, `FestivalView.vue:85`). | ✅ |
| S3 | know when and where the festival is, and what it costs | **Not on the page.** SharedPlanView replaces the whole festival page: no site header or logo, no dates, city, venue, flyer, passes or ticket button. Days are weekday names only ("THURSDAY") without a date. To find out more I must tap "Create my plan". | ❌ |
| S4 | copy their plan / join them in one tap | No "Copy Maria's plan" or "Join these workshops". "Create my plan" does `router.replace({ query: {} })` (`FestivalView.vue:138-140`): it drops Maria's plan *and* the `?ref=` code, and drops me on the full festival page with an empty plan. I have to find her 3 sessions again by hand. | ❌ |
| S5 | partner with them for a workshop | "Be their partner for this workshop" on the looking session → sign-up dialog "Join to find a dance partner" (good, contextual). After sign-up nothing resumes: `onBePartner` only runs again if I tap again, and Maria is never told (P236). | ⚠️ |
| S6 | add them as a friend | "Add Maria as friend" → generic "Join WeDance" (no `friend` headline in `SignUpModal.vue:35-47`). After sign-up the follow resumes (`pendingFriendAfterSignIn`, `FestivalView.vue:171-178`), but only when the token has `d` (dancer id); older links without it hide the button for signed-in users. | ⚠️ |
| S7 | trust the referral discount | With a **fake** `ref` the page still says "Maria shared a referral link — Buy your ticket here and you both get 10% off" — `SharedPlanView.vue:112-121` shows the banner on `hasReferral` (query present) and falls back to the sharer's name and a hard-coded 10% when `validate` returns null. That is a false price promise. On the full page (`?ref=` only) the banner correctly waits for `referralInfo`, but it sits in the Passes section ~6 screens down, not at the top. | ❌ |
| S8 | get the discount when I actually buy | Code read: the plan link from SharePlanModal carries no `ref` (two separate links, `SharePlanModal.vue:26-44`), so the WhatsApp plan link never has a discount. With a combined link, "Create my plan" strips `ref` before checkout (S4), so `ticketCheckout` gets no `referralCode`. Then the checkout → sign-up stacking bug (03-S6) blocks payment anyway. | ❌ |
| S9 | open an old or broken link | `?plan=shared` (legacy) → "A dancer's Plan · Follow · 0 workshops · Add A dancer as friend" — a hollow page with a fake identity ([04-legacy-plan-shared](screenshots/04-legacy-plan-shared.jpg)). `?invite=garbage` → decode fails silently and the normal festival page renders, with no "this link is broken, ask your friend to share again". Festival-key and old-slug URLs keep `?invite=` through the canonical redirect (`[id].vue:111-112`). | ⚠️ |
| S10 | trust the person is who the link says | The name, role and dancer id are unsigned client data: anyone can craft "Maria's Plan" whose "Add as friend" follows a different dancer (`d`). Not a big risk at this scale, but J7 says real faces: no real photo, no link to `/u/<username>`, no "Maria is on WeDance since…". | ⚠️ |

## Data we have but don't show
- Festival dates, city, venue, flyer, passes and `ticketUrl`: all loaded (`data.festival`) but not passed to SharedPlanView.
- The sharer's real profile (name, photo, username) via `d` → dancer id: only the self-declared name from the token is used.
- Which pass covers the sharer's picks: the "Best value for your plan" logic exists (`FestivalView.vue` recommendation), so "Maria's plan fits the Friday Pass €60" is computable.
- Who else is going to the same sessions ("1 going" counts exist on the full page).

## Desktop differences
Same single column at 736 px, centred on an empty page with no header, nav or footer ([04-shared-plan-desktop](screenshots/04-shared-plan-desktop.jpg)); only "Talk to us" is fixed in the corner. Even more of a dead end than on mobile.

## Top fixes (impact × effort)
1. Render the shared plan *inside* the festival page: hero (dates, city, price, tickets), then the "Maria's plan" card, then the normal page (M).
2. "Add Maria's picks to my plan" — copy her workshops into the visitor's local plan, keep `ref`, and scroll to the pass recommendation for those picks (S).
3. Referral banner only when `validate` returns data; drop the `|| sharer.name` / `|| 10` fallbacks; put the plan's `ref` into the invite link automatically (S).
4. Server-render og tags for invite links: "Maria's plan for ¡Menéate Viena! — 3 workshops, needs a partner for Casino en Pareja" (M, same work as 03 fix 1).
5. Broken / legacy links: show a friendly "This shared plan link is broken" notice on the festival page instead of "A dancer's Plan · 0 workshops" (S).
6. Contextual sign-up copy for `friend` / `ticket`, and resume the action after sign-up (be-partner, checkout) (S).
7. Resolve the sharer from `d` on the server (real name, photo, `/u/` link) instead of trusting the token's name (M).

Screenshots: `screenshots/04-shared-plan-ref-mobile.jpg`, `screenshots/04-legacy-plan-shared.jpg`, `screenshots/04-shared-plan-desktop.jpg`
