/**
 * One-off: v3 venue details → 2026 venue profiles (server/utils/v3VenueDetails.ts).
 * Address, Google Maps link, coordinates, website and business phone from each
 * v3 venue's Google listing; kind of place and amenities from its own fields.
 * Empty fields only; claimed / managed pages untouched; READ-ONLY against v3.
 *
 *   bun scripts/sync-v3-venue-details.ts            # dry-run: counts + a few examples
 *   bun scripts/sync-v3-venue-details.ts --write    # apply; writes a backup first
 *
 * Env: DATABASE_URL (check which one before --write!), NEON_FETCH_ENDPOINT for
 * local Postgres; v3 service account as for sync-v3-events.
 * Rollback: .backups/v3-venue-details-<time>.json holds each row's old values
 * (`before`); restore them with an UPDATE per row.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq, sql } from 'drizzle-orm'
import * as schema from '../server/database/schema'
import { profiles } from '../server/database/schema'
import { fetchV3Profiles } from '../server/utils/v3ProfileSync'
import { planVenueDetails, type LocalVenue } from '../server/utils/v3VenueDetails'
import type { ServiceAccount } from '../server/utils/v3EventSync'

const WRITE = process.argv.includes('--write')
const dbUrl = process.env.DATABASE_URL
if (!dbUrl) { console.error('DATABASE_URL environment variable not set'); process.exit(1) }
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT
const host = (() => { try { return new URL(dbUrl).host } catch { return '?' } })()
console.error(`v3 venue details → 2026 · ${WRITE ? 'WRITE' : 'dry-run'} · target DB ${process.env.NEON_FETCH_ENDPOINT ? `${host} via ${process.env.NEON_FETCH_ENDPOINT}` : host}`)

const sa: ServiceAccount = process.env.WEDANCE_V3_SERVICE_ACCOUNT
  ? JSON.parse(process.env.WEDANCE_V3_SERVICE_ACCOUNT)
  : JSON.parse(readFileSync(process.env.WEDANCE_V3_SERVICE_ACCOUNT_FILE ?? join(homedir(), 'Secrets', 'wedance.json'), 'utf8'))
const db = drizzle(neon(dbUrl), { schema })

const v3 = (await fetchV3Profiles(sa)).filter(p => p.type === 'Venue')
const local = (await db.select({
  id: profiles.id, username: profiles.username, sourceRef: profiles.sourceRef, address: profiles.address, mapUrl: profiles.mapUrl,
  lat: profiles.lat, lng: profiles.lng, socials: profiles.socials, contact: profiles.contact, venueType: profiles.venueType,
  amenities: profiles.amenities, claimed: profiles.claimed,
  managed: sql<boolean>`exists (select 1 from profile_members m where m.profile_id = ${profiles.id})`,
}).from(profiles).where(eq(profiles.type, 'venue'))) as LocalVenue[]

const { plans, unmatched, skippedOwned } = planVenueDetails(v3, local)
const tally: Record<string, number> = {}
for (const p of plans) for (const f of p.fields) tally[f] = (tally[f] ?? 0) + 1
console.error(`v3 venues ${v3.length} · 2026 venues ${local.length} · to update ${plans.length} · not on 2026 ${unmatched} · skipped (claimed or run by someone) ${skippedOwned}`)
console.error(Object.entries(tally).sort((a, b) => b[1] - a[1]).map(([f, n]) => `  ${n}  ${f}`).join('\n'))
for (const p of plans.slice(0, 3)) console.error(`  e.g. @${p.username}: ${p.fields.join(', ')}`)

if (WRITE) {
  const dir = join(process.cwd(), '.backups')
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `v3-venue-details-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  writeFileSync(file, JSON.stringify(plans.map(p => ({ id: p.id, username: p.username, before: p.before })), null, 1))
  console.error(`backup: ${file}`)
  let n = 0
  for (const p of plans) {
    await db.update(profiles).set(p.set as any).where(eq(profiles.id, p.id))
    if (++n % 50 === 0) console.error(`  ${n}/${plans.length}`)
  }
  console.error(`updated ${n}`)
}
