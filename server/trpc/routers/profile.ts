import { z } from 'zod'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import { dancers, cityVideos, profiles, profileMembers } from '../../database/schema'
import { canBePersonPage, pageHandleFor } from '../../utils/personPage'
import { DANCE_LEVELS, sanitizeDanceLevels } from '../../../shared/utils/styleLevelMix'

/**
 * Public dancer profiles + self-service editing.
 *
 * - getByUsername: the public /u/<username> page. Returns identity + bio +
 *   social links + the dancer's approved competition videos (their activity).
 *   Honors the privacy flag: a private profile 404s for everyone but its owner.
 *   Never returns email / auth fields.
 * - update: the signed-in dancer edits their own profile. Protected to the
 *   caller's own row — there is no way to edit someone else's.
 */

// A social value may be a full URL or a bare handle; the page normalizes it for
// display. We store it as entered but cap length and allow empty to clear.
const socialField = z.union([z.string().max(200), z.literal('')]).optional()

export const profileRouter = router({
  // A dancer's handle now, for an old one (renamed to a readable handle).
  movedTo: publicProcedure
    .input(z.object({ username: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      const [d] = await ctx.db.select({ username: dancers.username }).from(dancers)
        .where(sql`${dancers.oldUsernames} ? ${input.username}`).limit(1)
      return d?.username ? { username: d.username } : null
    }),

  getByUsername: publicProcedure
    .input(z.object({ username: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const [d] = await ctx.db
        .select({
          id: dancers.id,
          username: dancers.username,
          name: dancers.name,
          photo: dancers.photo,
          city: dancers.city,
          danceStyles: dancers.danceStyles,
          role: dancers.role,
          bio: dancers.bio,
          instagram: dancers.instagram,
          youtube: dancers.youtube,
          website: dancers.website,
          profilePublic: dancers.profilePublic,
          pageProfileId: dancers.pageProfileId,
        })
        .from(dancers)
        .where(eq(dancers.username, input.username))

      if (!d) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found.' })
      }

      // Privacy: a private profile is invisible to everyone but its owner.
      const isOwner = !!ctx.dancerId && ctx.dancerId === d.id
      if (d.profilePublic === false && !isOwner) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found.' })
      }

      // Activity: the dancer's approved competition videos (submitted while
      // signed in carry dancerId). Anonymous email-only submissions aren't shown.
      const videos = await ctx.db
        .select({
          id: cityVideos.id,
          title: cityVideos.title,
          videoUrl: cityVideos.videoUrl,
          thumbnailUrl: cityVideos.thumbnailUrl,
          danceStyle: cityVideos.danceStyle,
          citySlug: cityVideos.citySlug,
          eloScore: cityVideos.eloScore,
        })
        .from(cityVideos)
        .where(and(eq(cityVideos.dancerId, d.id), eq(cityVideos.status, 'approved')))

      return {
        username: d.username,
        name: d.name,
        photo: d.photo ?? null,
        city: d.city ?? null,
        danceStyles: d.danceStyles ?? [],
        role: d.role ?? null,
        bio: d.bio ?? null,
        instagram: d.instagram ?? null,
        youtube: d.youtube ?? null,
        website: d.website ?? null,
        isPublic: d.profilePublic ?? true,
        isOwner,
        videos,
        // Their page, when they've marked one as "this is me" (#474): /u/ forwards there.
        pageHandle: await pageHandleFor(ctx.db, d.pageProfileId),
      }
    }),

  // "This is me" (#474): the pages the caller owns that can be their public
  // identity, and the one they've picked.
  myPage: protectedProcedure
    .query(async ({ ctx }) => {
      const [me] = await ctx.db
        .select({ pageProfileId: dancers.pageProfileId })
        .from(dancers)
        .where(eq(dancers.id, ctx.dancerId))
      const owned = await ctx.db
        .select({ profileId: profileMembers.profileId })
        .from(profileMembers)
        .where(and(eq(profileMembers.dancerId, ctx.dancerId), eq(profileMembers.role, 'owner')))
      const ids = owned.map(m => m.profileId)
      const pages = ids.length
        ? await ctx.db
            .select({ id: profiles.id, username: profiles.username, name: profiles.name, type: profiles.type, photo: profiles.photo })
            .from(profiles)
            .where(and(inArray(profiles.id, ids), eq(profiles.status, 'visible')))
        : []
      // Artist pages first: those are usually the person; organiser pages may be a brand.
      const options = pages.filter(p => canBePersonPage(p.type))
        .sort((a, b) => Number(b.type === 'artist') - Number(a.type === 'artist') || a.name.localeCompare(b.name))
      const current = options.find(p => p.id === me?.pageProfileId) ?? null
      return {
        current: current ? current.username : null,
        options: options.map(p => ({ username: p.username, name: p.name, type: p.type, photo: p.photo ?? null })),
      }
    }),

  // Pick (or clear, with null) the page that is the caller. Only an owner of an
  // artist / organiser page, and a page can be only one person.
  setPage: protectedProcedure
    .input(z.object({ username: z.string().min(1).max(200).nullable() }))
    .mutation(async ({ ctx, input }) => {
      if (input.username === null) {
        await ctx.db.update(dancers).set({ pageProfileId: null }).where(eq(dancers.id, ctx.dancerId))
        return { page: null }
      }
      const [p] = await ctx.db
        .select({ id: profiles.id, username: profiles.username, type: profiles.type, status: profiles.status })
        .from(profiles)
        .where(eq(profiles.username, input.username))
      if (!p || p.status !== 'visible') throw new TRPCError({ code: 'NOT_FOUND', message: 'Page not found.' })
      if (!canBePersonPage(p.type)) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A venue is a place, not a person — pick your artist or organiser page.' })
      }
      const [m] = await ctx.db
        .select({ role: profileMembers.role })
        .from(profileMembers)
        .where(and(eq(profileMembers.profileId, p.id), eq(profileMembers.dancerId, ctx.dancerId)))
      if (m?.role !== 'owner') throw new TRPCError({ code: 'FORBIDDEN', message: 'Only an owner of this page can make it their own.' })
      const [taken] = await ctx.db
        .select({ id: dancers.id })
        .from(dancers)
        .where(eq(dancers.pageProfileId, p.id))
      if (taken && taken.id !== ctx.dancerId) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Another team member already uses this page as theirs.' })
      }
      await ctx.db.update(dancers).set({ pageProfileId: p.id }).where(eq(dancers.id, ctx.dancerId))
      return { page: p.username }
    }),

  update: protectedProcedure
    .input(z.object({
      name: z.string().min(1, 'Name is required.').optional(),
      city: z.string().optional(),
      danceStyles: z.array(z.string()).optional(),
      // Level per style; keys not in the dancer's styles are dropped on save.
      danceLevels: z.record(z.string().max(60), z.enum(DANCE_LEVELS)).optional(),
      role: z.enum(['lead', 'follow', 'both']).optional(),
      // A URL, or an empty string to clear the photo.
      photo: z.union([z.string().url('Enter a valid image URL.'), z.literal('')]).optional(),
      bio: z.union([z.string().max(500), z.literal('')]).optional(),
      instagram: socialField,
      youtube: socialField,
      website: socialField,
      profilePublic: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const set: Record<string, unknown> = {}
      if (input.name !== undefined) set.name = input.name
      if (input.city !== undefined) set.city = input.city
      if (input.danceStyles !== undefined) set.danceStyles = input.danceStyles
      if (input.danceLevels !== undefined) {
        let styles = input.danceStyles
        if (styles === undefined) {
          const [me] = await ctx.db
            .select({ danceStyles: dancers.danceStyles })
            .from(dancers)
            .where(eq(dancers.id, ctx.dancerId))
          styles = me?.danceStyles ?? []
        }
        set.danceLevels = sanitizeDanceLevels(input.danceLevels, styles)
      }
      if (input.role !== undefined) set.role = input.role
      if (input.photo !== undefined) set.photo = input.photo === '' ? null : input.photo
      if (input.bio !== undefined) set.bio = input.bio === '' ? null : input.bio
      if (input.instagram !== undefined) set.instagram = input.instagram === '' ? null : input.instagram
      if (input.youtube !== undefined) set.youtube = input.youtube === '' ? null : input.youtube
      if (input.website !== undefined) set.website = input.website === '' ? null : input.website
      if (input.profilePublic !== undefined) set.profilePublic = input.profilePublic

      if (Object.keys(set).length > 0) {
        await ctx.db
          .update(dancers)
          .set(set)
          .where(eq(dancers.id, ctx.dancerId))
      }

      return { ok: true }
    }),
})
