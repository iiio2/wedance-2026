/**
 * Give every profile and dancer a readable handle (server/utils/handles.ts):
 * venues / organizers / artists with a Google id, a number, a garbled or a
 * numbered-copy handle; dancers with no handle or a random-suffix one.
 *
 *   bun scripts/readable-handles.ts            # dry-run: counts and examples
 *   bun scripts/readable-handles.ts --write    # rename; writes a backup first
 *
 * Every reference to a profile's handle moves with it (events, line-ups,
 * flyers, programmes, merged copies). The old handle is kept — profiles in
 * source_ref.oldHandles (+ placeId for Google ids, which the v3 syncs match
 * on), dancers in old_usernames — so old links forward. Pages someone runs on
 * WeDance are not renamed (their handle is theirs to choose); they're listed.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql } from 'drizzle-orm'
import * as schema from '../server/database/schema'
import { candidates, handleSlug, pickHandle, RESERVED, unreadable } from '../server/utils/handles'
import { moveHandleRefs } from '../server/utils/mergeProfiles'

const WRITE = process.argv.includes('--write')
const dbUrl = process.env.DATABASE_URL
if (!dbUrl) { console.error('DATABASE_URL environment variable not set'); process.exit(1) }
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT
const host = (() => { try { return new URL(dbUrl).host } catch { return '?' } })()
console.error(`readable handles · ${WRITE ? 'WRITE' : 'dry-run'} · target DB ${process.env.NEON_FETCH_ENDPOINT ? `${host} via ${process.env.NEON_FETCH_ENDPOINT}` : host}`)
const db = drizzle(neon(dbUrl), { schema })
const q = async (s: any) => { const r: any = await db.execute(s); return (r.rows ?? r) as any[] }

const profs = await q(sql`select p.id, p.username, p.type, p.name, p.city_slug as "citySlug", p.socials, p.status, p.source_ref as "sourceRef", p.address,
  exists (select 1 from profile_members m where m.profile_id = p.id) as managed from profiles p`)
// Oldest accounts first: they get the plain name when several share it.
const dancersAll = await q(sql`select d.id, d.username, d.name, d.email, d.city, d.old_usernames as "oldUsernames" from dancers d order by d.created_at nulls last, d.id`)
// One namespace: every handle in use or kept for a redirect.
const taken = new Set<string>(RESERVED)
for (const p of profs) { taken.add(p.username.toLowerCase()); for (const o of p.sourceRef?.oldHandles ?? []) taken.add(String(o).toLowerCase()) }
for (const d of dancersAll) { if (d.username) taken.add(d.username.toLowerCase()); for (const o of d.oldUsernames ?? []) taken.add(String(o).toLowerCase()) }
// Handles events use (as venue, organizer or in a line-up) with no profile
// behind them: kept free, so no dancer silently becomes "the organizer".
const eventHandles = new Set<string>((await q(sql`
  select distinct lower(h) as h from (
    select venue_username h from events union select organizer_username from events
    union select jsonb_array_elements_text(artists::jsonb) from events
  ) x where h is not null and not exists (select 1 from profiles p where lower(p.username) = lower(x.h))`)).map((r: any) => r.h))
for (const h of eventHandles) taken.add(h)

type Rename = { kind: 'profile' | 'dancer'; id: string; from: string | null; to: string; reason: string; type?: string; placeId?: string }
const renames: Rename[] = []
const keptManaged: string[] = []
for (const p of profs.filter(p => p.status === 'visible')) {
  const why = unreadable(p.username)
  if (!why) continue
  if (p.managed) { keptManaged.push(`@${p.username} (${why})`); continue }
  // A numbered copy ("seb2") only drops its number, when that's free; handles
  // that just have digits ("djsilber95") stay.
  if (why === 'numbered copy') {
    const m = p.username.match(/^(.*[a-z])[._-]?(\d{1,2})$/i)
    const n = Number(m?.[2])
    const ig = (p.socials ?? []).find((x: any) => x.platform === 'instagram')?.url ?? ''
    // An import copy ("name2" … "name30"): not a year or a version, not their
    // Instagram handle, and not a number that's part of the name ("Haager Str. 10").
    if (!m || n < 2 || n > 30 || ig.toLowerCase().includes(p.username.toLowerCase()) || new RegExp(`${n}$`).test(handleSlug(p.name))) continue
    const plain = m[1]!
    if (plain.length < 3 || taken.has(plain.toLowerCase())) continue
    taken.add(plain.toLowerCase())
    renames.push({ kind: 'profile', id: p.id, from: p.username, to: plain, reason: why, type: p.type })
    continue
  }
  // A venue called just "Venue" is better known by its street.
  const named = handleSlug(p.name)
  let root = (named && !RESERVED.includes(named) ? named : handleSlug(String(p.address ?? '').split(',')[0] ?? '')) || p.type
  // Named just a number (a postcode "venue" from Google): put the city in front.
  if (/^\d+$/.test(root)) root = `${p.citySlug ?? p.type}-${root}`
  const cands = candidates(p).filter(c => !RESERVED.includes(c) && !unreadable(c))
  if (root !== named && root.length >= 3) cands.push(root, ...(p.citySlug && !root.startsWith(p.citySlug) ? [`${root}-${p.citySlug}`] : []))
  const to = pickHandle(cands, taken, root)
  renames.push({ kind: 'profile', id: p.id, from: p.username, to, reason: why, type: p.type, ...(why === 'google id' ? { placeId: p.username } : {}) })
}
for (const d of dancersAll) {
  let why: string | null = d.username ? unreadable(d.username) : 'no handle'
  // "ana-2" is how a dancer's handle reads when "ana" is taken: readable.
  if (why === 'numbered copy') why = null
  // Holding a handle events use for someone else (given by an earlier run).
  if (!why && d.username && eventHandles.has(d.username.toLowerCase())) why = 'used by events'
  if (!why) continue
  const name = String(d.name || '').includes('@') ? String(d.name).split('@')[0]! : String(d.name || '')
  const root = handleSlug(name) || 'dancer'
  const city = d.city ? handleSlug(d.city) : ''
  const to = pickHandle(root.length >= 3 ? [root, ...(city ? [`${root}-${city}`] : [])] : [], taken, root)
  renames.push({ kind: 'dancer', id: d.id, from: d.username ?? null, to, reason: why })
}

const tally = (f: (r: Rename) => string) => Object.entries(renames.reduce((m: Record<string, number>, r) => ((m[f(r)] = (m[f(r)] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(' · ')
console.error(`renames ${renames.length} · ${tally(r => r.kind === 'profile' ? r.type! : 'dancer')}`)
console.error(`  why: ${tally(r => r.reason)}`)
console.error(`  kept (someone runs the page): ${keptManaged.length}${keptManaged.length ? ` · ${keptManaged.slice(0, 10).join(', ')}` : ''}`)
for (const r of [...renames.filter(r => r.kind === 'profile').slice(0, 10), ...renames.filter(r => r.kind === 'dancer').slice(0, 6)]) console.error(`  e.g. ${r.from ? `@${r.from.slice(0, 32)}` : '(none)'} → @${r.to} · ${r.reason}`)

if (WRITE) {
  const dir = join(process.cwd(), '.backups')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `readable-handles-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(file, JSON.stringify(renames))
  console.error(`backup: ${file}`)
  let n = 0
  for (const r of renames) {
    if (r.kind === 'profile') {
      await moveHandleRefs(db, r.from!, r.to)
      await q(sql`update profiles set username = ${r.to}, source_ref = coalesce(source_ref, '{}'::jsonb)
        || jsonb_build_object('oldHandles', coalesce(source_ref->'oldHandles', '[]'::jsonb) || ${JSON.stringify([r.from])}::jsonb)
        || ${JSON.stringify(r.placeId ? { placeId: r.placeId } : {})}::jsonb where id = ${r.id}`)
      // Merged copies point at the new handle.
      await q(sql`update profiles set source_ref = jsonb_set(source_ref, '{mergedInto}', to_jsonb(${r.to}::text)) where source_ref->>'mergedInto' = ${r.from}`)
    } else {
      // A handle events use for someone else isn't kept as a redirect to this dancer.
      const keep = r.from && r.reason !== 'used by events' ? [r.from] : []
      await q(sql`update dancers set username = ${r.to}, old_usernames = old_usernames || ${JSON.stringify(keep)}::jsonb where id = ${r.id}`)
      if (r.from) await q(sql`update reviews set reviewer_username = ${r.to} where reviewer_username = ${r.from}`)
    }
    if (++n % 250 === 0) console.error(`  ${n}/${renames.length}`)
  }
  console.error(`renamed ${n}`)
}
