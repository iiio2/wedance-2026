---
status: in progress (step 1 built locally 2026-10-10)
created: 2026-10-10 16:55
---

# Business mode: one app, two modes (dancing / hosting)

Brainstorm with the Commander, 2026-10-10. Survey of wedance-2026, v3, v4, instafest,
smm-manager, flyer-studio, and the flyer workflows run in Claude sessions.

## What exists today

| Source | What's worth taking | What's not |
|---|---|---|
| **wedance-2026** | `profiles` (6.4k artist/venue/organizer rows), events (v3 sync), booking requests, gigs, festival wizard + insights, Cloudinary upload | No business user can edit their own profile, create an event, or claim a profile. `profiles.claimed` is never set. No owner columns on events/profiles/festivals. |
| **wedance-v3** | Profile picker: search + "paste an Instagram link → stub profile" + role per pick (`TInputProfile.vue`). Event caption builder for Instagram (`lib/instagram.ts`). Event import (Facebook/iCal/schema.org). Organizer event dashboard. | Vue 2 + Algolia + Firestore. Instagram posting uses an unofficial library with account passwords in Firestore — do not port. Poster = HTML + Puppeteer screenshot. |
| **wedance-v4** | `findVenueOrCreate` from Google Places, tRPC profile/venue pickers, event editor, Stripe ticket checkout, Cloudinary + Mux upload | Search is a naive `contains`; no flyers, no posting, no content plan. |
| **instafest** | Only the participant status enum + leader/follower waitlist logic (for class registrations later) | Not a flyer/Instagram tool at all: an abandoned 2024 class-booking prototype. Nothing for this plan. |
| **smm-manager** | Brand kit per project, "WhatsApp message → post" input idea, collector (IG → events) | Flyers are LLM-written HTML → screenshot: the approach the Commander has rejected twice ("flat"). |
| **flyer-studio** | `ops/prior-art.md` UX rules (Generate is explicit, stale state, no tech words, no dead controls, editable brand/photos, performer photo as hero) | ADR 001 (Gemini art + app-composited text) conflicts with the current practice below. |
| **Practice in Claude sessions** | LaClave `flyer-style.md`, Montuno `flyer-from-brand-guidelines`, AguaPichi QR overlay, weekly poster pipeline (events → prompt → Gemini → Telegram). This is the real spec. | Lives in chat sessions; repeated across projects (same flyer made in 3 sessions on 09-30). |

## Recommendation

1. **One app: wedance-2026. Port ideas and small pieces, not codebases.** No merging of
   instafest/v3/v4/smm repos.
2. **Mode switch, yes — but ownership comes first.** Hosting mode is empty until a person can
   own something. Step zero is a membership table (dancer ↔ profile, role owner/editor) and a
   claim flow. Then a header toggle "Dancing / Hosting" (Airbnb-style), shown only to people
   who manage at least one profile.
3. **Build one journey end to end, not five modules:**
   *"I'm running an event → it's listed correctly → I have flyers → I know what to post when."*
   1. **Claim + manage profile.** Artists upload photos (several, one marked hero); venues and
      organizers fix their data.
   2. **Create/edit events** as an owner, with a profile/venue picker (v3's paste-an-IG-link
      idea + v4's `findVenueOrCreate`). This also fixes the weekly poster's missing @handles.
   3. **Flyer from an event.** Line-up artists' hero photos are pulled in automatically: this
      is where "artists upload photos for organizers" pays off. Engine = the proven process:
      Gemini full poster, story 9:16 first then feed 4:5, real QR overlaid, facts read from
      the event (never typed), 2–3 variants, text checked against the event data before it
      is shown.
   4. **Content plan.** Auto-proposed posts per upcoming event (announce, line-up, reminder,
      day-of) on a calendar.
   5. **Posting.** Start with download + copy caption + share sheet. Official Instagram API
      (Business account + Meta app review) only once people actually use 1–4.
4. **First users are the Commander's own events** (La Clave Thursdays, Montuno, Rueda Saturdays,
   the weekly Munich poster). Success = those flyers come out of the app instead of a Claude
   session.

## Open decisions

- Flyer engine: Gemini full poster + automatic text check (recommended, matches practice) vs
  flyer-studio ADR 001 (app-composited text).
- Does this go ahead of the current WeDance priority? It doubles as tooling for the
  `/for-events` done-for-you service, which is the strongest sale.
- Where flyer-studio goes: fold into wedance-2026 as the flyer engine, or keep it as a
  standalone product for non-dance organizers.
