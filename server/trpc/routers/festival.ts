/**
 * Public festival read APIs.
 *
 * Today only `bySlug` exists — the DB-backed event page (PR 3 of O-008) needs
 * a way to fetch a single festival by its URL slug. This deliberately returns
 * the minimum set of fields the event page renders; we keep the public shape
 * narrow so future schema additions don't accidentally leak.
 *
 * Other festival data (workshops, teachers, roster) lives in its own router
 * (or, for v0 of the workshop/cart UI, in `~/app/data/mock-*.ts`).
 */
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { router, publicProcedure } from '../trpc'
import { festivals, festivalSubmissions } from '../../database/schema'
import { trackServer } from '../../utils/posthog'

export const festivalRouter = router({
  /**
   * Fetch a single festival by slug.
   *
   * Returns `null` when the slug doesn't match — callers render a 404 on null.
   * Slugs are URL-safe lowercase strings; empty input fails Zod validation.
   */
  bySlug: publicProcedure
    .input(z.object({
      slug: z.string().min(1).max(120),
    }))
    .query(async ({ ctx, input }) => {
      const [festival] = await ctx.db
        .select({
          id: festivals.id,
          slug: festivals.slug,
          name: festivals.name,
          startDate: festivals.startDate,
          endDate: festivals.endDate,
          ticketUrl: festivals.ticketUrl,
          maxFreeSpots: festivals.maxFreeSpots,
        })
        .from(festivals)
        .where(eq(festivals.slug, input.slug))

      if (!festival) {
        return null
      }

      return festival
    }),

  /**
   * Submit a festival draft from the /organizers/create wizard.
   *
   * There is no live self-serve publish yet, so instead of faking "your
   * festival is live", we persist the whole draft for the team to review and
   * onboard. Returns the submission id so the UI can show a real confirmation.
   */
  submitDraft: publicProcedure
    .input(z.object({
      slug: z.string().max(120).optional(),
      name: z.string().max(200).optional(),
      email: z.string().email().optional(),
      payload: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .insert(festivalSubmissions)
        .values({
          slug: input.slug || null,
          name: input.name || null,
          submittedById: ctx.dancerId ?? null,
          submittedByEmail: input.email || null,
          payload: input.payload,
        })
        .returning({ id: festivalSubmissions.id })

      trackServer(ctx, 'festival_draft_submitted', { submission_id: row?.id ?? null, festival: input.slug || null, signed_in: !!ctx.dancerId })
      return { id: row.id }
    }),
})
