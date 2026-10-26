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
    summary: 'Dancer accounts, credentials and login sessions, and the apps (MCP assistants) dancers connect via OAuth.',
    tables: ['dancers', 'sessions', 'oauthClients', 'oauthGrants', 'oauthCodes', 'oauthTokens', 'mcpAudit', 'mcpRateLimits'],
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
    summary: 'Dated public events (v4 archive + live v3 mirror), their flyers and the hosts\' saved flyer looks, each dancer\'s week/year plan, the unified attendance model, and the organiser\'s RSVP poll.',
    tables: ['events', 'planItems', 'discoverSwipes', 'attendances', 'eventRsvps', 'dancerGoals', 'brandLooks', 'eventFlyers', 'eventPosts', 'aiUsage'],
  },
  {
    id: 'directory',
    title: 'Profiles & cities',
    summary: 'Venue / artist / organiser profiles under /@handle, canonical cities, follows and the per-city community-group directory.',
    tables: ['profiles', 'profileMembers', 'profileClaims', 'profileAccessLog', 'profileSuggestions', 'profileInvites', 'follows', 'legacyFollows', 'profileAffiliations', 'handles', 'organizerSubscriptions', 'networkLinks', 'profileSites', 'profileContacts', 'cities', 'communityGroups', 'communityGroupReports'],
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
    summary: 'City video voting and battles, giveaways (and the ones promoters propose), reviews, "ask locals" recommendations, and promoters\' tracked links with what they brought.',
    tables: ['cityVideos', 'videoVotes', 'cityBattleVotes', 'giveaways', 'giveawayEntries', 'giveawayProposals', 'reviews', 'recommendationRequests', 'trackedLinks', 'trackedLinkActions'],
  },
  {
    id: 'opportunities',
    title: 'Gigs & hangouts',
    summary: 'The gig board (open roles and offered services, artists\' applications) and tonight\'s hangouts with RSVPs.',
    tables: ['gigs', 'gigApplications', 'hangouts', 'hangoutRsvps'],
  },
]
