import { z } from 'zod'
import { eq, and, sql, inArray, ne } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure, adminProcedure } from '../trpc'
import { attendances, dancers, events, profileMembers } from '../../database/schema'

const visibilityEnum = z.enum(['hidden', 'public_minimal', 'public_full'])
const statusEnum = z.enum(['interested', 'going', 'none'])

export const attendanceRouter = router({
  /**
   * Set attendance status for an event. 'none' removes the attendance.
   * Default visibility = hidden (opt-in, per RAZ-313).
   */
  set: protectedProcedure
    .input(z.object({
      eventId: z.string().uuid(),
      status: statusEnum,
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify event exists.
      const [event] = await ctx.db
        .select({ id: events.id })
        .from(events)
        .where(eq(events.id, input.eventId))

      if (!event) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found' })
      }

      if (input.status === 'none') {
        // Remove attendance (only if not a ticket_holder — tickets can't be un-attended).
        await ctx.db
          .delete(attendances)
          .where(
            and(
              eq(attendances.eventId, input.eventId),
              eq(attendances.dancerId, ctx.dancerId),
              ne(attendances.status, 'ticket_holder'),
            ),
          )
        return { status: null }
      }

      // Upsert: don't downgrade a ticket_holder.
      const [existing] = await ctx.db
        .select({ id: attendances.id, status: attendances.status })
        .from(attendances)
        .where(
          and(
            eq(attendances.eventId, input.eventId),
            eq(attendances.dancerId, ctx.dancerId),
          ),
        )

      if (existing) {
        // Never downgrade ticket_holder via a click.
        if (existing.status === 'ticket_holder') {
          return { status: 'ticket_holder' as const }
        }
        await ctx.db
          .update(attendances)
          .set({ status: input.status, updatedAt: new Date() })
          .where(eq(attendances.id, existing.id))
        return { status: input.status }
      }

      // Insert new attendance.
      await ctx.db
        .insert(attendances)
        .values({
          eventId: input.eventId,
          dancerId: ctx.dancerId,
          status: input.status,
          source: 'click',
          visibility: 'hidden',
        })
        .onConflictDoNothing()

      return { status: input.status }
    }),

  /**
   * Get the caller's attendance for a specific event.
   */
  mine: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [row] = await ctx.db
        .select({
          id: attendances.id,
          status: attendances.status,
          visibility: attendances.visibility,
          partnerStatus: attendances.partnerStatus,
          travelBookedAt: attendances.travelBookedAt,
          stayBookedAt: attendances.stayBookedAt,
          vacationBookedAt: attendances.vacationBookedAt,
          checkedInAt: attendances.checkedInAt,
          verifiedAt: attendances.verifiedAt,
          source: attendances.source,
        })
        .from(attendances)
        .where(
          and(
            eq(attendances.eventId, input.eventId),
            eq(attendances.dancerId, ctx.dancerId),
          ),
        )

      return row ?? null
    }),

  /**
   * Set the visibility of the caller's attendance.
   */
  setVisibility: protectedProcedure
    .input(z.object({
      eventId: z.string().uuid(),
      visibility: visibilityEnum,
    }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(attendances)
        .set({ visibility: input.visibility, updatedAt: new Date() })
        .where(
          and(
            eq(attendances.eventId, input.eventId),
            eq(attendances.dancerId, ctx.dancerId),
          ),
        )
        .returning({ visibility: attendances.visibility })

      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No attendance for this event' })
      }

      return { visibility: result[0].visibility }
    }),

  /**
   * Update logistics (partner status, travel/stay/vacation booked).
   * These were localStorage toggles; now they're server state.
   */
  updateLogistics: protectedProcedure
    .input(z.object({
      eventId: z.string().uuid(),
      partnerStatus: z.enum(['looking', 'found']).nullish(),
      travelBooked: z.boolean().optional(),
      stayBooked: z.boolean().optional(),
      vacationBooked: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const set: Record<string, unknown> = { updatedAt: new Date() }
      if (input.partnerStatus !== undefined) set.partnerStatus = input.partnerStatus
      if (input.travelBooked !== undefined) set.travelBookedAt = input.travelBooked ? new Date() : null
      if (input.stayBooked !== undefined) set.stayBookedAt = input.stayBooked ? new Date() : null
      if (input.vacationBooked !== undefined) set.vacationBookedAt = input.vacationBooked ? new Date() : null

      const result = await ctx.db
        .update(attendances)
        .set(set)
        .where(
          and(
            eq(attendances.eventId, input.eventId),
            eq(attendances.dancerId, ctx.dancerId),
          ),
        )
        .returning({ id: attendances.id })

      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'No attendance for this event' })
      }

      return { ok: true }
    }),

  /**
   * Public attendee list for an event. One public rule (ADR-008):
   * visible = status IN (going, ticket_holder) AND visibility <> hidden AND profile_public.
   * Ticket holders carry a verified badge.
   */
  publicList: publicProcedure
    .input(z.object({
      eventId: z.string().uuid(),
      limit: z.number().int().min(1).max(50).default(50),
    }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          dancerId: attendances.dancerId,
          name: dancers.name,
          photo: dancers.photo,
          city: dancers.city,
          username: dancers.username,
          status: attendances.status,
          visibility: attendances.visibility,
        })
        .from(attendances)
        .innerJoin(dancers, eq(attendances.dancerId, dancers.id))
        .where(
          and(
            eq(attendances.eventId, input.eventId),
            inArray(attendances.status, ['going', 'ticket_holder']),
            ne(attendances.visibility, 'hidden'),
            eq(dancers.profilePublic, true),
          ),
        )
        .limit(input.limit)

      // Counts include hidden attendees (counted, never listed).
      const [counts] = await ctx.db
        .select({
          going: sql<number>`count(*) filter (where ${attendances.status} = 'going')::int`,
          verified: sql<number>`count(*) filter (where ${attendances.status} = 'ticket_holder')::int`,
          hidden: sql<number>`count(*) filter (where ${attendances.visibility} = 'hidden')::int`,
        })
        .from(attendances)
        .where(
          and(
            eq(attendances.eventId, input.eventId),
            inArray(attendances.status, ['going', 'ticket_holder']),
          ),
        )

      return {
        attendees: rows.map(r => ({
          dancerId: r.dancerId,
          name: r.name,
          photo: r.visibility === 'public_full' ? r.photo : null,
          city: r.city,
          username: r.username,
          verified: r.status === 'ticket_holder',
        })),
        counts: {
          going: counts?.going ?? 0,
          verified: counts?.verified ?? 0,
          hidden: counts?.hidden ?? 0,
        },
      }
    }),

  /**
   * Batch counts for event cards (replaces plan.countBatch for the new model).
   * Returns going + verified counts + up to 10 face URLs per event.
   */
  counts: publicProcedure
    .input(z.object({
      eventIds: z.array(z.string().uuid()).min(1).max(100),
    }))
    .query(async ({ ctx, input }) => {
      // Aggregate counts per event.
      const rows = await ctx.db
        .select({
          eventId: attendances.eventId,
          going: sql<number>`count(*) filter (where ${attendances.status} = 'going')::int`,
          verified: sql<number>`count(*) filter (where ${attendances.status} = 'ticket_holder')::int`,
        })
        .from(attendances)
        .where(
          and(
            inArray(attendances.eventId, input.eventIds),
            inArray(attendances.status, ['going', 'ticket_holder']),
          ),
        )
        .groupBy(attendances.eventId)

      // Faces: up to 10 visible attendees with photos per event.
      const faceRows = await ctx.db
        .select({
          eventId: attendances.eventId,
          photo: dancers.photo,
        })
        .from(attendances)
        .innerJoin(dancers, eq(attendances.dancerId, dancers.id))
        .where(
          and(
            inArray(attendances.eventId, input.eventIds),
            inArray(attendances.status, ['going', 'ticket_holder']),
            eq(attendances.visibility, 'public_full'),
            eq(dancers.profilePublic, true),
            sql`${dancers.photo} IS NOT NULL AND ${dancers.photo} <> ''`,
          ),
        )
        .limit(input.eventIds.length * 10)

      const facesMap = new Map<string, string[]>()
      for (const f of faceRows) {
        const arr = facesMap.get(f.eventId) ?? []
        if (arr.length < 10) arr.push(f.photo!)
        facesMap.set(f.eventId, arr)
      }

      const result: Record<string, { going: number; verified: number; faces: string[] }> = {}
      for (const id of input.eventIds) {
        result[id] = { going: 0, verified: 0, faces: [] }
      }
      for (const r of rows) {
        result[r.eventId] = {
          going: r.going,
          verified: r.verified,
          faces: facesMap.get(r.eventId) ?? [],
        }
      }
      return result
    }),

  /**
   * Proof showcase for the landing page: the first verified ticket holder
   * with a public_full visibility, used as social proof.
   */
  proofShowcase: publicProcedure.query(async ({ ctx }) => {
    const [row] = await ctx.db
      .select({
        dancerName: dancers.name,
        dancerPhoto: dancers.photo,
        dancerCity: dancers.city,
        dancerUsername: dancers.username,
        eventName: events.name,
        eventSlug: events.slug,
      })
      .from(attendances)
      .innerJoin(dancers, eq(attendances.dancerId, dancers.id))
      .innerJoin(events, eq(attendances.eventId, events.id))
      .where(
        and(
          eq(attendances.status, 'ticket_holder'),
          eq(attendances.visibility, 'public_full'),
          eq(dancers.profilePublic, true),
          sql`${dancers.photo} IS NOT NULL AND ${dancers.photo} <> ''`,
          eq(events.archived, false),
        ),
      )
      .orderBy(sql`${attendances.verifiedAt} DESC NULLS LAST`)
      .limit(1)

    return row ?? null
  }),

  /**
   * Check in an attendee (organiser door flow). Requires the caller to be
   * an owner or editor of the event's host profile.
   */
  checkIn: protectedProcedure
    .input(z.object({
      eventId: z.string().uuid(),
      attendanceId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Verify the caller is an owner/editor of the event's host profile.
      const [event] = await ctx.db
        .select({ hostProfileId: events.hostProfileId })
        .from(events)
        .where(eq(events.id, input.eventId))

      if (!event?.hostProfileId) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Event has no host profile' })
      }

      const [membership] = await ctx.db
        .select({ role: profileMembers.role })
        .from(profileMembers)
        .where(
          and(
            eq(profileMembers.profileId, event.hostProfileId),
            eq(profileMembers.dancerId, ctx.dancerId),
            inArray(profileMembers.role, ['owner', 'editor']),
          ),
        )

      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Not a team member of this event' })
      }

      const now = new Date()
      const result = await ctx.db
        .update(attendances)
        .set({ checkedInAt: now, updatedAt: now })
        .where(
          and(
            eq(attendances.id, input.attendanceId),
            eq(attendances.eventId, input.eventId),
          ),
        )
        .returning({ checkedInAt: attendances.checkedInAt })

      if (result.length === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Attendance not found' })
      }

      return { checkedInAt: result[0].checkedInAt }
    }),
})
