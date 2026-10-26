/**
 * The event RSVP as the organiser's own poll (RAZ-718). Instead of a yes/no
 * "Going?", one tap answers coming or not, alone or not, and which side:
 *
 *   Yes, with my partner · Yes, I need a leader · Yes, I need a follower · Next time
 *
 * Non-partner styles get "Yes · Yes, with a friend · Next time" (stored as
 * `yes` / `partner` / `next`). The event page and the organiser view count the
 * same buckets, so the numbers match everywhere.
 *
 * Decisions (open in the issue, picked here):
 * - "With my partner" / "with a friend" counts as two people coming; the
 *   partner doesn't need to answer separately.
 * - Pairing needs only a wave (no mutual accept).
 * - An unconfirmed answer (no account yet) counts for UNCONFIRMED_TTL_HOURS
 *   after it was given, then drops out of the counts.
 */
import { findDanceStyle } from '../dance-styles'

export const RSVP_ANSWERS = ['partner', 'needLeader', 'needFollower', 'yes', 'next'] as const
export type RsvpAnswer = typeof RSVP_ANSWERS[number]

export function isRsvpAnswer(v: unknown): v is RsvpAnswer {
  return typeof v === 'string' && (RSVP_ANSWERS as readonly string[]).includes(v)
}

/** An unconfirmed answer stops counting this long after it was given. */
export const UNCONFIRMED_TTL_HOURS = 48

// Partner dances: whole families, plus the partnered styles of mixed families.
const PARTNER_FAMILIES = new Set(['salsa', 'bachata', 'kizomba', 'swing', 'tango', 'ballroom'])
const PARTNER_STYLES = new Set([
  'casino', 'rueda', 'son', 'cha-cha-cha', 'danzon', 'bolero',
  'zouk', 'lambada', 'forro', 'merengue', 'cumbia', 'compas', 'zouk-love',
])

/** Does the event dance in couples (so leader / follower makes sense)? */
export function isPartnerEvent(styles: readonly string[] | null | undefined): boolean {
  return (styles ?? []).some((s) => {
    const st = findDanceStyle(s)
    return !!st && (PARTNER_FAMILIES.has(st.family) || PARTNER_STYLES.has(st.id))
  })
}

export interface RsvpOption { id: RsvpAnswer; label: string; short: string }

/** The poll's options, in order, for a partner or a non-partner event. */
export function rsvpOptions(partner: boolean): RsvpOption[] {
  return partner
    ? [
        { id: 'partner', label: 'Yes, with my partner', short: 'With my partner' },
        { id: 'needLeader', label: 'Yes, I need a leader', short: 'Need a leader' },
        { id: 'needFollower', label: 'Yes, I need a follower', short: 'Need a follower' },
        { id: 'next', label: 'Next time', short: 'Next time' },
      ]
    : [
        { id: 'yes', label: 'Yes', short: 'Coming' },
        { id: 'partner', label: 'Yes, with a friend', short: 'With a friend' },
        { id: 'next', label: 'Next time', short: 'Next time' },
      ]
}

export type RsvpCounts = Record<RsvpAnswer, number>

export interface RsvpSummary {
  counts: RsvpCounts
  /** Answers given without an account yet (already inside `counts`). */
  unconfirmed: number
  /** People coming: "with my partner" counts as two. */
  coming: number
  /** > 0: that many more dancers need a leader than a follower (leaders short); < 0: followers short. */
  balance: number
}

export function summarizeRsvps(rows: readonly { answer: RsvpAnswer; confirmed: boolean }[]): RsvpSummary {
  const counts = Object.fromEntries(RSVP_ANSWERS.map(a => [a, 0])) as RsvpCounts
  let unconfirmed = 0
  for (const r of rows) {
    if (!isRsvpAnswer(r.answer)) continue
    counts[r.answer]++
    if (!r.confirmed) unconfirmed++
  }
  return {
    counts,
    unconfirmed,
    coming: counts.partner * 2 + counts.needLeader + counts.needFollower + counts.yes,
    balance: counts.needLeader - counts.needFollower,
  }
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/**
 * The organiser's one-line read of the poll, e.g.
 * "9 coming · 1 unconfirmed · 2 with a partner · 3 need a leader · 2 need a follower · 3 next time → 1 leader short".
 */
export function rsvpSummaryLine(s: RsvpSummary, partner: boolean): string {
  const parts = [`${s.coming} coming`]
  if (s.unconfirmed) parts.push(`${s.unconfirmed} unconfirmed`)
  if (partner) {
    parts.push(`${s.counts.partner} with a partner`, `${s.counts.needLeader} need a leader`, `${s.counts.needFollower} need a follower`)
  } else {
    parts.push(`${s.counts.yes} alone`, `${s.counts.partner} with a friend`)
  }
  parts.push(`${s.counts.next} next time`)
  let line = parts.join(' · ')
  if (partner && s.balance > 0) line += ` → ${plural(s.balance, 'leader', 'leaders')} short`
  else if (partner && s.balance < 0) line += ` → ${plural(-s.balance, 'follower', 'followers')} short`
  return line
}

/** The answer that pairs with mine: "I need a leader" ↔ "I need a follower". */
export function pairingAnswer(a: RsvpAnswer | null | undefined): RsvpAnswer | null {
  return a === 'needLeader' ? 'needFollower' : a === 'needFollower' ? 'needLeader' : null
}
