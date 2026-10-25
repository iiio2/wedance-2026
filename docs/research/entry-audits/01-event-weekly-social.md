# Weekly social / party event — signed-out entry audit

- **Example URLs** (checked 2026-10-25, a Sunday, ~13:40 CET):
  - https://2026.wedance.vip/events/la-clave-thursday-3b13e0b3?utm_source=montuno.club: the top real entry (24 sessions, montuno.club + facebook). It is the **Thu 22 Oct** occurrence, so it was **3 days in the past** when checked.
  - https://2026.wedance.vip/events/la-clave-halloween-756353f7: the next La Clave night (Thu 29 Oct). It has a different name and a different page, and nothing links the two.
  - https://2026.wedance.vip/events/dienstags-salsa-party-im-megano-a7c6f0ce: a v3-synced weekly social (Tue 27 Oct) that renders the **plain** (non-festival) layout.
- **Arrives from:** montuno.club schedule, Facebook / Instagram posts, a flyer · **Persona:** a regular salsa/bachata dancer looking for tonight's party; sometimes a newcomer brought by a friend
- **CUJ:** C3 (Regular): find your floor · **JTBD:** J3 (never dance alone), also J7 (trust it's real) and J1 (newcomer)
- **Related stories:** P601 Regular journey (partial), P207 who's coming per event (not-built), P205 see who else is going (not-built), WED-162 one events feed (partial), P310 add to calendar (partial; festivals only)
- **Code:** `app/pages/events/[id].vue`. An event with a `festival` programme (La Clave has one, with workshops + party sessions) renders `app/components/festival/FestivalView.vue` (`[id].vue:97`, `:238`). A synced v3 event renders the plain template in `[id].vue:239-377`. Both use `app/components/FestivalHero.vue`.

## Scenarios

| # | As a signed-out dancer from montuno.club / Instagram, I want to… | What happens today | Verdict |
|---|---|---|---|
| S1 | **land on the link I was given and get tonight's party** | The montuno.club / Facebook link points at one dated occurrence. On 25 Oct the hero says "— Past · Thu, Oct 22" ([01-past-hero-mobile](screenshots/01-past-hero-mobile.jpg)) and still offers **GOING?** on a night that is over. Nothing says "Next: Thu 29 Oct", and there is no link to the next night. The next one is a separate event called "La Clave Halloween" (`756353f7`). `events.byCity` (60 days) shows **no La Clave Thursday after 29 Oct at all**, so a partner link to "La Clave" will land on a past or missing page from 30 Oct onwards | ❌ |
| S2 | know **what time** it starts and ends | Festival view (La Clave): the hero shows only the date, with no time. The times only appear in the Schedule section, 6 screens down (19:00 / 20:00 / 21:00 / 22:00), or on the flyer image ("19:00 – 23:00"). The flyer contradicts the data: the 21:00 party session has `duration: 240` (until 01:00) while `endDate` = 23:00. Halloween hero: "**Oct 29 – Oct 30**" (the end of 00:00 local reads as a two-day event), with no time. Plain view (Megano): "Tue, Oct 27 · 21:00–01:00" right in the hero ([01-v3-social-plain-mobile](screenshots/01-v3-social-plain-mobile.jpg)) | ❌ festival view · ✅ plain |
| S3 | know **the price / door** ("is it free, cash only?") | La Clave `price: "€10 after 21:00\nWorkshops for free"` and Halloween `price: "Free"` are in `events.get` but are **never rendered as text** in the festival view (no "€" or "free" in the page text, except the description). The price is visible only on the flyer image (desktop, [01-past-flyer-desktop](screenshots/01-past-flyer-desktop.jpg)). Plain view shows "€5 (€2 Studenten & Familia-Mitglieder)" with a € icon (`[id].vue:302`) | ❌ festival · ✅ plain |
| S4 | know **level and style**: is it for me, are there classes first? | La Clave 22 Oct: the Schedule tags Reparto / Bachata workshops "Beginner", and the party is also tagged "Beginner". Halloween says "Every Thursday: free workshops, then Cuban music…" (a copied description), but its programme is one session titled "Party" tagged **SALSA** while the event styles are Timba + Bachata. The two free workshops that night exist as **separate, unlinked events** ("Reparto From Zero" `9a3d2ba0`, "Bachata From Zero" `193ee831`). The dance card offers "Salsa" only. Plain view: style chips are clear | ⚠️ |
| S5 | see **who's going**, and whether my friends are | "2 planning" (22 Oct) and "0 planning" (Halloween, Megano) as a count only, with no faces (P207 not-built). The word changes between views: hero "planning", sessions "Going?". The only social block is "Shall we dance?", a Lead/Follow + 🌶️ level form, then sign-up. For a 0-count weekly party, "0 planning" is negative social proof in the first screen | ❌ |
| S6 | **say I'm going / save it** | GOING? opens a bare "Join WeDance: create your account with email and password" with no reason given (no reminder, no "see who's going"). After registering, the modal just closes (`SignUpModal.vue:157`); `onPick` (`[id].vue:36-44`) is not replayed, so the user has to find GOING? again. Rides / rooms / dinners ("Activities") on a 4-hour Thursday party add noise | ⚠️ |
| S7 | treat it as **recurring**: next dates, follow the series, add to calendar | No "every Thursday" structure. `events.series_id` exists (`schema.ts:882`, set by `businessEvents.createSeries`) but `events.get` / the card columns don't return it, so the page can't list next dates. **No add-to-calendar** on any event page: Google Calendar links exist only in `/my-plan` vacation blocks (`my-plan.vue:503-513`). The Megano next Tuesday (`f9c6778e`, 3 Nov) is not linked from the 27 Oct page | ❌ |
| S8 | **find the venue** | Festival view: hero address links to Google Maps (query without the venue name), and the Venue section shows "LUMA" plus a Maps link. `venueUsername: evergreen-goes-luma` and `organizerUsername: montunoclub` are **not linked**; Montuno Club is never named on the page. Plain view: organiser links to `/@megano_dance`, but the Venue block is plain text because `fromSyncedEvent` never sets `venueHandle` (`[id].vue:142-177` vs `:353`), even though `venueUsername` is in the data. "More dancing in Munich →" exists only in the plain view | ⚠️ |
| S9 | trust it's real and current (J7) | La Clave: "Checked by MontunoClub" (`editedAt` 19 Oct) is in the data, but the festival view doesn't render the badge; only the plain view does (`[id].vue:272`). Megano: the description says "Imported by WeDance from public sources" plus an "Event website" link, which is honest. Lineup: "Hamza" (handle `jesus`) is marked TO BE CONFIRMED on a past night | ⚠️ |
| S10 | (newcomer) "I've never been: what do I do at the door?" | No "just show up / pay at the door / beginners welcome" line. The beginner workshops before the party are the best hook for a newcomer, but for Halloween they are hidden as separate events | ⚠️ |

## Data we have but don't show
- `price` (both La Clave rows) in the festival view; `startDate` time in the festival hero.
- `organizerUsername: montunoclub`, `venueUsername: evergreen-goes-luma` (festival view) and `venueUsername: megano_dance` (plain view venue block).
- `editedAt` / `checkedBy` ("Checked by MontunoClub") in the festival view.
- `series_id` / sibling occurrences (next Thursday, next Tuesday), plus same-night events at the same venue by the same organiser (the Halloween workshops).
- `citySlug` → "More dancing in Munich" (plain view only).

## Desktop differences
Same content. On desktop the flyer sits next to the description, so the price and times on the flyer are at least visible above the fold ([01-past-flyer-desktop](screenshots/01-past-flyer-desktop.jpg)). On mobile they are cut off below the bottom nav. The desktop section nav loads with "Venue" highlighted while the page is at the top (scroll-spy glitch). The plain view is identical apart from the header nav.

## Top fixes (impact × effort)
1. **Past occurrence → next occurrence.** When `endDate` < now, replace GOING? with "This night is over. Next: Thu 29 Oct →", resolved by `series_id`, else same organiser + venue + weekday. Also offer a stable series URL (e.g. `/events/series/<id>` → next upcoming) that partners can put on their schedules and flyers (M).
2. **Facts line in the festival hero**, the same as the plain view: time range · price text · "Checked by …" (S).
3. **Link the people:** organiser chip `/@montunoclub` and venue `/@handle` in the festival view; set `venueHandle` in `fromSyncedEvent` (S).
4. **Add to calendar** (.ics + Google) on every event, plus "every Thursday" for series (S).
5. **Resume the action after sign-up** (GOING? → register → mark going), and give the modal a reason: "See who's going tonight and get a reminder" (S).
6. **Weekly-party mode:** hide rides / rooms / dance-card for single-evening local events, show the same-night workshops as part of the night, and hide "0 planning" until the count is > 0 (M).

Screenshots: `screenshots/01-past-hero-mobile.jpg`, `01-past-flyer-desktop.jpg`, `01-next-occurrence-mobile.jpg`, `01-v3-social-plain-mobile.jpg`
