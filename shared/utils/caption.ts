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
  /** The flyer's lines with their labels (title, date, time, agenda, …). */
  lines: { label: string; text: string }[]
  host: { name: string; instagram?: string | null }
  venue?: { name: string; address?: string | null; instagram?: string | null } | null
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
  const by = (label: string) => c.lines.filter(l => l.label === label).map(l => l.text)
  const agenda = by('agenda')
  // The flyer joins prices with " · "; the caption puts each on its own line.
  const prices = by('entry').flatMap(t => t.split(' · ')).filter(Boolean)
  return [
    `Write the Instagram caption for a dance event by ${c.host.name}, to post with its flyer. Language: ${lang.prompt}`,
    'Warm and inviting, like the organizer talking to their dancers. No hype words ("epic", "unmissable"), no invented facts: use only what is below. 24h times, spell every name exactly as given (umlauts and accents included).',
    [
      'Shape, each detail on its own line starting with one fitting emoji:',
      '1. A short hook line.',
      '2. The date, then the overall time.',
      agenda.length ? '3. The programme: one line per item, in order, time first, exactly as listed. Never merge items into one line or into the time line.' : null,
      '4. The music. 5. Who is playing or teaching. 6. Entry, one line per price.',
      '7. The place: the venue name and its full address.',
      'Then say where to get tickets or details as "link in bio" (links are not clickable in captions), a short call to action, and 5–8 relevant hashtags on the last line.',
    ].filter(Boolean).join('\n'),
    [
      'The event, exactly as on the flyer:',
      ...by('title').map(t => `Title: ${t}`),
      ...by('date').map(t => `Date: ${t}`),
      ...by('time').map(t => `Time: ${t}`),
      ...(agenda.length ? ['Programme (one line each):', ...agenda.map(t => `  - ${t}`)] : []),
      ...by('music').map(t => `Music: ${t}`),
      ...by('line-up').map(t => `Line-up: ${t}`),
      ...prices.map(t => `Entry: ${t}`),
      c.venue ? `Place: ${[c.venue.name, c.venue.address].filter(Boolean).join(', ')}` : by('venue').map(t => `Place: ${t}`)[0] ?? null,
    ].filter(Boolean).join('\n'),
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
