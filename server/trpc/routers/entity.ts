import { z } from 'zod'
import { eq, and, sql, inArray } from 'drizzle-orm'
import { router, publicProcedure } from '../trpc'
import { profiles, bookableSpaces, networkLinks } from '../../database/schema'

/**
 * Professional profiles (venue / artist / organizer) resolved by handle for the
 * unified /@<handle> route. Returns the profile + its bookable spaces (venues).
 * Dancers are resolved separately (profile.getByUsername); the /@handle page
 * tries this first, then the dancer.
 */
export const entityRouter = router({
  // All bookable venues (any city) — surfaced on the Private-events page.
  listVenues: publicProcedure
    .query(async ({ ctx }) => {
      return ctx.db
        .select({
          username: profiles.username,
          name: profiles.name,
          photo: profiles.photo,
          city: profiles.city,
          floorType: profiles.floorType,
        })
        .from(profiles)
        .where(and(eq(profiles.type, 'venue'), eq(profiles.status, 'visible')))
    }),

  // All artists (any city) — the /artists directory, from migrated real data.
  listArtists: publicProcedure
    .query(async ({ ctx }) => {
      return ctx.db
        .select({
          username: profiles.username,
          name: profiles.name,
          photo: profiles.photo,
          city: profiles.city,
          styles: profiles.styles,
          languages: profiles.languages,
          bio: profiles.bio,
        })
        .from(profiles)
        .where(and(eq(profiles.type, 'artist'), eq(profiles.status, 'visible')))
    }),

  // Distinct cities that have any migrated profile — the /cities directory.
  // Counts per type let the card show "N venues · N artists".
  listCities: publicProcedure
    .query(async ({ ctx }) => {
      const rows = await ctx.db
        .select({
          city: profiles.city,
          citySlug: profiles.citySlug,
          type: profiles.type,
        })
        .from(profiles)
        .where(and(eq(profiles.status, 'visible')))
      const map = new Map<string, { city: string; citySlug: string; venues: number; artists: number; organizers: number; total: number }>()
      for (const r of rows) {
        if (!r.citySlug || !r.city) continue
        const e = map.get(r.citySlug) ?? { city: r.city, citySlug: r.citySlug, venues: 0, artists: 0, organizers: 0, total: 0 }
        if (r.type === 'venue') e.venues++
        else if (r.type === 'artist') e.artists++
        else if (r.type === 'organizer') e.organizers++
        e.total++
        map.set(r.citySlug, e)
      }
      return [...map.values()].sort((a, b) => b.total - a.total)
    }),

  // Everything in one city — the real community directory for /cities/[slug].
  // Returns venues/artists/organizers so the city page renders from real data.
  cityDirectory: publicProcedure
    .input(z.object({ citySlug: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          username: profiles.username,
          name: profiles.name,
          photo: profiles.photo,
          type: profiles.type,
          styles: profiles.styles,
          city: profiles.city,
        })
        .from(profiles)
        .where(and(eq(profiles.citySlug, input.citySlug), eq(profiles.status, 'visible')))
      const city = rows.find(r => r.city)?.city ?? null
      const pick = (t: string) => rows.filter(r => r.type === t).map(({ username, name, photo, styles }) => ({ username, name, photo, styles: styles ?? [] }))
      return { city, citySlug: input.citySlug, venues: pick('venue'), artists: pick('artist'), organizers: pick('organizer'), promoters: pick('promoter') }
    }),

  // Bookable venues in a city — surfaced on the city page.
  listByCity: publicProcedure
    .input(z.object({ citySlug: z.string().min(1), type: z.enum(['venue', 'artist', 'organizer', 'promoter']).default('venue') }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db
        .select({
          username: profiles.username,
          name: profiles.name,
          photo: profiles.photo,
          floorType: profiles.floorType,
        })
        .from(profiles)
        .where(and(
          eq(profiles.citySlug, input.citySlug),
          eq(profiles.type, input.type),
          eq(profiles.status, 'visible'),
        ))
      return rows
    }),

  // Where an old handle lives now: a copy merged into another profile
  // (source_ref.mergedInto), or a handle that was renamed (source_ref.oldHandles).
  // Null when it never existed.
  movedTo: publicProcedure
    .input(z.object({ handle: z.string().min(1).max(200) }))
    .query(async ({ ctx, input }) => {
      let h = input.handle
      for (let i = 0; i < 5; i++) {
        const [now] = await ctx.db.select({ username: profiles.username }).from(profiles)
          .where(and(eq(profiles.username, h), eq(profiles.status, 'visible')))
        if (now) return i ? { handle: now.username } : null
        const [renamed] = await ctx.db.select({ username: profiles.username }).from(profiles)
          .where(sql`${profiles.sourceRef}->'oldHandles' ? ${h}`).limit(1)
        if (renamed) { h = renamed.username; continue }
        const [merged] = await ctx.db.select({ into: sql<string | null>`${profiles.sourceRef}->>'mergedInto'` }).from(profiles)
          .where(eq(profiles.username, h)).limit(1)
        if (merged?.into) { h = merged.into; continue }
        return null
      }
      return null
    }),

  getByHandle: publicProcedure
    .input(z.object({ handle: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const [p] = await ctx.db
        .select({
          id: profiles.id,
          username: profiles.username,
          type: profiles.type,
          name: profiles.name,
          city: profiles.city,
          citySlug: profiles.citySlug,
          photo: profiles.photo,
          photos: profiles.photos,
          bio: profiles.bio,
          styles: profiles.styles,
          languages: profiles.languages,
          address: profiles.address,
          floorType: profiles.floorType,
          venueType: profiles.venueType,
          mapUrl: profiles.mapUrl,
          // Venue details (0036). Not `contact`: booking contacts are never public.
          amenities: profiles.amenities,
          capacity: profiles.capacity,
          openingHours: profiles.openingHours,
          floorPlan: profiles.floorPlan,
          guidelines: profiles.guidelines,
          bookingModel: profiles.bookingModel,
          moderatorName: profiles.moderatorName,
          moderatorHandle: profiles.moderatorHandle,
          moderatorSince: profiles.moderatorSince,
          socials: profiles.socials,
          claimed: profiles.claimed,
        })
        .from(profiles)
        .where(and(eq(profiles.username, input.handle), eq(profiles.status, 'visible')))

      if (!p) return null

      const spacesRaw = await ctx.db
        .select({
          id: bookableSpaces.id,
          name: bookableSpaces.name,
          capacity: bookableSpaces.capacity,
          floorType: bookableSpaces.floorType,
          priceInfo: bookableSpaces.priceInfo,
          description: bookableSpaces.description,
          imageUrl: bookableSpaces.imageUrl,
          sortOrder: bookableSpaces.sortOrder,
        })
        .from(bookableSpaces)
        .where(eq(bookableSpaces.profileId, p.id))

      const spaces = [...spacesRaw].sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))

      return {
        profile: {
          id: p.id,
          username: p.username,
          type: p.type,
          name: p.name,
          city: p.city ?? null,
          citySlug: p.citySlug ?? null,
          photo: p.photo ?? null,
          photos: (p.photos ?? []) as { url: string }[],
          bio: p.bio ?? null,
          styles: p.styles ?? [],
          languages: p.languages ?? [],
          address: p.address ?? null,
          floorType: p.floorType ?? null,
          venueType: p.venueType ?? null,
          mapUrl: p.mapUrl ?? null,
          amenities: (p.amenities ?? []) as string[],
          capacity: (p.capacity ?? null) as number | null,
          openingHours: (p.openingHours ?? []) as { day: string; hours: string }[],
          floorPlan: (p.floorPlan ?? null) as string | null,
          guidelines: p.guidelines ?? null,
          bookingModel: p.bookingModel ?? 'commercial',
          moderatorName: p.moderatorName ?? null,
          moderatorHandle: p.moderatorHandle ?? null,
          moderatorSince: p.moderatorSince ?? null,
          socials: p.socials ?? [],
          claimed: p.claimed ?? false,
        },
        spaces,
      }
    }),

  /**
   * Promoter roster — artist profiles the promoter has added to their network.
   * Public: anyone viewing /@promoterHandle sees the roster.
   */
  promoterRoster: publicProcedure
    .input(z.object({ profileId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const artists = await ctx.db
        .select({
          username: profiles.username,
          name: profiles.name,
          photo: profiles.photo,
          styles: profiles.styles,
          bio: profiles.bio,
          type: profiles.type,
        })
        .from(networkLinks)
        .innerJoin(profiles, eq(profiles.id, networkLinks.otherProfileId))
        .where(and(
          eq(networkLinks.profileId, input.profileId),
          eq(networkLinks.status, 'added'),
          eq(profiles.type, 'artist'),
          eq(profiles.status, 'visible'),
        ))
      return artists
    }),
})
