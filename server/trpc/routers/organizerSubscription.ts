import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import Stripe from 'stripe'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure, publicProcedure } from '../trpc'
import { organizerSubscriptions, profiles, profileMembers, dancers } from '../../database/schema'
import { profileGroup, trackServer } from '../../utils/posthog'

function getStripe() {
  const config = useRuntimeConfig()
  if (!config.stripeSecretKey) {
    throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Stripe is not configured' })
  }
  return new Stripe(config.stripeSecretKey)
}

export const organizerSubscriptionRouter = router({
  /**
   * Returns the active Network subscription for a profile, or null.
   * Public so the organizers page can show the plan status without auth.
   */
  getStatus: publicProcedure
    .input(z.object({ profileId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [sub] = await ctx.db
        .select({
          id: organizerSubscriptions.id,
          plan: organizerSubscriptions.plan,
          status: organizerSubscriptions.status,
          currentPeriodEnd: organizerSubscriptions.currentPeriodEnd,
        })
        .from(organizerSubscriptions)
        .where(and(
          eq(organizerSubscriptions.profileId, input.profileId),
          eq(organizerSubscriptions.status, 'active'),
        ))
        .limit(1)

      return sub ?? null
    }),

  /**
   * Creates a Stripe Checkout session for the Network plan (mode: subscription).
   * The caller must own/manage the organizer profile.
   */
  createCheckout: protectedProcedure
    .input(z.object({ profileId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const config = useRuntimeConfig()
      if (!config.stripeNetworkPriceId) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'Network plan price is not configured',
        })
      }

      // Verify the caller manages this profile
      const [profile] = await ctx.db
        .select({ id: profiles.id, name: profiles.name, type: profiles.type, username: profiles.username })
        .from(profiles)
        .where(eq(profiles.id, input.profileId))

      if (!profile) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found' })
      }

      const [member] = await ctx.db
        .select({ role: profileMembers.role })
        .from(profileMembers)
        .where(and(
          eq(profileMembers.profileId, input.profileId),
          eq(profileMembers.dancerId, ctx.dancerId),
        ))

      if (!member) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not manage this profile' })
      }

      // Check for existing active subscription
      const [existing] = await ctx.db
        .select({ id: organizerSubscriptions.id })
        .from(organizerSubscriptions)
        .where(and(
          eq(organizerSubscriptions.profileId, input.profileId),
          eq(organizerSubscriptions.status, 'active'),
        ))
        .limit(1)

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This profile already has an active Network subscription',
        })
      }

      // Resolve the buyer's email for Stripe
      const [dancer] = await ctx.db
        .select({ email: dancers.email })
        .from(dancers)
        .where(eq(dancers.id, ctx.dancerId))

      const stripe = getStripe()

      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: config.stripeNetworkPriceId, quantity: 1 }],
        metadata: {
          profileId: input.profileId,
          dancerId: ctx.dancerId,
          plan: 'network',
        },
        customer_email: dancer?.email || undefined,
        success_url: `${config.siteUrl}/organizers?subscribed=1`,
        cancel_url: `${config.siteUrl}/organizers`,
      })

      trackServer(ctx, 'subscription_checkout_started', { plan: 'network', profile_type: profile.type, ...profileGroup(profile.username) })
      return { checkoutUrl: session.url }
    }),
})
