import { z } from 'zod'
import { and, eq, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { events, profiles } from '../../database/schema'
import { profilesIManage } from './businessEvents'
import { linksInstagram } from './business'
import { parseInstagramLink, nameFromInstagram } from '../../../shared/utils/instagram'
import { apifyEnabled, ApifyError } from '../../utils/instagram/apify'
import { fetchInstagramPost, type InstagramPost } from '../../utils/instagram/post'
import { extractEventFields, planImportedEvent, ImportError, type ImportedEvent } from '../../utils/instagram/eventExtract'
import { textModelEnabled } from '../../utils/flyer/gemini'
import { rehostImage } from '../../utils/rehostImage'
import { emptyEventDetails } from '../../../shared/utils/programme'
import { profileGroup, trackServer } from '../../utils/posthog'

/**
 * An event from an Instagram post (#453): paste the link of the organiser's
 * post or reel, get a complete DRAFT — name, date and times, price, ticket
 * link, programme, line-up and venue as WeDance pages, the post's picture as
 * the cover. Used by the new-event page and the MCP tool import_from_instagram.
 *
 * Post → Apify (server/utils/instagram/post.ts) → Gemini reads the caption
 * (eventExtract.ts, which also checks the answer) → pages and the draft
 * through the same procedures the editor and the other MCP tools call
 * (addFromInstagram, addVenue, create), so the Instagram profile import (#452)
 * fills the new pages and permissions are the usual ones.
 */

type Caller = any

type Mine = { id: string; username: string; type: string }[]

/** The page that runs the event: the one asked for, else the only one, else the one that posted it / is named as organiser. */
async function pickHost(ctx: any, mine: Mine, asked: string | undefined, post: InstagramPost | null, organizers: string[] = []) {
  if (asked) {
    // Admins may run it as any page (businessEvents.create lets them).
    if (ctx.isAdmin || mine.some(m => m.username === asked)) return asked
    throw new TRPCError({ code: 'FORBIDDEN', message: `You don’t run @${asked}, or this app wasn’t given it. Your pages: ${mine.map(m => `@${m.username}`).join(', ') || 'none yet'}.` })
  }
  if (!mine.length) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Events are run by a page: create yours first (your festival, school, party series or venue).' })
  if (mine.length === 1) return mine[0]!.username
  for (const ig of [post?.ownerHandle, ...organizers].filter(Boolean) as string[]) {
    const pages = await ctx.db.select({ id: profiles.id }).from(profiles).where(linksInstagram(ig)).limit(5)
    const hit = mine.find(m => pages.some((p: any) => p.id === m.id))
    if (hit) return hit.username
  }
  throw new TRPCError({ code: 'BAD_REQUEST', message: `Which of your pages runs this event? Pass one of: ${mine.map(m => `@${m.username}`).join(', ')}.` })
}

/** A draft already imported from this post for this page (a retried call doesn't make a second one). */
async function existingImport(db: any, hostUsername: string, code: string) {
  const [row] = await db.select({ id: events.id, name: events.name })
    .from(events).innerJoin(profiles, eq(profiles.id, events.hostProfileId))
    .where(and(eq(profiles.username, hostUsername), eq(events.archived, false), sql`${events.sourceRef}->'instagram'->>'code' = ${code}`))
    .limit(1)
  return row ?? null
}

/** Line-up pages: the existing page linking that Instagram, else a new unclaimed one (filled by #452). */
async function lineupPages(caller: Caller, ev: ImportedEvent, warnings: string[]) {
  const out: { handle: string; instagram: string; name: string | null; role: string }[] = []
  for (const p of ev.lineup) {
    try {
      const page = await caller.businessEvents.addFromInstagram({ instagram: p.handle, type: 'artist', ...(p.name ? { name: p.name } : {}) })
      out.push({ handle: page.username, instagram: p.handle, name: p.name, role: p.role })
    } catch (e: any) {
      warnings.push(`@${p.handle} couldn’t be added to the line-up: ${e?.message ?? e}`)
    }
  }
  return out
}

/** The organisers the post names, as WeDance pages: the event's co-organisers (#456). The host page itself is left out. */
async function organizerPages(caller: Caller, ev: ImportedEvent, host: string, warnings: string[]) {
  const out: { username: string }[] = []
  for (const p of ev.organizers) {
    try {
      const page = await caller.businessEvents.addFromInstagram({ instagram: p.handle, type: 'organizer', ...(p.name ? { name: p.name } : {}) })
      if (page.username !== host) out.push({ username: page.username })
    } catch (e: any) {
      warnings.push(`@${p.handle} couldn’t be added as a co-organiser: ${e?.message ?? e}`)
    }
  }
  return out
}

/** The venue as a WeDance page when the post names its account or full address; else just its name and address. */
async function venuePage(caller: Caller, ev: ImportedEvent, warnings: string[]) {
  const v = ev.venue
  if (!v) return { venueUsername: null, venueName: null, venueAddress: null }
  const text = { venueUsername: null, venueName: v.name ?? (v.handle ? nameFromInstagram(v.handle) : null), venueAddress: v.address }
  const city = v.city ?? ev.city
  try {
    let page: any = null
    if (v.address && city && (v.name || v.handle)) {
      page = await caller.businessEvents.addVenue({ name: (v.name ?? nameFromInstagram(v.handle!)).slice(0, 120), address: v.address, city, ...(v.handle ? { instagram: v.handle } : {}) })
    } else if (v.handle) {
      page = await caller.businessEvents.addFromInstagram({ instagram: v.handle, type: 'venue', ...(v.name ? { name: v.name } : {}) })
    }
    // Only a venue page is a venue (an artist's page that shares the handle isn't).
    if (page?.type === 'venue') return { venueUsername: page.username as string, venueName: null, venueAddress: null }
    if (page) warnings.push(`@${page.username} is on WeDance as a ${page.type}, not a venue: the venue is kept as text.`)
  } catch (e: any) {
    warnings.push(`The venue couldn’t be added: ${e?.message ?? e}`)
  }
  return text
}

export const eventImportRouter = router({
  fromInstagram: protectedProcedure
    .input(z.object({
      url: z.string().trim().min(5).max(500),
      // The page that runs it; optional when the dancer has one page, or one that posted it.
      profile: z.string().trim().min(1).max(200).transform(h => h.replace(/^@/, '')).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const link = parseInstagramLink(input.url)
      if (!link) throw new TRPCError({ code: 'BAD_REQUEST', message: 'That isn’t an Instagram link. Paste the link of the event’s post or reel (instagram.com/p/… or /reel/…).' })
      if (link.kind === 'profile') throw new TRPCError({ code: 'BAD_REQUEST', message: `That’s the Instagram page @${link.handle}, not a post. Paste the link of the event’s post or reel (instagram.com/p/… or /reel/…).` })
      if (!apifyEnabled()) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Reading Instagram isn’t set up on this server (APIFY_TOKEN is missing). Fill in the event yourself instead.' })
      if (!textModelEnabled()) throw new TRPCError({ code: 'PRECONDITION_FAILED', message: 'Reading posts isn’t set up on this server (GEMINI_API_KEY is missing). Fill in the event yourself instead.' })

      // Its own caller: the same path, scope and permission checks as a direct call.
      const { appRouter } = await import('../index')
      const caller: Caller = appRouter.createCaller(ctx)

      const mine = await profilesIManage(ctx) as Mine
      if (input.profile) {
        // Fail on a page they don't run before paying for the post.
        await pickHost(ctx, mine, input.profile, null)
        const dupe = await existingImport(ctx.db, input.profile, link.code)
        if (dupe) return { id: dupe.id, created: false, name: dupe.name, host: input.profile, lineup: [], organizers: [], venue: null, cover: false, warnings: ['This post was imported before: here is that draft.'] }
      }

      let post: InstagramPost | null
      try {
        post = await fetchInstagramPost(link.url, link.code)
      } catch (e) {
        console.warn('[instagram import] post fetch failed', link.url, e instanceof ApifyError ? e.message : e)
        throw new TRPCError({ code: 'BAD_GATEWAY', message: 'Instagram couldn’t be read just now. Try again in a minute.' })
      }
      if (!post) throw new TRPCError({ code: 'NOT_FOUND', message: 'That post can’t be read: it may be private or deleted, or the link is wrong.' })
      if (!post.caption) throw new TRPCError({ code: 'BAD_REQUEST', message: 'That post has no caption to read the event from.' })

      let ev: ImportedEvent
      try {
        const raw = await extractEventFields(post, new Date().toISOString().slice(0, 10))
        ev = planImportedEvent(raw, post)
      } catch (e: any) {
        if (e instanceof ImportError) throw new TRPCError({ code: 'BAD_REQUEST', message: `${e.message} Fill in the event yourself instead.` })
        console.warn('[instagram import] reading the caption failed', e?.message ?? e)
        throw new TRPCError({ code: 'BAD_GATEWAY', message: 'The post couldn’t be read just now. Try again in a minute.' })
      }

      const host = await pickHost(ctx, mine, input.profile, post, ev.organizers.map(o => o.handle))
      if (!input.profile) {
        const dupe = await existingImport(ctx.db, host, link.code)
        if (dupe) return { id: dupe.id, created: false, name: dupe.name, host, lineup: [], organizers: [], venue: null, cover: false, warnings: ['This post was imported before: here is that draft.'] }
      }
      const warnings: string[] = []
      const lineup = await lineupPages(caller, ev, warnings)
      const venue = await venuePage(caller, ev, warnings)
      const coOrganizers = await organizerPages(caller, ev, host, warnings)
      // The handles the programme names are Instagram handles; the pages may differ ("salsa-js").
      const pageOf = new Map(lineup.map(p => [p.instagram, p.handle]))
      const sessions = ev.sessions.map(s => ({
        ...s,
        artist: s.artist ? (pageOf.get(s.artist) ?? '') : '',
        ...(s.with ? { with: s.with.map(h => pageOf.get(h)).filter((h): h is string => !!h) } : {}),
      }))

      let cover: string | null = null
      if (post.imageUrl) {
        try { cover = await rehostImage(post.imageUrl, 'events') }
        catch { warnings.push('The post’s picture couldn’t be copied: add a cover in the editor.') }
      }

      const names = Object.fromEntries(lineup.filter(p => p.name).map(p => [p.handle, p.name!.slice(0, 120)]))
      const { id } = await caller.businessEvents.create({
        hostUsername: host,
        name: ev.name, type: ev.type, date: ev.date, startTime: ev.startTime, endTime: ev.endTime, endDate: ev.endDate,
        city: ev.city, ...venue,
        artists: lineup.map(p => p.handle).slice(0, 40),
        coOrganizers,
        styles: ev.styles, description: ev.description, cover, ticketUrl: ev.ticketUrl, price: ev.price,
        published: false, agenda: [],
        flyerOptions: Object.keys(names).length ? { names } : {},
        festival: { ...emptyEventDetails(), sessions },
      })
      // Where it came from: a retry finds it, and the editor can say so.
      await ctx.db.update(events).set({ sourceRef: { instagram: { code: post.code, url: post.url, owner: post.ownerHandle, organizers: ev.organizers.map(o => o.handle), importedAt: new Date().toISOString() } } }).where(eq(events.id, id))

      trackServer(ctx, 'event_imported', { event_id: id, source: 'instagram', kind: link.kind, lineup: lineup.length, organizers: ev.organizers.length, has_venue_page: !!venue.venueUsername, has_cover: !!cover, has_ticket: !!ev.ticketUrl, sessions: sessions.length, ...profileGroup(host) })
      return {
        id, created: true, name: ev.name, host,
        lineup: lineup.map(p => ({ handle: p.handle, name: p.name, role: p.role })),
        organizers: ev.organizers.map(o => o.handle),
        venue: venue.venueUsername ? { handle: venue.venueUsername } : venue.venueName ? { name: venue.venueName, address: venue.venueAddress } : null,
        cover: !!cover,
        warnings,
      }
    }),
})
