---
id: REVIEW-2026-10
title: Current-state architecture review (October 2026)
status: proposed
date: 2026-10-12
summary: 36 ranked findings across security, data integrity, product blockers and hygiene — each with file:line evidence, affected stories and the ADR or migration step that fixes it.
---

**Scope.** `server/database/schema.ts` (38 tables), every tRPC router
(`server/trpc/routers/*`), every REST handler (`server/api/**`), the migrations
folder and journal, the migration and sync scripts, and the 180 stories in
`docs/architecture/stories.json` (127 built, 33 partial, 19 missing, 1 unknown).
Production was **not** queried; row counts come from
`docs/research/2026-10-12-city-canonicalisation.md` (read-only production survey,
2026-10-12) and the repo `CLAUDE.md`. Line numbers refer to this branch.

**The short version.** The product surface is broad and mostly real, and the code
is readable and tested (34 test files, 379 passing tests). The problems are below
the surface: the database enforces almost nothing, the schema has no reliable
change process, auth stores its secrets in plaintext and trusts unverified email
for paid tickets, and three core concepts — *an event*, *who is going*, *who owns
a profile* — are each modelled two or three times. The target design fixes these
with eleven decisions (ADR-001 to ADR-011) and a 28-step migration that ships the
security work first.

## What is already good

- **Prices are resolved server-side** — the client never sends an amount
  (`festivalSignup.ts:182-202`).
- **TicketTailor webhooks are HMAC-verified in constant time, fail closed**
  (`api/webhooks/tickettailor.post.ts:32-50`, `tickettailor.lib.ts:44-52`), and
  Stripe signatures are verified (`api/stripe/webhook.post.ts:22-28`).
- **The v3 sync is idempotent, dry-run by default and reversible by source**
  (repo `CLAUDE.md` "wedance.vip → 2026 event sync").
- **Privacy defaults lean conservative** where they were thought about:
  `share_going` defaults to false (`migrations/0020_opt_in_attendees.sql`), public
  profiles never return email (`profile.ts:8-17`), election voter identity is shown
  to signed-in members only (`election.ts:111-121`).
- **Password continuity with v4 works** (2,339 migrated hashes verify unchanged).
- **The generated /architecture docs** cannot drift from the code (ADR-000).

## Findings, ranked

Severity: **security** · **data integrity** · **product-blocking** · **hygiene**.
Rank orders by urgency × impact across severities.

| # | Severity | Finding | Evidence | Consequence | Stories | Fix |
|---|---|---|---|---|---|---|
| 1 | security | Paid tickets attach to whoever registers the buyer's email first: password sign-up never verifies the address, but the TicketTailor webhook and the claim flow treat email as proof of identity | `routers/auth.ts:248-325`; `api/webhooks/tickettailor.lib.ts:137-142`; `routers/claim.ts:46-57`; no `email_verified_at` in `schema.ts:4-44` | A stranger's account can show someone else's ticket and appear on the verified roster | RAZ-83, RAZ-110 | [ADR-003](/architecture/decisions/003-security-hygiene), step 3 |
| 2 | security | Bearer secrets stored in plaintext, and PR previews run against the production database | `schema.ts:41`, `49`; `trpc/context.ts:32-40`; repo `CLAUDE.md:131-134` | Any read access to the DB (backup, log, an unreviewed preview) yields live sessions and login links; previews can write production rows | map:meetup-2.1-sign-up, RAZ-155 | [ADR-001](/architecture/decisions/001-schema-change-discipline), [ADR-003](/architecture/decisions/003-security-hygiene), steps 1–2 |
| 3 | product-blocking | The daily wedance.vip sync has failed since 2026-10-10: it reads two migration files that PR #202 deleted | `scripts/sync-v3-events.ts:65`; commit `4728250`; `~/.config/wedance/v3-sync.log` (FAILED 10-10, 10-11, 10-12) | City feeds and event pages stop receiving new or changed v3 events; ~1,450 upcoming events go stale | RAZ-251, RAZ-253, RAZ-162, RAZ-28, RAZ-71 | [ADR-001](/architecture/decisions/001-schema-change-discipline), step 0 |
| 4 | data integrity | A ticket bought after taking a free spot is never recorded: the Stripe webhook treats the unique conflict as "already processed" | `api/stripe/webhook.post.ts:65-88`; `festivalSignup.ts:96-101`; unique at `schema.ts:96` | Payment taken, no verified ticket, no confirmation email | RAZ-110, RAZ-130, RAZ-247, RAZ-248 | [ADR-007](/architecture/decisions/007-festival-programme-and-ticketing), step 6 |
| 5 | data integrity | Account erasure fails for any dancer who followed an artist or waved: `deleteAccount` deletes by hand and misses the two newer tables; no FK has a delete rule | `routers/auth.ts:497-612` (no `artistFollows`/`festivalWaves`); `schema.ts:707`, `722-723`; all 51 FKs `no action` in `migrations/meta/0018_snapshot.json` | GDPR erasure requests return an error; the account stays | RAZ-155 | [ADR-002](/architecture/decisions/002-integrity-conventions), step 5 |
| 6 | security | Requesting a magic link for an existing email overwrites that account's name, city, role and styles before ownership is proven | `routers/auth.ts:73-96` | Unauthenticated profile tampering | RAZ-241, map:meetup-2.1-sign-up | [ADR-003](/architecture/decisions/003-security-hygiene), step 3 |
| 7 | data integrity | No trustworthy migration path: journal stops at 0017; 0018 unjournaled and not applicable to prod; two 0020s, no 0019; 0021–0024 hand-applied; DDL inside scripts; `db:push` would drop the prod-only `follows` table and `dancers.source_ref` | `migrations/meta/_journal.json`; `0018_catch_up_and_report_dedupe.sql:31`; `0023_profile_languages.sql:1-3`; `scripts/migrate/00-schema.mjs:5`, `32`; `package.json:20` | Every schema change is a manual production operation; a wrong command loses migrated data or the v4 rollback key | all | [ADR-001](/architecture/decisions/001-schema-change-discipline), step 0 |
| 8 | security | Unauthenticated image upload with no size or type check; no rate limit on any public write (login, magic links, problem reports with 6.5 MB screenshots, booking requests, submissions) | `api/media/image.post.ts:4-38` (RAZ-288); `feedback.ts:169`; `trpc/trpc.ts:1-21` (no limiter) | Storage and email abuse, credential stuffing, Linear spam | RAZ-275, RAZ-272, RAZ-241 | [ADR-003](/architecture/decisions/003-security-hygiene), step 4 |
| 9 | security | Private data in public responses: gig contact emails, booking requesters' names and messages, ride/roommate lists ignoring `profile_public`, discover deck revealing plans without opt-in, ticket lookup by email | `gigs.ts:20-57`; `booking.ts:72`, `130-131`; `rideShare.ts:18-42`; `roommate.ts:31-53`; `plan.ts:563-646` vs `177`; `claim.ts:103-140` | Scrapable PII; dancers listed against their privacy setting | RAZ-41, RAZ-116, RAZ-121, RAZ-127, RAZ-115, RAZ-83 | [ADR-003](/architecture/decisions/003-security-hygiene), step 4 |
| 10 | product-blocking | "Who is going" lives in two tables with opposite privacy defaults; public faces come from unverified clicks; listings and organiser insights count different people | `schema.ts:568-573` (`share_going` default false) vs `74-97` (`roster_visibility` default `public_minimal`); `api/festivals.get.ts:11`, `53-57`; `festivalInsights.ts:68-79` | "No fake friends" cannot be true; two attendee numbers per festival | RAZ-83, RAZ-62, RAZ-86, RAZ-115, RAZ-79, RAZ-150, RAZ-77 | [ADR-008](/architecture/decisions/008-attendance), step 24 |
| 11 | product-blocking | Profiles have no owner: venues cannot see or answer bookings, nobody is notified, organisers cannot manage listings; festival ownership is guessed from a submission slug | `schema.ts:304-340` (`claimed` only, `334`); `booking.ts:222-243`; `festivalInsights.ts:30-39`, `54-66` | The booking engine and organiser tools stop at "request saved" | RAZ-129, RAZ-135, RAZ-142, RAZ-158, RAZ-159, RAZ-79, RAZ-150 | [ADR-004](/architecture/decisions/004-identity-and-profile-ownership), steps 13, 16 |
| 12 | product-blocking | Pending, unapproved booking requests (a public, unauthenticated form) appear immediately as events on public feeds | `booking.ts:149` (public), `79`, `111` (only `declined` filtered) | Anyone can publish an event on a city page | RAZ-162, RAZ-158, RAZ-304 | [ADR-006](/architecture/decisions/006-one-event-model), step 20 |
| 13 | product-blocking | Festival programme, teachers and ticket prices exist only in code | `app/pages/festivals/[slug].vue:27-34`; `app/data/mock-*.ts`; `server/utils/ticket-prices.ts:25-60` | Database-only festivals have no schedule or tickets; organisers need a deploy to sell | RAZ-33, RAZ-36, RAZ-54, RAZ-69, RAZ-97, RAZ-149 | [ADR-007](/architecture/decisions/007-festival-programme-and-ticketing), step 21 |
| 14 | product-blocking | An event lives in three places (`events`, booking requests, `festivals`) plus an `is_festival` flag, merged at read time; `/events/<id>` guesses the table | `schema.ts:604-648`, `369-370`, `54-72`, `613`; `app/pages/events/[id].vue:41-45`; `app/pages/cities/[city]/index.vue:83` | Every feature that references "an event" must pick a table; no FK possible | RAZ-162, RAZ-304, RAZ-105, RAZ-126 | [ADR-006](/architecture/decisions/006-one-event-model), steps 17–20 |
| 15 | data integrity | No transactions are possible (neon-http driver); `booking.setAvailability` calls `transaction()` and can never succeed; capacity checks and ELO votes race | `utils/db.ts:2`; `booking.ts:292`; `node_modules/drizzle-orm/neon-http/session.js:151-152`; `festivalSignup.ts:84-101`; `dinner.ts:107-118`; `cityVideo.ts:262-281` | Venue availability cannot be saved; free spots and dinners can be oversold; lost votes | RAZ-158, map:meetup-2.2-free-spot-counter, map:meetup-5.1-dinner-sign-up | [ADR-002](/architecture/decisions/002-integrity-conventions), step 7 |
| 16 | data integrity | TicketTailor buyers never see their ticket in My Plan: rows are written with `paid_amount = 0`, `myTickets` requires `> 0` | `tickettailor.lib.ts:150`; `festivalSignup.ts:553-565` | "Ticket bought" stays off for verified buyers | RAZ-99 | [ADR-007](/architecture/decisions/007-festival-programme-and-ticketing), step 6 |
| 17 | data integrity | Referral credits are spent when a checkout *starts*; an expired checkout never gives them back | `festivalSignup.ts:384-397`; `api/stripe/webhook.lib.ts:39-47` | Referrers silently lose earned credit | RAZ-23 | [ADR-007](/architecture/decisions/007-festival-programme-and-ticketing), step 6 |
| 18 | data integrity | Links by text instead of foreign keys: festival slug on waves, review targets, event venue/organiser usernames, artist handle lists, plan item ids, election candidate ids, every `city_slug` | `schema.ts:721`, `241-242`, `617-618`, `638`, `376`, `569`, `449`, `489-490`, `636` | Renames break links; deletes leave orphans; no join is guaranteed | RAZ-65, RAZ-89, RAZ-253, RAZ-161, RAZ-55 | [ADR-002](/architecture/decisions/002-integrity-conventions), steps 9, 17–19, 24 |
| 19 | product-blocking | City is free text in six columns and an unreferenced slug in ten; the `cities` table is referenced by nothing and absent from production | `schema.ts:739-759`; `city-canonicalisation.md:18-45`; `plan.ts:483-484`, `533` | 585 spellings; audience geography impossible; per-city counts wrong | RAZ-85, RAZ-64, RAZ-47, RAZ-127 | [ADR-005](/architecture/decisions/005-places-cities-and-venues), step 11 |
| 20 | product-blocking | `plan_items` is polymorphic text: festival slugs, event or booking ids, mock workshop ids, goals; courses copied into JSON; workshop picks in DB *and* localStorage | `schema.ts:568-569`; `plan.ts:76-97`, `232-250`; `app/pages/my-plan.vue:466`, `1047-1048` | Dangling plan rows, frozen courses, two workshop stores | RAZ-97, RAZ-108, RAZ-91, RAZ-287, RAZ-36 | [ADR-009](/architecture/decisions/009-plans-typed-references), step 25 |
| 21 | product-blocking | Enquiries, problem reports and gig applications are never stored: Linear issues or `mailto:` only | `feedback.ts:119-160`, `162-248`; RAZ-41 notes | Lost requests when Linear is down; customer PII only in a dev tool; posters never get applications | RAZ-57, RAZ-107, RAZ-114, RAZ-41, RAZ-272 | [ADR-010](/architecture/decisions/010-inbound-requests), step 16 |
| 22 | data integrity | `/@handle` is shared by dancers and profiles with no cross-table uniqueness; dancer handles nullable until onboarding | `schema.ts:21`, `306`; `entity.ts:6-11`; `auth.ts:377-386` | A dancer can shadow a venue's URL or the reverse | RAZ-154, RAZ-253 | [ADR-004](/architecture/decisions/004-identity-and-profile-ownership), step 12 |
| 23 | security | Session cookie is written by client JavaScript (no `HttpOnly`); sign-out only clears the browser; password reset or change does not revoke sessions | `app/plugins/01.trpc.ts:22-26`; `app/composables/useAuth.ts:349-350`; `auth.ts:194-199`, `352` | XSS can lift sessions; a stolen session survives a password change | map:meetup-2.1-sign-up, RAZ-241 | [ADR-003](/architecture/decisions/003-security-hygiene), step 2 |
| 24 | data integrity | Space stewardship is authorised by comparing a free-text `moderator_handle` with the caller's username; the same fact is stored flat and in the election tables | `election.ts:46-60`; `booking.ts:16-35`; `schema.ts:330-332`; `election.ts:346-354` | Authorisation tied to a mutable string | RAZ-152, RAZ-166 | [ADR-004](/architecture/decisions/004-identity-and-profile-ownership), step 13 |
| 25 | product-blocking | Two artist models: static `app/data/artists.ts` for `/artists/[id]` and lineups, `profiles` for `/@handle` and follows; no artist role, no school | `app/pages/artists/[id].vue:8`; `app/pages/festivals/[slug].vue:5`; `schema.ts:307` | Following an artist does not show their festivals; teacher/school search has no data | RAZ-55, RAZ-66, RAZ-303 | [ADR-004](/architecture/decisions/004-identity-and-profile-ownership), step 14 |
| 26 | security | Password salts come from `Math.random()` | `auth.ts:189`, `274`, `350` | Low-entropy salts | map:meetup-2.1-sign-up | [ADR-003](/architecture/decisions/003-security-hygiene), step 3 |
| 27 | data integrity | Times stored three ways (`timestamp` holding UTC, `'HH:MM'` text, free text); server formats event times in its own zone | `schema.ts:599-601`, `378-379`, `403-404`, `550`, `527`; `plan.ts:713-714` | Wrong times in the discover deck; no time arithmetic on slots | RAZ-127, RAZ-118, RAZ-158 | [ADR-002](/architecture/decisions/002-integrity-conventions), steps 8, 17 |
| 28 | data integrity | Counters stored next to their facts drift: `people_count` never updated; `vote_count`/`elo_score` read-modify-write; `report_count` duplicates reports | `hangouts.ts:97`, `132-178`; `cityVideo.ts:262-281`; `schema.ts:273` | Wrong "N in" and leaderboards | RAZ-118, RAZ-156 | [ADR-002](/architecture/decisions/002-integrity-conventions), step 7 |
| 29 | data integrity | `festival_signups` is unique on `(festival_id, dancer_id)` with a nullable `dancer_id`, so unclaimed stubs are never deduplicated | `schema.ts:79`, `96` | Duplicate stub rows per buyer | RAZ-83 | [ADR-008](/architecture/decisions/008-attendance), step 24 |
| 30 | hygiene | Enum-like columns are TypeScript-only and already disagree (`review.ts` accepts `event`, the schema does not) | `schema.ts:93`, `159`, `241`, `385`, `568`; `review.ts:6` | The database accepts any string | map:meetup-8.1-rate-festival | [ADR-002](/architecture/decisions/002-integrity-conventions), step 8 |
| 31 | hygiene | `json` and `jsonb` mixed; `created_at` nullable on 34 tables and missing on 3; `is_admin`, `events.slug`/`name` nullable; `events.archived` defaults to true | `schema.ts:9`, `12`, `16`, `606-607`, `620` | No indexing on `json`; `?? false` scattered through code; a native event inserted without `archived` is hidden | — | [ADR-002](/architecture/decisions/002-integrity-conventions), steps 8, 17 |
| 32 | hygiene | FK columns without indexes | `sessions.dancer_id` (`schema.ts:48`), `booking_requests.space_id`/`profile_id`/`organizer_id`/`requester_id` (`360-366`), `dinner_signups.dancer_id`, `giveaway_entries.dancer_id`, `festival_signups.dancer_id` | Sequential scans on deletes and owner lookups | RAZ-155 | [ADR-002](/architecture/decisions/002-integrity-conventions), step 8 |
| 33 | hygiene | API conventions missing: bare `Error` → 500, unique violations found by message text, no pagination, N+1 lists, whole-row outputs, unbounded inputs, toggles | `festivalSignup.ts:82`, `93`; `dinner.ts:121-126`; `entity.ts:14-68`; `dinner.ts:34-90`; `hangouts.ts:41-60`; `gigs.ts:20-41`; `plan.ts:80` | Confusing errors, slow pages as data grows, retries that undo themselves | RAZ-58, RAZ-64, RAZ-118 | [ADR-011](/architecture/decisions/011-api-conventions), steps 10, 26 |
| 34 | hygiene | Code guesses the schema at runtime (catches "column does not exist") | `events.ts:36-54`; `plan.ts:51-52` | Masks missing migrations | RAZ-251 | [ADR-001](/architecture/decisions/001-schema-change-discipline), step 0 |
| 35 | product-blocking | Tracker drift: Pro and Network plans are Done/In Review with no billing in the model; several fully built features sit in Backlog | RAZ-100, RAZ-106 notes; RAZ-152, RAZ-163–166, RAZ-157, RAZ-170 notes | The board misstates what exists | RAZ-100, RAZ-106, RAZ-39 | open question (pricing) |
| 36 | hygiene | Leftovers: flat moderator fields next to elections; `hangouts.people_count`; a roommate request is only (festival, dancer); repo `CLAUDE.md` documents a `0021_events_v3_sync.sql` and a `follows` table that `schema.ts` does not have | `schema.ts:330-332`, `554`, `663-670`; repo `CLAUDE.md:63`, `95` | Misleading docs and dead columns | RAZ-121, RAZ-118 | steps 13, 7, 24, 0 |

## Decisions only the Commander can make

These block or shape steps of the migration plan; none of them is technical.

1. **Default visibility of a new "Going"**: hidden until the dancer opts in
   (today's `share_going`, recommended) or listed by name and city (today's ticket
   roster)? Step 24.
2. **"No fake friends"**: may unverified "Going" faces be shown at all, if they are
   labelled, or only verified ticket holders? Step 24.
3. **Pending booking requests**: private until a venue or moderator accepts them
   (recommended), or shown as "requested" on the community calendar? Step 20.
4. **Which hardcoded festivals are real and current**, and who confirms their
   programme and prices before they are seeded into the database? Step 21.
5. **City battles (3 votes ever) and giveaways (0 ever)**: remove, or keep and
   write the stories? Step 26.
6. **Is a school an organiser profile with the role `school`** (recommended), or a
   profile type of its own? Step 14.
7. **Dancer-to-dancer follows / friends / crews**: build them (the "add as friend"
   flow and map:meetup-8.4) or leave the legacy dancer edges parked? Step 15.
8. **Organiser plans and billing** (Pro, Network): what is sold and at what price,
   before any subscription model is designed? RAZ-100, RAZ-106.
9. **Profile claims**: what evidence is enough to hand someone a venue or artist
   profile, and who reviews it? Step 13.
10. **Handle collisions**: profile handles keep their URL and colliding dancers get
    a new one (recommended)? Step 12.
11. **Verified email before a ticket attaches** to an account: accept the extra
    step for some buyers? Step 3.
12. **Publication timing**: `/architecture` is public. Publish this review on the
    live site only after Phase 0 ships?
