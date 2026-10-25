# `/for-events` (paid-social landing) — signed-out entry audit

- **Example URL:** https://2026.wedance.vip/for-events (checked 2026-10-25, mobile 375px + desktop 1280px). Inquiry form opened, **not submitted**
- **Arrives from:** Instagram / Facebook ads (`l.instagram.com`, `m.facebook.com`, `utm_source=ig`, `utm_content=card`; 12 entry sessions) · **Persona:** someone planning a wedding, birthday or company party who wants dance entertainment; not a dancer
- **CUJ:** C6 — Host a private event · **JTBD:** J6 · **Related stories:** P801–P817 (all marked **built**), P703 private events full night (built)
- **Code:** `app/pages/for-events.vue`, `server/trpc/routers/feedback.ts:79-120` (`feedback.inquiry`), `shared/validation/forms.ts:156` (`EventInquirySchema`)

## Scenarios

| # | As a signed-out host from an Instagram ad, I want to… | What happens today | Verdict |
|---|---|---|---|
| S1 | understand the offer in the first screen | "Hosting the night, not dancing at it? One team builds the whole floor. Venue. MC. DJ. Show dancers." plus occasion chips ([17-hero-mobile](screenshots/17-hero-mobile.jpg)). Clear and on-brand. But no image, no video, no CTA in the first screen; the only action is ~2,700px down (≈3.3 screens on mobile) after 8 service cards ([17-full-mobile](screenshots/17-full-mobile.jpg)) | ⚠️ |
| S2 | know roughly what it costs | No price, no "from €…", no packages, no example budget anywhere on the page or in the form. A wedding planner can't qualify us before writing in | ❌ |
| S3 | see proof that it's real | No photos or video of a past private event, no testimonials, no client names, no number of events done. The only "See it in action" is **Pinakothek der Moderne**: "Open air · Free · Community-run… propose your event, the moderator confirms it". That's a public dance commons, not a wedding we ran, and it links to a venue booking flow for dance organisers | ❌ |
| S4 | know who "we" are | No team, no names or faces, no company or location line on the page. The landing page's founder (Alösha, Munich) isn't mentioned. The trust burden is entirely on "we usually respond same day" | ❌ |
| S5 | judge the services | 8 cards (Venue, Catering, MC, DJ, Show dancers, Photo/Video, Ticketing, Full night) with one line each. "Venue → Browse venues" leaves for `/venues`, a dancer directory of 1,000+ schools/bars (console 403 on load), which pulls the host out of the funnel. "Ticketing: we run the door" is a festival feature, not a wedding one | ⚠️ |
| S6 | open the inquiry | "Tell us about your event" expands an inline 7-field form ([17-form-mobile](screenshots/17-form-mobile.jpg)): type, date, city, guests, needs (required), name, email (required). Low friction, valibot validation, no sign-up. But the copy right above says "**One reply, no forms**", then shows a form | ⚠️ |
| S7 | reach a person another way | No phone, WhatsApp, Instagram DM or email shown (hello@wedance.vip appears only in the error message, `for-events.vue:87`). For an Instagram-ad audience, a DM/WhatsApp button is the expected channel. The floating "Talk to us" bubble is the bug-report widget (Sentry feedback), and on mobile it covers the Venue card text and the "Your name" field | ⚠️ |
| S8 | know what happens after I send | Success state: "Request received. We… will come back with a plan — usually same day." Behind it (`feedback.ts:79-120`) the inquiry becomes a **Linear issue in triage** with the `user-report` label. There's no confirmation email to the requester, no email/Telegram alert to a human, and if `LINEAR_API_KEY` is missing the form errors out. "Same day" depends on someone watching the Linear triage queue | ⚠️ |
| S9 | (business) attribution | `utm_*` from the ad stays on the URL and is picked up by PostHog `$pageview`; `event_inquiry_submitted` + `server_event_inquiry_submitted` fire with type/city (code-read only) | ✅ |

## Data we have but don't show
- Real Munich venues with photos (302 venue profiles), real DJs/artists with profiles (`/artists`) and show dancers: a "Your DJ could be…" strip of 3–4 real faces would be proof.
- Real nights already run (Charanga Habanera concert hosted by Alösha, Montuno Club parties: "Made on WeDance" lists them on `/for-organizers`). None are reused here.
- The founder's photo and story from the landing page.

## Desktop differences
- Services are a 3-column grid, so the CTA sits ~1,300px down (still below the first screen) ([17-desktop](screenshots/17-desktop.jpg)). "Talk to us" bubble floats over the left margin without covering content. Otherwise identical.

## Top fixes (impact × effort)
1. Put the CTA in the hero (and a sticky "Get a plan" bar on mobile) plus a WhatsApp/Instagram-DM option for ad traffic (S).
2. Add an indicative price ("DJ + MC from €…, full night from €…") or 2–3 packages (S, needs a business decision).
3. Replace the Pinakothek showcase with 1–2 real private/hosted nights (photos, guest count, what we supplied) plus a "who we are" line with Alösha's face (S/M).
4. Send an auto-confirmation email to the requester and a Telegram/email alert to the team on each inquiry, not just a Linear triage issue (M).
5. Fix the "One reply, no forms" copy; move the Venue card link to an anchor/modal so the host isn't sent into the dancer venue directory (S).
6. Move the "Talk to us" bubble so it doesn't cover form fields on mobile (S, sitewide).

Screenshots: `screenshots/17-hero-mobile.jpg`, `screenshots/17-full-mobile.jpg`, `screenshots/17-form-mobile.jpg`, `screenshots/17-desktop.jpg`
