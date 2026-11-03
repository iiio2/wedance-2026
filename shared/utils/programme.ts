/**
 * An event's programme lives in `events.festival.sessions` for every event
 * type (a party is a one-day festival). The one-line `agenda` ({time, what})
 * is the format from before the programme: still read, never written.
 *
 * Shared by the business editor (BusinessEventForm) and the MCP tools, so an
 * event made in the editor and one made by an AI assistant look the same.
 */
import type { FestivalDetails, FestivalSession, SessionType } from '../types/festivalDetails'
import { SESSION_TYPES } from '../types/festivalDetails'

export { SESSION_TYPES }
export type { SessionType }

export type AgendaLine = { time: string; what: string }
/** The event details container without its server-set key. */
export type EventDetails = Omit<FestivalDetails, 'key'>

/** The details a new event starts with in the editor (empty programme, passes, info). */
export const emptyEventDetails = (): EventDetails => ({ socialLinks: [], practicalInfo: [], passes: [], sessions: [], videos: {} })

/** Agenda lines that look like a party (the rest are workshops). */
export const PARTY = /party|social|dj|concert|show|live|open floor|fiesta|baile/i

/** A new session id: stable once saved (dancers' picks hang on it). */
export const newSessionId = (i = 0) => `s-${Math.random().toString(36).slice(2, 8)}${i}`

/** How each type reads on the page, the editor and the flyer. */
export const SESSION_TYPE_LABEL: Record<SessionType, string> = {
  workshop: 'Workshop', party: 'Party', show: 'Show', concert: 'Concert', doors: 'Doors open', other: 'Other',
}

/** Per-type length in minutes when nothing else tells: doors are a moment, not a slot. */
export const DEFAULT_DURATION: Record<SessionType, number> = {
  workshop: 60, party: 180, show: 60, concert: 90, doors: 0, other: 60,
}

/** A known type, else 'other' ("party" and "workshop" from old data stay as they are). */
export const sessionType = (t: string | null | undefined): SessionType =>
  (SESSION_TYPES as readonly string[]).includes(t ?? '') ? (t as SessionType) : t ? 'other' : 'workshop'

/** A taught class: the only type with a level, a style filter and a partner picker. */
export const isWorkshop = (t: string | null | undefined) => !t || t === 'workshop'

/** The night's programme a party pass covers: everything but classes and doors. */
export const isEveningItem = (t: string | null | undefined) => !isWorkshop(t) && t !== 'doors'

/** Default length in minutes for a type. */
export const defaultDuration = (type: FestivalSession['type']) => DEFAULT_DURATION[sessionType(type)]

const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h! * 60 + m! }
const fromMin = (m: number) => { const x = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}` }
const dayNo = (d: string) => Math.round(new Date(`${d}T00:00:00Z`).getTime() / 86_400_000)

/** Minutes from `start` to `end` (HH:MM); an end at or before the start is past midnight. */
export function minutesUntil(start: string, end: string): number {
  const d = toMin(end) - toMin(start)
  return d > 0 ? d : d + 1440
}

/**
 * An end time written in a title: "Afterparty until 22:00", "bis 1.30",
 * "19:00–20:30". A bare dash needs a colon, so a price ("Entry 5-10.00 €") isn't read as a time.
 */
export function untilInText(text: string | null | undefined): string | null {
  const m = /\b(?:until|till|til|to|bis)\s+(\d{1,2})[:.](\d{2})\b|[–—-]\s*(\d{1,2}):(\d{2})\b/i.exec(text ?? '')
  if (!m) return null
  const hh = m[1] ?? m[3]!; const mm = m[2] ?? m[4]!
  const h = Number(hh); const min = Number(mm)
  return h < 24 && min < 60 ? `${String(h).padStart(2, '0')}:${mm}` : null
}

/** A session before its length is known: duration left out, or an explicit end time. */
export type DraftSession = Omit<FestivalSession, 'duration'> & { duration?: number | null; endTime?: string | null }

/** Longest gap read as "runs until the next item"; past it the type's default is likelier. */
const MAX_INFERRED = 8 * 60

/**
 * Every session's length, filled in where it wasn't given. In order:
 * an explicit end time (`endTime`) → the given duration → "until HH:MM" in the
 * title → doors are a moment (0) → until the next item that day → the
 * event's last item runs until the event's end → the type's default.
 */
export function inferDurations<T extends DraftSession>(
  sessions: T[],
  event: { date?: string | null; endDate?: string | null; endTime?: string | null } = {},
): (Omit<T, 'duration' | 'endTime'> & { duration: number })[] {
  const starts = sessions.map(s => ({ date: s.date, time: clockTime(s.time) })).filter(x => x.time) as { date: string; time: string }[]
  const endDay = event.endDate || event.date || null
  const endTime = clockTime(event.endTime)
  return sessions.map((s) => {
    const { endTime: own, duration: given, ...rest } = s
    const time = clockTime(s.time)
    const fix = (d: number) => ({ ...rest, duration: Math.max(0, Math.min(1440, Math.round(d))) })
    const explicitEnd = clockTime(own)
    if (time && explicitEnd) return fix(minutesUntil(time, explicitEnd))
    if (typeof given === 'number' && Number.isFinite(given)) return fix(given)
    // Only the title: a description's prices and other times would misfire.
    const titled = untilInText(s.title)
    if (time && titled) return fix(minutesUntil(time, titled))
    const type = sessionType(s.type)
    if (type === 'doors' || !time) return fix(DEFAULT_DURATION[type])
    const next = starts.filter(x => x.date === s.date && x.time > time).map(x => x.time).sort()[0]
    if (next) {
      const gap = toMin(next) - toMin(time)
      return fix(gap <= MAX_INFERRED ? gap : DEFAULT_DURATION[type])
    }
    // Only the event's very last item runs until its end (a festival's other days end on their default).
    const last = !starts.some(x => x.date > s.date)
    if (last && endTime && endDay) {
      // The event's end as minutes from this session's day (a night past midnight ends the next day).
      let left = (dayNo(endDay) - dayNo(s.date)) * 1440 + toMin(endTime) - toMin(time)
      if (left <= 0 && !event.endDate) left += 1440
      if (left > 0 && left <= MAX_INFERRED) return fix(left)
    }
    return fix(DEFAULT_DURATION[type])
  })
}

/** When a session ends ("20:30"), or null for a moment (doors open) or no time. */
export function sessionEnd(s: { time: string; duration?: number | null }): string | null {
  const t = clockTime(s.time)
  return t && s.duration ? fromMin(toMin(t) + s.duration) : null
}

/** "19:00–20:30", or "18:00" for a moment. */
export const sessionTimeRange = (s: { time: string; duration?: number | null }) =>
  [s.time, sessionEnd(s)].filter(Boolean).join('–')

/**
 * A session as stored: a known type, and a level only on a workshop (older
 * data put "Beginner" on parties; it never shows).
 */
export function cleanSession<T extends { type: string; level?: FestivalSession['level'] }>(s: T): T & { type: SessionType } {
  const type = sessionType(s.type)
  const { level, ...rest } = s
  return { ...rest, type, ...(isWorkshop(type) && level ? { level } : {}) } as T & { type: SessionType }
}

/** What a session shows next to its title: "Show", or a workshop's style and level. */
export function sessionKindLabel(s: { type?: string | null; style?: string; level?: string | null }): string {
  if (!isWorkshop(s.type)) return SESSION_TYPE_LABEL[sessionType(s.type)]
  return [s.style, s.level].filter(Boolean).join(' · ') || SESSION_TYPE_LABEL.workshop
}

/** "9:00" → "09:00"; anything that isn't a clock time → null. */
export function clockTime(t: string | null | undefined): string | null {
  const s = (t ?? '').trim()
  return /^\d{1,2}:\d{2}$/.test(s) ? s.padStart(5, '0') : null
}

/** The old agenda as programme sessions on the event's day (the editor's "Put it in the programme"). */
export function agendaToSessions(agenda: AgendaLine[], at: { date: string; startTime: string; endDate?: string | null; endTime?: string | null }): FestivalSession[] {
  const drafts: DraftSession[] = agenda.filter(a => a.what?.trim()).map((a, i) => {
    const type = agendaType(a.what)
    return {
      id: newSessionId(i),
      date: at.date,
      time: clockTime(a.time) ?? at.startTime,
      type,
      title: a.what.trim(),
      artist: '',
      style: '',
      ...(type === 'workshop' ? { level: 'Beginner' as const } : {}),
    }
  })
  return inferDurations(drafts, at)
}

/** What an old agenda line is, from its words. */
export function agendaType(what: string): SessionType {
  if (/\bdoors?\b|\beinlass\b|\bentry\b/i.test(what)) return 'doors'
  if (/\bconcert\b|\bkonzert\b|\blive band\b/i.test(what)) return 'concert'
  if (/\bshow\b|\bperformance\b/i.test(what)) return 'show'
  return PARTY.test(what) ? 'party' : 'workshop'
}

/** The old agenda an event still shows as "Your earlier agenda": only while it has no programme. */
export function legacyAgendaOf(e: { agenda?: AgendaLine[] | null; festival?: { sessions?: unknown[] } | null }): AgendaLine[] {
  if (e.festival?.sessions?.length) return []
  return (e.agenda ?? []).filter(a => a.what?.trim())
}

/**
 * The items a "programme" post lists: the classes when there are any (a
 * festival's programme post is its workshop list), else the night's items —
 * show, concert, party — so a party-only event still has a programme. Doors
 * are never listed.
 */
export function programmePostItems<T extends { type?: string | null }>(sessions: T[]): T[] {
  const classes = sessions.filter(s => isWorkshop(s.type))
  return classes.length ? classes : sessions.filter(s => s.type !== 'doors')
}

/** One programme-post line: "Sat 19:00–20:30 · B-FEST show · Ana & Ivan" (a class keeps its plain start time). */
export function programmePostLine(s: { date: string; time: string; duration?: number | null; type?: string | null; title: string }, day: string, who: string): string {
  const when = isWorkshop(s.type) ? s.time : sessionTimeRange(s)
  return [`${day} ${when}`, s.title, who].filter(Boolean).join(' · ')
}
