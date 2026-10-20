import { z } from 'zod'
import { eq, and, desc, isNotNull, inArray, lt } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { events, eventFlyers, eventPosts, brandLooks, profiles } from '../../database/schema'
import { requireEventManager } from './businessEvents'
import { requireMember } from './business'
import { announcementPost, flyerSource, runFlyer, texts } from '../../utils/flyer/paint'
import { flyerChanges } from '../../../shared/utils/flyer'
import { askAboutImages, fetchImage, type InlineImage } from '../../utils/flyer/gemini'
import { withAi } from '../../utils/aiUsage'
import { DIRECTIONS, LOOK_PROMPT } from '../../../shared/utils/flyer'
import { LANGUAGES } from '../../../shared/utils/caption'

import { captionContext, writeCaption } from '../../utils/flyer/caption'
import { eventGroup, trackServer } from '../../utils/posthog'

/**
 * server_flyer_generated — every paint request (each is an AI image call).
 * `mode`: paint (new, in a look) / direction (fresh ideas) / again / recompose
 * (4:5 feed post) / fix / refresh. Keeping one is `server_flyer_kept`.
 */
function trackFlyer(ctx: any, ev: any, mode: string, variantCount: number, extra: Record<string, unknown> = {}) {
  trackServer(ctx, 'flyer_generated', { event_id: ev.id, mode, variant_count: variantCount, ...extra, ...eventGroup(ev) })
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

const STALE_MS = 4 * 60_000

const look = z.object({
  name: z.string().trim().max(60).optional(),
  description: z.string().trim().min(10, 'Describe the look in a sentence or two.').max(2000),
  palette: z.array(z.object({ name: z.string().max(40), hex: z.string().regex(/^#[0-9a-fA-F]{6}$/) })).max(8).optional(),
  inspiration: z.string().url().nullable().optional(),
})

/** The post a flyer action is for: the one asked for, else the event's announcement. */
async function postFor(ctx: any, ev: any, postId?: string | null) {
  const id = postId ?? await announcementPost(ctx.db, ev.id)
  const [p] = await ctx.db.select().from(eventPosts).where(and(eq(eventPosts.id, id), eq(eventPosts.eventId, ev.id)))
  if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'That post isn’t in this event’s plan.' })
  return p as { id: string; kind: any; subject: string | null; format: string; dueOn: string | null }
}
const postId = z.string().uuid().nullable().optional()

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
  width: f.width, height: f.height,
})

export const businessFlyersRouter = router({
  // The event's Instagram caption (if written) and whether the details changed since.
  caption: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      const c = await captionContext(ctx.db, ev)
      const saved = ev.caption ?? null
      const now = c.lines
      const changed = saved ? now.some(l => !saved.lines.includes(l)) || saved.lines.some((l: string) => !now.includes(l)) : false
      const tags = [...c.caption.artists, c.caption.venue, c.caption.host].filter((t: any) => t?.instagram).map((t: any) => `@${t.instagram}`)
      return { saved, changed, tags }
    }),

  // Write the caption from the event's lines, in the chosen language(s).
  writeCaption: protectedProcedure
    .input(z.object({ eventId: z.string().uuid(), language: z.enum(LANGUAGES.map(l => l.value) as [string, ...string[]]).default('en+de') }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      let caption
      try {
        caption = await writeCaption(ctx.db, ev, null, input.language)
      } catch (e: any) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e?.message || 'Couldn’t write the caption. Try again.' })
      }
      await ctx.db.update(events).set({ caption, updatedAt: new Date() }).where(eq(events.id, ev.id))
      trackServer(ctx, 'caption_written', { event_id: ev.id, language: input.language, scope: 'event', count: 1, ...eventGroup(ev) })
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
    .input(z.object({ eventId: z.string().uuid(), postId }))
    .query(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      const post = await postFor(ctx, ev, input.postId)
      // The post's kept version and what changed since it was made.
      const source = await flyerSource(ctx.db, ev, post)
      const [keptRow] = await ctx.db.select().from(eventFlyers).where(and(eq(eventFlyers.postId, post.id), isNotNull(eventFlyers.keptAt))).limit(1)
      const st = {
        source, kept: keptRow ?? null,
        changes: keptRow ? flyerChanges({ lines: texts(keptRow.lines), pictured: keptRow.pictured }, { lines: texts(source.lines), pictured: source.pictured }) : [],
      }
      const all = await ctx.db.select({ id: brandLooks.id, name: brandLooks.name, description: brandLooks.description, palette: brandLooks.palette, source: brandLooks.source })
        .from(brandLooks).where(eq(brandLooks.profileId, ev.hostProfileId)).orderBy(desc(brandLooks.updatedAt))
      // The profile's own styles; ideas (generated, never painted and kept) are offered as directions.
      const looks = all.filter((l: any) => l.source !== 'generated')
      const ideas = all.filter((l: any) => l.source === 'generated')
      // A sitting still painting (or just finished) — so a reload picks it up.
      const [latest] = await ctx.db.select({ batchId: eventFlyers.batchId, status: eventFlyers.status, createdAt: eventFlyers.createdAt })
        .from(eventFlyers).where(eq(eventFlyers.postId, post.id)).orderBy(desc(eventFlyers.createdAt)).limit(1)
      return {
        post: { id: post.id, kind: post.kind, subject: post.subject, format: post.format },
        lines: texts(st.source.lines),
        pictured: st.source.pictured,
        people: st.source.people,
        kept: st.kept ? { ...shape(st.kept), lookId: st.kept.lookId } : null,
        changes: st.changes,
        looks,
        ideas,
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
        const r = await withAi({ eventId: input.eventId, label: 'read style' }, () => askAboutImages<{ name?: string; description?: string; palette?: { name: string; hex: string }[] }>(LOOK_PROMPT, imgs))
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
    .input(z.object({ eventId: z.string().uuid(), postId, lookId: z.string().uuid().nullable().optional(), look: look.optional(), references: z.array(z.string().url()).max(5).optional() }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      const post = await postFor(ctx, ev, input.postId)
      let spec = input.look ?? null
      if (input.lookId) {
        const [l] = await ctx.db.select().from(brandLooks).where(and(eq(brandLooks.id, input.lookId), eq(brandLooks.profileId, ev.hostProfileId)))
        if (!l) throw new TRPCError({ code: 'NOT_FOUND', message: 'That look is gone.' })
        spec = { name: l.name, description: l.description, palette: l.palette }
      }
      if (!spec) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pick a look first.' })
      const src = await flyerSource(ctx.db, ev, post)
      const batchId = crypto.randomUUID()
      const [f] = await ctx.db.insert(eventFlyers).values({
        eventId: ev.id, postId: post.id, batchId, lookId: input.lookId ?? null,
        look: { ...spec, references: input.references ?? [] } as any,
        mode: 'paint', lines: src.lines, pictured: src.pictured, createdBy: ctx.dancerId,
      }).returning({ id: eventFlyers.id })
      start(ctx, f!.id)
      trackFlyer(ctx, ev, 'paint', 1, { saved_look: !!input.lookId, references: input.references?.length ?? 0 })
      return { id: f!.id, batchId }
    }),

  // Starting fresh: four different directions painted for this event.
  directions: protectedProcedure
    .input(z.object({
      eventId: z.string().uuid(), postId, feelings: z.array(z.string().max(30)).min(1).max(3), inspiration: z.string().url().nullable().optional(),
      // Which directions to paint (up to 4): built-in ones by name, the profile's styles and ideas by id. Default: the four built-in.
      picks: z.array(z.union([z.object({ builtIn: z.string().max(60) }), z.object({ lookId: z.string().uuid() })])).min(1).max(4).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      const post = await postFor(ctx, ev, input.postId)
      const src = await flyerSource(ctx.db, ev, post)
      const batchId = crypto.randomUUID()
      const mood = `The mood: ${input.feelings.join(', ').toLowerCase()}.`
      const specs: { lookId: string | null; name: string; description: string; palette?: any[] }[] = []
      for (const p of input.picks ?? DIRECTIONS.map(d => ({ builtIn: d.name! }))) {
        if ('builtIn' in p) {
          const d = DIRECTIONS.find(x => x.name === p.builtIn)
          if (d) specs.push({ lookId: null, name: d.name!, description: d.description })
        } else {
          const [l] = await ctx.db.select().from(brandLooks).where(and(eq(brandLooks.id, p.lookId), eq(brandLooks.profileId, ev.hostProfileId)))
          if (l) specs.push({ lookId: l.id, name: l.name, description: l.description, palette: l.palette })
        }
      }
      if (!specs.length) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pick at least one direction.' })
      const rows = await ctx.db.insert(eventFlyers).values(specs.map(d => ({
        eventId: ev.id, postId: post.id, batchId, mode: 'direction', lookId: d.lookId, lines: src.lines, pictured: src.pictured, createdBy: ctx.dancerId,
        look: { name: d.name, description: `${d.description} ${mood}`, palette: d.palette ?? [], inspiration: input.inspiration ?? null } as any,
      }))).returning({ id: eventFlyers.id })
      for (const r of rows) start(ctx, r.id)
      trackFlyer(ctx, ev, 'direction', rows.length, { feelings: input.feelings.length })
      return { batchId, ids: rows.map((r: any) => r.id) }
    }),

  // "Stop": the organizer has what they need; paintings still running are dropped
  // (never uploaded or read back).
  stop: protectedProcedure
    .input(z.object({ flyerIds: z.array(z.string().uuid()).min(1).max(20) }))
    .mutation(async ({ ctx, input }) => {
      const rows = await ctx.db.select({ id: eventFlyers.id, eventId: eventFlyers.eventId }).from(eventFlyers).where(inArray(eventFlyers.id, input.flyerIds))
      for (const eventId of new Set(rows.map((r: any) => r.eventId as string))) await requireEventManager(ctx, eventId)
      await ctx.db.update(eventFlyers).set({ status: 'stopped', error: 'Stopped.', updatedAt: new Date() })
        .where(and(inArray(eventFlyers.id, input.flyerIds), eq(eventFlyers.status, 'painting')))
      return { stopped: true }
    }),

  // "Paint again": a new painting from the same look and lines, in the same sitting.
  again: protectedProcedure
    .input(z.object({ flyerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { f, ev } = await flyerForManager(ctx, input.flyerId)
      const post = await postFor(ctx, ev, f.postId)
      const src = await flyerSource(ctx.db, ev, post)
      const [n] = await ctx.db.insert(eventFlyers).values({
        eventId: f.eventId, postId: post.id, batchId: f.batchId, lookId: f.lookId, look: f.look,
        // A repainted direction stays a direction; a failed fix or refresh paints fresh.
        mode: f.mode === 'direction' ? 'direction' : 'paint',
        lines: src.lines, pictured: src.pictured, createdBy: ctx.dancerId,
      }).returning({ id: eventFlyers.id })
      start(ctx, n!.id)
      trackFlyer(ctx, ev, 'again', 1)
      return { id: n!.id, batchId: f.batchId }
    }),

  // "Make the 4:5 feed post": recompose this story into it (the picture, people and words stay).
  feed: protectedProcedure
    .input(z.object({ flyerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { f, ev } = await flyerForManager(ctx, input.flyerId)
      if (!f.url || !['ready', 'checking'].includes(f.status)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Wait until this flyer is painted.' })
      const [n] = await ctx.db.insert(eventFlyers).values({
        eventId: f.eventId, postId: f.postId, batchId: f.batchId, lookId: f.lookId, look: f.look, mode: 'recompose', baseFlyerId: f.id,
        lines: f.lines, pictured: f.pictured, createdBy: ctx.dancerId,
      }).returning({ id: eventFlyers.id })
      start(ctx, n!.id)
      trackFlyer(ctx, ev, 'recompose', 1)
      return { id: n!.id, batchId: f.batchId }
    }),

  // "Want something different?" — an edit of this flyer; the picture stays.
  fix: protectedProcedure
    .input(z.object({ flyerId: z.string().uuid(), notes: z.string().trim().min(2, 'Say what should be different.').max(500) }))
    .mutation(async ({ ctx, input }) => {
      const { f, ev } = await flyerForManager(ctx, input.flyerId)
      if (!f.url || !['ready', 'checking'].includes(f.status)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Wait until this flyer is painted.' })
      const [n] = await ctx.db.insert(eventFlyers).values({
        eventId: f.eventId, postId: f.postId, batchId: f.batchId, lookId: f.lookId, look: f.look, mode: 'fix', baseFlyerId: f.id,
        lines: f.lines, pictured: f.pictured, notes: input.notes, createdBy: ctx.dancerId,
      }).returning({ id: eventFlyers.id })
      start(ctx, n!.id)
      trackFlyer(ctx, ev, 'fix', 1)
      return { id: n!.id, batchId: f.batchId }
    }),

  // The details changed: new words on the kept flyer (picture stays), or a new
  // painting in the same look when the faces changed. No kept flyer but a saved
  // look (next week's date): a new painting in that look.
  refresh: protectedProcedure
    .input(z.object({ eventId: z.string().uuid(), postId }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      const post = await postFor(ctx, ev, input.postId)
      const source = await flyerSource(ctx.db, ev, post)
      const [keptRow] = await ctx.db.select().from(eventFlyers).where(and(eq(eventFlyers.postId, post.id), isNotNull(eventFlyers.keptAt))).limit(1)
      const st = { source, kept: keptRow ?? null }
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
        eventId: ev.id, postId: post.id, batchId, lines: st.source.lines, pictured: st.source.pictured, createdBy: ctx.dancerId, ...values,
      } as any).returning({ id: eventFlyers.id })
      start(ctx, n!.id)
      trackFlyer(ctx, ev, String(values.mode) === 'refresh' ? 'refresh' : 'paint', 1, { from_kept: !!st.kept })
      return { id: n!.id, batchId }
    }),

  // The versions of one sitting, for polling while painting.
  batch: protectedProcedure
    .input(z.object({ batchId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // A painting that hasn't finished in 4 minutes has stopped (a restart, a
      // timeout): mark it failed so the page offers a retry instead of waiting.
      await ctx.db.update(eventFlyers).set({ status: 'failed', error: 'Painting stopped before it finished. Paint it again.', updatedAt: new Date() })
        .where(and(eq(eventFlyers.batchId, input.batchId), eq(eventFlyers.status, 'painting'), lt(eventFlyers.createdAt, new Date(Date.now() - STALE_MS))))
      // Painted but never checked: show it unchecked.
      await ctx.db.update(eventFlyers).set({ status: 'ready', updatedAt: new Date() })
        .where(and(eq(eventFlyers.batchId, input.batchId), eq(eventFlyers.status, 'checking'), lt(eventFlyers.createdAt, new Date(Date.now() - STALE_MS))))
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
      if (!f.url || !['ready', 'checking'].includes(f.status)) throw new TRPCError({ code: 'BAD_REQUEST', message: 'This flyer isn’t painted yet.' })
      let lookId = f.lookId as string | null
      // Kept from an idea: it becomes one of the profile's own styles.
      if (lookId) await ctx.db.update(brandLooks).set({ source: 'directions', updatedAt: new Date() }).where(and(eq(brandLooks.id, lookId), eq(brandLooks.source, 'generated')))
      if (!lookId && input.lookName) {
        const spec = f.look as any
        const [l] = await ctx.db.insert(brandLooks).values({
          profileId: ev.hostProfileId, name: input.lookName, description: spec.description, palette: spec.palette ?? [],
          references: (spec.references ?? []).map((url: string) => ({ url })), source: f.mode === 'direction' ? 'directions' : 'flyers', createdBy: ctx.dancerId,
        }).returning({ id: brandLooks.id })
        lookId = l!.id
      }
      // One kept per post.
      const post = await postFor(ctx, ev, f.postId)
      await ctx.db.update(eventFlyers).set({ keptAt: null }).where(and(eq(eventFlyers.postId, post.id), isNotNull(eventFlyers.keptAt)))
      await ctx.db.update(eventFlyers).set({ keptAt: new Date(), lookId, look: { ...(f.look as any), name: input.lookName ?? (f.look as any).name }, updatedAt: new Date() }).where(eq(eventFlyers.id, f.id))
      // No cover yet → the event's flyer is the cover.
      if (!ev.cover && post.kind === 'announcement') await ctx.db.update(events).set({ cover: f.url, updatedAt: new Date() }).where(eq(events.id, ev.id))
      trackServer(ctx, 'flyer_kept', { event_id: ev.id, mode: f.mode, post_kind: post.kind, new_look: !f.lookId && !!input.lookName, ...eventGroup(ev) })
      return { kept: true, lookId }
    }),

  // Copy brand looks from one profile to another. The caller must manage both.
  copyLooks: protectedProcedure
    .input(z.object({ fromUsername: z.string().min(1), toUsername: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      if (input.fromUsername === input.toUsername) return { copied: 0 }
      const from = await requireMember(ctx, input.fromUsername)
      const to = await requireMember(ctx, input.toUsername)
      const looks = await ctx.db.select().from(brandLooks).where(eq(brandLooks.profileId, from.id))
      if (!looks.length) return { copied: 0 }
      // Skip looks the target already has (same name + description).
      const existing = await ctx.db.select({ name: brandLooks.name, description: brandLooks.description })
        .from(brandLooks).where(eq(brandLooks.profileId, to.id))
      const existingSet = new Set(existing.map((l: any) => `${l.name}::${l.description}`))
      const toCopy = looks.filter((l: any) => !existingSet.has(`${l.name}::${l.description}`))
      if (!toCopy.length) return { copied: 0 }
      await ctx.db.insert(brandLooks).values(toCopy.map((l: any) => ({
        profileId: to.id, name: l.name, description: l.description, palette: l.palette,
        references: l.references, source: l.source, createdBy: ctx.dancerId,
      })))
      return { copied: toCopy.length }
    }),
})
