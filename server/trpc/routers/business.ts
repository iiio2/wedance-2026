import { z } from 'zod'
import { eq, and, or, ilike, desc, inArray, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure, adminProcedure } from '../trpc'
import { profiles, profileMembers, profileClaims, dancers, cities } from '../../database/schema'
import { slugify, randomSuffix } from '../../utils/slug'
import { grant, logAccess } from '../../utils/profileAccess'
import { notifyDecision } from './businessTeam'

/**
 * Business mode — artists, venues and organizers managing their own profile.
 *
 * Ownership lives in profile_members. A dancer gets a membership by creating a
 * new profile (they own it at once) or by claiming an existing one (an admin
 * approves the claim). Every edit is checked against profile_members, so there
 * is no way to edit a profile you don't manage. Approving sets
 * profiles.claimed, which also stops the v3 sync from overwriting the profile.
 *
 * "Managed" = has at least one profile_members row. `claimed` alone is NOT
 * "managed": 226 v4 imports carry claimed=true from v4 with no 2026 manager.
 */

const PROFILE_TYPES = ['artist', 'venue', 'organizer'] as const

const editableFields = {
  name: z.string().trim().min(1).max(120),
  bio: z.string().max(4000),
  city: z.string().trim().max(120),
  styles: z.array(z.string().trim().min(1).max(40)).max(20),
  photo: z.string().url().nullable(),
  photos: z.array(z.object({ url: z.string().url() })).max(30),
  socials: z.array(z.object({ platform: z.string().max(40), url: z.string().max(300) })).max(10),
  address: z.string().max(300),
  floorType: z.string().max(60),
  venueType: z.string().max(60),
}

// Membership check shared by get/update. Admins may manage any profile.
export async function requireMember(ctx: { db: any; dancerId: string; isAdmin?: boolean }, username: string) {
  const [p] = await ctx.db.select().from(profiles).where(eq(profiles.username, username))
  if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found.' })
  if (ctx.isAdmin) return p
  const [m] = await ctx.db
    .select({ role: profileMembers.role })
    .from(profileMembers)
    .where(and(eq(profileMembers.profileId, p.id), eq(profileMembers.dancerId, ctx.dancerId)))
  if (!m) throw new TRPCError({ code: 'FORBIDDEN', message: 'You don’t manage this profile.' })
  return p
}

// /@handle is shared by dancers and profiles, so a new handle must be free in both.
async function handleTaken(db: any, handle: string) {
  const [p] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, handle))
  if (p) return true
  const [d] = await db.select({ id: dancers.id }).from(dancers).where(eq(dancers.username, handle))
  return !!d
}

// City pickers save the canonical English name (CityCombobox); its slug lives in
// `cities`. Fall back to slugify for a name the table doesn't know yet.
export async function citySlugFor(db: any, name: string | null) {
  if (!name) return null
  const [c] = await db.select({ slug: cities.slug }).from(cities)
    .where(sql`lower(${cities.name}) = lower(${name})`).limit(1)
  return c?.slug ?? slugify(name)
}

// SQL: does anyone manage this profile in 2026?
// Spelled out: drizzle drops the table name on single-table selects, and a bare
// "id" inside the subquery would bind to m.id.
const isManaged = sql<boolean>`exists (select 1 from "profile_members" m where m.profile_id = "profiles"."id")`

export const businessRouter = router({
  // For the public /@handle page: show "Edit" to managers, "Claim" when unmanaged.
  canManage: publicProcedure
    .input(z.object({ username: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const [p] = await ctx.db.select({ id: profiles.id, managed: isManaged }).from(profiles).where(eq(profiles.username, input.username))
      if (!p) return { canManage: false, managed: false }
      if (!ctx.dancerId) return { canManage: false, managed: !!p.managed }
      if (ctx.isAdmin) return { canManage: true, managed: !!p.managed }
      const [m] = await ctx.db
        .select({ id: profileMembers.id })
        .from(profileMembers)
        .where(and(eq(profileMembers.profileId, p.id), eq(profileMembers.dancerId, ctx.dancerId)))
      return { canManage: !!m, managed: !!p.managed }
    }),

  // Profiles I manage + my claim requests that are still open or were rejected.
  myProfiles: protectedProcedure.query(async ({ ctx }) => {
    const managed = await ctx.db
      .select({
        username: profiles.username,
        name: profiles.name,
        type: profiles.type,
        city: profiles.city,
        photo: profiles.photo,
        role: profileMembers.role,
      })
      .from(profileMembers)
      .innerJoin(profiles, eq(profiles.id, profileMembers.profileId))
      .where(eq(profileMembers.dancerId, ctx.dancerId))
      .orderBy(profiles.name)

    const claims = await ctx.db
      .select({
        id: profileClaims.id,
        status: profileClaims.status,
        kind: profileClaims.kind,
        createdAt: profileClaims.createdAt,
        username: profiles.username,
        name: profiles.name,
        type: profiles.type,
      })
      .from(profileClaims)
      .innerJoin(profiles, eq(profiles.id, profileClaims.profileId))
      .where(and(eq(profileClaims.dancerId, ctx.dancerId), inArray(profileClaims.status, ['pending', 'rejected'])))
      .orderBy(desc(profileClaims.createdAt))

    return { managed, claims }
  }),

  // Find an existing profile to claim (by name or handle).
  search: protectedProcedure
    .input(z.object({ q: z.string().trim().min(2).max(80) }))
    .query(async ({ ctx, input }) => {
      const like = `%${input.q}%`
      return ctx.db
        .select({
          username: profiles.username,
          name: profiles.name,
          type: profiles.type,
          city: profiles.city,
          photo: profiles.photo,
          managed: isManaged,
        })
        .from(profiles)
        .where(and(eq(profiles.status, 'visible'), or(ilike(profiles.name, like), ilike(profiles.username, like))))
        .orderBy(profiles.name)
        .limit(12)
    }),

  requestClaim: protectedProcedure
    .input(z.object({ username: z.string().min(1), message: z.string().trim().min(3).max(1000) }))
    .mutation(async ({ ctx, input }) => {
      const [p] = await ctx.db.select().from(profiles).where(eq(profiles.username, input.username))
      if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found.' })
      const [m] = await ctx.db.select({ id: profileMembers.id }).from(profileMembers).where(eq(profileMembers.profileId, p.id)).limit(1)
      if (m) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Someone already manages this profile. Contact us if that’s wrong.' })
      }
      // One request per person per profile; a rejected one can be re-sent.
      await ctx.db
        .insert(profileClaims)
        .values({ profileId: p.id, dancerId: ctx.dancerId, message: input.message, kind: 'claim', requestedRole: 'owner' })
        .onConflictDoUpdate({
          target: [profileClaims.profileId, profileClaims.dancerId],
          set: { message: input.message, kind: 'claim', requestedRole: 'owner', status: 'pending', createdAt: new Date(), decidedAt: null, decidedBy: null },
        })
      await logAccess(ctx.db, { profileId: p.id, actorId: ctx.dancerId, subjectId: ctx.dancerId, action: 'requested', role: 'owner', note: 'claim' })
      return { requested: true }
    }),

  create: protectedProcedure
    .input(z.object({
      type: z.enum(PROFILE_TYPES),
      name: editableFields.name,
      city: editableFields.city.optional(),
      handle: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, 'Use 3–40 letters, numbers or dashes.').optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      let handle = input.handle || slugify(input.name)
      if (await handleTaken(ctx.db, handle)) {
        if (input.handle) throw new TRPCError({ code: 'CONFLICT', message: 'That handle is taken.' })
        handle = `${slugify(input.name)}-${randomSuffix(4)}`
      }
      const city = input.city?.trim() || null
      const [p] = await ctx.db
        .insert(profiles)
        .values({ type: input.type, name: input.name, username: handle, city, citySlug: await citySlugFor(ctx.db, city), claimed: true })
        .returning({ id: profiles.id, username: profiles.username })
      await ctx.db.insert(profileMembers).values({ profileId: p!.id, dancerId: ctx.dancerId, role: 'owner' })
      await logAccess(ctx.db, { profileId: p!.id, actorId: ctx.dancerId, subjectId: ctx.dancerId, action: 'created', role: 'owner' })
      return { username: p!.username }
    }),

  get: protectedProcedure
    .input(z.object({ username: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const p = await requireMember(ctx, input.username)
      return {
        username: p.username,
        type: p.type,
        name: p.name,
        bio: p.bio ?? '',
        city: p.city ?? '',
        styles: p.styles ?? [],
        photo: p.photo ?? null,
        photos: p.photos ?? [],
        socials: p.socials ?? [],
        address: p.address ?? '',
        floorType: p.floorType ?? '',
        venueType: p.venueType ?? '',
      }
    }),

  update: protectedProcedure
    .input(z.object(editableFields).partial().extend({ username: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const p = await requireMember(ctx, input.username)
      const { username: _u, ...fields } = input
      const set: Record<string, unknown> = { ...fields }
      if (fields.city !== undefined) {
        set.city = fields.city || null
        set.citySlug = await citySlugFor(ctx.db, fields.city || null)
      }
      // The hero must be one of the gallery photos (or empty).
      if (fields.photos && fields.photo === undefined && p.photo && !fields.photos.some(ph => ph.url === p.photo)) {
        set.photo = fields.photos[0]?.url ?? null
      }
      if (Object.keys(set).length) {
        await ctx.db.update(profiles).set(set).where(eq(profiles.id, p.id))
      }
      return { saved: true }
    }),

  // --- Admin: claim + reclaim review (join requests go to the owners) ---
  listClaims: adminProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        id: profileClaims.id,
        kind: profileClaims.kind,
        message: profileClaims.message,
        status: profileClaims.status,
        createdAt: profileClaims.createdAt,
        profileId: profiles.id,
        profileUsername: profiles.username,
        profileName: profiles.name,
        profileType: profiles.type,
        profileManaged: isManaged,
        dancerName: dancers.name,
        dancerEmail: dancers.email,
        dancerInstagram: dancers.instagram,
      })
      .from(profileClaims)
      .innerJoin(profiles, eq(profiles.id, profileClaims.profileId))
      .innerJoin(dancers, eq(dancers.id, profileClaims.dancerId))
      .where(and(eq(profileClaims.status, 'pending'), inArray(profileClaims.kind, ['claim', 'reclaim'])))
      .orderBy(profileClaims.createdAt)
    // Who manages it today — what a reclaim decision is about.
    const ids = [...new Set(rows.map((r: any) => r.profileId))]
    const team = ids.length
      ? await ctx.db.select({ profileId: profileMembers.profileId, role: profileMembers.role, name: dancers.name, email: dancers.email })
        .from(profileMembers).innerJoin(dancers, eq(dancers.id, profileMembers.dancerId))
        .where(inArray(profileMembers.profileId, ids))
      : []
    return rows.map((r: any) => ({ ...r, managers: team.filter((t: any) => t.profileId === r.profileId) }))
  }),

  decideClaim: adminProcedure
    .input(z.object({
      claimId: z.string().uuid(),
      approve: z.boolean(),
      // Reclaim only: also take the current managers off the profile.
      removeOthers: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const [c] = await ctx.db.select().from(profileClaims).where(eq(profileClaims.id, input.claimId))
      if (!c) throw new TRPCError({ code: 'NOT_FOUND', message: 'Claim not found.' })
      if (c.status !== 'pending') throw new TRPCError({ code: 'CONFLICT', message: 'This claim was already decided.' })
      const [p] = await ctx.db.select({ id: profiles.id, name: profiles.name, username: profiles.username }).from(profiles).where(eq(profiles.id, c.profileId))
      const role = c.kind === 'join' ? c.requestedRole : 'owner'

      await ctx.db
        .update(profileClaims)
        .set({ status: input.approve ? 'approved' : 'rejected', decidedAt: new Date(), decidedBy: ctx.dancerId ?? null })
        .where(eq(profileClaims.id, c.id))

      if (input.approve) {
        await grant(ctx.db, c.profileId, c.dancerId, role, { title: c.title, by: ctx.dancerId ?? null })
        if (c.kind === 'reclaim' && input.removeOthers) {
          const others = await ctx.db.select().from(profileMembers).where(eq(profileMembers.profileId, c.profileId))
          for (const o of others.filter((o: any) => o.dancerId !== c.dancerId)) {
            await ctx.db.delete(profileMembers).where(eq(profileMembers.id, o.id))
            await logAccess(ctx.db, { profileId: c.profileId, actorId: ctx.dancerId ?? null, subjectId: o.dancerId, action: 'removed', role: o.role, note: 'reclaim approved' })
          }
        }
      }
      await logAccess(ctx.db, { profileId: c.profileId, actorId: ctx.dancerId ?? null, subjectId: c.dancerId, action: input.approve ? 'approved' : 'rejected', role, note: c.kind })
      await notifyDecision(ctx.db, c.dancerId, p, input.approve, role)
      return { status: input.approve ? 'approved' : 'rejected' }
    }),
})
