# Directories — signed-out entry audit

- **Example URLs:** https://2026.wedance.vip/festivals · /artists · /venues · /cities · /cities/munich/{artists,venues,organisers} (checked Sun 2026-10-25 ~13:40 CET)
- **Arrives from:** search, Instagram (`/festivals`: 16 entry sessions, l.instagram.com), direct · **Persona:** search visitor looking for a festival, an artist or a place to dance
- **CUJ:** C4 — Traveler (festivals); C3 — Regular (cities, venues); C5 — Pro (artists) · **JTBD:** J4 plan dance travel; J3 never dance alone; J7 trust it's real
- **Related stories:** P214 search festivals by city/style/name (partial), P221 search artists (built), P222 filter artists by city (built), P209 pick your festival, RAZ-169 SEO city directory pages (done), RAZ-175 past festivals shown as upcoming (done)
- **Code:** `app/pages/festivals/index.vue` + `FestivalCard.vue` + `shared/utils/festivalDateFormatter.ts`; `app/pages/artists/index.vue`; `app/pages/venues.vue` + `BookableVenuesSection.vue`; `app/pages/cities/index.vue`; `app/components/CityDirectoryPage.vue`

## Scenarios

| # | As a signed-out search visitor, I want to… | What happens today | Verdict |
|---|---|---|---|
| F1 | `/festivals`: understand the page and see upcoming festivals | Clear hero ("Pick your next one"), search, style chips; SSR, so the list is crawlable. But the **first 11 cards say "Past"** while they are running right now (Festival de Cuba Stuttgart Oct 22–26, Kubáname Oct 22–25…). `daysUntil()` returns "Past" as soon as `startDate` has passed (`festivalDateFormatter.ts:28`, `FestivalCard.vue:101`), all under the heading "Upcoming festivals" ([mobile](screenshots/13-festivals-past-mobile.jpg)) | ❌ |
| F2 | `/festivals`: search "munich" | Works signed-out: 15 results. These include **local weekly classes** ("Salsa From Zero", "Rueda 8-Week Course", "Casino Partnerwork" labelled "Oct 25–25") because any event with a festival programme counts as a festival. Empty state is good ("Nothing matches 'zzzz'", Clear search). The query is not in the URL, so results can't be shared | ⚠️ |
| F3 | `/festivals`: judge a card | Letter avatar ("L", "F"), no logo, price or attendee faces. "Going?" opens the sign-up modal. The card links to `/events/<slug>`, which is fine. The `<title>` is "WeDance — Festivals" (brand-first, no "salsa festivals 2026/2027"), with no canonical, OG or JSON-LD | ⚠️ |
| A1 | `/artists`: find a teacher by city/style | Clear hero, search plus city and style dropdowns. Munich gives 109 artists, and name "salsa" gives 4, which works signed-out. Cards are large photo tiles linking to `/@handle` ([mobile](screenshots/13-artists-mobile.jpg)). The empty state names the filter ("No artists in Munich match…" + Clear filters) | ✅ |
| A2 | `/artists`: be found by Google ("bachata teacher munich") | The list loads in `onMounted` via tRPC (`artists/index.vue:35-37`): **the SSR HTML contains no artist**. Filters are not in the URL. The title is "WeDance — Artists". The crawlable version is `/cities/<city>/artists`, but `/artists` doesn't link to it | ❌ |
| V1 | `/venues`: understand the page | "Book a space" for organisers (C6), reached from `/for-events`. A dancer who expects "where to dance" lands on a booking pitch. Back link "← For your event" | ⚠️ |
| V2 | `/venues`: find a venue in my city | **2,641 venues in one unpaginated list, with no search and no city filter.** 2,561 (97%) have no photo and 362 have no city. The 4th card is **"Demo Open-Air Commons (test)"** ([mobile](screenshots/13-venues-test-entry-mobile.jpg)). Also "DT01", and "Pollheimerstraße 1" (a street address used as the name). It is `<ClientOnly>` (`venues.vue:35-39`), so nothing reaches SSR | ❌ |
| C1 | `/cities`: find my city | SSR, clear hero, typeahead search ("leip" → Leipzig, with a helpful no-match message). Shows "top 9 of 471". The other **462 city pages have no crawlable link** from the directory (search only) | ⚠️ |
| C2 | `/cities`: judge which city is worth opening | Cards show "N in the community · venues · artists · organizers", the **profile count, not events**. Trieste ranks #2 ("252 in the community", 251 organisers) but its city page has 0 events and an empty venue tab. Berlin (#4) has 0 events this week. Nothing on a card says "28 events this week" | ⚠️ |
| D1 | `/cities/munich/{venues,organisers,artists}`: browse the full local directory | Best SEO here: data-driven title, canonical, BreadcrumbList + ItemList JSON-LD, breadcrumb, H1 "Venues in Munich", count ("302 venues"), and cards link to `/@handle`. But the order is just database order (`CityDirectoryPage.vue:120`), with no sort by activity or search. Venues #2–3 are **"Demo Open-Air Commons (test)"** and "DT01" ([mobile](screenshots/13-munich-venues-mobile.jpg)). Organisers start with "Anonymous" and "Promoter". "DJ L3VELS" is listed as a venue. All 509 organisers render at once, with no hint of who has events | ⚠️ |

## Data we have but don't show
- **Festivals:** the festival end date, so "On now" could replace the wrong "Past"; going counts (rendered only for 2 local classes); logos/covers where v3 has them.
- **Cities:** this-week and upcoming event counts per city (`events.byCity`), which would rank cities by activity instead of profile count.
- **Directories:** whether a profile has upcoming events or is claimed. Both could drive sort order and a badge ("3 events this week", "Verified").
- **Venues:** the city facet (`city` / `city_slug`) exists for 86% of rows but there is no filter on it.

## Desktop differences
Same content in one centred column. `/festivals` stays a single-column card list with letter avatars and lots of white space. The "Past" labels sit top-right of the first two visible cards. `/venues` is the same endless list. `/artists` gets more tiles per row. No desktop-only issues.

## Top fixes (impact × effort)
1. **`/festivals`: show "On now" when `startDate` ≤ now ≤ `endDate`, and "Past" only after `endDate`.** Exclude single-session or local-class events from the festival directory (S).
2. **Hide test and placeholder profiles from every public directory.** "(test)" / demo names, "DT01", "Anonymous", "Promoter", venues with no city. Sort city directories by "has upcoming events", then claimed, then photo (S).
3. **`/venues`: add a city filter and search, and paginate or SSR.** Or retitle it as an organiser tool and send dancers to `/cities/<city>/venues` (M).
4. **SSR `/artists`** (or link each city filter to `/cities/<city>/artists`), and put filters in the URL across `/festivals`, `/artists`, `/cities` (M).
5. **`/cities`: rank and label by activity** ("28 events this week"), and add a crawlable A–Z or by-country list of all 471 cities (M).
6. **Brand-last, intent-first titles plus canonical and OG** on `/festivals`, `/artists`, `/venues`, `/cities`, as `CityDirectoryPage` already does (S).

Screenshots: `screenshots/13-festivals-past-mobile.jpg`, `screenshots/13-artists-mobile.jpg`, `screenshots/13-venues-test-entry-mobile.jpg`, `screenshots/13-munich-venues-mobile.jpg`
