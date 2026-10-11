import { z } from 'zod'
import { eq, and, inArray } from 'drizzle-orm'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { festivalWaves, dancers } from '../../database/schema'

export const waveRouter = router({
  /**
   * Wave at another dancer for a specific festival — "I'd love to dance
   * with you there." Idempotent: waving twice is a no-op.
   */
  send: protectedProcedure
    .input(z.object({
      festivalSlug: z.string().min(1).max(120),
      targetDancerId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.targetDancerId === ctx.dancerId) return
      await ctx.db
        .insert(festivalWaves)
        .values({
          festivalSlug: input.festivalSlug,
          dancerId: ctx.dancerId,
          targetDancerId: input.targetDancerId,
        })
        .onConflictDoNothing()
    }),

  /**
   * Retract a wave — undo "I'd love to dance with you."
   */
  retract: protectedProcedure
    .input(z.object({
      festivalSlug: z.string().min(1).max(120),
      targetDancerId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(festivalWaves)
        .where(
          and(
            eq(festivalWaves.festivalSlug, input.festivalSlug),
            eq(festivalWaves.dancerId, ctx.dancerId),
            eq(festivalWaves.targetDancerId, input.targetDancerId),
          ),
        )
    }),

  /**
   * IDs of dancers I've waved at for a festival — used by GoingSection
   * to show the waved state on each card.
   */
  myWaves: protectedProcedure
    .input(z.object({ festivalSlug: z.string().min(1).max(120) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({ targetDancerId: festivalWaves.targetDancerId })
        .from(festivalWaves)
        .where(
          and(
            eq(festivalWaves.festivalSlug, input.festivalSlug),
            eq(festivalWaves.dancerId, ctx.dancerId),
          ),
        )
      return rows.map(r => r.targetDancerId)
    }),

  /**
   * Dancers who waved at me for a festival — the "incoming" list.
   * Returns profile info so the UI can render cards + "wave back" buttons.
   */
  wavesForMe: protectedProcedure
    .input(z.object({ festivalSlug: z.string().min(1).max(120) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          dancerId: festivalWaves.dancerId,
          name: dancers.name,
          photo: dancers.photo,
          city: dancers.city,
          username: dancers.username,
          danceStyles: dancers.danceStyles,
        })
        .from(festivalWaves)
        .innerJoin(dancers, eq(festivalWaves.dancerId, dancers.id))
        .where(
          and(
            eq(festivalWaves.festivalSlug, input.festivalSlug),
            eq(festivalWaves.targetDancerId, ctx.dancerId),
            eq(dancers.profilePublic, true),
          ),
        )
        .limit(50)

      return rows.map(r => ({
        dancerId: r.dancerId,
        name: r.name,
        photo: r.photo,
        city: r.city,
        username: r.username,
        danceStyles: (r.danceStyles as string[]) ?? [],
      }))
    }),

  /**
   * Festival Friends — mutual waves for a festival. Both parties waved
   * at each other, so they're pre-connected before they arrive.
   */
  friends: protectedProcedure
    .input(z.object({ festivalSlug: z.string().min(1).max(120) }))
    .query(async ({ ctx, input }) => {
      // 1. People I've waved at
      const myOutgoing = await ctx.db
        .select({ targetDancerId: festivalWaves.targetDancerId })
        .from(festivalWaves)
        .where(
          and(
            eq(festivalWaves.festivalSlug, input.festivalSlug),
            eq(festivalWaves.dancerId, ctx.dancerId),
          ),
        )

      if (myOutgoing.length === 0) return []

      const myTargetIds = myOutgoing.map(r => r.targetDancerId)

      // 2. Among those, find who also waved at me
      const mutual = await ctx.db
        .select({ dancerId: festivalWaves.dancerId })
        .from(festivalWaves)
        .where(
          and(
            eq(festivalWaves.festivalSlug, input.festivalSlug),
            eq(festivalWaves.targetDancerId, ctx.dancerId),
            inArray(festivalWaves.dancerId, myTargetIds),
          ),
        )

      if (mutual.length === 0) return []

      const mutualIds = mutual.map(r => r.dancerId)

      // 3. Fetch their profiles
      const profiles = await ctx.db
        .select({
          id: dancers.id,
          name: dancers.name,
          photo: dancers.photo,
          city: dancers.city,
          username: dancers.username,
          danceStyles: dancers.danceStyles,
          role: dancers.role,
          instagram: dancers.instagram,
        })
        .from(dancers)
        .where(
          and(
            inArray(dancers.id, mutualIds),
            eq(dancers.profilePublic, true),
          ),
        )

      return profiles.map(r => ({
        dancerId: r.id,
        name: r.name,
        photo: r.photo,
        city: r.city,
        username: r.username,
        danceStyles: (r.danceStyles as string[]) ?? [],
        role: r.role,
        instagram: r.instagram,
      }))
    }),
})
