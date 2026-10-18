import { z } from 'zod'
import { eq, and, ne, sql, inArray, gte, lt, asc, ilike, isNotNull } from 'drizzle-orm'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { planItems, dancers, festivals, festivalSignups, events, attendances, dancerGoals } from '../../database/schema'
import { getReferralDiscountPercent, getEarlyBirdInfo } from '../../utils/ticket-prices'
import { eventPath } from '../../../shared/utils/eventSlug'
import { festivalPath } from '../../../shared/utils/eventSlug'
import { discoverDeck, myCourses, recordSwipe, removeSwipe, weekSocials } from '../../utils/myPlanFeeds'
import { eventIdForFestival, recordLinkAction } from '../../utils/trackedLinks'

export const planRouter = router({
  count: publicProcedure
    .input(z.object({ itemType: z.enum(['festival', 'event', 'goal', 'workshop']), itemId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ count: sql<number>`count(*)::int` })
        .from(planItems)
        .where(and(eq(planItems.itemType, input.itemType), eq(planItems.itemId, input.itemId)))
      return row?.count ?? 0
    }),

  /**
   * Batch count of plan items per event/festival.
   * Returns a map of itemId → count. Used by city pages to populate
   * attendee counts on event cards without N+1 queries.
   */
  countBatch: publicProcedure
    .input(z.object({
      itemType: z.enum(['festival', 'event']),
      itemIds: z.array(z.string().min(1).max(120)).min(1).max(100),
    }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          itemId: planItems.itemId,
          count: sql<number>`count(*)::int`,
        })
        .from(planItems)
        .where(
          and(
            eq(planItems.itemType, input.itemType),
            inArray(planItems.itemId, input.itemIds),
          ),
        )
        .groupBy(planItems.itemId)

      const result: Record<string, number> = {}
      for (const id of input.itemIds) result[id] = 0
      for (const r of rows) result[r.itemId] = r.count
      return result
    }),

  // Basic list — only itemType + itemId. Used by the hydration plugin and
  // composables (useWeekPlan, useYearPlan) that don't need metadata.
  list: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        itemType: planItems.itemType,
        itemId: planItems.itemId,
      })
      .from(planItems)
      .where(eq(planItems.dancerId, ctx.dancerId))
  }),

  // Detailed list — includes metadata. Used by my-plan for course
  // enrollment details and goal persistence.
  listDetailed: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db
      .select({
        itemType: planItems.itemType,
        itemId: planItems.itemId,
        metadata: planItems.metadata,
      })
      .from(planItems)
      .where(eq(planItems.dancerId, ctx.dancerId))
  }),

  add: protectedProcedure
    .input(
      z.object({
        itemType: z.enum(['festival', 'event', 'goal', 'workshop']),
        itemId: z.string(),
        metadata: z.record(z.string(), z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const values: typeof planItems.$inferInsert = {
        dancerId: ctx.dancerId,
        itemType: input.itemType,
        itemId: input.itemId,
      }
      if (input.metadata) {
        values.metadata = input.metadata
      }
      await ctx.db
        .insert(planItems)
        .values(values)
        .onConflictDoNothing()

      // Came through a promoter's tracked link for this event: credit the plan add.
      if (ctx.viaCode && (input.itemType === 'event' || input.itemType === 'festival')) {
        const eventId = input.itemType === 'event' ? input.itemId : await eventIdForFestival(ctx.db, input.itemId)
        await recordLinkAction(ctx.db, ctx.viaCode, 'plan_add', { dancerId: ctx.dancerId, eventId })
      }

      // Phase 4 dual-write: also write to the new typed tables so they
      // accumulate data for the switch step. Best-effort — failures here
      // don't block the plan_items write.
      try {
        if (input.itemType === 'event') {
          // itemId is an event UUID.
          await ctx.db
            .insert(attendances)
            .values({
              eventId: input.itemId,
              dancerId: ctx.dancerId,
              status: 'going',
              source: 'click',
              visibility: 'hidden',
            })
            .onConflictDoNothing()
        } else if (input.itemType === 'festival') {
          // itemId is a festival slug. Look up the matching event by slug
          // or festival JSONB key.
          const [ev] = await ctx.db
            .select({ id: events.id })
            .from(events)
            .where(sql`${events.slug} = ${input.itemId} OR ${events.festival}->>'key' = ${input.itemId}`)
            .limit(1)
          if (ev) {
            await ctx.db
              .insert(attendances)
              .values({
                eventId: ev.id,
                dancerId: ctx.dancerId,
                status: 'going',
                source: 'click',
                visibility: 'hidden',
              })
              .onConflictDoNothing()
          }
        } else if (input.itemType === 'goal') {
          // Dual-write to dancer_goals.
          const meta = input.metadata ?? {}
          await ctx.db
            .insert(dancerGoals)
            .values({
              id: input.itemId,
              dancerId: ctx.dancerId,
              kind: meta.kind ?? 'custom',
              title: meta.title ?? input.itemId,
              target: meta.target,
              periodYear: meta.periodYear ? parseInt(meta.periodYear) : undefined,
              metadata: meta,
            })
            .onConflictDoNothing()
        }
      } catch {
        // Best-effort: the attendances table may not exist yet in
        // production (migration not yet applied). Swallow the error.
      }
    }),

  updateMetadata: protectedProcedure
    .input(
      z.object({
        itemType: z.enum(['festival', 'event', 'goal', 'workshop']),
        itemId: z.string(),
        metadata: z.record(z.string(), z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(planItems)
        .set({ metadata: input.metadata })
        .where(
          and(
            eq(planItems.dancerId, ctx.dancerId),
            eq(planItems.itemType, input.itemType),
            eq(planItems.itemId, input.itemId),
          ),
        )
    }),

  remove: protectedProcedure
    .input(
      z.object({
        itemType: z.enum(['festival', 'event', 'goal', 'workshop']),
        itemId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .delete(planItems)
        .where(
          and(
            eq(planItems.dancerId, ctx.dancerId),
            eq(planItems.itemType, input.itemType),
            eq(planItems.itemId, input.itemId),
          ),
        )

      // Phase 4 dual-write: also remove from the new typed tables.
      try {
        if (input.itemType === 'event') {
          await ctx.db
            .delete(attendances)
            .where(
              and(
                eq(attendances.eventId, input.itemId),
                eq(attendances.dancerId, ctx.dancerId),
                ne(attendances.status, 'ticket_holder'),
              ),
            )
        } else if (input.itemType === 'festival') {
          const [ev] = await ctx.db
            .select({ id: events.id })
            .from(events)
            .where(sql`${events.slug} = ${input.itemId} OR ${events.festival}->>'key' = ${input.itemId}`)
            .limit(1)
          if (ev) {
            await ctx.db
              .delete(attendances)
              .where(
                and(
                  eq(attendances.eventId, ev.id),
                  eq(attendances.dancerId, ctx.dancerId),
                  ne(attendances.status, 'ticket_holder'),
                ),
              )
          }
        } else if (input.itemType === 'goal') {
          await ctx.db
            .delete(dancerGoals)
            .where(
              and(
                eq(dancerGoals.id, input.itemId),
                eq(dancerGoals.dancerId, ctx.dancerId),
              ),
            )
        }
      } catch {
        // Best-effort: swallow if tables don't exist yet.
      }
    }),

  /**
   * Public list of dancers visible on a festival or event page.
   *
   * For **festivals**: returns verified ticket holders only (RAZ-314,
   * "no fake friends" — RAZ-83). Queries `festival_signups` joined with
   * `dancers`; the dancer must have `verified_ticket_holder = true`,
   * `roster_visibility != 'hidden'`, and `profile_public = true`.
   *
   * For **events**: returns dancers who opted in via `share_going` on
   * their plan item, with `profile_public = true` (unchanged behaviour).
   *
   * Accepts either `festivalSlug` (legacy shorthand for itemType=festival)
   * or the generic `itemType` + `itemId` pair.
   */
  goingList: publicProcedure
    .input(z.object({
      festivalSlug: z.string().min(1).max(120).optional(),
      itemType: z.enum(['festival', 'event']).optional(),
      itemId: z.string().min(1).max(120).optional(),
    }).refine(
      d => d.festivalSlug || (d.itemType && d.itemId),
      { message: 'Provide festivalSlug or itemType + itemId' },
    ))
    .query(async ({ ctx, input }) => {
      const type = input.itemType ?? 'festival'
      const id = input.itemId ?? input.festivalSlug!

      // --- Festivals: verified ticket holders only (RAZ-314) ---
      if (type === 'festival') {
        const [festival] = await ctx.db
          .select({ id: festivals.id })
          .from(festivals)
          .where(eq(festivals.slug, id))

        if (!festival) return []

        const rows = await ctx.db
          .select({
            dancerId: festivalSignups.dancerId,
            name: dancers.name,
            photo: dancers.photo,
            city: dancers.city,
            username: dancers.username,
          })
          .from(festivalSignups)
          .innerJoin(dancers, eq(festivalSignups.dancerId, dancers.id))
          .where(
            and(
              eq(festivalSignups.festivalId, festival.id),
              eq(festivalSignups.verifiedTicketHolder, true),
              isNotNull(festivalSignups.dancerId),
              ne(festivalSignups.rosterVisibility, 'hidden'),
              eq(dancers.profilePublic, true),
            ),
          )
          .limit(50)

        return rows.map(r => ({
          dancerId: r.dancerId!,
          name: r.name,
          photo: r.photo,
          city: r.city,
          username: r.username,
        }))
      }

      // --- Events: opt-in share_going (unchanged) ---
      const rows = await ctx.db
        .select({
          dancerId: planItems.dancerId,
          name: dancers.name,
          photo: dancers.photo,
          city: dancers.city,
          username: dancers.username,
        })
        .from(planItems)
        .innerJoin(dancers, eq(planItems.dancerId, dancers.id))
        .where(
          and(
            eq(planItems.itemType, type),
            eq(planItems.itemId, id),
            eq(planItems.shareGoing, true),
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
      }))
    }),

  /**
   * Fetch the current dancer's planned festivals with ticket status and
   * referral data — the "own view" of the year plan page.
   */
  myPlan: protectedProcedure.query(async ({ ctx }) => {
    const items = await ctx.db
      .select({ itemId: planItems.itemId })
      .from(planItems)
      .where(
        and(
          eq(planItems.dancerId, ctx.dancerId),
          eq(planItems.itemType, 'festival'),
        ),
      )

    if (items.length === 0) return []

    const slugs = items.map((i) => i.itemId)

    const festivalRows = await ctx.db
      .select({
        id: festivals.id,
        slug: festivals.slug,
        name: festivals.name,
        startDate: festivals.startDate,
        endDate: festivals.endDate,
        city: festivals.city,
        country: festivals.country,
        logo: festivals.logo,
        accentColor: festivals.accentColor,
        styles: festivals.styles,
        ticketUrl: festivals.ticketUrl,
        earlyBirdDeadline: festivals.earlyBirdDeadline,
        earlyBirdOfferName: festivals.earlyBirdOfferName,
      })
      .from(festivals)
      .where(inArray(festivals.slug, slugs))

    if (festivalRows.length === 0) return []

    // Count workshop selections per festival. Workshop plan items use
    // itemId = '{festivalSlug}:{workshopId}'.
    const workshopItems = await ctx.db
      .select({ itemId: planItems.itemId })
      .from(planItems)
      .where(
        and(
          eq(planItems.dancerId, ctx.dancerId),
          eq(planItems.itemType, 'workshop'),
        ),
      )

    const workshopCountBySlug = new Map<string, number>()
    for (const w of workshopItems) {
      const colonIdx = w.itemId.indexOf(':')
      if (colonIdx === -1) continue
      const slug = w.itemId.slice(0, colonIdx)
      workshopCountBySlug.set(slug, (workshopCountBySlug.get(slug) ?? 0) + 1)
    }

    const signupRows = await ctx.db
      .select({
        festivalId: festivalSignups.festivalId,
        verifiedTicketHolder: festivalSignups.verifiedTicketHolder,
      })
      .from(festivalSignups)
      .where(
        and(
          eq(festivalSignups.dancerId, ctx.dancerId),
          inArray(
            festivalSignups.festivalId,
            festivalRows.map((f) => f.id),
          ),
        ),
      )

    const ticketByFestivalId = new Map(
      signupRows.map((s) => [s.festivalId, s.verifiedTicketHolder]),
    )

    return festivalRows
      .map((f) => {
        // DB columns take precedence; fall back to hardcoded config for
        // festivals that haven't been migrated to DB-driven early-bird yet.
        const dbDeadline = f.earlyBirdDeadline
        const dbOffer = f.earlyBirdOfferName
        const hardcoded = getEarlyBirdInfo(f.slug)
        const deadline = dbDeadline ?? hardcoded?.deadline ?? ''
        const offer = dbOffer ?? hardcoded?.offerName ?? ''
        // Only surface deadlines that are still in the future.
        const deadlineActive = deadline && new Date(deadline) > new Date()
        return {
          slug: f.slug,
          name: f.name,
          startDate: f.startDate ?? '',
          endDate: f.endDate ?? '',
          location: f.city ?? '',
          country: f.country ?? '',
          logo: f.logo ?? '',
          accentColor: f.accentColor ?? '',
          styles: (f.styles as string[]) ?? [],
          workshopCount: workshopCountBySlug.get(f.slug) ?? 0,
          ticketStatus: (ticketByFestivalId.get(f.id) ? 'purchased' : 'not-purchased') as 'purchased' | 'not-purchased',
          referralDiscountPercent: getReferralDiscountPercent(f.slug),
          ticketUrl: f.ticketUrl ?? '',
          earlyBirdDeadline: deadlineActive ? deadline : '',
          earlyBirdOffer: deadlineActive ? offer : '',
        }
      })
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  }),

  /**
   * Fetch another dancer's planned festivals for the shared year-plan view.
   * Public — the viewer may not be signed in.  Returns festival details,
   * ticket status (whether the sharer has a verified ticket), and the
   * referral discount percentage so the UI can show "you both get X% off".
   */
  sharedPlan: publicProcedure
    .input(z.object({ username: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      // 1. Look up the sharer by username.
      const [sharer] = await ctx.db
        .select({
          id: dancers.id,
          name: dancers.name,
          photo: dancers.photo,
          role: dancers.role,
          username: dancers.username,
          profilePublic: dancers.profilePublic,
        })
        .from(dancers)
        .where(eq(dancers.username, input.username))

      if (!sharer || sharer.profilePublic === false) {
        return null
      }

      // 2. Get all festival plan items for this dancer.
      const items = await ctx.db
        .select({ itemId: planItems.itemId })
        .from(planItems)
        .where(
          and(
            eq(planItems.dancerId, sharer.id),
            eq(planItems.itemType, 'festival'),
          ),
        )

      if (items.length === 0) {
        return {
          sharer: {
            name: sharer.name,
            photo: sharer.photo,
            role: sharer.role as 'lead' | 'follow' | null,
            username: sharer.username,
          },
          festivals: [],
        }
      }

      const slugs = items.map((i) => i.itemId)

      // 3. Fetch festival details for all planned slugs.
      const festivalRows = await ctx.db
        .select({
          id: festivals.id,
          slug: festivals.slug,
          name: festivals.name,
          startDate: festivals.startDate,
          endDate: festivals.endDate,
          city: festivals.city,
          country: festivals.country,
          logo: festivals.logo,
          accentColor: festivals.accentColor,
          styles: festivals.styles,
          ticketUrl: festivals.ticketUrl,
          earlyBirdDeadline: festivals.earlyBirdDeadline,
          earlyBirdOfferName: festivals.earlyBirdOfferName,
        })
        .from(festivals)
        .where(inArray(festivals.slug, slugs))

      // 4. Count workshop selections per festival for the sharer.
      const workshopItems = await ctx.db
        .select({ itemId: planItems.itemId })
        .from(planItems)
        .where(
          and(
            eq(planItems.dancerId, sharer.id),
            eq(planItems.itemType, 'workshop'),
          ),
        )

      const workshopCountBySlug = new Map<string, number>()
      for (const w of workshopItems) {
        const colonIdx = w.itemId.indexOf(':')
        if (colonIdx === -1) continue
        const slug = w.itemId.slice(0, colonIdx)
        workshopCountBySlug.set(slug, (workshopCountBySlug.get(slug) ?? 0) + 1)
      }

      // 5. Check which festivals the sharer has a verified ticket for.
      let ticketByFestivalId = new Map<string, boolean>()
      if (festivalRows.length > 0) {
        const signupRows = await ctx.db
          .select({
            festivalId: festivalSignups.festivalId,
            verifiedTicketHolder: festivalSignups.verifiedTicketHolder,
          })
          .from(festivalSignups)
          .where(
            and(
              eq(festivalSignups.dancerId, sharer.id),
              inArray(
                festivalSignups.festivalId,
                festivalRows.map((f) => f.id),
              ),
            ),
          )

        ticketByFestivalId = new Map(
          signupRows.map((s) => [s.festivalId, s.verifiedTicketHolder]),
        )
      }

      // 6. Build the response, sorted by start date.
      const result = festivalRows
        .map((f) => {
          const dbDeadline = f.earlyBirdDeadline
          const dbOffer = f.earlyBirdOfferName
          const hardcoded = getEarlyBirdInfo(f.slug)
          const deadline = dbDeadline ?? hardcoded?.deadline ?? ''
          const offer = dbOffer ?? hardcoded?.offerName ?? ''
          const deadlineActive = deadline && new Date(deadline) > new Date()
          return {
            slug: f.slug,
            name: f.name,
            startDate: f.startDate ?? '',
            endDate: f.endDate ?? '',
            location: f.city ?? '',
            country: f.country ?? '',
            logo: f.logo ?? '',
            accentColor: f.accentColor ?? '',
            styles: (f.styles as string[]) ?? [],
            workshopCount: workshopCountBySlug.get(f.slug) ?? 0,
            hasTicket: ticketByFestivalId.get(f.id) ?? false,
            referralDiscountPercent: getReferralDiscountPercent(f.slug),
            ticketUrl: f.ticketUrl ?? '',
            earlyBirdDeadline: deadlineActive ? deadline : '',
            earlyBirdOffer: deadlineActive ? offer : '',
          }
        })
        .sort((a, b) => a.startDate.localeCompare(b.startDate))

      return {
        sharer: {
          name: sharer.name,
          photo: sharer.photo,
          role: sharer.role as 'lead' | 'follow' | null,
          username: sharer.username,
        },
        festivals: result,
      }
    }),

  /**
   * Discover deck — people and places to widen a dancer's year: dancers going
   * to the same / other festivals, dancers in the same city (photo required),
   * upcoming socials and festivals in the city. Anything the dancer already
   * swiped (discover_swipes) or has in their plan is left out, so a decided
   * card never comes back. Also returns the "N dancers heading to X" nudges
   * built from earlier Yes swipes. Preview mode is handled client-side.
   */
  discover: protectedProcedure.query(async ({ ctx }) => {
    return discoverDeck(ctx.db, ctx.dancerId)
  }),

  /** Persist a Yes / Skip on a discover card. */
  discoverSwipe: protectedProcedure
    .input(z.object({
      targetKind: z.enum(['dancer', 'event', 'festival']),
      targetId: z.string().min(1).max(200),
      decision: z.enum(['yes', 'skip']),
      festivalSlug: z.string().min(1).max(200).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await recordSwipe(ctx.db, ctx.dancerId, input)
    }),

  /** Undo a discover decision. */
  discoverUnswipe: protectedProcedure
    .input(z.object({
      targetKind: z.enum(['dancer', 'event', 'festival']),
      targetId: z.string().min(1).max(200),
    }))
    .mutation(async ({ ctx, input }) => {
      await removeSwipe(ctx.db, ctx.dancerId, input)
    }),

  /**
   * "Where you're dancing" — only the events in the dancer's plan (plan
   * items of type 'event', added from any surface) happening in the next
   * 7 days, soonest first; a recurring event shows its next occurrence.
   * Includes a real count of friends (mutual follows) going.
   */
  weekSocials: protectedProcedure.query(async ({ ctx }) => {
    return weekSocials(ctx.db, ctx.dancerId)
  }),

  /**
   * "Month · courses" — only the courses in the dancer's plan, backed by real
   * events, each with its next upcoming class. Never suggestions or mock data.
   */
  myCourses: protectedProcedure.query(async ({ ctx }) => {
    return myCourses(ctx.db, ctx.dancerId)
  }),

  /**
   * Batch fetch "who's going" for multiple festivals/events at once.
   *
   * Returns a map of itemId → list of public dancers (name, photo, username).
   * Used by the year-plan pages to populate friendsGoing without N+1 queries.
   * Capped at 10 attendees per item and 50 items per request.
   */
  goingBatch: publicProcedure
    .input(z.object({
      itemType: z.enum(['festival', 'event']),
      itemIds: z.array(z.string().min(1).max(120)).min(1).max(50),
    }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          itemId: planItems.itemId,
          name: dancers.name,
          photo: dancers.photo,
          username: dancers.username,
        })
        .from(planItems)
        .innerJoin(dancers, eq(planItems.dancerId, dancers.id))
        .where(
          and(
            eq(planItems.itemType, input.itemType),
            inArray(planItems.itemId, input.itemIds),
            eq(planItems.shareGoing, true),
            eq(dancers.profilePublic, true),
          ),
        )

      const result: Record<string, Array<{ name: string; photo: string | null; username: string | null }>> = {}
      for (const id of input.itemIds) {
        result[id] = []
      }
      for (const r of rows) {
        const list = result[r.itemId]
        if (list && list.length < 10) {
          list.push({ name: r.name, photo: r.photo, username: r.username })
        }
      }
      return result
    }),

  /**
   * Toggle opt-in attendee visibility for a plan item (RAZ-115).
   *
   * When shareGoing is true the dancer appears in the public "who's going"
   * list; when false they are counted but not individually listed.
   */
  setShareGoing: protectedProcedure
    .input(z.object({
      itemType: z.enum(['festival', 'event']),
      itemId: z.string().min(1).max(120),
      share: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(planItems)
        .set({ shareGoing: input.share })
        .where(
          and(
            eq(planItems.dancerId, ctx.dancerId),
            eq(planItems.itemType, input.itemType),
            eq(planItems.itemId, input.itemId),
          ),
        )
    }),

  /**
   * Get the current dancer's shareGoing state for a specific plan item.
   */
  getShareGoing: protectedProcedure
    .input(z.object({
      itemType: z.enum(['festival', 'event']),
      itemId: z.string().min(1).max(120),
    }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({ shareGoing: planItems.shareGoing })
        .from(planItems)
        .where(
          and(
            eq(planItems.dancerId, ctx.dancerId),
            eq(planItems.itemType, input.itemType),
            eq(planItems.itemId, input.itemId),
          ),
        )
      return { share: row?.shareGoing ?? false }
    }),

  /**
   * Landing page proof showcase: find the upcoming event or festival with the
   * most public "going" dancers and return the item details + attendee profiles.
   *
   * Returns null when no item has public attendees yet.
   */
  proofShowcase: publicProcedure.query(async ({ ctx }) => {
    // Find the item with the most public going dancers.
    const [top] = await ctx.db
      .select({
        itemId: planItems.itemId,
        itemType: planItems.itemType,
        count: sql<number>`count(*)::int`,
      })
      .from(planItems)
      .innerJoin(dancers, eq(planItems.dancerId, dancers.id))
      .where(
        and(
          eq(planItems.shareGoing, true),
          eq(dancers.profilePublic, true),
          sql`${planItems.itemType} IN ('festival', 'event')`,
        ),
      )
      .groupBy(planItems.itemId, planItems.itemType)
      .orderBy(sql`count(*) desc`)
      .limit(1)

    if (!top || top.count === 0) return null

    // Fetch the attendee profiles (capped at 8 for the proof card).
    const attendees = await ctx.db
      .select({
        name: dancers.name,
        photo: dancers.photo,
        city: dancers.city,
      })
      .from(planItems)
      .innerJoin(dancers, eq(planItems.dancerId, dancers.id))
      .where(
        and(
          eq(planItems.itemType, top.itemType as 'festival' | 'event'),
          eq(planItems.itemId, top.itemId),
          eq(planItems.shareGoing, true),
          eq(dancers.profilePublic, true),
        ),
      )
      .limit(8)

    // Fetch the event or festival details for the card.
    let title = ''
    let city = ''
    let venue = ''
    let startDate = ''
    let endDate = ''
    let styles: string[] = []
    let link = ''
    let itemSlug = top.itemId

    if (top.itemType === 'festival') {
      const [f] = await ctx.db
        .select({
          name: festivals.name,
          city: festivals.city,
          startDate: festivals.startDate,
          endDate: festivals.endDate,
          styles: festivals.styles,
          slug: festivals.slug,
        })
        .from(festivals)
        .where(eq(festivals.slug, top.itemId))

      if (f) {
        title = f.name
        city = f.city ?? ''
        startDate = f.startDate ?? ''
        endDate = f.endDate ?? ''
        styles = (f.styles as string[]) ?? []
        link = `${festivalPath(f.slug)}`
        itemSlug = f.slug
      }
    } else {
      const [e] = await ctx.db
        .select({
          id: events.id,
          name: events.name,
          city: events.city,
          venueName: events.venueName,
          startDate: events.startDate,
          endDate: events.endDate,
          styles: events.styles,
        })
        .from(events)
        .where(eq(events.id, top.itemId))

      if (e) {
        title = e.name ?? ''
        city = e.city ?? ''
        venue = e.venueName ?? ''
        startDate = e.startDate?.toISOString() ?? ''
        endDate = e.endDate?.toISOString() ?? ''
        styles = (e.styles as string[]) ?? []
        link = eventPath(e)
      }
    }

    if (!title) return null

    return {
      title,
      city,
      venue,
      startDate,
      endDate,
      styles,
      link,
      itemType: top.itemType as 'festival' | 'event',
      itemSlug,
      attendeeCount: top.count,
      attendees: attendees.map(a => ({
        name: a.name,
        photo: a.photo,
        city: a.city,
      })),
    }
  }),

  /**
   * Festival suggestions for the My Year page — upcoming festivals the dancer
   * hasn't added to their plan yet, sorted by popularity (signup count).
   * Public so unauthenticated visitors also see suggestions.
   */
  suggestions: publicProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().slice(0, 10)

    // Get the caller's existing plan slugs (if signed in).
    let excludeSlugs: string[] = []
    if (ctx.dancerId) {
      const myItems = await ctx.db
        .select({ itemId: planItems.itemId })
        .from(planItems)
        .where(
          and(
            eq(planItems.dancerId, ctx.dancerId),
            eq(planItems.itemType, 'festival'),
          ),
        )
      excludeSlugs = myItems.map((i) => i.itemId)
    }

    // Fetch upcoming festivals with signup counts, excluding already-planned ones.
    const rows = await ctx.db
      .select({
        slug: festivals.slug,
        name: festivals.name,
        startDate: festivals.startDate,
        endDate: festivals.endDate,
        city: festivals.city,
        country: festivals.country,
        logo: festivals.logo,
        accentColor: festivals.accentColor,
        styles: festivals.styles,
        signupCount: sql<number>`coalesce((
          select count(*)::int from plan_items
          where plan_items.item_type = 'festival'
            and plan_items.item_id = ${festivals.slug}
        ), 0)`,
      })
      .from(festivals)
      .where(gte(festivals.endDate, today))
      .orderBy(sql`coalesce((
        select count(*)::int from plan_items
        where plan_items.item_type = 'festival'
          and plan_items.item_id = ${festivals.slug}
      ), 0) desc`, asc(festivals.startDate))

    const filtered = rows
      .filter((r) => !excludeSlugs.includes(r.slug))
      .slice(0, 6)

    return filtered.map((r) => ({
      slug: r.slug,
      name: r.name,
      startDate: r.startDate ?? '',
      endDate: r.endDate ?? '',
      location: r.city ?? '',
      country: r.country ?? '',
      logo: r.logo ?? '',
      accentColor: r.accentColor ?? '',
      styles: (r.styles as string[]) ?? [],
      signupCount: Number(r.signupCount) || 0,
    }))
  }),
})
