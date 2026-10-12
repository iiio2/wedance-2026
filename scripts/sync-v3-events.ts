#!/usr/bin/env bun
/**
 * Mirror upcoming wedance.vip (v3) events into the 2026 `events` table, plus the
 * venue / organiser / artist profiles behind them (server/utils/v3ProfileSync.ts),
 * linked to each event so the city page's "Who's on the floor" lights up.
 *
 * Source: Firestore `posts` where type == "event" and startDate >= now (all
 * cities), read through the Firestore REST API with the v3 service account.
 * READ-ONLY against v3 — the script never writes to Firestore.
 *
 * Target: `events` rows with source='wedance-v3', source_id=<v3 post id>
 * (upsert key), archived=false, published=true. Upcoming rows that v3 no longer
 * lists (deleted / unlisted) are set archived=true. Idempotent — safe to re-run.
 * Rollback: DELETE FROM events WHERE source = 'wedance-v3';
 *
 * Usage:
 *   bun run sync:v3-events              # dry-run (default): fetch + map + diff, no DB writes
 *   bun run sync:v3-events --write      # upsert profiles, then events (schema ships in migration 0018)
 *   bun run sync:v3-events --json       # machine-readable summary
 *
 * Env:
 *   DATABASE_URL                         target Postgres (Neon). Check which one before --write!
 *   NEON_FETCH_ENDPOINT                  optional, local Postgres via scripts/dev/neon-http-proxy.ts
 *   WEDANCE_V3_SERVICE_ACCOUNT           v3 Firebase service-account JSON (string), or
 *   WEDANCE_V3_SERVICE_ACCOUNT_FILE      path to it (default ~/Secrets/wedance.json)
 */
import { readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from '../server/database/schema'
import { fetchUpcomingV3Posts, syncV3Events, type ServiceAccount } from '../server/utils/v3EventSync'
import { fetchV3Profiles, syncV3Profiles } from '../server/utils/v3ProfileSync'

const args = new Set(process.argv.slice(2))
const WRITE = args.has('--write')
const JSON_OUT = args.has('--json')
const log = (s: string) => { if (!JSON_OUT) console.error(s) }

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) { console.error('DATABASE_URL environment variable not set'); process.exit(1) }
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT

function loadServiceAccount(): ServiceAccount {
  if (process.env.WEDANCE_V3_SERVICE_ACCOUNT) return JSON.parse(process.env.WEDANCE_V3_SERVICE_ACCOUNT)
  const file = process.env.WEDANCE_V3_SERVICE_ACCOUNT_FILE ?? join(homedir(), 'Secrets', 'wedance.json')
  return JSON.parse(readFileSync(file, 'utf8'))
}

const host = (() => { try { return new URL(dbUrl).host } catch { return '?' } })()
const target = process.env.NEON_FETCH_ENDPOINT ? `${host} via ${process.env.NEON_FETCH_ENDPOINT}` : host
log(`v3 → 2026 event sync · ${WRITE ? 'WRITE' : 'dry-run'} · target DB ${target}`)

const db = drizzle(neon(dbUrl), { schema })
const sa = loadServiceAccount()

const t0 = Date.now()
const docs = await fetchUpcomingV3Posts(sa)
log(`  fetched ${docs.length} upcoming posts from Firestore project ${sa.project_id} (${Date.now() - t0} ms)`)
const v3Profiles = await fetchV3Profiles(sa)
log(`  fetched ${v3Profiles.length} v3 profiles (Venue / Organiser / FanPage / Artist / City)`)

// The sync columns (events.source/source_id/synced_at…, profiles.source_ref) ship in
// migration 0018 — the script no longer applies schema itself (its old 0021/0022
// files were folded into 0018 by #202, which broke every write run from 2026-10-10).

const { plan, summary: profiles } = await syncV3Profiles({ db, docs, v3Profiles, write: WRITE, log })
const summary = await syncV3Events({ db, docs, write: WRITE, log, links: plan.links, extraProfiles: plan.newProfiles })

if (JSON_OUT) {
  console.log(JSON.stringify({ target, events: summary, profiles }, null, 2))
} else {
  const top = (o: Record<string, number>, n = 12) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => `${k} ${v}`).join(', ') || '—'
  console.log(`
Summary (${summary.mode})
  fetched    ${summary.fetched}   (v3 posts with startDate >= now, any type)
  eligible   ${summary.eligible}
  created    ${summary.created}
  updated    ${summary.updated}
  unchanged  ${summary.unchanged}
  archived   ${summary.archived}   (still-upcoming rows no longer listed in v3)
  skipped    ${Object.values(summary.skipped).reduce((a, b) => a + b, 0)}   ${top(summary.skipped)}
  cities     ${Object.keys(summary.byCity).length}   ${top(summary.byCity)}
  unmapped styles (kept as humanised labels): ${top(summary.unmappedStyles)}${summary.schemaReady ? '' : '\n  NOTE: target DB lacks migration 0021/0022 — --write applies them.'}

Profiles (${summary.mode}) — ${profiles.v3ProfilesFetched} v3 profiles fetched
${(['venue', 'organizer', 'artist'] as const).map(t => {
    const s = profiles.byType[t]
    return `  ${t.padEnd(10)} profiles ${String(s.profiles).padStart(4)} · matched ${String(s.matched).padStart(4)} · created ${String(s.created).padStart(4)} · filled ${String(s.filled).padStart(3)} · updated ${String(s.updated).padStart(3)} · private-skipped ${s.skippedPrivate} · events linked ${s.linkedEvents}\n             how: ${top(profiles.how[t] as Record<string, number>)}`
  }).join('\n')}
  events with no venue link: ${profiles.eventsWithoutVenueLink}
  venues created from a bare street address: ${profiles.venuesCreatedFromAddress}${profiles.venuesCreatedFromAddressSample.length ? ' (e.g. ' + profiles.venuesCreatedFromAddressSample.slice(0, 5).join('; ') + ')' : ''}
`)
}
process.exit(0)
