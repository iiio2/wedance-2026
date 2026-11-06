import { z } from 'zod'
import { eq, and, or, ilike, desc, inArray, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure, adminProcedure } from '../trpc'
import { profiles, profileMembers, profileClaims, dancers, cities, events, bookableSpaces, bookingRequests, profileMerges, profileSites } from '../../database/schema'
import { WEEKDAYS } from '../../../shared/types/venueDetails'
import { slugify, randomSuffix } from '../../utils/slug'
import { parseInstagramHandle, handleFromInstagram, instagramUrl } from '../../../shared/utils/instagram'
import { handleError } from '../../../shared/utils/handle'
import { grant, logAccess, assertProfileGranted, notManagedError, onlyGranted, type GrantCtx } from '../../utils/profileAccess'
import { notifyDecision, notifyInfoRequired } from './businessTeam'
import { addProfileToOwnGrant } from '../../oauth/grants'
import { profileGroup, trackServer } from '../../utils/posthog'
import { mergeProfile, moveHandleRefs, undoMerge } from '../../utils/mergeProfiles'
import { findLikelyDuplicates, linksInstagramSql, notMerged } from '../../utils/profileDupes'
import { scheduleInstagramImport } from '../../utils/instagram/profileImport'

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
  const [m] = await ctx.db
    .select({ role: profileMembers.role })
    .from(profileMembers)
    .where(and(eq(profileMembers.profileId, p.id), eq(profileMembers.dancerId, ctx.dancerId)))
  // Not on the team: say so, never "reconnect and tick" (#454).
  if (!m) throw await notManagedError(ctx.db, p)
  assertProfileGranted(ctx, p.id)
  return p
}

async function hasTeam(db: any, profileId: string) {
  const [m] = await db.select({ id: profileMembers.id }).from(profileMembers).where(eq(profileMembers.profileId, profileId)).limit(1)
  return !!m
}

// /@handle is shared by dancers and profiles, so a new handle must be free in both.
// One namespace: pages, dancers, and the old handles both keep for redirects.
export async function handleTaken(db: any, handle: string) {
  const h = handle.toLowerCase()
  const [p] = await db.select({ id: profiles.id }).from(profiles)
    .where(sql`lower(${profiles.username}) = ${h} or ${profiles.sourceRef}->'oldHandles' ? ${h}`).limit(1)
  if (p) return true
  const [d] = await db.select({ id: dancers.id }).from(dancers)
    .where(sql`lower(${dancers.username}) = ${h} or ${dancers.oldUsernames} ? ${h}`).limit(1)
  return !!d
}

// A handle someone picks (create, rename): the Instagram-compatible rule in shared/utils/handle.ts.
const chosenHandle = z.string().trim().toLowerCase().superRefine((h, c) => {
  const err = handleError(h)
  if (err) c.addIssue({ code: 'custom', message: err })
})

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

// Profiles that link this Instagram account — their main one or an alias (#458) —
// and aren't a copy merged into another page. The one reliable "same account" signal we have.
export const linksInstagram = (handle: string) => sql`(${linksInstagramSql(handle)} and ${notMerged})`

// Owners only (or admins): merging moves a page's team, events and followers.
async function requireOwner(ctx: { db: any; dancerId: string; isAdmin?: boolean } & GrantCtx, username: string, doing = 'merge it') {
  const p = await requireMember(ctx, username)
  if (ctx.isAdmin) return p
  const [m] = await ctx.db.select({ role: profileMembers.role }).from(profileMembers)
    .where(and(eq(profileMembers.profileId, p.id), eq(profileMembers.dancerId, ctx.dancerId)))
  if (m?.role !== 'owner') throw new TRPCError({ code: 'FORBIDDEN', message: `Only an owner of @${username} can ${doing}.` })
  return p
}

// Pages this dancer owns, by id (for "can I merge that one too?").
async function ownedIds(ctx: { db: any; dancerId: string } & GrantCtx) {
  const rows = await ctx.db.select({ id: profileMembers.profileId }).from(profileMembers)
    .where(and(eq(profileMembers.dancerId, ctx.dancerId), eq(profileMembers.role, 'owner')))
  return new Set(onlyGranted(ctx, rows, (r: any) => r.id).map((r: any) => r.id as string))
}

const normalizeAliases = (list: string[], main: string | null) =>
  [...new Set(list.map(a => parseInstagramHandle(a)).filter((h): h is string => !!h && h !== main))].slice(0, 10)

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
        roles: profiles.roles,
        // The page's own website when WeDance is its CMS (RAZ-412).
        hasSite: sql<boolean>`${profileSites.profileId} IS NOT NULL`,
        siteDomain: sql<string | null>`${profileSites.content}->>'domain'`,
      })
      .from(profileMembers)
      .innerJoin(profiles, eq(profiles.id, profileMembers.profileId))
      .leftJoin(profileSites, eq(profileSites.profileId, profiles.id))
      // A merged copy keeps the members the kept page already had; it isn't a page to run.
      .where(and(eq(profileMembers.dancerId, ctx.dancerId), notMerged))
      .orderBy(profiles.name)
    // A connected app sees only the profiles it was given.
    const managed = onlyGranted(ctx, managedRows, (r: any) => r.id).map(({ id: _id, roles, ...r }: any) => ({ ...r, influencer: r.type === 'promoter' && (roles ?? []).includes('influencer') }))

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
      trackServer(ctx, 'profile_claim_requested', { profile: p.username, profile_type: p.type, evidence_type: input.evidenceType, ...profileGroup(p.username) })
      return { requested: true }
    }),

  // "Is this already on WeDance?" while someone fills in Create — by handle,
  // Instagram account or exact name. Lets the form say "claim it" instead of
  // creating a duplicate.
  // Instagram account (main or alias), similar name in the same city, or (venues)
  // the same address (#458).
  findExisting: protectedProcedure
    .input(z.object({
      name: z.string().trim().max(120).optional(),
      handle: z.string().trim().max(60).optional(),
      instagram: z.string().trim().max(300).optional(),
      city: z.string().trim().max(120).optional(),
      type: z.enum(PROFILE_TYPES).optional(),
      address: z.string().trim().max(300).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const rows = await findLikelyDuplicates(ctx.db, {
        name: input.name && input.name.length >= 3 ? input.name : null, handle: input.handle, instagram: input.instagram,
        citySlug: input.city ? await citySlugFor(ctx.db, input.city) : null, type: input.type, address: input.address,
      })
      return rows.map(({ id: _id, address: _a, ...r }) => r)
    }),

  // "Possible duplicates" of a page I run (Business mode): same Instagram account,
  // similar name in the same city, same address. `canMerge`: I own both (or I'm an admin).
  duplicates: protectedProcedure
    .input(z.object({ username: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const p = await requireMember(ctx, input.username)
      const rows = await findLikelyDuplicates(ctx.db, {
        name: p.name, instagram: [...((p.socials ?? []) as any[]).filter(s => s.platform?.toLowerCase() === 'instagram').map(s => s.url), ...((p.instagramAliases ?? []) as string[])],
        citySlug: p.citySlug, type: p.type, address: p.address, lat: p.lat, lng: p.lng, excludeId: p.id, limit: 8,
      })
      const owned = ctx.isAdmin ? null : await ownedIds(ctx)
      const iOwnThis = ctx.isAdmin || owned!.has(p.id)
      return rows.map(({ id, ...r }) => ({ ...r, canMerge: iOwnThis && (ctx.isAdmin || owned!.has(id)) }))
    }),

  // Merge a duplicate into the page that stays (#458): every event, follower, team
  // member, review, room, booking and link moves over, the copy's Instagram becomes
  // an alias, and the copy is hidden — /@copy forwards to /@into. Owners of both
  // pages, or admins. Recorded in profile_merges, so it can be undone.
  merge: protectedProcedure
    .input(z.object({ from: z.string().min(1).transform(h => h.replace(/^@/, '')), into: z.string().min(1).transform(h => h.replace(/^@/, '')) }))
    .mutation(async ({ ctx, input }) => {
      if (input.from.toLowerCase() === input.into.toLowerCase()) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Pick two different pages.' })
      const into = await requireOwner(ctx, input.into)
      const from = await requireOwner(ctx, input.from)
      const merged = (p: any) => !!(p.sourceRef as any)?.mergedInto
      if (merged(from)) throw new TRPCError({ code: 'CONFLICT', message: `@${from.username} was already merged into @${(from.sourceRef as any).mergedInto}.` })
      if (merged(into) || into.status !== 'visible') throw new TRPCError({ code: 'BAD_REQUEST', message: `@${into.username} is hidden — merge into a visible page.` })
      const r = await mergeProfile(ctx.db, { id: from.id, username: from.username }, { id: into.id, username: into.username }, { by: ctx.dancerId })
      // The kept page is now run by whoever ran either one.
      if (from.claimed && !into.claimed) await ctx.db.update(profiles).set({ claimed: true }).where(eq(profiles.id, into.id))
      await logAccess(ctx.db, { profileId: into.id, actorId: ctx.dancerId, subjectId: ctx.dancerId, action: 'merged', note: `@${from.username} merged into this page` })
      await logAccess(ctx.db, { profileId: from.id, actorId: ctx.dancerId, subjectId: ctx.dancerId, action: 'merged', note: `merged into @${into.username}` })
      const moved = Object.values(r.touched).reduce((n, v) => n + v, 0)
      trackServer(ctx, 'profile_merged', { profile: into.username, merged_profile: from.username, profile_type: into.type, same_type: from.type === into.type, moved, ...profileGroup(into.username) })
      return { mergeId: r.mergeId, into: into.username, from: from.username, moved: r.touched, filled: r.filled }
    }),

  // Merges into this page (newest first) — what an undo picks from.
  merges: protectedProcedure
    .input(z.object({ username: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      const p = await requireMember(ctx, input.username)
      return ctx.db.select({
        id: profileMerges.id, fromUsername: profileMerges.fromUsername, mergedAt: profileMerges.mergedAt,
        undoneAt: profileMerges.undoneAt, by: dancers.name,
      }).from(profileMerges).leftJoin(dancers, eq(dancers.id, profileMerges.mergedBy))
        .where(eq(profileMerges.toProfileId, p.id)).orderBy(desc(profileMerges.mergedAt)).limit(20)
    }),

  // Undo a merge: everything recorded moves back and the copy shows again.
  // Owners of the kept page, or admins.
  undoMerge: protectedProcedure
    .input(z.object({ mergeId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [m] = await ctx.db.select().from(profileMerges).where(eq(profileMerges.id, input.mergeId))
      if (!m) throw new TRPCError({ code: 'NOT_FOUND', message: 'Merge not found.' })
      if (m.undoneAt) throw new TRPCError({ code: 'CONFLICT', message: 'This merge was already undone.' })
      const [into] = await ctx.db.select({ username: profiles.username }).from(profiles).where(eq(profiles.id, m.toProfileId))
      await requireOwner(ctx, into!.username)
      // A later merge of the kept page itself would be undone first.
      const [later] = await ctx.db.select({ id: profileMerges.id }).from(profileMerges)
        .where(and(eq(profileMerges.fromProfileId, m.toProfileId), sql`${profileMerges.undoneAt} IS NULL`)).limit(1)
      if (later) throw new TRPCError({ code: 'CONFLICT', message: `@${into!.username} was itself merged since — undo that first.` })
      const r = await undoMerge(ctx.db, m.id, ctx.dancerId)
      await logAccess(ctx.db, { profileId: m.toProfileId, actorId: ctx.dancerId, subjectId: ctx.dancerId, action: 'unmerged', note: `@${r.fromUsername} split off again` })
      await logAccess(ctx.db, { profileId: m.fromProfileId, actorId: ctx.dancerId, subjectId: ctx.dancerId, action: 'unmerged', note: `split off from @${r.toUsername}` })
      return { restored: r.fromUsername }
    }),

  create: protectedProcedure
    .input(z.object({
      type: z.enum(PROFILE_TYPES),
      name: editableFields.name,
      city: editableFields.city.optional(),
      instagram: z.string().trim().max(300).optional(),
      handle: chosenHandle.optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const ig = input.instagram ? parseInstagramHandle(input.instagram) : null
      if (input.instagram && !ig) throw new TRPCError({ code: 'BAD_REQUEST', message: 'That doesn’t look like an Instagram link or handle.' })
      if (ig) {
        const [dupe] = await ctx.db.select({ id: profiles.id, username: profiles.username, name: profiles.name, sourceRef: profiles.sourceRef }).from(profiles).where(linksInstagram(ig)).limit(1)
        // A page this dancer added from Instagram a moment ago (add_profile_from_instagram)
        // that nobody runs yet: they made it, so it becomes theirs instead of a duplicate.
        const src = dupe?.sourceRef as { source?: string; addedBy?: string } | null | undefined
        if (dupe && src?.source === 'wedance-business' && src.addedBy === ctx.dancerId && !(await hasTeam(ctx.db, dupe.id))) {
          const city = input.city?.trim() || null
          await ctx.db.update(profiles)
            .set({ type: input.type, name: input.name, ...(city ? { city, citySlug: await citySlugFor(ctx.db, city) } : {}) })
            .where(eq(profiles.id, dupe.id))
          await grant(ctx.db, dupe.id, ctx.dancerId, 'owner')
          await logAccess(ctx.db, { profileId: dupe.id, actorId: ctx.dancerId, subjectId: ctx.dancerId, action: 'created', role: 'owner', note: 'Took over a page they had added from Instagram.' })
          await addProfileToOwnGrant(ctx, dupe.id)
          trackServer(ctx, 'business_profile_created', { profile: dupe.username, profile_type: input.type, ...profileGroup(dupe.username) })
          scheduleInstagramImport(ctx, [{ profileId: dupe.id, handle: ig, allowOwned: true }])
          return { username: dupe.username as string }
        }
        if (dupe) throw new TRPCError({ code: 'CONFLICT', message: `@${ig} already has a page on WeDance: ${dupe.name} (@${dupe.username}). Claim it or join its team instead.` })
      }
      // Left empty: the Instagram handle as is (how people know them), else the name.
      let handle = input.handle || (ig ? handleFromInstagram(ig) : '') || slugify(input.name)
      if (!input.handle && handleError(handle)) handle = `${handle || 'page'}-${randomSuffix(4)}`
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
      // Made through a connected app: that app may run it right away (#447).
      await addProfileToOwnGrant(ctx, p!.id)
      trackServer(ctx, 'business_profile_created', { profile: p!.username, profile_type: input.type, ...profileGroup(p!.username) })
      // Their own new page: empty fields from their Instagram, after the response (#452).
      if (ig) scheduleInstagramImport(ctx, [{ profileId: p!.id, handle: ig, allowOwned: true }])
      return { username: p!.username }
    }),

  // An owner changes the page's address (/@old → /@new), e.g. to match its
  // Instagram. The old handle keeps redirecting (source_ref.oldHandles →
  // entity.movedTo) and stays this page's; events, line-ups and reviews that
  // name the page by handle move along (moveHandleRefs, as in a merge).
  renameHandle: protectedProcedure
    .input(z.object({ username: z.string().min(1), handle: chosenHandle }))
    .mutation(async ({ ctx, input }) => {
      const p = await requireOwner(ctx, input.username, 'change its handle')
      const from = p.username as string
      const to = input.handle
      if (to === from) return { username: from }
      const own = (((p.sourceRef as any)?.oldHandles ?? []) as string[]).map(h => String(h).toLowerCase())
      // Back to one of its own old handles (or a case change) is fine; any other handle in use is not.
      if (to !== from.toLowerCase() && !own.includes(to) && await handleTaken(ctx.db, to))
        throw new TRPCError({ code: 'CONFLICT', message: `@${to} is taken.` })
      await moveHandleRefs(ctx.db, from, to)
      const oldHandles = [...new Set([...own, from])].filter(h => h !== to)
      await ctx.db.execute(sql`update profiles set username = ${to},
        source_ref = coalesce(source_ref, '{}'::jsonb) || jsonb_build_object('oldHandles', ${JSON.stringify(oldHandles)}::jsonb)
        where id = ${p.id}`)
      // Copies merged into this page, and its merge history (undo moves refs by handle).
      await ctx.db.execute(sql`update profiles set source_ref = jsonb_set(source_ref, '{mergedInto}', to_jsonb(${to}::text)) where source_ref->>'mergedInto' = ${from}`)
      await ctx.db.execute(sql`update profile_merges set to_username = ${to} where to_username = ${from}`)
      await ctx.db.execute(sql`update profile_merges set from_username = ${to} where from_username = ${from}`)
      await logAccess(ctx.db, { profileId: p.id, actorId: ctx.dancerId, subjectId: ctx.dancerId, action: 'renamed', note: `@${from} → @${to}` })
      return { username: to }
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
        instagramAliases: (p.instagramAliases ?? []) as string[],
        address: p.address ?? '',
        floorType: p.floorType ?? '',
        venueType: p.venueType ?? '',
        amenities: (p.amenities ?? []) as string[],
        capacity: (p.capacity ?? null) as number | null,
        openingHours: (p.openingHours ?? []) as { day: (typeof WEEKDAYS)[number]; hours: string }[],
        floorPlan: (p.floorPlan ?? null) as string | null,
        contact: (p.contact ?? {}) as { phone?: string; email?: string; whatsapp?: string; telegram?: string },
        // An influencer is a promoter whose deliverable is content (MCP spec, decision 2).
        influencer: p.type === 'promoter' && ((p.roles ?? []) as string[]).includes('influencer'),
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
    .input(z.object(editableFields).partial().extend({
      username: z.string().min(1),
      // Promoter pages only: the page posts content (an influencer).
      influencer: z.boolean().optional(),
      // Other Instagram accounts of this business (#458); the main one is in socials.
      instagramAliases: z.array(z.string().trim().min(1).max(300)).max(10).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const p = await requireMember(ctx, input.username)
      const { username: _u, influencer, instagramAliases, ...fields } = input
      const set: Record<string, unknown> = { ...fields }
      if (instagramAliases !== undefined || fields.socials !== undefined) {
        const socials = (fields.socials ?? p.socials ?? []) as { platform: string; url: string }[]
        const main = parseInstagramHandle(socials.find(s => s.platform.toLowerCase() === 'instagram')?.url ?? null)
        set.instagramAliases = normalizeAliases(instagramAliases ?? ((p.instagramAliases ?? []) as string[]), main)
      }
      const type = fields.type ?? p.type
      if (influencer && type !== 'promoter') throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only promoter pages can be influencers.' })
      if (influencer !== undefined || type !== 'promoter') {
        const roles = ((p.roles ?? []) as string[]).filter(r => r !== 'influencer')
        const next = influencer && type === 'promoter' ? [...roles, 'influencer'] : roles
        if (next.length !== ((p.roles ?? []) as string[]).length) set.roles = next
      }
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
      // Attributed to the claimant (not the reviewing admin).
      if (input.approve && c.kind !== 'join') trackServer(ctx, 'profile_claimed', { profile: p?.username ?? null, via: 'review', kind: c.kind, ...profileGroup(p?.username) }, { distinctId: c.dancerId })
      return { status: input.approve ? 'approved' : 'rejected' }
    }),
})
