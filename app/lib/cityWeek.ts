/**
 * The city page's week logic (/cities/[city]), kept pure so it can be tested
 * with a fixed clock and time zone (RAZ-683, RAZ-693, RAZ-694, RAZ-695).
 *
 * "This week" is Monday–Sunday in the viewer's local calendar. Booked events
 * carry a local `eventDate` (YYYY-MM-DD); synced events carry a UTC instant plus
 * the event's IANA zone and are dated in that zone (shared/utils/eventTime.ts).
 */
import { sameDanceStyle } from '#shared/dance-styles'
import { eventLocalDate } from '#shared/utils/eventTime'

// Local YYYY-MM-DD (never toISOString — that shifts to UTC and, in a positive
// offset like CEST, moves every day back by one, so "this week" ends up a day off).
export const localDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The seven local dates (Mon–Sun) of the week `now` falls in. */
export function weekDateKeys(now: Date = new Date()): Set<string> {
  const off = (now.getDay() + 6) % 7
  const mon = new Date(now); mon.setDate(now.getDate() - off); mon.setHours(0, 0, 0, 0)
  const set = new Set<string>()
  for (let i = 0; i < 7; i++) { const x = new Date(mon); x.setDate(mon.getDate() + i); set.add(localDateKey(x)) }
  return set
}

/** Style filter for the "Coming up" list: no style picked keeps everything. */
export const matchesStyle = (styles: string[] | null | undefined, style: string) =>
  !style || (styles || []).some((s: string) => sameDanceStyle(s, style))

/**
 * Splits the city's booked + synced events into this week and later. Festivals
 * get their own section, so synced festivals stay out of both lists.
 */
export function cityFeed<B extends { eventDate?: unknown; styles?: string[] | null }, S extends { startDate: string | Date; timezone?: string | null; isFestival?: boolean | null; styles?: string[] | null }>(
  booked: B[], synced: S[], week: Set<string>, style = '',
) {
  const weekEnd = [...week].sort().at(-1) ?? ''
  const bookedDate = (b: B) => String(b.eventDate).slice(0, 10)
  const syncedDate = (e: S) => eventLocalDate(e.startDate, e.timezone ?? undefined)
  const nonFestival = synced.filter(e => !e.isFestival)
  return {
    bookedThisWeek: booked.filter(b => b.eventDate && week.has(bookedDate(b))),
    syncedThisWeek: nonFestival.filter(e => week.has(syncedDate(e))),
    syncedLater: nonFestival.filter(e => syncedDate(e) > weekEnd).filter(e => matchesStyle(e.styles, style)),
    bookedLater: booked.filter(b => b.eventDate && bookedDate(b) > weekEnd).filter(b => matchesStyle(b.styles, style)),
  }
}

/** Who has an event this week, per role: venue / organiser @handles and artist names or @handles. */
export function activeThisWeek(
  bookedThisWeek: { venueHandle?: string | null; organizerHandle?: string | null; artists?: unknown[] | null }[],
  syncedThisWeek: { venueId?: string | null; organizerId?: string | null; artists?: unknown[] | null }[],
) {
  const artists = new Set<string>()
  for (const b of [...bookedThisWeek, ...syncedThisWeek]) {
    for (const a of (b.artists || [])) artists.add(String(a).trim().replace(/^@/, '').toLowerCase())
  }
  return {
    venues: new Set([...bookedThisWeek.map(b => b.venueHandle), ...syncedThisWeek.map(e => e.venueId)].filter(Boolean) as string[]),
    organisers: new Set([...bookedThisWeek.map(b => b.organizerHandle), ...syncedThisWeek.map(e => e.organizerId)].filter(Boolean) as string[]),
    artists,
  }
}

export type PeopleTab = 'teachers' | 'djs' | 'organisers' | 'venues'

export function isActiveThisWeek(tab: PeopleTab, p: { id: string; name: string }, active: ReturnType<typeof activeThisWeek>): boolean {
  // A handle counts in whichever role the event names it: many schools are typed
  // "venue" in 2026 but run the events as organiser (and vice versa).
  if (tab === 'venues' || tab === 'organisers') return active.venues.has(p.id) || active.organisers.has(p.id)
  if (tab === 'teachers') {
    const t = active.artists
    return t.has(String(p.id).toLowerCase()) || t.has(String(p.name).trim().toLowerCase())
  }
  return false
}

/** "Coming up": merged later events sorted by date then time, grouped per date, capped at `limit` ("show more"). */
export function groupUpcoming<T extends { date: string; time: string }>(items: T[], limit: number) {
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  const groups: { date: string; label: string; items: T[] }[] = []
  for (const e of sorted.slice(0, limit)) {
    let g = groups.find(x => x.date === e.date)
    if (!g) {
      g = { date: e.date, label: new Date(`${e.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }), items: [] }
      groups.push(g)
    }
    g.items.push(e)
  }
  return groups
}
