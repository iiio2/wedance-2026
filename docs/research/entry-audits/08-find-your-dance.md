# `/find-your-dance` — signed-out entry audit

- **Example URL:** https://2026.wedance.vip/find-your-dance (checked 2026-10-25 ~13:40 CET); flow walked by tapping: video → Choose Salsa/Bachata/Kizomba → city → events; taster link → city → first taster class
- **Arrives from:** direct (10 entry sessions), header chip, landing "Find your dance" · **Persona:** complete beginner who has never danced, probably in Munich
- **CUJ:** C1 — Seeker — Find your dance · **JTBD:** J1 — Start dancing without feeling lost · **Related stories:** P1001 "Not sure where to start?" (built), P1002 dance-match quiz (**not-built**), P1003–P1005 quick picks Salsa/Bachata/Kizomba (done), P1006 free taster class (**partial**), P401 seeker journey (partial)
- **Code:** `app/pages/find-your-dance.vue`, `app/pages/cities/index.vue:28-33,96-103` (intent banner), `app/pages/cities/[city]/index.vue:237,365-400,632-680` (style filter + "Your first class"), `shared/utils/taster.ts`

## Scenarios

| # | As a signed-out beginner, I want to… | What happens today | Verdict |
|---|---|---|---|
| S1 | understand the choice in the first screen | Heading "Not sure where to start?" plus three cards (Salsa "Fast, social, everywhere", Bachata "Close, romantic, easy start", Kizomba "Slow, grounded, connected") ([08-page-mobile](screenshots/08-page-mobile.jpg)). Clear, but no guidance on *how* to pick (no "if you like X…", no quiz: P1002 not-built). Only 3 of the 12 styles Munich lists; Cuban salsa/timba (Munich's biggest scene, the montuno.club audience) and zouk/WCS are absent | ⚠️ |
| S2 | see what the dance feels like | Tap → YouTube-nocookie embed plays inline. The videos are **tutorials** ("How To Salsa", lesson-format overlay "Basic Step #1 Breakdown"; "Beginner Kizomba Guide"), not a social floor. Fine for "can I do this", weak for "do I want this" | ⚠️ |
| S3 | after "Choose Salsa", get a next step | → `/cities?style=Salsa`: a generic city directory with a one-line banner "Pick your city to find Salsa classes." ([08-choose-salsa-city-picker](screenshots/08-choose-salsa-city-picker.jpg)). An extra step: no geolocation, no remembered city, cities ranked by profile count (Trieste #2) | ⚠️ |
| S4 | after picking Munich, find a beginner Salsa class | `/cities/munich?style=Salsa` ([08-salsa-munich](screenshots/08-salsa-munich.jpg)): the Salsa chip is preselected, but the page opens on a hero and "Who's on the floor" venues. The week list starts with "Megano Salsa Cubana **Fortgeschritten**", "Salsa **Fortgeschrittene** 1/2 Workshop", "Lady Styling". The first beginner item ("Salsa Beginner 1 (Kurs)") is the 6th row. The "Your first class" section appears **only** with `?taster=1`, never after choosing a style | ❌ |
| S5 | take the "free taster class" route | `/cities?taster=1` → Munich → "Your first class. Pick any class below and just go once…" ([08-taster-munich](screenshots/08-taster-munich.jpg)). The list opens with **"Bachata Mittelstufe"** (intermediate), **"Bachata Fortgeschrittene"** (advanced), "Fortgeschrittene Choreographie", "Casino Partnerwork". Beginner Salsa only at #6/#7. No level filter: `isTasterCandidate` only checks the event type (`taster.ts`), and the page's "No partner, no experience" copy sits above advanced classes | ❌ |
| S6 | trust that it's free | Every row shows a **FREE** badge. They aren't free: `isFreePrice('')` returns `true` (`taster.ts`), and synced events have an empty `price` (e.g. `bachata-mittelstufe-salsamas-pasing-af2a0b4f` → `price: ""`). Free-sorted first (`[city]/index.vue:385`), so "free" also drives the ranking. On mobile the badge is clipped by truncation, so it's only half-visible | ❌ |
| S7 | open a taster class and know what to do | First row → event page "— Past" (12:30 today, opened 13:41; the list filters by date, not time). Page: time, venue, address; no price, no "beginners welcome", no level; "Going?" + a "Shall we dance?" dance card asking Lead/Follow + chili level. Source link to salsamas-pasing.de is the only real next step | ⚠️ |
| S8 | do the same outside Munich | `/cities/berlin?taster=1`: "No classes listed here yet — ask the locals where beginners start" plus a WhatsApp group. Honest fallback with a human route, but a dead end for "a class this week" | ⚠️ |
| S9 | do it without signing up | No gate anywhere in the flow; sign-up is only asked at "Going?" | ✅ |
| S10 | (business) measure it | `find_your_dance_started` / `_completed` fire on video/choice (`find-your-dance.vue:27-47`); the city page gets `city_viewed` with `style`. The funnel ends at "chose a style", not at "opened a class" | ⚠️ |

## Data we have but don't show
- Course titles carry the level ("Beginner 1", "From Zero", "Mittelstufe", "Fortgeschritten", "Anfänger"); a simple keyword rank would put "Salsa From Zero" (Montuno, really free) and "Salsa Beginner 1" first.
- Real prices exist for some events (`price` field); for the rest we know only "unknown", which should read "ask at the door", not "Free".
- The schools behind beginner courses (Salsamás, Salsa y Corazon, Montuno Club) could be shown as "Where Munich beginners start".
- Styles Munich actually has (12), not just the 3 quick picks.

## Desktop differences
- The three cards sit side by side; same flow and the same destinations. Nothing desktop-specific.

## Top fixes (impact × effort)
1. `isFreePrice('')` → `false`; show "Price: ask the school" for unknown, "Free" only for an explicit 0/free (S).
2. Rank taster/beginner classes by level keywords (Beginner/Anfänger/From Zero/Basic/Einsteiger first; drop Mittelstufe/Fortgeschritten/Advanced/Intermediate/Choreo/Styling) and hide sessions that have already started (S).
3. "Choose Salsa" should also open the "Your first class" section (`taster=1&style=Salsa`) and scroll there, instead of the full city page (S).
4. Skip the city picker when the city is known (montuno.club UTM, last city, geo); otherwise surface a search field at the top, not a ranking where Trieste is #2 (M).
5. Add Cuban salsa/Timba (and the city's top styles) as quick picks; swap tutorial clips for a 20-s social-floor clip (S).
6. Event page for a beginner class: show level + "beginners welcome" + price/"ask at door" in the hero (shared with 00-event fix #1) (S).

Screenshots: `screenshots/08-page-mobile.jpg`, `screenshots/08-choose-salsa-city-picker.jpg`, `screenshots/08-salsa-munich.jpg`, `screenshots/08-taster-munich.jpg`
