# Community votes `/elections/[handle]`, `/battle` (+ city video vote) — signed-out entry audit

- **Example URLs** (checked 2026-10-25):
  - https://2026.wedance.vip/elections/pinakothek-der-moderne — the only free/community space found (linked from `/@pinakothek-der-moderne` "Moderator election →")
  - https://2026.wedance.vip/elections/does-not-exist-zz — not-found path
  - https://2026.wedance.vip/battle — linked from `/cities` "City Battle" card
  - https://2026.wedance.vip/cities/munich#vote — per-city "Video of the day"
- **Arrives from:** a "vote for us / vote for our city" share (WhatsApp, Instagram story), the venue profile, `/cities` · **Persona:** dancer who was asked to vote, not signed in
- **CUJ:** C8 — Member — Belong & connect (community, trust) · **JTBD:** J7-adjacent (feel part of the scene); city battle also C2 discovery
- **Related stories:** epic G800 moderator election (G803 verifiable ballot, G804 moderated booking queue); `video_vote` / `city_battle_vote` / `election_nominated` events
- **Code:** `app/pages/elections/[handle].vue`, `server/trpc/routers/election.ts`; `app/pages/battle.vue` → `app/components/BattleFeed.vue`, `server/trpc/routers/cityVideo.ts:350-420`; city vote `CityVideoVote` in `app/pages/cities/[city]/index.vue:774`

## Scenarios — moderator election

| # | As a signed-out dancer from a "vote for us" link, I want to… | What happens today | Verdict |
|---|---|---|---|
| E1 | understand what the vote is about | Clear: "free, community-run space… elects a moderator, who proposes the guidelines", two candidates with statements + guidelines, phase "Voting open", term ([election](screenshots/16-election-mobile.jpg)). But the live production ballot's candidates are **"Rosa (demo)" and "Diego (demo)"**, with 3 votes all cast on 17 Jul in the same minute — seeded demo data on the only real community space | ❌ |
| E2 | know when voting ends | No end date: `closesAt` is null; voting has been "open" since 2026-07-17 for a **2026–2027 term that started in January**. Closing is manual by a steward (`election.ts:292`). Meanwhile the venue profile already says "Moderated by the Community-elected moderator" | ❌ |
| E3 | vote without an account | Tapping Vote opens the **sign-in** modal ("Welcome back · Enter your email and password", `[handle].vue:81-85, 345` uses `action="signin"`) — a newcomer must find "Create an account" ([sign-up](screenshots/16-election-vote-signup.jpg)). The modal never mentions the vote or the candidate; header reads "Join the floor / Sign in to WeDance / Create your account" | ⚠️ |
| E4 | have my vote counted after signing up | After sign-up the pending vote is not resumed — `vote()` returns on `requireAuth()` and nothing replays it; the user must find and tap Vote again. `castVote` additionally requires a `username` (`requireEligibleDancer`, `election.ts:35-44`) — new accounts get one at register, so this mostly holds, but the error copy "A complete WeDance profile is required" would surprise migrated v4 users without a handle | ⚠️ |
| E5 | see results before/without voting | Yes — per-candidate tallies, total and a public ledger with timestamps; voter identity hidden when signed out ("Sign in to see who each vote belongs to"). Transparent | ✅ |
| E6 | trust it can't be stuffed | Messaging: "public and timestamped — you can always check your own vote is unchanged". One account = one vote, changes are logged (`electionVoteHistory`). Missing: who is eligible (any account anywhere? locals only?), and nothing prevents throw-away sign-ups — the copy over-promises "verifiable" | ⚠️ |
| E7 | share the page / preview | No `useHead`: the page `<title>` is **empty** and data loads in `onMounted`, so link previews show nothing about the vote — bad for a page whose purpose is being shared | ❌ |
| E8 | wrong / old handle | "Space not found · There's no WeDance space at @does-not-exist-zz · Browse cities" — clean | ✅ |

## Scenarios — City Battle `/battle` and city "Video of the day"

| # | As a signed-out dancer asked to "vote for Munich", I want to… | What happens today | Verdict |
|---|---|---|---|
| B1 | understand what this is | Full-screen Reels feed with no header and no explanation: just "Havana VS Barcelona", a clip, "swipe up for Barcelona". What is being won, by when, and how cities are ranked is never said. Matchups are random per load (`cityVideo.ts:374-376`), so "vote for Munich" from a share usually lands on a different pair with no way to pick Munich | ❌ |
| B2 | vote signed-out | Yes — anonymous, cookie-based (`VOTE_SID_COOKIE`, `server/api/trpc/[trpc].ts:15-20`). Vote buttons appear after merely switching to clip 2 for an instant ("watch both clips to vote" is not enforced in time) ([clip 2](screenshots/16-battle-clip2-mobile.jpg)) | ✅ |
| B3 | see an honest result | After voting the overlay shows **"62%" vs "38%" for every vote** — `winnerPct` is hard-coded to 62 (`BattleFeed.vue:110-116`, comment: "The actual pct isn't exposed by the API"). The voter is shown a fabricated tally | ❌ |
| B4 | trust it's fair | No anti-fraud messaging at all. Dedup is per cookie per city-pair per month, cap 200/session (`cityVideo.ts:38, 381-412`): clearing cookies / incognito = unlimited votes. The "capped" end-screen says "Come back tomorrow" but the cap is monthly. Leaderboard ("Ranks") ranks Havana #3 on a single vote (1W·0L = 100%) — ~10 votes this month in total | ❌ |
| B5 | believe the clips are what they claim | Captions don't match footage: "Havana — Rueda de casino, Habana Vieja" plays a clip branded "Academias All Stars (Santiago de Cuba) ft. Rueda con Ritmo (Estados Unidos)"; "Hamburg — Kizomba connection" shows a gold turntable still on desktop ([desktop](screenshots/16-battle-desktop.jpg)). Champions fall back to best-ever videos from past months, so Munich's battle clip ("Casino night at Cohiba") isn't on Munich's own leaderboard this month | ⚠️ |
| B6 | use the controls on a phone | YouTube chrome (title, channel, YouTube logo) overlaps the city header and progress dots; the "Ranks" trophy on clip 2 is covered by the info block (Playwright: "subtree intercepts pointer events"); the "Talk to us" bubble overlaps the bottom bar. Only exit is ← to `/cities` | ⚠️ |
| B7 | vote for my city on its page | `/cities/munich#vote` shows "Not enough videos to vote yet — Submit yours below", while `/battle` is using a Munich clip and the leaderboard below lists a Havana "Amado Art" video as Munich #1 (0 votes). A "vote for Munich" link to the city page dead-ends | ❌ |

## Data we have but don't show
Election: `votingOpenAt`, `closesAt` (null — should be set), candidate profile photos/handles exist but candidates are demo accounts. Battle: real per-pair vote counts and ELO (`cityVideos.eloScore`) — could replace the fake 62%; the competition month; which video ID is a city's champion; submitter credit for clips.

## Desktop differences
Election page identical in a centred column. Battle on desktop still says "swipe up for …" with no keyboard hint; landscape YouTube stills (turntable) look like broken video. No header/footer in either size.

## Top fixes (impact × effort)
1. Remove the hard-coded 62% in BattleFeed: return the real pair tally from `battleVote` or show "Your pick: Munich" without numbers (S).
2. Replace the demo election on `pinakothek-der-moderne` (or close it and hide the "elected moderator" line until a real one exists); set `closesAt` and show "Voting closes …" (S).
3. Add `useHead` (title + OG) to `/elections/[handle]`; SSR the name/phase so shared links preview (S).
4. Election Vote → open the **sign-up** variant with "Create an account to vote for Rosa", then replay the vote after auth (S/M).
5. Battle: a one-line intro ("Monthly city battle · watch both, pick one · results on Ranks"), `?city=munich` deep-link that pins a matchup with that city, and make the city page vote fall back to the battle when it has <2 clips (M).
6. Fraud floor + honest copy: rate-limit by IP/device as well as cookie, fix "Come back tomorrow" vs monthly cap, say "one vote per city pair per month" (M).
7. Audit city-video captions vs footage; require the submitter's city/venue to match (M).

Screenshots: `screenshots/16-*.jpg`
