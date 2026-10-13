---
status: proposal — journeys first, UI next, then build
created: 2026-10-12 21:00
supersedes: the brand-studio screens built locally the same day (data model kept as a starting point)
---

# Flyers for organizers: user journeys

Evidence: ~15 Claude sessions (Sep–Oct 2026; earlier transcripts are gone, May is from
summaries and campaign folders), `LaClave/assets/flyer-style.md`, Montuno
`brand-guidelines.md` + skill `flyer-from-brand-guidelines`, skills `event-flyer-pack`,
`event-poster-bundle`, Montuno campaign READMEs, `flyer-studio/product` (JTBD from 27
hand-made flyer sessions, the user journey).

## The job

> When an event is coming up and I need to fill the room, help me get an on-brand flyer and
> caption out fast, so I can get back to running the event.

What the evidence says the organizer cares about, in order: **the right face** (real
likeness, the right photo of the right person), **correct words** (names with ö, handles,
prices, times), **looks like us every week**, **speed** (usually 1–2 days before, sometimes the
same day), **not re-explaining** ("we have style for clave, do it in that style").

## Journey 1 — Set up my look (once per brand)

Two starting points, one result: a look the app can paint again and again.

**1a. I already have a style** (Montuno: brand guidelines; La Clave Afro: the DJ's own flyers)

1. Show the app what you have: past flyers, a brand guide, your Instagram.
2. The app describes the look back in plain words (scene, colours, lettering, photo
   treatment) and lists the facts it found (address, prices, handles, spelling).
3. Correct it. Paint one test flyer for a real upcoming event. Adjust until it looks like you.
4. Save it as a look ("Main party", "Afro set"). Past flyers stay attached as its examples.

**1b. I start from scratch** (La Clave, Aug 13: "help me build a concept, first we need a name")

1. Name and vibe: who is it for, which music, which feeling; optionally a flyer you like.
2. The app paints **4 different directions** for your first event.
3. Pick one or two ("B and D"); refine with plain notes.
4. Save the winners as looks.

## Journey 2 — This week's flyer (the most frequent, weekly)

La Clave Thursday, Frida Monday. The event repeats; this week's DJ, times or price change.

1. **Arrives with a list of what needs a flyer**: Home shows "Thu 15 Oct · La Clave — no
   flyer yet".
2. **Update this week's details**: paste the WhatsApp message ("DJ Hamza 9pm–11pm, entrance
   10€…") or edit fields. The DJ's photo comes from their artist page (or upload it now).
3. **Make it** in the series' look, story first, then feed. ~1 minute, honest wait.
4. **Check**: every word is compared with the details; problems are named ("the venue should
   read MÜNCHEN").
5. **Fix**: a wrong word, a different photo, "move him down": quick and specific, not a
   whole redo.
6. **Caption** in the brand's voice and languages, handles tagged.
7. **Hand off**: send story + feed + caption to my Telegram / the team group; download.
8. **Late change** ("end at 11pm" hours later): change the detail, refresh the flyer.

## Journey 3 — A one-off or launch campaign (monthly)

Frida Mondays launch, Cohibar birthday, Agua Pichi. Distinct mood, more pieces, more people.

1. Start from an event (or a new one) and a goal ("launch the series", "birthday edition").
2. Explore: several directions in the brand (or a new mood), pick, refine.
3. The pack: story, feed/square, optional print (A6 front/back, A4 4-up, DJ tent card) with a
   real QR; caption in the brand's languages; WhatsApp broadcast; story slides.
4. **Review gate**: a partner approves before publishing (Klaus: hard gate; Amado: wording).
5. Distribution checklist: IG post + collab tag, stories, WhatsApp groups, Telegram groups,
   artists' channels, reminder on the day.

## Journey 4 — The people around the flyer

- **Artist**: keeps their photos and handle on their WeDance page; organizers pick from them.
  "Use my DJ photo, not that one."
- **Partner / venue**: sees the draft, says OK or what to change, before it goes out.
- **Team**: gets the finished set in their group.

## Journey 5 — The weekly schedule poster (community)

WeDance Munich: every Sunday, one poster per dance style listing the week's events, with
caption; reviewed and posted. Already automated outside the app (`weekly-poster`); belongs
here later as a "schedule" flyer type.

## What this changes compared with what I built

- History is not a separate archive to browse. Past flyers matter in two places: as the
  material in Journey 1a, and as "last time" next to this week's flyer in Journey 2.
- The centre of the product is **the event** (Journey 2), not the campaign or the brand page.
  Brand setup is a short first-time flow, then mostly invisible.
- "Make again" from an old campaign was a testing tool, not a user journey. Testing a new
  setup = Journey 1a step 3 (paint a test flyer for a real event in a look).

## Decisions before UI

1. **Words on the flyer**: today Gemini paints everything (your Oct 6 rule) and the check
   catches errors, but fixing a word means repainting (~30 s, may change the picture).
   flyer-studio's design places words on top, so fixes are instant and exact, but your
   earlier tests found that flat. Journey 2 step 5 depends on this.
2. **Order of building**: Journey 2 first (it's weekly), with Journey 1 as its short first
   step, then Journey 3's pack, then 4 and 5.
