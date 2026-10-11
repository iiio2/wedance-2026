import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { artistFollows, profiles } from '../../database/schema'

export const followRouter = router({
  /**
   * Toggle follow on a profile (artist/organizer/venue). Idempotent:
   * if already following, unfollows; if not, follows.
   * Returns the new state: { following: boolean }.
   */
  toggle: protectedProcedure
    .input(z.object({ profileId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [existing] = await ctx.db
        .select({ id: artistFollows.id })
        .from(artistFollows)
        .where(and(
          eq(artistFollows.dancerId, ctx.dancerId),
          eq(artistFollows.profileId, input.profileId),
        ))

      if (existing) {
        await ctx.db
          .delete(artistFollows)
          .where(eq(artistFollows.id, existing.id))
        return { following: false }
      }

      await ctx.db
        .insert(artistFollows)
        .values({ dancerId: ctx.dancerId, profileId: input.profileId })
        .onConflictDoNothing()
      return { following: true }
    }),

  /**
   * Check if the signed-in dancer follows a specific profile.
   */
  isFollowing: protectedProcedure
    .input(z.object({ profileId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ id: artistFollows.id })
        .from(artistFollows)
        .where(and(
          eq(artistFollows.dancerId, ctx.dancerId),
          eq(artistFollows.profileId, input.profileId),
        ))
      return !!row
    }),

  /**
   * List all profile usernames the signed-in dancer follows.
   */
  myFollows: protectedProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({ username: profiles.username })
        .from(artistFollows)
        .innerJoin(profiles, eq(artistFollows.profileId, profiles.id))
        .where(eq(artistFollows.dancerId, ctx.dancerId))
      return rows.map(r => r.username)
    }),

  /**
   * Public follower count for a profile.
   */
  count: publicProcedure
    .input(z.object({ profileId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(artistFollows)
        .where(eq(artistFollows.profileId, input.profileId))
      return row?.count ?? 0
    }),
})
