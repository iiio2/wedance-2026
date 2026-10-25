# Booking `/@handle/book` — signed-out entry audit

- **Example URLs** (checked 2026-10-25, mobile 375px plus one desktop pass; **no form was submitted**):
  - artist (claimed): https://2026.wedance.vip/@alosha-corazon-cubano/book
  - artist (unclaimed, imported): https://2026.wedance.vip/@djdavidmunoz/book
  - venue without spaces: https://2026.wedance.vip/@buena_vista_bar_munich/book
  - organiser: https://2026.wedance.vip/@montunoclub/book
- **Arrives from:** the "Book …" CTA on `/@handle`, or the link pasted into an artist's or venue's website, IG bio or email signature (the page's stated purpose, `book/[handle].vue:3`) · **Persona:** someone planning a private event (birthday, company party, wedding) who wants to book a venue or a DJ or teacher
- **CUJ:** C6 — Host — Private event & venue (also C5 from the artist's side) · **JTBD:** J6 — Run a great event; J7 — Trust it's real
- **Related stories:** P816 Request a date (built), P817 Social, class, private (built), P815 Book a space (built), P901 Get booked (partial), P704 Book us (built)
- **Code:** `app/pages/book/[handle].vue` (client-only, `onMounted` at :34), `app/components/BookingInquiryForm.vue`, `shared/utils/bookingInquiry.ts` (`INQUIRY_WHAT`), `server/trpc/routers/inquiries.ts:60` (`send`), `server/utils/email.ts` (`sendBookingInquiryEmail`)

## Scenarios

| # | As a signed-out host planning a private event, I want to… | What happens today | Verdict |
|---|---|---|---|
| S1 | see a proper preview when the booking link is shared | The server HTML title is `Book \| WeDance`. The useful `<meta description>` ("Ask Alösha about your event…", :68) is set only on the client, after `onMounted`, so WhatsApp, IG and Gmail previews show the generic title. | ❌ |
| S2 | understand what I can book | Artist: "What for" lists Workshop or class / Show / DJ set / Festival / Party / Private event / Something else. Venue: Party / Workshop or class / Festival / Private event / Something else. Header: avatar, "ARTIST · MUNICH", style chips ([artist mobile](screenshots/10-book-artist-mobile.jpg)). Nothing says what the artist actually does (DJ? teacher? both?): Alösha's chips say Bachata/Kizomba/Timba, and the bio isn't repeated. The venue page shows no space, capacity, photos or "private hire possible" ([venue](screenshots/10-book-venue-fold-mobile.jpg)). | ⚠️ |
| S3 | book an organiser or school (e.g. Montuno for a company salsa class) | `/@montunoclub/book` → "Book MontunoClub — Pick a free slot on their calendar. **Open the calendar**", which links back to `/@montunoclub`, where **there is no calendar**. A dead end. `bookable` (:50) excludes organisers, although `INQUIRY_WHAT.organizer` (Collaboration / Event for us) already exists. A venue with spaces goes through the same "calendar" bounce. That one is legitimate, but it costs an extra tap. | ❌ |
| S4 | see prices or rates and availability before I ask | None. No rate, no "from €…", no availability or busy dates, no minimum spend for the venue. "Budget (optional)" is free text with the placeholder "e.g. €300 + travel", so the host has to guess the market price. The date is one optional date with no time or duration, so a venue can't tell an evening from a whole day. | ❌ |
| S5 | send without an account ("no account needed") | Kept. The copy says "No account needed" (:98), the form needs only what-for, about-it (≥10 chars), name and email, and the sign-in nudge is a soft dashed box. A honeypot field and rate limits (3/day per profile per email) are in `inquiries.ts:76`. One friction point: the "Have a WeDance account? Sign in to send it as your school or event, or add Alösha to one of your events" box comes **before** the form and speaks to organisers, not to a private host. | ✅ |
| S6 | know what happens after I send, and when they'll answer | Before sending: "They get it by email and answer you directly." After: "Sent — Alösha got it by email and will answer you at you@…", plus an account offer (`BookingInquiryForm.vue:104-110`). **No response-time expectation** anywhere: no typical reply time, and `server_inquiry_replied.hours_to_reply` is tracked but never shown. **The asker gets no confirmation email** (only the team is emailed, `inquiries.ts:99`), so there is no record and no thread to chase. Nothing explains what happens if they don't reply. | ⚠️ |
| S7 | trust that the request reaches the actual person (unclaimed profile) | @djdavidmunoz is unmanaged (`business.canManage` → `managed:false`), and the page says the same as for Alösha: "Tell David what you have in mind. **They get it by email and answer you directly.**" and "**Only David sees your email and phone.**" In fact the request goes to `hello@wedance.vip` (`inquiries.ts:85`, `forward`). The visitor learns this only **after** sending ("David doesn't run this page yet, so WeDance passes it on"). That is a misleading promise before submission, and the privacy line is false (WeDance staff see the data). | ❌ |
| S8 | trust who I'm booking (verified, reviews, past gigs, a sample) | The header links back to the profile, but the page itself has no verified badge, no reviews or rating, no past events or gig count, and no video or mix link. Alösha's profile "Events" are classes at Buena Vista, which says nothing about him as a DJ for a private party. The footer "Through WeDance, where dancers, artists and venues meet" is the only WeDance framing. The `/booking-terms` link appears only in the venue-space modal on `/@handle`, not on this form. | ⚠️ |
| S9 | fill the form comfortably on a phone | The form is one column on mobile, `type=date` uses the native picker, the phone placeholder is `+49…`, and optional fields are labelled. "City (optional) — Where the event is" also appears on a **venue** booking, where the city is fixed. Validation is hand-rolled (`check()`, :42), not the project's valibot `useFormValidation` + `FieldError` convention, so error wiring (aria, focus to first error) is not the standard one (code-read). The "Talk to us" chat bubble overlaps the Budget label on mobile. | ⚠️ |

## Data we have but don't show
- `managed` / `claimed`, used to decide delivery but not to set the visitor's expectations
- `hours_to_reply` per profile, from `server_inquiry_replied`, which could give "usually replies within a day"
- venue `capacity`, `amenities`, `openingHours`, `photos`
- the artist's bio, socials and photo gallery
- `INQUIRY_WHAT.organizer`, defined but unreachable because organisers aren't `bookable`

## Desktop differences
Same `max-w-xl` column, with the form fields in two columns: date/city, people/budget, name/email ([desktop](screenshots/10-book-artist-desktop.jpg)). Nothing extra uses the width. A side panel with the artist's photo, bio, sample and "replies in ~X h" would fit there. The above-the-fold experience is otherwise the same.

## Top fixes (impact × effort)
1. **Honest copy for unclaimed profiles**: before sending, "David hasn't joined WeDance yet. We'll pass your request on and copy you." Drop "Only David sees your email" in that case (S).
2. **Make organisers bookable** (use `INQUIRY_WHAT.organizer` / "Class for my group"), or hide the "calendar" bounce when the profile has no spaces (S).
3. **Send the asker a confirmation email**, a copy of the request with reply-to set to the team, plus an expected reply time ("usually within 2 days"), shown on the page too (S–M).
4. **SSR the title and description**, plus an `og:image` (the profile photo), so shared booking links preview properly (M, same fix as 05).
5. **Show "what you get" above the form**: a "from €" rate or price range, capacity and photos for venues, a sample (video or mix) and a verified badge for artists (M; needs profile fields).
6. **Private-host mode**: a start–end time instead of a bare date. Hide the city field for venues. Move the "send as your school" sign-in box below the form (S).

Screenshots: `screenshots/10-book-artist-mobile.jpg`, `10-book-unclaimed-artist-fold-mobile.jpg`, `10-book-venue-fold-mobile.jpg`, `10-book-artist-desktop.jpg`
