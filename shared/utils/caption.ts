/**
 * The Instagram caption to post with an event's flyer, written by Gemini from
 * the same lines the flyer carries. The organizer adapts it for WhatsApp,
 * Telegram or Facebook themselves.
 *
 * Only verified @handles (the artists', venue's and host's Instagram on
 * WeDance) may appear: a made-up handle tags a stranger.
 */
export const LANGUAGES = [
  { value: 'en+de', label: 'English, then German', prompt: 'English first, then the German version after a line with 🇩🇪.' },
  { value: 'en', label: 'English', prompt: 'English.' },
  { value: 'de', label: 'German', prompt: 'German.' },
  { value: 'es', label: 'Spanish', prompt: 'Spanish.' },
  { value: 'ru', label: 'Russian', prompt: 'Russian.' },
  { value: 'en+es', label: 'English, then Spanish', prompt: 'English first, then the Spanish version after a line with 🇪🇸.' },
] as const

export type CaptionContext = {
  lines: string[]
  host: { name: string; instagram?: string | null }
  venue?: { name: string; instagram?: string | null } | null
  artists: { name: string; instagram?: string | null }[]
  description?: string | null
  eventUrl: string
  ticketUrl?: string | null
}

/** The prompt for the caption; Gemini replies with the caption text only. */
export function captionPrompt(c: CaptionContext, language: string) {
  const lang = LANGUAGES.find(l => l.value === language) ?? LANGUAGES[0]
  const tags = [
    ...c.artists.filter(a => a.instagram).map(a => `${a.name}: @${a.instagram}`),
    c.venue?.instagram ? `venue ${c.venue.name}: @${c.venue.instagram}` : null,
    c.host.instagram ? `organizer ${c.host.name}: @${c.host.instagram}` : null,
  ].filter(Boolean)
  return [
    `Write the Instagram caption for a dance event by ${c.host.name}, to post with its flyer. Language: ${lang.prompt}`,
    'Warm and inviting, like the organizer talking to their dancers. No hype words ("epic", "unmissable"), no invented facts: use only what is below. 24h times, spell every name exactly as given (umlauts and accents included).',
    'Shape: a short hook line first. Then the details as short lines, each starting with one fitting emoji: date, times and programme, music, who is playing or teaching, entry, place. Say where to get tickets or details as "link in bio" (links are not clickable in captions). End with a short call to action, then 5–8 relevant hashtags on the last line.',
    `The event, exactly as on the flyer:\n${c.lines.map(l => `- ${l}`).join('\n')}`,
    c.description?.trim() ? `About the event (for tone and extra detail): ${c.description.trim().slice(0, 1500)}` : null,
    c.ticketUrl ? 'There is a ticket link (in bio).' : null,
    tags.length ? `Tag these verified Instagram accounts with @ where they fit — the only @handles you may use: ${tags.join('; ')}.` : 'There are no verified Instagram accounts: write names without @.',
    'Never make up an @handle. Write anyone else by name, without @.',
    'Return only the caption text.',
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
