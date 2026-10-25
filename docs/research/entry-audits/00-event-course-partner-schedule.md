# Course event via partner schedule — signed-out entry audit

- **Example URL:** https://2026.wedance.vip/events/salsa-from-zero-a1b55bdb?utm_source=montuno.club&utm_medium=schedule (checked 2026-10-25, event that day 18:00)
- **Arrives from:** montuno.club schedule · **Persona:** complete beginner, never danced
- **CUJ:** C1 — Seeker — Find your dance · **JTBD:** J1 — Start dancing without feeling lost (also J3, J7; C8 for sign-up)
- **Related stories:** P1006 Free Taster Class (partial), P207 who's coming per event (not-built)
- **Code:** `app/pages/events/[id].vue` → `app/components/festival/FestivalView.vue` (the event has a one-session `festival` programme, so it renders the festival view)

## Scenarios

| # | As a signed-out beginner from montuno.club, I want to… | What happens today | Verdict |
|---|---|---|---|
| S1 | know when and where — can I still make it? | Hero: date, "— Today", venue + map link. **No time**; 18:00 only in Schedule / on the flyer | ❌ |
| S2 | know the cost and whether I must register | `price: "Free"` is in the data but **not rendered as text** (only on the flyer image). No "just show up". Only CTA is GOING? → implies sign-up | ❌ |
| S3 | know it's for me | Description: "No partner, no experience needed. Taught in English" | ✅ |
| S4 | trust who runs it | Montuno Club only in the description; `organizerUsername` not linked; "Checked by" badge (plain view) missing in festival view; Lineup tags Alösha with bachata/kizomba/timba | ⚠️ |
| S5 | get there / remember it | Address → Google Maps. No add-to-calendar | ⚠️ |
| S6 | say I'm coming | GOING? → generic "Join WeDance" (name/email/password); no reason ("remind me", "see who's coming"). Second Going? in Schedule, same | ⚠️ |
| S7 | know if I'll know anyone / come with a friend | Hero "1 planning" vs schedule "1 going". No faces. "Shall we dance?" asks a total beginner Lead/Follow + chili level, then a photo. Rides / rooms / dinners on a 1-hour local class | ❌ |
| S8 | after class: what's next? | No next Montuno class, other beginner classes, or follow organiser. Reviews: "Be the first". Page goes stale after 19:00 | ❌ |
| S9 | (business) attribution | `utm_*` survives the canonical-URL redirect; PostHog `$pageview` picks it up (code-read only) | ✅ |

## Data we have but don't show
`price: "Free"`, start time, `organizerUsername: montunoclub`, `editedAt` / `checkedBy`, style "Salsa" (dance card only offers Casino).

## Top fixes
1. Hero facts line: time · price · "just show up" when free (S).
2. Organiser chip linking `/@montunoclub` + "Checked by" in the festival view (S).
3. Contextual sign-up copy per action ("Save Salsa From Zero and get a reminder") (S).
4. One word for the count ("going") everywhere (S).
5. Small-event mode: hide rides/rooms/dance-card for single-session local events; show "next class" + follow organiser after the event ends (M).
