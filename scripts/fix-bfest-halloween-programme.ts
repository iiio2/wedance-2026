#!/usr/bin/env bun
/**
 * One-off (#455): fix the programme of "HALLOWEEN at B-FEST Boutique"
 * (event f7934cfd-67fd-44dd-a010-0305cbc188e0). Created before session types
 * existed, its programme read as a 60-min Beginner workshop "Open Doors", a
 * 240-min show and a 240-min afterparty. After:
 *
 *   18:00        doors  Open Doors
 *   19:00–20:30  show   (title kept)
 *   20:30–22:00  party  After Party (title kept)
 *
 * No levels. Session ids, titles and everything else stay as they are
 * (dancers' picks hang on the ids). Items are found by their start time
 * (18:00 / 19:00 / 20:30); anything else in the programme makes the script
 * stop without writing. Idempotent: re-running after --write reports "already fixed".
 *
 * Usage:
 *   bun scripts/fix-bfest-halloween-programme.ts           # dry-run (default): prints before/after, no writes
 *   bun scripts/fix-bfest-halloween-programme.ts --write   # apply
 *
 * Env:
 *   DATABASE_URL           target Postgres (Neon). Check which one before --write!
 *   NEON_FETCH_ENDPOINT    optional, local Postgres via scripts/dev/neon-http-proxy.ts
 *
 * Rollback: the dry-run (and --write) prints the current sessions as JSON
 * ("before"); write that array back to events.festival->'sessions'.
 */
import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import * as schema from '../server/database/schema'
import type { FestivalSession } from '../shared/types/festivalDetails'

export const EVENT_ID = 'f7934cfd-67fd-44dd-a010-0305cbc188e0'
const PLAN: Record<string, { type: FestivalSession['type']; duration: number }> = {
  '18:00': { type: 'doors', duration: 0 },
  '19:00': { type: 'show', duration: 90 },
  '20:30': { type: 'party', duration: 90 },
}

/** The fixed sessions, or an error naming what doesn't match the plan. */
export function fixSessions(sessions: FestivalSession[]): { sessions: FestivalSession[] } | { error: string } {
  const times = sessions.map(s => s.time).sort()
  if (times.join(',') !== Object.keys(PLAN).sort().join(',')) return { error: `expected sessions at ${Object.keys(PLAN).join(', ')}, found ${times.join(', ') || 'none'}` }
  return {
    sessions: sessions.map((s) => {
      const { level: _level, ...rest } = s
      return { ...rest, ...PLAN[s.time]! }
    }),
  }
}

if (import.meta.main) {
  const WRITE = process.argv.includes('--write')
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) { console.error('DATABASE_URL environment variable not set'); process.exit(1) }
  if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT
  const host = (() => { try { return new URL(dbUrl).host } catch { return '?' } })()
  console.error(`B-FEST programme fix · ${WRITE ? 'WRITE' : 'dry-run'} · target DB ${process.env.NEON_FETCH_ENDPOINT ? `${host} via ${process.env.NEON_FETCH_ENDPOINT}` : host}`)

  const db = drizzle(neon(dbUrl), { schema })
  const [ev] = await db.select({ id: schema.events.id, name: schema.events.name, festival: schema.events.festival })
    .from(schema.events).where(eq(schema.events.id, EVENT_ID))
  if (!ev) { console.error(`No event ${EVENT_ID} in this database.`); process.exit(1) }
  const festival = (ev.festival ?? {}) as Record<string, any>
  const before = (festival.sessions ?? []) as FestivalSession[]
  console.log(JSON.stringify({ event: ev.name, before }, null, 2))

  const r = fixSessions(before)
  if ('error' in r) { console.error(`Not touching it: ${r.error}.`); process.exit(1) }
  if (JSON.stringify(r.sessions) === JSON.stringify(before)) { console.error('Already fixed, nothing to do.'); process.exit(0) }
  console.log(JSON.stringify({ after: r.sessions }, null, 2))

  if (!WRITE) { console.error('Dry-run: nothing written. Re-run with --write to apply.'); process.exit(0) }
  await db.update(schema.events).set({ festival: { ...festival, sessions: r.sessions } as any }).where(eq(schema.events.id, EVENT_ID))
  console.error('Written.')
}
