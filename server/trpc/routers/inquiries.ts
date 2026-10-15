import { z } from 'zod'
import { and, eq, gte, desc, asc, sql, inArray, ne } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { profiles, profileMembers, dancers, bookingInquiries, events } from '../../database/schema'
import { inquirySchema } from '../../../shared/utils/bookingInquiry'
import { sendBookingInquiryEmail } from '../../utils/email'
import { requireMember } from './business'
import { requireEventManager } from './businessEvents'

/**
 * Booking inquiries — anyone asks to book an artist or venue from their page
 * (/@handle, or /@handle/book on the artist's own site), no account needed.
 * The page's team is emailed (Reply-To = the asker) and sees it under "Needs
 * you"; nobody running it → its private booking email, else WeDance passes it
 * on. Limits: 3 a day per asker per page, 10 a day per asker, 30 a day per page.
 *
 * Signed in with business profiles, the asker can also send it as one of
 * them, or skip the request: add the artist to one of their events (then send
 * the line-up link from the editor) or draft a new event with them.
 */

const DAY = 24 * 3600_000
const FORWARD_TO = 'hello@wedance.vip'

export const inquiriesRouter = router({
  // For a signed-in asker: their name and email, the pages they run (to send
  // as), and their upcoming events (to add the artist to).
  me: protectedProcedure.input(z.object({ handle: z.string().min(1).max(200) })).query(async ({ ctx, input }) => {
    const [d] = await ctx.db.select({ name: dancers.name, email: dancers.email }).from(dancers).where(eq(dancers.id, ctx.dancerId))
    const mine = await ctx.db.select({ id: profiles.id, username: profiles.username, name: profiles.name, type: profiles.type, city: profiles.city })
      .from(profileMembers).innerJoin(profiles, eq(profiles.id, profileMembers.profileId))
      .where(and(eq(profileMembers.dancerId, ctx.dancerId), ne(profiles.username, input.handle)))
    const evs = mine.length
      ? await ctx.db.select({ id: events.id, name: events.name, startDate: events.startDate, timezone: events.timezone, artists: events.artists, host: profiles.name })
        .from(events).innerJoin(profiles, eq(profiles.id, events.hostProfileId))
        .where(and(inArray(events.hostProfileId, mine.map((p: any) => p.id)), eq(events.archived, false), gte(events.startDate, new Date())))
        .orderBy(asc(events.startDate)).limit(20)
      : []
    return {
      name: d?.name ?? '', email: d?.email ?? '',
      profiles: mine.map(({ id: _id, ...p }: any) => p),
      events: evs.map(({ artists, ...e }: any) => ({ ...e, inLineup: (artists ?? []).includes(input.handle) })),
    }
  }),

  // Put the artist in one of my events' line-up; the editor then sends them the link.
  addToEvent: protectedProcedure.input(z.object({ eventId: z.string().uuid(), handle: z.string().min(1).max(200) })).mutation(async ({ ctx, input }) => {
    const ev = await requireEventManager(ctx, input.eventId)
    const [p] = await ctx.db.select({ type: profiles.type }).from(profiles).where(eq(profiles.username, input.handle))
    if (p?.type !== 'artist') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only artists go in a line-up.' })
    const artists: string[] = ev.artists ?? []
    if (!artists.includes(input.handle)) {
      await ctx.db.update(events).set({ artists: [...artists, input.handle], updatedAt: new Date() }).where(eq(events.id, input.eventId))
    }
    return { ok: true, eventId: input.eventId }
  }),

  send: publicProcedure.input(inquirySchema).mutation(async ({ ctx, input }) => {
    // A bot filled the hidden field: look like it worked, keep nothing.
    if (input.website) return { ok: true }
    const [p] = await ctx.db.select({ id: profiles.id, name: profiles.name, username: profiles.username, contact: profiles.contact })
      .from(profiles).where(eq(profiles.username, input.handle))
    if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'That page isn’t on WeDance.' })
    // Sent as a page the asker runs: its name, and a link to it in the email.
    let as: { name: string; username: string } | null = null
    if (input.asProfile) {
      if (!ctx.dancerId) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Sign in to send it as your page.' })
      const m = await requireMember({ ...ctx, dancerId: ctx.dancerId }, input.asProfile)
      as = { name: m.name, username: m.username }
    }

    const since = new Date(Date.now() - DAY)
    const count = async (...w: any[]) => (await ctx.db.select({ n: sql<number>`count(*)::int` }).from(bookingInquiries).where(and(gte(bookingInquiries.createdAt, since), ...w)))[0]?.n ?? 0
    if (await count(eq(bookingInquiries.email, input.email), eq(bookingInquiries.profileId, p.id)) >= 3
      || await count(eq(bookingInquiries.email, input.email)) >= 10
      || await count(eq(bookingInquiries.profileId, p.id)) >= 30) {
      throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'You’ve sent a few already today. They’ll get back to you.' })
    }

    const team = await ctx.db.select({ email: dancers.email, name: dancers.name }).from(profileMembers)
      .innerJoin(dancers, eq(dancers.id, profileMembers.dancerId)).where(eq(profileMembers.profileId, p.id))
    const own = (p.contact as { email?: string } | null)?.email?.trim()
    const to = team.length ? team : own ? [{ email: own, name: p.name }] : [{ email: FORWARD_TO, name: 'WeDance' }]
    const forward = !team.length && !own

    const [row] = await ctx.db.insert(bookingInquiries).values({
      profileId: p.id, requesterId: ctx.dancerId ?? null,
      name: input.name, email: input.email, phone: input.phone || null, organization: as?.name || input.organization || null,
      what: input.what, eventDate: input.eventDate || null, city: input.city || null,
      guests: input.guests ?? null, budget: input.budget || null, message: input.message,
      notified: forward ? 0 : to.length,
    }).returning({ id: bookingInquiries.id })

    const site = (useRuntimeConfig().siteUrl || 'https://2026.wedance.vip').replace(/\/$/, '')
    const day = input.eventDate ? new Date(`${input.eventDate}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''
    const lines = [input.what, day, input.city, input.guests ? `About ${input.guests} people` : '', input.budget ? `Budget: ${input.budget}` : '', as ? `Their page: ${site}/@${as.username}` : ''].filter(Boolean)
    for (const m of to) {
      try {
        await sendBookingInquiryEmail({
          to: m.email, name: m.name, profileName: p.name, forward,
          from: { name: input.name, email: input.email, phone: input.phone || null, organization: as?.name || input.organization || null },
          lines, message: input.message,
          link: forward ? `${site}/@${p.username}` : `${site}/business/network/${p.username}/bookings`,
        })
      } catch (e) { console.error('[inquiries] email failed', e) }
    }
    return { ok: true, id: row!.id, delivered: forward ? 'wedance' as const : 'team' as const }
  }),

  // The inquiries for a page I run, newest first.
  forProfile: protectedProcedure.input(z.object({ username: z.string().min(1) })).query(async ({ ctx, input }) => {
    const p = await requireMember(ctx, input.username)
    return ctx.db.select().from(bookingInquiries).where(eq(bookingInquiries.profileId, p.id)).orderBy(desc(bookingInquiries.createdAt)).limit(200)
  }),

  setStatus: protectedProcedure
    .input(z.object({ username: z.string().min(1), id: z.string().uuid(), status: z.enum(['new', 'answered', 'declined']) }))
    .mutation(async ({ ctx, input }) => {
      const p = await requireMember(ctx, input.username)
      await ctx.db.update(bookingInquiries).set({ status: input.status, answeredAt: input.status === 'new' ? null : new Date() })
        .where(and(eq(bookingInquiries.id, input.id), eq(bookingInquiries.profileId, p.id)))
      return { ok: true }
    }),
})
