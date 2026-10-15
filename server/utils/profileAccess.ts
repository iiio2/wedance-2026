import { eq, and, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { profiles, profileMembers, profileAccessLog } from '../database/schema'

/**
 * Who may do what with a profile in business mode, plus the access history.
 *
 * Roles: owner (edit + manage the team) · editor (edit profile and events).
 * A profile always keeps at least one owner. Every grant, removal and role
 * change goes through logAccess so a reclaim dispute can be judged on facts.
 */

export type Role = 'owner' | 'editor' | 'moderator'
export type Db = any

export async function profileByHandle(db: Db, username: string) {
  const [p] = await db.select().from(profiles).where(eq(profiles.username, username))
  if (!p) throw new TRPCError({ code: 'NOT_FOUND', message: 'Profile not found.' })
  return p
}

export async function membershipOf(db: Db, profileId: string, dancerId: string) {
  const [m] = await db.select().from(profileMembers)
    .where(and(eq(profileMembers.profileId, profileId), eq(profileMembers.dancerId, dancerId)))
  return m ?? null
}

export async function ownerCount(db: Db, profileId: string) {
  const [r] = await db.select({ n: sql<number>`count(*)::int` }).from(profileMembers)
    .where(and(eq(profileMembers.profileId, profileId), eq(profileMembers.role, 'owner')))
  return r?.n ?? 0
}

/** Owners (and WeDance admins) manage the team. */
export async function requireOwner(ctx: { db: Db; dancerId: string; isAdmin?: boolean }, username: string) {
  const p = await profileByHandle(ctx.db, username)
  if (ctx.isAdmin) return p
  const m = await membershipOf(ctx.db, p.id, ctx.dancerId)
  if (m?.role !== 'owner') throw new TRPCError({ code: 'FORBIDDEN', message: 'Only owners can manage the team.' })
  return p
}

/** Throws when a change would leave the profile with no owner. */
export async function keepAnOwner(db: Db, profileId: string, losingOwnerId: string) {
  const m = await membershipOf(db, profileId, losingOwnerId)
  if (m?.role === 'owner' && (await ownerCount(db, profileId)) <= 1) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'A profile needs at least one owner. Make someone else owner first.' })
  }
}

/** Add someone, or change their role if they're already on the team. */
export async function grant(db: Db, profileId: string, dancerId: string, role: Role, opts: { title?: string | null; by?: string | null } = {}) {
  await db.insert(profileMembers)
    .values({ profileId, dancerId, role, title: opts.title ?? null, addedBy: opts.by ?? null })
    .onConflictDoUpdate({
      target: [profileMembers.profileId, profileMembers.dancerId],
      set: { role, ...(opts.title !== undefined ? { title: opts.title } : {}) },
    })
  // Managed now: keep the v3 sync off this profile.
  await db.update(profiles).set({ claimed: true }).where(eq(profiles.id, profileId))
}

/**
 * Step 13 (ADR-004): require the caller to hold a specific role (or higher)
 * on a profile. Role hierarchy: owner > editor > moderator. Admins bypass.
 * Replaces the old moderatorHandle string comparison in booking/elections.
 */
const roleRank: Record<Role, number> = { owner: 3, editor: 2, moderator: 1 }

export async function requireProfileRole(
  ctx: { db: Db; dancerId: string; isAdmin?: boolean },
  profileId: string,
  minimumRole: Role,
) {
  if (ctx.isAdmin) return
  const m = await membershipOf(ctx.db, profileId, ctx.dancerId)
  if (!m || roleRank[m.role as Role] < roleRank[minimumRole]) {
    throw new TRPCError({ code: 'FORBIDDEN', message: `Requires ${minimumRole} role or higher on this profile.` })
  }
}

export async function logAccess(db: Db, entry: {
  profileId: string
  actorId: string | null
  subjectId?: string | null
  action: 'created' | 'requested' | 'approved' | 'rejected' | 'role_changed' | 'removed' | 'left'
  role?: string | null
  note?: string | null
}) {
  await db.insert(profileAccessLog).values({
    profileId: entry.profileId,
    actorId: entry.actorId,
    subjectId: entry.subjectId ?? null,
    action: entry.action,
    role: entry.role ?? null,
    note: entry.note ?? null,
  })
}
