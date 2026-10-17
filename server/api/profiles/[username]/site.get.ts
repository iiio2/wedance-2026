import { eq } from 'drizzle-orm'
import { useDb } from '../../../utils/db'
import { profileSites } from '../../../database/schema'
import { profileByHandle, profileFeedEvents, siteUrl } from '../../../utils/profileFeed'
import { resolveSite, type ProfileSite } from '../../../../shared/types/profileSite'

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

  const site = resolveSite(row.content as ProfileSite, String(getQuery(event).lang || ''))
  const days = Math.max(35, ...site.sections.filter(s => s.kind === 'events').map(s => s.days ?? 35))
  setResponseHeaders(event, {
    'access-control-allow-origin': '*',
    // Short, so an edit shows within a minute; the CDN serves it in between.
    'cache-control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=600',
  })
  return {
    profile: { username: profile.username, name: profile.name, url: `${siteUrl()}/@${profile.username}` },
    ...site,
    updatedAt: row.updatedAt,
    events: await profileFeedEvents(db, profile, days),
    /** Where the site's sign-up form posts. */
    contactsUrl: `${siteUrl()}/api/profiles/${profile.username}/contacts`,
  }
})
