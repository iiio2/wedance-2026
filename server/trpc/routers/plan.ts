import { z } from 'zod'
import { eq, and, ne, sql, inArray, gte, lt, asc, ilike } from 'drizzle-orm'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { planItems, dancers, festivals, festivalSignups, events } from '../../database/schema'
import { getReferralDiscountPercent, getEarlyBirdInfo } from '../../utils/ticket-prices'
import { eventPath } from '../../../shared/utils/eventSlug'
import { festivalPath } from '../../../shared/utils/eventSlug'

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
  // Deliberately avoids selecting the metadata column so the query works
  // even if migration 0023 hasn't been applied yet.
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
    }),

  /**
   * Public list of dancers who marked "Going" for a festival or event.
   *
   * Returns name + photo + city + username for public profiles, capped
   * at 50.  Used by the festivals listing (avatar stack), the festival
   * detail page ("Who's going" section), and event detail pages so
   * visitors can see real people before they book.
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
   * Discover deck — people and places to widen a dancer's year.
   *
   * Returns a mixed deck of:
   *  - dancers in the same city with overlapping styles (dancer-local)
   *  - dancers heading to festivals the caller hasn't picked (dancer-new-fest)
   *  - dancers going to the same festivals as the caller (dancer-your-fest)
   *  - upcoming events in the caller's city (event-social)
   *  - upcoming festival-type events not in the caller's plan (event-festival)
   *
   * Capped at 20 cards, shuffled. Preview mode handled client-side.
   */
  discover: protectedProcedure.query(async ({ ctx }) => {
    // 1. Caller's profile
    const [me] = await ctx.db
      .select({
        id: dancers.id,
        city: dancers.city,
        danceStyles: dancers.danceStyles,
      })
      .from(dancers)
      .where(eq(dancers.id, ctx.dancerId))

    if (!me) return { cards: [] }

    const myCity = me.city ?? ''
    const myCitySlug = myCity.toLowerCase().replace(/\s+/g, '-')
    const myStyles = (me.danceStyles as string[]) ?? []

    // 2. Caller's existing plan items (festivals)
    const myPlanRows = await ctx.db
      .select({ itemId: planItems.itemId })
      .from(planItems)
      .where(and(eq(planItems.dancerId, ctx.dancerId), eq(planItems.itemType, 'festival')))

    const myFestivalSlugs = new Set(myPlanRows.map(r => r.itemId))

    const cards: Array<{
      kind: string
      dancerName?: string
      dancerPhoto?: string
      dancerCity?: string
      dancerStyles?: string[]
      festivalSlug?: string
      festivalName?: string
      festivalColor?: string
      eventName?: string
      eventSlug?: string
      eventDateISO?: string
      eventVenue?: string
      eventCity?: string
      eventStyle?: string
      eventDayLabel?: string
      eventTime?: string
      friendsGoing?: number
      color?: string
    }> = []

    // 3. Local dancers (same city, public, not me).
    //    Style overlap is used for sorting, not gating — dancers without shared
    //    styles are still shown so the deck isn't empty on sparse data.
    //    City comparison is case-insensitive to avoid "Munich" vs "munich" mismatches.
    if (myCity) {
      try {
        const localDancers = await ctx.db
          .select({
            id: dancers.id,
            name: dancers.name,
            photo: dancers.photo,
            city: dancers.city,
            danceStyles: dancers.danceStyles,
          })
          .from(dancers)
          .where(
            and(
              ilike(dancers.city, myCity),
              ne(dancers.id, ctx.dancerId),
              eq(dancers.profilePublic, true),
            ),
          )
          .limit(30)

        // Sort dancers with shared styles first
        const scored = localDancers.map(d => {
          const dStyles = (d.danceStyles as string[]) ?? []
          const shared = dStyles.filter(s => myStyles.includes(s))
          return { d, dStyles, sharedCount: shared.length }
        })
        scored.sort((a, b) => b.sharedCount - a.sharedCount)

        for (const { d, dStyles } of scored) {
          cards.push({
            kind: 'dancer-local',
            dancerName: d.name,
            dancerPhoto: d.photo ?? '',
            dancerCity: d.city ?? '',
            dancerStyles: dStyles,
          })
        }
      } catch { /* non-critical */ }
    }

    // 4. Dancers heading to festivals the caller hasn't picked (dancer-new-fest)
    // and dancers going to the same festivals (dancer-your-fest)
    try {
      // Find all plan items of type 'festival' by other dancers
      const otherPlans = await ctx.db
        .select({
          dancerId: planItems.dancerId,
          itemId: planItems.itemId,
        })
        .from(planItems)
        .where(
          and(
            eq(planItems.itemType, 'festival'),
            ne(planItems.dancerId, ctx.dancerId),
          ),
        )
        .limit(200)

      if (otherPlans.length > 0) {
        // Get unique dancer IDs from other plans
        const otherDancerIds = [...new Set(otherPlans.map(p => p.dancerId))]

        // Fetch their profiles (public only)
        const otherDancerRows = await ctx.db
          .select({
            id: dancers.id,
            name: dancers.name,
            photo: dancers.photo,
            city: dancers.city,
            danceStyles: dancers.danceStyles,
          })
          .from(dancers)
          .where(
            and(
              inArray(dancers.id, otherDancerIds),
              eq(dancers.profilePublic, true),
            ),
          )

        const dancerMap = new Map(otherDancerRows.map(d => [d.id, d]))

        // Get festival metadata for all slugs referenced
        const allSlugs = [...new Set(otherPlans.map(p => p.itemId))]
        const festivalRows = allSlugs.length > 0
          ? await ctx.db
              .select({
                slug: festivals.slug,
                name: festivals.name,
                accentColor: festivals.accentColor,
              })
              .from(festivals)
              .where(inArray(festivals.slug, allSlugs))
          : []
        const festMap = new Map(festivalRows.map(f => [f.slug, f]))

        for (const plan of otherPlans) {
          const d = dancerMap.get(plan.dancerId)
          if (!d) continue
          const fest = festMap.get(plan.itemId)
          if (!fest) continue

          if (myFestivalSlugs.has(plan.itemId)) {
            // dancer-your-fest: they're going to a festival I also picked
            cards.push({
              kind: 'dancer-your-fest',
              dancerName: d.name,
              dancerPhoto: d.photo ?? '',
              dancerCity: d.city ?? '',
              dancerStyles: (d.danceStyles as string[]) ?? [],
              festivalSlug: plan.itemId,
              festivalName: fest.name,
              festivalColor: fest.accentColor ?? '#7c3aed',
            })
          } else {
            // dancer-new-fest: they're heading to a festival I haven't explored
            cards.push({
              kind: 'dancer-new-fest',
              dancerName: d.name,
              dancerPhoto: d.photo ?? '',
              dancerCity: d.city ?? '',
              dancerStyles: (d.danceStyles as string[]) ?? [],
              festivalSlug: plan.itemId,
              festivalName: fest.name,
              festivalColor: fest.accentColor ?? '#0ea5e9',
            })
          }
        }
      }
    } catch { /* non-critical */ }

    // 5. Upcoming events in the caller's city (event-social + event-festival)
    if (myCitySlug) {
      try {
        const now = new Date()
        const until = new Date(now.getTime() + 90 * 86400_000)

        const upcoming = await ctx.db
          .select({
            id: events.id,
            name: events.name,
            slug: events.slug,
            type: events.type,
            startDate: events.startDate,
            isFestival: events.isFestival,
            venueName: events.venueName,
            city: events.city,
            styles: events.styles,
          })
          .from(events)
          .where(
            and(
              eq(events.citySlug, myCitySlug),
              eq(events.published, true),
              eq(events.archived, false),
              gte(events.endDate, now),
              lt(events.startDate, until),
            ),
          )
          .orderBy(asc(events.startDate))
          .limit(30)

        const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
        const STYLE_COLORS: Record<string, string> = {
          Salsa: '#f59e0b',
          Bachata: '#a855f7',
          Kizomba: '#0ea5e9',
          Cuban: '#dc2626',
          Timba: '#dc2626',
          Zouk: '#16a34a',
        }

        for (const ev of upcoming) {
          const evStyles = (ev.styles as string[]) ?? []
          const mainStyle = evStyles[0] ?? ev.type ?? ''

          if (ev.isFestival) {
            const slug = ev.slug ?? ev.id
            if (myFestivalSlugs.has(slug)) continue
            cards.push({
              kind: 'event-festival',
              eventName: ev.name ?? '',
              eventSlug: slug,
              eventDateISO: ev.startDate ? ev.startDate.toISOString() : '',
              eventVenue: ev.venueName ?? '',
              eventCity: ev.city ?? '',
              friendsGoing: 0,
              color: STYLE_COLORS[mainStyle] ?? '#a855f7',
            })
          } else {
            const start = ev.startDate
            cards.push({
              kind: 'event-social',
              eventName: ev.name ?? '',
              eventDayLabel: start ? DAY_NAMES[start.getDay()] : '',
              eventTime: start ? `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}` : '',
              eventVenue: ev.venueName ?? '',
              eventCity: ev.city ?? '',
              eventStyle: mainStyle,
              friendsGoing: 0,
              color: STYLE_COLORS[mainStyle] ?? '#f59e0b',
            })
          }
        }
      } catch { /* non-critical */ }
    }

    // 6. Fallback: if no cards were produced, broaden the search to any city
    if (cards.length === 0) {
      try {
        const anyDancers = await ctx.db
          .select({
            id: dancers.id,
            name: dancers.name,
            photo: dancers.photo,
            city: dancers.city,
            danceStyles: dancers.danceStyles,
          })
          .from(dancers)
          .where(
            and(
              ne(dancers.id, ctx.dancerId),
              eq(dancers.profilePublic, true),
            ),
          )
          .limit(15)

        for (const d of anyDancers) {
          cards.push({
            kind: 'dancer-local',
            dancerName: d.name,
            dancerPhoto: d.photo ?? '',
            dancerCity: d.city ?? '',
            dancerStyles: (d.danceStyles as string[]) ?? [],
          })
        }
      } catch { /* non-critical */ }

      if (cards.length === 0) {
        try {
          const now = new Date()
          const until = new Date(now.getTime() + 90 * 86400_000)
          const anyEvents = await ctx.db
            .select({
              id: events.id,
              name: events.name,
              slug: events.slug,
              type: events.type,
              startDate: events.startDate,
              isFestival: events.isFestival,
              venueName: events.venueName,
              city: events.city,
              styles: events.styles,
            })
            .from(events)
            .where(
              and(
                eq(events.published, true),
                eq(events.archived, false),
                gte(events.endDate, now),
                lt(events.startDate, until),
              ),
            )
            .orderBy(asc(events.startDate))
            .limit(15)

          const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
          for (const ev of anyEvents) {
            const evStyles = (ev.styles as string[]) ?? []
            const mainStyle = evStyles[0] ?? ev.type ?? ''
            const start = ev.startDate
            cards.push({
              kind: 'event-social',
              eventName: ev.name ?? '',
              eventDayLabel: start ? DAY_NAMES[start.getDay()] : '',
              eventTime: start ? `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}` : '',
              eventVenue: ev.venueName ?? '',
              eventCity: ev.city ?? '',
              eventStyle: mainStyle,
              friendsGoing: 0,
              color: '#f59e0b',
            })
          }
        } catch { /* non-critical */ }
      }
    }

    // 7. Shuffle and cap at 20
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[cards[i], cards[j]] = [cards[j], cards[i]]
    }

    return { cards: cards.slice(0, 20) }
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
