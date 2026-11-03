/**
 * Business pages came over without their teams. This reads who can edit each
 * page on wedance.vip (v3, live) and stores them in profile_owner_suggestions
 * (0058), shown in Admin → Users with "Make owner". It never grants access and
 * never touches the claims queue.
 *
 *   bun scripts/import-page-owner-suggestions.ts            # dry-run
 *   bun scripts/import-page-owner-suggestions.ts --write    # store the suggestions
 *
 * v3's own rule (wedance-v3 use/auth.js `can`): you edit a page you created or
 * whose team you're on. Sources, strongest first:
 *   v3-own     — the page is the person's own account (createdBy = page id; v3 "claimed")
 *   v3-team    — listed in the page's Team Members (`team[].id`)
 *   v3-creator — created the page, if they created at most MAX_CREATED pages: people
 *                who added dozens are contributors listing others, not owners
 *                (WeDance's own accounts are skipped too).
 *
 * Read only: the only Firestore call is `:runQuery`. Matching: page → profiles by
 * source_ref.firebaseId or the same handle (a merged copy → the page it was
 * merged into); person → dancers by source_ref.firebaseId (the v3 uid). Someone
 * who already runs the page is skipped; re-running adds only new rows.
 *
 * Env: DATABASE_URL (2026 target — check it before --write),
 *      WEDANCE_V3_SERVICE_ACCOUNT or _FILE (default ~/Secrets/wedance.json).
 * Rollback: DELETE FROM profile_owner_suggestions;
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { fetchV3Profiles } from '../server/utils/v3ProfileSync'

const MAX_CREATED = 5
const WEDANCE_ACCOUNTS = new Set(['alexrazbakov', 'wedanceteam', 'wedance'])

const WRITE = process.argv.includes('--write')
const dbUrl = process.env.DATABASE_URL
if (!dbUrl) { console.error('DATABASE_URL environment variable not set'); process.exit(1) }
const host = (u: string) => { try { return new URL(u).host } catch { return '?' } }
console.error(`page owner suggestions · ${WRITE ? 'WRITE' : 'dry-run'} · target DB ${host(dbUrl)}`)

const sa = process.env.WEDANCE_V3_SERVICE_ACCOUNT
  ? JSON.parse(process.env.WEDANCE_V3_SERVICE_ACCOUNT)
  : JSON.parse(readFileSync(process.env.WEDANCE_V3_SERVICE_ACCOUNT_FILE ?? join(homedir(), 'Secrets', 'wedance.json'), 'utf8'))
const all = await fetchV3Profiles(sa)
const byId = new Map(all.map(p => [p.id, p]))
const pages = all.filter(p => ['Venue', 'Organiser', 'Artist', 'FanPage'].includes(p.type))
const created = new Map<string, number>()
for (const p of pages) if (p.createdBy && p.createdBy !== p.id) created.set(p.createdBy, (created.get(p.createdBy) ?? 0) + 1)

type Lead = { source: 'v3-own' | 'v3-team' | 'v3-creator'; pageId: string; page: string; uid: string }
const leads: Lead[] = []
for (const p of pages) {
  const page = { pageId: p.id, page: p.username ?? '' }
  if (p.createdBy === p.id) leads.push({ source: 'v3-own', ...page, uid: p.id })
  for (const m of Array.isArray(p.team) ? p.team : []) if (m?.id) leads.push({ source: 'v3-team', ...page, uid: m.id })
  const creator = p.createdBy && p.createdBy !== p.id ? byId.get(p.createdBy) : null
  if (creator && created.get(p.createdBy)! <= MAX_CREATED && !WEDANCE_ACCOUNTS.has(String(creator.username ?? '').toLowerCase())) {
    leads.push({ source: 'v3-creator', ...page, uid: p.createdBy })
  }
}
console.log(`v3: ${pages.length} business pages · ${leads.filter(l => l.source === 'v3-own').length} own account · ${leads.filter(l => l.source === 'v3-team').length} team entries · ${leads.filter(l => l.source === 'v3-creator').length} small creators`)

const db = new pg.Client({ connectionString: dbUrl })
await db.connect()
const { rows: plan } = await db.query<{ source: string; profile_id: string | null; username: string | null; dancer_id: string | null; dancer: string | null; runs_it: boolean; known: boolean }>(`
  WITH lead AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(source text, "pageId" text, page text, uid text)),
  x AS (
    SELECT lead.source,
      (SELECT coalesce(k.id, p.id) FROM profiles p LEFT JOIN profiles k ON k.username = p.source_ref->>'mergedInto'
        WHERE p.source_ref->>'firebaseId' = lead."pageId" OR lower(p.username) = lower(lead.page)
        ORDER BY (p.source_ref->>'firebaseId' = lead."pageId") DESC, (p.source_ref ? 'mergedInto') LIMIT 1) AS profile_id,
      (SELECT d.id FROM dancers d WHERE d.source_ref->>'firebaseId' = lead.uid LIMIT 1) AS dancer_id
    FROM lead
  )
  -- one row per page + person, keeping the strongest source
  SELECT DISTINCT ON (x.profile_id, x.dancer_id) x.source, x.profile_id, p.username, x.dancer_id, d.name AS dancer,
    exists (SELECT 1 FROM profile_members m WHERE m.profile_id = x.profile_id AND m.dancer_id = x.dancer_id) AS runs_it,
    exists (SELECT 1 FROM profile_owner_suggestions s WHERE s.profile_id = x.profile_id AND s.dancer_id = x.dancer_id) AS known
  FROM x LEFT JOIN profiles p ON p.id = x.profile_id LEFT JOIN dancers d ON d.id = x.dancer_id
  ORDER BY x.profile_id, x.dancer_id, array_position(ARRAY['v3-own', 'v3-team', 'v3-creator'], x.source)`, [JSON.stringify(leads)])

const todo = plan.filter(r => r.profile_id && r.dancer_id && !r.runs_it && !r.known)
for (const s of ['v3-own', 'v3-team', 'v3-creator']) {
  const of = plan.filter(r => r.source === s)
  console.log(`${s}: page not in 2026 ${of.filter(r => !r.profile_id).length} · person not in 2026 ${of.filter(r => r.profile_id && !r.dancer_id).length} · already runs it ${of.filter(r => r.runs_it).length} · already suggested ${of.filter(r => !r.runs_it && r.known).length} · to add ${todo.filter(r => r.source === s).length}`)
}
for (const s of ['v3-own', 'v3-team', 'v3-creator']) for (const r of todo.filter(r => r.source === s).slice(0, 4)) console.log(`  @${r.username} ← ${r.dancer} (${s})`)

if (WRITE && todo.length) {
  await db.query('BEGIN')
  for (const r of todo) {
    await db.query(`INSERT INTO profile_owner_suggestions (profile_id, dancer_id, source) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`, [r.profile_id, r.dancer_id, r.source])
  }
  await db.query('COMMIT')
  console.log(`stored ${todo.length} suggestions`)
}
await db.end()
