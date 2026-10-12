---
status: proposal
created: 2026-10-12 12:40
---

# /business: the business control panel

Follows `2026-10-10-business-mode.md` (step 1 — claim + manage a profile — is built).

## Principle

Organise /business around **the business user's week**, not around our features. The home page
answers "what needs me?" and "what's coming up?". Sections appear only when they have
something real for this profile type: no empty tabs, no "coming soon" (flyer-studio
prior-art rule).

Many people manage several profiles (an artist who also runs a party; La Clave = Javier's
organizer profile + Luma as venue). So: **one inbox across everything I manage**, and a
**profile switcher** that filters the other sections.

## Who uses it, and for what

| | Main job | What they come back for |
|---|---|---|
| **Artist** (teacher, DJ, performer) | Get discovered and booked (J5) | Booking inquiries, "where am I listed", keeping photos/bio fresh for organizers |
| **Organizer** (party, festival, workshop) | Run a great event (J6) | Events, line-up, flyers, what to post when, who's coming |
| **Venue** | Fill the floor | Booking requests, availability, the events happening there |

## Sections

1. **Home** — the action inbox plus the next 14 days.
   - Needs you: booking requests to answer, claim status, invites to a line-up, events
     missing data (no photo, no ticket link, artist without Instagram), posts due today.
   - Coming up: my events and gigs, with one-line status (flyer ready? announced?).
2. **Profile** *(built)* — page, photos, links. For artists add a **press kit**: short and
   long bio, hero photos, socials. This is what organizers pull into line-ups and flyers.
3. **Events** *(organizers, venues)* — upcoming and past; create, edit, **duplicate**
   (weekly series like La Clave Thursdays); line-up via profile picker (paste an Instagram
   link → profile); venue picker; Tickettailor checkout link. A checklist per event shows
   what's missing.
4. **Gigs** *(artists)* — every event that lists me in its line-up, collected automatically.
   When an organizer adds me, I get it in my inbox and can confirm it. Free listings for
   artists, better data for everyone.
5. **Promote** — per event: flyers (story + feed), captions, and a content plan (announce,
   line-up reveal, reminder, day-of) on a calendar. Posting starts as download + copy caption.
6. **Bookings** *(venues, artists)* — venue space requests and availability (built today on
   `/@handle` for moderators — move here); artist inquiries from a "Book me" button on the
   public page; gigs board posts and replies (built on `/gigs` — surface here).
7. **Audience** — followers (`artist_follows` exists), who's going (P710), style &
   level mix (built at `/organizers/insights` for festivals — move here), profile views.
8. **Team** — invite co-managers (`profile_members.role = editor` exists): Javier and Alex
   on La Clave.

Later, not now: plans and billing (P729–P731), Instagram auto-posting, audience
geography and post-festival signal (P727–P728).

## What already exists and should move into /host

| Today | Where it goes |
|---|---|
| Venue availability + booking requests (`/@handle`, moderator only) | Bookings |
| Festival wizard `/organizers/create` | Events → "List a festival" |
| Festival insights `/organizers/insights` | Audience |
| Gigs board posts (`/gigs`) | Bookings |

## Suggested order

1. **Home inbox + profile switcher.** Mostly reuses step 1. Gives everything after it a place to land.
2. **Events** (create / edit / duplicate, line-up and venue pickers). Unlocks 3, 4 and 5.
3. **Gigs for artists** (auto-collected from line-ups). Cheap once 2 exists; strongest reason
   for artists to claim their profile.
4. **Promote: flyers + content plan.** Needs the flyer-engine decision.
5. Move Bookings and Audience in; add Team.

## Open questions

- Should a line-up tag go live straight away, or wait for the artist to confirm?
- Who may create an event at a venue they don't manage: the event goes live, or the venue
  approves it?
- Is /business mobile-first? Organizers mostly work from their phones.
