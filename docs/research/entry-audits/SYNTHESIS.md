# Signed-out entry audits — synthesis (2026-10-25)

17 entry pages audited (files `00`–`17`). This page lists what repeats across them and a ranked fix list.
Security/privacy findings are redacted from the public files and were reported privately.

## Cross-cutting patterns

| # | Pattern | Seen on | Impact |
|---|---|---|---|
| X1 | **Broken sign-in links**: `/auth/login` (Follow) and `/auth/signin` (post a gig) are 404s; the sign-up modal is the only working entry | 05, 11 | Signed-out visitors hit a 404 on core actions |
| X2 | **Generic "Join WeDance" wall that forgets the intent**: copy never names the event/person/action; after sign-up the Going / Follow / ticket / friend action is not replayed; checkout sheet sits above the sign-up dialog | 00, 01, 02, 03, 04, 09, 16 | Every conversion path leaks; ticket purchase signed-out is blocked (03) |
| X3 | **Client-only data → no previews, no SEO**: `/events/*`, `/@handle`, `/u/*`, `/confirm/*`, `/cities/*`, `/artists`, `/venues`, elections render data only in the browser; titles like "WeDance — Event", no OG / canonical / JSON-LD; unknown slugs return 200 | 03, 05, 06, 09, 12, 13, 14, 16 | Shared links (the main traffic source) preview blank; search sees no events |
| X4 | **Time-blind dates**: past occurrences keep live Going/buy buttons with no "next date"; "Past" keyed on start date (running festivals shown as Past); Mon–Sun "this week" on Sundays; started classes still listed; "Tonight" at 13:40 | 01, 03, 04, 06, 08, 09, 13 | Partner links (montuno.club → La Clave) land on a dead night |
| X5 | **Festival view on small events hides the basics**: no time, no price, no organiser link in the hero; rides/rooms/dance card on a 1-hour class; plain view shows them correctly | 00, 01, 03 | The top-3 seeker questions (when / cost / who runs it) fail |
| X6 | **Data we have but never show**: price (or worse, empty price shown as "Free"), `claimed`/verified, `checkedBy`, organiser/venue handles, verified tickets, series | 00, 01, 05, 08, 09, 12 | Trust (J7) and decision facts missing |
| X7 | **Fake, demo and test data on production**: landing proof card (Jul sample → 404), hard-coded 62/38 battle result, demo election, "(test)" venues, test gigs, `?preview=1`, founder test reviews, "TO BE CONFIRMED" line-ups | 03, 07, 11, 13, 16 | Undermines "real people, no fakes" (J7) |
| X8 | **Identities that don't connect**: dancer `/u/alosha` ↔ artist `/@alosha-corazon-cubano`; duplicated class listings venue vs organiser (Free vs Donation); `/u/` unreachable from any public page | 05, 12 | Duplicate/conflicting info, dead ends |
| X9 | **Stale / removed routes without redirects**: `/festivals/<slug>` 404 (removed in #297) still gets ~17 entry sessions; `/@montunoclub/book` loops back | 03, 10 | Old links from Instagram/Stripe die |
| X10 | **Counts that lie**: "N going" always 0 on `/cities/munich` (414 on 758-id batch); "planning" vs "going"; shared-plan referral "10% off" on fake codes | 00, 04, 06 | Social proof (the core promise) invisible |
| X11 | **Mobile chrome**: "Talk to us" bubble covers content and form fields | 07, 17 | Friction on every page |
| X12 | **Backlog drift**: promises marked built/partial that aren't (P210, P211) and the reverse (P319) | 04, 07 | Status sheet unreliable |

## Ranked fixes

Effort: S = hours, M = a day or two, L = more. Value is from the entry traffic in `README.md`.

| Rank | Fix | Patterns | Effort |
|---|---|---|---|
| 1 | *(private)* Security/privacy fixes — see the private note | — | M |
| 2 | Point every sign-in link at the auth modal (`/auth/login`, `/auth/signin` → modal or a real `/sign-in` page) | X1 | S |
| 3 | Contextual sign-up: pass `{action, target}` into `SignUpModal` for the headline, replay the action after auth; fix z-order of the checkout sheet vs sign-up | X2 | M |
| 4 | Event hero facts line in FestivalView: time · price ("Free" only when it is) · organiser chip · add-to-calendar | X5, X6 | S |
| 5 | Past-event state: "This was on …" + next occurrence of the series / organiser's next event; disable Going/buy | X4 | M |
| 6 | SSR head for `/events/*`, `/@handle`, `/u/*`, `/confirm/*`, `/cities/*`: title, description, og:image (flyer/photo), canonical; 404 for unknown slugs | X3 | M |
| 7 | Redirect `/festivals/<slug>` → `/events/<key>` | X9 | S |
| 8 | Date logic helpers: end-date-aware "Past", rolling 7-day "this week", hide started sessions | X4 | S |
| 9 | Remove fake/demo data from production surfaces (landing sample, battle 62/38, demo election, test venues/gigs, `?preview=1`) | X7 | S |
| 10 | Fix `plan.countBatch` (chunk ≤100 ids, POST) so city "going" counts render | X10 | S |
| 11 | Beginner path: level filter + "first class" section after choosing a style on `/find-your-dance` and city page | 08, 06 | M |
| 12 | Link identities: dancer ↔ artist profile, dedupe venue/organiser class listings | X8 | M |
| 13 | `/for-events`: price anchor, CTA in first screen, WhatsApp option, confirmation email + alert on inquiry | 17 | M |

## Per-page verdict (worst first)

| File | Page | Verdict |
|---|---|---|
| 14 | `/confirm/[token]` | ❌ security + error states |
| 03 | Festival | ❌ signed-out purchase blocked, dead legacy URLs |
| 09 | Shared year plan | ❌ shared links dead, privacy |
| 01 | Weekly social | ❌ partner link lands on past night |
| 06 | City | ❌ counts broken, no SEO, nothing on first screen |
| 00 | Course via partner schedule | ⚠️ facts missing, festival model |
| 04 | Festival shared plan | ⚠️ loses festival context, fake discount |
| 05 | Business profile | ⚠️ Follow 404, duplicates, no trust |
| 07 | Landing | ⚠️ fake proof card, one-persona hero |
| 08 | Find your dance | ⚠️ "Free" bug, advanced classes for beginners |
| 10 | Booking | ⚠️ promises vs reality |
| 11 | Gigs | ⚠️ post link 404, test content |
| 12 | Dancer profile | ⚠️ unreachable, no preview |
| 13 | Directories | ⚠️ "Past" labels, test data, no SEO |
| 15 | Token links | ⚠️ magic link loses destination |
| 16 | Community votes | ⚠️ fake result, demo ballot |
| 02 | Promoter link | ⚠️ cookie overwrite, weak credit for weeklies |
| 17 | For events | ⚠️ no price, CTA buried |
