# Event via promoter `?via=` link — signed-out entry audit

- **Example URLs** (checked 2026-10-25). Fake codes only; no real code was opened:
  - https://2026.wedance.vip/events/la-clave-halloween-756353f7?via=zzzzzzzz&utm_source=ig (valid format, code doesn't exist)
  - https://2026.wedance.vip/events/la-clave-halloween-756353f7?via=ZZ-bad (invalid format)
  - https://2026.wedance.vip/events/756353f7-afac-4d1f-a07d-95cb598ee17b?via=zzzzzzzz (old UUID-style link)
  - https://2026.wedance.vip/api/qr/zzzzzzzz.svg (QR endpoint)
  - PostHog requests were blocked in the test browser so the fake visits didn't create events. The valid-code path below is from reading the code.
- **Arrives from:** an influencer's / promoter's Instagram story link sticker, bio link, or a QR code from `promo_kit` / `my_link` · **Persona:** a follower of a local influencer, not on WeDance, curious about the party
- **CUJ:** C3 (Regular): find your floor (visitor side) · C7 / C5 (promoter side, who needs the credit) · **JTBD:** J3 (go with people I know: "my favourite dancer sent me"), J6 (run a great night: promoter attribution)
- **Related stories:** P319 referral discount link (not-built; a different mechanism), P207 who's coming (not-built)
- **Code:** `app/plugins/05.tracked-link.client.ts`, `server/utils/trackedLinks.ts`, `server/api/trpc/[trpc].ts:27-28` (cookie → `ctx.viaCode`), credit points in `server/trpc/routers/auth.ts:93,140,388`, `plan.ts:101-104`, `festivalSignup.ts:117,372`, `server/api/stripe/webhook.post.ts:154`; links and QR in `server/trpc/routers/referral.ts` (`myLink`, `promoKit`), `server/api/qr/[file].get.ts`, MCP `server/mcp/tools.ts:902-935`. The page itself is the ordinary `app/pages/events/[id].vue`. See `01-event-weekly-social.md` for its own issues.

## Scenarios

| # | As a signed-out follower who tapped an influencer's link, I want to… | What happens today | Verdict |
|---|---|---|---|
| S1 | see **who sent me** / that I'm in the right place | The page is pixel-identical to a direct visit ([02-via-landed-mobile](screenshots/02-via-landed-mobile.jpg)). Nothing says "Recommended by @promoter", even though the link row holds `profileId` (the promoter page). For an influencer's follower, the influencer's face is the main trust signal, and it is lost on arrival | ❌ |
| S2 | get the **discount / perk** the story promised | Tracked links have no discount by design (`trackedLinks.ts:14-16`: discounts belong to dancer→dancer `referrals`, P319 not-built). If an influencer says "use my link for −10%", nothing applies and nothing explains it | ⚠️ (by design, but invisible) |
| S3 | have a **clean URL** to forward to friends | `?via=` is stripped by `router.replace` once the router is ready (`05.tracked-link.client.ts:26-34`), and `utm_source=ig` survives (final URL `…/la-clave-halloween-756353f7?utm_source=ig`). A friend I forward to doesn't inherit the promoter | ✅ |
| S4 | (promoter) have my code **remembered** until the follower acts | Cookie `wd_via` set for 30 days, `SameSite=Lax`, not HttpOnly; `referral.trackVisit` fires once per page load (per browser via `wd_vote_sid`). **But the cookie is written after a regex check only** (`05.tracked-link.client.ts:16-18`): the fake `zzzzzzzz` was stored. Last touch wins, so any well-formed but unknown or mistyped code **overwrites a real promoter's cookie**. The server then credits nobody (`recordLinkAction` → `false`) | ❌ |
| S5 | open a **broken / invalid** link and still get the event | `?via=ZZ-bad`: param silently stripped, no cookie, no call, page renders normally. `?via=zzzzzzzz`: page renders normally, `trackVisit` returns `{counted:false}`, and the visitor never knows | ✅ visitor · ⚠️ promoter (no signal that a link is broken) |
| S6 | sign up: does my promoter get credit? | Password register (the event page's modal: "Create your account with email and password", [02-via-going-signup-mobile](screenshots/02-via-going-signup-mobile.jpg)) credits `signup` after the account is created (`auth.ts:388`). The **magic-link path credits at request time** (`auth.ts:93,140`: a new row with a magic token, before the email is verified), so typo'd or never-verified emails count as promoter sign-ups. A sign-up counts for whichever link is in the cookie, on any page | ⚠️ |
| S7 | tap GOING? so the promoter gets a **plan add** | Signed-out: GOING? → sign-up modal. After registering the modal closes and the GOING? tap is **not replayed** (`[id].vue:36-44`; `SignUpModal.vue:157`), so the plan add (`plan.ts:101-104`, only for the link's own event id) happens only if the user taps again. On festival-programme events the session "Going?" credits via the festival key (`festivalSignup.ts:117`) | ⚠️ |
| S8 | buy a **ticket**: does it count? | Only WeDance's Stripe festival checkout carries `via` in metadata (`festivalSignup.ts:372`) and credits it on payment (`webhook.post.ts:154`). Weekly socials pay at the door or through an external `ticketUrl`. The `outbound_click` for those has no link code, so **a promoter of a weekly party can never see a ticket** | ❌ |
| S9 | (promoter) **QR / promo-kit** lands on the same page | `/api/qr/<code>.svg|png` encodes `linkUrl()` = `/events/<slug>?via=<code>`, the same path as the link (`qr/[file].get.ts:20`); a fake code returns 404 (verified), so it isn't an open QR generator. The flyer images themselves carry no QR, so the QR is a separate asset. The link is **per occurrence**: `linkableEvent` refuses events that are over (`referral.ts:37-41`). For a weekly party, a printed QR or bio link lands on a "— Past" page after one night (see 01 S1), and the promoter needs a new link every week. Promoter tooling exists only over MCP (`my_link`, `promo_kit`, `my_results`); there is no web UI in `app/` | ❌ |
| S10 | old-style link with a UUID still works | `/events/<uuid>?via=zzzzzzzz`: cookie set, `via` stripped, then canonical redirect to `/events/la-clave-halloween-756353f7`. Side effect: a 404 console error from `booking.getEvent` on every UUID URL (`[id].vue:90-91`) | ✅ (noise) |

## Data we have but don't show
- The promoter page behind the code (`tracked_links.profile_id` → name, photo, handle): enough for a "Recommended by @…" chip.
- Whether the code exists (the server knows; `trackVisit` already returns `counted`, but not whether the code is valid).
- The promoter's own results (visits / sign-ups / plan adds / tickets) are only reachable via MCP, not on the web.

## Desktop differences
None specific to `?via=`. The cookie, stripping and page are identical; see 01 for the page's desktop notes.

## Top fixes (impact × effort)
1. **Validate before overwriting:** have `trackVisit` return `{ valid, page }`, and write `wd_via` only when the code exists (or set it server-side in `trackVisit`). An unknown code must never replace a valid one (S).
2. **"Recommended by @promoter" chip** on the event page for 30 days (name + avatar from the link's page), with an optional promoter note. Restores the trust handoff from Instagram (S).
3. **Credit sign-ups on verification**, not on magic-link request (`auth.ts:140` → `verifyMagicLink`) (S).
4. **Resume GOING? after sign-up** (shared with 01), so the plan add credit isn't lost (S).
5. **Series-level links for recurring events:** a code bound to `series_id` that resolves to the next occurrence, so a bio link or printed QR doesn't go stale after one night (M).
6. Count **door / external ticket intent** for promoters: attach `via` to `outbound_click` (kind=ticket) and expose it in `my_results` as "ticket clicks" (S); later, a door check-in via `attendance.checkIn` matched to the cookie (L).

Screenshots: `screenshots/02-via-landed-mobile.jpg`, `02-via-going-signup-mobile.jpg`
