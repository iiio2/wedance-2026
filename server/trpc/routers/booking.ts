import { z } from 'zod'
import { eq, and, inArray } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { bookableSpaces, bookingRequests, profiles, availabilitySlots, dancers } from '../../database/schema'
import { requireProfileRole } from '../../utils/profileAccess'
import { trackServer } from '../../utils/posthog'

// Validates a HH:MM string has realistic hour (00–23) and minute (00–59).
const timeString = z.string().regex(/^\d{2}:\d{2}$/).refine((v) => {
  const [h, m] = v.split(':').map(Number)
  return h >= 0 && h <= 23 && m >= 0 && m <= 59
}, { message: 'Invalid time — hours must be 00–23, minutes 00–59' })

// Only an admin or a team member (owner/editor/moderator) may manage availability.
// Step 13 (ADR-004): uses membership check instead of moderatorHandle string comparison.
async function requireSpaceOwner(ctx: any, spaceId: string) {
  const [space] = await ctx.db
    .select({ profileId: bookableSpaces.profileId })
    .from(bookableSpaces)
    .where(eq(bookableSpaces.id, spaceId))
  if (!space) throw new TRPCError({ code: 'NOT_FOUND', message: 'Space not found.' })
  await requireProfileRole(ctx, space.profileId, 'moderator')
}

// Parse a YYYY-MM-DD string as a UTC date to get a stable weekday regardless of
// the server's local timezone.
function utcDayOfWeek(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number)
  const utc = new Date(Date.UTC(y, m - 1, d))
  const dow = utc.getUTCDay() // 0=Sun
  return dow === 0 ? 7 : dow   // ISO: 1=Mon … 7=Sun
}

/**
 * Booking requests — connector model (WeDance holds no money). An organizer
 * requests a date for a bookable space; the venue responds off-platform for now.
 * Public so organizers can request without an account (email required); the
 * caller's dancerId is captured when signed in. Terms must be accepted.
 */
export const bookingRouter = router({
  // Scheduled events for a space/profile — the community calendar shown first on
  // an OpenAir commons page. Returns non-declined bookings (spaceId maps to a
  // space name client-side from the profile's spaces list).
  scheduleForProfile: publicProcedure
    .input(z.object({ profileId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          id: bookingRequests.id,
          spaceId: bookingRequests.spaceId,
          title: bookingRequests.title,
          eventType: bookingRequests.eventType,
          styles: bookingRequests.styles,
          artists: bookingRequests.artists,
          eventDate: bookingRequests.eventDate,
          startTime: bookingRequests.startTime,
          endTime: bookingRequests.endTime,
          headcount: bookingRequests.headcount,
          message: bookingRequests.message,
          requesterName: bookingRequests.requesterName,
          status: bookingRequests.status,
        })
        .from(bookingRequests)
        .where(eq(bookingRequests.profileId, input.profileId))

      return rows
        .filter((r: any) => r.status !== 'declined')
        .sort((a: any, b: any) => String(a.eventDate ?? '9999').localeCompare(String(b.eventDate ?? '9999')))
    }),

  // Upcoming events across all venues in a city — the "what's on" feed shown on
  // the city page. Joins bookings to their venue profile by citySlug.
  upcomingByCity: publicProcedure
    .input(z.object({ citySlug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const organizer = alias(profiles, 'organizer')
      const rows = await ctx.db
        .select({
          id: bookingRequests.id,
          title: bookingRequests.title,
          eventType: bookingRequests.eventType,
          styles: bookingRequests.styles,
          artists: bookingRequests.artists,
          eventDate: bookingRequests.eventDate,
          startTime: bookingRequests.startTime,
          status: bookingRequests.status,
          venueName: profiles.name,
          venueHandle: profiles.username,
          organizerName: organizer.name,
          organizerHandle: organizer.username,
        })
        .from(bookingRequests)
        .innerJoin(profiles, eq(bookingRequests.profileId, profiles.id))
        .leftJoin(organizer, eq(bookingRequests.organizerId, organizer.id))
        .where(and(eq(profiles.citySlug, input.citySlug), eq(profiles.status, 'visible')))

      const today = new Date().toISOString().slice(0, 10)
      return rows
        .filter((r: any) => r.status !== 'declined' && (!r.eventDate || String(r.eventDate).slice(0, 10) >= today))
        .sort((a: any, b: any) => String(a.eventDate ?? '9999').localeCompare(String(b.eventDate ?? '9999')))
    }),

  // A single event's detail (for the /events/<id> page) — with venue + space.
  getEvent: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [ev] = await ctx.db
        .select({
          id: bookingRequests.id,
          title: bookingRequests.title,
          eventType: bookingRequests.eventType,
          styles: bookingRequests.styles,
          artists: bookingRequests.artists,
          eventDate: bookingRequests.eventDate,
          startTime: bookingRequests.startTime,
          endTime: bookingRequests.endTime,
          headcount: bookingRequests.headcount,
          message: bookingRequests.message,
          requesterName: bookingRequests.requesterName,
          status: bookingRequests.status,
          ticketUrl: bookingRequests.ticketUrl,
          spaceName: bookableSpaces.name,
          venueName: profiles.name,
          venueHandle: profiles.username,
          venueAddress: profiles.address,
          venueCity: profiles.city,
        })
        .from(bookingRequests)
        .innerJoin(bookableSpaces, eq(bookingRequests.spaceId, bookableSpaces.id))
        .innerJoin(profiles, eq(bookingRequests.profileId, profiles.id))
        .where(eq(bookingRequests.id, input.id))

      if (!ev) throw new TRPCError({ code: 'NOT_FOUND', message: 'Event not found.' })
      return ev
    }),

  request: publicProcedure
    .input(z.object({
      spaceId: z.string().uuid(),
      ticketUrl: z.union([z.string().url(), z.literal('')]).optional(),
      email: z.string().email(),
      name: z.string().max(160).optional(),
      title: z.string().max(160).optional(),
      eventType: z.string().max(40).optional(),
      styles: z.array(z.string()).optional(),
      artists: z.array(z.string()).optional(),
      // The organiser running this event — an @handle of an 'organizer' profile.
      // Resolved to organizerId below; unknown/blank handles are simply ignored.
      organizerHandle: z.string().max(160).optional(),
      eventDate: z.string().optional(), // YYYY-MM-DD
      startTime: timeString.optional(), // HH:MM (00:00–23:59)
      endTime: timeString.optional(),
      headcount: z.number().int().positive().max(100000).optional(),
      message: z.string().max(2000).optional(),
      termsAccepted: z.boolean(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!input.termsAccepted) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Please accept the booking terms to continue.' })
      }

      const [space] = await ctx.db
        .select({ id: bookableSpaces.id, profileId: bookableSpaces.profileId })
        .from(bookableSpaces)
        .where(eq(bookableSpaces.id, input.spaceId))

      if (!space) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'That space no longer exists.' })
      }

      // Check availability: if the space has published slots, the requested day
      // must fall on an active slot's day-of-week AND the requested time window
      // must fit within at least one matching slot's start/end times.
      if (input.eventDate) {
        const slots = await ctx.db
          .select({ dayOfWeek: availabilitySlots.dayOfWeek, startTime: availabilitySlots.startTime, endTime: availabilitySlots.endTime })
          .from(availabilitySlots)
          .where(and(eq(availabilitySlots.spaceId, input.spaceId), eq(availabilitySlots.isActive, true)))

        if (slots.length) {
          const isoDay = utcDayOfWeek(input.eventDate)
          const daySlots = slots.filter(s => s.dayOfWeek === isoDay)
          if (!daySlots.length) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'This space is not available on that day.' })
          }

          // If a start time is provided, verify it falls within at least one slot's window.
          if (input.startTime) {
            const reqStart = input.startTime
            const reqEnd = input.endTime || input.startTime
            const fits = daySlots.some(s => reqStart >= s.startTime && reqEnd <= s.endTime)
            if (!fits) {
              throw new TRPCError({ code: 'BAD_REQUEST', message: 'The requested time is outside this space\'s available hours.' })
            }
          }
        }
      }

      // Resolve the organiser handle (if given) to a visible 'organizer' profile.
      let organizerId: string | null = null
      const handle = input.organizerHandle?.trim().replace(/^@/, '')
      if (handle) {
        const [org] = await ctx.db
          .select({ id: profiles.id })
          .from(profiles)
          .where(and(eq(profiles.username, handle), eq(profiles.type, 'organizer')))
        organizerId = org?.id ?? null
      }

      const [row] = await ctx.db
        .insert(bookingRequests)
        .values({
          spaceId: space.id,
          profileId: space.profileId,
          organizerId,
          requesterId: ctx.dancerId ?? null,
          requesterEmail: input.email,
          requesterName: input.name ?? null,
          title: input.title ?? null,
          eventType: input.eventType ?? null,
          styles: input.styles ?? [],
          artists: input.artists ?? [],
          eventDate: input.eventDate ?? null,
          startTime: input.startTime ?? null,
          endTime: input.endTime ?? null,
          headcount: input.headcount ?? null,
          message: input.message ?? null,
          ticketUrl: input.ticketUrl || null,
          termsAcceptedAt: new Date(),
        })
        .returning({ id: bookingRequests.id })

      trackServer(ctx, 'booking_requested', { booking_id: row!.id, signed_in: !!ctx.dancerId })
      return { ok: true, id: row!.id }
    }),

  // --- Availability slots (venue-published weekly windows) ---

  // All active slots for a profile (public — shown on the calendar).
  availabilityForProfile: publicProcedure
    .input(z.object({ profileId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const spaceIds = await ctx.db
        .select({ id: bookableSpaces.id })
        .from(bookableSpaces)
        .where(eq(bookableSpaces.profileId, input.profileId))

      if (!spaceIds.length) return []

      return ctx.db
        .select({
          id: availabilitySlots.id,
          spaceId: availabilitySlots.spaceId,
          dayOfWeek: availabilitySlots.dayOfWeek,
          startTime: availabilitySlots.startTime,
          endTime: availabilitySlots.endTime,
        })
        .from(availabilitySlots)
        .where(and(
          inArray(availabilitySlots.spaceId, spaceIds.map(s => s.id)),
          eq(availabilitySlots.isActive, true),
        ))
    }),

  // Set availability for a space — replaces all existing slots for that space.
  // Protected: only an admin or the space's elected moderator may manage slots.
  setAvailability: protectedProcedure
    .input(z.object({
      spaceId: z.string().uuid(),
      slots: z.array(z.object({
        dayOfWeek: z.number().int().min(1).max(7),
        startTime: timeString,
        endTime: timeString,
      })),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireSpaceOwner(ctx, input.spaceId)

      // Atomic replace: delete + insert inside a transaction so a failed insert
      // doesn't leave the space with zero slots.
      await ctx.db.transaction(async (tx) => {
        await tx.delete(availabilitySlots).where(eq(availabilitySlots.spaceId, input.spaceId))

        if (input.slots.length) {
          await tx.insert(availabilitySlots).values(
            input.slots.map(s => ({
              spaceId: input.spaceId,
              dayOfWeek: s.dayOfWeek,
              startTime: s.startTime,
              endTime: s.endTime,
            })),
          )
        }
      })

      return { ok: true }
    }),
})
