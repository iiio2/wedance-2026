import { z } from 'zod'
import { eq, and, inArray, desc, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { dancers, events, festivals, giveawayProposals, networkLinks, profileMembers, profiles, referrals, trackedLinks } from '../../database/schema'
import { getReferralDiscountPercent } from '../../utils/ticket-prices'
import { ensureLink, isLinkCode, linkCounts, linkUrl, qrUrls, recordLinkAction, sumCounts } from '../../utils/trackedLinks'
import { eventHostProfile, requireEventManager } from './businessEvents'
import { requireMember } from './business'
import { onlyGranted } from '../../utils/profileAccess'
import { siteOrigin } from '../../oauth/config'
import { eventPath } from '../../../shared/utils/eventSlug'
import { eventLocalDate, eventLocalTime, eventLocalWeekday } from '../../../shared/utils/eventTime'
import { eventLanguage, hostLanguages, kitCaption, kitFlyers, kitHashtags, startKitFlyer } from '../../utils/promoKit'
import { LANGUAGES } from '../../../shared/utils/caption'
import { profileGroup, trackServer } from '../../utils/posthog'

/**
 * Referrals (dancer → dancer festival tickets with a discount) and, since MCP
 * phase 2, promoter tracked links: one link per promoter page + event
 * (server/utils/trackedLinks.ts), what each link brought, the promoter
 * dashboard and the promo kit.
 */

const isInfluencer = (p: { roles?: unknown }) => Array.isArray(p.roles) && (p.roles as string[]).includes('influencer')

/** A page I manage that may hold tracked links: a promoter page (influencers are promoters). */
async function requirePromoterPage(ctx: any, handle: string) {
  const p = await requireMember(ctx, handle)
  if (p.type !== 'promoter') {
    throw new TRPCError({ code: 'BAD_REQUEST', message: `Tracked links belong to promoter pages, and @${handle} is a${p.type === 'artist' || p.type === 'organizer' ? 'n' : ''} ${p.type} page. Use your promoter page, or create one in Business → New page.` })
  }
  return p
}

/** A published event that's on and not over: what a promoter may link to. */
async function linkableEvent(db: any, eventId: string) {
  const [ev] = await db.select().from(events).where(eq(events.id, eventId))
  if (!ev || ev.archived || !ev.published) throw new TRPCError({ code: 'NOT_FOUND', message: 'No published event with that id. Only public events can be promoted.' })
  if (new Date(ev.endDate ?? ev.startDate).getTime() < Date.now()) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This event is over.' })
  return ev
}

function eventCard(origin: string, e: any) {
  const tz = e.timezone || 'Europe/Berlin'
  return {
    id: e.id, name: e.name, city: e.city, venue: e.venueName ?? null,
    when: e.startDate ? `${eventLocalWeekday(e.startDate, tz)} ${eventLocalDate(e.startDate, tz)} ${eventLocalTime(e.startDate, tz)}` : null,
    start: e.startDate, url: `${origin}${eventPath(e)}`,
  }
}

const originOf = (ctx: any) => ctx.origin || siteOrigin()

/** Links of some pages, with their events and counts (newest events first). */
async function linksWithResults(ctx: any, where: any) {
  const rows = await ctx.db.select({ link: trackedLinks, event: events, page: { username: profiles.username, name: profiles.name } })
    .from(trackedLinks)
    .innerJoin(events, eq(events.id, trackedLinks.eventId))
    .innerJoin(profiles, eq(profiles.id, trackedLinks.profileId))
    .where(where)
    .orderBy(desc(events.startDate))
    .limit(200)
  const counts = await linkCounts(ctx.db, rows.map((r: any) => r.link.id))
  const origin = originOf(ctx)
  return rows.map((r: any) => ({
    page: r.page.username, event: eventCard(origin, r.event), code: r.link.code,
    url: linkUrl(origin, r.event, r.link.code), results: counts.get(r.link.id)!,
  }))
}

export const referralRouter = router({
  /**
   * Validate a referral code (username or dancer ID) for a given festival.
   * Returns the referrer's display name and the discount percentage, or null
   * if the code is invalid or the festival has no referral program.
   *
   * Public — the viewer may not be signed in yet when they land on a
   * referral link.
   */
  validate: publicProcedure
    .input(z.object({
      festivalSlug: z.string(),
      referralCode: z.string().min(1),
    }))
    .query(async ({ ctx, input }) => {
      const discountPercent = getReferralDiscountPercent(input.festivalSlug)
      if (discountPercent === 0) {
        return null
      }

      // Look up the referrer by username first, then by dancer ID.
      let referrer: { id: string; name: string; username: string | null } | undefined

      const [byUsername] = await ctx.db
        .select({ id: dancers.id, name: dancers.name, username: dancers.username })
        .from(dancers)
        .where(eq(dancers.username, input.referralCode))

      if (byUsername) {
        referrer = byUsername
      } else {
        // Try as UUID dancer ID (silently ignore malformed UUIDs).
        try {
          const [byId] = await ctx.db
            .select({ id: dancers.id, name: dancers.name, username: dancers.username })
            .from(dancers)
            .where(eq(dancers.id, input.referralCode))
          if (byId) referrer = byId
        } catch {
          // Not a valid UUID — no match.
        }
      }

      if (!referrer) return null

      return {
        referrerName: referrer.name,
        referrerUsername: referrer.username,
        discountPercent,
      }
    }),

  /**
   * List referrals the current dancer has made (as referrer).
   * Used on the profile / dashboard to show "your referral credits".
   */
  myReferrals: publicProcedure
    .input(z.object({ festivalSlug: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      if (!ctx.dancerId) return { referrals: [], availableCreditCents: 0 }

      const conditions = [eq(referrals.referrerId, ctx.dancerId)]
      if (input?.festivalSlug) {
        const [festival] = await ctx.db
          .select({ id: festivals.id })
          .from(festivals)
          .where(eq(festivals.slug, input.festivalSlug))
        if (festival) {
          conditions.push(eq(referrals.festivalId, festival.id))
        }
      }

      const rows = await ctx.db
        .select({
          id: referrals.id,
          status: referrals.status,
          discountCents: referrals.discountCents,
          referrerCreditCents: referrals.referrerCreditCents,
          referrerCreditAppliedSessionId: referrals.referrerCreditAppliedSessionId,
          createdAt: referrals.createdAt,
          completedAt: referrals.completedAt,
        })
        .from(referrals)
        .where(conditions.length === 1 ? conditions[0] : and(...conditions))

      // Compute aggregated credit balance for convenience.
      const totalCreditCents = rows.reduce((sum: number, r: any) =>
        r.status === 'completed' && r.referrerCreditCents > 0 && !r.referrerCreditAppliedSessionId
          ? sum + r.referrerCreditCents
          : sum, 0)

      return { referrals: rows, availableCreditCents: totalCreditCents }
    }),

  // ── Promoter tracked links (MCP phase 2) ──────────────────────────────────

  /**
   * Someone opened a tracked link (app/plugins/tracked-link.client.ts): count a
   * visit once per browser (the anonymous session cookie), or per dancer.
   * Web only, not in the connected-app scope map.
   */
  trackVisit: publicProcedure
    .input(z.object({ code: z.string().min(1).max(40) }))
    .mutation(async ({ ctx, input }) => {
      if (!isLinkCode(input.code)) return { counted: false }
      const counted = await recordLinkAction(ctx.db, input.code, 'visit', { dancerId: ctx.dancerId, visitorId: ctx.voterSessionId ?? null })
      return { counted }
    }),

  /** My personal link to an event, for one of my promoter pages (made on first use). */
  myLink: protectedProcedure
    .input(z.object({ eventId: z.string().uuid(), profile: z.string().min(1).max(200) }))
    .mutation(async ({ ctx, input }) => {
      const page = await requirePromoterPage(ctx, input.profile)
      const ev = await linkableEvent(ctx.db, input.eventId)
      const link = await ensureLink(ctx.db, ev.id, page.id, ctx.dancerId)
      const origin = originOf(ctx)
      const results = (await linkCounts(ctx.db, [link.id])).get(link.id)!
      return { page: page.username, event: eventCard(origin, ev), code: link.code, url: linkUrl(origin, ev, link.code), qr: qrUrls(origin, link.code), results }
    }),

  /** What my promoter pages' links brought: visits, sign-ups, plan adds, tickets, per event. */
  myResults: protectedProcedure
    .input(z.object({ profile: z.string().min(1).max(200).optional(), eventId: z.string().uuid().optional() }).optional())
    .query(async ({ ctx, input }) => {
      let pageIds: string[]
      if (input?.profile) pageIds = [(await requirePromoterPage(ctx, input.profile)).id]
      else {
        const mine = await ctx.db.select({ id: profiles.id }).from(profileMembers)
          .innerJoin(profiles, eq(profiles.id, profileMembers.profileId))
          .where(and(eq(profileMembers.dancerId, ctx.dancerId), eq(profiles.type, 'promoter')))
        pageIds = onlyGranted(ctx, mine, (r: any) => r.id).map((r: any) => r.id)
      }
      if (!pageIds.length) return { links: [], totals: sumCounts([]) }
      const links = await linksWithResults(ctx, and(inArray(trackedLinks.profileId, pageIds), input?.eventId ? eq(trackedLinks.eventId, input.eventId) : undefined))
      return { links, totals: sumCounts(links.map((l: any) => l.results)) }
    }),

  /** For an event's team: every promoter's link to the event and what it brought. */
  eventLinkResults: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireEventManager(ctx, input.eventId)
      const links = await linksWithResults(ctx, eq(trackedLinks.eventId, input.eventId))
      return { links: links.map(({ event: _e, ...l }: any) => l), totals: sumCounts(links.map((l: any) => l.results)) }
    }),

  /** A promoter page at a glance: its links and results, roster, giveaway proposals. */
  promoterDashboard: protectedProcedure
    .input(z.object({ profile: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const page = await requirePromoterPage(ctx, input.profile)
      const links = await linksWithResults(ctx, eq(trackedLinks.profileId, page.id))
      const now = Date.now()
      const live = (l: any) => new Date(l.event.start).getTime() >= now - 86400_000
      const [roster] = await ctx.db.select({ n: sql<number>`count(*)::int` }).from(networkLinks)
        .innerJoin(profiles, eq(profiles.id, networkLinks.otherProfileId))
        .where(and(eq(networkLinks.profileId, page.id), eq(networkLinks.status, 'added'), eq(profiles.type, 'artist')))
      const proposals = await ctx.db.select({ id: giveawayProposals.id, eventId: giveawayProposals.eventId, event: events.name, prize: giveawayProposals.prize, status: giveawayProposals.status, giveawayId: giveawayProposals.giveawayId, createdAt: giveawayProposals.createdAt })
        .from(giveawayProposals).innerJoin(events, eq(events.id, giveawayProposals.eventId))
        .where(eq(giveawayProposals.profileId, page.id)).orderBy(desc(giveawayProposals.createdAt)).limit(20)
      return {
        page: { username: page.username, name: page.name, city: page.city, influencer: isInfluencer(page) },
        totals: sumCounts(links.map((l: any) => l.results)),
        upcoming: links.filter(live).reverse(),
        past: links.filter((l: any) => !live(l)).slice(0, 20),
        rosterArtists: Number(roster?.n ?? 0),
        giveawayProposals: proposals,
      }
    }),

  /**
   * Everything to promote an event: flyer (story + feed), caption in the
   * event's languages, hashtags, and for a promoter page its tracked link and QR
   * code. Paints a flyer only when the event has none (poll flyer_status with
   * the batch). The event's team may use any of their pages (no link then).
   */
  promoKit: protectedProcedure
    .input(z.object({
      eventId: z.string().uuid(),
      profile: z.string().min(1).max(200),
      language: z.enum(LANGUAGES.map(l => l.value) as [string, ...string[]]).optional(),
      paintIfMissing: z.boolean().default(true),
    }))
    .mutation(async ({ ctx, input }) => {
      const page = await requireMember(ctx, input.profile)
      let manager = false
      try { await requireEventManager(ctx, input.eventId); manager = true } catch { /* a promoter, not its team */ }
      if (page.type !== 'promoter' && !manager) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'Promo kits are for promoter pages and the event’s own team.' })
      }
      const ev = manager
        ? (await ctx.db.select().from(events).where(eq(events.id, input.eventId)))[0]
        : await linkableEvent(ctx.db, input.eventId)
      const origin = originOf(ctx)
      const link = page.type === 'promoter' && ev.published && !ev.archived ? await ensureLink(ctx.db, ev.id, page.id, ctx.dancerId) : null
      const language = input.language ?? eventLanguage(await hostLanguages(ctx.db, ev.hostProfileId), ev.country)

      let flyers = await kitFlyers(ctx.db, ev.id)
      let painting: { batchId: string } | null = flyers.paintingBatchId ? { batchId: flyers.paintingBatchId } : null
      if (!flyers.story && !flyers.feed && !painting && !flyers.recentFailure && input.paintIfMissing) {
        painting = await startKitFlyer(ctx.db, ev, ctx.dancerId, ctx.waitUntil)
        flyers = { ...flyers, paintingBatchId: painting.batchId }
      }
      const cap = await kitCaption(ctx.db, ev, { language, linkId: link?.id ?? null, linkCaption: link?.caption ?? null, manager })
      const host = await eventHostProfile(ctx.db, ev)
      const url = link ? linkUrl(origin, ev, link.code) : `${origin}${eventPath(ev)}`
      // promo_kit_opened: a promoter / the event team pulled the kit (MCP or web).
      trackServer(ctx, 'promo_kit_opened', { event_id: ev.id, profile_type: page.type, manager, has_link: !!link, has_flyer: !!(flyers.story || flyers.feed), painting: !!painting, language, ...profileGroup(page.username) })
      return {
        event: { ...eventCard(origin, ev), host: host?.name ?? null, styles: ev.styles ?? [] },
        flyer: {
          story: flyers.story, feed: flyers.feed,
          painting: painting ? { batchId: painting.batchId, next: 'A flyer is being painted (about a minute): poll flyer_status with this batch_id, or call promo_kit again.' } : null,
          hint: flyers.recentFailure && !flyers.story && !flyers.feed
            ? `The flyer painting just failed (${flyers.recentFailure}). Try again in a few minutes, or ask the organizer.`
            : !flyers.story && !flyers.feed && !painting ? 'No flyer yet. Ask the organizer, or call again with paint_if_missing.' : (flyers.story && !flyers.feed ? 'Only the story (9:16) exists; the organizer can make the 4:5 feed version from it.' : null),
        },
        caption: cap.caption ? { language: cap.caption.language, text: cap.caption.text, from: cap.source } : null,
        captionNote: cap.error ?? null,
        hashtags: kitHashtags(cap.caption?.text, ev.styles ?? [], ev.city),
        link: link ? { url, code: link.code, qr: qrUrls(origin, link.code), linkInBio: 'Instagram captions can’t hold links: put the link in your bio or on a story link sticker.' } : null,
        forInfluencer: isInfluencer(page) ? 'Post the story with a link sticker to your link, the feed post with the caption, and tag the organizer. Sign-ups and tickets from your link show in my_results.' : null,
      }
    }),
})
