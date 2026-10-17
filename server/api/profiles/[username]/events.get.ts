import { useDb } from '../../../utils/db'
import { profileByHandle, profileFeedEvents, siteUrl, type ProfileFeedEvent } from '../../../utils/profileFeed'

export type { ProfileFeedEvent } from '../../../utils/profileFeed'

/**
 * Public feed of a profile's upcoming events, for the profile's own website
 * (e.g. montuno.club reads /api/profiles/montunoclub/events). The events a
 * profile runs (host) or organizes, published and not over, soonest first —
 * so the website shows exactly what the profile shows on WeDance, and every
 * row links back to WeDance for sign-up.
 *
 * Query: ?days=60 (1–180) limits how far ahead.
 */
export default defineEventHandler(async (event): Promise<{ profile: { username: string; name: string; url: string }; events: ProfileFeedEvent[] }> => {
  const profile = await profileByHandle(useDb(), String(getRouterParam(event, 'username') ?? ''))
  if (!profile) throw createError({ statusCode: 404, statusMessage: 'Profile not found' })
  const days = Math.min(180, Math.max(1, Number(getQuery(event).days) || 60))
  setResponseHeaders(event, {
    'access-control-allow-origin': '*',
    'cache-control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=3600',
  })
  return {
    profile: { username: profile.username, name: profile.name, url: `${siteUrl()}/@${profile.username}` },
    events: await profileFeedEvents(useDb(), profile, days),
  }
})
