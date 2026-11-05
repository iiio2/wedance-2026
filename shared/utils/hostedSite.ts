/**
 * Where WeDance hosts a profile's website (hosted websites v1):
 * sites.wedance.vip/<handle>, /<lang>/<handle> in other languages.
 */
export const SITES_URL = 'https://sites.wedance.vip'

export function hostedSiteUrl(handle: string, lang?: string, main = 'en') {
  return `${SITES_URL}${lang && lang !== main && lang !== 'en' ? `/${lang}` : ''}/${handle}`
}

/** Preview links are signed for this purpose (server/oauth/crypto signPayload), valid this long. */
export const SITE_PREVIEW_PURPOSE = 'site-preview'
export const SITE_PREVIEW_TTL_S = 7 * 24 * 3600
