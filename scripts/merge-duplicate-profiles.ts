/**
 * Find and merge duplicate venue / organizer / artist profiles
 * (server/utils/mergeProfiles.ts has the rules).
 *
 *   bun scripts/merge-duplicate-profiles.ts            # dry-run: counts, examples, review list
 *   bun scripts/merge-duplicate-profiles.ts --write    # merge; writes a backup first
 *
 * Env: DATABASE_URL (check which one before --write!), NEON_FETCH_ENDPOINT for
 * local Postgres. Writes .backups/merge-profiles-<time>.json (every row it will
 * change, before) and .backups/merge-profiles-review-<time>.txt (groups left
 * for a person to decide).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql } from 'drizzle-orm'
import * as schema from '../server/database/schema'
import { findDuplicates, mergeProfile, nameKey, type DupRow } from '../server/utils/mergeProfiles'

const WRITE = process.argv.includes('--write')
const dbUrl = process.env.DATABASE_URL
if (!dbUrl) { console.error('DATABASE_URL environment variable not set'); process.exit(1) }
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT
const host = (() => { try { return new URL(dbUrl).host } catch { return '?' } })()
console.error(`merge duplicate profiles · ${WRITE ? 'WRITE' : 'dry-run'} · target DB ${process.env.NEON_FETCH_ENDPOINT ? `${host} via ${process.env.NEON_FETCH_ENDPOINT}` : host}`)
const db = drizzle(neon(dbUrl), { schema })
const q = async (s: any) => { const r: any = await db.execute(s); return (r.rows ?? r) as any[] }

const rows = (await q(sql`
  select p.id, p.username, p.type, p.name, p.city_slug as "citySlug", p.claimed, p.address, p.source_ref as "sourceRef",
    coalesce(p.lat, nullif(p.source_ref->>'lat', '')::float) as lat, coalesce(p.lng, nullif(p.source_ref->>'lng', '')::float) as lng,
    exists (select 1 from profile_members m where m.profile_id = p.id) as managed,
    (select count(*)::int from events e where e.venue_username = p.username or e.organizer_username = p.username or e.host_profile_id = p.id or e.artists::jsonb ? p.username) as events
  from profiles p where p.status = 'visible' and p.type in ('venue', 'organizer', 'artist')`)) as DupRow[]
const cityKeys = new Set<string>((await q(sql`select slug, name from cities`)).flatMap((c: any) => [nameKey(c.slug), nameKey(c.name)]))
const groups = findDuplicates(rows, cityKeys)
const merges = groups.flatMap(g => g.others.filter(o => o.merge).map(o => ({ g, o })))
const review = groups.flatMap(g => g.others.filter(o => !o.merge).map(o => ({ g, o })))

const by = (list: typeof merges, f: (x: (typeof merges)[number]) => string) => Object.entries(list.reduce((m: Record<string, number>, x) => ((m[f(x)] = (m[f(x)] ?? 0) + 1), m), {})).map(([k, n]) => `${k} ${n}`).join(' · ')
console.error(`profiles ${rows.length} · duplicate groups ${groups.length} · copies to merge ${merges.length} · left for review ${review.length}`)
console.error(`  merge by type: ${by(merges, x => x.g.type)}`)
console.error(`  merge by reason: ${by(merges, x => x.o.reason)}`)
console.error(`  review by reason: ${by(review, x => x.o.reason)}`)
for (const x of merges.filter(m => m.o.row.events).slice(0, 8)) console.error(`  e.g. @${x.o.row.username} (${x.o.row.events} ev) → @${x.g.keep.username} (${x.g.keep.events} ev) · ${x.o.reason}`)

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const dir = join(process.cwd(), '.backups')
mkdirSync(dir, { recursive: true })
const reviewFile = join(dir, `merge-profiles-review-${stamp}.txt`)
writeFileSync(reviewFile, review.map(x => `${x.g.type}\t@${x.o.row.username} (${x.o.row.events} ev)\t→ @${x.g.keep.username} (${x.g.keep.events} ev)\t${x.o.reason}`).join('\n') + '\n')
console.error(`review list: ${reviewFile}`)

if (WRITE) {
  // Backup: every row this run can change, before it changes.
  const ids = [...new Set(merges.flatMap(x => [x.o.row.id, x.g.keep.id]))]
  const handles = [...new Set(merges.map(x => x.o.row.username))]
  const inIds = sql.join(ids.map(i => sql`${i}`), sql`, `)
  const inHandles = sql.join(handles.map(h => sql`${h}`), sql`, `)
  const backup: Record<string, any[]> = {
    merges: merges.map(x => ({ from: x.o.row.username, fromId: x.o.row.id, into: x.g.keep.username, intoId: x.g.keep.id, reason: x.o.reason })),
    profiles: await q(sql`select * from profiles where id in (${inIds})`),
    events: await q(sql`select id, venue_username, organizer_username, host_profile_id, artists, flyer_options, festival from events
      where venue_username in (${inHandles}) or organizer_username in (${inHandles}) or host_profile_id in (${inIds}) or artists::jsonb ?| array[${inHandles}]`),
  }
  for (const t of ['artist_follows', 'bookable_spaces', 'brand_looks', 'guideline_versions', 'moderator_elections', 'profile_access_log', 'profile_claims', 'profile_invites', 'profile_members', 'profile_suggestions']) {
    backup[t] = await q(sql`select * from ${sql.identifier(t)} where profile_id in (${inIds})`)
  }
  backup.booking_requests = await q(sql`select * from booking_requests where profile_id in (${inIds}) or organizer_id in (${inIds})`)
  const file = join(dir, `merge-profiles-${stamp}.json`)
  writeFileSync(file, JSON.stringify(backup))
  console.error(`backup: ${file}`)
  const total: Record<string, number> = {}
  let n = 0
  for (const x of merges) {
    const r = await mergeProfile(db, { id: x.o.row.id, username: x.o.row.username }, { id: x.g.keep.id, username: x.g.keep.username })
    for (const [k, v] of Object.entries(r.touched)) total[k] = (total[k] ?? 0) + v
    if (++n % 50 === 0) console.error(`  ${n}/${merges.length}`)
  }
  console.error(`merged ${n} · moved: ${Object.entries(total).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
}
