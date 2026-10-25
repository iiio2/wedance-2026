/**
 * How /events/<param> finds its event — shared by events.get (the page data)
 * and GET /api/event-status (the SSR 404 check), so both agree on what exists.
 *
 * <param> is a full id, a festival key or stored slug (/events/meneate-viena-2026),
 * or /events/<name>-<short id> (the last 8 characters start the id). Only
 * published events count: an unpublished one is "not found" to the public.
 * f~<festival key>~<session id> is one item of a festival's programme.
 */
import { and, eq, or, sql, type SQL } from 'drizzle-orm'
import { events, bookingRequests } from '../database/schema'
import { eventKey, sessionKey } from '../../shared/utils/eventSlug'

/** WHERE clauses to try in order: exact (id / slug / festival key), then short-id prefix. */
export function publicEventWhere(param: string): SQL[] {
  const key = eventKey(param)
  const published = eq(events.published, true)
  const exact = key && 'id' in key
    ? eq(events.id, key.id)
    : or(eq(events.slug, param), sql`${events.festival}->>'key' = ${param}`)
  const out = [and(exact, published)!]
  if (key && 'short' in key) out.push(and(sql`${events.id}::text LIKE ${`${key.short}%`}`, published)!)
  return out
}

/** Does /events/<param> resolve to a published event or a booking request? */
export async function eventPageExists(db: any, param: string): Promise<boolean> {
  const session = sessionKey(param)
  if (session) {
    const [row] = await db.select({ id: events.id }).from(events).where(and(
      eq(events.published, true),
      sql`${events.festival}->>'key' = ${session.key}`,
      sql`${events.festival}->'sessions' @> ${JSON.stringify([{ id: session.sessionId }])}::jsonb`,
    )).limit(1)
    return !!row
  }
  for (const where of publicEventWhere(param)) {
    const [row] = await db.select({ id: events.id }).from(events).where(where).limit(1)
    if (row) return true
  }
  const key = eventKey(param)
  if (key && 'id' in key) {
    const [b] = await db.select({ id: bookingRequests.id }).from(bookingRequests).where(eq(bookingRequests.id, key.id)).limit(1)
    if (b) return true
  }
  return false
}
