import { router } from './trpc'
import { authRouter } from './routers/auth'
import { dinnerRouter } from './routers/dinner'
import { festivalSignupRouter } from './routers/festivalSignup'
import { adminRouter } from './routers/admin'
import { claimRouter } from './routers/claim'
import { festivalRouter } from './routers/festival'
import { festivalInsightsRouter } from './routers/festivalInsights'
import { cityVideoRouter } from './routers/cityVideo'
import { giveawayRouter } from './routers/giveaway'
import { profileRouter } from './routers/profile'
import { reviewRouter } from './routers/review'
import { communityGroupRouter } from './routers/communityGroup'
import { askLocalsRouter } from './routers/askLocals'
import { entityRouter } from './routers/entity'
import { bookingRouter } from './routers/booking'
import { electionRouter } from './routers/election'
import { feedbackRouter } from './routers/feedback'
import { gigsRouter } from './routers/gigs'
import { hangoutsRouter } from './routers/hangouts'
import { eventsRouter } from './routers/events'
import { planRouter } from './routers/plan'
import { rideShareRouter } from './routers/rideShare'
import { referralRouter } from './routers/referral'
import { roommateRouter } from './routers/roommate'
import { followRouter } from './routers/follow'
import { businessRouter } from './routers/business'
import { businessEventsRouter } from './routers/businessEvents'
import { businessFlyersRouter } from './routers/businessFlyers'
import { artistInvitesRouter } from './routers/artistInvites'
import { venueAsksRouter } from './routers/venueAsks'
import { inquiriesRouter } from './routers/inquiries'
import { businessPostsRouter } from './routers/businessPosts'
import { businessLooksRouter } from './routers/businessLooks'
import { businessTeamRouter } from './routers/businessTeam'
import { businessNetworkRouter } from './routers/businessNetwork'
import { waveRouter } from './routers/wave'
import { organizerSubscriptionRouter } from './routers/organizerSubscription'
import { attendanceRouter } from './routers/attendance'

export const appRouter = router({
  auth: authRouter,
  dinner: dinnerRouter,
  festivalSignup: festivalSignupRouter,
  admin: adminRouter,
  claim: claimRouter,
  festival: festivalRouter,
  festivalInsights: festivalInsightsRouter,
  cityVideo: cityVideoRouter,
  giveaway: giveawayRouter,
  profile: profileRouter,
  review: reviewRouter,
  communityGroup: communityGroupRouter,
  askLocals: askLocalsRouter,
  entity: entityRouter,
  booking: bookingRouter,
  election: electionRouter,
  feedback: feedbackRouter,
  gigs: gigsRouter,
  hangouts: hangoutsRouter,
  events: eventsRouter,
  plan: planRouter,
  referral: referralRouter,
  rideShare: rideShareRouter,
  follow: followRouter,
  business: businessRouter,
  businessEvents: businessEventsRouter,
  businessFlyers: businessFlyersRouter,
  artistInvites: artistInvitesRouter,
  venueAsks: venueAsksRouter,
  inquiries: inquiriesRouter,
  businessPosts: businessPostsRouter,
  businessLooks: businessLooksRouter,
  businessTeam: businessTeamRouter,
  businessNetwork: businessNetworkRouter,
  roommate: roommateRouter,
  wave: waveRouter,
  organizerSubscription: organizerSubscriptionRouter,
  attendance: attendanceRouter,
})

export type AppRouter = typeof appRouter
