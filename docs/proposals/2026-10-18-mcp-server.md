---
title: WeDance MCP server — one server for dancers, organizers, artists, promoters, influencers
date: 2026-10-18 14:00
status: accepted
decided: 2026-10-18 (Commander approved all four recommended decisions)
owner: Forge
---

# WeDance MCP server

## Why

WeDance users increasingly ask an assistant (Claude, ChatGPT) instead of opening an app. Each of
these groups has a job it would hand to its assistant if WeDance were reachable from there:

| Who | Job they would hand to their assistant |
|---|---|
| Dancer | "What's on this weekend, who's going, add it to my plan, find me a ride to the festival" |
| Organizer | "Put my Thursday party on WeDance, make the flyer, write the captions, who's coming?" |
| Artist | "Show my booking requests, set my availability, accept the invite from X" |
| Promoter | "What am I promoting this week, how many sign-ups did my link bring?" |
| Influencer | "Give me the content kit and my personal link for event X" |
| Alex / Montuno Club | Run the weekly classes, campaigns and guest-teacher invites from Claude and Telegram, without DB scripts |

The last row is also the first user: Montuno Club becomes WeDance's dogfood organizer.

## Shape

- **One server.** It runs at `https://2026.wedance.vip/mcp` (Nuxt route, `@modelcontextprotocol/sdk`,
  Streamable HTTP, stateless, so it works on Vercel). There is no separate server per persona.
- **Dynamic tool list.** `tools/list` returns only the tools the token's scopes and the user's
  roles allow. An anonymous client sees about 8 read tools. A dancer sees the dancer set. A
  member of an organizer profile also sees the business set. This keeps the tool count small,
  which matters for model accuracy.
- **Thin adapter.** Every tool calls `appRouter.createCaller(ctx)`. Validation, permission
  checks (`profileMembers`), PostHog events and Gemini jobs stay in the tRPC routers, with no
  duplicate logic. Missing capabilities are built as tRPC procedures first, so the web app gets
  them too.
- **Tool annotations.** Every tool declares `readOnlyHint` / `destructiveHint` / `openWorldHint`,
  so clients ask the user before writes.

## Auth (Phase 0, everything else depends on it)

WeDance is its own OAuth 2.1 authorization server, following the MCP authorization spec.
Identities already live in `dancers` / `sessions`. A second identity system (WorkOS, Clerk) would
split users in two.

| Piece | What |
|---|---|
| Discovery | `/.well-known/oauth-protected-resource` (RFC 9728) on the MCP route; `/.well-known/oauth-authorization-server` (RFC 8414). 401 responses carry `WWW-Authenticate` pointing at it |
| Client registration | Dynamic Client Registration (RFC 7591) **and** Client ID Metadata Documents. Claude and ChatGPT use one or the other |
| Authorize | `/oauth/authorize`: PKCE S256 required. Login uses the existing magic link / password. Then a **consent screen**: app name, scopes in plain language, and a **profile picker** ("this app may act for: ☑ Montuno Club ☐ La Clave") |
| Token | `/oauth/token`: access token 1 h, rotating refresh token 30 d, audience-bound to the MCP resource (RFC 8707) |
| Storage | New tables `oauth_clients`, `oauth_codes`, `oauth_grants` (dancer, client, scopes, profile ids), `oauth_tokens` (**hashed**, unlike today's plaintext `sessions.token`) |
| Context | `createContext` accepts an MCP token. It resolves `dancerId`, `scopes` and `grantedProfileIds`. A new `requireScope()` middleware, plus a profile-grant check in the business procedures, enforces the grant inside tRPC itself, not only in the adapter |
| Control | `/settings/connections` lists connected apps with last use and **Revoke** |
| Audit | `mcp_audit` table: grant, tool, profile, input hash, result, latency. Organizers see their profile's log |
| Limits | Rate limit per token and per IP (anonymous reads are a scraping surface) |

**Scopes**

| Scope | Grants |
|---|---|
| *(none)* | Public reads: events, festivals, venues, artists, public rosters |
| `me:read` | Own profile, plan, tickets, follows |
| `plan:write` | Plan add/remove, going visibility, festival join, ride/roommate posts |
| `social:write` | Ask locals, recommend, hangouts, dinner, follow, reviews |
| `business:read` | Granted profiles: events, inbox, inquiries, team, insights, promoter dashboard |
| `business:write` | Drafts: create/update events, flyers, captions, posts, availability |
| `business:publish` | Anything that goes public or reaches another person: publish event, send invites, answer inquiries, team changes |
| `admin` | Only for `isAdmin` users **and** an allowlisted client (Alex's own agents). Never shown in public consent |

**Safety rules**
- `business:publish` tools run in two steps. The first call returns a preview and a
  `confirm_token`. The second call commits. Where the client supports MCP elicitation, the
  server uses that instead.
- User-generated text in tool results (event descriptions, ask-locals posts, inquiries) is wrapped
  as quoted data, never as instructions. This guards against prompt injection through event text.
- No payments through MCP. Checkout tools return a Stripe link that the human opens.

## Tools by persona

✅ = existing procedure · 🆕 = new procedure needed

### Everyone (no auth)
`find_events(city, from, to, styles?, type?)` ✅ events.byCity · `get_event` ✅ events.get ·
`find_festivals` ✅ festival/events.festival · `get_profile(handle)` ✅ entity.getByHandle ·
`list_venues / list_artists(city)` ✅ entity.list* · `whos_going(event)` ✅ plan.goingList ·
`ask_locals_feed(city)` ✅ askLocals.listByCity · `festival_roster` ✅ festivalSignup.publicRoster

### Dancers
- `my_plan`, `add_to_plan`, `remove_from_plan` ✅ plan.*
- `share_my_plan` ✅ plan.sharedPlan/setShareGoing
- `festival_join` ✅, `my_tickets` ✅, `buy_ticket` → returns checkout link ✅
- `rides(list/offer)` ✅ rideShare, `roommates` ✅
- `hangouts_tonight` ✅, `rsvp_hangout` ✅, `join_dinner` ✅
- `ask_locals`, `recommend` ✅
- `follow` ✅, `review_venue` ✅
- `request_private_class(artist, slot)` ✅ booking.request
- `enter_giveaway` ✅, `vote_city_video` ✅
- Excluded from v1: `wave.*` (person-to-person signals belong in the app, not in an agent)

### Organizers
- `my_profiles` ✅ business.myProfiles
- `create_event`, `update_event`, `duplicate_event`, `archive_event` ✅ businessEvents.*
- `import_event_from_instagram` ✅ addFromInstagram
- `suggest_venues` ✅ venueIdeas
- `find_lineup(query)` ✅ searchProfiles
- `invite_artist` ✅ artistInvites.link/notify
- `make_flyer`, `fix_flyer`, `flyer_variants`, `flyer_status` ✅ businessFlyers.* (async job + poll)
- `write_captions`, `plan_posts` ✅ businessPosts.*
- `inbox`, `inquiries`, `answer_inquiry` ✅
- `team`, `add_member`, `set_role` ✅ businessTeam.*
- `event_insights` ✅ festivalInsights
- 🆕 `attendees(event)`: who signed up or bought, with export
- 🆕 `message_attendees(event, text)`: publish scope, with preview
- 🆕 `recurring_series`: create a weekly series in one call (classes, weekly parties)

### Artists
- `update_my_profile` ✅ profile.update
- `set_availability` ✅ booking.setAvailability
- `my_booking_requests`, `respond_booking` ✅ booking/inquiries
- `my_invites`, `respond_invite`, `claim_profile` ✅ artistInvites.*
- `my_gigs` ✅ events.byProfile
- `find_gigs`, `post_offer` ✅ gigs.list/create
- 🆕 `apply_to_gig`: gigs has no apply step today

### Promoters
- `my_roster` ✅ entity.promoterRoster
- `promoter_dashboard` ✅
- `my_referrals` ✅ referral.myReferrals
- Plus the organizer flyer/caption tools for the events they promote
- 🆕 `my_link(event)`: a per-promoter tracked link (reuse `referrals`)
- 🆕 `my_results`: sign-ups and tickets per link per event

### Influencers
There is no influencer entity type today (`venue | artist | organizer | promoter`). Proposal: an
influencer is a promoter whose deliverable is content. The promoter role gains one flag, with no
new type.
- 🆕 `promo_kit(event)`: flyer (feed + story), captions in the event's languages, hashtags, tracked link, QR
- `my_link`, `my_results` (shared with promoters)
- 🆕 `propose_giveaway(event)`: giveaway.create is admin-only today, so this becomes a request the organizer approves
- `city_battle_status` ✅ cityVideo.cityLeaderboard

### Montuno Club (Alex, as organizer + `admin` for his agents)
Montuno Club is an organizer profile on WeDance. Concretely, from Claude or the Telegram bot:

| Ask | Tools |
|---|---|
| "Publish this Sunday's classes" (18:00 free taster, 19:00 Azucar course, 20:00 workshop at Buena Vista) | 🆕 `recurring_series`, then `update_event` per date for exceptions |
| "Flyer + IG captions for Cohibar Thursdays" | `make_flyer`, `write_captions` (feed + story) |
| "Who's coming Sunday? Any questions from students?" | 🆕 `attendees`, `inquiries` |
| "Invite Felix as guest teacher on the 25th" | `find_lineup`, `invite_artist` (publish, preview first) |
| "How did the Frida Mondays campaign do?" | `event_insights`, `promoter_dashboard`, `my_results` |
| "Mirror our events from montuno.club" | `admin` client replaces direct-DB scripts for Alex's agents |

Montuno-specific gaps this surfaces:
- **Courses.** An 8-week course with monthly billing (€40/month) has no model in WeDance. Today a
  course would be 8 loose events. 🆕 `course` = series + enrolment + Stripe subscription.
- **Invoices.** Paid classes need §19 UStG receipts with sequential numbers
  (`~/Orgs/MontunoClub/ops/payments-and-invoicing.md`). WeDance doesn't issue receipts. Until it
  does, MCP money tools stay read-only.

Both gaps are product work, not MCP work. They belong in their own tickets.

## Resources & prompts
- Resources: `wedance://city/{slug}/events`, `wedance://event/{id}`, `wedance://profile/{handle}`
- Prompts (one-click workflows in the client):
  - `plan_my_weekend(city)`
  - `promote_my_event(event)`: create → flyer → captions → post plan
  - `weekly_class_update(profile)`: next week's series → exceptions → flyer → announcement
  - `prepare_festival_trip(festival)`: ticket → ride → roommate → who's going

## Phases

| Phase | Scope | Exit criterion |
|---|---|---|
| **P0 Auth** | OAuth AS, scopes in context, consent + profile picker, connections page, audit, rate limits | Claude.ai custom connector completes login and calls `me` |
| **P1 Public + dancers** | Everyone + dancer tools, prompts `plan_my_weekend` / `prepare_festival_trip` | Submitted to the Claude connector directory and ChatGPT Apps |
| **P2 Organizers + Montuno dogfood** | Organizer tools, `recurring_series`, `attendees`, `admin` client for Alex's agents | Montuno's Sunday classes and one campaign run end to end through MCP for 2 weeks |
| **P3 Artists + promoters** | Artist + promoter tools, `apply_to_gig`, tracked links, `my_results` | One guest-teacher invite and one promoter campaign through MCP |
| **P4 Influencers** | Influencer flag, `promo_kit`, `propose_giveaway` | One influencer posts from a kit; attribution visible |
| Later | Courses + receipts (product), `message_attendees` | Separate tickets |

## Decisions (Commander, decided 2026-10-18)

All four recommendations were approved as proposed:

1. **Own OAuth server instead of WorkOS/Clerk** (keeps one identity system). **Decided: yes.**
2. **Influencer = promoter flavour, not a new profile type.** **Decided: yes.**
3. **Waves and other person-to-person social tools stay out of MCP v1.** **Decided: yes.**
4. **`admin` scope only for `isAdmin` users and an allowlisted client** (Alex's own agents; env
   `MCP_ADMIN_CLIENT_IDS`). It replaces prod-env DB scripts such as `sync-v3-events.ts` over time.
   **Decided: yes.**

## Implementation notes (phase 1 PR)

- Phase 1 ships P0 (auth) and every ✅ tool. The 🆕 procedures (`recurring_series`, `attendees`,
  `apply_to_gig`, tracked links, `promo_kit`, influencer flag, `propose_giveaway`) follow in a
  second PR; courses, receipts and `message_attendees` stay out of scope.
- Where the router reality differs from the quick scan above, the tools follow the code. The
  mapping table and every deviation are in the PR and on `/docs/mcp` (generated from
  `server/mcp/tools.ts`).
- Anonymous access lives at `/mcp/public`; `/mcp` always answers 401 without a token, which is
  what makes Claude and ChatGPT start the OAuth login.
- MCP elicitation for publish confirmations is not used yet: the server is stateless, so every
  `business:publish` tool runs preview → `confirm_token` → commit.
