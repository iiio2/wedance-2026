/**
 * Event URLs, Medium-style: /events/<name>-<short id>, e.g.
 * /events/la-clave-thursday-1ed1a238. The 8 characters are the start of the
 * event's id and are what finds it; the name in front is only for people. So a
 * renamed or rescheduled event keeps working links (the page redirects to the
 * current name), and two events with the same name never collide. Old
 * /events/<uuid> links redirect too.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const isUuid = (s: string) => UUID.test(s)

// Long titles ("Cantina Salsa After Work: Salsa Cubana, Timba, Son, Bachata,
// Kizomba…") keep their first words, cut at a word, about 40 characters.
const MAX = 40
function words(name: string | null | undefined) {
  const w = (name ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (w.length <= MAX) return w
  const cut = w.slice(0, MAX + 1)
  const at = cut.lastIndexOf('-')
  return (at > 15 ? cut.slice(0, at) : w.slice(0, MAX)).replace(/-+$/, '')
}

/** "La Clave Thursday" + 1ed1a238-… → "la-clave-thursday-1ed1a238". */
export function eventSlug(e: { id: string; name?: string | null }) {
  const short = e.id.slice(0, 8).toLowerCase()
  const w = words(e.name)
  return w ? `${w}-${short}` : short
}

/** The public link to an event. */
export const eventPath = (e: { id: string; name?: string | null }) => `/events/${eventSlug(e)}`

/** What finds the event in a URL: the full id, or the 8-character short id at the end. */
export function eventKey(param: string): { id: string } | { short: string } | null {
  if (isUuid(param)) return { id: param.toLowerCase() }
  const short = param.toLowerCase().match(/(?:^|-)([0-9a-f]{8})$/)?.[1]
  return short ? { short } : null
}

// Festivals are events: /events/<festival key> finds the festival and switches
// to its current URL.
export const festivalPath = (key: string) => `/events/${key}`
