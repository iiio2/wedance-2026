#!/usr/bin/env bun
/**
 * Backfill the canonical `cities` table from every free-text city we store.
 *
 *   bun scripts/cities/backfill.ts                       dry run (default): reads, prints the plan, NO Google calls
 *   bun scripts/cities/backfill.ts --sample=5            dry run + resolve up to 5 values through Google to prove the mapping
 *   bun scripts/cities/backfill.ts --only="Munich|İstanbul"   dry run sample of specific values (max 5)
 *   bun scripts/cities/backfill.ts --apply --db=<url>    resolve everything (cached) and write `cities` rows
 *
 * Sources (read-only): dancers.city, profiles.city, events.city, festivals.city,
 * gigs.location, festival_ride_shares.origin_city — from DATABASE_URL (or
 * --source=<url>) — plus server/data/city-images.json. Values are grouped by
 * folded spelling ("München" / "münchen " → one lookup).
 *
 * Per value: Places Autocomplete (types=(cities), English) → top prediction →
 * the same resolve path the app uses (Details in English, + local language once
 * for non-English countries). Every Google response is cached in
 * scripts/cities/.cache/places.json, so re-runs and --apply after a dry run with
 * --sample never pay twice. A mapping report (value → canonical city, with a
 * confidence flag for review) goes to scripts/cities/.cache/report.json.
 *
 * Writes ONLY to the `cities` table, ONLY with --apply AND an explicit --db.
 * Migration 0024 must be applied to that database first. It does not touch the
 * free-text columns — moving them to city_id is a separate step
 * (docs/research/2026-10-12-city-canonicalisation.md).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from '../../server/database/schema'
import { createPlacesClient, type PlaceDetails, type PlacePrediction, type PlacesClient } from '../../server/utils/cities/google'
import { createCityService } from '../../server/utils/cities/service'
import { createDrizzleCityStore } from '../../server/utils/cities/store'
import { localLanguage } from '../../server/utils/cities/names'
import { normalizeCity, titleFromSlug } from '../../shared/utils/citySearch'

const here = dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, v] = a.replace(/^--/, '').split('=')
  return [k, v ?? 'true']
})) as Record<string, string>

const APPLY = args.apply === 'true'
const SAMPLE = Math.min(Number(args.sample ?? 0) || 0, 5)
const CACHE_DIR = args.cache ?? join(here, '.cache')
const CACHE_FILE = join(CACHE_DIR, 'places.json')
const REPORT_FILE = join(CACHE_DIR, 'report.json')
const SOURCE_URL = args.source ?? process.env.DATABASE_URL

if (APPLY && !args.db) {
  console.error('--apply needs an explicit --db=<url> (the database to write cities into).')
  process.exit(1)
}
if (!SOURCE_URL) {
  console.error('No source database: set DATABASE_URL or pass --source=<url>.')
  process.exit(1)
}
if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT

// ---------------------------------------------------------------------------
// 1. Collect distinct values (read-only)
// ---------------------------------------------------------------------------
const COLUMNS = [
  ['dancers', 'city'], ['profiles', 'city'], ['events', 'city'], ['festivals', 'city'],
  ['gigs', 'location'], ['festival_ride_shares', 'origin_city'],
] as const

type Value = { value: string, variants: Map<string, number>, uses: Record<string, number>, total: number, alts: Set<string> }

async function collect(): Promise<Value[]> {
  const sql = neon(SOURCE_URL!)
  const groups = new Map<string, Value>()
  const add = (raw: string, where: string, n: number, alts: string[] = []) => {
    const v = raw.trim().replace(/\s+/g, ' ')
    const key = normalizeCity(v)
    if (!key) return
    const g = groups.get(key) ?? { value: v, variants: new Map(), uses: {}, total: 0, alts: new Set<string>() }
    for (const a of alts) g.alts.add(a)
    g.variants.set(v, (g.variants.get(v) ?? 0) + n)
    g.uses[where] = (g.uses[where] ?? 0) + n
    g.total += n
    groups.set(key, g)
  }
  for (const [table, col] of COLUMNS) {
    // Identifiers are from the constant list above, never user input.
    const rows = await sql.query(`SELECT "${col}" AS v, count(*)::int AS n FROM "${table}" WHERE "${col}" IS NOT NULL GROUP BY 1`) as { v: string, n: number }[]
    for (const r of rows) add(r.v, `${table}.${col}`, r.n)
  }
  const images = JSON.parse(readFileSync(join(here, '../../server/data/city-images.json'), 'utf8')) as Record<string, { altNames?: string[] }>
  for (const [slug, img] of Object.entries(images)) {
    // Same naming rule as the catalogue: an alt spelling that slugifies back to the key, else the title-cased slug.
    const name = (img.altNames ?? []).find(a => normalizeCity(a).replace(/ /g, '-') === slug) ?? titleFromSlug(slug)
    // Its Wikipedia alt spellings (Мюнхен, Munique …) become alt names of the canonical city.
    add(name, 'city-images.json', 0, img.altNames ?? [])
  }
  for (const g of groups.values()) g.value = [...g.variants.entries()].sort((a, b) => b[1] - a[1])[0]![0]
  return [...groups.values()].sort((a, b) => b.total - a.total)
}

// ---------------------------------------------------------------------------
// 2. Cached Places client — every response is persisted to the cache file
// ---------------------------------------------------------------------------
type Cache = { autocomplete: Record<string, PlacePrediction[]>, details: Record<string, PlaceDetails | null> }

function loadCache(): Cache {
  if (!existsSync(CACHE_FILE)) return { autocomplete: {}, details: {} }
  return JSON.parse(readFileSync(CACHE_FILE, 'utf8'))
}
function saveCache(c: Cache) {
  mkdirSync(CACHE_DIR, { recursive: true })
  writeFileSync(CACHE_FILE, JSON.stringify(c, null, 1))
}

function cachedPlaces(cache: Cache, live: PlacesClient | null): PlacesClient & { live: number } {
  let liveCalls = 0
  const need = () => {
    if (!live) throw new Error('GOOGLE_MAPS_API_KEY missing')
    liveCalls++
    return live
  }
  return {
    get calls() { return liveCalls },
    get live() { return liveCalls },
    async autocomplete(input, opts) {
      const k = `${opts.language ?? 'en'}:${normalizeCity(input)}`
      if (!(k in cache.autocomplete)) { cache.autocomplete[k] = await need().autocomplete(input, opts); saveCache(cache) }
      return cache.autocomplete[k]!
    },
    async details(placeId, opts) {
      const k = `${opts.language ?? 'en'}:${placeId}`
      if (!(k in cache.details)) { cache.details[k] = await need().details(placeId, opts); saveCache(cache) }
      return cache.details[k] ?? null
    },
  }
}

/** Calls a value still needs: autocomplete (if uncached) + details en + details local (if needed & uncached). */
function callsNeeded(cache: Cache, v: Value): number {
  const preds = cache.autocomplete[`en:${normalizeCity(v.value)}`]
  if (!preds) return 3 // worst case: autocomplete + en + local (estimate refined below)
  const top = preds[0]
  if (!top) return 0
  let n = 0
  const en = cache.details[`en:${top.placeId}`]
  if (en === undefined) return 2 + 1
  const cc = en?.addressComponents.find(c => c.types.includes('country'))?.short_name
  const lang = localLanguage(cc)
  if (lang && cache.details[`${lang}:${top.placeId}`] === undefined) n++
  return n
}

// ---------------------------------------------------------------------------
// 3. Run
// ---------------------------------------------------------------------------
const values = await collect()
const cache = loadCache()
const before = values.reduce((n, v) => n + callsNeeded(cache, v), 0)
const key = process.env.GOOGLE_MAPS_API_KEY
const live = key ? createPlacesClient(key) : null
const places = cachedPlaces(cache, live)

// Store: real one only with --apply; otherwise an in-memory store so the dry run
// exercises the exact resolve path (slugs, twins, alt names) without writing.
const memRows: any[] = []
const memoryStore = {
  async available() { return true },
  async list() { return memRows },
  async slugTaken(s: string) { return memRows.some(r => r.slug === s) },
  async insert(row: any) {
    const ex = memRows.find(r => r.googlePlaceId === row.googlePlaceId)
    if (ex) return { row: ex, created: false }
    const saved = { ...row, id: `dry-${memRows.length + 1}` }
    memRows.push(saved)
    return { row: saved, created: true }
  },
  async updateAltNames(id: string, alt: string[]) { memRows.find(r => r.id === id)!.altNames = alt },
}
// The target is written over a plain Postgres connection (works for Neon's
// connection string and a local copy alike), independent of the source driver.
const pool = APPLY ? new pg.Pool({ connectionString: args.db, max: 2 }) : null
const store = pool ? createDrizzleCityStore(drizzlePg(pool, { schema })) : memoryStore
if (APPLY && !(await store.available())) {
  console.error('The target database has no "cities" table — apply server/database/migrations/0024_cities.sql first.')
  await pool?.end()
  process.exit(1)
}
const service = createCityService({ store, places, fallback: async () => [], log: { info() {}, warn() {}, error: console.error }, resolvePerMinute: 1e9, searchPerMinute: 1e9 })

const only = args.only ? args.only.split('|').map(normalizeCity) : null
const picked = only ? values.filter(v => only.includes(normalizeCity(v.value))) : null
// --only also narrows --apply (e.g. to test a write against a local copy with cached responses).
const toResolve = APPLY ? (picked ?? values) : picked ? picked.slice(0, 5) : values.slice(0, SAMPLE)
const report: any[] = []

for (const v of toResolve) {
  const entry: any = { value: v.value, variants: [...v.variants.keys()], uses: v.uses, total: v.total }
  try {
    const preds = await places.autocomplete(v.value, { language: 'en' })
    const top = preds[0]
    if (!top) { entry.status = 'no-match'; report.push(entry); continue }
    await service.resolve(top.placeId, { query: v.value, trustQuery: true })
    // Remember every spelling we hold for it (no Google calls — the city is known now).
    for (const variant of [...v.variants.keys(), ...v.alts]) if (variant !== v.value) await service.resolve(top.placeId, { query: variant, trustQuery: true })
    const c = (await service.resolve(top.placeId)).city // latest row, with every spelling merged
    const same = normalizeCity(c.name) === normalizeCity(v.value) || normalizeCity(c.localName ?? '') === normalizeCity(v.value)
    entry.status = same ? 'ok' : 'review'
    entry.canonical = { name: c.name, localName: c.localName, slug: c.slug, country: c.country, region: c.region, placeId: c.placeId, altNames: c.altNames }
    entry.alternatives = preds.slice(1, 3).map(p => p.description)
  }
  catch (err) {
    entry.status = 'error'
    entry.error = (err as Error).message
  }
  report.push(entry)
}

mkdirSync(CACHE_DIR, { recursive: true })
writeFileSync(REPORT_FILE, JSON.stringify({ generatedAt: new Date().toISOString(), apply: APPLY, values: values.length, resolved: report }, null, 1))

const sum = (k: string) => values.reduce((n, v) => n + (v.uses[k] ?? 0), 0)
console.log(`\n${APPLY ? 'APPLY' : 'DRY RUN'} — ${values.length} distinct city values (folded)`)
for (const [t, c] of COLUMNS) console.log(`  ${`${t}.${c}`.padEnd(32)} ${sum(`${t}.${c}`)} rows`)
console.log(`  ${'city-images.json'.padEnd(32)} ${values.filter(v => 'city-images.json' in v.uses).length} cities`)
console.log(`\nGoogle calls: made this run ${places.live} · cached ${Object.keys(cache.autocomplete).length} autocomplete + ${Object.keys(cache.details).length} details`)
const after = values.reduce((n, v) => n + callsNeeded(cache, v), 0)
console.log(`Full run would need at most ~${after} more calls (was ${before} before this run): autocomplete + details en + details local per value, minus cache hits;`)
console.log(`  local-language details are skipped for English-speaking and multi-language countries, so expect fewer).`)
for (const e of report) {
  const to = e.canonical ? `${e.canonical.name} (${e.canonical.country}) slug=${e.canonical.slug} local=${e.canonical.localName ?? '—'}` : e.error ?? '—'
  console.log(`  [${e.status}] ${e.value} → ${to}`)
}
if (!APPLY) {
  console.log(`\nWould insert ${memRows.length} of the sampled values into cities (dry run — nothing written).`)
  console.log(`Run with --apply --db=<url> to resolve all ${values.length} values and write the cities table.`)
}
console.log(`Report: ${REPORT_FILE}`)
await pool?.end()
