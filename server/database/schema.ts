import { pgTable, uuid, text, integer, boolean, timestamp, date, unique, index, json, jsonb, doublePrecision, uniqueIndex, numeric, check } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Handle registry (ADR-004, Step 12). One namespace for dancer and profile
// URLs: `/@<handle>` resolves through this table. citext for
// case-insensitive uniqueness. Exactly one of dancer_id / profile_id is set.
// ---------------------------------------------------------------------------
export const handles = pgTable('handles', {
  handle: text('handle').primaryKey(),
  dancerId: uuid('dancer_id').unique().references(() => dancers.id, { onDelete: 'cascade' }),
  profileId: uuid('profile_id').unique().references(() => profiles.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  check('handles_exactly_one_target', sql`num_nonnulls(${t.dancerId}, ${t.profileId}) = 1`),
])

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
  // Earlier handles (0036), so old /u/<handle> links forward.
  oldUsernames: jsonb('old_usernames').$type<string[]>().notNull().default([]),
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
  // Set when the dancer proves they own the email address (e.g. by clicking a
  // magic link). Ticket claiming (claim.ts) requires this to prevent an
  // attacker from registering someone else's email and grabbing their tickets.
  emailVerifiedAt: timestamp('email_verified_at'),
  // Provenance (added by scripts/migrate/00-schema.mjs for the v4→2026 migration).
  // { v4UserId, firebaseId, v4Email }. Rollback key: DELETE WHERE source_ref IS NOT NULL.
  sourceRef: jsonb('source_ref').$type<Record<string, unknown>>(),
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
  type: text('type').notNull().$type<'venue' | 'artist' | 'organizer' | 'promoter'>(),
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
  // Drawn map of the areas (image URL) — or, for most imported venues, their
  // Google Maps link (maps.google.com/?cid=…).
  mapUrl: text('map_url'),
  // Venue details (migration 0036, shared/types/venueDetails.ts): v3's
  // amenities, how many people it holds, opening hours, the floor plan image,
  // and booking contacts only signed-in organizers see (never public).
  amenities: jsonb('amenities').$type<string[]>().notNull().default([]),
  capacity: integer('capacity'),
  openingHours: jsonb('opening_hours').$type<import('../../shared/types/venueDetails').OpeningHours>().notNull().default([]),
  floorPlan: text('floor_plan'),
  contact: jsonb('contact').$type<import('../../shared/types/venueDetails').VenueContact>().notNull().default({}),
  // Where the venue is (0036), from its Google listing.
  lat: doublePrecision('lat'),
  lng: doublePrecision('lng'),
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
  // Video links (YouTube embed URLs) on the artist's page (migration 0033).
  videos: jsonb('videos').$type<{ url: string }[]>().notNull().default([]),
  claimed: boolean('claimed').default(false),
  status: text('status').notNull().default('visible').$type<'visible' | 'hidden'>(),
  // Step 14 (ADR-004): profile roles — teacher, dj, performer, mc, band,
  // photographer, videographer; school, promoter, festival, community.
  // GIN-indexed for "all DJs in Munich" queries.
  roles: jsonb('roles').$type<string[]>().notNull().default([]),
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
  role: text('role').notNull().default('owner').$type<'owner' | 'editor' | 'moderator'>(),
  // Public title on the team list ("Promoter", "Resident DJ") — not a permission (0027).
  title: text('title'),
  addedBy: uuid('added_by').references(() => dancers.id, { onDelete: 'set null' }),
  // Step 13 (ADR-004): moderator term boundaries — set when election.close
  // grants the moderator membership. Null for owner/editor roles.
  termStart: date('term_start'),
  termEnd: date('term_end'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique('profile_members_profile_dancer').on(t.profileId, t.dancerId),
  index('profile_members_dancer_idx').on(t.dancerId),
])

// Business "Network" curation (migration 0042, RAZ-408). The network itself is
// derived from shared events; a row here means a page's team ADDED someone by
// hand or HID a derived contact. One row per (my page, their page).
export const networkLinks = pgTable('network_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  otherProfileId: uuid('other_profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  status: text('status').notNull().$type<'added' | 'hidden'>(),
  createdBy: uuid('created_by').references(() => dancers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique('network_links_pair').on(t.profileId, t.otherProfileId),
  index('network_links_profile_idx').on(t.profileId),
])

// "This is me / my venue" requests for existing profiles. An admin approves
// (→ profile_members owner row + profiles.claimed) or rejects.
export const profileClaims = pgTable('profile_claims', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id, { onDelete: 'cascade' }),
  // How the admin can verify it's really them (e.g. "DM me from @handle").
  message: text('message').notNull().default(''),
  status: text('status').notNull().default('pending').$type<'pending' | 'approved' | 'rejected' | 'info_required'>(),
  // 0027: claim = nobody manages it (admin decides) · join = ask the owners for a
  // role · reclaim = "it's mine, someone else has it" (admin decides, never the owners).
  kind: text('kind').notNull().default('claim').$type<'claim' | 'join' | 'reclaim'>(),
  requestedRole: text('requested_role').notNull().default('owner').$type<'owner' | 'editor'>(),
  title: text('title'),
  // 0042: structured evidence — URLs, links, documentation for verification.
  evidence: text('evidence').notNull().default(''),
  evidenceType: text('evidence_type').notNull().default('other').$type<'domain_email' | 'social_media' | 'website_link' | 'documentation' | 'other'>(),
  // 0042: admin feedback to the claimant (used with info_required status).
  reviewerNote: text('reviewer_note').notNull().default(''),
  decidedBy: uuid('decided_by').references(() => dancers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  decidedAt: timestamp('decided_at'),
}, (t) => [
  unique('profile_claims_profile_dancer').on(t.profileId, t.dancerId),
  index('profile_claims_status_idx').on(t.status),
])

// Step 14 (ADR-004): artist ↔ organiser affiliations ("teaches at", "resident
// DJ at", "member of"). Links an artist profile to an organiser/venue profile.
export const profileAffiliations = pgTable('profile_affiliations', {
  id: uuid('id').primaryKey().defaultRandom(),
  artistProfileId: uuid('artist_profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  organizerProfileId: uuid('organizer_profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().$type<'teaches_at' | 'resident' | 'member'>(),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique('profile_affiliations_pair').on(t.artistProfileId, t.organizerProfileId),
  index('profile_affiliations_organizer_idx').on(t.organizerProfileId),
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
  // Step 16 (ADR-010): when delivery outbox last notified venue members.
  notifiedAt: timestamp('notified_at'),
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

// --- Organizer subscriptions (RAZ-106) ----------------------------------------
// An organizer profile can hold one active annual subscription plan.
// The Network plan (€199/year) covers unlimited events under a single annual
// price.  Stripe runs the billing; this table mirrors the subscription state so
// entitlement checks stay inside the DB without a Stripe API call.
export const organizerSubscriptions = pgTable('organizer_subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id),
  plan: text('plan').notNull().$type<'network'>(),
  status: text('status').notNull().$type<'active' | 'past_due' | 'canceled' | 'unpaid'>().default('active'),
  stripeCustomerId: text('stripe_customer_id'),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  canceledAt: timestamp('canceled_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  index('org_sub_profile_idx').on(t.profileId),
  index('org_sub_dancer_idx').on(t.dancerId),
])

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
  // Step 14 (ADR-004): the professional profile who posted this gig — links
  // gig to its page on WeDance. Nullable for gigs without a profile.
  posterProfileId: uuid('poster_profile_id').references(() => profiles.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// ---------------------------------------------------------------------------
// Tonight (Hangouts) — spontaneous evening activities where dancers can mark
// they're out (dinner, bar, ride, floor, etc.) and see who else is joining.
// ---------------------------------------------------------------------------
export const hangouts = pgTable('hangouts', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').notNull().$type<'dinner' | 'bar' | 'ride' | 'floor' | 'coffee'>(),
  title: text('title').notNull(),
  time: text('time').notNull(), // 'HH:MM' format
  venue: text('venue'),
  // The place picked from Google Places autocomplete (migration 0047). `venue`
  // keeps the display name; these are null for a typed-in place.
  placeId: text('place_id'),
  placeAddress: text('place_address'),
  placeLat: doublePrecision('place_lat'),
  placeLng: doublePrecision('place_lng'),
  host: text('host'),
  citySlug: text('city_slug').notNull(),
  // The dance night this hangout belongs to (dinner before it, ride to it…).
  // A linked hangout shows on that event's night, not the night it was posted.
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }),
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

// ---------------------------------------------------------------------------
// Attendances (ADR-008, migration 0044). One row per dancer per event: replaces
// the festival/event rows of `plan_items` (Going clicks) and `festival_signups`
// (ticket holders). Status ladder: interested → going → ticket_holder. One
// visibility setting replaces both `plan_items.share_going` and
// `festival_signups.roster_visibility`. Default visibility = hidden (opt-in).
//
// Phase 4 expand step: this table is created alongside the old tables. New
// Going clicks dual-write here and to `plan_items`; the old reads stay on
// `plan_items`/`festival_signups` until the switch step. `order_id` is nullable
// and has no FK yet (the `orders` table ships in Phase 3 Step 22).
// ---------------------------------------------------------------------------
export const attendances = pgTable('attendances', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  // Nullable for unclaimed ticket-holder stubs (buyer hasn't signed in yet).
  dancerId: uuid('dancer_id').references(() => dancers.id, { onDelete: 'cascade' }),
  // For stubs: the buyer's email until they claim. CHECK enforces at least one.
  buyerEmail: text('buyer_email'),
  // Status ladder: interested → going → ticket_holder. Only a paid/verified
  // order sets ticket_holder. Cancelling "going" never removes a ticket.
  status: text('status').notNull().$type<'interested' | 'going' | 'ticket_holder'>(),
  // How the attendance was created.
  source: text('source').notNull().default('click').$type<'click' | 'free_pass' | 'social_pass' | 'stripe' | 'tickettailor' | 'claim'>(),
  // Links to the order that proves the ticket. Nullable; no FK until the
  // orders table exists (Phase 3 Step 22).
  orderId: uuid('order_id'),
  // One visibility setting: hidden (default, opt-in), public_minimal (name +
  // city), public_full (+ photo). Replaces both share_going and roster_visibility.
  visibility: text('visibility').notNull().default('hidden').$type<'hidden' | 'public_minimal' | 'public_full'>(),
  // Partner matching (was localStorage). Nullable = not set.
  partnerStatus: text('partner_status').$type<'looking' | 'found'>(),
  // Logistics timestamps (were localStorage toggles).
  travelBookedAt: timestamp('travel_booked_at'),
  stayBookedAt: timestamp('stay_booked_at'),
  vacationBookedAt: timestamp('vacation_booked_at'),
  // Organiser door flow.
  checkedInAt: timestamp('checked_in_at'),
  // Set when verified via TicketTailor webhook or Stripe payment confirmation.
  verifiedAt: timestamp('verified_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => [
  // One attendance per dancer per event.
  unique('attendances_event_dancer').on(t.eventId, t.dancerId),
  // One unclaimed stub per email per event (stubs have dancer_id NULL).
  uniqueIndex('attendances_event_email_uidx')
    .on(t.eventId, sql`lower(${t.buyerEmail})`)
    .where(sql`${t.dancerId} IS NULL`),
  // Public list query: events with visible attendees.
  index('attendances_event_status_idx')
    .on(t.eventId, t.status)
    .where(sql`${t.visibility} <> 'hidden'`),
  // My attendance lookups.
  index('attendances_dancer_idx').on(t.dancerId),
])

// ---------------------------------------------------------------------------
// Event RSVPs (RAZ-718, migration 0053): the organiser's poll as the RSVP. One
// answer per dancer — or per anonymous browser (`guest_token`) until its magic
// link confirms it — per event. `answer` buckets: shared/utils/rsvp.ts.
// Unconfirmed rows (dancer_id NULL) count for 48 h; confirming moves the answer
// onto the dancer and deletes the guest row.
// ---------------------------------------------------------------------------
export const eventRsvps = pgTable('event_rsvps', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  dancerId: uuid('dancer_id').references(() => dancers.id, { onDelete: 'cascade' }),
  guestToken: text('guest_token'),
  answer: text('answer').notNull().$type<'partner' | 'needLeader' | 'needFollower' | 'yes' | 'next'>(),
  confirmedAt: timestamp('confirmed_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique('event_rsvps_event_dancer').on(t.eventId, t.dancerId),
  unique('event_rsvps_event_guest').on(t.eventId, t.guestToken),
  index('event_rsvps_event_idx').on(t.eventId),
  check('event_rsvps_dancer_or_guest', sql`num_nonnulls(${t.dancerId}, ${t.guestToken}) >= 1`),
])

// ---------------------------------------------------------------------------
// Dancer goals (ADR-009, migration 0044). Goals were stored as plan_items with
// item_type='goal' and the goal itself in metadata. Now they have their own
// table with typed columns.
// ---------------------------------------------------------------------------
export const dancerGoals = pgTable('dancer_goals', {
  id: uuid('id').primaryKey().defaultRandom(),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull(),
  title: text('title').notNull(),
  target: text('target'),
  periodYear: integer('period_year'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => [
  index('dancer_goals_dancer_idx').on(t.dancerId),
])

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
  flyerOptions: jsonb('flyer_options').$type<{ showAgenda?: boolean; photos?: Record<string, string | null>; names?: Record<string, string> }>().notNull().default({}),
  // The Instagram caption to post with the flyer (migration 0030), plus the
  // lines it was written from (out of date when the details change).
  caption: jsonb('caption').$type<{ language: string; text: string; lines: string[]; writtenAt: string } | null>(),
  // Last checked by a person on WeDance (migration 0031): shown as "Checked by"
  // on the event page; the v3 sync no longer overwrites an edited event.
  editedAt: timestamp('edited_at'),
  editedBy: uuid('edited_by').references(() => dancers.id, { onDelete: 'set null' }),
  // Festivals are events (migration 0032): logo, links, passes, programme…
  // (shared/types/festivalDetails.ts). Null for an ordinary event.
  festival: jsonb('festival').$type<import('../../shared/types/festivalDetails').FestivalDetails | null>(),
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
// Follows — unified follow graph (ADR-004, Step 15). A dancer follows either
// a professional profile (venue/artist/organizer) OR another dancer. Exactly
// one of profile_id / target_dancer_id is set per row. Renamed from
// `artist_follows` (migration 0044). Mutual dancer→dancer follows = friends.
// ---------------------------------------------------------------------------
export const follows = pgTable('follows', {
  id: uuid('id').primaryKey().defaultRandom(),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id),
  profileId: uuid('profile_id').references(() => profiles.id),
  // Step 15: dancer→dancer follows (RAZ-319 decided: mutual = friends).
  targetDancerId: uuid('target_dancer_id').references(() => dancers.id),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique('follows_dancer_profile').on(t.dancerId, t.profileId),
  unique('follows_dancer_dancer').on(t.dancerId, t.targetDancerId),
  index('follows_profile_idx').on(t.profileId),
  index('follows_target_dancer_idx').on(t.targetDancerId),
  check('follows_exactly_one_target', sql`num_nonnulls(${t.profileId}, ${t.targetDancerId}) = 1`),
])

// Legacy follows from v4 that couldn't be resolved to a profile or dancer
// during the Step 15 migration. Kept for provenance; no app code reads this.
export const legacyFollows = pgTable('legacy_follows', {
  id: uuid('id').primaryKey().defaultRandom(),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id),
  targetUsername: text('target_username').notNull(),
  source: text('source').notNull().default('v4'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique('legacy_follows_dancer_target').on(t.dancerId, t.targetUsername),
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

/**
 * Discover-deck decisions on /my-plan ("Widen your year"). One row per dancer
 * per card: a Yes or a Skip on another dancer, an event or a festival, so a
 * card never comes back once decided (migration 0046). Kept apart from
 * festival_waves on purpose: a wave is a message the other dancer sees, a
 * deck Yes is private bookkeeping. `festival_slug` records the festival that
 * put a dancer on the card — Yes on two or more dancers heading to the same
 * festival raises the "add it to your year?" nudge.
 */
export const discoverSwipes = pgTable('discover_swipes', {
  id: uuid('id').primaryKey().defaultRandom(),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id, { onDelete: 'cascade' }),
  targetKind: text('target_kind').notNull().$type<'dancer' | 'event' | 'festival'>(),
  // A dancer id, an event id, or a festival slug.
  targetId: text('target_id').notNull(),
  decision: text('decision').notNull().$type<'yes' | 'skip'>(),
  festivalSlug: text('festival_slug'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  unique('discover_swipes_unique').on(t.dancerId, t.targetKind, t.targetId),
  index('discover_swipes_dancer_idx').on(t.dancerId),
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

// AI usage log (migration 0038): every Gemini call, for /admin/ai-usage.
export const aiUsage = pgTable('ai_usage', {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  // What the call was: paint · read-back · caption · read-style · style-ideas · …
  purpose: text('purpose').notNull(),
  // The action that started it (tRPC path, e.g. businessFlyers.make).
  source: text('source'),
  model: text('model').notNull(),
  modelVersion: text('model_version'),
  status: text('status').notNull().$type<'ok' | 'refused' | 'error'>(),
  durationMs: integer('duration_ms').notNull(),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTextTokens: integer('output_text_tokens').notNull().default(0),
  outputImageTokens: integer('output_image_tokens').notNull().default(0),
  thoughtTokens: integer('thought_tokens').notNull().default(0),
  costUsd: numeric('cost_usd', { precision: 12, scale: 6 }),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
  flyerId: uuid('flyer_id').references(() => eventFlyers.id, { onDelete: 'set null' }),
  dancerId: uuid('dancer_id').references(() => dancers.id, { onDelete: 'set null' }),
  error: text('error'),
  // The request as sent (0052): its text with "[image N: …]" markers, and the images' type and size.
  prompt: text('prompt'),
  images: jsonb('images').$type<{ mimeType: string; kb: number }[] | null>(),
}, (t) => [index('ai_usage_created_idx').on(t.createdAt), index('ai_usage_purpose_idx').on(t.purpose)])

// Content plan (migration 0037): an event's posts, each with its own flyer
// versions (event_flyers.post_id) and one kept. Kinds: shared/utils/posts.ts.
export const eventPosts = pgTable('event_posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().$type<import('../../shared/utils/posts').PostKind>(),
  // The artist an artist post is about (their handle).
  subject: text('subject'),
  dueOn: date('due_on'),
  // 'post' 4:5 · 'story' 9:16
  format: text('format').notNull().default('post').$type<'post' | 'story'>(),
  status: text('status').notNull().default('planned').$type<'planned' | 'posted' | 'dropped'>(),
  sort: integer('sort').notNull().default(0),
  // Its Instagram caption, like events.caption (the announcement's is events.caption).
  caption: jsonb('caption').$type<{ language: string; text: string; lines: string[]; writtenAt: string } | null>(),
  createdBy: uuid('created_by').references(() => dancers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => [index('event_posts_event_idx').on(t.eventId)])

export const eventFlyers = pgTable('event_flyers', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  // The post this version is for (0037); one kept per post.
  postId: uuid('post_id').references(() => eventPosts.id, { onDelete: 'cascade' }),
  // One sitting: the four directions, or a flyer and its repaints — the versions you compare.
  batchId: uuid('batch_id').notNull(),
  lookId: uuid('look_id').references(() => brandLooks.id, { onDelete: 'set null' }),
  look: jsonb('look').$type<FlyerLookSpec>().notNull(),
  mode: text('mode').notNull().default('paint'), // paint · direction · fix · refresh
  baseFlyerId: uuid('base_flyer_id'),
  status: text('status').notNull().default('painting'), // painting · checking (picture done, words being read) · ready · failed · stopped
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

// ---------------------------------------------------------------------------
// Artist confirmation (migration 0033). An organizer's photos, video and name
// for an artist in their line-up are suggestions on the artist's profile until
// the artist approves them through a personal link (profile_invites).
// ---------------------------------------------------------------------------
export const profileSuggestions = pgTable('profile_suggestions', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().$type<'photo' | 'video' | 'name' | 'bio' | 'city' | 'styles' | 'instagram' | 'website' | 'facebook'>(),
  value: text('value').notNull(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
  suggestedBy: uuid('suggested_by').references(() => dancers.id, { onDelete: 'set null' }),
  status: text('status').notNull().default('pending').$type<'pending' | 'approved' | 'rejected'>(),
  decidedAt: timestamp('decided_at'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => [
  index('profile_suggestions_profile_idx').on(t.profileId, t.status),
  uniqueIndex('profile_suggestions_pending_uidx').on(t.profileId, t.kind, t.value).where(sql`${t.status} = 'pending'`),
])

export const profileInvites = pgTable('profile_invites', {
  id: uuid('id').primaryKey().defaultRandom(),
  token: text('token').notNull(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').references(() => dancers.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at').defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
  // The artist's answer (migration 0034): in or not, programme right or what's
  // wrong, OK for posts using their photo, and anything else they want to say.
  status: text('status').notNull().default('invited').$type<'invited' | 'confirmed' | 'declined' | 'proposed'>(),
  respondedAt: timestamp('responded_at'),
  programmeOk: boolean('programme_ok'),
  programmeNote: text('programme_note'),
  postsOkAt: timestamp('posts_ok_at'),
  message: text('message'),
  // Asking a venue (migration 0035): the same link, kind 'venue'. Status then
  // means can host (confirmed) · another date (proposed) · can't (declined).
  kind: text('kind').notNull().default('artist').$type<'artist' | 'venue'>(),
  request: jsonb('request').$type<import('../../shared/types/venueAsk').VenueRequest | null>(),
  terms: jsonb('terms').$type<import('../../shared/types/venueAsk').VenueTerms | null>(),
  alternative: text('alternative'),
  outcome: text('outcome').$type<'booked' | 'elsewhere' | null>(),
  // When the page's team was last emailed about this link (0035).
  notifiedAt: timestamp('notified_at'),
}, (t) => [
  uniqueIndex('profile_invites_token_uidx').on(t.token),
  uniqueIndex('profile_invites_event_profile_uidx').on(t.eventId, t.profileId),
])

// ---------------------------------------------------------------------------
// Inbound requests (ADR-010, Step 16). Every public-facing request — event
// enquiries, problem reports, gig applications, general contact — is stored
// here first, then delivered to Linear / email by the delivery outbox.
// ---------------------------------------------------------------------------
export const inboundRequests = pgTable('inbound_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: text('kind').notNull().$type<'event_inquiry' | 'problem_report' | 'gig_application' | 'contact'>(),
  status: text('status').notNull().default('new').$type<'new' | 'triaged' | 'in_progress' | 'answered' | 'closed' | 'spam'>(),
  dancerId: uuid('dancer_id').references(() => dancers.id, { onDelete: 'set null' }),
  email: text('email'),
  name: text('name'),
  // Polymorphic links: which entity this request is about (one or none).
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
  profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'set null' }),
  gigId: uuid('gig_id').references(() => gigs.id, { onDelete: 'set null' }),
  // Free-form payload for kind-specific data (subject, message, details).
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (t) => [
  index('inbound_requests_kind_status_idx').on(t.kind, t.status),
  index('inbound_requests_profile_idx').on(t.profileId),
  index('inbound_requests_created_idx').on(t.createdAt),
])

// Delivery outbox (ADR-010, Step 16). Every notification that leaves the app
// (Linear issue, email, push). A cron picks up pending deliveries, sends them,
// and marks them delivered. Retries capped at 3.
export const deliveries = pgTable('deliveries', {
  id: uuid('id').primaryKey().defaultRandom(),
  subjectType: text('subject_type').notNull().$type<'inbound_request' | 'booking_request' | 'booking_inquiry'>(),
  subjectId: uuid('subject_id').notNull(),
  channel: text('channel').notNull().$type<'linear' | 'email'>(),
  target: text('target').notNull(), // email address or Linear team id
  status: text('status').notNull().default('pending').$type<'pending' | 'delivered' | 'failed'>(),
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  externalRef: text('external_ref'), // Linear issue id or email message-id
  createdAt: timestamp('created_at').notNull().defaultNow(),
  deliveredAt: timestamp('delivered_at'),
}, (t) => [
  index('deliveries_status_idx').on(t.status, t.createdAt),
  index('deliveries_subject_idx').on(t.subjectType, t.subjectId),
])

// Booking inquiries (migration 0039): anyone asks to book an artist or venue
// from their page, no account needed. The page's team answers by email.
export const bookingInquiries = pgTable('booking_inquiries', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  requesterId: uuid('requester_id').references(() => dancers.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  email: text('email').notNull(),
  // Optional phone / WhatsApp (migration 0040): only the team sees it.
  phone: text('phone'),
  organization: text('organization'),
  what: text('what').notNull(),
  eventDate: date('event_date'),
  city: text('city'),
  guests: integer('guests'),
  budget: text('budget'),
  message: text('message').notNull(),
  status: text('status').notNull().default('new').$type<'new' | 'answered' | 'declined'>(),
  // How many of the team were emailed (0 = nobody runs the page: WeDance forwards it).
  notified: integer('notified').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  answeredAt: timestamp('answered_at'),
}, (t) => [
  index('booking_inquiries_profile_idx').on(t.profileId, t.createdAt),
  index('booking_inquiries_email_idx').on(t.email, t.createdAt),
])

// A profile's own website, managed on WeDance (RAZ-412, migration 0045): the
// page's sections and words in every language (shared/types/profileSite.ts).
// The site renders GET /api/profiles/<username>/site.
export const profileSites = pgTable('profile_sites', {
  profileId: uuid('profile_id').primaryKey().references(() => profiles.id, { onDelete: 'cascade' }),
  content: jsonb('content').$type<import('../../shared/types/profileSite').ProfileSite>().notNull(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  updatedBy: uuid('updated_by').references(() => dancers.id, { onDelete: 'set null' }),
})

// People who signed up on a profile's website (RAZ-412, migration 0045): the
// profile's contacts on WeDance. One row per email per profile; signing up
// again updates it. Linked to a dancer when the email has a WeDance account.
export const profileContacts = pgTable('profile_contacts', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  dancerId: uuid('dancer_id').references(() => dancers.id, { onDelete: 'set null' }),
  email: text('email').notNull(),
  name: text('name'),
  phone: text('phone'),
  locale: text('locale'),
  // Where they signed up: the site, the form, utm_* and referrer.
  source: jsonb('source').$type<Record<string, string>>().notNull().default({}),
  note: text('note'),
  status: text('status').notNull().default('subscribed').$type<'subscribed' | 'unsubscribed'>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('profile_contacts_profile_email_uidx').on(t.profileId, sql`lower(${t.email})`),
  index('profile_contacts_profile_idx').on(t.profileId, t.createdAt),
])

// ---------------------------------------------------------------------------
// MCP server: WeDance as its own OAuth 2.1 authorization server (migration 0050,
// docs/proposals/2026-10-18-mcp-server.md). Identities stay in `dancers`; an
// assistant (Claude, ChatGPT) gets a grant the dancer consented to: scopes plus
// the business profiles it may act for. Tokens and codes are stored as sha256
// hashes only, never in plain text.
// ---------------------------------------------------------------------------

// A registered app. `id` is the client_id: a random id for Dynamic Client
// Registration (RFC 7591), or the https URL of a Client ID Metadata Document,
// whose fetched document is cached here (`metadataFetchedAt`).
export const oauthClients = pgTable('oauth_clients', {
  id: text('id').primaryKey(),
  kind: text('kind').notNull().$type<'dcr' | 'cimd'>(),
  name: text('name').notNull(),
  redirectUris: jsonb('redirect_uris').$type<string[]>().notNull().default([]),
  clientUri: text('client_uri'),
  logoUri: text('logo_uri'),
  // 'none' (public client, PKCE only) · 'client_secret_post' · 'client_secret_basic'.
  tokenEndpointAuthMethod: text('token_endpoint_auth_method').notNull().default('none'),
  clientSecretHash: text('client_secret_hash'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
  metadataFetchedAt: timestamp('metadata_fetched_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// What a dancer allowed an app: scopes and the profiles it may act for. One
// live grant per dancer + app; consenting again replaces scopes and profiles.
// Revoking (settings → Connected apps, or refresh-token reuse) ends every token.
export const oauthGrants = pgTable('oauth_grants', {
  id: uuid('id').primaryKey().defaultRandom(),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
  profileIds: jsonb('profile_ids').$type<string[]>().notNull().default([]),
  revokedAt: timestamp('revoked_at'),
  revokedReason: text('revoked_reason'),
  lastUsedAt: timestamp('last_used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  index('oauth_grants_dancer_idx').on(t.dancerId),
  index('oauth_grants_client_idx').on(t.clientId),
])

// Authorization codes: single use, a few minutes, bound to the PKCE challenge,
// the exact redirect_uri and the resource (RFC 8707) they were issued for.
export const oauthCodes = pgTable('oauth_codes', {
  codeHash: text('code_hash').primaryKey(),
  grantId: uuid('grant_id').notNull().references(() => oauthGrants.id, { onDelete: 'cascade' }),
  clientId: text('client_id').notNull(),
  redirectUri: text('redirect_uri').notNull(),
  codeChallenge: text('code_challenge').notNull(),
  resource: text('resource').notNull(),
  scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// Access tokens (1 h) and refresh tokens (30 d, rotating). A refresh token is
// spent once (`usedAt`); presenting a spent one again is reuse and revokes the
// whole grant.
export const oauthTokens = pgTable('oauth_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  grantId: uuid('grant_id').notNull().references(() => oauthGrants.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().$type<'access' | 'refresh'>(),
  tokenHash: text('token_hash').notNull().unique(),
  scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
  resource: text('resource').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  revokedAt: timestamp('revoked_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('oauth_tokens_grant_idx').on(t.grantId),
])

// Every MCP tool call: who (grant / dancer / app), which tool, what for
// (`target`: a profile handle or event id), a hash of the input (never the
// input), the outcome and how long it took. `confirmNonce` makes a publish
// confirmation single use.
export const mcpAudit = pgTable('mcp_audit', {
  id: uuid('id').primaryKey().defaultRandom(),
  grantId: uuid('grant_id').references(() => oauthGrants.id, { onDelete: 'set null' }),
  dancerId: uuid('dancer_id').references(() => dancers.id, { onDelete: 'set null' }),
  clientId: text('client_id'),
  tool: text('tool').notNull(),
  target: text('target'),
  profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'set null' }),
  inputHash: text('input_hash').notNull(),
  result: text('result').notNull().$type<'ok' | 'error' | 'preview' | 'denied'>(),
  errorCode: text('error_code'),
  latencyMs: integer('latency_ms'),
  confirmNonce: text('confirm_nonce').unique(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('mcp_audit_grant_idx').on(t.grantId, t.createdAt),
  index('mcp_audit_profile_idx').on(t.profileId, t.createdAt),
])

// Fixed-window rate limits for /mcp and the OAuth endpoints: one row per key
// (token grant or client IP hash) per window. Old windows are pruned as we go.
export const mcpRateLimits = pgTable('mcp_rate_limits', {
  key: text('key').notNull(),
  windowStart: timestamp('window_start').notNull(),
  count: integer('count').notNull().default(0),
}, (t) => [
  uniqueIndex('mcp_rate_limits_key_window_uidx').on(t.key, t.windowStart),
])

// ---------------------------------------------------------------------------
// MCP server, phase 2 (migration 0051, docs/proposals/2026-10-18-mcp-server.md):
// promoter tracked links, gig applications, giveaway proposals.
// ---------------------------------------------------------------------------

// A promoter's (or influencer's) personal link to one event: /events/<slug>?via=<code>.
// One per promoter page + event. The caption cached here is the kit caption
// written for this promoter (promo_kit), so it isn't rewritten on every call.
export const trackedLinks = pgTable('tracked_links', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  createdBy: uuid('created_by').references(() => dancers.id, { onDelete: 'set null' }),
  caption: jsonb('caption').$type<{ language: string; text: string; lines: string[]; writtenAt: string } | null>(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  unique('tracked_links_event_profile').on(t.eventId, t.profileId),
  index('tracked_links_profile_idx').on(t.profileId),
])

// What a tracked link brought: a visit (per browser), a sign-up, a plan add or
// a ticket (per dancer). Each counts once per link. Last touch wins: the link in
// the visitor's `wd_via` cookie when they act.
export const trackedLinkActions = pgTable('tracked_link_actions', {
  id: uuid('id').primaryKey().defaultRandom(),
  linkId: uuid('link_id').notNull().references(() => trackedLinks.id, { onDelete: 'cascade' }),
  kind: text('kind').notNull().$type<'visit' | 'signup' | 'plan_add' | 'ticket'>(),
  dancerId: uuid('dancer_id').references(() => dancers.id, { onDelete: 'cascade' }),
  // Anonymous visits: the browser's session cookie id (never an IP).
  visitorId: text('visitor_id'),
  // The Stripe checkout session for a ticket.
  ref: text('ref'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  uniqueIndex('tracked_link_actions_dancer_uidx').on(t.linkId, t.kind, t.dancerId).where(sql`${t.dancerId} IS NOT NULL`),
  uniqueIndex('tracked_link_actions_visitor_uidx').on(t.linkId, t.kind, t.visitorId).where(sql`${t.dancerId} IS NULL AND ${t.visitorId} IS NOT NULL`),
  index('tracked_link_actions_link_idx').on(t.linkId, t.kind),
])

// An artist applies to a gig role. The gig's poster (or its page's team) accepts
// or declines; the applicant's account email is shared with the poster.
export const gigApplications = pgTable('gig_applications', {
  id: uuid('id').primaryKey().defaultRandom(),
  gigId: uuid('gig_id').notNull().references(() => gigs.id, { onDelete: 'cascade' }),
  dancerId: uuid('dancer_id').notNull().references(() => dancers.id, { onDelete: 'cascade' }),
  // The artist page they apply as (optional).
  profileId: uuid('profile_id').references(() => profiles.id, { onDelete: 'set null' }),
  message: text('message').notNull(),
  status: text('status').notNull().default('pending').$type<'pending' | 'accepted' | 'declined' | 'withdrawn'>(),
  decidedBy: uuid('decided_by').references(() => dancers.id, { onDelete: 'set null' }),
  decidedAt: timestamp('decided_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (t) => [
  unique('gig_applications_gig_dancer').on(t.gigId, t.dancerId),
  index('gig_applications_dancer_idx').on(t.dancerId),
])

// A promoter/influencer proposes a giveaway for an event; only admins create
// giveaways directly, so the event's organizer approves it and it becomes one.
export const giveawayProposals = pgTable('giveaway_proposals', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').notNull().references(() => events.id, { onDelete: 'cascade' }),
  proposedBy: uuid('proposed_by').references(() => dancers.id, { onDelete: 'set null' }),
  // The page proposing it (a promoter or influencer).
  profileId: uuid('profile_id').notNull().references(() => profiles.id, { onDelete: 'cascade' }),
  prize: text('prize').notNull(),
  description: text('description').notNull().default(''),
  sponsorName: text('sponsor_name'),
  endsAt: timestamp('ends_at'),
  status: text('status').notNull().default('pending').$type<'pending' | 'approved' | 'declined'>(),
  note: text('note'),
  giveawayId: uuid('giveaway_id').references(() => giveaways.id, { onDelete: 'set null' }),
  decidedBy: uuid('decided_by').references(() => dancers.id, { onDelete: 'set null' }),
  decidedAt: timestamp('decided_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (t) => [
  index('giveaway_proposals_event_idx').on(t.eventId, t.status),
  index('giveaway_proposals_profile_idx').on(t.profileId),
])
