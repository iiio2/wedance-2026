# City page `/cities/[city]` — signed-out entry audit

- **Example URLs:** https://2026.wedance.vip/cities/munich (main, 758 upcoming events) · https://2026.wedance.vip/cities/berlin (4th-biggest community, 2 upcoming events) · https://2026.wedance.vip/cities/trieste (252 profiles, 0 events). Checked Sun 2026-10-25 ~13:40 CET.
- **Arrives from:** direct / search (14 of 15 city entries are `/cities/munich`) · **Personas:** newcomer/tourist who googled "salsa munich"; total beginner looking for a first class
- **CUJ:** C3 — Regular — Find your floor; C1 — Seeker — Find your dance · **JTBD:** J3 — Never dance alone; J1 — Start dancing without feeling lost
- **Related stories:** P601 journey "find your floor" (partial), P1006 free taster class (partial), P306 see who's going before you book (not-built), RAZ-168 this-week relevance filter (done), RAZ-169 SEO city directory pages (done), RAZ-230 "Going" without sign-in (gated now)
- **Code:** `app/pages/cities/[city]/index.vue`, `app/components/WeeklyCalendar.vue`, `server/api/cities/[slug].get.ts` (SSR directory), tRPC `events.byCity`, `booking.upcomingByCity`, `plan.countBatch`

## Scenarios

| # | As a signed-out newcomer / beginner from search, I want to… | What happens today | Verdict |
|---|---|---|---|
| S1 | see what's on tonight / this week right away | First screen (375 px) = city photo, "— 28 weekly events", style chips, then "Who's on the floor" avatars. The first event row starts at **y≈888 px**, below the fold on mobile and on desktop ([mobile](screenshots/06-munich-fold-mobile.jpg), [desktop](screenshots/06-munich-fold-desktop.jpg)). "This week" means the calendar week Mon–Sun (`index.vue:105-111`), so on a Sunday it shows **only Sunday**. "28 weekly events" is what's left of this calendar week, not a weekly rhythm. At 13:40 it still lists sessions that started at 12:00/12:30, and the day header says **"Tonight"** for the whole day (`WeeklyCalendar.vue:115,164-167`). Monday onwards drops into "Coming up" (y≈4783), which has a different row design and no Going? button | ⚠️ |
| S2 | filter to my style ("salsa") | The chips work signed-out: Salsa 28→19 rows, Bachata 8. "Coming up" filters too. The chip **doesn't update the URL** (stays `/cities/munich`), so a filtered view can't be shared or indexed. `?style=Salsa` works when typed in, so only the write-back is missing. Salsa, Casino, Timba, Rueda and Son Cubano are separate chips, so a "salsa" visitor misses the Casino-tagged "Rueda 8-Week Course" | ⚠️ |
| S3 | (beginner) find a beginner class | No level filter and no "beginner" chip. The "Your first class" section only appears with `?taster=1` (`index.vue:632`), which only `/find-your-dance` sets. A beginner has to scan 28 rows of titles like "Salsa Beginner 1 (Kurs)" mixed with "Fortgeschrittene 2 Workshop". Two near-duplicate rows: "Salsa From Zero" (with MontunoClub) and "Salsa from Zero" (without), both at 18:00 at Buena Vista Bar | ❌ |
| S4 | know if anyone is going / see faces (J3, J7) | **"N going" never renders on Munich.** The page asks `plan.countBatch` for every event id in one GET (`index.vue:94`). With 758 ids the URL is ~34 KB, the server answers **414**, and `plan.countBatch` also caps input at 100 ids (`server/trpc/routers/plan.ts:30`). The error is swallowed (`catch {}`), so every card shows 0. Small cities with under 100 events are unaffected. No faces anywhere (P306 not built) | ❌ |
| S5 | tap "Going?" to save an event | Opens a generic "Join WeDance": name, email, password ([modal](screenshots/06-going-signup-modal.jpg)). It doesn't name the event or say what you get (reminder, see who's going). The intent is not resumed after sign-up (`index.vue:37-46` just opens the modal) | ⚠️ |
| S6 | browse venues / organisers / artists | Tabs work signed-out. Default Venues tab: "9 with events this week". Avatars include address-named venues ("Am Schützeneck 3", "Outside Hofbräuhaus") and initials-only circles. Tapping an avatar **filters the calendar** instead of opening the profile; the profile is a second step. "All Munich venues →" leads to the SEO directory pages (see `13-directories.md`) | ⚠️ |
| S7 | join a local community group | `CommunityGroupsSection` renders **only when there are zero events this week** (`index.vue:684`). Munich never shows its groups. Berlin shows one WhatsApp group. Trieste shows an empty state | ⚠️ |
| S8 | ask locals / vote on videos | Ask locals is at the very bottom (y≈8890 of 10,144 px), with "Sign in to ask or recommend" and one unanswered question. Video vote: "Not enough videos to vote yet", while a leaderboard below lists one video with 0 votes. Three sections (≈1,800 px) of empty competition UI sit between the schedule and the festivals | ⚠️ |
| S9 | (small city) find anything to do | Berlin: "— 0 weekly events", "None with events this week", "No events listed here this week yet". The only content is 2 zouk-weekend rows in "Coming up", one at **"01:00"** at venue "Berlin" (a date-only event stored as 00:00 UTC). The title reads "Casino & Bachata in Berlin" (no salsa). Trieste: 252 profiles on `/cities`, but the page has no chips, no venues ("No venues listed here yet") and no events, only empty modules | ❌ |
| S10 | (search) land on a page Google understands | `<title>` is style-led and good ("Bachata, Salsa & Casino in Munich — Venues, Artists & Socials"), and there is one `<h1>Munich</h1>`. Missing: **no canonical, no og:title/og:image, no JSON-LD** (the `/cities/*/venues` sub-pages have all three). The whole schedule loads in `onMounted`, so **the SSR HTML contains zero event names**: Google sees people, not "salsa tonight". An unknown slug (`/cities/notacity-zz`) returns **200** with an indexable title "Social Dance in Notacity Zz…" (soft 404) | ❌ |

## Data we have but don't show
- **Going counts.** `plan_items` rows exist, but the 414 error / 100-id cap hides them in Munich.
- **Event price and "free".** `isFreePrice` is used only in taster mode, so a beginner can't spot free classes in the weekly list.
- **Level.** WeeklyCalendar has `levelChilis()` (`WeeklyCalendar.vue:73`), but synced events don't map a level and titles carry it ("Beginner 1", "Fortgeschrittene").
- **Community groups for Munich.** Gated behind "no events this week".
- **Festival count and next event** per city are not in the hero. "28 weekly events" is the only number shown.

## Desktop differences
Same order, wider. The hero photo fills about 450 px and the first screen still has no event, only avatars ([desktop](screenshots/06-munich-fold-desktop.jpg)). Avatars fit on one row, so the tab is easier to scan. The schedule and its issues are unchanged.

## Top fixes (impact × effort)
1. **Fix the going counts.** Chunk `countBatch` into groups of ≤100 ids, or switch it to POST / count only this-week events. Today every Munich card shows 0 (S).
2. **Put "Tonight / next 7 days" above the fold.** Use a rolling 7-day window instead of the Mon–Sun week, hide sessions that already started, and label the day "Today", with "Tonight" only after ~17:00. Move the people tabs below the schedule (M).
3. **SSR the schedule.** At least the next 7 days of event names and times, plus canonical, OG and `ItemList`/`Event` JSON-LD as the sub-directories already have. Return 404 for unknown city slugs (M).
4. **Beginner path without `?taster=1`.** Add a "Beginner-friendly" chip that reuses `isTasterCandidate`, plus a "Free" badge in the weekly list (S).
5. **Write the style chip to `?style=`**, and group Casino/Rueda/Timba under "Salsa (Cuban)" for "salsa" searchers (S).
6. **Always show community groups**, at least as a compact row. Collapse empty video-vote modules into one "Be the first" card. Small-city mode: lead with "Coming up" and groups when this week is empty (S).
7. **Contextual sign-up** for Going? ("Save Salsa From Zero and see who's going"), and resume the action after sign-up (S).

Screenshots: `screenshots/06-munich-fold-mobile.jpg`, `screenshots/06-going-signup-modal.jpg`, `screenshots/06-berlin-fold-mobile.jpg`, `screenshots/06-munich-fold-desktop.jpg`
