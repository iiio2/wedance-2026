/**
 * Step 13 backfill: current moderators (from profiles.moderator_handle matched
 * to a dancer) become `moderator` members in profile_members with the election
 * term. profiles.claimed=true profiles get listed for owner assignment.
 *
 *   bun scripts/backfill-moderator-members.ts            # dry-run
 *   bun scripts/backfill-moderator-members.ts --write    # insert memberships
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

console.error(`backfill-moderator-members · ${WRITE ? 'WRITE' : 'dry-run'}`)

// 1. Moderators from profiles.moderator_handle → profile_members with role 'moderator'.
const moderators = await q(sql`
  SELECT p.id AS profile_id, p.moderator_handle, p.moderator_since,
         d.id AS dancer_id, d.username
  FROM profiles p
  JOIN dancers d ON lower(replace(p.moderator_handle, '@', '')) = lower(d.username)
  WHERE p.moderator_handle IS NOT NULL
    AND p.moderator_handle <> ''
    AND NOT EXISTS (
      SELECT 1 FROM profile_members m
      WHERE m.profile_id = p.id AND m.dancer_id = d.id AND m.role = 'moderator'
    )`)

let modCreated = 0
for (const m of moderators) {
  const year = m.moderator_since ?? new Date().getFullYear()
  const termStart = `${year}-01-01`
  const termEnd = `${year + 1}-01-01`
  if (WRITE) {
    await q(sql`
      INSERT INTO profile_members (profile_id, dancer_id, role, title, term_start, term_end)
      VALUES (${m.profile_id}, ${m.dancer_id}, 'moderator', 'Elected Moderator', ${termStart}, ${termEnd})
      ON CONFLICT (profile_id, dancer_id) DO UPDATE SET
        role = CASE WHEN profile_members.role = 'owner' THEN 'owner' ELSE 'moderator' END,
        term_start = ${termStart},
        term_end = ${termEnd}`)
  }
  console.error(`  moderator: @${m.username} → profile ${m.profile_id}`)
  modCreated++
}
console.error(`moderator memberships: ${modCreated} created`)

// 2. List claimed=true profiles that have no owner assigned.
const unclaimed = await q(sql`
  SELECT p.id, p.username, p.name, p.type
  FROM profiles p
  WHERE p.claimed = true
    AND NOT EXISTS (
      SELECT 1 FROM profile_members m WHERE m.profile_id = p.id AND m.role = 'owner'
    )`)

if (unclaimed.length) {
  console.error(`\nclaimed profiles without an owner (${unclaimed.length}):`)
  for (const p of unclaimed.slice(0, 20)) {
    console.error(`  @${p.username} (${p.type}) — ${p.name}`)
  }
  if (unclaimed.length > 20) console.error(`  … and ${unclaimed.length - 20} more`)
}
