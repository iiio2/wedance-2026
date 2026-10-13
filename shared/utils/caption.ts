/**
 * The Instagram caption to post with an event's flyer. The organizer adapts it
 * for WhatsApp, Telegram or Facebook themselves.
 *
 * The details are built here, not by Gemini: date, time, the programme one
 * item per line, music, line-up, each price on its own line, the venue with
 * its full address. Asked to lay them out, Gemini merged the programme into
 * the time line and swapped the address for the venue's @handle. Gemini only
 * writes the words around them: a hook line, a call to action and hashtags.
 *
 * Only verified @handles (the artists', venue's and host's Instagram on
 * WeDance) may appear: a made-up handle tags a stranger.
 */

const LANG = {
  en: { name: 'English', locale: 'en-GB', flag: '🇬🇧' },
  de: { name: 'German', locale: 'de-DE', flag: '🇩🇪' },
  es: { name: 'Spanish', locale: 'es-ES', flag: '🇪🇸' },
  ru: { name: 'Russian', locale: 'ru-RU', flag: '🇷🇺' },
} as const
type Lang = keyof typeof LANG

export const LANGUAGES = [
  { value: 'en+de', label: 'English and German' },
  { value: 'en', label: 'English' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'ru', label: 'Russian' },
  { value: 'en+es', label: 'English and Spanish' },
] as const

const langsOf = (value: string): Lang[] => {
  const ls = value.split('+').filter((l): l is Lang => l in LANG)
  return ls.length ? ls : ['en']
}

export type CaptionContext = {
  title: string
  startDate: string | Date
  endDate?: string | Date | null
  timezone?: string | null
  agenda: { time: string; what: string }[]
  styles: string[]
  /** One price per line, as typed. */
  prices: string[]
  host: { name: string; instagram?: string | null }
  venue?: { name: string; address?: string | null; instagram?: string | null } | null
  artists: { name: string; instagram?: string | null }[]
  description?: string | null
  ticketUrl?: string | null
}

/** What Gemini writes: the words around the details. */
export type CaptionWords = { hashtags?: string[] } & Partial<Record<Lang, { hook?: string; cta?: string }>>

// "Yunior (@yuniorflowcubano)"; a profile named after its handle (imported from
// Instagram, "alosha_corazon_cubano") is just "@alosha_corazon_cubano".
const withTag = (name: string, ig?: string | null) => {
  if (!ig) return name
  const same = name.trim().replace(/^@/, '').toLowerCase() === ig.toLowerCase()
  return same ? `@${ig}` : `${name} (@${ig})`
}

/** The fixed detail lines, one fact per line. Dates in the first language. */
export function captionDetails(c: CaptionContext, lang: Lang = 'en'): string[] {
  const tz = c.timezone || 'Europe/Berlin'
  const start = new Date(c.startDate)
  const end = c.endDate ? new Date(c.endDate) : null
  const day = start.toLocaleDateString(LANG[lang].locale, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz })
  const time = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz })
  const venue = c.venue
    ? [withTag(c.venue.name, c.venue.instagram), c.venue.address?.trim()].filter(Boolean).join(', ')
    : null
  return [
    `📅 ${day[0]!.toUpperCase()}${day.slice(1)}`,
    `🕒 ${time(start)}${end && time(end) !== time(start) ? ` – ${time(end)}` : ''}`,
    ...c.agenda.filter(a => a.what.trim()).map(a => `🔸 ${[a.time.trim(), a.what.trim()].filter(Boolean).join(' ')}`),
    c.styles.length ? `🎶 ${c.styles.join(' × ')}` : null,
    c.artists.length ? `🎧 ${c.artists.map(a => withTag(a.name, a.instagram)).join(' · ')}` : null,
    ...c.prices.map(p => `🎟 ${p}`),
    venue ? `📍 ${venue}` : null,
  ].filter(Boolean) as string[]
}

/** Ask Gemini for the hook, call to action and hashtags only, as JSON. */
export function captionPrompt(c: CaptionContext, language: string) {
  const langs = langsOf(language)
  return [
    `You help ${c.host.name} post a dance event on Instagram. The details (date, times, programme, music, line-up, prices, place) are already written. Write only the words around them.`,
    `For each language (${langs.map(l => LANG[l].name).join(', ')}): a "hook" (one short warm sentence inviting people, max 15 words) and a "cta" (one short closing line: tickets and details via the link in bio, and an invitation to come dance).`,
    'Warm, like the organizer talking to their dancers. No hype words ("epic", "unmissable"), no facts that are not below, no dates or times (they are in the details).',
    c.host.instagram ? `You may tag the organizer as @${c.host.instagram} in the hook. No other @handles.` : 'Use no @handles.',
    'Also "hashtags": 5–8 relevant hashtags (city, dance styles, the event), each starting with #.',
    `The event: ${c.title}. Music: ${c.styles.join(', ') || 'social dance'}. Place: ${c.venue?.name ?? ''}${c.venue?.address ? `, ${c.venue.address}` : ''}.`,
    c.description?.trim() ? `About it (for tone): ${c.description.trim().slice(0, 800)}` : null,
    `Reply as JSON: {${langs.map(l => `"${l}": {"hook": "...", "cta": "..."}`).join(', ')}, "hashtags": ["#..."]}`,
  ].filter(Boolean).join('\n\n')
}

/**
 * The caption: hook(s), the details, call(s) to action, hashtags. With two
 * languages the second line of each pair carries its flag; the details, which
 * are mostly names, times and prices, appear once.
 */
export function composeCaption(c: CaptionContext, language: string, words: CaptionWords) {
  const langs = langsOf(language)
  const pair = (k: 'hook' | 'cta') => langs
    .map((l, i) => {
      const t = words[l]?.[k]?.trim()
      return t ? (i ? `${LANG[l].flag} ${t}` : t) : null
    })
    .filter(Boolean)
    .join('\n')
  const hashtags = (words.hashtags ?? [])
    .map(h => `#${String(h).replace(/^#+/, '').replace(/\s+/g, '')}`)
    .filter(h => h.length > 1)
  const allowed = [c.host.instagram, c.venue?.instagram, ...c.artists.map(a => a.instagram)]
  return [
    keepVerifiedMentions(pair('hook'), allowed),
    captionDetails(c, langs[0]).join('\n'),
    keepVerifiedMentions(pair('cta'), allowed),
    [...new Set(hashtags)].slice(0, 8).join(' '),
  ].filter(Boolean).join('\n\n')
}

/**
 * Remove @mentions that aren't verified for this event: "@adrianargudin" →
 * "adrianargudin". Emails and the like (a@b.c) are left alone.
 */
export function keepVerifiedMentions(text: string, allowed: (string | null | undefined)[]) {
  const ok = new Set(allowed.filter(Boolean).map(a => a!.toLowerCase()))
  return text.replace(/(^|[^\w@.])@([A-Za-z0-9._]{1,30})/g, (m, pre, h) => (ok.has(h.toLowerCase().replace(/\.$/, '')) ? m : `${pre}${h}`))
}

/** Instagram handle from a profile's socials ([{ platform, url }]). */
export function instagramOf(socials: { platform: string; url: string }[] | null | undefined) {
  const url = (socials ?? []).find(s => s.platform === 'instagram')?.url
  return url ? url.replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/[/?#].*$/, '').toLowerCase() || null : null
}
