# C3 — Regular: find your floor · automated test catalogue

Last updated: 2026-10-26 20:30 CET · RAZ-682 (parent) · RAZ-683 … RAZ-716 (34 cases) · strategy: [qa-strategy.md](qa-strategy.md) (RAZ-268)

Every case in the RAZ-682 catalogue maps to an executable test below. Existing
tests were extended where they already covered part of a case; the rest are new.

## How to run

| Layer | Command | Needs |
|---|---|---|
| Unit (hermetic) | `bun run test` | nothing — DB suites skip without `DATABASE_URL` |
| Integration (DB) | `bun run test` with `DATABASE_URL`, `NEON_FETCH_ENDPOINT` set (CI `integration` job) | a **local** Postgres + `bun run dev:db-proxy` (see `.github/workflows/test.yml`) |
| E2E | `BASE_URL=http://localhost:<port> bun run test:e2e -- --grep @c3` | the app on localhost against that local Postgres |

**Isolation.** `server/test-setup.ts` drops any non-local `DATABASE_URL`, so DB suites
can't touch production or a Vercel preview (previews share the production DB). All
fixtures are synthetic and carry a per-run suffix; they are deleted in `afterAll` /
the `c3` E2E fixture. The v3-sync write tests (`server/utils/v3Sync.integration.test.ts`)
run inside one transaction each and **always `ROLLBACK`**: the sync's archive step and
the documented source rollback are never committed, not even on a local copy of
production. E2E write scenarios start with `the test environment is safe to write`
(localhost only).

**Clock.** Unit: `process.env.TZ` per case. Integration: "this week" is computed for a
pinned instant in `Europe/Berlin`. E2E: fixtures sit on a Wednesday 20:00 Munich time
≥ 2 days ahead; the browser clock is pinned to the day before (`page.clock`).

## Mapping (34 cases)

Status: ✅ passes · ⚠️ partial (scope noted) · ❌ expected failure on purpose (`it.fails` / `@fail`),
turns red when the product is fixed so the marker gets removed.

### Unit (9)

| Issue | Test | Reused / new | Status |
|---|---|---|---|
| RAZ-683 this-week in local time | `app/lib/cityWeek.test.ts:23`, `:49` — 9 zone/DST/week-edge cases + event-zone membership | new; extends `shared/utils/eventTime.zoned.test.ts`. Needed `app/lib/cityWeek.ts` (the city page's week logic, moved out unchanged so it can be tested) | ✅ |
| RAZ-684 dates, styles, types, cities | `server/utils/v3EventSync.test.ts:176` — 10 date shapes, style aliases, 7 event types, city aliases | extends the existing `toMs`/`mapStyles`/`mapV3Event` tests | ✅ · ❌ `:258` non-Latin alias → empty slug (**RAZ-719**) |
| RAZ-685 deterministic profile matching | `server/utils/v3ProfileSync.test.ts:115` — priority per role, same-city only, multiple candidates, repeat/shuffle | extends `planProfiles` tests | ✅ |
| RAZ-686 public safe fields only | `server/utils/v3ProfileSync.test.ts:193` — allowed keys only, no contact/login data, Members-only never copied or used to fill | extends the privacy test | ✅ · ❌ `:227` a Members-only profile's city reaches the public profile (**RAZ-726**) |
| RAZ-687 Going ≠ ticket navigation | `server/utils/v3EventSync.test.ts:267` (website stays `link`, no ticket URL) · `server/utils/v3Sync.integration.test.ts:89` · E2E `e2e/features/c3-going.feature:53` (website-only → no "Get tickets"; ticket link → "Get tickets" + independent Going; DB row `going/click`, never verified; no free-entry copy) | new | ✅ |
| RAZ-688 auth for Going + visibility | `server/trpc/routers/authGuard.test.ts:177` — 9 Going/sharing mutations protected + rejected before any DB access; 10 public reads stay public; own-state reads protected | extends the RAZ-281 matrix | ✅ |
| RAZ-689 optimistic Going + rollback | `app/composables/useWeekPlan.test.ts:38`, `:98` — add/remove rollback, per-item rollback, in-flight load keeps a tap (week + year plan) | new (no tests existed for these composables) | ✅ |
| RAZ-690 attendance privacy + projection | `server/trpc/routers/c3Going.integration.test.ts:98` — new attendance API; legacy festival rule stays in `plan-goingList.test.ts:218` | new + reuse | ✅ (DB-backed: runs in the CI integration job) |
| RAZ-691 clicks never grant/downgrade tickets | `server/trpc/routers/c3Going.integration.test.ts:144` — `attendance.set`, `plan.add/remove` dual-write | new | ✅ (DB-backed) |

### Integration (19)

| Issue | Test | Status |
|---|---|---|
| RAZ-692 real community counts | `c3CityDiscovery.integration.test.ts:147` — `/api/cities` handler, two synthetic cities (9 vs 1), zero-member city not listed | ✅ |
| RAZ-693 active profiles per role | `c3CityDiscovery.integration.test.ts:167` — real `booking.upcomingByCity` + `events.byCity` + directory handler through the page's `activeThisWeek`; cross-role venue/organiser | ✅ |
| RAZ-694 one feed, no duplicates | `c3CityDiscovery.integration.test.ts:198` — weekly series + synced + booked, this week vs "Coming up" | ✅ |
| RAZ-695 filters + paging | `c3CityDiscovery.integration.test.ts:231` — city isolation, 24/page + show more, style alias, profile filter | ✅ · documents the 90-day window (`days: 120` reaches beyond) |
| RAZ-696 recurring weekly options | `c3CityDiscovery.integration.test.ts:279` — `businessEvents.createSeries` rows (series_id) next to one-offs | ✅ · current source = materialised series rows; no recurrence engine |
| RAZ-697 repeat sync, no duplicates | `server/utils/v3Sync.integration.test.ts:64` | ✅ (rolled back) |
| RAZ-698 archive delisted, natives untouched | `v3Sync.integration.test.ts:98` — removed + Unlisted archived, edited row kept, native + other source identical | ✅ (rolled back) |
| RAZ-699 roll back only wedance-v3 | `v3Sync.integration.test.ts:128` — the CLAUDE.md rollback SQL (profiles, then events) | ✅ (rolled back) |
| RAZ-700 repeat profile sync | `v3Sync.integration.test.ts:153` — no duplicates, claimed untouched, others fill-empty-only, own rows follow v3 | ✅ (rolled back) |
| RAZ-701 event details + identity | `c3CityDiscovery.integration.test.ts:316` — id / slug / short URL → same event + details; one Going count; NOT_FOUND contract; archived flagged | ✅ |
| RAZ-702 schedules + real handles | `c3CityDiscovery.integration.test.ts:358` — `events.byProfile` per role (handle + name fallback), booking schedule → venue, no guessed slugs | ✅ |
| RAZ-703 directory SSR metadata | E2E `e2e/features/c3-find-your-floor.feature:56` — raw HTML (no JS) per role: people, title, canonical, BreadcrumbList + ItemList | ✅ |
| RAZ-704 persist + undo across sessions | `c3Going.integration.test.ts:180` | ✅ |
| RAZ-705 per-dancer isolation | `c3Going.integration.test.ts:206` | ✅ |
| RAZ-706 sharing opt-in / revoke | `c3Going.integration.test.ts:245` — anonymous and second-user responses; legacy festival rule asserted separately | ✅ |
| RAZ-707 counts vs faces | `c3Going.integration.test.ts:297` | ✅ · ❌ `:332` festival +N counts hidden holders (**RAZ-720**) |
| RAZ-708 discovery pool eligibility | `c3Going.integration.test.ts:348` — real Postgres; extends the FakeDb cases in `wave.test.ts:303` | ✅ |
| RAZ-709 loading / empty / failed | E2E `c3-going.feature:91` (loading → empty CTA), `:73` (broken photo dropped) | ✅ · ❌ `:104` failed request claims "No dancers" — **RAZ-297** (backlog), `@fail` |
| RAZ-710 dual-write reconciliation | `c3Going.integration.test.ts:377` — event + festival slug → event id, hidden default, failing secondary write leaves the plan correct | ✅ |

### E2E (6)

| Issue | Scenario | Status |
|---|---|---|
| RAZ-711 recurring local floor | `e2e/features/c3-find-your-floor.feature:16` — home stage → /cities/munich → this week + next dates → event in Munich time, browser in New York | ✅ |
| RAZ-712 community + role directories | `c3-find-your-floor.feature:32` (outline × venues / organisers / artists) | ✅ |
| RAZ-713 signed-out Going gate | `e2e/features/auth-going-gate.feature:8` (existing, now also checks the DB) + `:17` city-page entry (modal, no row) | ✅ (`@smoke`, runs in CI after merge) |
| RAZ-714 Going through navigation, reload, undo | `c3-going.feature:12` — no hydration warnings | ✅ |
| RAZ-715 share explicitly, hide again | `c3-going.feature:37` — private by default, "Show me" → visible to a second dancer, opt-out → gone | ⚠️ opt-out goes through the API: no UI control exists (**RAZ-721**) |
| RAZ-716 no paywall, no blank section | `c3-going.feature:73` (outline × with/without attendees × signed in/out) | ✅ |

## Public eligibility — kept apart on purpose

Three rules exist and are asserted separately; nothing here decides between them
(RAZ-313 / RAZ-314 are still open for ordinary events; RAZ-312 is in the expand phase):

| Surface | Rule today | Tests |
|---|---|---|
| Legacy festivals (`plan.goingList` festival, `/festivals` cards) | verified ticket holders, roster not hidden, public profile | `plan-goingList.test.ts:218`, `c3Going…:245` (festival case) |
| Ordinary events (`plan.goingList` event, discovery deck) | Going **and** opted in (`share_going`), public profile (+ photo for the deck) — unverified Going can be public after opt-in | `c3Going…:245`, `:348` |
| New attendance API (`attendance.publicList/counts`, not read by any page yet) | `going` or `ticket_holder`, visibility ≠ hidden, public profile; `verified` only for ticket holders | `c3Going…:98` |

If RAZ-314's "verified holders only" is applied to ordinary events, the second and
third rows change and those assertions must change with it. Going is never treated
as a ticket or free admission anywhere in these tests.

## Out of scope

RAZ-639 (Stripe after free join) and RAZ-315 (pending booking publication) are not
covered: booking fixtures use `accepted` requests so no assertion depends on RAZ-315.
Browser/mobile/a11y: scenarios run on the existing single Playwright project
(Desktop Chrome); the design a11y matrix (`playwright.design.config.ts`) is unchanged.
Only `@smoke` scenarios run in CI (after merge); the `@c3` scenarios run locally.

## Findings (follow-ups)

- **RAZ-719** v3 sync: non-Latin city names get an empty city slug.
- **RAZ-720** festival card +N badge counts hidden ticket holders.
- **RAZ-721** no UI to opt out of "who's going" after opting in.
- **RAZ-722** sharing Going doesn't reach `attendances.visibility` (dual-write gap).
- **RAZ-723** city page: booked events on the wrong weekday west of UTC.
- **RAZ-726** v3 sync copies a Members-only profile's city (found via CodeRabbit on the RAZ-686 test).
- RAZ-297 (existing): failed discovery request shows the empty state.
