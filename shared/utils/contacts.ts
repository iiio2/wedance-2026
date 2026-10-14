/**
 * How to reach a profile, from what WeDance has on it: its links, opening a
 * direct message where the platform allows it (Instagram DM, Messenger,
 * Telegram, WhatsApp), then its website, and for venues from Google Maps their
 * Maps page (phone and opening hours). Used where an organizer sends a link.
 */
import { parseInstagramHandle } from './instagram'

export type Contact = { kind: 'instagram' | 'facebook' | 'telegram' | 'whatsapp' | 'phone' | 'email' | 'website' | 'maps' | 'search'; label: string; url: string }

const ORDER: Contact['kind'][] = ['whatsapp', 'phone', 'email', 'instagram', 'telegram', 'facebook', 'website', 'maps']

export function contactsFor(p: {
  name: string
  username: string
  city?: string | null
  socials?: { platform: string; url: string }[] | null
  /** A venue's booking contacts (only for signed-in organizers). */
  contact?: { phone?: string; email?: string; whatsapp?: string; telegram?: string } | null
  /** A Google Maps link, if that's what the venue's map is. */
  mapUrl?: string | null
}): Contact[] {
  const out: Contact[] = []
  const c = p.contact ?? {}
  const digits = (v: string) => v.replace(/[^\d+]/g, '').replace(/^00/, '+')
  if (c.whatsapp?.trim()) out.push({ kind: 'whatsapp', label: `WhatsApp ${c.whatsapp.trim()}`, url: `https://wa.me/${digits(c.whatsapp).replace(/^\+/, '')}` })
  if (c.phone?.trim()) out.push({ kind: 'phone', label: `Call ${c.phone.trim()}`, url: `tel:${digits(c.phone)}` })
  if (c.email?.trim()) out.push({ kind: 'email', label: `Email ${c.email.trim()}`, url: `mailto:${c.email.trim()}` })
  if (c.telegram?.trim()) {
    const t = c.telegram.trim().replace(/^@/, '').replace(/^https?:\/\/t\.me\//, '')
    out.push({ kind: 'telegram', label: `Telegram @${t}`, url: `https://t.me/${t}` })
  }
  if (p.mapUrl && /(maps\.google\.|google\.[a-z.]+\/maps|goo\.gl\/maps)/i.test(p.mapUrl)) {
    out.push({ kind: 'maps', label: 'Phone and opening hours on Google Maps', url: p.mapUrl })
  }
  for (const s of p.socials ?? []) {
    const url = String(s.url ?? '').trim()
    if (!url) continue
    if (s.platform === 'instagram') {
      const h = parseInstagramHandle(url)
      if (h) out.push({ kind: 'instagram', label: `Message @${h} on Instagram`, url: `https://ig.me/m/${h}` })
    } else if (s.platform === 'facebook') {
      // A page's plain address opens in Messenger; anything else, the page itself.
      const m = url.match(/facebook\.com\/([A-Za-z0-9.\-]+)\/?$/)
      out.push(m && !['profile.php', 'groups', 'events'].includes(m[1]!)
        ? { kind: 'facebook', label: 'Message them on Messenger', url: `https://m.me/${m[1]}` }
        : { kind: 'facebook', label: 'Their Facebook page', url })
    } else if (s.platform === 'telegram') {
      out.push({ kind: 'telegram', label: 'Message them on Telegram', url })
    } else if (s.platform === 'whatsapp') {
      out.push({ kind: 'whatsapp', label: 'Message them on WhatsApp', url })
    } else if (s.platform === 'website') {
      out.push({ kind: 'website', label: `Their website (${url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')})`, url })
    }
  }
  // Venues imported from Google Maps have its place id as their handle.
  if (/^ChIJ[\w-]{10,}$/.test(p.username) && !out.some(x => x.kind === 'maps')) {
    out.push({ kind: 'maps', label: 'Phone and opening hours on Google Maps', url: `https://www.google.com/maps/place/?q=place_id:${p.username}` })
  }
  const seen = new Set<string>()
  const sorted = out.filter(c => (seen.has(c.url) ? false : (seen.add(c.url), true))).sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind))
  if (sorted.length) return sorted
  return [{ kind: 'search', label: `Search for ${p.name}`, url: `https://www.google.com/search?q=${encodeURIComponent([p.name, p.city].filter(Boolean).join(' '))}` }]
}
