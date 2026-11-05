/**
 * Images and videos of a hand-built site are often its own files (/images/x.jpg),
 * which only exist on its domain. Hosted sites (sites.wedance.vip/<handle>)
 * draw the same content from another address, so the site API sends such
 * paths as full URLs on the site's domain. On the site itself the result is
 * the same file.
 */
type WithAssets = { image?: string; video?: string; items?: { image?: string }[] }

export function absoluteAsset(url: string | undefined, origin: string | null): string | undefined {
  if (!url || !origin || !url.startsWith('/') || url.startsWith('//')) return url
  return `${origin}${url}`
}

/** The site's origin from its domain field ("https://example.com/" → "https://example.com"), or null. */
export function siteOrigin(domain: string | null | undefined): string | null {
  if (!domain) return null
  try {
    const u = new URL(/^https?:\/\//i.test(domain) ? domain : `https://${domain}`)
    return u.origin
  } catch {
    return null
  }
}

export function absoluteSiteAssets<T extends { sections: WithAssets[]; seo?: { image?: string } }>(site: T, domain: string | null | undefined): T {
  const origin = siteOrigin(domain)
  if (!origin) return site
  return {
    ...site,
    seo: site.seo ? { ...site.seo, image: absoluteAsset(site.seo.image, origin) } : site.seo,
    sections: site.sections.map(s => ({
      ...s,
      image: absoluteAsset(s.image, origin),
      video: absoluteAsset(s.video, origin),
      items: s.items?.map(it => ({ ...it, image: absoluteAsset(it.image, origin) })),
    })),
  }
}
