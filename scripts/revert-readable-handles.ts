/**
 * Undo one run of scripts/readable-handles.ts from its backup:
 *   bun scripts/revert-readable-handles.ts .backups/readable-handles-<time>.json [--write]
 * Renames back in reverse order, moving every reference back and dropping the
 * handle from the kept old handles.
 */
import { readFileSync } from 'node:fs'
import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql } from 'drizzle-orm'
import * as schema from '../server/database/schema'
import { moveHandleRefs } from '../server/utils/mergeProfiles'

const file = process.argv[2]
const WRITE = process.argv.includes('--write')
if (!file || !process.env.DATABASE_URL) { console.error('usage: DATABASE_URL=… bun scripts/revert-readable-handles.ts <backup.json> [--write]'); process.exit(1) }
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT
const db = drizzle(neon(process.env.DATABASE_URL), { schema })
const q = async (s: any) => { const r: any = await db.execute(s); return (r.rows ?? r) as any[] }
const renames = JSON.parse(readFileSync(file, 'utf8')) as { kind: 'profile' | 'dancer'; id: string; from: string | null; to: string }[]
console.error(`revert ${renames.length} renames · ${WRITE ? 'WRITE' : 'dry-run'}`)
if (WRITE) {
  for (const r of [...renames].reverse()) {
    if (r.kind === 'profile') {
      await moveHandleRefs(db, r.to, r.from!)
      await q(sql`update profiles set username = ${r.from}, source_ref = jsonb_set(source_ref, '{oldHandles}', coalesce((select jsonb_agg(x) from jsonb_array_elements(source_ref->'oldHandles') x where x <> to_jsonb(${r.from}::text)), '[]'::jsonb)) where id = ${r.id}`)
      await q(sql`update profiles set source_ref = jsonb_set(source_ref, '{mergedInto}', to_jsonb(${r.from}::text)) where source_ref->>'mergedInto' = ${r.to}`)
    } else {
      await q(sql`update dancers set username = ${r.from}, old_usernames = coalesce((select jsonb_agg(x) from jsonb_array_elements(old_usernames) x where x <> to_jsonb(${r.from ?? ''}::text)), '[]'::jsonb) where id = ${r.id}`)
      if (r.from) await q(sql`update reviews set reviewer_username = ${r.from} where reviewer_username = ${r.to}`)
    }
  }
  console.error('reverted')
}
