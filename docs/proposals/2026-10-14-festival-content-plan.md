---
status: built — confirmation steps 1–4, content plan (event_posts, migration 0037, the "Content plan" tab)
created: 2026-10-14 09:00
builds on: docs/proposals/2026-10-12-flyer-journeys.md (journey 3, the launch campaign; journey 4, the people around the flyer)
---

# Festivals: artist confirmation and the content plan

## Why

A festival is promoted for weeks, not with one flyer: a launch, an announcement
for every artist, a line-up poster, then the programme, countdown and last
tickets. Today the organizer makes all of that by hand, and the artists find
out what was posted about them afterwards (wrong photo, wrong spelling, a
workshop they never agreed to).

The artist's confirmation link (built: /confirm/<token>) is the natural place
where the two meet: the artist checks their part of the festival — and their
own announcement post — once, before anything goes out.

## 1. What the artist confirms (the link, in this order)

1. **About the event** (context, nothing to fill in): name, type, dates, venue
   and address (plus other venues in the programme), the organizer and how to
   reach them, music styles, size (workshops, parties, dancers planning), and
   who else is in the line-up with photos.
2. **I'm in** — participation: invited → confirmed / declined. The organizer
   sees the status on the artist's line-up card.
3. **Your programme** — every session they teach or play (title, day, time,
   length, room, style, level, teaching partner); for a one-night event their
   agenda line ("21:00 DJ set"). They approve, or say what's wrong as a note:
   the programme stays the organizer's to arrange.
4. **Your posts** — their announcement post (and their place on the line-up
   poster) as previews. Approving also covers using their photo for promotion.
5. **Your page** — name, photos, video, about, links (built).
6. **Make this page yours** — an account, when nobody manages the page (built).

Later, when bookings run through WeDance: arrival and sound check, rider,
travel and accommodation, fee and contract, a share kit to repost.

## 2. The content plan (festivals)

A plan of posts generated from the festival, each made with the flyer
pipeline (Gemini paints, every word read back and checked) in the festival's
look, with a caption (built: caption from fixed detail lines, Gemini writes
only the hook and call to action).

| When (default) | Post | Made from |
|---|---|---|
| Launch | Save the date: name, dates, city, look | event |
| Weekly, one per artist | **Artist announcement**: their photo, name, styles, what they teach | artist profile + their sessions |
| After the announcements | **Line-up poster**: everyone together | line-up |
| ~3 weeks before | Programme / schedule highlights | festival sessions |
| ~2 weeks before | Passes and prices; early-bird deadline | festival passes |
| ~1 week before | Countdown; practical info (venues, transport) | festival details |
| Days before | Last tickets / day passes | passes, sign-ups |
| During | Today's programme (story) | sessions of that day |
| After | Thank you; photos; next edition | event |

The organizer sees the plan as a list with dates, edits or drops posts, and
makes each when its date comes (or all at once). An artist's announcement
waits for that artist's approval (step 4 above) before it can be marked
ready; the line-up poster waits for everyone on it, or goes out with the
confirmed ones only.

"Extras in communication" the plan can carry, beyond posts:
- WhatsApp / Telegram text for the organizer's groups, per post.
- A reminder to the organizer on the post's date.
- For each artist: their post and caption to repost (the share kit).

## 3. The plan replaces the flyer panel (every event, not only festivals)

Today an event has **one** flyer: `event_flyers.kept_at` keeps one per event,
and the editor's right-hand panel is that flyer. The plan generalises it:
an event has **posts**, and each post has its own flyer (painted, read back,
kept) and caption. A party's plan is one post, so a party looks like today;
a festival's plan is the table above.

**Data**
- `event_posts`: id, event_id, kind (`announcement` · `save-the-date` ·
  `artist` · `lineup` · `programme` · `passes` · `countdown` · `last-call` ·
  `today` · `thanks`), subject (an artist handle for `artist`), due_on (date),
  format (`post` 4:5 · `story` 9:16), status (`planned` · `ready` ·
  `posted` · `dropped`), caption, sort.
- `event_flyers.post_id`: the post a version belongs to; "kept" becomes one
  per post. Existing flyers move to a first `announcement` post per event
  (one migration, nothing repainted).
- Each kind decides its words (`flyerSource` per kind): an artist post is
  their name, styles, sessions and the festival's name and dates; a passes
  post is the passes; the announcement is today's flyer.

**Editor**
- The right-hand panel becomes **Posts**: a list with date, kind, thumbnail
  and status (Planned · Waiting for the artist · Ready · Out of date ·
  Posted). The next one due sits on top, big, as the flyer does today.
- "Make the plan" fills the default posts from the event (one per artist
  from the line-up, passes only if there are passes…); the organizer drops,
  moves or adds posts.
- A post opens `/business/events/<id>/posts/<post>`: today's flyer page
  with that post's words. Its look defaults to the event's (Branding), so
  the whole campaign looks like one festival.
- Cost: nothing paints until the organizer clicks, per post or "Paint all
  planned" (with the count and an estimate before it starts).

**Artists**
- An `artist` post waits for that artist's step 4 on their link; the
  confirmation page shows that post's flyer and caption.

## Decisions before building

0. **Panel for ordinary events**: keep the single flyer exactly as now and
   show the plan only for festivals, or one Posts panel for every event
   (recommended: same editor for every type, as with the cards).


1. **Unconfirmed artists on the public page**: show them as "to be confirmed"
   (recommended), show them as usual, or leave them off until they confirm.
2. **Order of building**: the confirmation steps 1–4 first (they're needed for
   the artist announcements), then the content plan.
3. **How many posts by default**: the full plan above, or launch + artists +
   line-up only, with the rest added by hand.
