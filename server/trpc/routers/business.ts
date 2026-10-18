import { z } from 'zod'
import { eq, and, or, ilike, desc, inArray, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure, adminProcedure } from '../trpc'
import { profiles, profileMembers, profileClaims, dancers, cities, events, bookableSpaces, bookingRequests } from '../../database/schema'
import { WEEKDAYS } from '../../../shared/types/venueDetails'
import { slugify, randomSuffix } from '../../utils/slug'
import { parseInstagramHandle, instagramUrl } from '../../../shared/utils/instagram'
import { grant, logAccess, assertProfileGranted, onlyGranted, type GrantCtx } from '../../utils/profileAccess'
import { notifyDecision, notifyInfoRequired } from './businessTeam'

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

const PROFILE_TYPES = ['artist', 'venue', 'organizer', 'promoter'] as const

const editableFields = {
  type: z.enum(PROFILE_TYPES),
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
  // Venue details (0036).
  amenities: z.array(z.string().trim().min(1).max(40)).max(30),
  capacity: z.number().int().min(1).max(100_000).nullable(),
  openingHours: z.array(z.object({ day: z.enum(WEEKDAYS), hours: z.string().trim().min(1).max(60) })).max(14),
  floorPlan: z.string().url().nullable(),
  contact: z.object({
    phone: z.string().trim().max(40).optional(),
    email: z.string().trim().max(200).optional(),
    whatsapp: z.string().trim().max(60).optional(),
    telegram: z.string().trim().max(100).optional(),
  }),
}

// Membership check shared by get/update. Admins may manage any profile.
export async function requireMember(ctx: { db: any; dancerId: string; isAdmin?: boolean } & GrantCtx, username: string) {
  const [p] = await ctx.db.select().from(profiles).where(eq(profiles.username, username))
  if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found.' })
  if (ctx.isAdmin) return p
  assertProfileGranted(ctx, p.id)
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

// Profiles that link this Instagram account (www. / trailing slash / case vary in
// imports). The one reliable "same account" signal we have.
export const linksInstagram = (handle: string) =>
  sql`${profiles.socials}::text ~* ${`instagram\\.com/${handle.replace(/\./g, '\\.')}/?"`}`

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
    const managedRows = await ctx.db
      .select({
        id: profiles.id,
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
    // A connected app sees only the profiles it was given.
    const managed = onlyGranted(ctx, managedRows, (r: any) => r.id).map(({ id: _id, ...r }: any) => r)

    const claims = await ctx.db
      .select({
        id: profileClaims.id,
        status: profileClaims.status,
        kind: profileClaims.kind,
        reviewerNote: profileClaims.reviewerNote,
        createdAt: profileClaims.createdAt,
        username: profiles.username,
        name: profiles.name,
        type: profiles.type,
      })
      .from(profileClaims)
      .innerJoin(profiles, eq(profiles.id, profileClaims.profileId))
      .where(and(eq(profileClaims.dancerId, ctx.dancerId), inArray(profileClaims.status, ['pending', 'rejected', 'info_required'])))
      .orderBy(desc(profileClaims.createdAt))

    // Claims are about pages not managed yet: not shown to connected apps.
    return { managed, claims: ctx.grantedProfileIds && !ctx.isAdmin ? [] : claims }
  }),

  // Find an existing profile to claim (by name or handle).
  // By name or handle; a pasted Instagram link or @handle also finds the page
  // that links that account (instagram.com/ritmo_jg → La Clave en Múnich).
  search: protectedProcedure
    .input(z.object({ q: z.string().trim().min(2).max(300) }))
    .query(async ({ ctx, input }) => {
      const ig = parseInstagramHandle(input.q)
      const term = /instagram\.com\//i.test(input.q) && ig ? ig : input.q.replace(/^@/, '')
      const like = `%${term}%`
      return ctx.db
        .select({
          username: profiles.username,
          name: profiles.name,
          type: profiles.type,
          city: profiles.city,
          photo: profiles.photo,
          managed: isManaged,
          // This page links the pasted Instagram account (else: offer to import it).
          linksInstagram: ig ? sql<boolean>`${linksInstagram(ig)}` : sql<boolean>`false`,
        })
        .from(profiles)
        .where(and(eq(profiles.status, 'visible'), or(ilike(profiles.name, like), ilike(profiles.username, like), ig ? linksInstagram(ig) : undefined)))
        // The page that links the pasted Instagram account comes first.
        .orderBy(...(ig ? [desc(linksInstagram(ig))] : []), profiles.name)
        .limit(12)
    }),

  requestClaim: protectedProcedure
    .input(z.object({
      username: z.string().min(1),
      message: z.string().trim().min(3).max(1000),
      evidence: z.string().trim().max(2000).default(''),
      evidenceType: z.enum(['domain_email', 'social_media', 'website_link', 'documentation', 'other']).default('other'),
    }))
    .mutation(async ({ ctx, input }) => {
      const [p] = await ctx.db.select().from(profiles).where(eq(profiles.username, input.username))
      if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found.' })
      const [m] = await ctx.db.select({ id: profileMembers.id }).from(profileMembers).where(eq(profileMembers.profileId, p.id)).limit(1)
      if (m) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Someone already manages this profile. Contact us if that’s wrong.' })
      }
      // One request per person per profile; a rejected or info_required one can be re-sent.
      await ctx.db
        .insert(profileClaims)
        .values({
          profileId: p.id, dancerId: ctx.dancerId, message: input.message,
          evidence: input.evidence, evidenceType: input.evidenceType,
          kind: 'claim', requestedRole: 'owner',
        })
        .onConflictDoUpdate({
          target: [profileClaims.profileId, profileClaims.dancerId],
          set: {
            message: input.message, evidence: input.evidence, evidenceType: input.evidenceType,
            kind: 'claim', requestedRole: 'owner', status: 'pending', reviewerNote: '',
            createdAt: new Date(), decidedAt: null, decidedBy: null,
          },
        })
      await logAccess(ctx.db, { profileId: p.id, actorId: ctx.dancerId, subjectId: ctx.dancerId, action: 'requested', role: 'owner', note: 'claim' })
      return { requested: true }
    }),

  // "Is this already on WeDance?" while someone fills in Create — by handle,
  // Instagram account or exact name. Lets the form say "claim it" instead of
  // creating a duplicate.
  findExisting: protectedProcedure
    .input(z.object({
      name: z.string().trim().max(120).optional(),
      handle: z.string().trim().max(60).optional(),
      instagram: z.string().trim().max(300).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const ig = parseInstagramHandle(input.instagram)
      const conds = [
        input.handle ? eq(profiles.username, input.handle.toLowerCase()) : undefined,
        ig ? linksInstagram(ig) : undefined,
        input.name && input.name.length >= 3 ? sql`lower(${profiles.name}) = lower(${input.name})` : undefined,
      ].filter(Boolean)
      if (!conds.length) return []
      return ctx.db
        .select({ username: profiles.username, name: profiles.name, type: profiles.type, city: profiles.city, photo: profiles.photo, managed: isManaged })
        .from(profiles)
        .where(and(eq(profiles.status, 'visible'), or(...(conds as any[]))))
        .limit(5)
    }),

  create: protectedProcedure
    .input(z.object({
      type: z.enum(PROFILE_TYPES),
      name: editableFields.name,
      city: editableFields.city.optional(),
      instagram: z.string().trim().max(300).optional(),
      handle: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, 'Use 3–40 letters, numbers or dashes.').optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const ig = input.instagram ? parseInstagramHandle(input.instagram) : null
      if (input.instagram && !ig) throw new TRPCError({ code: 'BAD_REQUEST', message: 'That doesn’t look like an Instagram link or handle.' })
      if (ig) {
        const [dupe] = await ctx.db.select({ username: profiles.username, name: profiles.name }).from(profiles).where(linksInstagram(ig)).limit(1)
        if (dupe) throw new TRPCError({ code: 'CONFLICT', message: `@${ig} already has a page on WeDance: ${dupe.name} (@${dupe.username}). Claim it or join its team instead.` })
      }
      let handle = input.handle || slugify(input.name)
      if (await handleTaken(ctx.db, handle)) {
        if (input.handle) throw new TRPCError({ code: 'CONFLICT', message: `@${handle} is taken — if that page is yours, claim it instead.` })
        handle = `${slugify(input.name)}-${randomSuffix(4)}`
      }
      const city = input.city?.trim() || null
      const [p] = await ctx.db
        .insert(profiles)
        .values({
          type: input.type, name: input.name, username: handle, city, citySlug: await citySlugFor(ctx.db, city), claimed: true,
          socials: ig ? [{ platform: 'instagram', url: instagramUrl(ig) }] : [],
        })
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
        amenities: (p.amenities ?? []) as string[],
        capacity: (p.capacity ?? null) as number | null,
        openingHours: (p.openingHours ?? []) as { day: (typeof WEEKDAYS)[number]; hours: string }[],
        floorPlan: (p.floorPlan ?? null) as string | null,
        contact: (p.contact ?? {}) as { phone?: string; email?: string; whatsapp?: string; telegram?: string },
      }
    }),

  // A venue's rooms (bookable_spaces): name, capacity, floor, price info, photo.
  spaces: protectedProcedure
    .input(z.object({ username: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const p = await requireMember(ctx, input.username)
      return ctx.db.select({
        id: bookableSpaces.id, name: bookableSpaces.name, capacity: bookableSpaces.capacity, floorType: bookableSpaces.floorType,
        priceInfo: bookableSpaces.priceInfo, description: bookableSpaces.description, imageUrl: bookableSpaces.imageUrl,
      }).from(bookableSpaces).where(eq(bookableSpaces.profileId, p.id)).orderBy(bookableSpaces.sortOrder)
    }),

  // Save the rooms as listed: new ones added, changed ones updated, removed ones
  // deleted — except rooms someone already asked to book, which stay.
  saveSpaces: protectedProcedure
    .input(z.object({
      username: z.string().min(1),
      spaces: z.array(z.object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(1).max(80),
        capacity: z.number().int().min(1).max(100_000).nullable().optional(),
        floorType: z.string().trim().max(60).optional(),
        priceInfo: z.string().trim().max(200).optional(),
        description: z.string().trim().max(1000).optional(),
        imageUrl: z.string().url().nullable().optional(),
      })).max(30),
    }))
    .mutation(async ({ ctx, input }) => {
      const p = await requireMember(ctx, input.username)
      const existing = await ctx.db.select({ id: bookableSpaces.id, name: bookableSpaces.name }).from(bookableSpaces).where(eq(bookableSpaces.profileId, p.id))
      const keep = new Set(input.spaces.map(s => s.id).filter(Boolean))
      const kept: string[] = []
      for (const e of existing) {
        if (keep.has(e.id)) continue
        const [b] = await ctx.db.select({ id: bookingRequests.id }).from(bookingRequests).where(eq(bookingRequests.spaceId, e.id)).limit(1)
        if (b) kept.push(e.name)
        else await ctx.db.delete(bookableSpaces).where(eq(bookableSpaces.id, e.id))
      }
      for (const [i, s] of input.spaces.entries()) {
        const row = { name: s.name, capacity: s.capacity ?? null, floorType: s.floorType || null, priceInfo: s.priceInfo || null, description: s.description || null, imageUrl: s.imageUrl ?? null, sortOrder: i }
        if (s.id && existing.some(e => e.id === s.id)) await ctx.db.update(bookableSpaces).set(row).where(eq(bookableSpaces.id, s.id))
        else await ctx.db.insert(bookableSpaces).values({ ...row, profileId: p.id })
      }
      return { saved: true, kept }
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
      // Events copy the venue's name and address when they're saved; keep the
      // ones held here in step (the event page, flyer and caption read them).
      // Hosted events only — synced v3 events are owned by the sync.
      if (p.type === 'venue' && (fields.name !== undefined || fields.address !== undefined)) {
        await ctx.db.update(events)
          .set({ venueName: fields.name ?? p.name, venueAddress: (fields.address ?? p.address) || null, updatedAt: new Date() })
          .where(and(eq(events.venueUsername, p.username), sql`${events.hostProfileId} IS NOT NULL`))
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
        evidence: profileClaims.evidence,
        evidenceType: profileClaims.evidenceType,
        reviewerNote: profileClaims.reviewerNote,
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
      .where(and(inArray(profileClaims.status, ['pending', 'info_required']), inArray(profileClaims.kind, ['claim', 'reclaim'])))
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
      // Admin feedback — required when requesting more info, optional otherwise.
      reviewerNote: z.string().trim().max(2000).default(''),
      // Ask for more info instead of approving/rejecting.
      requestInfo: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      const [c] = await ctx.db.select().from(profileClaims).where(eq(profileClaims.id, input.claimId))
      if (!c) throw new TRPCError({ code: 'NOT_FOUND', message: 'Claim not found.' })
      if (c.status !== 'pending' && c.status !== 'info_required') {
        throw new TRPCError({ code: 'CONFLICT', message: 'This claim was already decided.' })
      }
      const [p] = await ctx.db.select({ id: profiles.id, name: profiles.name, username: profiles.username }).from(profiles).where(eq(profiles.id, c.profileId))
      const role = c.kind === 'join' ? c.requestedRole : 'owner'

      // Request more info: set status to info_required, don't grant access.
      if (input.requestInfo) {
        if (!input.reviewerNote) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Tell them what you need.' })
        await ctx.db
          .update(profileClaims)
          .set({ status: 'info_required' as const, reviewerNote: input.reviewerNote, decidedBy: ctx.dancerId ?? null })
          .where(eq(profileClaims.id, c.id))
        await logAccess(ctx.db, { profileId: c.profileId, actorId: ctx.dancerId ?? null, subjectId: c.dancerId, action: 'rejected', role, note: 'info_required' })
        await notifyInfoRequired(ctx.db, c.dancerId, p, input.reviewerNote)
        return { status: 'info_required' as const }
      }

      await ctx.db
        .update(profileClaims)
        .set({
          status: input.approve ? 'approved' : 'rejected',
          reviewerNote: input.reviewerNote,
          decidedAt: new Date(), decidedBy: ctx.dancerId ?? null,
        })
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
