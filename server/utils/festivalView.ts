/**
 * A festival event → the shape the festival page renders (Festival, workshops,
 * teachers in app/types/festival.ts). The event holds the core (name, dates,
 * venue, line-up, description, ticket link), `events.festival` the rest
 * (logo, colour, links, practical info, passes, programme, videos), and the
 * line-up's artist profiles the teachers.
 */
import { and, eq, inArray, like, sql } from 'drizzle-orm'
import { profiles, planItems, profileInvites, profileMembers } from '../database/schema'
import { eventLocalDate } from '../../shared/utils/eventTime'
import type { Festival, Teacher, Workshop } from '../../app/types/festival'
import type { FestivalDetails } from '../../shared/types/festivalDetails'

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' })

export async function festivalView(db: any, ev: any): Promise<{ festival: Festival; workshops: Workshop[]; teachers: Teacher[]; eventId: string }> {
  const f = ev.festival as FestivalDetails
  const tz = ev.timezone || 'Europe/Berlin'
  const handles: string[] = ev.artists ?? []
  const people = handles.length
    ? await db.select({ username: profiles.username, name: profiles.name, photo: profiles.photo, bio: profiles.bio, styles: profiles.styles, socials: profiles.socials, videos: profiles.videos })
      .from(profiles).where(inArray(profiles.username, handles))
    : []
  const byHandle = new Map<string, any>(people.map((p: any) => [p.username, p]))
  // The round badge is a logo: the festival's own, else the brand running it
  // (host profile, then the organizer). Never the flyer: that goes in About.
  const brand = f.logo ? null : await brandLogo(db, ev)

  // "N going" per workshop: dancers' picks, stored as `<key>:<workshop id>`.
  const picks = await db.select({ itemId: planItems.itemId, n: sql<number>`count(*)::int` }).from(planItems)
    .where(and(eq(planItems.itemType, 'workshop'), like(planItems.itemId, `${f.key}:%`)))
    .groupBy(planItems.itemId)
  const going = new Map<string, number>(picks.map((p: any) => [String(p.itemId).slice(f.key.length + 1), p.n]))

  const festival: Festival = {
    name: ev.name ?? '',
    slug: f.key,
    startDate: ev.startDate ? eventLocalDate(ev.startDate, tz) : '',
    endDate: ev.endDate ? eventLocalDate(ev.endDate, tz) : '',
    description: ev.description ?? '',
    logo: f.logo || brand || '',
    flyer: ev.cover || undefined,
    accentColor: f.accentColor || '#d97706',
    socialLinks: f.socialLinks ?? [],
    venue: {
      name: ev.venueName || [ev.city, ev.country].filter(Boolean).join(', ') || 'TBA',
      address: ev.venueAddress || '',
      coordinates: ev.venueLat && ev.venueLng ? { lat: ev.venueLat, lng: ev.venueLng } : undefined,
      practicalInfo: f.practicalInfo ?? [],
    },
    attendeeCount: 0, // the page loads the live count
    ticketUrl: ev.ticketUrl ?? undefined,
    tickets: f.passes ?? [],
  }
  const teachers: Teacher[] = handles.map((h) => {
    const p = byHandle.get(h)
    return {
      id: h,
      name: ev.flyerOptions?.names?.[h] || p?.name || h,
      // The photo picked for this event (null = name only), else their main one.
      photo: (h in (ev.flyerOptions?.photos ?? {}) ? ev.flyerOptions.photos[h] : p?.photo) ?? '',
      bio: p?.bio ?? '',
      styles: p?.styles ?? [],
      // This event's video for them, else the first on their own page.
      ...((f.videos?.[h] || p?.videos?.[0]?.url) ? { videoUrl: f.videos?.[h] || p.videos[0].url } : {}),
      socialLinks: p?.socials ?? [],
    }
  })
  // Confirmed: they said "I'm in" on their link, or their page is run by the
  // organizer's own team. Everyone else shows as "to be confirmed".
  const confirmed = await confirmedArtists(db, ev, handles)
  for (const t of teachers) t.tbc = !confirmed.has(t.id)
  const workshops: Workshop[] = (f.sessions ?? [])
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
    .map(s => ({
      id: s.id,
      title: s.title,
      time: s.time,
      duration: s.duration,
      day: weekday(s.date),
      room: s.room ?? '',
      style: s.style,
      level: s.level,
      teacherId: s.artist,
      ...(s.with?.length ? { withIds: s.with } : {}),
      goingCount: going.get(s.id) ?? 0,
      type: s.type,
      ...(s.venue ? { venue: s.venue } : {}),
      ...(s.description ? { description: s.description } : {}),
    }))
  return { festival, workshops, teachers, eventId: ev.id }
}

/** Line-up handles that have confirmed they're in this event. */
export async function confirmedArtists(db: any, ev: any, handles: string[]): Promise<Set<string>> {
  if (!handles.length) return new Set()
  const ids = await db.select({ id: profiles.id, username: profiles.username }).from(profiles).where(inArray(profiles.username, handles))
  if (!ids.length) return new Set()
  const byId = new Map<string, string>(ids.map((r: any) => [r.id, r.username]))
  const said = await db.select({ profileId: profileInvites.profileId }).from(profileInvites)
    .where(and(eq(profileInvites.eventId, ev.id), eq(profileInvites.status, 'confirmed'), inArray(profileInvites.profileId, [...byId.keys()])))
  const out = new Set<string>(said.map((r: any) => byId.get(r.profileId)!))
  if (ev.hostProfileId) {
    const hostTeam = (await db.select({ dancerId: profileMembers.dancerId }).from(profileMembers).where(eq(profileMembers.profileId, ev.hostProfileId))).map((r: any) => r.dancerId)
    if (hostTeam.length) {
      const own = await db.select({ profileId: profileMembers.profileId }).from(profileMembers)
        .where(and(inArray(profileMembers.profileId, [...byId.keys()]), inArray(profileMembers.dancerId, hostTeam)))
      for (const r of own) out.add(byId.get(r.profileId)!)
    }
  }
  return out
}

async function brandLogo(db: any, ev: any): Promise<string | null> {
  if (ev.hostProfileId) {
    const [p] = await db.select({ photo: profiles.photo }).from(profiles).where(eq(profiles.id, ev.hostProfileId)).limit(1)
    if (p?.photo) return p.photo
  }
  if (ev.organizerUsername) {
    const [p] = await db.select({ photo: profiles.photo }).from(profiles).where(eq(profiles.username, ev.organizerUsername)).limit(1)
    if (p?.photo) return p.photo
  }
  return null
}
