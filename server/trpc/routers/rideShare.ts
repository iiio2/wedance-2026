import { z } from 'zod'
import { eq, and } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { festivalRideShares, dancers } from '../../database/schema'
import { findFestivalId, ensureFestivalId } from '../../utils/festivalRow'

const CONTACT_LINK_PATTERN = /^https?:\/\/(wa\.me|chat\.whatsapp\.com|t\.me|telegram\.me)\//i

export const rideShareRouter = router({
  list: publicProcedure
    .input(z.object({ festivalSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const festivalId = await findFestivalId(ctx.db, input.festivalSlug)

      if (!festivalId) return []

      const rows = await ctx.db
        .select({
          id: festivalRideShares.id,
          type: festivalRideShares.type,
          originCity: festivalRideShares.originCity,
          date: festivalRideShares.date,
          seatsAvailable: festivalRideShares.seatsAvailable,
          contactLink: festivalRideShares.contactLink,
          dancerId: festivalRideShares.dancerId,
          dancerName: dancers.name,
          dancerPhoto: dancers.photo,
        })
        .from(festivalRideShares)
        .innerJoin(dancers, eq(festivalRideShares.dancerId, dancers.id))
        .where(eq(festivalRideShares.festivalId, festivalId))

      const isAuthenticated = !!ctx.dancerId

      return rows.map((r) => ({
        id: r.id,
        type: r.type,
        originCity: r.originCity,
        date: r.date,
        seatsAvailable: r.seatsAvailable,
        contactLink: isAuthenticated ? r.contactLink : null,
        dancerName: r.dancerName,
        dancerPhoto: r.dancerPhoto,
        isOwn: ctx.dancerId === r.dancerId,
      }))
    }),

  create: protectedProcedure
    .input(z.object({
      festivalSlug: z.string(),
      type: z.enum(['offering', 'looking']),
      originCity: z.string(),
      date: z.string(),
      seatsAvailable: z.number().optional(),
      contactLink: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const festivalId = await ensureFestivalId(ctx.db, input.festivalSlug)

      if (!festivalId) throw new TRPCError({ code: 'NOT_FOUND', message: 'Festival not found' })

      // Validate contact link if provided
      const contactLink = input.contactLink?.trim() || null
      if (contactLink && !CONTACT_LINK_PATTERN.test(contactLink)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Contact link must be a WhatsApp (wa.me, chat.whatsapp.com) or Telegram (t.me, telegram.me) link.',
        })
      }

      // Check for existing ride share by this dancer
      const [existing] = await ctx.db
        .select({ id: festivalRideShares.id })
        .from(festivalRideShares)
        .where(and(
          eq(festivalRideShares.festivalId, festivalId),
          eq(festivalRideShares.dancerId, ctx.dancerId),
        ))

      if (existing) {
        // Update existing
        await ctx.db
          .update(festivalRideShares)
          .set({
            type: input.type,
            originCity: input.originCity,
            date: input.date,
            seatsAvailable: input.seatsAvailable ?? null,
            contactLink,
          })
          .where(eq(festivalRideShares.id, existing.id))
        return { updated: true }
      }

      await ctx.db.insert(festivalRideShares).values({
        festivalId,
        dancerId: ctx.dancerId,
        type: input.type,
        originCity: input.originCity,
        date: input.date,
        seatsAvailable: input.seatsAvailable ?? null,
        contactLink,
      })

      return { created: true }
    }),

  delete: protectedProcedure
    .input(z.object({ festivalSlug: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const festivalId = await findFestivalId(ctx.db, input.festivalSlug)

      if (!festivalId) throw new TRPCError({ code: 'NOT_FOUND', message: 'Festival not found' })

      await ctx.db
        .delete(festivalRideShares)
        .where(and(
          eq(festivalRideShares.festivalId, festivalId),
          eq(festivalRideShares.dancerId, ctx.dancerId),
        ))

      return { deleted: true }
    }),
})
