/**
 * Backfill (#452): fill unclaimed profile pages that link an Instagram account
 * but have no photo — name (while it is still the handle), photo (re-hosted on
 * Cloudinary), bio, website, city / venue address — from Apify's
 * instagram-profile-scraper. Same rules as the live import
 * (server/utils/instagram/profileImport.ts): empty fields only, claimed or
 * managed pages never touched, every attempt recorded in
 * source_ref.instagram_import.
 *
 *   bun scripts/backfill-instagram-profiles.ts                       # list candidates (no Apify call, no writes)
 *   bun scripts/backfill-instagram-profiles.ts --fetch               # + call Apify, show what would be filled (costs Apify credit, no writes)
 *   bun scripts/backfill-instagram-profiles.ts --write --limit 20    # apply
 *   bun scripts/backfill-instagram-profiles.ts --write --handles galerieheinzgalinski,some_dj
 *
 * Options:
 *   --limit N        at most N profiles (default 25)
 *   --handles a,b,c  only these — Instagram handles or WeDance usernames (photo or not)
 *   --force          also re-import pages imported OK in the last week
 *   --batch N        handles per Apify run (default 20)
 *
 * Env: DATABASE_URL (check which one before --write — the Vercel-pulled .env is
 * PRODUCTION), NEON_FETCH_ENDPOINT for local Postgres, APIFY_TOKEN,
 * NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME / NUXT_CLOUDINARY_API_KEY / NUXT_CLOUDINARY_API_SECRET
 * (without them photos are skipped; the other fields still fill).
 * Rollback: .backups/instagram-backfill-<time>.json holds each row's old values.
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql, inArray } from 'drizzle-orm'
import * as schema from '../server/database/schema'
import { profiles } from '../server/database/schema'
import { importInstagramProfiles, type ImportTarget } from '../server/utils/instagram/profileImport'
import { apifyEnabled } from '../server/utils/instagram/apify'
import { cloudinaryKeys } from '../server/utils/rehostImage'
import { parseInstagramHandle } from '../shared/utils/instagram'

const args = process.argv.slice(2)
const flag = (name: string) => args.includes(`--${name}`)
const opt = (name: string) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined }
const WRITE = flag('write')
const FETCH = WRITE || flag('fetch')
const FORCE = flag('force')
const LIMIT = Number(opt('limit') ?? 25)
const BATCH = Math.max(1, Math.min(Number(opt('batch') ?? 20), 50))
const HANDLES = (opt('handles') ?? '').split(',').map(h => h.trim().replace(/^@/, '').toLowerCase()).filter(Boolean)

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) { console.error('DATABASE_URL environment variable not set'); process.exit(1) }
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT
const host = (() => { try { return new URL(dbUrl).host } catch { return '?' } })()
console.error(`Instagram backfill · ${WRITE ? 'WRITE' : FETCH ? 'dry-run + Apify fetch' : 'dry-run (candidates only)'} · target DB ${process.env.NEON_FETCH_ENDPOINT ? `${host} via ${process.env.NEON_FETCH_ENDPOINT}` : host}`)
if (FETCH && !apifyEnabled()) { console.error('APIFY_TOKEN not set — cannot fetch.'); process.exit(1) }
if (WRITE && !cloudinaryKeys()) console.error('Cloudinary keys not set — photos will be skipped, other fields still fill.')

const db = drizzle(neon(dbUrl), { schema })

const igOf = (socials: { platform: string; url: string }[] | null) => {
  const s = (socials ?? []).find(x => x.platform === 'instagram' || /instagram\.com\//i.test(x.url))
  return s ? parseInstagramHandle(s.url) : null
}

const unowned = sql`${profiles.claimed} is not true and not exists (select 1 from profile_members m where m.profile_id = ${profiles.id})`
const hasIg = sql`${profiles.socials}::text ~* 'instagram\\.com/'`
const rows = await db.select({ id: profiles.id, username: profiles.username, type: profiles.type, name: profiles.name, photo: profiles.photo, bio: profiles.bio, city: profiles.city, address: profiles.address, socials: profiles.socials, sourceRef: profiles.sourceRef })
  .from(profiles)
  .where(HANDLES.length
    ? sql`${unowned} and ${hasIg} and (${inArray(profiles.username, HANDLES)} or ${profiles.socials}::text ~* ${`instagram\\.com/(${HANDLES.map(h => h.replace(/\./g, '\\.')).join('|')})/?"`})`
    : sql`${unowned} and ${hasIg} and ${profiles.status} = 'visible' and coalesce(trim(${profiles.photo}), '') = ''
          and (${FORCE ? sql`true` : sql`coalesce((${profiles.sourceRef}->'instagram_import'->>'ok')::boolean, false) = false`})`)
  .orderBy(sql`(${profiles.sourceRef}->'instagram_import') is not null`, profiles.createdAt)
  .limit(LIMIT)

const targets: ImportTarget[] = []
for (const r of rows) {
  const handle = igOf(r.socials as any)
  if (handle) targets.push({ profileId: r.id, handle })
}
console.error(`candidates: ${targets.length}${HANDLES.length ? ` (of ${HANDLES.length} requested)` : ''} · limit ${LIMIT}`)
for (const r of rows) console.error(`  @${r.username} (${r.type}) ← instagram.com/${igOf(r.socials as any)}${r.photo ? ' · has photo' : ''}${(r.sourceRef as any)?.instagram_import ? ` · last import ok=${(r.sourceRef as any).instagram_import.ok}` : ''}`)
if (!FETCH || !targets.length) process.exit(0)

let backup = ''
if (WRITE) {
  const dir = join(process.cwd(), '.backups')
  mkdirSync(dir, { recursive: true })
  backup = join(dir, `instagram-backfill-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(backup, JSON.stringify(rows, null, 1))
  console.error(`backup: ${backup}`)
}

const tally: Record<string, number> = {}
for (let i = 0; i < targets.length; i += BATCH) {
  const chunk = targets.slice(i, i + BATCH)
  const results = await importInstagramProfiles(db, chunk, { dryRun: !WRITE, force: FORCE || HANDLES.length > 0 })
  for (const r of results) {
    tally[r.status] = (tally[r.status] ?? 0) + 1
    console.log(`${r.status.padEnd(9)} @${r.username} ← ${r.handle}${r.fields.length ? `: ${r.fields.join(', ')}` : ''}${r.reason ? ` (${r.reason})` : ''}`)
  }
}
console.error(`done · ${Object.entries(tally).map(([k, v]) => `${k} ${v}`).join(' · ')}${WRITE ? '' : ' · nothing written (add --write)'}`)
