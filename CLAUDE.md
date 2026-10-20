# WeDance 2026 — Code Repository

## Framework

@/Users/razbakov/Projects/ikigai-team/CLAUDE.md

---

Dance community platform. Nuxt 4 + tRPC + Drizzle ORM + Neon (PostgreSQL).

## Links

- **Live:** https://2026.wedance.vip
- **Vercel project:** `wedance-2026` (team: `wedance`)
- **Org governance:** `~/Orgs/WeDance/`
- **GitHub:** `razbakov/wedance-2026` — open source, **AGPL-3.0-only** (`LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`)
- **Docs (public, indexed):** https://2026.wedance.vip/docs — hub + quick start (`app/pages/docs/`),
  design system `/docs/design/**`, generated architecture `/docs/architecture/**` (ADR-000).
  Old `/design/**`, `/architecture/**`, `/styleguide` 301 there (`nuxt.config.ts` routeRules).
  Shell/nav: `app/components/docs/Shell.vue`, `app/lib/docs-nav.ts`; pages use `layout: 'docs'`.

## Structure

```
app/                  # Nuxt app (pages, components, composables)
server/               # Backend (tRPC, database, API routes)
e2e/                  # Playwright tests
public/               # Static assets
```

## Commands

- `bun install` — install deps
- `bun run dev` — dev server
- `bun run build` — production build
- `bun run test` — unit tests (vitest)
- `bun run test:e2e` — e2e tests (playwright)

## Deployment

Auto-deploys on push to `main` via Vercel + GitHub integration.

## Conventions

- All agent work delivered via PRs
- Code ownership: Engineer agent (dispatched from `~/Orgs/WeDance/`)
- Work items tracked on org work board: `~/Orgs/WeDance/03_Coordination/Work_Board.md`
- Client form validation uses **valibot**: add the form's schema to `shared/validation/forms.ts`
  (field builders in `fields.ts`, limits mirroring the tRPC zod input), then
  `const { errors, validate, fieldAttrs } = useFormValidation(schema, state)`. On submit,
  `const result = validate(); if (!result.success) return` and send `result.data`. Each input
  gets `v-bind="fieldAttrs('field', 'x-field-error')"` plus `<FieldError id="x-field-error" :message="errors.field" />`,
  so a failed submit flags every invalid field at once. `<form>`s get `novalidate`.

## Data (migrated from v4 — 2026-07-15)

Real production data lives in Neon (replacing the old mock-only state). Migrated
from wedance-v4 (Postgres) via `scripts/migrate/`, idempotent + reversible
(every row carries `source_ref`; rollback = `DELETE … WHERE source_ref IS NOT NULL`):
- **3,910 users → `dancers`** (2,339 with passwords; auth continuity verified —
  v4's Firebase-scrypt hashes verify unchanged in 2026).
- **6,426 profiles → `profiles`** (venue/artist/organizer; v4 "FanPage" → organizer).
- **9,580 events → `events`** — all `archived=true`/hidden. NOTE: the source is a
  historical snapshot (newest ~2026-04); there are **no upcoming events** in any
  source (v3 Firestore ends 2022), so "this week"/upcoming feeds have no real data
  until organizers create events going forward.
- **667 follow edges → `follows`**.
**Update 2026-10-04:** the "no upcoming events" note above is obsolete — wedance.vip
(v3 Firestore `posts`, type `event`) is actively maintained (~1,300 upcoming events,
~1,000 of them in Munich). They are mirrored into `events` by the v3 sync below.

Live DB-backed surfaces: sign-in, `/@handle` profiles, `/cities` + `/cities/[city]`,
`/artists`, `/venues`, city video vote, ask-locals, community groups, festival
submit-draft. Festivals list + my-plan/my-year remain partly mock/preview.

## Product backlog (landing-promise audit — 2026-07-16)

125 user stories derived from every landing-page promise/feature/use-case, each
linking **P-id · CUJ (journey) · JTBD · status (built/partial/not-built) · WSJF**.
Kept in sync across three surfaces:
- **Repo:** `docs/issues/<Pxxx>-*.md` (source of truth for story content; taxonomy
  in `docs/issues/_reference-cuj-jtbd.md`).
- **Linear:** team **WED** — 125 issues, 8 CUJ projects (C1–C8), label taxonomy
  (`status:*`, `cuj:C#`, `jtbd:J#`, `aud:*`, `landing-audit`), WSJF-based priority,
  cycle 1 loaded. Titles are short handles (e.g. "Who's Going"), detail in the body.
- **Sheet:** "WeDance 2026 UX" (`12YiUIcBd02hIIj2ua1w2bMFJSJSuIf8a64CQP7E60mg`) →
  "Landing Promises" tab (index + a Linear-link column per row).
Split: 43 built · 60 partial (Todo) · 22 not-built (Backlog). Biggest gap = the
flagship "see who's going / real faces" attendee roster (not built).

## wedance.vip → 2026 event sync

`bun run sync:v3-events` mirrors every **upcoming** wedance.vip event (Firestore
`posts` where `type == "event"`, `startDate >= now`, all cities) into the `events`
table. **Read-only against v3** — the only Firestore call is `:runQuery` (REST, no
firebase-admin). Code: `scripts/sync-v3-events.ts` (CLI) + `server/utils/v3EventSync.ts`
(mapping, Firestore client, upsert; unit-tested).

- **Dry-run is the default.** `--write` applies migration `0021_events_v3_sync.sql`
  (idempotent, additive) then upserts. `--json` prints a machine-readable summary.
- **Key:** `source='wedance-v3'`, `source_id=<v3 post id>`; rows go `archived=false,
  published=true`. Still-upcoming rows that v3 no longer lists → `archived=true`.
  Re-running is a no-op (reports `unchanged`). Rollback: `DELETE FROM events WHERE source='wedance-v3'`.
- **Mapping:** city = venue locality (→ 2026 `city_slug` via profiles + `city-images.json`
  altNames, e.g. München→munich); styles = v3 StyleKeys → 2026 labels (`STYLE_MAP`);
  times stored UTC + IANA `timezone`, always rendered in the event's zone
  (`shared/utils/eventTime.ts`). Festival/Congress/Weekender → `is_festival`.
- **Shown on:** `/cities/[city]` (this-week calendar, "Coming up", festivals) and
  `/events/[id]` via the `events` tRPC router.
- **Profiles (since 0022):** the same run also syncs the venues, organisers and
  artists behind those events (`server/utils/v3ProfileSync.ts`) and links each event
  (`venue_username`, `organizer_username`, `artists[]`), which feeds the city page's
  "Who's on the floor" tabs and the schedule on `/@handle`. Dedupe order — people:
  v3 profile id (`source_ref.firebaseId` from the v4 migration) → handle → name+city;
  venues: Google place id (the v4 venue-handle convention) → name+city → contained
  name → street+number → the organiser's own profile when the school hosts its
  classes → ≤75 m from a venue this sync created. Unmatched venues are created
  (address-only ones are named after the street). Claimed profiles are never
  written; other unclaimed rows only get EMPTY fields filled; rows this sync created
  (`source_ref.source='wedance-v3'`) follow v3. Only `visibility: Public` v3 profiles
  are copied, and only public fields (name, handle, photo, bio, social links, city,
  styles, venue address) — never email/phone. Rollback:
  `DELETE FROM profiles WHERE source_ref->>'source'='wedance-v3'` (after clearing the
  event links: `UPDATE events SET venue_username=NULL, artists='[]' WHERE source='wedance-v3'`).
  Display check: `bun e2e/synced-profiles.check.ts <venueHandle> <organiserHandle>`.
- **Env:** `DATABASE_URL` (target — check it before `--write`; the Vercel-pulled `.env`
  is PRODUCTION), `WEDANCE_V3_SERVICE_ACCOUNT` (JSON) or `WEDANCE_V3_SERVICE_ACCOUNT_FILE`
  (default `~/Secrets/wedance.json`).
- **Display check:** `BASE_URL=http://localhost:3000 bun e2e/synced-events.check.ts <eventId:HH:MM>…`
  (asserts no digit-only style tags / epoch numbers / timezone shifts; screenshots →
  `docs/screenshots/v3-sync/`).

### Vercel Preview environment

Preview deployments share the production `DATABASE_URL` so that DB-backed pages
(e.g. `/gigs`, `/cities/[city]`, `/@handle`) render correctly on PR previews.
There is only one Neon database — Neon branching can be added later if write
isolation becomes necessary.

### Local Postgres (never test writes against prod)

There is only one Neon database (production). For local work, restore a copy into
Docker and point the Neon HTTP driver at a local stand-in:

```
docker run -d --name wedance-2026-dev-db -e POSTGRES_USER=dev -e POSTGRES_PASSWORD=dev \
  -e POSTGRES_DB=wedance -p 5441:5432 postgres:17-alpine
pg_dump "$PROD_DIRECT_URL" --no-owner --no-privileges --exclude-table-data=dancers \
  --exclude-table-data=sessions | psql postgresql://dev:dev@localhost:5441/wedance
bun run dev:db-proxy          # Neon-HTTP-compatible proxy on :4444
# .env: DATABASE_URL=postgresql://dev:dev@localhost:5441/wedance
#       NEON_FETCH_ENDPOINT=http://localhost:4444/sql
```

## Analytics (PostHog)

**Setup.** Client: `app/plugins/03.posthog.client.ts` (posthog-js, EU host, manual `$pageview`
on route change, `person_profiles: 'identified_only'`). Call sites use `useTrack()`
(`app/composables/useTrack.ts`: `track`, `trackOnce`, `identify`, `reset`, `sessionReplayUrl`) —
never import posthog directly; everything is a no-op without `NUXT_PUBLIC_POSTHOG_KEY` (tests).
Server: `server/utils/posthog.ts` → `trackServer(ctx, name, props)` from tRPC procedures
(dependency-free `fetch` to `/i/v0/e/`, handed to `ctx.waitUntil`, never throws, off under vitest);
`trackServerEvent(h3Event, name, distinctId, props, { dedupeKey })` from webhooks / plain API routes
(no tRPC ctx: `distinctId` = the buyer's dancer id when known, else anonymous; `channel: 'webhook'`;
`dedupeKey` → deterministic event `uuid` so redeliveries collapse).
`server/utils/posthog.catalogue.test.ts` fails when a `server_*` event in code is missing from the table below.

**Local dev never sends.** The Vercel-pulled `.env` holds the PRODUCTION key. The client plugin is a
no-op on a dev build (`import.meta.dev`) and on local hosts (`app/lib/analytics-host.ts`: localhost,
127.x, ::1, `*.localhost`, `*.test`); the server helper is off under `nuxt dev`. To debug PostHog
locally, use a separate test project key, and still expect nothing from localhost — test on a preview.

**The `app` filter rule.** 2026 shares the WeDance v4 PostHog project (EU free plan = one project).
Every event — client super-property and server payload — carries `app: 'wedance-2026'`.
**Always filter insights/funnels on `app = wedance-2026`.**

**Identity.** `identify(dancerId)` runs on sign-in (`setSession`) and on every session restore
(`auth.me` → `_applyMe`), idempotently (skipped when `get_distinct_id()` already is the dancer; only
person props are refreshed). Person props are non-PII only: `city`, `is_admin`, `role`, `intent`,
`onboarded`, `dance_styles_count`, `has_username`. Never send names, emails or raw search text.
`reset()` on sign-out. Server events use `distinct_id = dancerId`; anonymous server calls get a random
id + `$process_person_profile: false`.

**Client vs server convention.** Conversions fire twice: the client event (in-session context:
pageviews, replay, UTM) and a `server_<same name>` copy from the router (survives ad blockers).
**Count conversions on `server_*`**; use the un-prefixed client event for in-session funnels. Never
mix the two in one count. Server events also carry `$lib: 'wedance-server'` and `channel: web|mcp`.

### Client events (`useTrack().track`)

| Event | Fired in | Props |
|---|---|---|
| `$pageview` | `plugins/03.posthog.client.ts` (route change) | `path` |
| `signup_completed` | `useAuth.register`, `useAuth.verifyMagicLink` (server says `isNew`, rule below) | `method` (password / magic_link) |
| `login_completed` | `useAuth.login`, `useAuth.verifyMagicLink` | `method` |
| `onboarding_completed` | `useAuth.completeOnboarding` | `intent` |
| `profile_updated` | `useAuth.updateProfile` | `fields_changed` (field NAMES only, `app/lib/changed-fields.ts`) |
| `onboarding_step_completed` | `onboarding.vue` (intent picked · details saved · skipped) | `step` (intent / details / skip), `intent`, `repeat` (already onboarded), `has_details` · `has_city`, `styles_count`, `has_role` |
| `landing_cta_click` | `index.vue` | `cta` (find_festival / seeker … / see_attendees / private_events / festival_organizers), `section` (hero / journey / proof / business / footer) |
| `find_your_dance_started` / `find_your_dance_completed` | `find-your-dance.vue` (first video watched or choice · a style or the taster chosen; not a quiz) | `style`, `via` · `style_chosen`, `taster`, `answers_count` (videos watched), `styles_suggested` |
| `profile_viewed` | `/@handle` (business profiles, `trackOnce`), `/u/<handle>` (dancers — no handle sent) | `profile` (business only), `profile_type`, `city`, `claimed`, `own`, `surface` |
| `outbound_click` | delegated listener `plugins/06.outbound-click.client.ts` (every external link) | `kind` (ticket / website / instagram / map / whatsapp / telegram / community_group / email / phone / …; `data-outbound-kind` overrides), `platform`, `host` (never path/query), `object_type`, `object_id` (`data-object-*` or the page's `useTrackContext`), `city`, `surface` (route name) |
| `plan_shared` | `SharePlanModal` (festival workshop plan), `ShareYearPlanModal` (year) | `object` (festival / year), `method` (copy / native), `festival` / `workshops` / `festivals`, `surface` |
| `shared_plan_viewed` | `FestivalView` (`?invite=` / `?plan=shared`), `my-year?user=` | `object`, `festival`, `signed_in`, `workshops` / `festivals`, `has_referral` |
| `referral_link_shared` | `SharePlanModal` referral link copy | `method`, `festival`, `surface` |
| `tracked_link_visit` | `plugins/05.tracked-link.client.ts` (`?via=` promoter link) | `code_type`, `referral_code` (promoter link code), `counted`, `landing` |
| `organizer_insights_viewed` | `organizers/insights.vue` (once per festival per 30 min) | `festival`, `profile_type`, `festivals` |
| `venue_cta_click` | `for-venues.vue` | `surface`, `cta` (list_venue / for_organizers / booking_terms) |
| `city_viewed` | `pages/cities/[city]/index.vue` (once per mount) | `city`, `style` |
| `event_viewed` | `pages/events/[id].vue` (non-festival, once per mount) | `event_id`, `city`, `style`, `event_type`, `synced`, `is_festival` |
| `festival_viewed` | `pages/events/[id].vue` (festival) | same as `event_viewed` |
| `filter_used` | city page style chip | `surface`, `city`, `filter_keys`, `style` |
| `search_used` | `/festivals`, `/artists`, `/gigs` (`useTrackSearch`, debounced) | `surface`, `query_length`, `filter_keys`, `results` |
| `week_plan_add` / `week_plan_remove` | `useWeekPlan` (Going! toggle), `my-plan` enroll / course X | `event_id`, `week_count` or `source`; add: `event_type`, `city`, `surface` |
| `year_plan_add` / `year_plan_remove` | `useYearPlan` | `festival_slug`, `year_count`; add: `festival`, `surface` |
| `workshop_plan_add` / `workshop_plan_remove` | `festival/FestivalView.vue` | `festival`, `workshop_id`, `workshop_type`, `partner_status` |
| `discover_swipe` | `my-plan` discover deck | `direction`, `card_kind`, `added_festival`, `added_event` |
| `goal_added` | `useGoals.addGoal` | `style` |
| `follow` / `unfollow` | `/@handle`, `PromoterProfile` (profiles); `FestivalView` shared plan (dancer) | `target`, `profile`, `profile_type`, `surface` |
| `whos_going_profile_opened` | `GoingSection` face tap | `item_type`, `item_id` |
| `going_visibility_changed` | `GoingSection` share toggle | `share`, `item_type`, `item_id` |
| `wave_sent` / `wave_retracted` | `GoingSection`, `DiscoverDancers` | `festival`, `surface` |
| `discover_deck_joined` | `DiscoverDancers` "show me" | `item_type`, `item_id`, `was_going` |
| `hangout_created` | `FestivalView`, `my-plan` | `kind`, `surface`, `event_id` / `event_linked` |
| `hangout_rsvp` | `FestivalView`, `my-plan` | `going`, `surface`, `hangout_id` |
| `dinner_joined` · `ride_share_posted` · `roommate_search_toggled` | `useDinners` · `useRideShares` · `useRoommates` | `dinner_id` · `festival`, `type` · `festival`, `looking` |
| `shared_plan_signup` | `FestivalView`, `my-year` ("add friend" from a shared plan) | `surface`, `slug` |
| `ask_locals_post` · `video_submit` · `video_vote` · `city_battle_vote` | city components | `city`, … |
| `review_submitted` · `giveaway_entered` · `election_nominated` | `ReviewsSection` · `GiveawayCard` · `elections/[handle]` | target ids |
| `event_created` / `event_published` | `business/events/new.vue`; publish = draft→live in `business/events/[id]` | `event_id`, `is_festival`, `city`, `style`, `published` |
| `business_profile_created` | `business/new.vue` | `profile`, `profile_type`, `from_instagram` |
| `profile_claim_started` / `team_join_started` | `business/claim.vue` (form opened) | `profile`, `kind` |
| `profile_claim_requested` / `team_join_requested` | `business/claim.vue` (sent) | `profile`, `kind`, `evidence_type` |
| `profile_claimed` | `confirm/[token].vue` (invite link) | `via`, `new_account` |
| `tickets_claimed` | `charanga/claim.vue` | `count`, `festivals` |
| `booking_inquiry_sent` · `booking_join_offered` · `booking_request_submitted` · `booking_added_to_event` | `BookingInquiryForm`, `PromoterProfile`, `/@handle`, `book/[handle]` | `profile`, … |
| `event_inquiry_submitted` | `for-events.vue` | `event_type`, `city` |
| `gig_posted` · `gig_cta_click` | `gigs/index.vue` | `kind`, `category` · `action`, `gig_id` |
| `ticket_cta_click` | `FestivalHero` (external shop), `FestivalView` (Stripe checkout) | `slug` / `festival`, `provider` (stripe / tickettailor / external), `tickets`, … |
| `organizer_cta_click` · `sponsor_cta_click` · `press_cta_click` · `whats_new_*_click` | marketing pages | `surface`, `kind` |
| `app_connected` | `oauth/authorize.vue` | `scopes`, `business` |
| `problem_report_opened` / `problem_report_submitted` / `problem_report_screenshot` | `ReportProblem` | `type` · `captured` (screenshot) |

### Server events (`trackServer`, all prefixed `server_`)

| Event | Procedure | Props |
|---|---|---|
| `server_signup_completed` | `auth.register`, `auth.verifyMagicLink` (account created by this flow, see note) | `method`, `has_city`, `via_link` |
| `server_login_completed` | `auth.login`, `auth.verifyMagicLink` | `method` |
| `server_onboarding_completed` | `auth.completeOnboarding` | `intent` |
| `server_event_created` | `businessEvents.create`, `businessEvents.createSeries` | `event_id`, `is_festival`, `host_type`, `city`, `published`, `series_id`, `dates` |
| `server_event_published` | `create`/`createSeries` with `published`, `update` draft→live, `publishSeries` | `event_id`, `is_festival`, `series_id`, `dates` |
| `server_booking_request_submitted` | `booking.request` (was server_booking_requested until 2026-10-20) | `booking_id`, `signed_in` |
| `server_booking_inquiry_sent` | `inquiries.send` (was server_inquiry_sent until 2026-10-20) | `inquiry_id`, `profile`, `delivered`, `signed_in` |
| `server_event_inquiry_submitted` | `feedback.inquiry` | `event_type`, `city` |
| `server_festival_draft_submitted` | `festival.submitDraft` (server only) | `submission_id`, `festival`, `signed_in` |
| `server_profile_claim_requested` / `server_team_join_requested` | `businessTeam.requestAccess`, `business.requestClaim` | `profile`, `profile_type`, `kind`, `evidence_type` |
| `server_profile_claimed` | `business.decideClaim` approve (claimant's id), `artistInvites.claim` | `profile`, `via` (review / invite) |
| `server_business_profile_created` | `business.create` | `profile`, `profile_type` |
| `server_festival_joined` | `festivalSignup.join` | `festival` |
| `server_ticket_checkout_started` | `festivalSignup.ticketCheckout`, `festivalSignup.createCheckoutSession` | `festival`, `tickets`, `referral` |
| `server_subscription_checkout_started` | `organizerSubscription.createCheckout` | `plan`, `profile_type` |
| `server_gig_applied` | `gigs.applyTo` | `gig_id`, `category`, `as_profile`, `reapplied`, `$groups` |
| `server_gig_application_decided` | `gigs.decideApplication` | `gig_id`, `category`, `decision`, `hours_to_decide` |
| `server_booking_decided` | `election.moderateBooking` (free spaces; commercial venues decide off-platform) | `booking_id`, `decision`, `hours_to_decide`, `redecided`, `free` |
| `server_inquiry_replied` | `inquiries.setStatus` (first move out of `new`) | `inquiry_id`, `status` (answered / declined), `hours_to_reply`, `profile`, `profile_type`, `$groups` |
| `server_flyer_generated` | `businessFlyers.make` / `directions` / `again` / `feed` / `fix` / `refresh` (each is an AI paint) | `event_id`, `mode`, `variant_count`, `saved_look`, `references`, `feelings`, `from_kept`, `$groups` |
| `server_flyer_kept` | `businessFlyers.keep` | `event_id`, `mode`, `post_kind`, `new_look`, `$groups` |
| `server_caption_written` | `businessFlyers.writeCaption`, `businessPosts.writeCaption` / `writeCaptions` | `event_id`, `language`, `scope` (event / post / plan), `count`, `failed`, `post_kind`, `$groups` |
| `server_post_proposed` | `businessPosts.propose` (content plan) | `event_id`, `added`, `total`, `is_festival`, `$groups` |
| `server_promo_kit_opened` | `referral.promoKit` | `event_id`, `profile_type`, `manager`, `has_link`, `has_flyer`, `painting`, `language`, `$groups` |
| `server_venue_ask_sent` / `server_venue_ask_booked` / `server_venue_ask_unbooked` | `venueAsks.ask` / `book` / `unbook` | `event_id`, `venue`, `updated`, `guests`, `needs_count`, `venue_managed`, `$groups` |
| `server_checked_in` | `attendance.checkIn` (door, organiser's id) | `event_id`, `is_festival`, `$groups` |
| `server_site_saved` | `businessSite.save` | `profile`, `profile_type`, `first_save`, `sections`, `locales`, `$groups` |
| `server_member_role_set` | `businessTeam.setRole` (role actually changed) | `profile`, `profile_type`, `from_role`, `role`, `self`, `$groups` |
| `server_account_deleted` | `auth.deleteAccount` — **anonymous**, no person profile | `days_since_signup` |
| `server_ticket_purchased` | Stripe webhook `checkout.session.completed` (festival checkout; not on redelivery) · TicketTailor webhook, first of `order.created`/`order.completed` per order | `festival`, `provider` (stripe / tickettailor), `product` (ticket / social_unlock), `tickets`, `amount` (cents), `currency`, `$revenue` (major units), `$currency`, `referral`, `referral_code` (promoter tracked-link code), `discount` (cents) |
| `server_ticket_checkout_expired` | Stripe webhook `checkout.session.expired` (festival checkout) | `festival`, `provider`, `product`, `tickets`, `referral`, `referral_code` |
| `server_subscription_activated` | Stripe webhook `checkout.session.completed` (`mode=subscription`, first delivery) | `plan`, `profile_id`, `provider`, `amount` (cents), `currency`, `interval`, `$revenue`, `$currency` |
| `server_subscription_cancelled` | Stripe webhook `customer.subscription.deleted` (or `updated` → canceled), once per subscription | `plan`, `profile_id`, `provider`, `amount`, `currency`, `interval`, `reason` (Stripe enum), `days_active` |

**Groups.** PostHog group type `profile` = a business profile's username. Client:
`useTrack().group('profile', username)` on Business mode pages (`/business/network/<username>/…`,
via the posthog plugin) and on `/@handle` for its managers. Server: `...profileGroup(username)` /
`...eventGroup(ev)` (organiser, else venue) add `$groups` to events where a business profile is in
scope (event created/published, claims, flyers, captions, inquiries, team, site, venue asks,
promo kit, gig applications as a page). Use group-based insights to count organisations, not people.

Webhook events (`channel: 'webhook'`) use the buyer's dancer id as `distinct_id` (Stripe metadata;
TicketTailor by buyer-email match, else anonymous). **Revenue = sum of `$revenue` on
`server_ticket_purchased` + `server_subscription_activated`** (first period only — renewals are not
yet tracked).

**Magic-link sign-up rule** (`server/utils/magicLinkSignup.ts`): a magic-link sign-in counts as a
sign-up only when the account was created by the magic-link flow — created < 24 h ago, no `source_ref`
(migrated v4 dancers never count), no password, never email-verified, and no earlier session.
Anything else is `login_completed`.

Adding an event: snake_case, one per user intent, non-PII props, and add a row above.
