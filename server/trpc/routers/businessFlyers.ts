import { z } from 'zod'
import { eq, and, desc, isNotNull, inArray } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { events, eventFlyers, brandLooks, profiles } from '../../database/schema'
import { requireEventManager } from './businessEvents'
import { flyerSource, flyerStatusFor, runFlyer, texts } from '../../utils/flyer/paint'
import { askAboutImages, fetchImage, writeText, type InlineImage } from '../../utils/flyer/gemini'
import { DIRECTIONS, LOOK_PROMPT } from '../../../shared/utils/flyer'
import { LANGUAGES, captionPrompt, keepVerifiedMentions, instagramOf } from '../../../shared/utils/caption'

// Who the caption may tag: the artists', venue's and host's Instagram on WeDance.
async function captionContext(db: any, ev: any) {
  const src = await flyerSource(db, ev)
  const handles = [...(ev.artists ?? []), ev.venueUsername].filter(Boolean)
  const rows = handles.length ? await db.select({ username: profiles.username, name: profiles.name, socials: profiles.socials }).from(profiles).where(inArray(profiles.username, handles)) : []
  const [host] = await db.select({ name: profiles.name, socials: profiles.socials }).from(profiles).where(eq(profiles.id, ev.hostProfileId))
  const byHandle = new Map<string, any>(rows.map((r: any) => [r.username, r]))
  const venue = ev.venueUsername ? byHandle.get(ev.venueUsername) : null
  const site = (useRuntimeConfig().siteUrl || 'https://2026.wedance.vip').replace(/\/$/, '')
  return {
    lines: texts(src.lines),
    host: { name: host?.name ?? '', instagram: instagramOf(host?.socials) },
    venue: venue ? { name: venue.name, instagram: instagramOf(venue.socials) } : (ev.venueName ? { name: ev.venueName, instagram: null } : null),
    artists: (ev.artists ?? []).map((h: string) => ({ name: byHandle.get(h)?.name ?? h, instagram: instagramOf(byHandle.get(h)?.socials) })),
    description: ev.description,
    eventUrl: `${site}/events/${ev.id}`,
    ticketUrl: ev.ticketUrl,
  }
}

/**
 * Business mode — an event's flyer. The event editor is step one (the details
 * are the words on the flyer); from there: read your look off flyers you made
 * before, or pick from four directions; make it; fix it; keep it. A kept flyer
 * remembers the lines and faces it was painted from, so the editor can say it's
 * out of date and refresh it in the same look.
 *
 * Every procedure checks that the caller manages the event's host profile.
 */

const look = z.object({
  name: z.string().trim().max(60).optional(),
  description: z.string().trim().min(10, 'Describe the look in a sentence or two.').max(2000),
  palette: z.array(z.object({ name: z.string().max(40), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).max(8).optional(),
  inspiration: z.string().url().nullable().optional(),
})

function start(ctx: any, id: string) {
  const job = runFlyer(ctx.db, id)
  // On Vercel this keeps the function alive after the response; elsewhere it just runs.
  if (ctx.waitUntil) ctx.waitUntil(job)
}

async function flyerForManager(ctx: any, id: string) {
  const [f] = await ctx.db.select().from(eventFlyers).where(eq(eventFlyers.id, id))
  if (!f) throw new TRPCError({ code: 'NOT_FOUND', message: 'Flyer not found.' })
  const ev = await requireEventManager(ctx, f.eventId)
  return { f, ev }
}

const shape = (f: any) => ({
  id: f.id, batchId: f.batchId, status: f.status, url: f.url, mode: f.mode, error: f.error,
  lookName: f.look?.name ?? null, check: f.check, notes: f.notes, keptAt: f.keptAt, createdAt: f.createdAt,
})

export const businessFlyersRouter = router({
  // The event's Instagram caption (if written) and whether the details changed since.
  caption: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      const c = await captionContext(ctx.db, ev)
      const saved = ev.caption ?? null
      const changed = saved ? c.lines.some(l => !saved.lines.includes(l)) || saved.lines.some((l: string) => !c.lines.includes(l)) : false
      const tags = [...c.artists, c.venue, c.host].filter((t: any) => t?.instagram).map((t: any) => `@${t.instagram}`)
      return { saved, changed, tags }
    }),

  // Write the caption from the event's lines, in the chosen language(s).
  writeCaption: protectedProcedure
    .input(z.object({ eventId: z.string().uuid(), language: z.enum(LANGUAGES.map(l => l.value) as [string, ...string[]]).default('en+de') }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      const c = await captionContext(ctx.db, ev)
      let text: string
      try {
        text = await writeText(captionPrompt(c, input.language))
      } catch (e: any) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e?.message || 'Couldn’t write the caption. Try again.' })
      }
      text = keepVerifiedMentions(text.replace(/^```\w*\n?|```$/g, '').trim(), [...c.artists.map((a: { instagram: string | null }) => a.instagram), c.venue?.instagram, c.host.instagram])
      if (!text) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'The caption came back empty. Try again.' })
      const caption = { language: input.language, text, lines: c.lines, writtenAt: new Date().toISOString() }
      await ctx.db.update(events).set({ caption, updatedAt: new Date() }).where(eq(events.id, ev.id))
      return caption
    }),

  // Keep the organizer's own edit of the caption.
  saveCaption: protectedProcedure
    .input(z.object({ eventId: z.string().uuid(), text: z.string().max(5000) }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      if (!ev.caption) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Write the caption first.' })
      await ctx.db.update(events).set({ caption: { ...ev.caption, text: input.text } }).where(eq(events.id, ev.id))
      return { saved: true }
    }),

  // Everything the editor's flyer panel and the flyer page need.
  state: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      const st = (await flyerStatusFor(ctx.db, [ev])).get(ev.id)!
      const looks = await ctx.db.select({ id: brandLooks.id, name: brandLooks.name, description: brandLooks.description, palette: brandLooks.palette })
        .from(brandLooks).where(eq(brandLooks.profileId, ev.hostProfileId)).orderBy(desc(brandLooks.updatedAt))
      // A sitting still painting (or just finished) — so a reload picks it up.
      const [latest] = await ctx.db.select({ batchId: eventFlyers.batchId, status: eventFlyers.status, createdAt: eventFlyers.createdAt })
        .from(eventFlyers).where(eq(eventFlyers.eventId, ev.id)).orderBy(desc(eventFlyers.createdAt)).limit(1)
      return {
        lines: texts(st.source.lines),
        pictured: st.source.pictured,
        people: st.source.people,
        kept: st.kept ? { ...shape(st.kept), lookId: st.kept.lookId } : null,
        changes: st.changes,
        looks,
        latestBatch: latest ?? null,
      }
    }),

  // "Add flyers you've made" → the look, in words and colours, to correct before painting.
  readLook: protectedProcedure
    .input(z.object({ eventId: z.string().uuid(), urls: z.array(z.string().url()).min(1).max(5) }))
    .mutation(async ({ ctx, input }) => {
      await requireEventManager(ctx, input.eventId)
      const imgs = (await Promise.all(input.urls.map(fetchImage))).filter(Boolean) as InlineImage[]
      if (!imgs.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Couldn’t open those images. Try uploading them again.' })
      try {
        const r = await askAboutImages<{ name?: string; description?: string; palette?: { name: string; hex: string }[] }>(LOOK_PROMPT, imgs)
        return {
          name: String(r.name ?? 'Main look').slice(0, 60),
          description: String(r.description ?? ''),
          palette: (r.palette ?? []).filter(p => /^#[0-9a-fA-F]{6}$/.test(p?.hex ?? '')).slice(0, 6),
        }
      } catch (e: any) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e?.message || 'Couldn’t read the flyers. Try again.' })
      }
    }),

  // A new flyer in a look (a saved one, or the one just read). Starts a sitting.
  make: protectedProcedure
    .input(z.object({ eventId: z.string().uuid(), lookId: z.string().uuid().nullable().optional(), look: look.optional(), references: z.array(z.string().url()).max(5).optional() }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      let spec = input.look ?? null
      if (input.lookId) {
        const [l] = await ctx.db.select().from(brandLooks).where(and(eq(brandLooks.id, input.lookId), eq(brandLooks.profileId, ev.hostProfileId)))
        if (!l) throw new TRPCError({ code: 'NOT_FOUND', message: 'That look is gone.' })
        spec = { name: l.name, description: l.description, palette: l.palette }
      }
      if (!spec) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pick a look first.' })
      const src = await flyerSource(ctx.db, ev)
      const batchId = crypto.randomUUID()
      const [f] = await ctx.db.insert(eventFlyers).values({
        eventId: ev.id, batchId, lookId: input.lookId ?? null,
        look: { ...spec, references: input.references ?? [] } as any,
        mode: 'paint', lines: src.lines, pictured: src.pictured, createdBy: ctx.dancerId,
      }).returning({ id: eventFlyers.id })
      start(ctx, f!.id)
      return { id: f!.id, batchId }
    }),

  // Starting fresh: four different directions painted for this event.
  directions: protectedProcedure
    .input(z.object({ eventId: z.string().uuid(), feelings: z.array(z.string().max(30)).min(1).max(3), inspiration: z.string().url().nullable().optional() }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      const src = await flyerSource(ctx.db, ev)
      const batchId = crypto.randomUUID()
      const mood = `The mood: ${input.feelings.join(', ').toLowerCase()}.`
      const rows = await ctx.db.insert(eventFlyers).values(DIRECTIONS.map(d => ({
        eventId: ev.id, batchId, mode: 'direction', lines: src.lines, pictured: src.pictured, createdBy: ctx.dancerId,
        look: { name: d.name, description: `${d.description} ${mood}`, inspiration: input.inspiration ?? null } as any,
      }))).returning({ id: eventFlyers.id })
      for (const r of rows) start(ctx, r.id)
      return { batchId, ids: rows.map((r: any) => r.id) }
    }),

  // "Want something different?" — an edit of this flyer; the picture stays.
  fix: protectedProcedure
    .input(z.object({ flyerId: z.string().uuid(), notes: z.string().trim().min(2, 'Say what should be different.').max(500) }))
    .mutation(async ({ ctx, input }) => {
      const { f } = await flyerForManager(ctx, input.flyerId)
      if (f.status !== 'ready') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Wait until this flyer is ready.' })
      const [n] = await ctx.db.insert(eventFlyers).values({
        eventId: f.eventId, batchId: f.batchId, lookId: f.lookId, look: f.look, mode: 'fix', baseFlyerId: f.id,
        lines: f.lines, pictured: f.pictured, notes: input.notes, createdBy: ctx.dancerId,
      }).returning({ id: eventFlyers.id })
      start(ctx, n!.id)
      return { id: n!.id, batchId: f.batchId }
    }),

  // The details changed: new words on the kept flyer (picture stays), or a new
  // painting in the same look when the faces changed. No kept flyer but a saved
  // look (next week's date): a new painting in that look.
  refresh: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      const st = (await flyerStatusFor(ctx.db, [ev])).get(ev.id)!
      const batchId = crypto.randomUUID()
      let values: Record<string, unknown>
      if (st.kept) {
        const sameFaces = JSON.stringify([...st.kept.pictured].sort()) === JSON.stringify([...st.source.pictured].sort())
        values = { lookId: st.kept.lookId, look: st.kept.look, mode: sameFaces ? 'refresh' : 'paint', baseFlyerId: sameFaces ? st.kept.id : null }
      } else {
        const [l] = await ctx.db.select().from(brandLooks).where(eq(brandLooks.profileId, ev.hostProfileId)).orderBy(desc(brandLooks.updatedAt)).limit(1)
        if (!l) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No look yet: make the first flyer.' })
        values = { lookId: l.id, look: { name: l.name, description: l.description, palette: l.palette }, mode: 'paint' }
      }
      const [n] = await ctx.db.insert(eventFlyers).values({
        eventId: ev.id, batchId, lines: st.source.lines, pictured: st.source.pictured, createdBy: ctx.dancerId, ...values,
      } as any).returning({ id: eventFlyers.id })
      start(ctx, n!.id)
      return { id: n!.id, batchId }
    }),

  // The versions of one sitting, for polling while painting.
  batch: protectedProcedure
    .input(z.object({ batchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.select().from(eventFlyers).where(eq(eventFlyers.batchId, input.batchId)).orderBy(eventFlyers.createdAt)
      if (!rows.length) throw new TRPCError({ code: 'NOT_FOUND', message: 'Nothing painted here.' })
      await requireEventManager(ctx, rows[0]!.eventId)
      return rows.map(shape)
    }),

  // "This is the one": the event's flyer from now on. The first time, also
  // save its look under a name so next week starts from it.
  keep: protectedProcedure
    .input(z.object({ flyerId: z.string().uuid(), lookName: z.string().trim().min(1).max(60).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { f, ev } = await flyerForManager(ctx, input.flyerId)
      if (f.status !== 'ready' || !f.url) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This flyer isn’t ready.' })
      let lookId = f.lookId as string | null
      if (!lookId && input.lookName) {
        const spec = f.look as any
        const [l] = await ctx.db.insert(brandLooks).values({
          profileId: ev.hostProfileId, name: input.lookName, description: spec.description, palette: spec.palette ?? [],
          references: (spec.references ?? []).map((url: string) => ({ url })), source: f.mode === 'direction' ? 'directions' : 'flyers', createdBy: ctx.dancerId,
        }).returning({ id: brandLooks.id })
        lookId = l!.id
      }
      await ctx.db.update(eventFlyers).set({ keptAt: null }).where(and(eq(eventFlyers.eventId, ev.id), isNotNull(eventFlyers.keptAt)))
      await ctx.db.update(eventFlyers).set({ keptAt: new Date(), lookId, look: { ...(f.look as any), name: input.lookName ?? (f.look as any).name }, updatedAt: new Date() }).where(eq(eventFlyers.id, f.id))
      // No cover yet → the flyer is the cover.
      if (!ev.cover) await ctx.db.update(events).set({ cover: f.url, updatedAt: new Date() }).where(eq(events.id, ev.id))
      return { kept: true, lookId }
    }),
})
