import { z } from 'zod'
import { eq, and, sql, isNull } from 'drizzle-orm'
import Stripe from 'stripe'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { festivals, festivalSignups, dancers, referrals } from '../../database/schema'
import { getTicketPriceCents, getReferralDiscountPercent } from '../../utils/ticket-prices'
import { festivalPath } from '../../../shared/utils/eventSlug'
import { eventIdForFestival, recordLinkAction } from '../../utils/trackedLinks'
import { trackServer } from '../../utils/posthog'

function getStripe() {
  const config = useRuntimeConfig()
  if (!config.stripeSecretKey) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Stripe is not configured',
    })
  }
  return new Stripe(config.stripeSecretKey)
}

// Roster visibility levels for the public attendee roster.
// See migration 0002_o008_roster_visibility.sql for the full doc.
const visibilityLevel = z.enum(['public_full', 'public_minimal', 'hidden'])
export type RosterVisibility = z.infer<typeof visibilityLevel>


export const festivalSignupRouter = router({
  status: publicProcedure
    .input(z.object({ festivalSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [festival] = await ctx.db
        .select({
          id: festivals.id,
          maxFreeSpots: festivals.maxFreeSpots,
          stripePaymentLink: festivals.stripePaymentLink,
        })
        .from(festivals)
        .where(eq(festivals.slug, input.festivalSlug))

      if (!festival) {
        return { totalSignups: 0, maxFreeSpots: 10, userSignedUp: false, verifiedTicketHolder: false, stripePaymentLink: null }
      }

      const [{ count }] = await ctx.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(festivalSignups)
        .where(eq(festivalSignups.festivalId, festival.id))

      let userSignedUp = false
      let verifiedTicketHolder = false
      if (ctx.dancerId) {
        const [signup] = await ctx.db
          .select({
            id: festivalSignups.id,
            verifiedTicketHolder: festivalSignups.verifiedTicketHolder,
          })
          .from(festivalSignups)
          .where(and(
            eq(festivalSignups.festivalId, festival.id),
            eq(festivalSignups.dancerId, ctx.dancerId),
          ))
        userSignedUp = !!signup
        verifiedTicketHolder = signup?.verifiedTicketHolder ?? false
      }

      return {
        totalSignups: Number(count),
        maxFreeSpots: festival.maxFreeSpots,
        userSignedUp,
        verifiedTicketHolder,
        stripePaymentLink: festival.stripePaymentLink,
      }
    }),

  join: protectedProcedure
    .input(z.object({ festivalSlug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [festival] = await ctx.db
        .select({ id: festivals.id, maxFreeSpots: festivals.maxFreeSpots })
        .from(festivals)
        .where(eq(festivals.slug, input.festivalSlug))

      if (!festival) throw new Error('Festival not found')

      const [{ count }] = await ctx.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(festivalSignups)
        .where(eq(festivalSignups.festivalId, festival.id))

      const totalSignups = Number(count)
      const isFree = totalSignups < festival.maxFreeSpots

      if (!isFree) {
        throw new Error('Free spots are full. Pay EUR 1 to join.')
      }

      try {
        await ctx.db.insert(festivalSignups).values({
          festivalId: festival.id,
          dancerId: ctx.dancerId,
          paidAmount: 0,
        })
      } catch (e: any) {
        const msg = e.message || ''
        const causeMsg = e.cause?.message || ''
        const code = e.cause?.code || ''
        if (msg.includes('unique') || msg.includes('duplicate') ||
            causeMsg.includes('unique') || causeMsg.includes('duplicate') ||
            code === '23505') {
          return { alreadyJoined: true }
        }
        throw e
      }

      if (ctx.viaCode) {
        await recordLinkAction(ctx.db, ctx.viaCode, 'plan_add', { dancerId: ctx.dancerId, eventId: await eventIdForFestival(ctx.db, input.festivalSlug) })
      }
      trackServer(ctx, 'festival_joined', { festival: input.festivalSlug })
      return { joined: true }
    }),

  createCheckoutSession: protectedProcedure
    .input(z.object({ festivalSlug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const [festival] = await ctx.db
        .select({ id: festivals.id, name: festivals.name, maxFreeSpots: festivals.maxFreeSpots })
        .from(festivals)
        .where(eq(festivals.slug, input.festivalSlug))

      if (!festival) throw new Error('Festival not found')

      const [{ count }] = await ctx.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(festivalSignups)
        .where(eq(festivalSignups.festivalId, festival.id))

      if (Number(count) < festival.maxFreeSpots) {
        throw new Error('Free spots still available. Use the free join instead.')
      }

      // Check if already signed up
      const [existing] = await ctx.db
        .select()
        .from(festivalSignups)
        .where(and(
          eq(festivalSignups.festivalId, festival.id),
          eq(festivalSignups.dancerId, ctx.dancerId),
        ))

      if (existing) {
        throw new Error('Already signed up for this festival.')
      }

      const config = useRuntimeConfig()
      const stripe = getStripe()

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: 'eur',
              product_data: {
                name: `WeDance – ${festival.name}`,
                description: 'Unlock social activities: dinners, rides & more',
              },
              unit_amount: 100,
            },
            quantity: 1,
          },
        ],
        metadata: {
          festivalSlug: input.festivalSlug,
          dancerId: ctx.dancerId,
        },
        success_url: `${config.siteUrl}${festivalPath(input.festivalSlug)}?payment=success`,
        cancel_url: `${config.siteUrl}${festivalPath(input.festivalSlug)}?payment=cancel`,
      })

      trackServer(ctx, 'ticket_checkout_started', { festival: input.festivalSlug, tickets: 1, referral: false })
      return { checkoutUrl: session.url }
    }),

  // One-tap ticket checkout — creates a Stripe Checkout session for one
  // or more ticket passes (combo support). Pre-fills the buyer's email
  // from their account so signed-in dancers don't re-enter details.
  //
  // Prices are resolved SERVER-SIDE from the ticket-prices registry —
  // the client sends only ticket names, never amounts.  This prevents
  // price-tampering.
  ticketCheckout: protectedProcedure
    .input(z.object({
      festivalSlug: z.string(),
      ticketNames: z.array(z.string().min(1).max(200)).min(1).max(10),
      referralCode: z.string().min(1).max(100).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Resolve each ticket price server-side.
      const resolved = input.ticketNames.map((name) => {
        const ticket = getTicketPriceCents(input.festivalSlug, name)
        if (!ticket) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `Ticket not found: ${name}` })
        }
        if (ticket.soldOut) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: `This ticket is sold out: ${name}` })
        }
        return { name, priceCents: ticket.priceCents }
      })

      const totalCents = resolved.reduce((sum, t) => sum + t.priceCents, 0)

      const [festival] = await ctx.db
        .select({ id: festivals.id, name: festivals.name })
        .from(festivals)
        .where(eq(festivals.slug, input.festivalSlug))

      if (!festival) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Festival not found' })
      }

      // Prevent duplicate ticket purchase.
      const [existingSignup] = await ctx.db
        .select({
          id: festivalSignups.id,
          verifiedTicketHolder: festivalSignups.verifiedTicketHolder,
        })
        .from(festivalSignups)
        .where(and(
          eq(festivalSignups.festivalId, festival.id),
          eq(festivalSignups.dancerId, ctx.dancerId),
        ))

      if (existingSignup?.verifiedTicketHolder) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You already have a ticket for this festival.',
        })
      }

      // Look up the dancer's email so Stripe can pre-fill the checkout form.
      const [dancer] = await ctx.db
        .select({ email: dancers.email, name: dancers.name })
        .from(dancers)
        .where(eq(dancers.id, ctx.dancerId))

      if (!dancer) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Dancer not found' })
      }

      // ── Referral discount (referee side) ─────────────────────────
      let refereeDiscountCents = 0
      let referrerId: string | null = null
      const discountPercent = input.referralCode
        ? getReferralDiscountPercent(input.festivalSlug)
        : 0

      if (input.referralCode && discountPercent > 0) {
        // Resolve referrer by username, then by dancer ID.
        let referrer: { id: string } | undefined
        const [byUsername] = await ctx.db
          .select({ id: dancers.id })
          .from(dancers)
          .where(eq(dancers.username, input.referralCode))
        if (byUsername) {
          referrer = byUsername
        } else {
          try {
            const [byId] = await ctx.db
              .select({ id: dancers.id })
              .from(dancers)
              .where(eq(dancers.id, input.referralCode))
            if (byId) referrer = byId
          } catch { /* not a valid UUID */ }
        }

        // Can't refer yourself.
        if (referrer && referrer.id !== ctx.dancerId) {
          referrerId = referrer.id
          refereeDiscountCents = Math.round(totalCents * discountPercent / 100)
        }
      }

      // ── Referrer credit (referrer side) ─────────────────────────
      // When the current buyer previously referred others whose payments
      // completed, they earn credits. Pull all unused credits and apply
      // them to this purchase.
      let referrerCreditCents = 0
      let creditReferralIds: string[] = []

      const unusedCredits = await ctx.db
        .select({
          id: referrals.id,
          referrerCreditCents: referrals.referrerCreditCents,
        })
        .from(referrals)
        .where(and(
          eq(referrals.referrerId, ctx.dancerId),
          eq(referrals.status, 'completed'),
          sql`${referrals.referrerCreditCents} > 0`,
          isNull(referrals.referrerCreditAppliedSessionId),
        ))

      if (unusedCredits.length > 0) {
        referrerCreditCents = unusedCredits.reduce(
          (sum: number, r: { referrerCreditCents: number }) => sum + r.referrerCreditCents, 0,
        )
        creditReferralIds = unusedCredits.map((r: { id: string }) => r.id)
      }

      // Total discount = referee referral discount + referrer credit,
      // capped at the ticket total (can't go negative).
      const totalDiscountCents = Math.min(
        refereeDiscountCents + referrerCreditCents,
        totalCents,
      )
      const appliedCreditCents = Math.min(
        referrerCreditCents,
        Math.max(totalCents - refereeDiscountCents, 0),
      )
      const chargedCents = Math.max(totalCents - totalDiscountCents, 0)

      const config = useRuntimeConfig()
      const stripe = getStripe()

      const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = resolved.map((t) => ({
        price_data: {
          currency: 'eur',
          product_data: {
            name: `${festival.name} — ${t.name}`,
          },
          unit_amount: t.priceCents,
        },
        quantity: 1,
      }))

      // Apply a single combined Stripe coupon when any discount is active.
      // Stripe payment-mode sessions only support one discount entry.
      let stripeCouponId: string | undefined
      if (totalDiscountCents > 0) {
        const parts: string[] = []
        if (refereeDiscountCents > 0) parts.push(`Referral ${discountPercent}% off`)
        if (appliedCreditCents > 0) {
          parts.push(`Referrer credit €${(appliedCreditCents / 100).toFixed(2)}`)
        }
        const coupon = await stripe.coupons.create({
          amount_off: totalDiscountCents,
          currency: 'eur',
          duration: 'once',
          name: parts.join(' + '),
        })
        stripeCouponId = coupon.id
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        customer_email: dancer.email,
        line_items: lineItems,
        ...(stripeCouponId ? {
          discounts: [{ coupon: stripeCouponId }],
        } : {}),
        metadata: {
          festivalSlug: input.festivalSlug,
          ticketName: input.ticketNames.join(', '),
          ticketCount: String(input.ticketNames.length),
          dancerId: ctx.dancerId,
          amountCents: String(chargedCents),
          ...(referrerId ? { referrerId, referralDiscount: String(refereeDiscountCents) } : {}),
          ...(appliedCreditCents > 0 ? { referrerCredit: String(appliedCreditCents) } : {}),
          // A promoter's tracked link the buyer came through: credited when paid.
          ...(ctx.viaCode ? { via: ctx.viaCode } : {}),
        },
        success_url: `${config.siteUrl}${festivalPath(input.festivalSlug)}?payment=success`,
        cancel_url: `${config.siteUrl}${festivalPath(input.festivalSlug)}?payment=cancel`,
      })

      // Record the referral (pending until Stripe webhook confirms payment).
      if (referrerId) {
        try {
          await ctx.db.insert(referrals).values({
            festivalId: festival.id,
            referrerId,
            refereeId: ctx.dancerId,
            discountCents: refereeDiscountCents,
            stripeSessionId: session.id,
            status: 'pending',
          })
        } catch {
          // Unique constraint = dancer already has a referral for this festival.
          // Silently continue — the discount is already applied via Stripe.
        }
      }

      // Mark referrer credits as consumed by this checkout session.
      for (const creditId of creditReferralIds) {
        try {
          await ctx.db
            .update(referrals)
            .set({ referrerCreditAppliedSessionId: session.id })
            .where(and(
              eq(referrals.id, creditId),
              isNull(referrals.referrerCreditAppliedSessionId),
            ))
        } catch {
          // Best-effort — the credit is already applied via Stripe coupon.
        }
      }

      trackServer(ctx, 'ticket_checkout_started', { festival: input.festivalSlug, tickets: input.ticketNames.length, referral: !!input.referralCode })
      return {
        checkoutUrl: session.url,
        discountCents: totalDiscountCents,
        discountPercent: refereeDiscountCents > 0 ? discountPercent : 0,
        referrerCreditCents: appliedCreditCents,
      }
    }),

  // Public verified-attendee roster for a festival.
  //
  // Filters to verified ticket holders only and respects each row's
  // `roster_visibility` setting. Stub rows (`dancer_id IS NULL`, created by
  // the TicketTailor webhook before the buyer signs in) have no display
  // identity yet, so they are NOT listed individually — they are surfaced
  // as a single `unclaimed` count alongside the array of attendees.
  publicRoster: publicProcedure
    .input(z.object({ festivalSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [festival] = await ctx.db
        .select({ id: festivals.id })
        .from(festivals)
        .where(eq(festivals.slug, input.festivalSlug))

      if (!festival) {
        return { attendees: [], unclaimed: 0 }
      }

      // Pull every verified row for the festival (claimed + stubs). We
      // post-process in JS — the row count for a single festival is small
      // (hundreds at most) and this keeps the SQL simple while letting us
      // shape the response per visibility level.
      const rows = await ctx.db
        .select({
          id: festivalSignups.id,
          dancerId: festivalSignups.dancerId,
          rosterVisibility: festivalSignups.rosterVisibility,
          dancerName: dancers.name,
          dancerCity: dancers.city,
          dancerPhoto: dancers.photo,
        })
        .from(festivalSignups)
        .leftJoin(dancers, eq(festivalSignups.dancerId, dancers.id))
        .where(and(
          eq(festivalSignups.festivalId, festival.id),
          eq(festivalSignups.verifiedTicketHolder, true),
        ))

      let unclaimed = 0
      const attendees: Array<{
        id: string
        dancerId: string | null
        displayName: string | null
        city: string | null
        photoUrl: string | null
        verifiedTicketHolder: true
      }> = []

      for (const row of rows) {
        // Stub rows: webhook-created, buyer hasn't signed in yet. They have
        // no display name, so we only count them.
        if (!row.dancerId) {
          unclaimed += 1
          continue
        }

        // Hidden rows: buyer opted out of the public roster.
        if (row.rosterVisibility === 'hidden') {
          continue
        }

        const isFull = row.rosterVisibility === 'public_full'
        attendees.push({
          id: row.id,
          dancerId: row.dancerId,
          displayName: row.dancerName ?? null,
          city: row.dancerCity ?? null,
          photoUrl: isFull ? (row.dancerPhoto ?? null) : null,
          verifiedTicketHolder: true,
        })
      }

      return { attendees, unclaimed }
    }),

  // Update the caller's own roster visibility for one festival.
  // Errors if the caller does not have a signup row for `festivalSlug`
  // (you can't set visibility for a festival you haven't joined).
  setMyVisibility: protectedProcedure
    .input(z.object({
      festivalSlug: z.string(),
      level: visibilityLevel,
    }))
    .mutation(async ({ ctx, input }) => {
      const [festival] = await ctx.db
        .select({ id: festivals.id })
        .from(festivals)
        .where(eq(festivals.slug, input.festivalSlug))

      if (!festival) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Festival not found' })
      }

      const [existing] = await ctx.db
        .select({ id: festivalSignups.id })
        .from(festivalSignups)
        .where(and(
          eq(festivalSignups.festivalId, festival.id),
          eq(festivalSignups.dancerId, ctx.dancerId),
        ))

      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'You have no signup for this festival yet.',
        })
      }

      await ctx.db
        .update(festivalSignups)
        .set({ rosterVisibility: input.level })
        .where(and(
          eq(festivalSignups.festivalId, festival.id),
          eq(festivalSignups.dancerId, ctx.dancerId),
        ))

      return { level: input.level }
    }),

  // Read the caller's current visibility for a festival. Returns the
  // configured level, or `null` if the caller has no signup row yet
  // (so the UI can fall back to a sensible default before the user joins).
  getMyVisibility: protectedProcedure
    .input(z.object({ festivalSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [festival] = await ctx.db
        .select({ id: festivals.id })
        .from(festivals)
        .where(eq(festivals.slug, input.festivalSlug))

      if (!festival) return { level: null as RosterVisibility | null }

      const [row] = await ctx.db
        .select({ level: festivalSignups.rosterVisibility })
        .from(festivalSignups)
        .where(and(
          eq(festivalSignups.festivalId, festival.id),
          eq(festivalSignups.dancerId, ctx.dancerId),
        ))

      return { level: (row?.level ?? null) as RosterVisibility | null }
    }),

  // Return all festival slugs where the current user has a paid ticket.
  // Used by /my-plan to sync ticket-bought state from the backend.
  myTickets: protectedProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({ festivalSlug: festivals.slug })
        .from(festivalSignups)
        .innerJoin(festivals, eq(festivalSignups.festivalId, festivals.id))
        .where(and(
          eq(festivalSignups.dancerId, ctx.dancerId),
          sql`${festivalSignups.paidAmount} > 0`,
        ))

      return rows.map(r => r.festivalSlug)
    }),
})
