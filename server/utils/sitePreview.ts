/**
 * Who sees a profile's website on the public site API: everyone when it's
 * published; while it's a draft, only someone with a preview link signed for
 * this profile (businessSite.previewLink, valid 7 days).
 */
import { isPublished, type ProfileSite } from '../../shared/types/profileSite'
import { SITE_PREVIEW_PURPOSE, SITE_PREVIEW_TTL_S } from '../../shared/utils/hostedSite'
import { signPayload, verifyPayload } from '../oauth/crypto'

export function sitePreviewToken(profileId: string, now = Date.now()) {
  return signPayload(SITE_PREVIEW_PURPOSE, { p: profileId }, SITE_PREVIEW_TTL_S, now)
}

/** visible: answer with the site; preview: it's a valid preview link (never cache, don't index). */
export function siteAccess(content: Pick<ProfileSite, 'published'>, profileId: string, token: string | null | undefined, now = Date.now()) {
  const preview = !!token && verifyPayload<{ p: string }>(SITE_PREVIEW_PURPOSE, token, now)?.p === profileId
  return { visible: isPublished(content) || preview, preview }
}
