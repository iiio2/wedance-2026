import { dancerActiveDays } from '../database/schema'
import type { useDb } from './db'

// dancerId → the last UTC day this instance recorded, so a busy user costs one
// write per day per serverless instance, not one per request.
const seen = new Map<string, string>()

/** Mark today as a day this user used WeDance (Admin → Users "days used"). Never throws. */
export function recordActiveDay(db: ReturnType<typeof useDb>, dancerId: string, waitUntil?: (p: Promise<unknown>) => void) {
  if (process.env.VITEST) return
  const day = new Date().toISOString().slice(0, 10)
  if (seen.get(dancerId) === day) return
  if (seen.size > 10_000) seen.clear()
  seen.set(dancerId, day)
  const write = db.insert(dancerActiveDays).values({ dancerId, day }).onConflictDoNothing()
    .then(() => {}, (e) => { seen.delete(dancerId); console.warn('[activeDays]', e?.message || e) })
  if (waitUntil) waitUntil(write)
}
