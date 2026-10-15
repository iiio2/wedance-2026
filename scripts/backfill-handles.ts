/**
 * Step 12 backfill: populate the `handles` table from existing
 * `profiles.username` and `dancers.username`.
 *
 * Profiles are backfilled first (they own the /@handle namespace). Dancers
 * that collide with a profile handle get a suffix and a notice logged.
 *
 *   bun scripts/backfill-handles.ts            # dry-run
 *   bun scripts/backfill-handles.ts --write    # populate handles table
 */
import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql } from 'drizzle-orm'
import * as schema from '../server/database/schema'

const WRITE = process.argv.includes('--write')
const dbUrl = process.env.DATABASE_URL
if (!dbUrl) { console.error('DATABASE_URL not set'); process.exit(1) }
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT
const db = drizzle(neon(dbUrl), { schema })
const q = async (s: any) => { const r: any = await db.execute(s); return (r.rows ?? r) as any[] }

console.error(`backfill-handles · ${WRITE ? 'WRITE' : 'dry-run'}`)

// 1. Profiles first (they own the namespace — ADR-004 collision rule).
const profiles = await q(sql`
  SELECT id, username FROM profiles WHERE status = 'visible'
  AND NOT EXISTS (SELECT 1 FROM handles h WHERE h.profile_id = profiles.id)
  ORDER BY created_at NULLS LAST`)

let profileOk = 0, profileSkip = 0
for (const p of profiles) {
  if (!p.username) { profileSkip++; continue }
  const [clash] = await q(sql`SELECT handle FROM handles WHERE lower(handle) = lower(${p.username})`)
  if (clash) {
    console.error(`  skip profile @${p.username} — handle already taken by ${clash.handle}`)
    profileSkip++
    continue
  }
  if (WRITE) {
    await q(sql`INSERT INTO handles (handle, profile_id) VALUES (${p.username}, ${p.id}) ON CONFLICT DO NOTHING`)
  }
  profileOk++
}
console.error(`profiles: ${profileOk} registered, ${profileSkip} skipped`)

// 2. Dancers — collisions get a suffix.
const dancers = await q(sql`
  SELECT id, username, name FROM dancers
  WHERE username IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM handles h WHERE h.dancer_id = dancers.id)
  ORDER BY created_at NULLS LAST`)

let dancerOk = 0, dancerSuffix = 0, dancerSkip = 0
for (const d of dancers) {
  if (!d.username) { dancerSkip++; continue }
  const [clash] = await q(sql`SELECT handle FROM handles WHERE lower(handle) = lower(${d.username})`)
  if (clash) {
    // Dancer gets a suffixed handle
    let assigned = false
    for (let i = 0; i < 10; i++) {
      const suffix = Math.random().toString(36).slice(2, 6)
      const candidate = `${d.username}-${suffix}`
      const [c2] = await q(sql`SELECT handle FROM handles WHERE lower(handle) = lower(${candidate})`)
      if (!c2) {
        if (WRITE) {
          await q(sql`INSERT INTO handles (handle, dancer_id) VALUES (${candidate}, ${d.id}) ON CONFLICT DO NOTHING`)
          // Record the collision so old links redirect
          await q(sql`UPDATE dancers SET old_usernames = old_usernames || ${JSON.stringify([d.username])}::jsonb, username = ${candidate} WHERE id = ${d.id}`)
        }
        console.error(`  collision: dancer @${d.username} → @${candidate}`)
        dancerSuffix++
        assigned = true
        break
      }
    }
    if (!assigned) {
      console.error(`  FAILED: could not find a suffix for dancer @${d.username}`)
      dancerSkip++
    }
    continue
  }
  if (WRITE) {
    await q(sql`INSERT INTO handles (handle, dancer_id) VALUES (${d.username}, ${d.id}) ON CONFLICT DO NOTHING`)
  }
  dancerOk++
}
console.error(`dancers: ${dancerOk} registered, ${dancerSuffix} suffixed, ${dancerSkip} skipped`)
console.error(`total handles: ${profileOk + dancerOk + dancerSuffix}`)
