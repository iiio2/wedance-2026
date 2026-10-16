import { z } from 'zod'
import { eq, and, desc, gte } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { hangouts, hangoutRsvps, dancers, cities } from '../../database/schema'
import { resolveTimezone } from '../../utils/v3EventSync'
import { nightStart } from '../../../shared/utils/eventTime'

const hangoutKind = z.enum(['dinner', 'bar', 'ride', 'floor', 'coffee'])

/**
 * Hangouts — spontaneous activities where dancers can mark they're out.
 * A hangout belongs to the night it was posted: it shows until 06:00 local
 * time in its city the next morning, or until the creator closes it.
 */
export const hangoutsRouter = router({
  // List tonight's active hangouts for a city
  listTonight: publicProcedure
    .input(z.object({
      citySlug: z.string(),
    }))
    .query(async ({ ctx, input }) => {
      const [city] = await ctx.db
        .select({ countryCode: cities.countryCode, lng: cities.lng })
        .from(cities)
        .where(eq(cities.slug, input.citySlug))
        .limit(1)
      const since = nightStart(new Date(), city ? resolveTimezone(city.countryCode, city.lng) : undefined)

      const rows = await ctx.db
        .select({
          id: hangouts.id,
          kind: hangouts.kind,
          title: hangouts.title,
          time: hangouts.time,
          venue: hangouts.venue,
          host: hangouts.host,
          peopleCount: hangouts.peopleCount,
          status: hangouts.status,
          dancerId: hangouts.dancerId,
          eventId: hangouts.eventId,
          createdAt: hangouts.createdAt,
        })
        .from(hangouts)
        .where(
          and(
            eq(hangouts.citySlug, input.citySlug),
            eq(hangouts.status, 'active'),
            gte(hangouts.createdAt, since),
          ),
        )
        .orderBy(desc(hangouts.createdAt))

      // Fetch RSVPs in a second pass for proper aggregation
      const withRsvps = await Promise.all(
        rows.map(async (h) => {
          const rsvps = await ctx.db
            .select({
              dancerId: hangoutRsvps.dancerId,
              dancer: {
                name: dancers.name,
              },
            })
            .from(hangoutRsvps)
            .leftJoin(dancers, eq(hangoutRsvps.dancerId, dancers.id))
            .where(eq(hangoutRsvps.hangoutId, h.id))

          return {
            ...h,
            rsvpCount: rsvps.length,
            rsvps: rsvps.map(r => r.dancerId),
          }
        }),
      )

      return withRsvps
    }),

  // List active hangouts linked to a specific event
  listByEvent: publicProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: hangouts.id,
          kind: hangouts.kind,
          title: hangouts.title,
          time: hangouts.time,
          venue: hangouts.venue,
          host: hangouts.host,
          peopleCount: hangouts.peopleCount,
          status: hangouts.status,
          dancerId: hangouts.dancerId,
          eventId: hangouts.eventId,
          createdAt: hangouts.createdAt,
        })
        .from(hangouts)
        .where(
          and(
            eq(hangouts.eventId, input.eventId),
            eq(hangouts.status, 'active'),
          ),
        )
        .orderBy(desc(hangouts.createdAt))

      const withRsvps = await Promise.all(
        rows.map(async (h) => {
          const rsvps = await ctx.db
            .select({ dancerId: hangoutRsvps.dancerId })
            .from(hangoutRsvps)
            .where(eq(hangoutRsvps.hangoutId, h.id))
          return {
            ...h,
            rsvpCount: rsvps.length,
            rsvps: rsvps.map(r => r.dancerId),
          }
        }),
      )

      return withRsvps
    }),

  // Create a new hangout (authenticated only)
  create: protectedProcedure
    .input(z.object({
      kind: hangoutKind,
      title: z.string().min(1),
      time: z.string().regex(/^\d{2}:\d{2}$/),
      venue: z.string().optional(),
      host: z.string().optional(),
      citySlug: z.string().min(1),
      eventId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Resolve host name from the creator's profile when not supplied
      let host = input.host
      if (!host) {
        const [dancer] = await ctx.db
          .select({ name: dancers.name })
          .from(dancers)
          .where(eq(dancers.id, ctx.dancerId))
        host = dancer?.name ?? undefined
      }

      let result: typeof hangouts.$inferSelect
      try {
        const [row] = await ctx.db
          .insert(hangouts)
          .values({
            kind: input.kind,
            title: input.title,
            time: input.time,
            venue: input.venue,
            host,
            citySlug: input.citySlug,
            eventId: input.eventId,
            peopleCount: 1,
            dancerId: ctx.dancerId,
            status: 'active',
          })
          .returning()

        if (!row) {
          throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create hangout' })
        }
        result = row
      } catch (e: any) {
        if (e instanceof TRPCError) throw e
        const dbMessage = e?.cause?.message || e?.message || 'unknown'
        console.error('[hangouts.create] DB error:', dbMessage, e)
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not create hangout. Please try again later.',
        })
      }

      // Auto-RSVP the creator so "1 in" shows immediately
      try {
        await ctx.db
          .insert(hangoutRsvps)
          .values({ hangoutId: result.id, dancerId: ctx.dancerId })
      } catch (e: any) {
        const dbMessage = e?.cause?.message || e?.message || 'unknown'
        console.error('[hangouts.create] RSVP error:', dbMessage, e)
        // Hangout was created — don't fail the whole request for RSVP
      }

      return result
    }),

  // Toggle RSVP for current user
  toggleRsvp: protectedProcedure
    .input(z.object({ hangoutId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Check if hangout exists
      const [hangout] = await ctx.db
        .select()
        .from(hangouts)
        .where(eq(hangouts.id, input.hangoutId))

      if (!hangout) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Hangout not found' })
      }

      // Check if RSVP already exists
      const [existing] = await ctx.db
        .select()
        .from(hangoutRsvps)
        .where(
          and(
            eq(hangoutRsvps.hangoutId, input.hangoutId),
            eq(hangoutRsvps.dancerId, ctx.dancerId),
          ),
        )

      if (existing) {
        // Remove RSVP
        await ctx.db
          .delete(hangoutRsvps)
          .where(
            and(
              eq(hangoutRsvps.hangoutId, input.hangoutId),
              eq(hangoutRsvps.dancerId, ctx.dancerId),
            ),
          )

        return { rsvpd: false }
      } else {
        // Add RSVP
        await ctx.db
          .insert(hangoutRsvps)
          .values({
            hangoutId: input.hangoutId,
            dancerId: ctx.dancerId,
          })

        return { rsvpd: true }
      }
    }),

  // Close a hangout (authenticated owner only)
  close: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [hangout] = await ctx.db
        .select()
        .from(hangouts)
        .where(eq(hangouts.id, input.id))

      if (!hangout) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Hangout not found' })
      }

      if (hangout.dancerId !== ctx.dancerId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You can only close your own hangouts' })
      }

      await ctx.db
        .update(hangouts)
        .set({ status: 'closed', updatedAt: new Date() })
        .where(eq(hangouts.id, input.id))

      return { success: true }
    }),
})
