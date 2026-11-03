/**
 * Co-organisers on an event (#456): the other pages that run it with its
 * organiser, each with an optional role label ("co-organiser", "host"…).
 * Credit only — they get no edit rights (that's the host profile's team).
 * Stored on `events.co_organizers` as [{ username, role? }].
 */

export type CoOrganizer = { username: string; role?: string }

export const CO_ORGANIZERS_MAX = 20
export const CO_ORGANIZER_ROLE_MAX = 40

/**
 * As stored: handles without "@" and lowercased, roles trimmed (empty → none),
 * each page once (the first wins), and never `exclude` (the organiser, the host).
 */
export function cleanCoOrganizers(list: (CoOrganizer | string)[] | null | undefined, exclude: (string | null | undefined)[] = []): CoOrganizer[] {
  const seen = new Set<string>(exclude.filter(Boolean).map(h => h!.toLowerCase()))
  const out: CoOrganizer[] = []
  for (const c of list ?? []) {
    const { username, role } = typeof c === 'string' ? { username: c, role: undefined } : c
    const h = String(username ?? '').trim().replace(/^@/, '').toLowerCase()
    if (!h || seen.has(h)) continue
    seen.add(h)
    const r = String(role ?? '').trim().slice(0, CO_ORGANIZER_ROLE_MAX)
    out.push(r ? { username: h, role: r } : { username: h })
  }
  return out.slice(0, CO_ORGANIZERS_MAX)
}

/** The label shown next to a co-organiser's name. */
export const coOrganizerRole = (c: { role?: string | null }) => c.role?.trim() || 'Co-organiser'
