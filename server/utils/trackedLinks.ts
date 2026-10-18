import { randomBytes } from 'node:crypto'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { events, trackedLinkActions, trackedLinks } from '../database/schema'
import { eventPath } from '../../shared/utils/eventSlug'

/**
 * Promoter tracked links (MCP phase 2). A promoter or influencer page gets one
 * link per event: /events/<slug>?via=<code>. Opening it stores the code in the
 * `wd_via` cookie (app/plugins/tracked-link.client.ts) and counts a visit; the
 * sign-up, plan and ticket paths then credit the link in the cookie (last touch)
 * through recordLinkAction. A plan add or a ticket counts only for the link's
 * own event; a sign-up counts for whichever link brought the person.
 *
 * Kept apart from `referrals` on purpose: a referral is dancer → dancer for one
 * festival with a discount and a credit; a tracked link is page → event and
 * also counts people before they have an account.
 */

type Db = any
export type LinkActionKind = 'visit' | 'signup' | 'plan_add' | 'ticket'
export const VIA_COOKIE = 'wd_via'
export const VIA_PARAM = 'via'

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
/** 8 characters, no look-alikes (0/o, 1/l/i). */
export function newLinkCode(): string {
  const bytes = randomBytes(8)
  return Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join('')
}
export const isLinkCode = (s: unknown): s is string => typeof s === 'string' && /^[a-z2-9]{8}$/.test(s)

export const linkUrl = (origin: string, ev: { id: string; name?: string | null }, code: string) =>
  `${origin}${eventPath(ev)}?${VIA_PARAM}=${code}`

export const qrUrls = (origin: string, code: string) => ({ svg: `${origin}/api/qr/${code}.svg`, png: `${origin}/api/qr/${code}.png` })

/** The event a festival key/slug belongs to (plan items and tickets use the key). */
export async function eventIdForFestival(db: Db, key: string): Promise<string | null> {
  const [ev] = await db.select({ id: events.id }).from(events)
    .where(sql`${events.slug} = ${key} OR ${events.festival}->>'key' = ${key}`).limit(1)
  return ev?.id ?? null
}

/**
 * Credit a link with an action. Best-effort: never throws, and an unknown code,
 * another event's plan add or a repeat counts nothing. Returns whether it counted.
 */
export async function recordLinkAction(db: Db, code: string | null | undefined, kind: LinkActionKind, who: { dancerId?: string | null; visitorId?: string | null; eventId?: string | null; ref?: string | null }): Promise<boolean> {
  if (!isLinkCode(code)) return false
  if (!who.dancerId && !who.visitorId) return false
  try {
    const [link] = await db.select({ id: trackedLinks.id, eventId: trackedLinks.eventId }).from(trackedLinks).where(eq(trackedLinks.code, code))
    if (!link) return false
    if ((kind === 'plan_add' || kind === 'ticket') && who.eventId !== link.eventId) return false
    const rows = await db.insert(trackedLinkActions).values({
      linkId: link.id, kind, dancerId: who.dancerId ?? null, visitorId: who.dancerId ? null : who.visitorId ?? null, ref: who.ref ?? null,
    }).onConflictDoNothing().returning({ id: trackedLinkActions.id })
    return rows.length > 0
  } catch (e) {
    console.error('[tracked-links] could not record', kind, (e as Error).message)
    return false
  }
}

export interface LinkCounts { visits: number; signups: number; planAdds: number; tickets: number }
const EMPTY: LinkCounts = { visits: 0, signups: 0, planAdds: 0, tickets: 0 }
const FIELD: Record<LinkActionKind, keyof LinkCounts> = { visit: 'visits', signup: 'signups', plan_add: 'planAdds', ticket: 'tickets' }

/** Counts per link id. */
export async function linkCounts(db: Db, linkIds: string[]): Promise<Map<string, LinkCounts>> {
  const out = new Map<string, LinkCounts>(linkIds.map(id => [id, { ...EMPTY }]))
  if (!linkIds.length) return out
  const rows = await db.select({ linkId: trackedLinkActions.linkId, kind: trackedLinkActions.kind, n: sql<number>`count(*)::int` })
    .from(trackedLinkActions).where(inArray(trackedLinkActions.linkId, linkIds))
    .groupBy(trackedLinkActions.linkId, trackedLinkActions.kind)
  for (const r of rows) {
    const c = out.get(r.linkId)
    const f = FIELD[r.kind as LinkActionKind]
    if (c && f) c[f] = Number(r.n)
  }
  return out
}

export function sumCounts(list: LinkCounts[]): LinkCounts {
  return list.reduce((a, c) => ({ visits: a.visits + c.visits, signups: a.signups + c.signups, planAdds: a.planAdds + c.planAdds, tickets: a.tickets + c.tickets }), { ...EMPTY })
}

/** The link for a page + event, created on first use. */
export async function ensureLink(db: Db, eventId: string, profileId: string, createdBy: string | null) {
  const [found] = await db.select().from(trackedLinks).where(and(eq(trackedLinks.eventId, eventId), eq(trackedLinks.profileId, profileId)))
  if (found) return found
  for (let i = 0; i < 4; i++) {
    const [row] = await db.insert(trackedLinks).values({ code: newLinkCode(), eventId, profileId, createdBy })
      .onConflictDoNothing().returning()
    if (row) return row
    // A race on (event, page) or, astronomically, the code: read it back.
    const [again] = await db.select().from(trackedLinks).where(and(eq(trackedLinks.eventId, eventId), eq(trackedLinks.profileId, profileId)))
    if (again) return again
  }
  throw new Error('Could not create the link. Try again.')
}
