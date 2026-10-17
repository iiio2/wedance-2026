import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { router, protectedProcedure } from '../trpc'
import { profileContacts, profileSites } from '../../database/schema'
import { profileSiteSchema, type ProfileSite } from '../../../shared/types/profileSite'
import { requireMember } from './business'

/**
 * A profile's website and contacts, managed on WeDance (RAZ-412):
 * /business/network/<username>/website edits the page (sections, words in
 * every language, the welcome email), /business/network/<username>/contacts
 * lists who signed up on it. The site reads /api/profiles/<username>/site.
 */
const blank = (): ProfileSite => ({ locales: ['en'], sections: [] })

export const businessSiteRouter = router({
  get: protectedProcedure.input(z.object({ username: z.string().min(1) })).query(async ({ ctx, input }) => {
    const p = await requireMember(ctx, input.username)
    const [row] = await ctx.db.select().from(profileSites).where(eq(profileSites.profileId, p.id))
    return {
      profile: { username: p.username, name: p.name },
      site: (row?.content as ProfileSite | undefined) ?? blank(),
      exists: !!row,
      updatedAt: row?.updatedAt ?? null,
    }
  }),

  save: protectedProcedure
    .input(z.object({ username: z.string().min(1), site: profileSiteSchema }))
    .mutation(async ({ ctx, input }) => {
      const p = await requireMember(ctx, input.username)
      const now = new Date()
      const site = input.site as ProfileSite
      await ctx.db.insert(profileSites).values({ profileId: p.id, content: site, updatedAt: now, updatedBy: ctx.dancerId })
        .onConflictDoUpdate({ target: profileSites.profileId, set: { content: site, updatedAt: now, updatedBy: ctx.dancerId } })
      return { updatedAt: now }
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
