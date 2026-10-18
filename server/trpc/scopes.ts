import { TRPCError } from '@trpc/server'
import { hasScope, type Scope } from '../oauth/config'

/**
 * Which OAuth scope each procedure needs when it's called with a connected
 * app's token (MCP). Web sessions carry no scopes (`ctx.scopes == null`) and
 * skip this entirely.
 *
 * Default deny: a procedure missing from this map can't be called with a
 * token at all, so a new procedure is never exposed to assistants by
 * accident. `null` = no scope needed (public data; the procedure's own guard
 * still applies).
 */
export const PROCEDURE_SCOPES: Record<string, Scope | null> = {
  // Public reads.
  'events.byCity': null,
  'events.get': null,
  'events.festival': null,
  'events.festivals': null,
  'events.byProfile': null,
  'entity.getByHandle': null,
  'entity.cityDirectory': null,
  'entity.promoterRoster': null,
  'profile.getByUsername': null,
  'plan.goingList': null,
  'plan.sharedPlan': null,
  'askLocals.listByCity': null,
  'festivalSignup.publicRoster': null,
  'festivalSignup.status': null,
  'rideShare.list': null,
  'roommate.list': null,
  'dinner.list': null,
  'hangouts.listTonight': null,
  'hangouts.listByEvent': null,
  'giveaway.listActive': null,
  'cityVideo.cityLeaderboard': null,
  'cityVideo.getPair': null,
  'gigs.list': null,
  'gigs.getById': null,
  'review.list': null,
  'booking.availabilityForProfile': null,

  // me:read — the dancer's own data.
  'auth.me': 'me:read',
  'auth.myEmail': 'me:read',
  'plan.myPlan': 'me:read',
  'plan.list': 'me:read',
  'festivalSignup.myTickets': 'me:read',
  'follow.myFollows': 'me:read',
  'referral.myReferrals': 'me:read',
  'gigs.myApplications': 'me:read',

  // plan:write
  'plan.add': 'plan:write',
  'plan.remove': 'plan:write',
  'plan.setShareGoing': 'plan:write',
  'festivalSignup.join': 'plan:write',
  'festivalSignup.ticketCheckout': 'plan:write',
  'rideShare.create': 'plan:write',
  'roommate.toggle': 'plan:write',

  // social:write
  'askLocals.ask': 'social:write',
  'askLocals.recommend': 'social:write',
  'hangouts.toggleRsvp': 'social:write',
  'dinner.join': 'social:write',
  'follow.toggle': 'social:write',
  'follow.isFollowing': 'social:write',
  'review.create': 'social:write',
  'inquiries.send': 'social:write',
  'giveaway.enter': 'social:write',
  'cityVideo.vote': 'social:write',
  'profile.update': 'social:write',
  // Applying shares the dancer's message and email with the gig's poster, like inquiries.send.
  'gigs.applyTo': 'social:write',

  // business:read — only for the profiles the grant names (profile checks in the routers).
  'business.myProfiles': 'business:read',
  'business.spaces': 'business:read',
  'business.get': 'business:read',
  'businessEvents.list': 'business:read',
  'businessEvents.get': 'business:read',
  'businessEvents.inbox': 'business:read',
  'businessEvents.venueIdeas': 'business:read',
  'businessEvents.searchProfiles': 'business:read',
  'businessFlyers.state': 'business:read',
  'businessFlyers.batch': 'business:read',
  'businessPosts.list': 'business:read',
  'inquiries.forProfile': 'business:read',
  'businessTeam.team': 'business:read',
  'festivalInsights.myFestivals': 'business:read',
  'festivalInsights.styleLevelMix': 'business:read',
  'artistInvites.get': 'business:read',
  'businessEvents.seriesPreview': 'business:read',
  'businessEvents.series': 'business:read',
  'businessEvents.attendees': 'business:read',
  'gigs.applications': 'business:read',
  // Tracked links: the link is made on first use (no visible change, idempotent).
  'referral.myLink': 'business:read',
  'referral.myResults': 'business:read',
  'referral.promoterDashboard': 'business:read',
  'referral.eventLinkResults': 'business:read',
  // Read-only-ish: may paint the event's first flyer / write a caption (drafts nobody sees).
  'referral.promoKit': 'business:read',
  'giveaway.proposals': 'business:read',

  // business:write — drafts. Publishing through these needs business:publish
  // too (businessEvents.create/update/duplicate check it themselves).
  'businessEvents.create': 'business:write',
  'businessEvents.update': 'business:write',
  'businessEvents.duplicate': 'business:write',
  'businessEvents.archive': 'business:write',
  'businessEvents.addFromInstagram': 'business:write',
  'businessFlyers.make': 'business:write',
  'businessFlyers.directions': 'business:write',
  'businessFlyers.fix': 'business:write',
  'businessPosts.writeCaptions': 'business:write',
  'businessPosts.propose': 'business:write',
  'inquiries.setStatus': 'business:write',
  'inquiries.addToEvent': 'business:write',
  'booking.setAvailability': 'business:write',
  // Publishing the dates needs business:publish too (checked inside).
  'businessEvents.createSeries': 'business:write',
  // A request the event's team decides on; nothing goes public by it.
  'giveaway.propose': 'business:write',

  // business:publish — goes public or reaches another person.
  'business.update': 'business:publish',
  'artistInvites.link': 'business:publish',
  'artistInvites.notify': 'business:publish',
  'artistInvites.respond': 'business:publish',
  'artistInvites.claim': 'business:publish',
  'businessTeam.decideJoin': 'business:publish',
  'businessTeam.setRole': 'business:publish',
  'gigs.create': 'business:publish',
  'businessEvents.publishSeries': 'business:publish',
  'gigs.decideApplication': 'business:publish',
  'giveaway.decideProposal': 'business:publish',

  // admin — adminProcedure also requires ctx.isAdmin, which a token only
  // carries for an admin on an allowlisted app.
  'business.listClaims': 'admin',
  'cityVideo.pendingList': 'admin',
}

export interface ScopedCtx {
  scopes?: readonly string[] | null
}

/** Throws unless a token-authenticated caller holds `scope`. Web sessions always pass. */
export function assertScope(ctx: ScopedCtx, scope: Scope) {
  if (ctx.scopes == null) return
  if (!hasScope(ctx.scopes, scope)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: `insufficient_scope: this needs the "${scope}" permission. Reconnect the app and allow it.` })
  }
}

/** The check the base procedure runs for every call: default deny for tokens. */
export function checkProcedureScope(ctx: ScopedCtx, path: string) {
  if (ctx.scopes == null) return
  if (!(path in PROCEDURE_SCOPES)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: `${path} isn’t available to connected apps.` })
  }
  const needed = PROCEDURE_SCOPES[path]
  if (needed) assertScope(ctx, needed)
}
