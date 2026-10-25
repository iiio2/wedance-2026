# Business profile `/@handle` — signed-out entry audit

- **Example URLs** (checked 2026-10-25, Sunday, mobile 375px plus one desktop pass):
  - organiser/school: https://2026.wedance.vip/@montunoclub
  - venue: https://2026.wedance.vip/@buena_vista_bar_munich
  - artist (claimed): https://2026.wedance.vip/@alosha-corazon-cubano · artist (unclaimed): https://2026.wedance.vip/@djdavidmunoz
  - promoter (real entry from Gmail/direct): https://2026.wedance.vip/@hummoproductions
  - unknown handle: https://2026.wedance.vip/@nonexistent-xyz-123
- **Arrives from:** the org's Instagram bio, a partner site, an email signature (PostHog: 9 entries in 30 days, direct and Gmail) · **Persona:** a dancer who has heard of the school, venue or DJ and wants to know what they do, when, and whether to go
- **CUJ:** C2 (find your teacher), C3 (find your floor), C5 (artists) · **JTBD:** J2 (keep momentum), J7 (trust it's real)
- **Related stories:** P501 Find your teacher (built), P601 Find your floor (partial), P220 Follow artists (partial), P207 who's coming per event (not-built)
- **Code:** `app/pages/@[handle].vue` (client-only: `onMounted(resolve)` at :80), `app/components/EventSchedule.vue`, `app/components/PromoterProfile.vue`, `app/components/ReviewsSection.vue`; data from `entity.getByHandle`, `events.byProfile` (`server/trpc/routers/events.ts:97`), `booking.scheduleForProfile`, `business.canManage`

## Scenarios

| # | As a signed-out dancer from Instagram or a partner site, I want to… | What happens today | Verdict |
|---|---|---|---|
| S1 | see a preview when the link is shared (WhatsApp, IG DM, Gmail) | The server HTML has `<title>WeDance</title>` with no description and no `og:*` tags. The page loads everything in `onMounted` (`@[handle].vue:80`), and `useHead` (:234) only runs on the client, so link previews and search engines see a generic "WeDance". (The Montuno business site has a full SEO block, `seo.title/description/image`, that the profile doesn't use.) | ❌ |
| S2 | understand what they do (school, venue, DJ) | A type eyebrow (ORGANIZER / VENUE / ARTIST / PROMOTER), name, city, bio and style chips. Montuno's bio is one line, "Free Dance Classes. Join our WhatsApp group.", but there is **no WhatsApp link**, only IG, web and FB icons ([organiser](screenshots/05-organiser-mobile.jpg)). Style chips contradict the content: the venue shows Bachata, Casino, Reggaeton and Merengue but no Salsa, although all 6 listed events are salsa classes. Alösha's bio says "Timba, Salsa, and Son" but his chips say Bachata, Kizomba, Timba ([artist](screenshots/05-artist-fold-mobile.jpg)). | ⚠️ |
| S3 | see the schedule and the next class or party | The "Events" list works: day groups, a TONIGHT tag, time ranges, type and style tags, venue, and "Going?". **But it shows only 6 events for the next 120 days** (`events.byProfile` returns 6 for both montunoclub and buena_vista_bar_munich). Nothing appears after Thu Oct 29, although the school runs weekly Sunday classes and an "8-Week Course". A visitor reads this as "they only have these two days". The partner feed `/api/profiles/montunoclub/events?days=180` also returns 6, so this is a data or series-materialisation gap, not a UI limit. | ⚠️ |
| S4 | see the **same** class once on the venue's page | The venue page lists the same Sunday classes **twice** from two sources: "Salsa From Zero" (organiser montunoclub, price `Free`, id a1b55bdb) and "Salsa from Zero" (organiser buena_vista_bar_munich, price `Donation`, id 40e1eaae), both at 18:00. "Rueda 8-Week Course" sits next to "Casino Beginner", and "Casino Partnerwork" next to "Casino Intermediate", in the same slots. Six cards stand for three classes, and they disagree on price ([venue](screenshots/05-venue-mobile.jpg)). The cards hosted by the venue itself have no location line (`location = organizerName`, which is empty: `@[handle].vue:168`). | ❌ |
| S5 | know the price (is it really free?) | `price` is in every event row (`Free`, `Donation`, or empty for the 8-week course), but `EventSchedule.vue` never renders it. On the profile, "free" appears only in Montuno's bio. Nothing on any profile page says what a course costs. | ❌ |
| S6 | contact them / ask a question | Only external social icons. No email or WhatsApp, and no "message" or "ask" for an organiser or school. "Book" exists only for artists and venues without spaces (`canBook`, :154), so a dancer has no on-platform way to ask Montuno "can I join the course mid-way?". | ⚠️ |
| S7 | follow them without an account (or with a light sign-up) | **Follow is broken when signed out:** `toggleFollow` sends the visitor to `/auth/login` (`@[handle].vue:117`, also `PromoterProfile.vue:96,129`), and **that route doesn't exist**, so it shows "404 Page not found: /auth/login" ([screenshot](screenshots/05-follow-404-mobile.jpg)). Hummo's "Not in your city? Follow … and we'll tell you" leads to the same dead end. Follow is shown only for artists and promoters (:293). Organisers and venues, which are the school and the bar a dancer actually wants updates from, have no Follow at all. | ❌ |
| S8 | trust it's real (claimed or verified, reviews, real faces) | `profile.claimed: true` and `managed` are both in the data, but **no badge is rendered**. A claimed page shows only "Work with them? Join the team →" (:317), which reads like a recruiting link. Reviews say "No reviews yet. Be the first." on every audited page, and signed-out visitors get no button to write one (`ReviewsSection.vue:87` gates the form on `isSignedIn`). No teacher or person faces: Montuno shows a logo, and the business site's "Meet Alex" section is not on the profile. Follower count shows only on artists ("1 follower"), which works against trust. | ❌ |
| S9 | understand an unclaimed profile | @djdavidmunoz shows a photo, name, "Munich", **no bio**, "Book David", "Follow" and "Is this you? Claim this page →". Nothing tells a dancer that this page was imported and the artist hasn't confirmed it, so the "Book" CTA looks as live as on a claimed page (see 10-booking S7). | ⚠️ |
| S10 | land on a wrong or old handle | Merged and renamed handles 301-redirect (:66); dancer handles redirect to `/u/`. An unknown handle shows a friendly "Not on WeDance yet" stub with "Claim / list a space" and "Browse cities", but the HTTP status is 200 (soft 404), and a dancer gets no search box or suggestion. | ⚠️ |

## Profile vs the business site (montuno.club)

Montuno has a WeDance-managed site (`/api/profiles/montunoclub/site` → 200; `domain: https://montuno.club`). Buena Vista and Hummo have none (404). The site, rendered on montuno.club from the same data, answers almost every question this profile leaves open:
hero "Just show up and dance"; facts "Free · donation-based / EN / no partner needed / 7+ years"; "Your first class" (walk in Sunday 6 PM, learn one move, social dance); "Meet Alex" (teacher face and story); FAQ ("Is it really free?", "What should I wear?", "What language?"); location ("Classes every Sunday"); a sign-up form that feeds contacts.
`/@montunoclub` shows none of this. A dancer coming from montuno.club to WeDance moves from a rich, warm page to a thin one. The reverse path (Instagram → `/@montunoclub`) never reaches the good content: the only link to it is the unlabeled globe icon.

## Data we have but don't show
- `price` per event (Free / Donation)
- `claimed` and `managed` (verification)
- the site's `seo` block, FAQ, facts, teacher bio and photo
- `photos[]` (Alösha has 4; the only hint is a ring around the avatar)
- `venueAddress` for the venue's own events
- `openingHours` and `capacity` (empty for Buena Vista, so the venue card shows only "Bar or club" plus amenities)

## Desktop differences
Same single centered 2xl column. At 1280×900 the header card takes about 600px, so only the first event card shows above the fold. The top nav adds Festivals / Cities / Artists / Find your dance. No side column uses the extra width, for example to show the next event or contact beside the header. The "Talk to us" chat pill covers content at the bottom-left on both viewports.

## Top fixes (impact × effort)
1. **Fix signed-out Follow**: open `SignUpModal` (contextual: "Follow Montuno, get new classes by email") instead of the non-existent `/auth/login`. Same fix in `PromoterProfile.vue` (S).
2. **SSR or `useAsyncData` for the profile**, plus `og:title/description/image`. Every Instagram-bio and Gmail share preview currently says "WeDance" (M).
3. **Show the price on schedule cards** (Free / Donation / €), and a "Verified · run by its team" badge when `managed` (S).
4. **Dedupe venue and organiser copies of the same event** (same venue, same start time, similar name). Prefer the organiser's row, and flag conflicting prices for the admins (M).
5. **Follow for organisers and venues**, and a contact or ask CTA for organisers (WhatsApp or "message"). Make the bio's "Join our WhatsApp group" a real link (S–M).
6. **Reuse the business-site content on `/@handle` when one exists** (facts strip, first-class steps, teacher, FAQ). At minimum add a labelled "Website" link (M).
7. **Investigate the 6-event horizon**: weekly classes beyond the next 5 days are missing from `events.byProfile` and from the partner feed (M; data or series).
8. **Mark unclaimed pages** ("Imported from public info · not yet confirmed by David"), and return HTTP 404 for the stub (S).

Screenshots: `screenshots/05-organiser-mobile.jpg`, `05-venue-mobile.jpg`, `05-artist-fold-mobile.jpg`, `05-follow-404-mobile.jpg`
