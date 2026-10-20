# WeDance 2026 — Tracking Plan

_Last updated: 2026-10-20 20:38 CEST (P0 #404, P1+P2 #407) · Source: code on `origin/main` @ 2e146e6, CUJ taxonomy (`docs/issues/_reference-cuj-jtbd.md`), PostHog project 29269 (last 30 days)._

Legend: ✅ tracked · ⚠️ tracked but flawed · ❌ missing · ⏭ skipped (feature not in code) · **S** = server-side (`server_*`), **C** = client.
Priority: **P0** this week · **P1** next sprint · **P2** later.

---

## 1. Where we are

| | |
|---|---|
| Instrumented in code | ~67 client events, 38 server events (PR #400, P0 #404, P1+P2 #407) |
| Ever received (30 d) | 10 custom client events + autocapture/pageview/rageclick |
| Received since #400 deploy | `city_viewed` verified firing on prod (20:05). No `server_*` yet — traffic too low, not a bug. |
| Volume | 101 visitors / 4,067 pageviews / 3 sign-ups in 30 d |

Live counts (30 d, `app = wedance-2026`):

| Event | Count | People |
|---|---|---|
| `year_plan_add` | 141 | 7 |
| `week_plan_add` | 84 | 7 |
| `problem_report_opened` / `_submitted` | 76 / 39 | 10 / 6 |
| `ticket_cta_click` | 50 | 5 |
| `onboarding_completed` | 21 | 7 |
| `shared_plan_signup` | 10 | 6 |
| `organizer_cta_click` | 8 | 3 |
| `gig_cta_click`, `city_battle_vote`, `profile_updated` | 7 each | 2–4 |
| `festival_draft_submitted` | 5 | 2 |
| `signup_completed` | 3 | 3 |
| `video_submit` | 1 | 1 |

Data-hygiene problems (fix before trusting any number):

- ✅ **Local dev sends to prod PostHog** — ~350 pageviews from `localhost:*` (the Vercel-pulled `.env` contains the prod key). Fixed at source (#404): the client plugin is a no-op on a dev build and on local hosts (`app/lib/analytics-host.ts`), the server helper is off under `nuxt dev`. Keep the `$host` filter for historic data.
- ❌ **Internal users not excluded** — one person = 1,672 of 4,067 pageviews. Founder action in PostHog (not code): set the test-account filter on the person property `is_admin = true` (already sent on identify).
- ✅ **Server/client name mismatches** break the `server_<client name>` rule:
  `booking_request_submitted` ↔ `server_booking_requested`, `booking_inquiry_sent` ↔ `server_inquiry_sent`. Renamed server side (#404); a catalogue test keeps them gone. Old names stop on deploy — insights spanning the deploy need both names.
- ⚠️ v4 + 2026 share one project; every insight must filter `app = wedance-2026`.

---

## 2. North Star & per-journey KPIs

**North Star:** _Weekly Planning Dancers_ — unique dancers per week who add something to their week/year plan or mark going (`week_plan_add` ∪ `year_plan_add` ∪ `workshop_plan_add`).

| CUJ | KPI (what the dashboard should answer) | Built from |
|---|---|---|
| C1 Seeker | % first-time visitors who view a class and add it to plan within 7 d | `city_viewed` → `event_viewed` → `week_plan_add` |
| C2 Student | Teacher discovery → follow / private-class request rate | `profile_viewed` → `follow` / `server_booking_request_submitted` |
| C3 Regular | Weekly returning dancers per city | lifecycle on `city_viewed`, `week_plan_add` |
| C4 Traveler | Festival view → plan → ticket paid | `festival_viewed` → `year_plan_add` → `ticket_cta_click` → `server_ticket_purchased` |
| C5 Pro | Gigs applied / bookings received per artist | `server_gig_applied`, `server_booking_request_submitted` |
| C6 Host | Private-event inquiries → organiser reply rate & time | `server_event_inquiry_submitted`, `server_inquiry_replied` |
| C7 Organizer | Organisers publishing ≥1 event / week; paid subscriptions | `server_event_published`, `server_subscription_activated` |
| C8 Member | Sign-up → onboarded → planned in 7 d; referral share | `server_signup_completed` → `onboarding_completed` → plan add |

---

## 3. Event plan by journey

### C1 — Seeker: find your dance

| Step | Event | Status | Props | Pri |
|---|---|---|---|---|
| Landing CTA click | `landing_cta_click` C | ✅ (#407) hero, journey stages, proof card, business cards, footer | `cta`, `section` | — |
| Style quiz started / finished | `find_your_dance_started`, `find_your_dance_completed` C | ✅ (#407) — the page is not a quiz: started = first video watched (or a direct choice), completed = a style or the taster chosen | `style_chosen`, `taster`, `answers_count` (videos watched), `styles_suggested` | — |
| City page view | `city_viewed` C | ✅ | `city`, `style` | — |
| Style chip filter | `filter_used` C | ✅ | `surface`, `filter_keys` | — |
| Class/event view | `event_viewed` C | ✅ | `event_id`, `city`, `style`, `event_type`, `synced`, `is_festival` | — |
| Add class to week | `week_plan_add` C | ✅ + `event_type`, `city`, `surface` (#407) | — | — |

### C2 — Student: find your teacher

| Step | Event | Status | Props | Pri |
|---|---|---|---|---|
| Artist list search | `search_used` C | ✅ (`/artists`) | `surface`, `query_length`, `results` | — |
| Profile view (`/@handle`, `/u/…`) | `profile_viewed` C | ✅ (#407) `trackOnce`; dancers send no handle | `profile` (business only), `profile_type`, `city`, `claimed`, `own`, `surface` | — |
| Follow / unfollow | `follow` / `unfollow` C | ✅ | `target`, `profile_type`, `surface` | — |
| Private class / booking request | `booking_request_submitted` C + **S** | ✅ server renamed to `server_booking_request_submitted` (#404) | `booking_id`, `signed_in` | — |
| Workshop plan / goals | `workshop_plan_add`, `goal_added` C | ✅ | — | — |

### C3 — Regular: find your floor

| Step | Event | Status | Props | Pri |
|---|---|---|---|---|
| Venues list / search | `search_used` C on `/venues` | ⏭ skipped — `/venues` has no search box or filters (a static list); add one first if wanted | `surface=venues` | P2 |
| Outbound click (venue site, Instagram, event link, map) | `outbound_click` C | ✅ (#407) one delegated listener for every external link (`plugins/06.outbound-click.client.ts`); host only, never path/query | `kind`, `platform`, `host`, `object_type`, `object_id`, `city`, `surface` | — |
| Community group join link | `outbound_click{kind:'community_group'}` | ✅ (#407) | `platform`, `city` | — |
| Hangout create / RSVP | `hangout_created`, `hangout_rsvp` C | ✅ | — | — |
| Ask locals post / answer | `ask_locals_post` ✅ / `ask_locals_answer` ⏭ | skipped — there is no answer/reply feature (`askLocals` has only `ask` + `recommend`, both tracked as `ask_locals_post`) | `city` | P2 |

### C4 — Traveler: plan your festival year (biggest CUJ: 37 stories)

| Step | Event | Status | Props | Pri |
|---|---|---|---|---|
| Festival list search | `search_used` C | ✅ | — | — |
| Festival view | `festival_viewed` C | ✅ | same as `event_viewed` | — |
| Add to year | `year_plan_add` / `_remove` C | ✅ + `festival`, `surface` (#407) | — | — |
| Who's going | `whos_going_profile_opened`, `going_visibility_changed`, `wave_sent` C | ✅ | — | — |
| Festival join (roster) | `server_festival_joined` S | ✅ | `festival` | — |
| Ticket CTA | `ticket_cta_click` C | ✅ + `provider` (#407) | stripe / tickettailor / external | — |
| Checkout started | `server_ticket_checkout_started` S | ✅ | `festival`, `tickets`, `referral` | — |
| **Ticket paid** | `server_ticket_purchased` S | ✅ (#404) Stripe `checkout.session.completed` + TicketTailor first of `order.created`/`order.completed` per order; buyer's dancer id, dedupe uuid per session/order | `festival`, `amount`, `currency`, `tickets`, `provider`, `product`, `referral`, `referral_code`, `discount`, `$revenue` | — |
| Checkout abandoned | `server_ticket_checkout_expired` S | ✅ (#404) | `festival`, `tickets`, `product`, `referral` | — |
| Share plan link | `plan_shared` C | ✅ (#407) festival + year share modals; `SharePlanModal` no longer fires `shared_plan_signup` on share | `object` (festival/year), `method` (copy/native) | — |
| Shared plan viewed | `shared_plan_viewed` C | ✅ (#407) | `object`, `signed_in`, `has_referral` | — |
| Dinner / ride / roommate | `dinner_joined`, `ride_share_posted`, `roommate_search_toggled` C | ✅ | — | — |
| Check-in at festival | `server_checked_in` S | ✅ (#407) `attendance.checkIn` | `event_id`, `is_festival` | — |

### C5 — Pro: take the stage / get booked

| Step | Event | Status | Props | Pri |
|---|---|---|---|---|
| Gigs CTA / gig posted | `gig_cta_click`, `gig_posted` C | ✅ | — | — |
| Gig applied | `server_gig_applied` S | ✅ (#407) `gigs.applyTo` (web + MCP) | `gig_id`, `category`, `as_profile` | — |
| Application decided | `server_gig_application_decided` S | ✅ (#407) | `decision`, `hours_to_decide` | — |
| Booking request received → decided | `server_booking_decided` S | ✅ (#407) `election.moderateBooking` — only free spaces decide on-platform | `decision`, `hours_to_decide` | — |
| Artist invite accepted | `server_profile_claimed{via:'invite'}` | ✅ | — | — |
| Elections / videos | `video_vote`, `video_submit`, `election_nominated` C | ✅ | — | — |

### C6 — Host: private event & venue

| Step | Event | Status | Props | Pri |
|---|---|---|---|---|
| For-venues / for-events CTA | `venue_cta_click` C | ✅ (#407) `for-venues.vue` | `cta` | — |
| Event inquiry | `event_inquiry_submitted` C + S | ✅ | `event_type`, `city` | — |
| Inquiry to profile | `booking_inquiry_sent` C / `server_booking_inquiry_sent` S | ✅ renamed (#404) | `profile`, `delivered` | — |
| Organiser replies / marks inquiry | `server_inquiry_replied` S | ✅ (#407) `inquiries.setStatus`, first move out of `new` | `hours_to_reply`, `status` | — |
| Venue asks | `server_venue_ask_sent` / `_booked` / `_unbooked` S | ✅ (#407) | `event_id`, `venue` | — |

### C7 — Organizer: run a festival (36 stories)

| Step | Event | Status | Props | Pri |
|---|---|---|---|---|
| Organiser CTA | `organizer_cta_click` C | ✅ | `cta` | — |
| Profile created / claimed | `server_business_profile_created`, `server_profile_claim_requested`, `server_profile_claimed` S | ✅ | — | — |
| Event created / published | `server_event_created`, `server_event_published` S | ✅ (`channel` web/mcp) | — | — |
| Flyer generated | `server_flyer_generated` S (+ `server_flyer_kept`) | ✅ (#407) all 6 paint mutations; keeping is its own event | `event_id`, `mode`, `variant_count` | — |
| Captions / promo kit / posts | `server_caption_written`, `server_promo_kit_opened`, `server_post_proposed` | ✅ (#407) promo kit is server-side (`referral.promoKit` is an MCP/web mutation, no client surface) | — | — |
| Tracked-link visit | `tracked_link_visit` C | ✅ (#407) | `code_type`, `referral_code`, `counted` | — |
| Insights viewed | `organizer_insights_viewed` C | ✅ (#407) per festival | `festival` | — |
| Website saved / team role set | `server_site_saved`, `server_member_role_set` S | ✅ (#407) | — | — |
| Subscription checkout | `server_subscription_checkout_started` S | ✅ | `plan` | — |
| **Subscription paid / cancelled** | `server_subscription_activated`, `server_subscription_cancelled` S | ✅ (#404) — also fixes subscription checkouts hitting the ticket branch's "missing metadata" 400 | `plan`, `amount`, `currency`, `interval`, `$revenue` · cancelled: `reason`, `days_active` | — |
| Group analytics | PostHog **group** `profile` = organiser username | ✅ (#407) client on Business mode pages + own `/@handle`; server `$groups` where a business profile is in scope | lets us count *organisations*, not people | — |

### C8 — Member: belong & connect

| Step | Event | Status | Props | Pri |
|---|---|---|---|---|
| Sign-up / login | `signup_completed`, `login_completed` C + S | ✅ | `method`, `via_link` | — |
| Onboarding steps | `onboarding_step_completed` C | ✅ (#407) — `repeat` flags re-onboarding of already-onboarded accounts | `step`, `intent`, `repeat` | — |
| Profile updated | `profile_updated` C | ✅ + `fields_changed` (names only, #407) | — | — |
| Connected AI app | `app_connected` C | ✅ | — | — |
| Referral link shared | `referral_link_shared` C | ✅ (#407) the dancer referral link in `SharePlanModal`; the promoter link (`referral.myLink`) has no web UI (MCP only) — its use shows up as `server_promo_kit_opened` / `tracked_link_visit` | `method` | — |
| Account deleted | `server_account_deleted` S | ✅ (#407) sent anonymously (account is gone) | `days_since_signup` | — |
| Problem report | `problem_report_*` C | ✅ (+ replay link fixed) | — | — |

---

## 4. Conventions (keep)

- snake_case, `object_action` past tense; one event per user intent.
- Client event `x` ↔ server `server_x` (identical suffix). Count conversions on `server_*`.
- Standard props where applicable: `city`, `style`, `event_id`, `festival`, `profile_type`, `surface`, `channel`.
- Never send names, emails, free text, or search queries. Money: `amount` (cents), `currency`, plus `$revenue` (major units) on purchase events.
- Every new event goes into the catalogue in `CLAUDE.md → Analytics (PostHog)` in the same PR.

## 5. Execution order

1. **P0 (one PR):** `server_ticket_purchased` + `server_ticket_checkout_expired` (Stripe + TicketTailor webhooks), `server_subscription_activated/cancelled`, rename `server_booking_requested` → `server_booking_request_submitted` and `server_inquiry_sent` → `server_booking_inquiry_sent`, empty local PostHog key. Founder: set PostHog test-account filter.
2. **P1 (one PR):** `outbound_click`, `profile_viewed`, `plan_shared` / `shared_plan_viewed`, `landing_cta_click`, find-your-dance quiz, onboarding steps, `server_gig_applied` / `_decided`, `server_inquiry_replied`, `server_flyer_generated`, `tracked_link_visit`, `organizer_insights_viewed`, `referral_link_shared`, `provider` on `ticket_cta_click`.
3. **Dashboard:** add Revenue tile (`$revenue` sum), North-Star tile, per-CUJ funnels above; mirror safe tiles to the public dashboard.
4. **P2:** remaining rows, PostHog groups for organiser profiles.
