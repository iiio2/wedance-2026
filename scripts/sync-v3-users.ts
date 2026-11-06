#!/usr/bin/env bun
/**
 * Mirror wedance.vip (v3) accounts into 2026 `dancers` (rules: server/utils/v3UserSync.ts).
 * READ-ONLY against v3: Firebase Auth accounts:batchGet + Firestore :runQuery.
 *
 *   bun run sync:v3-users            # dry-run (default): counts + a few examples, no writes
 *   bun run sync:v3-users --write    # create new people, fill empty fields on existing ones
 *   bun run sync:v3-users --json     # machine-readable summary
 *
 * Idempotent: a second run reports nothing to do. New rows carry
 * source_ref.source = 'wedance-v3'.
 * Rollback (new people only): DELETE FROM dancers WHERE source_ref->>'source' = 'wedance-v3'
 *   AND NOT EXISTS (SELECT 1 FROM sessions s WHERE s.dancer_id = dancers.id);
 *
 * Env:
 *   DATABASE_URL                         target Postgres. Check which one before --write!
 *   WEDANCE_V3_SERVICE_ACCOUNT           v3 Firebase service-account JSON (string), or
 *   WEDANCE_V3_SERVICE_ACCOUNT_FILE      path to it (default ~/Secrets/wedance.json)
 * Passwords come along only if that service account may read hashes (role
 * "Firebase Authentication Admin"); otherwise new people sign in by magic link.
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import pg from 'pg'
import { buildCityIndex, resolveCity, type ServiceAccount } from '../server/utils/v3EventSync'
import { findDeadPhotos } from '../server/utils/photoCheck'
import { fetchAllV3Profiles, fetchAuthUsers, planUsers, type ExistingDancer } from '../server/utils/v3UserSync'

const args = new Set(process.argv.slice(2))
const WRITE = args.has('--write')
const JSON_OUT = args.has('--json')
const log = (s: string) => { if (!JSON_OUT) console.error(s) }

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) { console.error('DATABASE_URL environment variable not set'); process.exit(1) }
const host = (() => { try { return new URL(dbUrl).host } catch { return '?' } })()
log(`v3 → 2026 user sync · ${WRITE ? 'WRITE' : 'dry-run'} · target DB ${host}`)

const sa: ServiceAccount = process.env.WEDANCE_V3_SERVICE_ACCOUNT
  ? JSON.parse(process.env.WEDANCE_V3_SERVICE_ACCOUNT)
  : JSON.parse(readFileSync(process.env.WEDANCE_V3_SERVICE_ACCOUNT_FILE ?? join(homedir(), 'Secrets', 'wedance.json'), 'utf8'))

const [authUsers, profiles] = await Promise.all([fetchAuthUsers(sa), fetchAllV3Profiles(sa)])
log(`v3: ${authUsers.length} accounts · ${profiles.size} profile documents`)

const db = new pg.Client({ connectionString: dbUrl })
await db.connect()
const { rows: existing } = await db.query<ExistingDancer>(
  `SELECT id, email, name, photo, bio, city, instagram, hash, salt, source_ref AS "sourceRef" FROM dancers`)
const { rows: cities } = await db.query<{ city: string | null; citySlug: string | null }>(
  `SELECT DISTINCT city, city_slug AS "citySlug" FROM profiles WHERE city IS NOT NULL`)
const cityIndex = buildCityIndex(cities)
const cityName = new Map<string, string>() // v3 city place id → its name
for (const p of profiles.values()) if (p.type === 'City' && typeof p.place === 'string' && typeof p.name === 'string') cityName.set(p.place, p.name)
const cityOfPlace = (place: unknown) => {
  if (typeof place !== 'string' || !place) return null
  const name = cityName.get(place)
  return name ? (resolveCity(name, cityIndex)?.name ?? name) : null
}

let plan = planUsers({ authUsers, profiles, existing, cityOfPlace })
// Check every photo the plan would write (and the Auth fallback), then plan again without the dead ones.
const photos = plan.ops.flatMap(o => [o.fields.photo, authUsers.find(u => u.localId === o.uid)?.photoUrl]).filter((u): u is string => !!u && /^https?:/i.test(u))
const deadPhotos = await findDeadPhotos(photos)
if (deadPhotos.size) {
  log(`photos: ${deadPhotos.size} of ${new Set(photos).size} no longer load — left empty`)
  plan = planUsers({ authUsers, profiles, existing, cityOfPlace, deadPhotos })
}
const s = plan.stats
log(`accounts ${s.accounts} · skipped ${s.skipped} (no email / disabled / duplicate email)`)
log(`matched by v3 id ${s.matchedById} · by email ${s.matchedByEmail} · unchanged ${s.unchanged}`)
log(`to create ${s.created} · to fill ${s.filled} · with a password ${s.withPassword}`)
if (s.passwordsRedacted) log('passwords: Google returned REDACTED — this service account can\'t read hashes, so new people will sign in by magic link')
for (const o of plan.ops.filter(o => o.op === 'create').slice(0, 5)) log(`  + ${o.fields.name}${o.fields.city ? ` (${o.fields.city})` : ''}`)

if (WRITE && plan.ops.length) {
  await db.query('BEGIN')
  for (const o of plan.ops) {
    if (o.op === 'create') {
      const f = o.fields
      await db.query(`
        INSERT INTO dancers (email, name, photo, bio, city, instagram, hash, salt, source_ref, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, coalesce($10, now()))
        ON CONFLICT (email) DO NOTHING`,
      [o.email, f.name, f.photo, f.bio, f.city, f.instagram, f.hash, f.salt, JSON.stringify({ source: 'wedance-v3', firebaseId: o.uid }), o.createdAt])
    } else {
      const f = o.fields
      // "Only if empty" again in SQL, so a field someone set since the plan is never overwritten.
      await db.query(`
        UPDATE dancers SET
          photo = coalesce(nullif(photo, ''), $2), bio = coalesce(nullif(bio, ''), $3),
          city = coalesce(nullif(city, ''), $4), instagram = coalesce(nullif(instagram, ''), $5),
          salt = CASE WHEN coalesce(hash, '') = '' AND $6::text IS NOT NULL THEN $7 ELSE salt END,
          hash = CASE WHEN coalesce(hash, '') = '' AND $6::text IS NOT NULL THEN $6 ELSE hash END,
          source_ref = coalesce($8::jsonb, source_ref)
        WHERE id = $1`,
      [o.id, f.photo ?? null, f.bio ?? null, f.city ?? null, f.instagram ?? null, f.hash ?? null, f.salt ?? null, o.sourceRef ? JSON.stringify(o.sourceRef) : null])
    }
  }
  await db.query('COMMIT')
  log(`applied ${plan.ops.length} changes`)
}
await db.end()
if (JSON_OUT) console.log(JSON.stringify({ mode: WRITE ? 'write' : 'dry-run', ...s }, null, 2))
