import { and, eq, isNull, sql } from 'drizzle-orm'
import { oauthGrants, profileMembers } from '../database/schema'

type Db = any

/** The request as far as a connected app's grant goes (see server/trpc/context.ts). */
export interface GrantOwnerCtx {
  db: Db
  dancerId: string | null
  oauthGrantId?: string | null
  grantedProfileIds?: string[] | null
}

/**
 * A page the dancer just created (or took over) through a connected app joins
 * that app's grant, so the app can run it straight away without a reconnect
 * (#447). Doing it through the app is the consent; pages that already existed
 * still need a tick on the consent screen.
 *
 * Only ever adds a page the dancer is on the team of, only to the dancer's own
 * live grant, and only for token callers (web sessions have no grant). Updates
 * the request's own list too, so later checks in the same request pass.
 * Returns whether the page is now in the grant.
 */
export async function addProfileToOwnGrant(ctx: GrantOwnerCtx, profileId: string): Promise<boolean> {
  if (!ctx.oauthGrantId || !ctx.grantedProfileIds || !ctx.dancerId) return false
  if (ctx.grantedProfileIds.includes(profileId)) return true
  const [member] = await ctx.db.select({ id: profileMembers.id }).from(profileMembers)
    .where(and(eq(profileMembers.profileId, profileId), eq(profileMembers.dancerId, ctx.dancerId)))
  if (!member) return false
  const one = JSON.stringify([profileId])
  const rows = await ctx.db.update(oauthGrants)
    .set({ profileIds: sql`${oauthGrants.profileIds} || ${one}::jsonb`, updatedAt: new Date() })
    .where(and(
      eq(oauthGrants.id, ctx.oauthGrantId),
      eq(oauthGrants.dancerId, ctx.dancerId),
      isNull(oauthGrants.revokedAt),
      sql`not (${oauthGrants.profileIds} @> ${one}::jsonb)`,
    ))
    .returning({ id: oauthGrants.id })
  const [live] = rows.length ? rows : await ctx.db.select({ id: oauthGrants.id }).from(oauthGrants)
    .where(and(eq(oauthGrants.id, ctx.oauthGrantId), eq(oauthGrants.dancerId, ctx.dancerId), isNull(oauthGrants.revokedAt)))
  if (!live) return false
  ctx.grantedProfileIds.push(profileId)
  return true
}
