/**
 * Saving a profile's website with its version history (RAZ-412, 0062). Every
 * save — the web editor, an AI app (MCP update_my_site), a restore — goes
 * through writeSite: it replaces the live site and keeps the new content as a
 * version with who saved it, from where and what changed.
 */
import { and, desc, eq, notInArray } from 'drizzle-orm'
import { profileSites, profileSiteVersions } from '../database/schema'
import type { ProfileSite } from '../../shared/types/profileSite'
import { siteChangeSummary, stableJson } from '../../shared/utils/siteDiff'
import { mcpApp } from '../mcp/caller'

/** Versions kept per site; older ones are dropped on save. */
export const MAX_SITE_VERSIONS = 100

type Ctx = { db: any; dancerId: string | null; oauthGrantId?: string | null; oauthClientId?: string | null }

/** Where a save came from: the web editor, or an AI app over MCP (and which). */
export function saveSource(ctx: Pick<Ctx, 'oauthGrantId' | 'oauthClientId'>): { via: 'web' | 'mcp'; clientApp: string | null } {
  if (!ctx.oauthGrantId) return { via: 'web', clientApp: null }
  return { via: 'mcp', clientApp: ctx.oauthClientId ? mcpApp(null, ctx.oauthClientId) : null }
}

/**
 * Replace the live site and keep it as a version. A save that changes
 * nothing writes nothing (unchanged: true).
 */
export async function writeSite(ctx: Ctx, profileId: string, site: ProfileSite, opts: { restoredFrom?: string } = {}) {
  const [row] = await ctx.db.select({ content: profileSites.content, updatedAt: profileSites.updatedAt }).from(profileSites).where(eq(profileSites.profileId, profileId))
  const before = (row?.content as ProfileSite | undefined) ?? null
  if (before && stableJson(before) === stableJson(site)) {
    return { updatedAt: row.updatedAt as Date, unchanged: true, firstSave: false, versionId: null as string | null, summary: [] as string[] }
  }
  const now = new Date()
  await ctx.db.insert(profileSites).values({ profileId, content: site, updatedAt: now, updatedBy: ctx.dancerId })
    .onConflictDoUpdate({ target: profileSites.profileId, set: { content: site, updatedAt: now, updatedBy: ctx.dancerId } })
  const summary = siteChangeSummary(before, site)
  if (opts.restoredFrom) summary.unshift('Restored an earlier version')
  const { via, clientApp } = saveSource(ctx)
  const [v] = await ctx.db.insert(profileSiteVersions).values({
    profileId, content: site, savedAt: now, savedBy: ctx.dancerId, via, clientApp, summary, restoredFrom: opts.restoredFrom ?? null,
  }).returning({ id: profileSiteVersions.id })
  await pruneVersions(ctx.db, profileId)
  return { updatedAt: now, unchanged: false, firstSave: !before, versionId: v?.id ?? null, summary }
}

async function pruneVersions(db: any, profileId: string) {
  const keep = await db.select({ id: profileSiteVersions.id }).from(profileSiteVersions)
    .where(eq(profileSiteVersions.profileId, profileId)).orderBy(desc(profileSiteVersions.savedAt)).limit(MAX_SITE_VERSIONS)
  if (keep.length < MAX_SITE_VERSIONS) return
  await db.delete(profileSiteVersions).where(and(
    eq(profileSiteVersions.profileId, profileId),
    notInArray(profileSiteVersions.id, keep.map((k: any) => k.id)),
  ))
}

/** One version of this profile's site (null when it isn't theirs). */
export async function siteVersion(db: any, profileId: string, id: string) {
  const [v] = await db.select().from(profileSiteVersions).where(and(eq(profileSiteVersions.id, id), eq(profileSiteVersions.profileId, profileId)))
  return v ?? null
}
