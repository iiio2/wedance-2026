import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { router, protectedProcedure } from '../trpc'
import { dancers, profileContacts, profileSites, profileSiteVersions } from '../../database/schema'
import { profileSiteSchema, type ProfileSite } from '../../../shared/types/profileSite'
import { requireMember } from './business'
import { profileGroup, trackServer } from '../../utils/posthog'
import { MAX_SITE_VERSIONS, siteVersion, writeSite } from '../../utils/siteVersions'
import { TRPCError } from '@trpc/server'
import { sitePreviewToken } from '../../utils/sitePreview'
import { SITE_PREVIEW_TTL_S, hostedSiteUrl } from '../../../shared/utils/hostedSite'
import { isPublished } from '../../../shared/types/profileSite'

/**
 * A profile's website and contacts, managed on WeDance (RAZ-412):
 * /business/network/<username>/website edits the page (sections, words in
 * every language, the welcome email), /business/network/<username>/contacts
 * lists who signed up on it. The site reads /api/profiles/<username>/site.
 */
// A new site starts as a draft: it's public only once its team presses Publish.
const blank = (): ProfileSite => ({ locales: ['en'], sections: [], published: false })

export const businessSiteRouter = router({
  get: protectedProcedure.input(z.object({ username: z.string().min(1) })).query(async ({ ctx, input }) => {
    const p = await requireMember(ctx, input.username)
    const [row] = await ctx.db.select().from(profileSites).where(eq(profileSites.profileId, p.id))
    const contact = ((p as any).contact ?? {}) as { email?: string; phone?: string }
    return {
      profile: { username: p.username, name: p.name },
      site: (row?.content as ProfileSite | undefined) ?? blank(),
      exists: !!row,
      updatedAt: row?.updatedAt ?? null,
      /** Where WeDance hosts it. */
      hostedUrl: hostedSiteUrl(p.username),
      /** What the page already knows, to fill the site's legal details from. */
      legalHints: { name: p.name ?? '', address: (p as any).address ?? '', email: contact.email ?? '', phone: contact.phone ?? '' },
    }
  }),

  save: protectedProcedure
    .input(z.object({ username: z.string().min(1), site: profileSiteSchema }))
    .mutation(async ({ ctx, input }) => {
      const p = await requireMember(ctx, input.username)
      const site = input.site as ProfileSite
      const r = await writeSite(ctx, p.id, site)
      if (!r.unchanged) trackServer(ctx, 'site_saved', { profile: p.username, profile_type: p.type, first_save: r.firstSave, sections: site.sections?.length ?? 0, locales: site.locales?.length ?? 0, restored: false, ...profileGroup(p.username) })
      return { updatedAt: r.updatedAt, unchanged: r.unchanged, versionId: r.versionId, summary: r.summary }
    }),

  // Version history (0062): newest first, without the content.
  history: protectedProcedure
    .input(z.object({ username: z.string().min(1), limit: z.number().int().min(1).max(MAX_SITE_VERSIONS).default(50) }))
    .query(async ({ ctx, input }) => {
      const p = await requireMember(ctx, input.username)
      const rows = await ctx.db.select({
        id: profileSiteVersions.id, savedAt: profileSiteVersions.savedAt, via: profileSiteVersions.via, clientApp: profileSiteVersions.clientApp,
        summary: profileSiteVersions.summary, restoredFrom: profileSiteVersions.restoredFrom, byName: dancers.name, byId: profileSiteVersions.savedBy,
      }).from(profileSiteVersions).leftJoin(dancers, eq(dancers.id, profileSiteVersions.savedBy))
        .where(eq(profileSiteVersions.profileId, p.id)).orderBy(desc(profileSiteVersions.savedAt)).limit(input.limit)
      return {
        profile: { username: p.username, name: p.name },
        versions: rows.map((r: any, i: number) => ({ ...r, by: r.byId ? { id: r.byId, name: r.byName ?? 'Someone' } : null, byId: undefined, byName: undefined, current: i === 0 })),
      }
    }),

  /** One version's full content (to look at it before restoring). */
  version: protectedProcedure
    .input(z.object({ username: z.string().min(1), id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const p = await requireMember(ctx, input.username)
      const v = await siteVersion(ctx.db, p.id, input.id)
      if (!v) throw new TRPCError({ code: 'NOT_FOUND', message: 'No such version of this website.' })
      return { id: v.id, savedAt: v.savedAt, summary: v.summary, site: v.content as ProfileSite }
    }),

  /** Put an earlier version live again — saved as a new version, so it can be undone too. */
  restore: protectedProcedure
    .input(z.object({ username: z.string().min(1), id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const p = await requireMember(ctx, input.username)
      const v = await siteVersion(ctx.db, p.id, input.id)
      if (!v) throw new TRPCError({ code: 'NOT_FOUND', message: 'No such version of this website.' })
      const site = v.content as ProfileSite
      const r = await writeSite(ctx, p.id, site, { restoredFrom: v.id })
      if (!r.unchanged) trackServer(ctx, 'site_saved', { profile: p.username, profile_type: p.type, first_save: false, sections: site.sections?.length ?? 0, locales: site.locales?.length ?? 0, restored: true, ...profileGroup(p.username) })
      return { updatedAt: r.updatedAt, unchanged: r.unchanged, versionId: r.versionId, restoredFrom: v.id, summary: r.summary }
    }),

  /**
   * Where the site lives on WeDance (sites.wedance.vip/<handle>) and a link
   * that shows it even while it's a draft — for the page's team, valid 7 days.
   */
  previewLink: protectedProcedure.input(z.object({ username: z.string().min(1) })).query(async ({ ctx, input }) => {
    const p = await requireMember(ctx, input.username)
    const [row] = await ctx.db.select({ content: profileSites.content }).from(profileSites).where(eq(profileSites.profileId, p.id))
    const token = sitePreviewToken(p.id)
    const url = hostedSiteUrl(p.username)
    return {
      url,
      previewUrl: `${url}?preview=${encodeURIComponent(token)}`,
      published: row ? isPublished(row.content as any) : false,
      exists: !!row,
      expiresAt: new Date(Date.now() + SITE_PREVIEW_TTL_S * 1000),
    }
  }),

  contacts: protectedProcedure.input(z.object({ username: z.string().min(1) })).query(async ({ ctx, input }) => {
    const p = await requireMember(ctx, input.username)
    return ctx.db.select().from(profileContacts).where(eq(profileContacts.profileId, p.id)).orderBy(desc(profileContacts.createdAt)).limit(2000)
  }),

  updateContact: protectedProcedure
    .input(z.object({ username: z.string().min(1), id: z.string().uuid(), note: z.string().max(2000).optional(), status: z.enum(['subscribed', 'unsubscribed']).optional() }))
    .mutation(async ({ ctx, input }) => {
      const p = await requireMember(ctx, input.username)
      await ctx.db.update(profileContacts)
        .set({ ...(input.note !== undefined ? { note: input.note } : {}), ...(input.status ? { status: input.status } : {}), updatedAt: new Date() })
        .where(and(eq(profileContacts.id, input.id), eq(profileContacts.profileId, p.id)))
      return { ok: true }
    }),

  removeContact: protectedProcedure
    .input(z.object({ username: z.string().min(1), id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const p = await requireMember(ctx, input.username)
      await ctx.db.delete(profileContacts).where(and(eq(profileContacts.id, input.id), eq(profileContacts.profileId, p.id)))
      return { ok: true }
    }),
})
