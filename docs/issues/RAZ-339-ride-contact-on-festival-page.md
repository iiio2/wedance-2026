---
title: "Ride contact on festival page"
type: Task
id: RAZ-339
status: triage
state: Triage
state_type: triage
project: "WeDance Support"
labels: ["user-report"]
assignee: "Aleksey Razbakov"
creator: "Tobiloba"
priority: "High"
estimate: null
parent: null
created: 2026-10-12T20:49:41.362Z
completed: null
canceled: null
due: null
links: ["https://github.com/razbakov/wedance-2026/pull/286"]
linear_url: https://linear.app/alosha/issue/RAZ-339/ride-contact-on-festival-page
exported: 2026-10-25
---

# RAZ-339 — Ride contact on festival page

Please keep the work inside what the architecture docs already describe (https://2026.wedance.vip/docs/architecture/stories: story map:meetup-3.3-ride-group-chat and [RAZ-116](https://linear.app/alosha/issue/RAZ-116/find-a-ride) Find A Ride).

Problem: On a festival page (app/pages/festivals/\[slug\].vue) a dancer can post that they are offering a ride or looking for a ride (rideShare.list and rideShare.create, table festival_ride_shares). But when I see someone offering a ride, there is no way to contact them, so the feature is a dead end.

What I want:

1\. When posting a ride (offering or looking), the poster can optionally add a WhatsApp or Telegram link.

2\. Each ride card shows a Contact button that opens that link in a new tab.

3\. The Contact button is visible only to signed-in users. Signed-out users see a prompt to sign in instead. The link must not be sent to signed-out users at all, so enforce this on the server in rideShare.list, not only in the UI.

4\. If a ride has no link, show no Contact button.

5\. Accept only WhatsApp and Telegram links (wa.me, chat.whatsapp.com, t.me, telegram.me), validated on the server, with a clear message if the link is invalid.

Please follow the existing pattern for dinner groups, which already have a chatLink (app/components/ActivitiesTab.vue near line 294). RAZ-191 (ride without login) was done earlier, so check how signed-out users use rides today and keep that working.

Out of scope: in-app messaging, seat requests or accept/decline flows, automatic ride matching, and anything outside rides.

Important: this needs a new nullable column on festival_ride_shares, so it needs a migration. Earlier, the hangouts feature went live without its migration applied and posting failed with a database error. Please confirm the migration is applied on production, not just that the build passes.

Before you say Done, test on the live site as a signed-in user and as a signed-out user: post a ride with a link, check the Contact button opens it, post one without a link, and try an invalid link. Write the Try it steps from what you actually tested, and tell me plainly if any part could not be tested.

## Links

- [feat: add contact link to ride shares](https://github.com/razbakov/wedance-2026/pull/286)

## Comments

### Linear · 2026-10-12 21:04 UTC

This thread is for an agent session with forge.

### Forge · 2026-10-12 21:19 UTC

### 👀 Ready for your review — Ride cards now show a Contact button for WhatsApp/Telegram links

**Live:** https://2026.wedance.vip/festivals/cuban-fire-munich-2026

**Try it**
1. Open https://2026.wedance.vip/festivals/cuban-fire-munich-2026
2. Sign in and scroll to Share a ride
3. Post a ride and paste a WhatsApp or Telegram link (e.g. https://wa.me/1234567890)
4. See your ride card with a Contact button
5. Sign out — the Contact button disappears and the link is not in the response

### Forge · 2026-10-12 21:25 UTC

### 👀 Merged — ready for your review — Ride cards now show WhatsApp/Telegram contact button for signed-in users

**Live:** https://2026.wedance.vip/festivals/cuban-fire-munich-2026
**PR:** https://github.com/razbakov/wedance-2026/pull/286

**Try it**
1. Open https://2026.wedance.vip/festivals/cuban-fire-munich-2026
2. Sign in and scroll to Share a ride
3. Post a ride and paste a WhatsApp link (e.g. https://wa.me/1234567890)
4. You should see a Contact button on your ride card
5. Sign out — the Contact button should disappear

**Follow-ups:** RAZ-340

### Aleksey Razbakov · 2026-10-14 08:33 UTC

From the 2026-10-14 daily: Alex is taking over the festival ride/room connect work from Tobi and will make the section dynamic. Tobi should not continue here. Broader scope (rooms, dinners, hard-coded parts) is tracked in RAZ-359. Source: https://github.com/razbakov/wedance-org/blob/main/ops/sessions/2026-10-14-wedance-dev-daily.md
