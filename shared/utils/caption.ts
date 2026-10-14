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
  /** A content-plan post (shared/utils/posts.ts): its own details and purpose. Unset = the event's flyer. */
  post?: {
    kind: import('./posts').PostKind
    artist?: { name: string; instagram?: string | null; styles?: string[]; sessions?: string[] } | null
    passes?: string[]
    programme?: string[]
  } | null
}

/** What each post's caption is for: steers the hook and call to action. */
const PURPOSE: Record<import('./posts').PostKind, (c: CaptionContext) => string> = {
  announcement: () => 'Announce the event and invite people to come.',
  artist: c => `Announce that ${c.post?.artist?.name ?? 'this artist'} is in the line-up: who they are for dancers, why to come to their workshops or set. Tag them only as given.`,
  lineup: () => 'The full line-up is out: everyone together. Invite people to see who they want to dance with.',
  programme: () => 'The programme is out: the highlights. Invite people to plan their days.',
  passes: () => 'Passes are on sale: invite people to pick theirs before prices go up or they sell out (no invented deadlines).',
  countdown: () => 'One week to go: build the excitement, remind of the date and place.',
  'last-call': () => 'Last tickets: a last friendly push to get a ticket now.',
  thanks: () => 'Thank the dancers, artists, team and venue after the event. No call to buy: the call to action is to follow for the next edition and share photos.',
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
  const loc = LANG[lang].locale
  const ymd = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: tz })
  // Several days (a festival): "Thursday 26 – Sunday 29 November", no time.
  const multi = !!end && ymd(end) > ymd(start) && end.getTime() - start.getTime() > 24 * 3600_000
  const cap = (t: string) => `${t[0]!.toUpperCase()}${t.slice(1)}`
  const day = multi
    ? `${start.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', ...(start.getMonth() !== end!.getMonth() ? { month: 'long' } : {}), timeZone: tz })} – ${end!.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz })}`
    : start.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz })
  const time = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz })
  const venue = c.venue
    ? [withTag(c.venue.name, c.venue.instagram), c.venue.address?.trim()].filter(Boolean).join(', ')
    : null
  const date = `📅 ${cap(day)}`
  const clock = multi ? null : `🕒 ${time(start)}${end && time(end) !== time(start) ? ` – ${time(end)}` : ''}`
  const place = venue ? `📍 ${venue}` : null
  const p = c.post
  if (p && p.kind !== 'announcement') {
    const lineup = c.artists.length ? `🎧 ${c.artists.map(a => withTag(a.name, a.instagram)).join(' · ')}` : null
    const out = (xs: (string | null | undefined)[]) => xs.filter(Boolean) as string[]
    switch (p.kind) {
      case 'artist': return out([
        p.artist ? `✨ ${withTag(p.artist.name, p.artist.instagram)}` : null,
        date,
        ...(p.artist?.sessions ?? []).map(x => `🔸 ${x}`),
        p.artist?.styles?.length ? `🎶 ${p.artist.styles.join(' × ')}` : null,
        place,
      ])
      case 'lineup': return out([date, lineup, place])
      case 'programme': return out([date, ...((p.programme?.length ? p.programme : c.agenda.map(a => `${a.time} ${a.what}`)).map(x => `🔸 ${x}`)), place])
      case 'passes': return out([date, ...((p.passes?.length ? p.passes : c.prices).map(x => `🎟 ${x}`)), place])
      case 'countdown': return out([date, clock, place])
      case 'last-call': return out([date, clock, ...((p.passes?.length ? p.passes : c.prices).map(x => `🎟 ${x}`)), place])
      case 'thanks': return out([lineup, place])
    }
  }
  return [
    date,
    clock,
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
    `This post: ${PURPOSE[c.post?.kind ?? 'announcement'](c)}`,
    `For each language (${langs.map(l => LANG[l].name).join(', ')}): a "hook" (one short warm sentence inviting people, max 15 words) and a "cta" (one short closing line: tickets and details via the link in bio, and an invitation to come dance).`,
    'Warm, like the organizer talking to their dancers. No hype words ("epic", "unmissable"), no facts that are not below, no dates or times (they are in the details).',
    [c.host.instagram && `the organizer as @${c.host.instagram}`, c.post?.artist?.instagram && `the artist as @${c.post.artist.instagram}`].filter(Boolean).length
      ? `You may tag ${[c.host.instagram && `the organizer as @${c.host.instagram}`, c.post?.artist?.instagram && `the artist as @${c.post.artist.instagram}`].filter(Boolean).join(' and ')} in the hook. No other @handles.`
      : 'Use no @handles.',
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
  const allowed = [c.host.instagram, c.venue?.instagram, ...c.artists.map(a => a.instagram), c.post?.artist?.instagram]
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
