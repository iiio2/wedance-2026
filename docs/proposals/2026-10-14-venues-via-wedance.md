---
status: built — venue ideas, asking venues (migration 0035), contacts in the ask
created: 2026-10-14 12:00
builds on: docs/proposals/2026-10-14-festival-content-plan.md (the artist confirmation link)
---

# Venues through WeDance: choose, then ask

## Why

After "when", an organizer's next question is "where": which venue fits this
night, is it free, what does it cost. Today that happens in DMs and phone
calls, and WeDance only stores the answer. WeDance already knows who hosts
which nights in a city, so it can help choose — and, like the artist link,
it can carry the question to the venue and bring the answer back.

## 1. Choose (built)

Under **Where**, once there's a date and a city: **Venues to consider**
(`businessEvents.venueIdeas`), from the past year of events on WeDance:

- nights hosted there and their music (ranked by the event's styles),
- **has a night then** (named, with time) or **nothing listed then**,
- hosts on that weekday, classes that day,
- runs its page on WeDance, spaces to book (capacity), floor.

Busy venues go last. **Pick** sets the venue. Munich today: 38 venues with
events, mostly dance schools that also host parties; 18 venue pages are
managed by someone.

Limits: it knows only what's on WeDance (mostly the wedance.vip mirror), and
many synced venue pages have no city, so a venue counts as "in the city" by
its events.

## 2. Ask (proposal)

A **"Ask"** button on each venue card, next to Pick — the venue twin of the
artist **Confirm** link:

1. The organizer can ask several venues for the same night. Each gets a link
   (`/confirm/<token>`, the same page as artists) with a ready-to-paste
   message, sent by the organizer (Instagram, WhatsApp, email).
2. The venue's link, step by step:
   - **About the event**: date and time window, expected guests, music,
     organizer, line-up, what the night needs (sound, bar, room size).
   - **Can you host it?** Yes · another date (pick) · no.
   - **Your terms**: rent, minimum bar spend, door split, deposit, what's
     included (sound, staff, security), capacity, notes.
   - **Your page**: photos, address, capacity, floor (as artists edit theirs).
   - **Make this page yours**: an account, when nobody runs the page.
3. The organizer sees the answers side by side on the venue cards (terms,
   "another date"), and **picks** one; the others get "thanks, booked
   elsewhere" on their link.
4. A managed venue answers in its /business inbox instead of a link.

**Data**: `profile_invites` already holds a link per (event, profile) with a
status and a message, and works without an account. Add `kind`
(`artist` · `venue`), `terms` (jsonb) and `other_date`. The old
`booking_requests` (spaces at commons like Pinakothek, moderated) stay as
they are.

## Decisions before building part 2

1. **One link page for artists and venues** (`/confirm/<token>`, steps by
   kind) — recommended — or a separate venue page.
2. **What WeDance takes**: nothing for now (recommended: grow supply first),
   or a booking fee on confirmed venues later.
3. **Terms visible to whom**: only the organizer who asked (recommended), or
   a venue's standard terms on its public page when it chooses so.
