/**
 * Bounded-context grouping for the data model index (/docs/architecture/data).
 *
 * This is the ONLY hand-maintained part of the generated data docs. It is
 * drift-checked: scripts/architecture/generate.test.ts fails when a table in
 * server/database/schema.ts is missing here, or when a name here is no longer a
 * table — so adding a table forces a conscious "which context owns this?".
 * Keys are the Drizzle export names (camelCase), not SQL names.
 */
export interface Domain {
  id: string
  title: string
  summary: string
  tables: string[]
}

export const DOMAINS: Domain[] = [
  {
    id: 'identity',
    title: 'Identity & auth',
    summary: 'Dancer accounts, credentials and login sessions.',
    tables: ['dancers', 'sessions'],
  },
  {
    id: 'festivals',
    title: 'Festivals & ticketing',
    summary: 'Festival listings, sign-ups and verified tickets, referrals, organiser submissions, and the per-festival social layer (waves, rides, roommates).',
    tables: ['festivals', 'festivalSignups', 'festivalSubmissions', 'referrals', 'festivalWaves', 'festivalRideShares', 'festivalRoommateLookups'],
  },
  {
    id: 'dinners',
    title: 'Festival dinners',
    summary: 'Dinner slots at festivals, sign-ups and the generated dinner groups.',
    tables: ['dinners', 'dinnerSignups', 'dinnerGroups', 'dinnerGroupMembers'],
  },
  {
    id: 'events',
    title: 'Events & plans',
    summary: 'Dated public events (v4 archive + live v3 mirror), their flyers and the hosts\' saved flyer looks, each dancer\'s week/year plan, and the unified attendance model.',
    tables: ['events', 'planItems', 'discoverSwipes', 'attendances', 'dancerGoals', 'brandLooks', 'eventFlyers', 'eventPosts', 'aiUsage'],
  },
  {
    id: 'directory',
    title: 'Profiles & cities',
    summary: 'Venue / artist / organiser profiles under /@handle, canonical cities, follows and the per-city community-group directory.',
    tables: ['profiles', 'profileMembers', 'profileClaims', 'profileAccessLog', 'profileSuggestions', 'profileInvites', 'follows', 'legacyFollows', 'profileAffiliations', 'handles', 'organizerSubscriptions', 'networkLinks', 'cities', 'communityGroups', 'communityGroupReports'],
  },
  {
    id: 'booking',
    title: 'Venue booking & governance',
    summary: 'Bookable spaces, availability and booking requests, plus moderator elections and guideline versions for free community spaces.',
    tables: ['bookableSpaces', 'availabilitySlots', 'bookingRequests', 'bookingInquiries', 'moderatorElections', 'electionCandidates', 'electionVotes', 'electionVoteHistory', 'guidelineVersions', 'inboundRequests', 'deliveries'],
  },
  {
    id: 'engagement',
    title: 'Community engagement',
    summary: 'City video voting and battles, giveaways, reviews and "ask locals" recommendations.',
    tables: ['cityVideos', 'videoVotes', 'cityBattleVotes', 'giveaways', 'giveawayEntries', 'reviews', 'recommendationRequests'],
  },
  {
    id: 'opportunities',
    title: 'Gigs & hangouts',
    summary: 'The gig board (open roles and offered services) and tonight\'s hangouts with RSVPs.',
    tables: ['gigs', 'hangouts', 'hangoutRsvps'],
  },
]
