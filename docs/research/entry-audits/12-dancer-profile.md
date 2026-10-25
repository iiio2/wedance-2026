# Dancer profile `/u/[username]` — signed-out entry audit

- **Example URLs** (checked 2026-10-25, fresh signed-out context, 375px + 1280px):
  - `https://2026.wedance.vip/u/alosha`. Also reached via `/@alosha`, which redirects there (`app/pages/@[handle].vue:70`).
  - `/u/nobody-fake-zz9` (not found).
  - The same person's artist page `/@alosha-corazon-cubano`, which is linked from event line-ups.
- **How the example was found:** no public page links to `/u/` for a signed-out visitor. I crawled `/cities/munich`, `/festivals`, `/festivals/meneate-viena-2026`, `/@montunoclub` and three event pages and found no `/u/` hrefs. The roster shows "Alösha" (verified ticket, Menéate) as a non-link card. The handle was resolved by trying it directly.
- **Arrives from:** a shared link, Instagram bio, `/@handle` redirect, or (in theory) a who's-going face. **Persona:** a dancer checking out someone they'll meet at a festival or social.
- **CUJ:** C8 (Member: belong & connect; trust) · **JTBD:** J7 (trust it's real: real people, real faces), J3 (go with people I know)
- **Related stories:** P202 real-not-fake (partial), P205 see who else is going (not built), P206 tickets become faces (not built), P305 arrive with friends (not built)
- **Code:** `app/pages/u/[username].vue`, `server/trpc/routers/profile.ts:33-95` (`getByUsername`), `plan.sharedPlan` (`plan.ts:461`), `app/components/BioText.vue`, orphaned `app/components/GoingSection.vue`

## Scenarios

| # | As a signed-out dancer checking out someone I'll meet, I want to… | What happens today | Verdict |
|---|---|---|---|
| S1 | reach their profile from where I saw them (roster / who's going) | **No path.** The festival roster (`AttendeeRoster`) renders non-link cards. `GoingSection.vue`, the component whose faces link to `/u/` (`:238`), is **not mounted anywhere**. The only `/u/` links are review authors, the Activities tab and the signed-in `DiscoverDancers`. Signed out, `/u/` is reachable only by typing or sharing a URL | ❌ |
| S2 | see who this is: face, name, city, role, styles | Clear card: photo, "Alösha", @alosha, Munich, "Leader", 6 style chips, bio ([shot](screenshots/12-dancer-mobile.jpg)). Wording differs from `/my-year`, which says "Lead" for the same person | ✅ |
| S3 | trust it's a real, active person (J7) | No "member since", no "verified ticket holder" (he has one for Menéate, and the public roster shows it), no events attended or hosted, no mutual friends or followers. The only "Video" is a YouTube video of **another dancer** (Amado Art) that he submitted to the city battle. It is shown under his name as his activity, with the city as the lower-case slug "munich" | ⚠️ |
| S4 | see the events and festivals they're going to | "Upcoming Festivals" is fed by `plan_items` only (`[username].vue:46,61-65`). His single plan item (DDF) is past, so the section is **hidden**, even though he holds a **verified Menéate ticket**. Weekly classes and socials are never shown. The comparison `endDate >= new Date().toISOString()` also drops a festival on its last day (date string vs ISO timestamp) | ❌ |
| S5 | see their teaching/DJ schedule | The same person has an **artist profile `/@alosha-corazon-cubano`** with Follow (1 follower), "Book Alösha", tonight's 3 classes and Thursday's ([shot](screenshots/12-artist-twin-profile.jpg)). Neither page links to the other. The bio mentions `@montunoclub`, which exists on WeDance, but `BioText` links every @handle to **instagram.com** (`BioText.vue:38`), sending the visitor off-site | ❌ |
| S6 | follow or wave so we connect before the festival | **No actions at all** on `/u/`: no Follow, Wave, "Add friend" or Message, signed in or out. Waves exist only inside `DiscoverDancers` on festival pages for signed-in dancers going to that festival | ❌ |
| S7 | not see private data (privacy) | `getByUsername` returns no email or phone (`profile.ts:36-50`), and private profiles 404 for everyone except the owner. ✅ for PII. **But:** `profile_public` defaults to `true` (`schema.ts:45`), so the ~3,900 migrated v4 dancers are public without having chosen it. A common first name as handle resolved to a migrated account from another city, with Instagram and website shown. 🔒 *Security/privacy finding — redacted from this public doc until fixed; details reported privately.* | ⚠️ |
| S8 | share or preview the profile in a chat | SSR returns `<title>WeDance — Dancer</title>` with **no description and no OG image or name**, because data loads only on mount (`[username].vue:21-23,59`). A WhatsApp preview shows neither the face nor the name | ❌ |
| S9 | handle a bad link | "No dancer here — We couldn't find a dancer at @nobody-fake-zz9" plus "Browse cities" ([shot](screenshots/12-not-found.jpg)). Friendly, but it returns **HTTP 200** (a soft 404), and there's no search or suggestion | ⚠️ |
| S10 | (old handle) still land on the right person | `profile.movedTo` gives a 301 to the new handle (`[username].vue:51-52`). Code-read only | ✅ |

## Data we have but don't show
Verified ticket holdings (`festival_signups.verifiedTicketHolder`, already public on the roster); the linked artist/business profile (`@alosha-corazon-cubano`, events as an artist via `events.artists[]`); weekly events they're "Going" to (`plan_items` itemType `event`); per-style levels (`dancers.dance_levels`); follower and following counts (`follows`); account age; mutual festivals with the viewer.

## Desktop differences
Same narrow card (max-w-xl) centred in a 1280px viewport with lots of empty space ([shot](screenshots/12-dancer-desktop.jpg)). The top nav adds Festivals / Cities / Artists. Otherwise identical: no actions and no schedule.

## Top fixes (impact × effort)
1. **Make faces lead here:** link roster cards (for dancers with public visibility) to `/u/<username>`, and either mount `GoingSection` or delete it (S).
2. **Show what they're going to** from tickets and attendances, not only `plan_items`, limited to items the dancer made visible. Fix the last-day date comparison (S).
3. **Join the twin identities:** a dancer who manages an artist page gets a "Also: DJ / teacher at @alosha-corazon-cubano" chip, and the artist page links back. In `BioText`, link an @handle internally when it exists on WeDance (S/M).
4. **A first connection action:** "Follow" or "Wave". Signed out, it opens contextual sign-up ("Join to wave at Alösha before Menéate") (M).
5. **Trust signals:** "Verified ticket · Menéate 2026", "Member since", follower count. Label submitted videos "shared by Alösha" (S).
6. **SSR the profile head:** title "Alösha — dancer in Munich", description, `og:image` = photo, and a real 404 status for unknown handles (S/M).
7. **Privacy default:** for migrated v4 dancers, set `profile_public` to false until they sign in and confirm. Or at minimum hide the socials of unclaimed migrated rows (M).
