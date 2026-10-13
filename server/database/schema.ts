import { pgTable, uuid, text, integer, boolean, timestamp, date, unique, index, json, jsonb, doublePrecision, uniqueIndex } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const dancers = pgTable('dancers', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  photo: text('photo'),
  danceStyles: json('dance_styles').$type<string[]>().default([]),
  // Self-declared level per style ({ Salsa: 'Advanced', Bachata: 'Beginner' }),
  // keys ⊆ danceStyles. Feeds the organizer "style & level mix" insight (P726).
  danceLevels: jsonb('dance_levels').$type<Record<string, string>>().notNull().default({}),
  role: text('role'),
  city: text('city'),
  neonAuthId: text('neon_auth_id').unique(),
  isAdmin: boolean('is_admin').default(false),
  // Public handle for the shareable profile URL (/u/<username>). Generated from
  // the name + a short random suffix at register, and backfilled on onboarding
  // for dancers created before this field existed. Nullable so legacy rows stay
  // valid until backfilled; unique so the URL is a stable identity.
  username: text('username').unique(),
  // Profile detail rendered on /u/<username>: a short bio + social links.
  bio: text('bio'),
  instagram: text('instagram'),
  youtube: text('youtube'),
  website: text('website'),
  // Privacy: when false the public profile is hidden from everyone but the
  // owner (getByUsername 404s for other viewers). Default public.
  profilePublic: boolean('profile_public').default(true),
  // Email + password auth (FirebaseScrypt, ported from wedance-v4). Empty string
  // default = "no password set" — a dancer created via magic-link/festival flow
  // has no credentials and cannot log in via password until they register one.
  salt: text('salt').default(''),
  hash: text('hash').default(''),
  // Onboarding: `intent` is the chosen persona key (e.g. 'social', 'festivals',
  // 'learn', 'perform', 'organize'); `onboardedAt` is set once the user finishes
  // (or skips) onboarding so we never nag them again. Both nullable — a dancer
  // created before onboarding existed, or via a stub flow, has neither set.
  intent: text('intent'),
  onboardedAt: timestamp('onboarded_at'),
  magicToken: text('magic_token'),
  magicTokenExpiresAt: timestamp('magic_token_expires_at'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const sessions = pgTable('sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id),
  token: text('token').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
})

export const festivals = pgTable('festivals', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  startDate: date('start_date'),
  endDate: date('end_date'),
  maxFreeSpots: integer('max_free_spots').notNull().default(10),
  stripePaymentLink: text('stripe_payment_link'),
  ticketUrl: text('ticket_url'),
  // Listing-page fields (RAZ-105: DB-driven festival directory).
  city: text('city'),
  country: text('country'),
  description: text('description'),
  styles: json('styles').$type<string[]>().default([]),
  logo: text('logo'),
  accentColor: text('accent_color'),
  earlyBirdDeadline: date('early_bird_deadline'),
  earlyBirdOfferName: text('early_bird_offer_name'),
})

export const festivalSignups = pgTable('festival_signups', {
  id: uuid('id').primaryKey().defaultRandom(),
  festivalId: uuid('festival_id').notNull().references(() => festivals.id),
  // dancerId nullable so we can stub a verified ticket holder before they sign in.
  // PR 4 (claim flow) links the dancer once the buyer authenticates via magic link.
  dancerId: uuid('dancer_id').references(() => dancers.id),
  paidAmount: integer('paid_amount').notNull().default(0),
  stripeSessionId: text('stripe_session_id'),
  // TicketTailor verification fields. A row with verified_ticket_holder = true
  // means an external paid-ticket purchase was confirmed via webhook; this is
  // the load-bearing field for the public attendee roster.
  verifiedTicketHolder: boolean('verified_ticket_holder').notNull().default(false),
  tickettailorOrderId: text('tickettailor_order_id').unique(),
  tickettailorBuyerEmail: text('tickettailor_buyer_email'),
  verifiedAt: timestamp('verified_at'),
  // Per-event privacy opt-in for the public attendee roster.
  // 'public_full'    — name + city + photo
  // 'public_minimal' — name + city only (default; privacy-conservative)
  // 'hidden'         — not listed individually; counted in `unclaimed`-style aggregates only
  rosterVisibility: text('roster_visibility').notNull().default('public_minimal').$type<'public_full' | 'public_minimal' | 'hidden'>(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique('festival_dancer_unique').on(t.festivalId, t.dancerId),
])

export const dinners = pgTable('dinners', {
  id: uuid('id').primaryKey().defaultRandom(),
  festivalId: uuid('festival_id').notNull().references(() => festivals.id),
  day: text('day').notNull(),
  date: date('date'),
  timeSlot: text('time_slot').notNull(),
  restaurant: text('restaurant'),
  restaurantAddress: text('restaurant_address'),
  revealDate: date('reveal_date'),
  maxSize: integer('max_size').notNull().default(6),
}, (t) => [
  unique('dinner_festival_day_time').on(t.festivalId, t.day, t.timeSlot),
])

export const dinnerSignups = pgTable('dinner_signups', {
  id: uuid('id').primaryKey().defaultRandom(),
  dinnerId: uuid('dinner_id').notNull().references(() => dinners.id),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique('dinner_dancer_unique').on(t.dinnerId, t.dancerId),
])

export const dinnerGroups = pgTable('dinner_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  dinnerId: uuid('dinner_id').notNull().references(() => dinners.id),
  chatLink: text('chat_link'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const dinnerGroupMembers = pgTable('dinner_group_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => dinnerGroups.id),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id),
})

// ---------------------------------------------------------------------------
// City dance-video voting + competitions + giveaways (O-009)
//
// Videos are EMBED URLs (YouTube / Instagram / TikTok), never hosted uploads —
// we store the source URL + a derived thumbnail URL. Ranking is ELO
// (Bradley-Terry, start 1500, K=32), updated on every pairwise vote — NOT raw
// vote count. Submissions default to `pending`; only `approved` videos enter
// the voting pool or can win Video of the Month.
// ---------------------------------------------------------------------------

export const cityVideos = pgTable('city_videos', {
  id: uuid('id').primaryKey().defaultRandom(),
  citySlug: text('city_slug').notNull(),
  // Optional link to a known dancer; submissions from the public form are
  // identified by email only until (if ever) claimed.
  dancerId: uuid('dancer_id').references(() => dancers.id),
  submittedByEmail: text('submitted_by_email').notNull(),
  title: text('title').notNull(),
  videoUrl: text('video_url').notNull(),
  thumbnailUrl: text('thumbnail_url'),
  danceStyle: text('dance_style'),
  // Competition bucket, e.g. '2026-07'. Winner = highest ELO among approved
  // videos for the current month.
  competitionMonth: text('competition_month').notNull(),
  status: text('status').notNull().default('pending').$type<'pending' | 'approved' | 'rejected'>(),
  eloScore: integer('elo_score').notNull().default(1500),
  voteCount: integer('vote_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow(),
})

export const videoVotes = pgTable('video_votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  citySlug: text('city_slug').notNull(),
  winnerVideoId: uuid('winner_video_id').notNull().references(() => cityVideos.id),
  loserVideoId: uuid('loser_video_id').notNull().references(() => cityVideos.id),
  // Anonymous session id from the `wd_vote_sid` cookie (server-set if missing).
  voterSessionId: text('voter_session_id').notNull(),
  voterDancerId: uuid('voter_dancer_id').references(() => dancers.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  // Dedupe support: `getPair` and `vote` look up every prior vote for a
  // session in a city to avoid re-showing a pair. A pair (A,B) is treated as
  // unordered — the router canonicalises the two ids before comparing, so
  // (A,B) and (B,A) collide. This index makes the per-session lookup cheap.
  index('video_votes_session_idx').on(t.voterSessionId, t.citySlug),
])

// Cross-city battle votes — the tier above per-city voting. Each row is one
// vote in a head-to-head between two cities' champion videos (the current
// month's highest-ELO approved video per city). Ranks CITIES, not videos, into
// the "Top dance cities" leaderboard. videoIds are stored for provenance only
// (plain uuid, no FK — champions rotate as ELO shifts, and this must survive
// video deletion).
export const cityBattleVotes = pgTable('city_battle_votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  competitionMonth: text('competition_month').notNull(),
  winnerCitySlug: text('winner_city_slug').notNull(),
  loserCitySlug: text('loser_city_slug').notNull(),
  winnerVideoId: uuid('winner_video_id'),
  loserVideoId: uuid('loser_video_id'),
  voterSessionId: text('voter_session_id').notNull(),
  voterDancerId: uuid('voter_dancer_id').references(() => dancers.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  // Per-session dedupe (one vote per unordered city pair per month) + leaderboard
  // tallies both hit these.
  index('city_battle_votes_session_idx').on(t.voterSessionId, t.competitionMonth),
  index('city_battle_votes_month_idx').on(t.competitionMonth),
])

export const giveaways = pgTable('giveaways', {
  id: uuid('id').primaryKey().defaultRandom(),
  citySlug: text('city_slug').notNull(),
  sponsorName: text('sponsor_name').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  prizeDescription: text('prize_description').notNull(),
  // The promoted festival / class / social — where "Enter" and the sponsor
  // brand point.
  ctaUrl: text('cta_url').notNull(),
  imageUrl: text('image_url'),
  termsUrl: text('terms_url'),
  startsAt: timestamp('starts_at').notNull(),
  endsAt: timestamp('ends_at').notNull(),
  status: text('status').notNull().default('active').$type<'active' | 'ended' | 'draft'>(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const giveawayEntries = pgTable('giveaway_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  giveawayId: uuid('giveaway_id').notNull().references(() => giveaways.id),
  dancerId: uuid('dancer_id').references(() => dancers.id),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  // Free-entry: one entry per email per giveaway.
  unique('giveaway_entry_email_unique').on(t.giveawayId, t.email),
])

// Reviews & ratings — polymorphic by (targetType, targetSlug) so a review can
// attach to ANY entity (festival / venue / artist / organizer), including
// on-demand stubs created by "ask locals" recommendations, without needing a
// full entity table for each. `source` separates a normal review from an
// auto-5★ recommendation. One review per dancer per target.
export const reviews = pgTable('reviews', {
  id: uuid('id').primaryKey().defaultRandom(),
  targetType: text('target_type').notNull().$type<'festival' | 'venue' | 'artist' | 'organizer'>(),
  targetSlug: text('target_slug').notNull(),
  targetName: text('target_name'),
  // For organizer/venue recommendations: which city the target is in.
  citySlug: text('city_slug'),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id),
  // Denormalized reviewer identity (name + handle) so the review list needs no
  // join and can link to /u/<handle>. Snapshotted at write time.
  reviewerName: text('reviewer_name'),
  reviewerUsername: text('reviewer_username'),
  rating: integer('rating').notNull(),
  text: text('text'),
  source: text('source').notNull().default('review').$type<'review' | 'recommendation'>(),
  status: text('status').notNull().default('visible').$type<'visible' | 'hidden'>(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  // One review per dancer per target (a recommend also upserts through this).
  unique('review_target_dancer_unique').on(t.targetType, t.targetSlug, t.dancerId),
])

// Community groups (WhatsApp / Telegram / …) per city — the cold-start
// directory for cities where WeDance has no events yet.
export const communityGroups = pgTable('community_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  citySlug: text('city_slug').notNull(),
  name: text('name').notNull(),
  platform: text('platform').notNull().default('whatsapp').$type<'whatsapp' | 'telegram' | 'facebook' | 'other'>(),
  inviteUrl: text('invite_url').notNull(),
  styles: json('styles').$type<string[]>().default([]),
  source: text('source'),
  verified: boolean('verified').default(false),
  status: text('status').notNull().default('visible').$type<'visible' | 'hidden'>(),
  reportCount: integer('report_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
})

// Per-user report tracking for community groups — prevents a single user
// from hiding a group by reporting it multiple times.
export const communityGroupReports = pgTable('community_group_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  groupId: uuid('group_id').notNull().references(() => communityGroups.id),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id),
  createdAt: timestamp('created_at').defaultNow(),
}, t => [
  unique('community_group_reports_group_dancer').on(t.groupId, t.dancerId),
])


// "Ask locals" — a question posted for a city, answered by recommendations
// (which write into `reviews` with source='recommendation').
export const recommendationRequests = pgTable('recommendation_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  citySlug: text('city_slug').notNull(),
  askerId: uuid('asker_id').notNull().references(() => dancers.id),
  question: text('question').notNull(),
  status: text('status').notNull().default('open').$type<'open' | 'closed'>(),
  createdAt: timestamp('created_at').defaultNow(),
})

// Professional profiles — venues, artists, organizers — under the unified
// /@<username> handle namespace (v4-style). Dancers keep their own row + handle
// in `dancers`; the /@handle route resolves either. Reviews attach polymorphically
// by (type, username).
export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  username: text('username').notNull().unique(),
  type: text('type').notNull().$type<'venue' | 'artist' | 'organizer'>(),
  name: text('name').notNull(),
  city: text('city'),
  citySlug: text('city_slug'),
  photo: text('photo'),
  bio: text('bio'),
  styles: json('styles').$type<string[]>().default([]),
  // Spoken languages (ISO 639-1 codes, e.g. ['en', 'es', 'de']).
  languages: json('languages').$type<string[]>().default([]),
  address: text('address'),
  // Venue floor type matters to dancers (parquet / tiles / concrete).
  floorType: text('floor_type'),
  // 'OpenAir' | 'Indoor' | … — an OpenAir community spot (e.g. Pinakothek) is a
  // free commons, not a commercial rental.
  venueType: text('venue_type'),
  // Drawn map of the areas (image URL).
  mapUrl: text('map_url'),
  // Community guidelines the space runs by (the "politics" a moderator proposes).
  guidelines: text('guidelines'),
  // 'free' (community commons, moderator-managed) | 'commercial' (venue rental).
  bookingModel: text('booking_model').notNull().default('commercial').$type<'free' | 'commercial'>(),
  // The community-elected moderator (annual term) who manages free bookings and
  // proposes the guidelines. Full election flow is a follow-up; stored flat for now.
  moderatorName: text('moderator_name'),
  moderatorHandle: text('moderator_handle'),
  moderatorSince: integer('moderator_since'),
  socials: json('socials').$type<{ platform: string; url: string }[]>().default([]),
  // Gallery for artists/venues; `photo` stays the hero (the one flyers and cards use).
  photos: jsonb('photos').$type<{ url: string }[]>().notNull().default([]),
  claimed: boolean('claimed').default(false),
  status: text('status').notNull().default('visible').$type<'visible' | 'hidden'>(),
  createdAt: timestamp('created_at').defaultNow(),
  // Provenance (added by scripts/migrate/00-schema.mjs; in Drizzle since 0022).
  // v4 imports: { v4ProfileId, firebaseId, v4Type }. v3 sync: { source: 'wedance-v3', sourceId, … }.
  sourceRef: jsonb('source_ref').$type<Record<string, unknown>>(),
})

// Who manages a profile (hosting mode). Created when an admin approves a claim
// or when a dancer creates a new profile. `claimed` on the profile mirrors
// "has at least one owner" so the v3 sync never overwrites it.
export const profileMembers = pgTable('profile_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('owner').$type<'owner' | 'editor'>(),
  // Public title on the team list ("Promoter", "Resident DJ") — not a permission (0027).
  title: text('title'),
  addedBy: uuid('added_by').references(() => dancers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique('profile_members_profile_dancer').on(t.profileId, t.dancerId),
  index('profile_members_dancer_idx').on(t.dancerId),
])

// "This is me / my venue" requests for existing profiles. An admin approves
// (→ profile_members owner row + profiles.claimed) or rejects.
export const profileClaims = pgTable('profile_claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id, { onDelete: 'cascade' }),
  // How the admin can verify it's really them (e.g. "DM me from @handle").
  message: text('message').notNull().default(''),
  status: text('status').notNull().default('pending').$type<'pending' | 'approved' | 'rejected'>(),
  // 0027: claim = nobody manages it (admin decides) · join = ask the owners for a
  // role · reclaim = "it's mine, someone else has it" (admin decides, never the owners).
  kind: text('kind').notNull().default('claim').$type<'claim' | 'join' | 'reclaim'>(),
  requestedRole: text('requested_role').notNull().default('owner').$type<'owner' | 'editor'>(),
  title: text('title'),
  decidedBy: uuid('decided_by').references(() => dancers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  decidedAt: timestamp('decided_at'),
}, (t) => [
  unique('profile_claims_profile_dancer').on(t.profileId, t.dancerId),
  index('profile_claims_status_idx').on(t.status),
])

// Who got, lost or changed access to a profile, and who did it (0027) — the
// facts an admin needs to judge a reclaim dispute.
export const profileAccessLog = pgTable('profile_access_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => dancers.id, { onDelete: 'set null' }),
  subjectId: uuid('subject_id').references(() => dancers.id, { onDelete: 'set null' }),
  action: text('action').notNull().$type<'created' | 'requested' | 'approved' | 'rejected' | 'role_changed' | 'removed' | 'left'>(),
  role: text('role'),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  index('profile_access_log_profile_idx').on(t.profileId, t.createdAt),
])

// A profile (venue) can offer N bookable areas — e.g. Pinakothek's 5 spaces.
export const bookableSpaces = pgTable('bookable_spaces', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id),
  name: text('name').notNull(),
  capacity: integer('capacity'),
  floorType: text('floor_type'),
  priceInfo: text('price_info'),
  description: text('description'),
  imageUrl: text('image_url'),
  sortOrder: integer('sort_order').default(0),
  createdAt: timestamp('created_at').defaultNow(),
})

// Booking requests — connector model (no payment held). An organizer requests a
// date for a space; the venue responds. T&C accepted at request time.
export const bookingRequests = pgTable('booking_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  spaceId: uuid('space_id').notNull().references(() => bookableSpaces.id),
  profileId: uuid('profile_id').notNull().references(() => profiles.id),
  // The organiser running this event — an 'organizer' profile. Lets the event
  // surface on the organiser's page and marks that organiser "active this week"
  // on the city directory. Nullable: legacy/self-serve bookings may have none.
  organizerId: uuid('organizer_id').references(() => profiles.id),
  requesterId: uuid('requester_id').references(() => dancers.id),
  requesterEmail: text('requester_email').notNull(),
  requesterName: text('requester_name'),
  // Event details — a booking IS a scheduled event, so it carries enough info
  // to show on the community calendar: title, type, styles, date + time window.
  title: text('title'),
  eventType: text('event_type'), // Social · Party · Workshop · Class · Practica · Private
  styles: json('styles').$type<string[]>().default([]),
  // Artists / teachers / DJs featured — names or @handles. Lets the event surface
  // on each artist's profile.
  artists: json('artists').$type<string[]>().default([]),
  eventDate: date('event_date'),
  startTime: text('start_time'), // 'HH:MM'
  endTime: text('end_time'),     // 'HH:MM'
  headcount: integer('headcount'),
  message: text('message'), // description / notes
  // Optional external tickets link — free community events leave this null.
  ticketUrl: text('ticket_url'),
  termsAcceptedAt: timestamp('terms_accepted_at'),
  status: text('status').notNull().default('pending').$type<'pending' | 'accepted' | 'declined'>(),
  // Free/OpenAir commons only (G804): the elected moderator approves/declines
  // requests against the active guidelines. Who decided, when, and an optional
  // note back to the requester. Null on commercial venues (decided off-platform).
  moderatedById: uuid('moderated_by_id').references(() => dancers.id),
  moderatedAt: timestamp('moderated_at'),
  moderationNote: text('moderation_note'),
  createdAt: timestamp('created_at').defaultNow(),
})

// Recurring weekly availability windows per bookable space. A venue publishes
// when each space is open for bookings (e.g. "Monday 18:00–23:00"). When slots
// exist for a space, booking requests are validated against them; when none
// exist the space is treated as always-available (backward-compat).
export const availabilitySlots = pgTable('availability_slots', {
  id: uuid('id').primaryKey().defaultRandom(),
  spaceId: uuid('space_id').notNull().references(() => bookableSpaces.id),
  dayOfWeek: integer('day_of_week').notNull(), // 1=Monday … 7=Sunday (ISO-8601)
  startTime: text('start_time').notNull(),     // 'HH:MM'
  endTime: text('end_time').notNull(),         // 'HH:MM'
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  index('availability_slots_space_idx').on(t.spaceId),
])

// Festival submissions from the /organizers/create wizard. There is no live
// self-serve publish yet — the wizard captures the full draft here for the
// team to review and onboard, instead of pretending to go live. The whole
// draft is stored as a JSON payload so the schema doesn't have to track every
// wizard field.
export const festivalSubmissions = pgTable('festival_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug'),
  name: text('name'),
  submittedById: uuid('submitted_by_id').references(() => dancers.id),
  submittedByEmail: text('submitted_by_email'),
  payload: json('payload').$type<Record<string, unknown>>().notNull(),
  status: text('status').notNull().default('pending').$type<'pending' | 'reviewing' | 'onboarded' | 'declined'>(),
  createdAt: timestamp('created_at').defaultNow(),
})

// --- Moderator elections (community governance for free/OpenAir commons) ------
// Epic G800 (WED-152): a free space's moderator is elected annually. Candidates
// self-nominate and propose the guidelines the space runs by; the community votes
// on an OPEN, verifiable ledger (timestamped, attributable, editable-with-history);
// the winner's guidelines become the active ruleset the moderator enforces on the
// free-booking queue. Replaces the flat profiles.moderator* fields.

// The election itself + its lifecycle (G801). One active (non-closed) election
// per profile is enforced in the router.
export const moderatorElections = pgTable('moderator_elections', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id),
  status: text('status').notNull().default('nominations').$type<'nominations' | 'voting' | 'closed'>(),
  // The one-year term the winner will serve.
  termStart: date('term_start'),
  termEnd: date('term_end'),
  // Phase transitions, each timestamped.
  nominationsOpenAt: timestamp('nominations_open_at').defaultNow(),
  votingOpenAt: timestamp('voting_open_at'),
  closesAt: timestamp('closes_at'), // planned close (informational)
  closedAt: timestamp('closed_at'), // actual close
  // Set on close. No FK (would create a cycle with electionCandidates.electionId).
  winnerCandidateId: uuid('winner_candidate_id'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  index('moderator_elections_profile_idx').on(t.profileId),
])

// A self-nominated candidate + the guidelines they run on (G802). One candidacy
// per dancer per election; a real (verified) profile is required — enforced in
// the router by requiring the dancer to have a username.
export const electionCandidates = pgTable('election_candidates', {
  id: uuid('id').primaryKey().defaultRandom(),
  electionId: uuid('election_id').notNull().references(() => moderatorElections.id),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id),
  guidelines: text('guidelines').notNull(),
  statement: text('statement'), // optional short pitch
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique('election_candidates_unique').on(t.electionId, t.dancerId),
])

// The CURRENT vote per voter — one row per (election, voter), upserted on change
// (G803). One real profile = one vote (G801 anti-stuffing). The tally uses this
// table (latest vote per voter); the full trail lives in electionVoteHistory.
export const electionVotes = pgTable('election_votes', {
  id: uuid('id').primaryKey().defaultRandom(),
  electionId: uuid('election_id').notNull().references(() => moderatorElections.id),
  voterDancerId: uuid('voter_dancer_id').notNull().references(() => dancers.id),
  candidateId: uuid('candidate_id').notNull().references(() => electionCandidates.id),
  createdAt: timestamp('created_at').defaultNow(), // first cast
  updatedAt: timestamp('updated_at').defaultNow(), // last change
}, (t) => [
  unique('election_votes_unique').on(t.electionId, t.voterDancerId),
])

// Immutable append-only log of every cast/change (G803). Makes "is my vote still
// X?" verifiable — a vote is never silently overwritten, each change is a row.
export const electionVoteHistory = pgTable('election_vote_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  electionId: uuid('election_id').notNull().references(() => moderatorElections.id),
  voterDancerId: uuid('voter_dancer_id').notNull().references(() => dancers.id),
  fromCandidateId: uuid('from_candidate_id'), // null = first cast
  toCandidateId: uuid('to_candidate_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  index('election_vote_history_idx').on(t.electionId, t.voterDancerId),
])

// Per-term guideline versions (G804): on close, the winner's guidelines become
// the space's active ruleset; every term is preserved so governance history is
// auditable across elections.
export const guidelineVersions = pgTable('guideline_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id),
  electionId: uuid('election_id').references(() => moderatorElections.id),
  moderatorDancerId: uuid('moderator_dancer_id').references(() => dancers.id),
  guidelines: text('guidelines').notNull(),
  termStart: date('term_start'),
  termEnd: date('term_end'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  index('guideline_versions_profile_idx').on(t.profileId),
])

// ---------------------------------------------------------------------------
// Gigs — opportunity board for dance roles and service offerings
// 
// kind: 'role' = organizer/festival posting an open role they need filled
// kind: 'offer' = artist posting a service they offer
// ---------------------------------------------------------------------------
export const gigs = pgTable('gigs', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').notNull().$type<'role' | 'offer'>(),
  category: text('category').notNull(), // Teacher, DJ, MC, Performer, Show, Photographer, Organizer
  title: text('title').notNull(),
  posterName: text('poster_name').notNull(),
  posterType: text('poster_type').notNull(), // Festival, Organizer, Private event, School, Artist
  location: text('location').notNull(),
  styles: json('styles').$type<string[]>().default([]),
  when: text('when').notNull(),
  compensation: text('compensation').notNull(),
  deadline: date('deadline'),
  // Contact info for the poster (email for replies, optional URL to profile/website)
  contactEmail: text('contact_email').notNull(),
  contactUrl: text('contact_url'),
  // Optional: link to related entity (festival, profile, etc.)
  entityUrl: text('entity_url'),
  // Soft delete: gigs can be marked closed without removing from history
  status: text('status').notNull().default('open').$type<'open' | 'closed'>(),
  dancerId: uuid('dancer_id').references(() => dancers.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ---------------------------------------------------------------------------
// Tonight (Hangouts) — spontaneous evening activities where dancers can mark
// they're out (dinner, bar, ride, floor, etc.) and see who else is joining.
// ---------------------------------------------------------------------------
export const hangouts = pgTable('hangouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').notNull().$type<'dinner' | 'bar' | 'ride' | 'floor'>(),
  title: text('title').notNull(),
  time: text('time').notNull(), // 'HH:MM' format
  venue: text('venue'),
  host: text('host'),
  citySlug: text('city_slug').notNull(),
  peopleCount: integer('people_count').default(0),
  status: text('status').notNull().default('active').$type<'active' | 'closed'>(),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

export const planItems = pgTable(
  'plan_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    dancerId: uuid('dancer_id')
      .notNull()
      .references(() => dancers.id),
    itemType: text('item_type').notNull().$type<'festival' | 'event' | 'goal' | 'workshop'>(),
    itemId: text('item_id').notNull(),
    metadata: jsonb('metadata').$type<Record<string, string>>(),
    // Opt-in attendee visibility (RAZ-115): when true the dancer appears in
    // the public "who's going" list; when false they're counted but not shown.
    shareGoing: boolean('share_going').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => [
    unique('plan_items_dancer_item').on(t.dancerId, t.itemType, t.itemId),
    index('plan_items_dancer_idx').on(t.dancerId),
  ],
)

export const hangoutRsvps = pgTable('hangout_rsvps', {
  id: uuid('id').primaryKey().defaultRandom(),
  hangoutId: uuid('hangout_id').notNull().references(() => hangouts.id),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique('hangout_rsvp_unique').on(t.hangoutId, t.dancerId),
])

// ---------------------------------------------------------------------------
// Events — dated, public dance events (socials, classes, workshops, festivals).
// Created outside Drizzle on 2026-07-15 by scripts/migrate/00-schema.mjs to hold
// the 9,580 historical v4 events (archived=true, hidden). Since 2026-10 it also
// holds the LIVE upcoming events mirrored from wedance.vip (v3 Firestore) by
// scripts/sync-v3-events.ts — those carry source='wedance-v3' + source_id=<post id>
// and archived=false, published=true while still upcoming in v3.
//
// Times: start_date / end_date are `timestamp without time zone` holding UTC
// (the convention 04-events.mjs established). `timezone` is the IANA zone the
// event happens in — render wall-clock times in it, never in the viewer's zone.
// Rollback for synced rows: DELETE FROM events WHERE source = 'wedance-v3'.
// ---------------------------------------------------------------------------
export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug'),
  name: text('name'),
  type: text('type'), // v3 eventType: Party · Workshop · Course · Festival · Congress · Weekender · Concert · Show
  description: text('description').default(''),
  cover: text('cover').default(''),
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  isFestival: boolean('is_festival').default(false),
  ticketUrl: text('ticket_url'),
  price: text('price').default(''),
  city: text('city'),
  venueUsername: text('venue_username'),
  organizerUsername: text('organizer_username'),
  styles: jsonb('styles').$type<string[]>().default([]),
  archived: boolean('archived').notNull().default(true),
  published: boolean('published').notNull().default(false),
  sourceRef: jsonb('source_ref').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow(),
  // --- added 2026-10 (migration 0021) for the v3 → 2026 event sync ---
  source: text('source'),
  sourceId: text('source_id'),
  citySlug: text('city_slug'),
  country: text('country'),
  timezone: text('timezone'),
  venueName: text('venue_name'),
  venueAddress: text('venue_address'),
  venueLat: doublePrecision('venue_lat'),
  venueLng: doublePrecision('venue_lng'),
  organizerName: text('organizer_name'),
  link: text('link'),
  seriesId: text('series_id'),
  // Artist / teacher / DJ profile handles on this event (migration 0022).
  artists: jsonb('artists').$type<string[]>().default([]),
  syncedAt: timestamp('synced_at'),
  updatedAt: timestamp('updated_at').defaultNow(),
  // Hosting mode (migration 0026): the profile that runs this event. Its
  // managers (profile_members) can edit it. Null for synced/imported events.
  hostProfileId: uuid('host_profile_id').references(() => profiles.id, { onDelete: 'set null' }),
  // Event flyers (migration 0029): the night's agenda, shown on the event page
  // and optionally on the flyer, and which photo of each artist the flyer uses
  // (a URL, or null = name only; unset = their main photo).
  agenda: jsonb('agenda').$type<{ time: string; what: string }[]>().notNull().default([]),
  flyerOptions: jsonb('flyer_options').$type<{ showAgenda?: boolean; photos?: Record<string, string | null> }>().notNull().default({}),
  // The Instagram caption to post with the flyer (migration 0030), plus the
  // lines it was written from (out of date when the details change).
  caption: jsonb('caption').$type<{ language: string; text: string; lines: string[]; writtenAt: string } | null>(),
}, (t) => [
  index('events_host_profile_idx').on(t.hostProfileId),
  uniqueIndex('events_slug_uidx').on(t.slug).where(sql`${t.slug} IS NOT NULL`),
  index('events_archived_idx').on(t.archived),
  uniqueIndex('events_source_uidx').on(t.source, t.sourceId).where(sql`${t.sourceId} IS NOT NULL`),
  index('events_city_start_idx').on(t.citySlug, t.startDate),
  index('events_venue_username_idx').on(t.venueUsername),
  index('events_organizer_username_idx').on(t.organizerUsername),
])

export const festivalRideShares = pgTable('festival_ride_shares', {
  id: uuid('id').primaryKey().defaultRandom(),
  festivalId: uuid('festival_id').notNull().references(() => festivals.id),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id),
  type: text('type').notNull().$type<'offering' | 'looking'>(),
  originCity: text('origin_city').notNull(),
  date: date('date').notNull(),
  seatsAvailable: integer('seats_available'),
  contactLink: text('contact_link'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique('festival_ride_dancer_unique').on(t.festivalId, t.dancerId),
])

export const festivalRoommateLookups = pgTable('festival_roommate_lookups', {
  id: uuid('id').primaryKey().defaultRandom(),
  festivalId: uuid('festival_id').notNull().references(() => festivals.id),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique('festival_roommate_dancer_unique').on(t.festivalId, t.dancerId),
])

// ---------------------------------------------------------------------------
// Referrals — ticket referral tracking for the "buy through a friend's link"
// discount flow. A referral row is created when a dancer opens a checkout via
// a referral link (?ref=<username>). Status transitions: pending → completed
// (on successful Stripe payment) or expired (if never paid). The referrer is
// credited once the referee's payment succeeds.
// ---------------------------------------------------------------------------
export const referrals = pgTable('referrals', {
  id: uuid('id').primaryKey().defaultRandom(),
  festivalId: uuid('festival_id').notNull().references(() => festivals.id),
  // The dancer who shared the referral link.
  referrerId: uuid('referrer_id').notNull().references(() => dancers.id),
  // The dancer who used the link and (optionally) purchased.
  refereeId: uuid('referee_id').notNull().references(() => dancers.id),
  // Discount applied to the referee's purchase, in euro cents.
  discountCents: integer('discount_cents').notNull().default(0),
  // Stripe checkout session that carried this referral (set at checkout creation).
  stripeSessionId: text('stripe_session_id'),
  status: text('status').notNull().default('pending').$type<'pending' | 'completed' | 'expired'>(),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
  referrerCreditCents: integer('referrer_credit_cents').notNull().default(0),
  referrerCreditAppliedSessionId: text('referrer_credit_applied_session_id'),
}, (t) => [
  // One referral per referee per festival (a dancer can only be referred once per event).
  unique('referral_festival_referee_unique').on(t.festivalId, t.refereeId),
  index('referrals_referrer_idx').on(t.referrerId),
])

// ---------------------------------------------------------------------------
// Artist Follows — a dancer follows a professional artist profile to track
// where they appear across festivals and cities (RAZ-55).
// ---------------------------------------------------------------------------
export const artistFollows = pgTable('artist_follows', {
  id: uuid('id').primaryKey().defaultRandom(),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id),
  profileId: uuid('profile_id').notNull().references(() => profiles.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique('artist_follows_dancer_profile').on(t.dancerId, t.profileId),
  index('artist_follows_profile_idx').on(t.profileId),
])

/**
 * RAZ-82: "Wave" social gesture — a lightweight, per-festival expression
 * of "I'd love to dance with you there." Mutual waves = festival friends.
 */
export const festivalWaves = pgTable('festival_waves', {
  id: uuid('id').primaryKey().defaultRandom(),
  festivalSlug: text('festival_slug').notNull(),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id),
  targetDancerId: uuid('target_dancer_id').notNull().references(() => dancers.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique('festival_wave_unique').on(t.festivalSlug, t.dancerId, t.targetDancerId),
  index('festival_waves_target_idx').on(t.festivalSlug, t.targetDancerId),
])

// ---------------------------------------------------------------------------
// Cities — canonical, Google-Places-backed (migration 0024). One row per
// Google place: `name` is the English name ("Munich"), `local_name` the name in
// the country's language ("München"), `alt_names` every other spelling we have
// resolved or seen typed ("Мюнхен", "Munique", "munchen"). The CityCombobox
// only ever saves one of these rows, so "München", "Мюнхен" and "munich" all
// end up as the same city. Free-text `city` columns elsewhere are migrated to a
// `city_id` FK later — plan: docs/research/2026-10-12-city-canonicalisation.md.
// ---------------------------------------------------------------------------
export const cities = pgTable('cities', {
  id: uuid('id').primaryKey().defaultRandom(),
  googlePlaceId: text('google_place_id').notNull(),
  slug: text('slug').notNull(),
  name: text('name').notNull(),
  localName: text('local_name'),
  country: text('country'),
  countryCode: text('country_code'),
  region: text('region'),
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
  altNames: jsonb('alt_names').$type<string[]>().notNull().default([]),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('cities_google_place_id_uidx').on(t.googlePlaceId),
  uniqueIndex('cities_slug_uidx').on(t.slug),
  index('cities_name_lower_idx').on(sql`lower(${t.name})`),
  index('cities_local_name_lower_idx').on(sql`lower(${t.localName})`),
  index('cities_alt_names_gin_idx').using('gin', t.altNames),
])

// ---------------------------------------------------------------------------
// Event flyers (migration 0029). A profile's looks — how its flyers look, read
// from flyers it made before or picked from four directions — and every flyer
// painted for an event. Gemini paints the whole poster; each row stores the
// exact lines it was painted from and the read-back check, so the editor can
// tell when the kept flyer no longer matches the event.
// ---------------------------------------------------------------------------
export type FlyerLookSpec = { name?: string; description: string; palette?: { name: string; hex: string }[]; inspiration?: string | null }

export const brandLooks = pgTable('brand_looks', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  palette: jsonb('palette').$type<{ name: string; hex: string }[]>().notNull().default([]),
  // Flyers the look was read from (the organizer's own past work).
  references: jsonb('references').$type<{ url: string }[]>().notNull().default([]),
  source: text('source'), // 'flyers' | 'directions'
  createdBy: uuid('created_by').references(() => dancers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => [
  index('brand_looks_profile_idx').on(t.profileId),
])

export const eventFlyers = pgTable('event_flyers', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  // One sitting: the four directions, or a flyer and its repaints — the versions you compare.
  batchId: uuid('batch_id').notNull(),
  lookId: uuid('look_id').references(() => brandLooks.id, { onDelete: 'set null' }),
  look: jsonb('look').$type<FlyerLookSpec>().notNull(),
  mode: text('mode').notNull().default('paint'), // paint · direction · fix · refresh
  baseFlyerId: uuid('base_flyer_id'),
  status: text('status').notNull().default('painting'), // painting · ready · failed
  url: text('url'),
  width: integer('width'),
  height: integer('height'),
  lines: jsonb('lines').$type<{ label: string; text: string }[]>().notNull().default([]),
  pictured: jsonb('pictured').$type<string[]>().notNull().default([]),
  notes: text('notes'),
  prompt: text('prompt'),
  model: text('model'),
  check: jsonb('check').$type<{ ok: boolean; missing: string[]; extra: string[]; seen: string[] }>(),
  error: text('error'),
  // The flyer the event uses. One per event; keeping another clears it.
  keptAt: timestamp('kept_at'),
  createdBy: uuid('created_by').references(() => dancers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => [
  index('event_flyers_event_idx').on(t.eventId, t.createdAt),
  index('event_flyers_batch_idx').on(t.batchId),
])
