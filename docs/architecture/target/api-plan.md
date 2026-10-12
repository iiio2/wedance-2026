---
id: TARGET-API
title: Target API plan
status: proposed
date: 2026-10-12
summary: The target tRPC procedure catalogue by context, mapped to stories and to today's procedures, plus the stories with no procedure and the procedures with no story.
---

The catalogue below applies the conventions of
[ADR-011](/architecture/decisions/011-api-conventions) to the target data model
([data-model](/architecture/decisions/data-model)). Every one of today's 114 public
procedures appears in the **Today** column of exactly one row (or in the
"Removed" lists); the 13 admin procedures are summarised without names, as ADR-000
requires for public docs (the names are on /architecture/api/admin).

**Auth tiers:** `public` · `authed` (valid session) · `verified` (verified email,
ADR-003) · `member(roles)` (a `profile_members` role on the profile in the input,
ADR-004) · `admin`. `+RL` = rate-limited.
**Status:** `exists` (kept as is) · `rename` · `change` (shape or behaviour) ·
`new` · `remove`. **Paged** inputs take `{ cursor?, limit? }` and return
`{ items, nextCursor }`.

## identity

| Target | Kind | Auth | Input → output | Stories | Today · status |
|---|---|---|---|---|---|
| identity.requestLink | mutation | public +RL | `{ email, purpose: login or reset, signup? }` → `{ sent }` | RAZ-241, map:meetup-2.1-sign-up | auth.requestMagicLink · change (never writes `dancers`, hashed token) |
| identity.consumeLink | mutation | public +RL | `{ token }` → `Session` (sets HttpOnly cookie) | RAZ-241, map:meetup-2.1-sign-up | auth.verifyMagicLink · change |
| identity.resetPassword | mutation | public +RL | `{ token, newPassword }` → `Session` | RAZ-241 | auth.resetPassword · change (purpose-bound, revokes sessions) |
| identity.signIn | mutation | public +RL | `{ email, password }` → `Session` | map:meetup-2.1-sign-up | auth.login · rename |
| identity.register | mutation | public +RL | `{ name, email, password, styles, partnerRole?, cityId? }` → `Session` + verify email | map:meetup-2.1-sign-up | auth.register · change |
| identity.verifyEmail | mutation | public | `{ token }` → `{ verified }` | RAZ-83, map:meetup-2.1-sign-up | — · new |
| identity.signOut | mutation | authed | `{}` → `{ ok }` (revokes session) | map:meetup-2.1-sign-up | — · new |
| identity.changePassword | mutation | authed +RL | `{ currentPassword, newPassword }` → `{ ok }` | none (see below) | auth.changePassword · change (revokes other sessions) |
| identity.me | query | public | `{}` → `Me or null` | map:meetup-2.1-sign-up | auth.me · rename |
| identity.completeOnboarding | mutation | authed | `{ intent, cityId?, styles?, partnerRole? }` → `{ ok }` | RAZ-29, map:meetup-2.1-sign-up | auth.completeOnboarding · change (`cityId`) |
| identity.deleteAccount | mutation | authed | `{}` → `{ deleted }` | RAZ-155 | auth.deleteAccount · change (FK rules do the work) |

## dancers

| Target | Kind | Auth | Input → output | Stories | Today · status |
|---|---|---|---|---|---|
| dancers.getByHandle | query | public | `{ handle }` → `DancerPublic` (+ approved videos) | RAZ-154 | profile.getByUsername · rename |
| dancers.updateMe | mutation | authed | partial `{ name, cityId, styles: [{ key, level }], partnerRole, photoUrl, bio, socials, profilePublic }` → `{ ok }` | RAZ-249, RAZ-275 | profile.update · change |

## profiles

| Target | Kind | Auth | Input → output | Stories | Today · status |
|---|---|---|---|---|---|
| profiles.getByHandle | query | public | `{ handle }` → `Profile` + spaces + lineup roles | RAZ-66, RAZ-303, RAZ-253, RAZ-135, RAZ-159 | entity.getByHandle · rename |
| profiles.list | query | public | paged `{ type, cityId?, roles?, styles?, amenities?, q? }` → `ProfileCard[]` | RAZ-50, RAZ-58, RAZ-64, RAZ-66, RAZ-303, RAZ-45, RAZ-129, RAZ-302 | entity.listArtists, entity.listVenues, entity.listByCity · change (merged, paged, filtered) |
| profiles.update | mutation | member(owner, editor) | `{ profileId, …fields }` → `{ ok }` | RAZ-303, RAZ-159 | — · new |
| profiles.claim | mutation | verified +RL | `{ profileId, evidence }` → `{ claimId }` | RAZ-253, RAZ-129 | — · new |
| profiles.members.list | query | member(owner) | `{ profileId }` → `Member[]` | RAZ-129, RAZ-158 | — · new |
| profiles.members.invite | mutation | member(owner) | `{ profileId, email, role }` → `{ ok }` | RAZ-129, RAZ-158 | — · new |
| profiles.members.remove | mutation | member(owner) | `{ profileId, dancerId, role }` → `{ ok }` | RAZ-129 | — · new |
| profiles.affiliations.set | mutation | member(owner, editor) | `{ artistProfileId, organizerProfileId, kind }` → `{ ok }` | RAZ-66 | — · new |
| profiles.follow | mutation | authed | `{ profileId }` → `{ following: true }` | RAZ-55 | follow.toggle · change (idempotent pair) |
| profiles.unfollow | mutation | authed | `{ profileId }` → `{ following: false }` | RAZ-55 | follow.toggle · change |
| profiles.followState | query | public | `{ profileId }` → `{ following: boolean or null, followers }` | RAZ-55 | follow.isFollowing, follow.count · change (merged) |
| profiles.myFollows | query | authed | paged `{}` → `ProfileCard[]` | RAZ-55 | follow.myFollows · rename |

## directory

| Target | Kind | Auth | Input → output | Stories | Today · status |
|---|---|---|---|---|---|
| directory.cities.list | query | public | paged `{}` → `CityCard[]` (counts, hero image) | RAZ-139, RAZ-47 | entity.listCities, `GET /api/cities` · change (one source) |
| directory.cities.get | query | public | `{ slug }` → `City` + directory counts | RAZ-45, RAZ-168, RAZ-169 | entity.cityDirectory, `GET /api/cities/:slug` · change |
| directory.cities.search | query | public +RL | `{ q, session }` → `CitySuggestion[]` | RAZ-85, RAZ-29 | `GET /api/city-search` · change (REST → tRPC) |
| directory.cities.resolve | mutation | public +RL | `{ placeId, session, query? }` → `City` | RAZ-85, RAZ-29 | `POST /api/city-resolve` · change |
| directory.cities.options | query | public | `{}` → `CityOption[]` | RAZ-85 | `GET /api/city-options` · change |
| directory.styles.list | query | public | `{}` → `DanceStyle[]` | RAZ-25, RAZ-26, RAZ-27, RAZ-303 | — · new |
| directory.communityGroups.list | query | public | `{ cityId }` → `CommunityGroup[]` | RAZ-156 | communityGroup.listByCity · rename |
| directory.communityGroups.report | mutation | authed +RL | `{ groupId }` → `{ hidden }` | RAZ-156 | communityGroup.report · change (TRPCError codes) |

## events

| Target | Kind | Auth | Input → output | Stories | Today · status |
|---|---|---|---|---|---|
| events.list | query | public | paged `{ cityId, from, to, kinds?, styles?, freeOnly? }` → `EventCard[]` | RAZ-28, RAZ-30, RAZ-71, RAZ-162, RAZ-168, RAZ-251, RAZ-29, RAZ-108, RAZ-113 | events.byCity, booking.upcomingByCity · change (one table, no pending bookings) |
| events.get | query | public | `{ id or slug }` → `Event` (+ lineup, festival details) | RAZ-251, RAZ-304, RAZ-158 | events.get, booking.getEvent · change (merged) |
| events.byProfile | query | public | paged `{ profileId, from, to }` → `EventCard[]` | RAZ-55, RAZ-161, RAZ-253, RAZ-158 | events.byProfile, booking.scheduleForProfile · change (FK, no requester data) |
| events.create | mutation | member(owner, editor) | `{ organizerProfileId, kind, title, startsAt, endsAt, timezone, venueProfileId?, styles, price… }` → `{ id, slug }` | RAZ-126, RAZ-33 | — · new |
| events.update | mutation | member(owner, editor) | `{ eventId, …fields }` → `{ ok }` | RAZ-126 | — · new |
| events.cancel | mutation | member(owner, editor) | `{ eventId, reason? }` → `{ ok }` | RAZ-126 | — · new |
| events.series.upsert | mutation | member(owner, editor) | `{ seriesId?, rrule, timezone, defaults… }` → `{ seriesId }` | RAZ-126, RAZ-108 | — · new |

## festivals

| Target | Kind | Auth | Input → output | Stories | Today · status |
|---|---|---|---|---|---|
| festivals.list | query | public | paged `{ from?, styles?, q? }` → `FestivalCard[]` with going/verified counts | RAZ-105, RAZ-131, RAZ-32, RAZ-56, RAZ-88 | `GET /api/festivals` · change (REST → tRPC via SSR caller) |
| festivals.get | query | public | `{ slug }` → `Festival` (details, lineup, ticket types) | RAZ-105, RAZ-83, RAZ-36, RAZ-54 | festival.bySlug, `GET /api/festivals/:slug` · change |
| festivals.programme | query | public | `{ eventId, style?, level? }` → `Session[]` with artists | RAZ-36, RAZ-54, RAZ-97 | — · new (was `app/data/mock-*.ts`) |
| festivals.programme.upsertSession | mutation | member(owner, editor) | `{ eventId, session }` → `{ sessionId }` | RAZ-36, RAZ-141 | — · new |
| festivals.submitDraft | mutation | public +RL | `{ slug?, name?, email?, payload (bounded) }` → `{ id }` | RAZ-95, RAZ-112, RAZ-117, RAZ-122, RAZ-126, RAZ-141 | festival.submitDraft · change |
| festivals.suggestions | query | public | `{ limit }` → `FestivalCard[]` (people-you-met first when signed in) | RAZ-38, map:meetup-8.3-next-festival-invite | plan.suggestions · change |

## ticketing

| Target | Kind | Auth | Input → output | Stories | Today · status |
|---|---|---|---|---|---|
| ticketing.ticketTypes.list | query | public | `{ eventId }` → `TicketType[]` with remaining capacity | RAZ-69, RAZ-149, RAZ-110 | — · new (was `ticket-prices.ts`) |
| ticketing.ticketTypes.upsert | mutation | member(owner, editor) | `{ eventId, ticketType }` → `{ id }` | RAZ-33, RAZ-144 | — · new |
| ticketing.checkout | mutation | authed +RL | `{ eventId, items: [{ ticketTypeId, quantity }], referralCode?, idempotencyKey }` → `{ orderId, checkoutUrl or null, discountCents }` | RAZ-23, RAZ-110, RAZ-130, map:meetup-2.2-free-spot-counter, map:meetup-2.3-social-paywall | festivalSignup.ticketCheckout, festivalSignup.createCheckoutSession, festivalSignup.join · change (one checkout; free passes are 0-cent ticket types) |
| ticketing.availability | query | public | `{ eventId }` → `{ ticketTypes: [{ id, remaining }], mine?: { attendance, orderStatus } }` | map:meetup-2.2-free-spot-counter, RAZ-110, RAZ-248 | festivalSignup.status · change |
| ticketing.myOrders | query | authed | paged `{}` → `Order[]` | RAZ-99, RAZ-110 | festivalSignup.myTickets · change (orders, any provider) |
| ticketing.order | query | authed | `{ orderId }` → `Order` | RAZ-246 | — · new (confirmation from the server, not sessionStorage) |
| ticketing.referrals.validate | query | public +RL | `{ eventId, code }` → `{ referrerName, discountPercent } or null` | RAZ-23 | referral.validate · rename |
| ticketing.referrals.mine | query | authed | `{ eventId? }` → `{ referrals, availableCreditCents }` | RAZ-23 | referral.myReferrals · change (authed tier) |

## attendance

| Target | Kind | Auth | Input → output | Stories | Today · status |
|---|---|---|---|---|---|
| attendance.set | mutation | authed | `{ eventId, status: interested or going or none }` → `Attendance` | RAZ-136, RAZ-154, RAZ-125, RAZ-71, RAZ-38, RAZ-127 | plan.add, plan.remove (festival/event rows) · change |
| attendance.mine | query | authed | `{ eventId }` → `Attendance or null` | RAZ-115, RAZ-83 | plan.getShareGoing, festivalSignup.getMyVisibility · change (merged) |
| attendance.setVisibility | mutation | authed | `{ eventId, visibility }` → `{ visibility }` | RAZ-115, RAZ-34, RAZ-83 | plan.setShareGoing, festivalSignup.setMyVisibility · change (merged) |
| attendance.updateLogistics | mutation | authed | `{ eventId, partnerStatus?, travelBooked?, stayBooked?, vacationBooked? }` → `{ ok }` | RAZ-80, RAZ-75, RAZ-102, RAZ-128, RAZ-104 | — · new (was localStorage) |
| attendance.publicList | query | public | paged `{ eventId, limit ≤ 50 }` → `{ attendees: [{ handle, name, city, photo?, verified }], counts: { going, verified, hidden } }` | RAZ-62, RAZ-86, RAZ-34, RAZ-115, RAZ-83, RAZ-304, RAZ-82 | plan.goingList, festivalSignup.publicRoster · change (one public rule) |
| attendance.counts | query | public | `{ eventIds ≤ 100 }` → `Record<eventId, { going, verified, faces ≤ 10 }>` | RAZ-71, RAZ-86, RAZ-133 | plan.count, plan.countBatch, plan.goingBatch · change (merged) |
| attendance.proofShowcase | query | public | `{}` → `Showcase or null` (verified first) | RAZ-77, RAZ-83 | plan.proofShowcase · change |
| attendance.claimTickets | mutation | verified | `{}` → `{ claimed, events }` | RAZ-83 | claim.claimMyTicketHolderRows · change (verified email required) |
| — | | | | | claim.getClaimStatus · **remove** (tells anyone whether an email holds a ticket, ADR-003; the claim page asks the signed-in, verified user) |
| attendance.checkIn | mutation | member(owner, editor) | `{ eventId, attendanceId }` → `{ checkedInAt }` | map:meetup-1.7-activity-check-in, RAZ-96 | — · new |

## plans

| Target | Kind | Auth | Input → output | Stories | Today · status |
|---|---|---|---|---|---|
| plans.mine | query | authed | `{ year? }` → `Plan { attendances (event, ticket state, early bird), sessionPicks, enrolments, goals }` | RAZ-52, RAZ-70, RAZ-80, RAZ-88, RAZ-94, RAZ-123, RAZ-133, RAZ-140, RAZ-144, RAZ-147, RAZ-154, RAZ-38, RAZ-97, RAZ-136, RAZ-36, RAZ-91, RAZ-108, RAZ-113, map:schedule-compare-with-friends | plan.myPlan, plan.list, plan.listDetailed · change (merged, typed) |
| plans.shared | query | public | `{ handle }` → `SharedPlan` (visible attendances only) | RAZ-23, RAZ-48, RAZ-52, RAZ-154 | plan.sharedPlan · change |
| plans.pickSession | mutation | authed | `{ sessionId }` → `{ ok }` | RAZ-97, RAZ-36, RAZ-54 | plan.add (workshop) · change |
| plans.unpickSession | mutation | authed | `{ sessionId }` → `{ ok }` | RAZ-97, RAZ-36 | plan.remove (workshop) · change |
| plans.enrol | mutation | authed | `{ seriesId }` → `{ ok }` | RAZ-108, RAZ-113, RAZ-29 | plan.add (event + class metadata) · change |
| plans.unenrol | mutation | authed | `{ seriesId }` → `{ ok }` | RAZ-108 | plan.remove · change |
| plans.goals.upsert | mutation | authed | `{ goalId?, kind, title, target, periodYear }` → `{ goalId }` | RAZ-91 | plan.add (goal), plan.updateMetadata · change |
| plans.goals.delete | mutation | authed | `{ goalId }` → `{ ok }` | RAZ-91 | plan.remove (goal) · change |
| plans.discover | query | authed | `{}` → `DiscoverCard[]` (visible attendances only) | RAZ-127 | plan.discover · change (privacy fix, `city_id`) |

## social

| Target | Kind | Auth | Input → output | Stories | Today · status |
|---|---|---|---|---|---|
| social.waves.send | mutation | authed | `{ eventId, toDancerId }` → `{ mutual }` | RAZ-67, RAZ-82, RAZ-102, RAZ-61, RAZ-65 | wave.send · change (event id; both must attend visibly) |
| social.waves.retract | mutation | authed | `{ eventId, toDancerId }` → `{ ok }` | RAZ-65 | wave.retract · change |
| social.waves.mine | query | authed | `{ eventId }` → `{ sent, received, unanswered }` | RAZ-65, RAZ-82 | wave.myWaves, wave.wavesForMe, wave.incomingCount · change (merged) |
| social.waves.friends | query | authed | `{ eventId }` → `DancerCard[]` | RAZ-67, RAZ-82, RAZ-61, RAZ-65 | wave.friends · change |
| social.waves.pool | query | authed | paged `{ eventId, partnerRole?, lookingForPartner? }` → `DancerCard[]` | RAZ-67, RAZ-82, RAZ-102, RAZ-61, RAZ-65, RAZ-124 | wave.discoverPool · change (lead/follow and "looking" filters) |
| social.rides.list | query | public | `{ eventId }` → `Ride[]` (public rule) | RAZ-67, RAZ-116, map:meetup-1.2-activity-cards | rideShare.list · change |
| social.rides.upsert | mutation | authed | `{ eventId, type, originCityId, departsOn, seats?, chatUrl? }` → `{ ok }` | RAZ-67, RAZ-116, map:meetup-3.3-ride-group-chat | rideShare.create · change |
| social.rides.delete | mutation | authed | `{ eventId }` → `{ ok }` | RAZ-116 | rideShare.delete · rename |
| social.rooms.list | query | public | `{ eventId }` → `RoomRequest[]` (public rule) | RAZ-121, map:meetup-1.2-activity-cards | roommate.list · change |
| social.rooms.upsert | mutation | authed | `{ eventId, checkIn?, checkOut?, budgetCents?, notes? }` → `{ ok }` | RAZ-121 | roommate.toggle · change (no toggle) |
| social.rooms.delete | mutation | authed | `{ eventId }` → `{ ok }` | RAZ-121 | roommate.toggle · change |
| social.dinners.list | query | public | `{ eventId }` → `Dinner[]` (one query) | RAZ-67, map:meetup-1.2-activity-cards, map:meetup-5.1-dinner-sign-up, map:meetup-5.3-dinner-chat-link, map:meetup-5.4-restaurant-reveal | dinner.list · change |
| social.dinners.join | mutation | authed | `{ dinnerId }` → `{ joined }` | RAZ-67, map:meetup-5.1-dinner-sign-up | dinner.join · change (atomic capacity) |
| social.dinners.leave | mutation | authed | `{ dinnerId }` → `{ ok }` | map:meetup-5.1-dinner-sign-up | dinner.leave · rename |
| social.hangouts.list | query | public | `{ cityId }` → `Hangout[]` (derived counts) | RAZ-118 | hangouts.listTonight · change |
| social.hangouts.create | mutation | authed +RL | `{ kind, title, startsAt, venue?, cityId }` → `Hangout` | RAZ-118 | hangouts.create · change |
| social.hangouts.rsvp | mutation | authed | `{ hangoutId }` → `{ ok }` | RAZ-118 | hangouts.toggleRsvp · change |
| social.hangouts.unrsvp | mutation | authed | `{ hangoutId }` → `{ ok }` | RAZ-118 | hangouts.toggleRsvp · change |
| social.hangouts.close | mutation | authed (owner) | `{ hangoutId }` → `{ ok }` | RAZ-118 | hangouts.close · rename |

## booking

| Target | Kind | Auth | Input → output | Stories | Today · status |
|---|---|---|---|---|---|
| booking.spaces.availability | query | public | `{ profileId }` → `Slot[]` | RAZ-135, RAZ-158 | booking.availabilityForProfile · rename |
| booking.spaces.setAvailability | mutation | member(owner, editor, moderator) | `{ spaceId, slots }` → `{ ok }` | RAZ-158 | booking.setAvailability · change (works: `withTx`, membership) |
| booking.requests.create | mutation | public +RL | `{ spaceId, email, name?, title?, kind?, styles?, artistNames?, organizerProfileId?, startsAt, endsAt?, headcount?, message?, ticketUrl?, termsAccepted }` → `{ id }` | RAZ-129, RAZ-135, RAZ-142, RAZ-158, RAZ-159, RAZ-160 | booking.request · change (venue notified) |
| booking.requests.listForProfile | query | member(owner, editor, moderator) | paged `{ profileId, status? }` → `BookingRequest[]` | RAZ-152, RAZ-166, RAZ-129, RAZ-158 | election.pendingBookings · change (also commercial venues) |
| booking.requests.decide | mutation | member(owner, editor, moderator) | `{ bookingId, action: accept or decline, note? }` → `{ eventId? }` | RAZ-152, RAZ-166, RAZ-129, RAZ-158 | election.moderateBooking · change (accept creates the event) |
| booking.requests.mine | query | authed | paged `{}` → `BookingRequest[]` | RAZ-135 | — · new |
| booking.requests.withdraw | mutation | authed | `{ bookingId }` → `{ ok }` | RAZ-142 | — · new |

## governance

| Target | Kind | Auth | Input → output | Stories | Today · status |
|---|---|---|---|---|---|
| governance.elections.forProfile | query | public | `{ profileId }` → `Election` + candidates + ledger | RAZ-152, RAZ-164, RAZ-165 | election.forProfile · rename |
| governance.elections.myVote | query | authed | `{ electionId }` → `MyVote` | RAZ-152, RAZ-165 | election.myVote · rename |
| governance.elections.open | mutation | member(moderator) or admin | `{ profileId, termStart? }` → `{ electionId }` | RAZ-152, RAZ-163 | election.open · change (membership auth) |
| governance.elections.nominate | mutation | verified | `{ electionId, guidelines, statement? }` → `{ candidateId }` | RAZ-152, RAZ-163, RAZ-164 | election.nominate · change (verified email, not "has a username") |
| governance.elections.advance | mutation | member(moderator) or admin | `{ electionId }` → `{ ok }` | RAZ-152, RAZ-163 | election.advanceToVoting · rename |
| governance.elections.castVote | mutation | verified | `{ electionId, candidateId }` → `{ changed }` | RAZ-152, RAZ-165 | election.castVote · change (atomic) |
| governance.elections.close | mutation | member(moderator) or admin | `{ electionId }` → `{ winnerCandidateId, votes }` | RAZ-152, RAZ-163, RAZ-165 | election.close · change (one transaction; grants moderator membership) |
| governance.guidelines.history | query | public | `{ profileId }` → `GuidelineVersion[]` | RAZ-166 | election.guidelineHistory · rename |

## community

| Target | Kind | Auth | Input → output | Stories | Today · status |
|---|---|---|---|---|---|
| community.reviews.list | query | public | paged `{ eventId or profileId }` → `{ items, average, count }` | map:meetup-8.1-rate-festival, RAZ-89, RAZ-157 | review.list · change (FK target) |
| community.reviews.upsert | mutation | authed | `{ eventId or profileId, rating, text? }` → `{ ok }` | map:meetup-8.1-rate-festival, RAZ-89 | review.create · change |
| community.askLocals.list | query | public | `{ cityId }` → `Question[]` | RAZ-157, map:meetup-9.1-local-tips | askLocals.listByCity · rename |
| community.askLocals.ask | mutation | authed +RL | `{ cityId, question }` → `{ id }` | RAZ-157, map:meetup-9.1-local-tips | askLocals.ask · rename |
| community.askLocals.recommend | mutation | authed +RL | `{ requestId?, cityId, profileId or newPlace }` → `{ profileId }` | RAZ-157, map:meetup-9.1-local-tips | askLocals.recommend · change (stub profile, FK review) |
| community.videos.list | query | public | `{ cityId, month? }` → `Video[]` | none (see below) | cityVideo.listApproved · rename |
| community.videos.monthWinner | query | public | `{ cityId, month? }` → `Video or null` | none | cityVideo.monthWinner · rename |
| community.videos.pair | query | public | `{ cityId }` → `[Video, Video] or null` | none | cityVideo.getPair · rename |
| community.videos.vote | mutation | public +RL | `{ cityId, winnerId, loserId }` → `{ recorded }` | none | cityVideo.vote · change (atomic ELO) |
| community.videos.submit | mutation | public +RL | `{ cityId, title, url, style?, email }` → `{ id }` | none | cityVideo.submit · change |
| — | | | | | cityVideo.battleMatchup, cityVideo.battleVote, cityVideo.cityLeaderboard · **remove** (see below) |
| — | | | | | giveaway.listActive, giveaway.enter · **remove** unless confirmed (see below) |

## opportunities

| Target | Kind | Auth | Input → output | Stories | Today · status |
|---|---|---|---|---|---|
| opportunities.gigs.list | query | public | paged `{ kind?, category?, cityId?, remote? }` → `GigCard[]` (no contact email) | RAZ-40, RAZ-41, RAZ-42, RAZ-43, RAZ-145, RAZ-148 | gigs.list · change |
| opportunities.gigs.get | query | public | `{ id }` → `Gig` | RAZ-41 | gigs.getById · rename |
| opportunities.gigs.create | mutation | authed +RL | `{ kind, category, title, posterProfileId?, posterName, cityId?, remote, startsOn?, endsOn?, whenNote?, compensation, deadline?, contactEmail }` → `{ id }` | RAZ-42, RAZ-43, RAZ-145, RAZ-148 | gigs.create · change |
| opportunities.gigs.close | mutation | authed (owner) | `{ id }` → `{ ok }` | RAZ-42 | gigs.close · exists (wire the UI) |
| opportunities.gigs.apply | mutation | public +RL | `{ gigId, message, email?, name? }` → `{ id }` | RAZ-41 | — · new (stored + emailed to the poster) |
| opportunities.gigs.applications | query | authed (owner) | `{ gigId }` → `Application[]` | RAZ-42 | — · new |

## inbound

| Target | Kind | Auth | Input → output | Stories | Today · status |
|---|---|---|---|---|---|
| inbound.inquiry | mutation | public +RL | `{ eventType?, date?, city?, guests?, needs, name?, email }` → `{ id }` | RAZ-57, RAZ-63, RAZ-68, RAZ-73, RAZ-78, RAZ-81, RAZ-90, RAZ-96, RAZ-101, RAZ-107, RAZ-114, RAZ-138, RAZ-143 | feedback.inquiry · change (stored, outbox to Linear) |
| inbound.report | mutation | public +RL | `{ description, email?, context, screenshotUrl? }` → `{ id }` | RAZ-272 | feedback.report · change (stored; screenshot uploaded separately) |

## organizer

| Target | Kind | Auth | Input → output | Stories | Today · status |
|---|---|---|---|---|---|
| organizer.myEvents | query | authed | `{}` → events the caller manages via memberships | RAZ-79, RAZ-150 | festivalInsights.myFestivals · change |
| organizer.insights.styleLevelMix | query | member(owner, editor) | `{ eventId }` → `Mix` | RAZ-79, RAZ-150 | festivalInsights.styleLevelMix · change (attendances) |
| organizer.insights.workshopDemand | query | member(owner, editor) | `{ eventId }` → `[{ sessionId, picks }]` | RAZ-74, RAZ-150 | — · new |
| organizer.insights.geography | query | member(owner, editor) | `{ eventId }` → `[{ cityId, count }]` | RAZ-85, RAZ-150 | — · new |
| organizer.insights.signal | query | member(owner, editor) | `{ eventId }` → reviews summary + waves made | RAZ-89, RAZ-150, map:meetup-8.2-festival-recap | — · new |

## admin

The 13 existing admin procedures keep their behaviour and move into two
sub-routers (names withheld here):

- **`admin.dinners.*`** — the 7 procedures behind festival dinner management
  (festival list, dinner list and sign-ups, group assignment and listing, chat
  links, restaurant reveal). Stories: map:meetup-5.2-dinner-group-assignment,
  map:meetup-5.3-dinner-chat-link, map:meetup-5.4-restaurant-reveal, RAZ-170.
- **`admin.content.*`** — the 6 procedures for video moderation, giveaways and
  community-group curation. Story: RAZ-170. The giveaway pair goes if the public
  giveaway procedures go.

New admin procedures: `admin.festivals.onboard` (submission → listing, RAZ-95,
RAZ-112, RAZ-170), `admin.claims.list` / `admin.claims.decide` (ADR-004),
`admin.inbound.list` / `admin.inbound.update` (ADR-010).

## REST (target)

| Endpoint | Purpose | Status |
|---|---|---|
| `POST /api/webhooks/stripe` | Stripe events → `webhook_events` ledger → orders | change (moved from `/api/stripe/webhook`) |
| `POST /api/webhooks/tickettailor` | TicketTailor orders → orders | change (ledger, DB mapping) |
| `POST /api/media/image` | authed image upload, 5 MB, image types only | change (RAZ-288) |
| `GET /api/cron/deliveries`, `/api/cron/series`, `/api/cron/cleanup` | outbox, series materialisation, token/rate-limit purge (`CRON_SECRET`) | new |
| `GET /api/v1/public/events/:id/embed`, `GET /api/v1/public/profiles/:handle/events.ics` | organiser widget, calendar feeds | new (map:meetup-1.8-organizer-embed-widget, RAZ-104) |
| `GET /api/architecture/admin` | generated admin docs | exists |
| `ANY /api/trpc/:trpc` | tRPC | exists |
| `GET /api/cities`, `/api/cities/:slug`, `/api/festivals`, `/api/festivals/:slug`, `/api/city-*` | | remove (SSR caller and `directory.*`) |

## Stories with no procedure

**Need none** — landing copy, client-only explainers or static links that are
built: RAZ-25, RAZ-26, RAZ-27, RAZ-30, RAZ-31, RAZ-35, RAZ-37, RAZ-44, RAZ-46,
RAZ-49, RAZ-51, RAZ-53, RAZ-56, RAZ-60, RAZ-72, RAZ-76, RAZ-87, RAZ-92, RAZ-93,
RAZ-98, RAZ-103, RAZ-109, RAZ-111, RAZ-119, RAZ-120, RAZ-134, RAZ-137, RAZ-146.
RAZ-153 is a one-off migration script; RAZ-247 is served by the Stripe webhook.

**Served today by REST, get a procedure:** RAZ-47, RAZ-139 → `directory.cities.list`;
RAZ-168, RAZ-169 → `directory.cities.get`; RAZ-32, RAZ-105, RAZ-131 →
`festivals.list` / `festivals.get`; RAZ-246 → `ticketing.order`.

**Partial or missing, covered by the target:** RAZ-75, RAZ-104, RAZ-128 →
`attendance.updateLogistics` (+ iCal feed for RAZ-104); RAZ-287 → `plans.enrol`
(payment later); RAZ-33 → `ticketing.ticketTypes.upsert`; RAZ-69, RAZ-149 →
`ticketing.ticketTypes.list`; RAZ-85 → `organizer.insights.geography`;
map:meetup-1.7-activity-check-in → `attendance.checkIn`;
map:meetup-1.8-organizer-embed-widget → `/api/v1/public/…/embed`;
map:meetup-3.3-ride-group-chat → `social.rides.upsert.chatUrl`;
map:meetup-8.2-festival-recap → `organizer.insights.signal`;
map:meetup-8.3-next-festival-invite → `festivals.suggestions`;
map:meetup-1.4-plan-ready-message → an email from the deliveries outbox when a plan
gains its first ticket (no procedure).

**Not in the target — need a product decision first:** RAZ-39, RAZ-100, RAZ-106
(organiser plans and billing); map:meetup-2.4-social-login (provider choice,
ADR-003 option 2); map:meetup-1.9-live-feed; map:meetup-3.4-auto-ride-matching;
map:meetup-6.4-taxi-dancer; map:meetup-7.1-extra-activities and
map:meetup-7.2-propose-activity (community-proposed activities could be
`programme_sessions` proposed by attendees); map:meetup-8.4-persistent-crew;
map:meetup-9.4-ambassador.

## Procedures with no story (the 16 unmapped)

| Procedure | Recommendation | Why |
|---|---|---|
| auth.changePassword | **keep** → `identity.changePassword`; add a story | used by /settings (`app/composables/useAuth.ts`) |
| cityVideo.listApproved | **keep** → `community.videos.list`; write the story | live on `/cities/[city]` (`app/pages/cities/[city]/index.vue`); 23 videos in production |
| cityVideo.monthWinner | **keep** → `community.videos.monthWinner` | `VideoOfMonthCard.vue` |
| cityVideo.getPair | **keep** → `community.videos.pair` | `CityVideoVote.vue` |
| cityVideo.vote | **keep** → `community.videos.vote` | `CityVideoVote.vue` (ELO fix, ADR-002) |
| cityVideo.submit | **keep** → `community.videos.submit` | `SubmitVideoForm.vue` |
| cityVideo.battleMatchup | **remove** | `CityFight.vue` on `/cities`; 3 battle votes ever (`city-canonicalisation.md:45`); a second ranking system with no story |
| cityVideo.battleVote | **remove** | as above |
| cityVideo.cityLeaderboard | **remove** | as above |
| giveaway.listActive | **remove** unless the Commander confirms a sponsor pipeline | 0 giveaways in production (`city-canonicalisation.md:40`), no story |
| giveaway.enter | **remove** (same condition) | as above |
| entity.listCities | **remove** (merged into `directory.cities.list`) | no UI caller; duplicates `/api/cities` |
| entity.cityDirectory | **remove** (merged into `directory.cities.get`) | no UI caller; duplicates `/api/cities/:slug` |
| gigs.getById | **keep** → `opportunities.gigs.get` | needed for gig detail and apply (RAZ-41) |
| gigs.close | **keep**, wire the UI | RAZ-42 notes: posters cannot close their gigs |
| referral.myReferrals | **keep** → `ticketing.referrals.mine` (authed) | shows referrer credit, part of RAZ-23 |

## Conventions (from ADR-011)

- Router per context; `context.verb` or `context.resource.verb`; no toggles.
- Auth tier is a middleware, never an `if` inside a public procedure.
- `TRPCError` only; SQLSTATE-based `dbError()`; zod issues returned as field errors.
- Bounded inputs; explicit output DTOs; no PII in public DTOs.
- Cursor pagination (`{ cursor, limit ≤ 100 }` → `{ items, nextCursor }`).
- Multi-statement writes in `withTx`; no N+1.
- Checkout idempotency key; webhooks through `webhook_events`.
- SSR through a server-side tRPC caller; REST only for webhooks, upload, cron and
  versioned public feeds (`/api/v1/public/…`).
- tRPC is unversioned (expand/contract per procedure); public REST is versioned in
  the path.
