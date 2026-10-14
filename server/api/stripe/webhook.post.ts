import Stripe from 'stripe'
import { eq, and } from 'drizzle-orm'
import { useDb } from '../../utils/db'
import { festivals, festivalSignups, dancers, organizerSubscriptions } from '../../database/schema'
import { sendTicketConfirmationEmail } from '../../utils/email'
import { completeReferral, expireReferral } from './webhook.lib'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  if (!config.stripeSecretKey) {
    throw createError({ statusCode: 503, statusMessage: 'Stripe is not configured' })
  }
  const stripe = new Stripe(config.stripeSecretKey)

  const body = await readRawBody(event)
  const signature = getHeader(event, 'stripe-signature')

  if (!body || !signature) {
    throw createError({ statusCode: 400, statusMessage: 'Missing body or signature' })
  }

  let stripeEvent: Stripe.Event
  try {
    stripeEvent = stripe.webhooks.constructEvent(body, signature, config.stripeWebhookSecret)
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err.message)
    throw createError({ statusCode: 400, statusMessage: 'Invalid signature' })
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object as Stripe.Checkout.Session

    const festivalSlug = session.metadata?.festivalSlug
    const dancerId = session.metadata?.dancerId

    if (!festivalSlug || !dancerId) {
      console.error('Stripe webhook missing metadata:', session.metadata)
      throw createError({ statusCode: 400, statusMessage: 'Missing metadata' })
    }

    // Ticket checkouts carry an amountCents metadata field with the
    // server-validated price. Fall back to the Stripe session total
    // (which equals the line-item sum), then to 100 (the €1 social
    // unlock amount) for backwards-compat with old sessions.
    const paidAmount = session.metadata?.amountCents
      ? Number(session.metadata.amountCents)
      : session.amount_total ?? 100

    // Ticket checkouts should mark the buyer as a verified ticket holder
    // so they appear on the attendee roster.
    const isTicketCheckout = !!session.metadata?.ticketName

    const db = useDb()

    const [festival] = await db
      .select({ id: festivals.id, name: festivals.name, startDate: festivals.startDate, endDate: festivals.endDate })
      .from(festivals)
      .where(eq(festivals.slug, festivalSlug))

    if (!festival) {
      console.error('Stripe webhook: festival not found:', festivalSlug)
      throw createError({ statusCode: 400, statusMessage: 'Festival not found' })
    }

    // Idempotent insert — ignore conflict on unique(festivalId, dancerId)
    let isDuplicate = false
    try {
      await db.insert(festivalSignups).values({
        festivalId: festival.id,
        dancerId,
        paidAmount,
        stripeSessionId: session.id,
        ...(isTicketCheckout ? { verifiedTicketHolder: true } : {}),
      })
    } catch (e: any) {
      const msg = e.message || ''
      const causeMsg = e.cause?.message || ''
      const code = e.cause?.code || ''
      if (msg.includes('unique') || msg.includes('duplicate') ||
          causeMsg.includes('unique') || causeMsg.includes('duplicate') ||
          code === '23505') {
        // Already signed up — idempotent, just return OK
        console.log('Stripe webhook: duplicate signup ignored for', dancerId, festivalSlug)
        isDuplicate = true
      } else {
        throw e
      }
    }

    // Mark referral as completed if this checkout carried a referral.
    // Runs on every delivery (including retries where the signup is a duplicate)
    // because the referral row may still be 'pending' even if the signup already
    // exists. The UPDATE is inherently idempotent.
    if (session.metadata?.referrerId) {
      try {
        await completeReferral(db, session.id)
      } catch (refErr) {
        console.error('Stripe webhook: referral completion failed:', refErr)
      }
    }

    // Send confirmation email after a NEW signup is persisted.
    // Fire-and-forget: a Resend failure must not break the webhook.
    if (!isDuplicate) {
      try {
        const [dancer] = await db
          .select({ email: dancers.email, name: dancers.name })
          .from(dancers)
          .where(eq(dancers.id, dancerId))

        if (dancer?.email) {
          await sendTicketConfirmationEmail({
            to: dancer.email,
            buyerName: dancer.name || 'Dancer',
            festivalName: festival.name,
            festivalSlug,
            startDate: festival.startDate,
            endDate: festival.endDate,
            ticketName: session.metadata?.ticketName ?? null,
            amountCents: paidAmount,
          })
        }
      } catch (emailErr) {
        console.error('Stripe webhook: confirmation email failed:', emailErr)
      }
    }
  }

  // When a checkout session expires without payment, mark any associated
  // referral as 'expired' so the referee can use a new referral link later.
  if (stripeEvent.type === 'checkout.session.expired') {
    const session = stripeEvent.data.object as Stripe.Checkout.Session
    if (session.metadata?.referrerId) {
      try {
        await expireReferral(useDb(), session.id)
      } catch (refErr) {
        console.error('Stripe webhook: referral expiration failed:', refErr)
      }
    }
  }

  // --- Organizer subscription lifecycle (RAZ-106) ---

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object as Stripe.Checkout.Session
    if (session.mode === 'subscription' && session.metadata?.plan === 'network') {
      const profileId = session.metadata.profileId
      const dancerId = session.metadata.dancerId
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : (session.subscription as Stripe.Subscription | null)?.id

      if (profileId && dancerId && subscriptionId) {
        const db = useDb()
        const sub = await stripe.subscriptions.retrieve(subscriptionId)

        try {
          await db.insert(organizerSubscriptions).values({
            profileId,
            dancerId,
            plan: 'network',
            status: 'active',
            stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id ?? null,
            stripeSubscriptionId: sub.id,
            currentPeriodStart: new Date(sub.current_period_start * 1000),
            currentPeriodEnd: new Date(sub.current_period_end * 1000),
          })
        } catch (e: any) {
          // Idempotent: ignore duplicate on stripe_subscription_id unique constraint
          if (!(e.message?.includes('unique') || e.message?.includes('duplicate') || e.cause?.code === '23505')) {
            throw e
          }
        }
      }
    }
  }

  if (stripeEvent.type === 'customer.subscription.updated') {
    const sub = stripeEvent.data.object as Stripe.Subscription
    const db = useDb()

    const status = sub.status === 'active' ? 'active'
      : sub.status === 'past_due' ? 'past_due'
        : sub.status === 'unpaid' ? 'unpaid'
          : sub.status === 'canceled' ? 'canceled'
            : null

    if (status) {
      await db.update(organizerSubscriptions)
        .set({
          status,
          currentPeriodStart: new Date(sub.current_period_start * 1000),
          currentPeriodEnd: new Date(sub.current_period_end * 1000),
          canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
        })
        .where(eq(organizerSubscriptions.stripeSubscriptionId, sub.id))
    }
  }

  if (stripeEvent.type === 'customer.subscription.deleted') {
    const sub = stripeEvent.data.object as Stripe.Subscription
    const db = useDb()

    await db.update(organizerSubscriptions)
      .set({
        status: 'canceled',
        canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : new Date(),
      })
      .where(eq(organizerSubscriptions.stripeSubscriptionId, sub.id))
  }

  return { received: true }
})
