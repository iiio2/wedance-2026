# Landing `/` — signed-out entry audit

- **Example URL:** https://2026.wedance.vip/ (checked 2026-10-25 ~13:30 CET, mobile 375px + desktop 1280px)
- **Arrives from:** direct, Facebook, `utm_source=montuno.club` (152 entry sessions, the biggest entry) · **Personas:** seeker (never danced), regular (local social dancer), traveller (festival goer), pro (teacher/DJ), host (private party/wedding), organiser (festival/event)
- **CUJ:** C1 Seeker, C3 Regular, C4 Traveller, C6 Host/B2B, C7 Business · **JTBD:** J1, J3, J4, J6 · **Related stories:** P201 hero (built), P202 "every face real" (partial), P203/P204 journey (built), P205/P206/P207 proof "see who's going" (**not-built**), P208 five steps (built), P209 pick festival (partial), P210 buy ticket one tap (**not-built**), P211 see who else is going (**not-built**), P212 final CTA (built), P703 private events (built)
- **Code:** `app/pages/index.vue`, `app/components/SiteHeader.vue`, `server/trpc/routers/plan.ts:758` (`proofShowcase`)

## Scenarios

| # | As a signed-out … from FB / montuno.club, I want to… | What happens today | Verdict |
|---|---|---|---|
| S1 | **seeker**: find my door in the first screen | Mobile fold ([07-hero-mobile](screenshots/07-hero-mobile.jpg)): one CTA, "Find your next festival", plus header chips Festivals · Artists · **Find your dance**. The seeker door exists only as a small header chip; the hero's only button sends a never-danced visitor to a festival list. The 5-stop journey ("You are here ↓ Seeker") starts just below the fold (~800px) | ⚠️ |
| S2 | **regular / traveller / pro**: find my door | Traveller: hero CTA ✅. Regular: "Find your floor" → hard-coded `/cities/munich` (`index.vue:61`); a Facebook visitor from Berlin lands in Munich. Pro (teacher/DJ): "Take the stage" → `/for-organizers`, which pitches flyer/content tools to organisers, nothing for a teacher or DJ looking for gigs (`/gigs` only in footer) | ⚠️ |
| S3 | **host** (wedding/birthday): find my door | "Private events" card sits ~2,100px down (≈2.6 screens) after the dancer journey and the proof card, below a heading in dancer language. On mobile the header has no B2B link at all (`SiteHeader.vue:76` "For organizers" is `hidden sm:inline`). Paid social sends hosts to `/for-events` directly, so the home page is only a fallback | ❌ |
| S4 | **organiser**: find out how to ticket my festival | "Festival organizers → Ticket with us" links to `/business/events/new?type=Festival` (`index.vue:438`), which for a signed-out visitor is a bare "Sign in to manage your profile" gate ([07-festival-organizers-signin-gate](screenshots/07-festival-organizers-signin-gate.jpg)): no pitch, no pricing, no "how ticketing works". Desktop has "For organizers" in the header, mobile does not | ❌ |
| S5 | believe the proof ("See who else is going") | Shows the **Sample** card: "In 3 days · Barcelona · Bachata Stars Barcelona · Jul 3–6, 2026" with four invented people. It's 25 Oct, so "in 3 days" is four months stale. Real data exists but `proofShowcase` returned *Caribbean Urban Fire, Oct 21–22* (already over: the query has no date filter despite its "upcoming" doc comment, `plan.ts:752-776`) with only 2 attendees, under `MIN_REAL_PROOF = 4` (`index.vue:112`), so the sample wins. The section titled "This is the product" shows a fake event under a promise of "No fake friends" | ❌ |
| S6 | tap the proof CTA | "Get tickets ✨" → `/events/bachata-stars-barcelona-2026` → **404 "Event not found"** ([07-proof-get-tickets-404](screenshots/07-proof-get-tickets-404.jpg)). The most prominent mid-page CTA is broken | ❌ |
| S7 | trust "Five steps. No surprises." | Step 2 "Buy your ticket in one tap" (P210 not-built), step 3 "See who else is going" (P211 not-built), step 4 "Dinners, ride-shares" (partial). Three of five steps promise what isn't built for most festivals | ⚠️ |
| S8 | hero CTA delivers | "Find your next festival" → `/festivals` "Upcoming festivals — 199 events". The first three cards are labelled **"Past"** although they run until today (La Negra Oct 21–25, Kubáname Oct 22–25). The first thing a traveller sees under "Upcoming" is "Past" | ⚠️ |
| S9 | browse without sign-up pressure | No gate, no pop-up; the Sign in modal only opens on tap, with "Create an account" as a secondary link. Bottom nav shows "My plan" and "Sign in" to a stranger; fine | ✅ |
| S10 | mobile navigation | Bottom tab bar (Explore · Cities · My plan · Sign in) plus a chip row. No console errors. The floating "Talk to us" bubble overlaps content at bottom-left on every screen | ✅ |

## Data we have but don't show
- ~1,300 upcoming v3-synced events (≈1,000 in Munich) and 1,071 "upcoming events in 136 cities" (the number `/for-organizers` shows). The landing never says "28 events in Munich this week" or shows one real upcoming event, though the montuno.club audience is Munich-local.
- Real public "going" faces (`proofShowcase` returns real people with photos); they're dropped because the item is past and has < 4 faces. An upcoming item with ≥ 1 face, or a city-level "N dancers going out this week", would be honest proof.
- City from `utm_source=montuno.club` / IP; never used to personalise the "Find your floor" link.

## Desktop differences
- Header adds "Festivals · Cities · Artists · Find your dance" and **"For organizers"** (organiser door visible above the fold on desktop only).
- Journey is a 5-card row just below the fold; "You are here" badge sits on Seeker for every visitor, including organisers and regulars.
- Same stale sample proof and same 404 CTA.

## Top fixes (impact × effort)
1. Repoint "Get tickets ✨" and stop using a dated fake card. Show the sample without a date ("e.g.") or drop the section until real proof exists (S).
2. Add a date filter (`end >= today`) to `plan.proofShowcase` and lower `MIN_REAL_PROOF`, or fall back to the next upcoming event with any public faces (S).
3. "Ticket with us" → a public ticketing pitch (`/for-organizers#ticketing` or a new page), not the `/business/events/new` sign-in gate (S).
4. Hero: a second button "New to dancing? Find your dance" (seeker) beside the festival CTA, and a compact "Hosting an event? / Organiser?" text-link row in the first screen on mobile (S).
5. "Find your floor" → `/cities` (or the visitor's city from UTM/geo) instead of hard-coded Munich (S).
6. Mark "Five steps" items that aren't live ("coming soon") or rewrite step 2/3 to what exists today (S).
7. `/festivals`: festivals that are on today should read "On now", not "Past" (S, see 13-directories).

Screenshots: `screenshots/07-hero-mobile.jpg`, `screenshots/07-full-mobile.jpg`, `screenshots/07-proof-get-tickets-404.jpg`, `screenshots/07-festival-organizers-signin-gate.jpg`
