/**
 * The `festivals` row behind a festival page, by its slug.
 *
 * Festival pages are rendered from `events` (migration 0032: `events.festival`),
 * and the slug they use is the festival key (`events.festival->>'key'`). The
 * festival side tables — ride shares, roommate lookups, dinners, sign-ups —
 * still reference the legacy `festivals` table (ADR-006 step 19 moves them to
 * `events.id`). Only six festivals ever got a `festivals` row, so every other
 * festival page (e.g. DDF 2026) had nowhere to store a ride or a room request:
 * the mutations answered NOT_FOUND and the page swallowed it (RAZ-437/438).
 *
 * `ensureFestivalId` closes that gap: when no `festivals` row exists but a
 * festival event with that key does, it creates the row from the event (same
 * slug, so the step-19 backfill can attach it by slug later). Reads use
 * `findFestivalId` and never write.
 */
import { eq, sql } from 'drizzle-orm'
import { festivals, events } from '../database/schema'

export async function findFestivalId(db: any, slug: string): Promise<string | null> {
  const [row] = await db.select({ id: festivals.id }).from(festivals).where(eq(festivals.slug, slug)).limit(1)
  return row?.id ?? null
}

const day = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null)

export async function ensureFestivalId(db: any, slug: string): Promise<string | null> {
  const existing = await findFestivalId(db, slug)
  if (existing) return existing

  const [ev] = await db
    .select({ name: events.name, startDate: events.startDate, endDate: events.endDate, city: events.city, country: events.country, ticketUrl: events.ticketUrl, styles: events.styles })
    .from(events)
    .where(sql`${events.festival} IS NOT NULL AND (${events.festival}->>'key' = ${slug} OR ${events.slug} = ${slug})`)
    .limit(1)
  if (!ev) return null

  await db
    .insert(festivals)
    .values({
      slug,
      name: ev.name || slug,
      startDate: day(ev.startDate),
      endDate: day(ev.endDate),
      city: ev.city ?? null,
      country: ev.country ?? null,
      ticketUrl: ev.ticketUrl ?? null,
      styles: ev.styles ?? [],
    })
    .onConflictDoNothing({ target: festivals.slug })

  // Re-read: a concurrent request may have inserted it first.
  return findFestivalId(db, slug)
}
