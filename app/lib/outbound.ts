/**
 * `outbound_click` classification (tracking plan C3). Pure so it is unit-tested;
 * the delegated listener lives in plugins/06.outbound-click.client.ts.
 *
 * Privacy: only the link's HOST and a coarse `kind` ever leave the browser —
 * never the path or query (a wa.me number, an Instagram handle, a ticket
 * order token). mailto:/tel: links report the kind only.
 */
export type OutboundKind =
  | 'ticket' | 'website' | 'instagram' | 'facebook' | 'youtube' | 'tiktok'
  | 'map' | 'whatsapp' | 'telegram' | 'community_group' | 'email' | 'phone' | 'streaming'

export interface OutboundLink {
  kind: OutboundKind
  /** The platform the link points at, from its host (whatsapp, instagram, …). */
  platform: OutboundKind
  /** Lowercased host without `www.`; null for mailto:/tel:. */
  host: string | null
}

const BY_HOST: Array<[RegExp, OutboundKind]> = [
  [/(^|\.)instagram\.com$|(^|\.)instagr\.am$/, 'instagram'],
  [/(^|\.)facebook\.com$|(^|\.)fb\.me$|(^|\.)fb\.com$/, 'facebook'],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, 'youtube'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)wa\.me$|(^|\.)whatsapp\.com$/, 'whatsapp'],
  [/(^|\.)t\.me$|(^|\.)telegram\.me$|(^|\.)telegram\.org$/, 'telegram'],
  [/(^|\.)spotify\.com$|(^|\.)soundcloud\.com$|(^|\.)mixcloud\.com$/, 'streaming'],
  [/^maps\.app\.goo\.gl$|^maps\.google\.|^maps\.apple\.com$|(^|\.)openstreetmap\.org$|^goo\.gl$/, 'map'],
  [/(^|\.)tickettailor\.com$|(^|\.)eventbrite\.[a-z.]+$|(^|\.)checkout\.stripe\.com$|(^|\.)pretix\.eu$|(^|\.)eventim\.[a-z.]+$|(^|\.)ticketmaster\.[a-z.]+$|(^|\.)universe\.com$|(^|\.)tito\.io$|(^|\.)ti\.to$/, 'ticket'],
]

function platformOf(host: string, path: string): OutboundKind {
  // google.com/maps/… is a map; any other google.com page is a website.
  if (/(^|\.)google\.[a-z.]+$/.test(host) && path.startsWith('/maps')) return 'map'
  if (host === 'goo.gl' && !path.startsWith('/maps')) return 'website'
  for (const [re, kind] of BY_HOST) if (re.test(host)) return kind
  return 'website'
}

/**
 * The outbound link behind `href`, or null when it stays on WeDance (same host,
 * relative, hash, javascript:). `kindOverride` comes from `data-outbound-kind`
 * (e.g. a festival's own ticket shop on its website host → 'ticket').
 */
export function classifyOutbound(href: string | null | undefined, currentHost: string, kindOverride?: string | null): OutboundLink | null {
  if (!href) return null
  const raw = href.trim()
  if (/^mailto:/i.test(raw)) return { kind: (kindOverride as OutboundKind) || 'email', platform: 'email', host: null }
  if (/^tel:/i.test(raw)) return { kind: (kindOverride as OutboundKind) || 'phone', platform: 'phone', host: null }
  if (/^whatsapp:/i.test(raw)) return { kind: (kindOverride as OutboundKind) || 'whatsapp', platform: 'whatsapp', host: null }
  let url: URL
  try { url = new URL(raw, `https://${currentHost}/`) }
  catch { return null }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  const host = url.hostname.toLowerCase().replace(/^www\./, '')
  const here = currentHost.toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '')
  if (!host || host === here) return null
  const platform = platformOf(host, url.pathname)
  return { kind: (kindOverride as OutboundKind) || platform, platform, host }
}

/** Who sells a festival's tickets, for `ticket_cta_click.provider`. */
export function ticketProvider(href: string | null | undefined): 'tickettailor' | 'stripe' | 'external' {
  let host = ''
  try { host = new URL(String(href || ''), 'https://x.invalid/').hostname.toLowerCase() }
  catch { return 'external' }
  if (/(^|\.)tickettailor\.com$/.test(host)) return 'tickettailor'
  if (/(^|\.)checkout\.stripe\.com$|(^|\.)buy\.stripe\.com$/.test(host)) return 'stripe'
  return 'external'
}
