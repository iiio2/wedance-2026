import { z } from 'zod'
import { eq, and, inArray, isNotNull, desc } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { eventPosts, eventFlyers, profiles, profileInvites, events } from '../../database/schema'
import { writeCaption } from '../../utils/flyer/caption'
import { LANGUAGES } from '../../../shared/utils/caption'
import { requireEventManager } from './businessEvents'
import { announcementPost, flyerSource, texts } from '../../utils/flyer/paint'
import { flyerChanges } from '../../../shared/utils/flyer'
import { POST_KINDS, proposePlan, type PostKind } from '../../../shared/utils/posts'
import { eventLocalDate } from '../../../shared/utils/eventTime'
import { eventGroup, trackServer } from '../../utils/posthog'

/**
 * Business mode — an event's content plan (event_posts): the posts it's
 * promoted with, each made with the flyer pipeline in the event's look
 * (/business/events/<id>/flyer?post=<post>). Proposing a plan only lists the
 * posts; nothing paints until the organizer clicks.
 *
 * An artist post waits for the artist's OK on their confirmation link
 * (profile_invites.posts_ok_at) before it counts as ready.
 */
const KINDS = Object.keys(POST_KINDS) as [PostKind, ...PostKind[]]
const language = z.enum(LANGUAGES.map(l => l.value) as [string, ...string[]]).default('en+de')
type Caption = { language: string; text: string; lines: string[]; writtenAt: string }
// The announcement's caption is the event's (the Details tab shows it too).
const captionOf = (p: any, ev: any): Caption | null => (p.kind === 'announcement' ? ev.caption : p.caption) ?? null
async function saveCaptionFor(db: any, p: any, ev: any, caption: Caption) {
  if (p.kind === 'announcement') await db.update(events).set({ caption, updatedAt: new Date() }).where(eq(events.id, ev.id))
  await db.update(eventPosts).set({ caption, updatedAt: new Date() }).where(eq(eventPosts.id, p.id))
}
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const FESTIVAL_TYPES = ['Festival', 'Weekender', 'Congress']

async function postForManager(ctx: any, id: string) {
  const [p] = await ctx.db.select().from(eventPosts).where(eq(eventPosts.id, id))
  if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Post not found.' })
  const ev = await requireEventManager(ctx, p.eventId)
  return { p, ev }
}

export const businessPostsRouter = router({
  // The plan: every post with its flyer (kept version, or one painting), whether
  // it's out of date, and — artist posts — whether the artist said OK.
  list: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      await announcementPost(ctx.db, ev.id)
      const posts = await ctx.db.select().from(eventPosts).where(eq(eventPosts.eventId, ev.id))
      const ids = posts.map((p: any) => p.id)
      const flyers = ids.length
        ? await ctx.db.select({ id: eventFlyers.id, postId: eventFlyers.postId, url: eventFlyers.url, status: eventFlyers.status, keptAt: eventFlyers.keptAt, lines: eventFlyers.lines, pictured: eventFlyers.pictured, batchId: eventFlyers.batchId, createdAt: eventFlyers.createdAt })
          .from(eventFlyers).where(inArray(eventFlyers.postId, ids)).orderBy(desc(eventFlyers.createdAt))
        : []
      const subjects = posts.map((p: any) => p.subject).filter(Boolean)
      const people = subjects.length ? await ctx.db.select({ id: profiles.id, username: profiles.username, name: profiles.name, photo: profiles.photo }).from(profiles).where(inArray(profiles.username, subjects)) : []
      const ok = people.length
        ? await ctx.db.select({ profileId: profileInvites.profileId }).from(profileInvites)
          .where(and(eq(profileInvites.eventId, ev.id), isNotNull(profileInvites.postsOkAt), inArray(profileInvites.profileId, people.map((x: any) => x.id))))
        : []
      const okIds = new Set(ok.map((r: any) => r.profileId))
      const out = []
      for (const p of posts) {
        const mine = flyers.filter((f: any) => f.postId === p.id)
        const kept = mine.find((f: any) => f.keptAt) ?? null
        const painting = mine.find((f: any) => f.status === 'painting' || f.status === 'checking') ?? null
        const src = await flyerSource(ctx.db, ev, p)
        const stale = kept ? flyerChanges({ lines: texts(kept.lines), pictured: kept.pictured }, { lines: texts(src.lines), pictured: src.pictured }).length > 0 : false
        const cap = captionOf(p, ev)
        const now = texts(src.lines)
        const who = p.subject ? people.find((x: any) => x.username === p.subject) : null
        out.push({
          id: p.id, kind: p.kind as PostKind, label: POST_KINDS[p.kind as PostKind]?.label ?? p.kind,
          subject: p.subject, subjectName: who ? (ev.flyerOptions?.names?.[who.username] || who.name) : null, subjectPhoto: who?.photo ?? null,
          dueOn: p.dueOn as string | null, format: p.format as 'post' | 'story', status: p.status as 'planned' | 'posted' | 'dropped',
          flyer: kept ? { url: kept.url, stale } : null,
          painting: painting ? { batchId: painting.batchId } : null,
          versions: mine.length,
          caption: cap ? { text: cap.text, language: cap.language, changed: now.some(l => !cap.lines.includes(l)) || cap.lines.some(l => !now.includes(l)) } : null,
          // An artist post needs the artist's OK on their link.
          waitingFor: p.kind === 'artist' && who && !okIds.has(who.id) ? (ev.flyerOptions?.names?.[who.username] || who.name) : null,
          inLineup: p.kind !== 'artist' || (ev.artists ?? []).includes(p.subject),
        })
      }
      out.sort((a: any, b: any) => (a.status === 'dropped' ? 1 : 0) - (b.status === 'dropped' ? 1 : 0) || String(a.dueOn ?? '9').localeCompare(String(b.dueOn ?? '9')))
      return out
    }),

  // A post's Instagram caption: Gemini writes the hook, call to action and
  // hashtags for what the post is for; the details are fixed lines.
  writeCaption: protectedProcedure
    .input(z.object({ id: z.string().uuid(), language }))
    .mutation(async ({ ctx, input }) => {
      const { p, ev } = await postForManager(ctx, input.id)
      try {
        const caption = await writeCaption(ctx.db, ev, p, input.language)
        await saveCaptionFor(ctx.db, p, ev, caption)
        trackServer(ctx, 'caption_written', { event_id: ev.id, language: input.language, scope: 'post', post_kind: p.kind, count: 1, ...eventGroup(ev) })
        return caption
      } catch (e: any) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: e?.message || 'Couldn’t write the caption. Try again.' })
      }
    }),

  // The organizer's own edit of a caption.
  saveCaption: protectedProcedure
    .input(z.object({ id: z.string().uuid(), text: z.string().max(5000) }))
    .mutation(async ({ ctx, input }) => {
      const { p, ev } = await postForManager(ctx, input.id)
      const cap = captionOf(p, ev)
      if (!cap) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Write the caption first.' })
      await saveCaptionFor(ctx.db, p, ev, { ...cap, text: input.text })
      return { saved: true }
    }),

  // Captions for every post that has none yet (the plan's "Write the captions").
  writeCaptions: protectedProcedure
    .input(z.object({ eventId: z.string().uuid(), language }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      const posts = await ctx.db.select().from(eventPosts).where(eq(eventPosts.eventId, ev.id))
      let written = 0
      let failed = 0
      for (const p of posts.filter((x: any) => x.status !== 'dropped' && !captionOf(x, ev)).slice(0, 30)) {
        try {
          await saveCaptionFor(ctx.db, p, ev, await writeCaption(ctx.db, ev, p, input.language))
          written++
        } catch { failed++ }
      }
      if (written || failed) trackServer(ctx, 'caption_written', { event_id: ev.id, language: input.language, scope: 'plan', count: written, failed, ...eventGroup(ev) })
      return { written, failed }
    }),

  // WeDance's plan for this event: adds the posts it doesn't have yet.
  propose: protectedProcedure
    .input(z.object({ eventId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      const tz = ev.timezone || 'Europe/Berlin'
      if (!ev.startDate) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Set the date first.' })
      const today = eventLocalDate(new Date(), tz)
      const plan = proposePlan({
        startDay: eventLocalDate(ev.startDate, tz),
        endDay: ev.endDate ? eventLocalDate(ev.endDate, tz) : null,
        festival: FESTIVAL_TYPES.includes(ev.type ?? ''),
        artists: ev.artists ?? [],
        hasPasses: !!ev.festival?.passes?.length,
        hasProgramme: !!ev.festival?.sessions?.length || !!ev.agenda?.length,
      }, today)
      const have = await ctx.db.select({ id: eventPosts.id, kind: eventPosts.kind, subject: eventPosts.subject, dueOn: eventPosts.dueOn }).from(eventPosts).where(eq(eventPosts.eventId, ev.id))
      let added = 0
      for (const [i, p] of plan.entries()) {
        const same = have.find((h: any) => h.kind === p.kind && (h.subject ?? null) === (p.subject ?? null))
        if (same) {
          // The announcement made before the plan gets its date.
          if (!same.dueOn) await ctx.db.update(eventPosts).set({ dueOn: p.dueOn, sort: i }).where(eq(eventPosts.id, same.id))
          continue
        }
        await ctx.db.insert(eventPosts).values({ eventId: ev.id, kind: p.kind, subject: p.subject ?? null, dueOn: p.dueOn, format: p.format, sort: i, createdBy: ctx.dancerId })
        added++
      }
      trackServer(ctx, 'post_proposed', { event_id: ev.id, added, total: plan.length, is_festival: FESTIVAL_TYPES.includes(ev.type ?? ''), ...eventGroup(ev) })
      return { added, total: plan.length }
    }),

  add: protectedProcedure
    .input(z.object({ eventId: z.string().uuid(), kind: z.enum(KINDS), subject: z.string().max(200).nullable().optional(), dueOn: ymd.nullable().optional(), format: z.enum(['post', 'story']).default('post') }))
    .mutation(async ({ ctx, input }) => {
      const ev = await requireEventManager(ctx, input.eventId)
      if (input.kind === 'artist' && !(ev.artists ?? []).includes(input.subject ?? '')) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pick an artist from the line-up.' })
      const [p] = await ctx.db.insert(eventPosts).values({ eventId: ev.id, kind: input.kind, subject: input.kind === 'artist' ? input.subject : null, dueOn: input.dueOn ?? null, format: input.format, createdBy: ctx.dancerId }).returning({ id: eventPosts.id })
      return { id: p!.id }
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string().uuid(), dueOn: ymd.nullable().optional(), format: z.enum(['post', 'story']).optional(), status: z.enum(['planned', 'posted', 'dropped']).optional() }))
    .mutation(async ({ ctx, input }) => {
      const { p } = await postForManager(ctx, input.id)
      if (input.status === 'dropped' && p.kind === 'announcement') throw new TRPCError({ code: 'BAD_REQUEST', message: 'The event’s flyer stays in the plan.' })
      const { id, ...set } = input
      await ctx.db.update(eventPosts).set({ ...set, updatedAt: new Date() }).where(eq(eventPosts.id, id))
      return { saved: true }
    }),

  // Delete a post and its flyer versions (not the event's flyer).
  remove: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { p } = await postForManager(ctx, input.id)
      if (p.kind === 'announcement') throw new TRPCError({ code: 'BAD_REQUEST', message: 'The event’s flyer stays in the plan.' })
      await ctx.db.delete(eventPosts).where(eq(eventPosts.id, p.id))
      return { removed: true }
    }),
})
