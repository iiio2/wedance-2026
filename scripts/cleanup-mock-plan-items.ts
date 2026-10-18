#!/usr/bin/env bun
/**
 * Delete plan items that point at mock data. The old /my-plan onboarding
 * auto-fill wrote mock city classes/socials (`muc-3`, Berlin ids…) and
 * preview-only festivals (`timba-fest-london-2026`…) into real dancers' plans;
 * they show up as courses and festivals nobody signed up for.
 *
 * Mock ids are DERIVED from app/data/mock-*.ts (every `id` / `slug` in their
 * exports), never hand-typed. Only plan items of type 'event' or 'festival'
 * are considered, and an id that is also a real row (festivals.slug, an event
 * slug or festival key) is kept: several mock festival slugs are real
 * festivals, and plans for those are real choices. Workshops and goals are
 * never touched. Idempotent — re-running after --write finds nothing.
 *
 * Usage:
 *   bun scripts/cleanup-mock-plan-items.ts            # dry-run (default): counts per id and per dancer, no writes
 *   bun scripts/cleanup-mock-plan-items.ts --write    # delete them
 *   bun scripts/cleanup-mock-plan-items.ts --json     # machine-readable summary
 *
 * Env:
 *   DATABASE_URL           target Postgres (Neon). Check which one before --write!
 *   NEON_FETCH_ENDPOINT    optional, local Postgres via scripts/dev/neon-http-proxy.ts
 *
 * Rollback: none needed for dry-run. Before --write, keep the dry-run --json
 * output; each listed row can be re-inserted (dancer_id, item_type, item_id).
 */
import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { and, inArray, sql } from 'drizzle-orm'
import * as schema from '../server/database/schema'
import { collectMockIds, countMockBy, selectMockPlanItems } from '../server/utils/mockPlanCleanup'

const args = new Set(process.argv.slice(2))
const WRITE = args.has('--write')
const JSON_OUT = args.has('--json')
const log = (s: string) => { if (!JSON_OUT) console.error(s) }

const dbUrl = process.env.DATABASE_URL
if (!dbUrl) { console.error('DATABASE_URL environment variable not set'); process.exit(1) }
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT

const host = (() => { try { return new URL(dbUrl).host } catch { return '?' } })()
log(`mock plan-item cleanup · ${WRITE ? 'WRITE' : 'dry-run'} · target DB ${process.env.NEON_FETCH_ENDPOINT ? `${host} via ${process.env.NEON_FETCH_ENDPOINT}` : host}`)

// 1. Mock ids from every app/data/mock-*.ts.
const dataDir = fileURLToPath(new URL('../app/data/', import.meta.url))
const files = readdirSync(dataDir).filter(f => /^mock-.*\.ts$/.test(f)).sort()
const modules = await Promise.all(files.map(f => import(join(dataDir, f))))
const mockIds = collectMockIds(modules)
log(`  ${mockIds.size} mock ids from ${files.length} files (${files.join(', ')})`)

const db = drizzle(neon(dbUrl), { schema })
const ids = [...mockIds]

// 2. Plan items pointing at them, and which of those ids are real rows.
const rows = ids.length
  ? await db
      .select({ id: schema.planItems.id, dancerId: schema.planItems.dancerId, itemType: schema.planItems.itemType, itemId: schema.planItems.itemId })
      .from(schema.planItems)
      .where(and(inArray(schema.planItems.itemType, ['event', 'festival']), inArray(schema.planItems.itemId, ids)))
  : []
const realFestivals = ids.length ? await db.select({ id: schema.festivals.slug }).from(schema.festivals).where(inArray(schema.festivals.slug, ids)) : []
const realEvents = ids.length
  ? await db.select({ slug: schema.events.slug, key: sql<string | null>`${schema.events.festival}->>'key'` }).from(schema.events)
      .where(sql`${schema.events.slug} in ${ids} or ${schema.events.festival}->>'key' in ${ids}`)
  : []
const realIds = new Set<string>([
  ...realFestivals.map(r => r.id),
  ...realEvents.flatMap(r => [r.slug, r.key].filter(Boolean) as string[]),
])

const doomed = selectMockPlanItems(rows, mockIds, realIds)

// 3. Report.
const dancerIds = [...new Set(doomed.map(r => r.dancerId))]
const people = dancerIds.length
  ? await db.select({ id: schema.dancers.id, name: schema.dancers.name, username: schema.dancers.username }).from(schema.dancers).where(inArray(schema.dancers.id, dancerIds))
  : []
const who = new Map(people.map(p => [p.id, `${p.name}${p.username ? ` (@${p.username})` : ''} ${p.id}`]))
const perId = countMockBy(doomed, r => `${r.itemType}:${r.itemId}`)
const perDancer = countMockBy(doomed, r => who.get(r.dancerId) ?? r.dancerId)
const kept = rows.length - doomed.length

if (JSON_OUT) {
  console.log(JSON.stringify({ mode: WRITE ? 'write' : 'dry-run', mockIds: mockIds.size, matched: rows.length, keptAsReal: kept, toDelete: doomed.length, dancers: dancerIds.length, perId: Object.fromEntries(perId), perDancer: Object.fromEntries(perDancer), rows: doomed }, null, 2))
} else {
  log(`  ${rows.length} event/festival plan items use a mock id; ${kept} kept (the id is also a real festival/event)`)
  log(`  ${doomed.length} to delete across ${dancerIds.length} dancers`)
  log('\n  per id:')
  for (const [k, n] of perId) log(`    ${String(n).padStart(4)}  ${k}`)
  log('\n  per dancer:')
  for (const [k, n] of perDancer) log(`    ${String(n).padStart(4)}  ${k}`)
}

// 4. Delete (only with --write).
if (WRITE && doomed.length) {
  const chunk = 200
  let deleted = 0
  for (let i = 0; i < doomed.length; i += chunk) {
    const part = doomed.slice(i, i + chunk).map(r => r.id)
    const res: any = await db.delete(schema.planItems).where(inArray(schema.planItems.id, part)).returning({ id: schema.planItems.id })
    deleted += res.length
  }
  log(`\n  deleted ${deleted} plan items`)
} else if (!WRITE) {
  log('\n  dry-run: nothing written. Re-run with --write to delete.')
}
