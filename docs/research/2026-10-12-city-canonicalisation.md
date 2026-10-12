---
title: City canonicalisation — moving free-text city columns to cities.id
date: 2026-10-12
updated: 2026-10-12 11:00
feeds: server/database/migrations/0024_cities.sql, scripts/cities/backfill.ts
source: read-only SELECTs against production (Neon), 2026-10-12
---

# City canonicalisation — migration plan

The `cities` table (migration `0024_cities.sql`) and the Places-backed
`<CityCombobox>` make every **new** city value canonical. This note plans the
rest: getting the **existing** free-text columns onto a `city_id` foreign key.
Why Places: [2026-10-12-city-selector.md → Why Places, not free text](./2026-10-12-city-selector.md#why-places-not-free-text).

## What exists today (production, read-only, 2026-10-12)

`cities` table: **does not exist yet** (`to_regclass('public.cities')` → null).

### Free-text name columns

| Column | Rows | Non-null | Distinct values |
|---|---:|---:|---:|
| `dancers.city` | 3,932 | 3,324 | 324 |
| `profiles.city` | 6,589 | 4,674 | 471 |
| `events.city` | 11,192 | 10,748 | 422 |
| `festivals.city` | 6 | 6 | 3 |
| `gigs.location` | 7 | 7 | 5 |
| `festival_ride_shares.origin_city` | 3 | 3 | 1 |
| **all columns, distinct** | | | **585** (582 after case/accent folding) |

### Slug columns (point at a city, no name)

| Column | Rows | Non-null | Distinct |
|---|---:|---:|---:|
| `profiles.city_slug` | 6,589 | 4,674 | 471 |
| `events.city_slug` | 11,192 | 1,612 | 153 |
| `city_videos.city_slug` | 23 | 23 | 10 |
| `video_votes.city_slug` | 5 | 5 | 2 |
| `giveaways.city_slug` | 0 | 0 | 0 |
| `reviews.city_slug` | 3 | 1 | 1 |
| `community_groups.city_slug` | 2 | 2 | 2 |
| `recommendation_requests.city_slug` | 1 | 1 | 1 |
| `hangouts.city_slug` | 3 | 3 | 1 |
| `city_battle_votes.winner_city_slug` / `loser_city_slug` | 3 | 3 | 3 |

`server/data/city-images.json` adds 389 illustrated cities keyed by slug, with Wikipedia alt spellings.

### The values

Full list with per-column counts: [`2026-10-12-city-values.tsv`](./2026-10-12-city-values.tsv)
(585 rows). What it shows:

- Mostly clean English Google names (v3/v4 already used Places) — the long tail
  is 107 values used exactly once.
- The free-text damage is already visible where 2026 let people type:
  `gigs.location` holds **"Munich"**, **"Munich "**, **"munich"** and
  **"Munich, Germany"** — four spellings of one city in 7 rows.
- Variants: `Montreal` / `Montréal`, `München-Flughafen` (10 dancers — an
  airport locality, Places finds no *city* for it → manual map to Munich),
  `Sesto San Giovanni (Milan)`, `Cervia (Ravenna)`, `Calenzano (Florence)`,
  `Nové Město na Moravě, Czechia`, `les Palmes`.

Top 60 by usage:

| Value | Total rows | Where |
|---|---:|---|
| Munich | 8005 | dancers:1883 profiles:975 events:5138 festivals:4 gigs:2 ride_shares:3 |
| Budapest | 1116 | dancers:3 profiles:224 events:889 |
| Berlin | 812 | dancers:184 profiles:200 events:427 festivals:1 |
| Prague | 569 | dancers:4 profiles:145 events:420 |
| Karlsruhe | 513 | dancers:320 profiles:58 events:135 |
| Vienna | 429 | dancers:15 profiles:108 events:305 festivals:1 |
| Paris | 333 | dancers:7 profiles:75 events:251 |
| Lagos | 277 | dancers:13 profiles:59 events:205 |
| Trieste | 254 | dancers:1 profiles:253 |
| Hamburg | 203 | dancers:9 profiles:91 events:103 |
| Helsinki | 193 | dancers:6 profiles:35 events:152 |
| Lyon | 167 | dancers:1 profiles:34 events:132 |
| London | 149 | dancers:24 profiles:50 events:75 |
| Stuttgart | 144 | dancers:57 profiles:55 events:32 |
| Frankfurt | 143 | dancers:27 profiles:41 events:75 |
| Strasbourg | 130 | dancers:2 profiles:20 events:108 |
| Augsburg | 120 | dancers:13 profiles:44 events:63 |
| Manchester | 107 | dancers:4 profiles:51 events:52 |
| Cologne | 93 | dancers:21 profiles:36 events:36 |
| Amsterdam | 92 | dancers:10 profiles:41 events:41 |
| Bremen | 87 | dancers:2 profiles:28 events:57 |
| Ankara | 80 | dancers:10 profiles:58 events:12 |
| İstanbul | 79 | dancers:25 profiles:39 events:15 |
| Louisville | 65 | dancers:1 profiles:24 events:40 |
| Nuremberg | 60 | dancers:19 profiles:19 events:22 |
| Lisbon | 59 | dancers:8 profiles:32 events:19 |
| Odesa | 57 | dancers:19 profiles:23 events:15 |
| Madrid | 56 | dancers:5 profiles:23 events:28 |
| Warsaw | 51 | dancers:3 profiles:23 events:25 |
| Ville-d'Avray | 49 | profiles:8 events:41 |
| Hanover | 48 | dancers:1 profiles:29 events:18 |
| Lloret de Mar | 46 | dancers:1 profiles:17 events:28 |
| Geneva | 46 | profiles:13 events:33 |
| Kiel | 45 | dancers:3 profiles:23 events:19 |
| Havana | 44 | dancers:4 profiles:26 events:14 |
| Rovinj | 42 | dancers:3 profiles:14 events:25 |
| Barcelona | 42 | dancers:5 profiles:21 events:16 |
| Regensburg | 41 | dancers:7 profiles:17 events:17 |
| Salzburg | 41 | dancers:3 profiles:20 events:18 |
| Minsk | 40 | dancers:1 profiles:2 events:37 |
| Balatonfüred | 40 | dancers:1 profiles:14 events:25 |
| Dortmund | 39 | dancers:4 profiles:12 events:23 |
| Bucharest | 39 | dancers:3 profiles:26 events:10 |
| Würzburg | 38 | dancers:1 profiles:15 events:22 |
| Montreal | 38 | dancers:2 profiles:14 events:22 |
| Heidelberg | 37 | dancers:12 profiles:15 events:10 |
| New York | 35 | dancers:4 profiles:22 events:9 |
| Düsseldorf | 35 | dancers:6 profiles:14 events:15 |
| Kyiv | 34 | dancers:18 profiles:10 events:6 |
| Stockholm | 34 | profiles:19 events:15 |
| Ingolstadt | 34 | dancers:3 profiles:6 events:25 |
| Los Angeles | 34 | dancers:3 profiles:8 events:23 |
| Tallinn | 33 | dancers:2 profiles:9 events:22 |
| Freiburg im Breisgau | 32 | dancers:3 profiles:13 events:16 |
| Santa Susanna | 31 | profiles:11 events:20 |
| Nice | 31 | dancers:3 profiles:8 events:20 |
| Zürich | 31 | dancers:9 profiles:14 events:8 |
| Ljubljana | 30 | dancers:3 profiles:13 events:14 |
| Antibes | 30 | dancers:1 profiles:8 events:21 |
| Kassel | 30 | dancers:2 profiles:7 events:21 |
| Chiemsee | 28 | dancers:1 profiles:10 events:17 |

## Plan

Each step is additive and reversible until the last one; nothing drops a
free-text column until every reader uses `city_id`.

1. **Apply `0024_cities.sql` to production** (Commander approval). Creates the
   empty table + indexes; touches nothing else. The app already handles both
   states: before it, `/api/city-options` serves today's catalogue and
   `/api/city-resolve` returns cities with `persisted: false`.
2. **Backfill `cities`**: `bun scripts/cities/backfill.ts --apply --db=<prod url>`.
   Resolves the 585 values (+ city-images.json alt spellings) through Places —
   at most ~1,740 calls, fewer in practice (no local-name call for English-
   speaking / multi-language countries; cached across runs). Review
   `scripts/cities/.cache/report.json`: `review` (canonical name differs from the
   value) and `no-match` rows (e.g. München-Flughafen) get a manual mapping
   before step 4. Dry run output 2026-10-12 (5 sampled values, 13 calls):
   Munich→Munich (local München; alt names Мюнхен, Munique, Mníchov…),
   Prague→Prague (Praha), İstanbul→Istanbul (İstanbul), Ville-d'Avray→Ville-d'Avray,
   München-Flughafen→no match.
3. **Add nullable `city_id uuid REFERENCES cities(id)`** (+ index) to:
   `dancers`, `profiles`, `events`, `festivals`, `gigs`, `festival_ride_shares`
   (`origin_city_id`), and to the slug-keyed tables `city_videos`, `video_votes`,
   `giveaways`, `reviews`, `community_groups`, `recommendation_requests`,
   `hangouts`, `city_battle_votes` (`winner_city_id`, `loser_city_id`). One
   idempotent migration, `ADD COLUMN IF NOT EXISTS`.
4. **Fill `city_id`** from the backfill mapping: name columns via the report
   (value → place id → `cities.id`); slug columns via `cities.slug` (the
   canonical slug is `citySlug(English name)`, the same rule `profiles.city_slug`
   uses, so most match directly; mismatches listed by the script). Batched
   UPDATEs, `WHERE city_id IS NULL`, re-runnable. Rollback: set `city_id = NULL`.
5. **Write `city_id` everywhere a city is saved.** `<CityCombobox @select>`
   already hands over `{ id, slug, name }`; forms send `cityId` next to `city`
   (onboarding, settings, for-events, gigs, ride shares, Discover). tRPC inputs
   accept `cityId`; server derives `city`/`city_slug` from the row so the three
   can't drift. Also `scripts/sync-v3-events.ts` / `v3ProfileSync.ts`: resolve
   the v3 venue locality through the city service instead of string mapping.
6. **Read by `city_id`**: `/cities/[city]`, `/api/cities`, city feeds, counts.
   `city_slug` stays as the URL key (joined from `cities.slug`).
7. **Drop the free-text columns** (`city`, `city_slug`, `location`,
   `origin_city`) only after 5–6 have run in production for a while and a check
   shows no row with text but no `city_id`. This is the only irreversible step —
   separate approval.

## Open questions

- `gigs.location` is labelled "Location or base" — a gig may be remote or
  multi-city. With the combobox it can only be a city now; if "Remote" is
  needed, add an explicit toggle rather than free text.
- City pages for cities that only exist via Google picks (no profiles yet):
  show them or keep `/cities` to cities with community? Today `/api/cities`
  lists cities with visible profiles only, which is still the right default.
