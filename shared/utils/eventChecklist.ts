/**
 * What an event still lacks, keyed. One list for the web app (labels: the
 * events list, the editor, the business inbox) and the MCP tools (keys, which
 * they turn into "call this tool next" hints).
 */

export type EventGapKey = 'cover' | 'ticket' | 'venue' | 'lineup' | 'artistInstagram' | 'artistPhoto'
export interface EventGap { key: EventGapKey; label: string; handles?: string[] }

export interface GapEvent {
  cover?: string | null
  ticketUrl?: string | null
  price?: string | null
  venueUsername?: string | null
  venueName?: string | null
  artists?: string[] | null
  flyerOptions?: { photos?: Record<string, string | null> } | null
}
export interface GapPerson { photo?: string | null; photos?: { url: string }[] | null; socials?: { platform: string; url: string }[] | null }

const at = (hs: string[]) => hs.map(h => '@' + h).join(', ')

export function eventGaps(e: GapEvent, people: Map<string, GapPerson>): EventGap[] {
  const gaps: EventGap[] = []
  const artists = e.artists ?? []
  if (!e.cover) gaps.push({ key: 'cover', label: 'cover photo' })
  if (!e.ticketUrl && !/free|gratis|frei/i.test(e.price ?? '')) gaps.push({ key: 'ticket', label: 'ticket link or “free”' })
  if (!e.venueUsername && !e.venueName) gaps.push({ key: 'venue', label: 'venue' })
  if (!artists.length) gaps.push({ key: 'lineup', label: 'line-up' })
  const noIg = artists.filter(h => !(people.get(h)?.socials ?? []).some(s => s.platform === 'instagram'))
  if (noIg.length) gaps.push({ key: 'artistInstagram', label: `Instagram for ${at(noIg)}`, handles: noIg })
  const eventPhotos = e.flyerOptions?.photos ?? {}
  const hasPhoto = (h: string) => !!people.get(h)?.photo || (people.get(h)?.photos ?? []).length > 0 || (h in eventPhotos && eventPhotos[h] !== null)
  const noPhoto = artists.filter(h => !hasPhoto(h))
  if (noPhoto.length) gaps.push({ key: 'artistPhoto', label: `photo for ${at(noPhoto)}`, handles: noPhoto })
  return gaps
}
