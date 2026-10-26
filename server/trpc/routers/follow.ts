import { z } from 'zod'
import { eq, and, sql, isNotNull } from 'drizzle-orm'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { follows, profiles } from '../../database/schema'

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
        .select({ id: follows.id })
        .from(follows)
        .where(and(
          eq(follows.dancerId, ctx.dancerId),
          eq(follows.profileId, input.profileId),
        ))

      if (existing) {
        await ctx.db
          .delete(follows)
          .where(eq(follows.id, existing.id))
        return { following: false }
      }

      await ctx.db
        .insert(follows)
        .values({ dancerId: ctx.dancerId, profileId: input.profileId })
        .onConflictDoNothing()
      return { following: true }
    }),

  /**
   * Toggle follow on another dancer (Step 15, RAZ-319). Mutual = friends.
   */
  toggleDancer: protectedProcedure
    .input(z.object({ targetDancerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.targetDancerId === ctx.dancerId) {
        throw new Error('Cannot follow yourself')
      }

      const [existing] = await ctx.db
        .select({ id: follows.id })
        .from(follows)
        .where(and(
          eq(follows.dancerId, ctx.dancerId),
          eq(follows.targetDancerId, input.targetDancerId),
        ))

      if (existing) {
        await ctx.db.delete(follows).where(eq(follows.id, existing.id))
        return { following: false }
      }

      await ctx.db
        .insert(follows)
        .values({ dancerId: ctx.dancerId, targetDancerId: input.targetDancerId })
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
        .select({ id: follows.id })
        .from(follows)
        .where(and(
          eq(follows.dancerId, ctx.dancerId),
          eq(follows.profileId, input.profileId),
        ))
      return !!row
    }),

  /**
   * Check if the signed-in dancer follows another dancer.
   */
  isFollowingDancer: protectedProcedure
    .input(z.object({ targetDancerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ id: follows.id })
        .from(follows)
        .where(and(
          eq(follows.dancerId, ctx.dancerId),
          eq(follows.targetDancerId, input.targetDancerId),
        ))
      return !!row
    }),

  /**
   * Are two dancers mutual follows (= friends)?
   */
  areFriends: protectedProcedure
    .input(z.object({ dancerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [aFollowsB] = await ctx.db.select({ id: follows.id }).from(follows)
        .where(and(eq(follows.dancerId, ctx.dancerId), eq(follows.targetDancerId, input.dancerId)))
      const [bFollowsA] = await ctx.db.select({ id: follows.id }).from(follows)
        .where(and(eq(follows.dancerId, input.dancerId), eq(follows.targetDancerId, ctx.dancerId)))
      return !!(aFollowsB && bFollowsA)
    }),

  /**
   * List all profile usernames the signed-in dancer follows.
   */
  myFollows: protectedProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({ username: profiles.username })
        .from(follows)
        .innerJoin(profiles, eq(follows.profileId, profiles.id))
        .where(and(eq(follows.dancerId, ctx.dancerId), isNotNull(follows.profileId)))
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
        .from(follows)
        .where(eq(follows.profileId, input.profileId))
      return row?.count ?? 0
    }),
})
