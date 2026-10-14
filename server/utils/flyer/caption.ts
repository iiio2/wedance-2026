/**
 * Captions, server side: the context a caption is written from — the event
 * (or a content-plan post), tagging only the artists', venue's and host's
 * Instagram on WeDance — and writing one (shared/utils/caption.ts).
 */
import { eq, inArray } from 'drizzle-orm'
import { profiles } from '../../database/schema'
import { flyerSource, texts } from './paint'
import { writeJson } from './gemini'
import { priceLines } from '../../../shared/utils/flyer'
import { captionPrompt, composeCaption, instagramOf, type CaptionContext, type CaptionWords } from '../../../shared/utils/caption'
import type { PostKind } from '../../../shared/utils/posts'

const short = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })

export async function captionContext(db: any, ev: any, post: { kind: PostKind; subject?: string | null } | null = null) {
  const src = await flyerSource(db, ev, post)
  const handles = [...(ev.artists ?? []), ev.venueUsername].filter(Boolean)
  const rows = handles.length ? await db.select({ username: profiles.username, name: profiles.name, address: profiles.address, socials: profiles.socials, styles: profiles.styles }).from(profiles).where(inArray(profiles.username, handles)) : []
  const [host] = ev.hostProfileId ? await db.select({ name: profiles.name, socials: profiles.socials }).from(profiles).where(eq(profiles.id, ev.hostProfileId)) : [null]
  const byHandle = new Map<string, any>(rows.map((r: any) => [r.username, r]))
  const venue = ev.venueUsername ? byHandle.get(ev.venueUsername) : null
  const nameOf = (h: string) => ev.flyerOptions?.names?.[h] || byHandle.get(h)?.name || h
  const sessions = ((ev.festival?.sessions ?? []) as any[]).slice().sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  const who = post?.kind === 'artist' && post.subject ? post.subject : null
  const caption: CaptionContext = {
    title: ev.name ?? '',
    startDate: ev.startDate,
    endDate: ev.endDate,
    timezone: ev.timezone,
    agenda: ev.agenda ?? [],
    styles: ev.styles ?? [],
    prices: priceLines(ev.price),
    host: { name: host?.name ?? '', instagram: instagramOf(host?.socials) },
    venue: venue ? { name: venue.name, address: venue.address, instagram: instagramOf(venue.socials) } : (ev.venueName ? { name: ev.venueName, address: ev.venueAddress, instagram: null } : null),
    artists: (ev.artists ?? []).map((h: string) => ({ name: nameOf(h), instagram: instagramOf(byHandle.get(h)?.socials) })),
    description: ev.description,
    ticketUrl: ev.ticketUrl,
    post: post && post.kind !== 'announcement'
      ? {
          kind: post.kind,
          artist: who ? {
            name: nameOf(who), instagram: instagramOf(byHandle.get(who)?.socials), styles: (byHandle.get(who)?.styles ?? []) as string[],
            sessions: sessions.filter(x => x.artist === who || (x.with ?? []).includes(who)).map(x => `${short(x.date)} ${x.time} ${x.title}`),
          } : null,
          passes: ((ev.festival?.passes ?? []) as any[]).filter(x => x.name).map(x => `${x.name}: ${x.price} €`),
          programme: sessions.filter(x => x.type !== 'party').slice(0, 8).map(x => `${short(x.date)} ${x.time} ${x.title} · ${[x.artist, ...(x.with ?? [])].filter(Boolean).map(nameOf).join(' & ')}`),
        }
      : null,
  }
  // The post's flyer lines: a caption written from other lines is out of date.
  return { caption, lines: texts(src.lines) }
}

/** Gemini writes the hook, call to action and hashtags; the details are fixed lines. */
export async function writeCaption(db: any, ev: any, post: { kind: PostKind; subject?: string | null } | null, language: string) {
  const c = await captionContext(db, ev, post)
  const words = await writeJson<CaptionWords>(captionPrompt(c.caption, language))
  return { language, text: composeCaption(c.caption, language, words), lines: c.lines, writtenAt: new Date().toISOString() }
}
