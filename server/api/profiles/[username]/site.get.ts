import { eq } from 'drizzle-orm'
import { useDb } from '../../../utils/db'
import { profileSites, profiles } from '../../../database/schema'
import { profileByHandle, profileFeedEvents, siteUrl } from '../../../utils/profileFeed'
import { isPublished, resolveSite, type ProfileSite } from '../../../../shared/types/profileSite'
import { resolveTheme } from '../../../../shared/utils/siteThemes'
import { siteAccess } from '../../../utils/sitePreview'
import { absoluteSiteAssets } from '../../../../shared/utils/siteAssets'
import { sizedImage, IMG } from '../../../../shared/utils/image'

/**
 * A profile's website in one language (RAZ-412): its sections and words as
 * edited on WeDance (/business/network/<username>/website), plus the upcoming
 * events the page's "events" sections list. The site renders this and nothing
 * else, so changing the page is changing it here.
 *
 * Query: ?lang=de (falls back to the site's first language).
 */
export default defineEventHandler(async (event) => {
  const db = useDb()
  const profile = await profileByHandle(db, String(getRouterParam(event, 'username') ?? ''))
  if (!profile) throw createError({ statusCode: 404, statusMessage: 'Profile not found' })
  const [row] = await db.select({ content: profileSites.content, updatedAt: profileSites.updatedAt }).from(profileSites).where(eq(profileSites.profileId, profile.id))
  if (!row) throw createError({ statusCode: 404, statusMessage: 'This profile has no website on WeDance yet' })
  const content = row.content as ProfileSite
  // A draft shows only with a preview link from its team (businessSite.previewLink).
  const { visible, preview } = siteAccess(content, profile.id, String(getQuery(event).preview || ''))
  if (!visible) throw createError({ statusCode: 404, statusMessage: 'This website isn’t published yet' })

  // The site's own files (/images/x.jpg) as full URLs on its domain, so a hosted copy shows them too.
  const site = absoluteSiteAssets(resolveSite(content, String(getQuery(event).lang || '')), content.domain)
  // For the site's header and footer: city, photo, public social links.
  const [extra] = await db.select({ city: profiles.city, photo: profiles.photo, socials: profiles.socials }).from(profiles).where(eq(profiles.id, profile.id))
  const days = Math.max(35, ...site.sections.filter(s => s.kind === 'events').map(s => s.days ?? 35))
  setResponseHeaders(event, {
    'access-control-allow-origin': '*',
    // Short, so an edit shows within a minute; the CDN serves it in between. A preview is never cached.
    'cache-control': preview ? 'private, no-store' : 'public, max-age=60, s-maxage=60, stale-while-revalidate=600',
  })
  return {
    profile: {
      username: profile.username,
      name: profile.name,
      url: `${siteUrl()}/@${profile.username}`,
      city: extra?.city ?? null,
      photo: sizedImage(extra?.photo, IMG.card) ?? null,
      socials: ((extra?.socials ?? []) as { platform: string; url: string }[]).filter(x => /^https?:\/\//i.test(x?.url ?? '')),
    },
    ...site,
    updatedAt: row.updatedAt,
    events: await profileFeedEvents(db, profile, days),
    /** The look of a WeDance-hosted site; absent for hand-built ones (they keep their own). */
    theme: resolveTheme(content.theme),
    published: isPublished(content),
    /** This answer is a preview of a draft (don't index it). */
    preview: preview || undefined,
    /** Where the site's sign-up form posts. */
    contactsUrl: `${siteUrl()}/api/profiles/${profile.username}/contacts`,
  }
})
