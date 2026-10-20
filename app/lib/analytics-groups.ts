/**
 * PostHog group analytics: the organisation (business profile) a page is
 * about when the dancer is working FOR it — the Business mode pages under
 * /business/network/<username>/… Lets insights count organisations, not
 * people. The public /@handle page groups only for its managers (in the page).
 */
export function organiserProfileFromPath(path: string): string | null {
  const m = /^\/business\/network\/([^/?#]+)/.exec(path)
  if (!m) return null
  try { return decodeURIComponent(m[1]!) }
  catch { return null }
}
