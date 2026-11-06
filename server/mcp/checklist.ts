import type { EventGap } from '../../shared/utils/eventChecklist'

/**
 * What an event still needs before it's worth showing, as next steps for an
 * assistant: each item names the tool that fixes it. Built from the editor's
 * own checklist (businessEvents.get → gaps) plus what only matters to a setup
 * run: the venue as a WeDance page, programme items without an artist, the
 * flyer and the description.
 */

/** `detail` carries user-written text (a venue name, item titles); it's wrapped as untrusted in tool results, so `item` stays fixed wording. */
export interface SetupItem { item: string; tool: string; hint: string; detail?: string }

export interface ChecklistEvent {
  id: string
  venueUsername?: string | null
  venueName?: string | null
  description?: string | null
  gaps?: EventGap[]
  flyer?: { ready: number; painting: number; kept: boolean; latestUrl?: string | null } | null
}
export interface ChecklistSession { title: string; artist?: string | null; with?: string[] }

export function setupChecklist(e: ChecklistEvent, programme: ChecklistSession[], editorUrl: string): SetupItem[] {
  const gaps = new Map((e.gaps ?? []).map(g => [g.key, g]))
  const out: SetupItem[] = []

  if (!e.venueUsername) {
    out.push({
      item: e.venueName ? 'Venue is not a WeDance page' : 'No venue',
      ...(e.venueName ? { detail: e.venueName } : {}),
      tool: 'find_lineup (type venue) / suggest_venues → add_venue → update_event venue_handle',
      hint: 'Search the venue; if it isn’t on WeDance, create it with add_venue (name, address, city, Instagram if known), then set venue_handle.',
    })
  }
  if (gaps.has('lineup')) {
    out.push({
      item: 'No line-up',
      tool: 'find_lineup (type artist) → add_profile_from_instagram → update_event programme',
      hint: 'Take the artists/DJs/performers from the announcement and the organiser’s Instagram. If you find no names, ask the user who performs: don’t leave it empty silently.',
    })
  }
  const bare = programme.filter(s => !s.artist && !(s.with ?? []).length)
  if (programme.length && bare.length) {
    out.push({
      item: 'Programme items without an artist',
      detail: `${bare.map(s => `“${s.title}”`).slice(0, 6).join(', ')}${bare.length > 6 ? ` +${bare.length - 6}` : ''}`,
      tool: 'update_event programme (artist / with)',
      hint: 'Put the handle of who teaches, plays or performs on each such item; doors or breaks can stay empty. Pass the whole programme, keeping item ids.',
    })
  }
  const f = e.flyer
  if (f && !f.kept && !f.ready) {
    out.push(f.painting
      ? { item: 'Flyer is still painting', tool: 'flyer_status', hint: 'Poll flyer_status with the batch_id every 20–30 s, then show the flyer to the user.' }
      : { item: 'No flyer yet', tool: 'flyer_options → make_flyer → flyer_status', hint: 'Fill venue and line-up first (the flyer uses them), then paint one and show it to the user.' })
  }
  if (gaps.has('ticket')) {
    out.push({ item: 'No ticket or registration link', tool: 'update_event ticket_url / price', hint: 'Set ticket_url to the ticket or sign-up form link from the announcement; if it’s free, say so in price.' })
  }
  if (gaps.has('cover')) {
    out.push({
      item: 'No cover image',
      tool: 'update_event cover',
      hint: f?.latestUrl ? `Use the flyer as cover: ${f.latestUrl}` : 'Use the flyer image once it’s ready, or an image URL from the user.',
    })
  }
  if (!(e.description ?? '').trim()) {
    out.push({ item: 'No description', tool: 'update_event description', hint: 'A few lines from the announcement: what the night is, who it’s for, what to bring.' })
  }
  for (const key of ['artistInstagram', 'artistPhoto'] as const) {
    const g = gaps.get(key)
    if (g) out.push({ item: key === 'artistInstagram' ? 'Artists without Instagram' : 'Artists without a photo', detail: (g.handles ?? []).map(h => '@' + h).join(', '), tool: 'web editor', hint: `Add it in the editor (${editorUrl}); the flyer pictures artists that have a photo.` })
  }
  return out
}

/** The line a write returns after the checklist. */
export function setupNext(missing: SetupItem[]): string {
  return missing.length
    ? `It is a draft. Work through "missing" in order without waiting to be asked, then show the user the event (get_my_event) and the flyer. Call publish_event only when the user says so.`
    : 'It is a draft with everything in place. Show it to the user (get_my_event, the flyer) and call publish_event only when they say so.'
}
