import { z } from 'zod'
import { eq, and, inArray, isNotNull, notInArray, ne } from 'drizzle-orm'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { festivalWaves, dancers, planItems } from '../../database/schema'

/** A swipe card is a photo: dancers without one never enter the deck. */
const hasPhoto = () => [isNotNull(dancers.photo), ne(dancers.photo, '')]

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

  /**
   * Discover pool — attendees who opted into "share going" for a festival,
   * excluding the caller and anyone they've already swiped (waved at or
   * retracted). Returns enriched profiles for the swipe deck.
   *
   * Prioritisation: dancers who waved at the caller appear first (they
   * already expressed interest, so a right-swipe creates an instant match).
   */
  discoverPool: protectedProcedure
    .input(z.object({
      // A festival slug, or an event id when itemType is 'event' (plain
      // events key their waves by event id).
      festivalSlug: z.string().min(1).max(120),
      itemType: z.enum(['festival', 'event']).default('festival'),
    }))
    .query(async ({ ctx, input }) => {
      // 1. IDs I've already swiped on (so we exclude them from the deck)
      const alreadySwiped = await ctx.db
        .select({ targetDancerId: festivalWaves.targetDancerId })
        .from(festivalWaves)
        .where(
          and(
            eq(festivalWaves.festivalSlug, input.festivalSlug),
            eq(festivalWaves.dancerId, ctx.dancerId),
          ),
        )
      const swipedIds = alreadySwiped.map(r => r.targetDancerId)

      // 2. IDs of people who waved at me (for priority sorting)
      const incomingWaves = await ctx.db
        .select({ dancerId: festivalWaves.dancerId })
        .from(festivalWaves)
        .where(
          and(
            eq(festivalWaves.festivalSlug, input.festivalSlug),
            eq(festivalWaves.targetDancerId, ctx.dancerId),
          ),
        )
      const incomingIds = new Set(incomingWaves.map(r => r.dancerId))

      // 3. Attendees who are "going" and opted to share
      const goingRows = await ctx.db
        .select({ dancerId: planItems.dancerId })
        .from(planItems)
        .where(
          and(
            eq(planItems.itemType, input.itemType),
            eq(planItems.itemId, input.festivalSlug),
            eq(planItems.shareGoing, true),
            ne(planItems.dancerId, ctx.dancerId),
          ),
        )

      // Filter out already-swiped
      const swipedSet = new Set(swipedIds)
      const candidateIds = goingRows
        .map(r => r.dancerId)
        .filter(id => !swipedSet.has(id))

      if (candidateIds.length === 0) return []

      // 4. Fetch profiles
      const profiles = await ctx.db
        .select({
          id: dancers.id,
          name: dancers.name,
          photo: dancers.photo,
          city: dancers.city,
          username: dancers.username,
          danceStyles: dancers.danceStyles,
          danceLevels: dancers.danceLevels,
          role: dancers.role,
          bio: dancers.bio,
        })
        .from(dancers)
        .where(
          and(
            inArray(dancers.id, candidateIds),
            eq(dancers.profilePublic, true),
            ...hasPhoto(),
          ),
        )
        .limit(50)

      // 5. Sort: dancers who waved at us first, then the rest
      const sorted = profiles.sort((a, b) => {
        const aIncoming = incomingIds.has(a.id) ? 0 : 1
        const bIncoming = incomingIds.has(b.id) ? 0 : 1
        return aIncoming - bIncoming
      })

      return sorted.map(r => {
        const styles = ((r.danceStyles as string[]) ?? [])
        const levels = (r.danceLevels as Record<string, string>) ?? {}
        return {
          id: r.id,
          name: r.name,
          photo: r.photo,
          city: r.city,
          username: r.username,
          role: r.role as 'lead' | 'follow' | null,
          bio: r.bio,
          styles: styles.map(s => ({
            name: s,
            level: (levels[s] as 'Beginner' | 'Intermediate' | 'Advanced') || 'Beginner',
          })),
          likedMe: incomingIds.has(r.id),
        }
      })
    }),

  /**
   * Count of dancers who waved at me but I haven't waved back yet —
   * the "N dancers already want to dance with you" teaser count.
   */
  incomingCount: protectedProcedure
    .input(z.object({ festivalSlug: z.string().min(1).max(120) }))
    .query(async ({ ctx, input }) => {
      // People who waved at me
      const incoming = await ctx.db
        .select({ dancerId: festivalWaves.dancerId })
        .from(festivalWaves)
        .where(
          and(
            eq(festivalWaves.festivalSlug, input.festivalSlug),
            eq(festivalWaves.targetDancerId, ctx.dancerId),
          ),
        )

      // People I've already waved at
      const myOutgoing = await ctx.db
        .select({ targetDancerId: festivalWaves.targetDancerId })
        .from(festivalWaves)
        .where(
          and(
            eq(festivalWaves.festivalSlug, input.festivalSlug),
            eq(festivalWaves.dancerId, ctx.dancerId),
          ),
        )

      const outgoingSet = new Set(myOutgoing.map(r => r.targetDancerId))
      return incoming.filter(r => !outgoingSet.has(r.dancerId)).length
    }),
})
