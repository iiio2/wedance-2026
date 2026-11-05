import { z } from 'zod'
import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, protectedProcedure } from '../trpc'
import { events, profiles, profileMembers } from '../../database/schema'
import { cityInfo, profilesIManage } from './businessEvents'
import { rehostImage } from '../../utils/rehostImage'
import { mergeSocials, type Social } from '../../../shared/utils/socials'
import type { GrantCtx } from '../../utils/profileAccess'

/**
 * Completing a page nobody runs yet (#454): the venue an assistant added with
 * add_venue but without its address, the artist added from Instagram with no
 * bio. Unclaimed pages are community data, so they need no grant: the person
 * who added the page, or the organiser of an event it's on, may fill it in
 * until someone claims it. Claimed pages are their owners' (business.update).
 */

type Ctx = { db: any; dancerId: string; isAdmin?: boolean } & GrantCtx

const social = z.object({
  platform: z.string().trim().min(1).max(40).transform(s => s.toLowerCase()),
  url: z.string().trim().max(300).describe('Empty removes that platform.'),
})

export const listedProfileFields = {
  name: z.string().trim().min(1).max(120),
  bio: z.string().max(4000),
  city: z.string().trim().max(120),
  address: z.string().trim().max(300),
  styles: z.array(z.string().trim().min(1).max(40)).max(20),
  socials: z.array(social).max(10),
  photo: z.string().url().nullable(),
}

/** Is this an event the caller runs (through a page the app may act for)? SQL over `events`. */
async function onMyEvents(ctx: Ctx, username: string) {
  const mine = await profilesIManage(ctx)
  if (!mine.length) return false
  const ids = mine.map((p: any) => p.id)
  const handles = mine.map((p: any) => p.username)
  const one = JSON.stringify([username])
  const [ev] = await ctx.db.select({ id: events.id }).from(events).where(and(
    // Mine: I host it, or (a synced event, no host) its organiser or venue is my page.
    or(
      inArray(events.hostProfileId, ids),
      and(sql`${events.hostProfileId} is null`, or(inArray(events.organizerUsername, handles), inArray(events.venueUsername, handles))),
    ),
    // …and this page is on it: venue, organiser, line-up or a programme item.
    or(
      eq(events.venueUsername, username),
      eq(events.organizerUsername, username),
      sql`coalesce(${events.artists}, '[]'::jsonb) @> ${one}::jsonb`,
      sql`exists (select 1 from jsonb_array_elements(coalesce(${events.festival}->'sessions', '[]'::jsonb)) s
        where s->>'artist' = ${username} or coalesce(s->'with', '[]'::jsonb) @> ${one}::jsonb)`,
    ),
  )).limit(1)
  return !!ev
}

/** The unclaimed page the caller may complete, or a clear refusal. Exported for tests. */
export async function requireListedEditor(ctx: Ctx, username: string) {
  const [p] = await ctx.db.select().from(profiles).where(eq(profiles.username, username))
  if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found.' })
  const team = await ctx.db.select({ dancerId: profileMembers.dancerId }).from(profileMembers).where(eq(profileMembers.profileId, p.id))
  if (team.length || p.claimed) {
    const mine = team.some((m: any) => m.dancerId === ctx.dancerId)
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: mine
        ? `You run @${p.username}: edit it as its owner (update_business_profile, or /business/network/${p.username} on WeDance).`
        : `@${p.username} is claimed: the owner edits this page. You can suggest changes from your event's line-up.`,
    })
  }
  if (ctx.isAdmin) return p
  const addedBy = (p.sourceRef as { addedBy?: string } | null)?.addedBy
  if (addedBy && addedBy === ctx.dancerId) return p
  if (await onMyEvents(ctx, p.username)) return p
  throw new TRPCError({
    code: 'FORBIDDEN',
    message: `You can complete @${p.username} only if you added it, or it's the venue, organiser or an artist of one of your events. Add it to your event first, or ask whoever runs it to claim it.`,
  })
}

export const listedProfilesRouter = router({
  update: protectedProcedure
    .input(z.object(listedProfileFields).partial().extend({ username: z.string().min(1).transform(h => h.replace(/^@/, '')) }))
    .mutation(async ({ ctx, input }) => {
      const p = await requireListedEditor(ctx, input.username)
      const { username: _u, city, socials, photo, address, ...plain } = input
      const set: Record<string, unknown> = { ...plain }
      // Same city resolution as addVenue: canonical name + slug from `cities`.
      if (city !== undefined) {
        const loc = await cityInfo(ctx.db, city || null)
        set.city = loc.city
        set.citySlug = loc.citySlug
      }
      if (address !== undefined) set.address = address || null
      // Per platform: a given link replaces that platform's, an empty one removes it, the rest stay.
      if (socials) set.socials = mergeSocials(p.socials as Social[] | null, socials)
      if (photo !== undefined) set.photo = photo ? await rehostImage(photo, 'profiles') : null
      if (!Object.keys(set).length) return { saved: false, username: p.username, changed: [] as string[] }
      await ctx.db.update(profiles).set(set).where(eq(profiles.id, p.id))
      // Hosted events copy the venue's name and address (as business.update does).
      if (p.type === 'venue' && (plain.name !== undefined || address !== undefined)) {
        await ctx.db.update(events)
          .set({ venueName: plain.name ?? p.name, venueAddress: (address ?? p.address) || null, updatedAt: new Date() })
          .where(and(eq(events.venueUsername, p.username), sql`${events.hostProfileId} IS NOT NULL`))
      }
      const [after] = await ctx.db.select({
        username: profiles.username, name: profiles.name, type: profiles.type, bio: profiles.bio, city: profiles.city,
        address: profiles.address, styles: profiles.styles, socials: profiles.socials, photo: profiles.photo,
      }).from(profiles).where(eq(profiles.id, p.id))
      return { saved: true, changed: Object.keys(set).filter(k => k !== 'citySlug'), profile: after }
    }),
})
