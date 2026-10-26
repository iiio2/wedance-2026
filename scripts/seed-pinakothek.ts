#!/usr/bin/env bun
/**
 * Ensure the Pinakothek der Moderne (Open Air) community venue profile and its
 * 6 bookable areas exist in the database. Idempotent — safe to re-run.
 *
 * Three cases:
 *   1. Profile doesn't exist → create with full community data + 6 areas.
 *   2. Profile exists (e.g. from v3 sync) but lacks areas → enrich it.
 *   3. Full profile + areas already present → no-op.
 *
 * Usage:
 *   bun scripts/seed-pinakothek.ts              # dry-run (default)
 *   bun scripts/seed-pinakothek.ts --write      # apply to DB
 *
 * Env:
 *   DATABASE_URL          target Postgres (Neon)
 *   NEON_FETCH_ENDPOINT   optional, local Postgres proxy
 *
 * Fact-check (2026-10):
 *   - Real community-organised open-air dance spot since ~2017
 *   - Under the roof by the museum's exit doors, Barer Str. 40, 80333 München
 *   - NOT run by the museum — self-organised by Munich's social-dance community
 *   - Free entry, no commercial rental
 *   - Six community-mapped areas (drawn on the WeDance v3 community map)
 *   - Salsa, Bachata, Kizomba, Zouk — roughly May through October
 *   - Volume rules enforced by the community to avoid city fines
 *   - Confirmed by: where-to-dance-salsa.com, social-dance.today,
 *     danceondemand.eu, platzl.de guide, WeDance v3 database
 */
import { neon, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { eq } from 'drizzle-orm'
import * as schema from '../server/database/schema'

const args = new Set(process.argv.slice(2))
const WRITE = args.has('--write')

if (process.env.NEON_FETCH_ENDPOINT) neonConfig.fetchEndpoint = process.env.NEON_FETCH_ENDPOINT

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) { console.error('DATABASE_URL is required'); process.exit(1) }

const sql = neon(DATABASE_URL)
const db = drizzle(sql, { schema })

const HANDLE = 'pinakothek-der-moderne'

const PROFILE_DATA = {
  username: HANDLE,
  type: 'venue' as const,
  name: 'Pinakothek der Moderne (Open Air)',
  city: 'Munich',
  citySlug: 'munich',
  venueType: 'OpenAir',
  bookingModel: 'free',
  bio: 'A free open-air dance commons at the Pinakothek der Moderne — under the roof by the exit doors. Self-organised by the community since 2017, not run by the museum. Six mapped areas; keep to the guidelines and it stays ours.',
  guidelines: `We're at Pina since 2017. We keep this spot by following a few rules that everyone must respect:

1. No music before 7pm.
2. Keep the music volume very low after 10pm — the city can fine us up to €5000. Remind DJs and others if they forget.
3. Don't damage Pina property; park your bike outside the dancing area.
4. Don't block the exit doors with your bags.
5. Keep it clean and take your trash with you.`,
  mapUrl: 'https://firebasestorage.googleapis.com/v0/b/wedance-4abe3.appspot.com/o/media%2FtvR012ArEpQhCJdPHh6G7sLuqoO2%2F45ad2564-fa2b-4169-9f22-0527d8d95e0c?alt=media&token=cf147971-f33a-40b1-84d0-bee0a0cea51d',
  photo: 'https://firebasestorage.googleapis.com/v0/b/wedance-4abe3.appspot.com/o/media%2FtvR012ArEpQhCJdPHh6G7sLuqoO2%2Fdc862207-95df-4573-9e92-6884ce0e7b83?alt=media&token=eb5bb326-9da4-4e2b-8428-c07afe0a707d',
  address: 'By the exit doors, Pinakothek der Moderne · Barer Str. 40, 80333 München',
  floorType: 'stone / open-air',
  moderatorName: 'Community-elected moderator',
  moderatorSince: 2024,
  socials: [
    { platform: 'instagram', url: 'https://instagram.com/pinakothekdermoderne' },
    { platform: 'website', url: 'https://www.pinakothek-der-moderne.de/' },
  ],
}

const AREAS = Array.from({ length: 6 }, (_, i) => ({
  name: `Area ${i + 1}`,
  priceInfo: 'Free',
  description: 'One of the six community-mapped dance areas.',
  sortOrder: i + 1,
}))

async function run() {
  // Check existing profile
  const [existing] = await db
    .select({ id: schema.profiles.id, guidelines: schema.profiles.guidelines })
    .from(schema.profiles)
    .where(eq(schema.profiles.username, HANDLE))

  if (existing?.guidelines) {
    // Full profile — check areas
    const areas = await db
      .select({ id: schema.bookableSpaces.id })
      .from(schema.bookableSpaces)
      .where(eq(schema.bookableSpaces.profileId, existing.id))

    if (areas.length >= 6) {
      console.log(`✓ Pinakothek profile + ${areas.length} areas already in DB — nothing to do.`)
      return
    }

    // Profile exists but missing areas
    console.log(`Profile exists (id=${existing.id}) but only ${areas.length} areas — need ${6 - areas.length} more.`)
    if (!WRITE) { console.log('Dry run — pass --write to apply.'); return }

    for (let i = areas.length; i < 6; i++) {
      await db.insert(schema.bookableSpaces).values({
        profileId: existing.id,
        ...AREAS[i],
      })
    }
    console.log(`✓ Added ${6 - areas.length} areas to existing profile.`)
    return
  }

  if (existing) {
    // Bare profile (e.g. from v3 sync) — enrich with community data
    console.log(`Bare profile found (id=${existing.id}) — enriching with community data.`)
    if (!WRITE) { console.log('Dry run — pass --write to apply.'); return }

    const { username, type, ...updateData } = PROFILE_DATA
    await db
      .update(schema.profiles)
      .set(updateData)
      .where(eq(schema.profiles.id, existing.id))

    const existingAreas = await db
      .select({ id: schema.bookableSpaces.id })
      .from(schema.bookableSpaces)
      .where(eq(schema.bookableSpaces.profileId, existing.id))

    for (let i = existingAreas.length; i < 6; i++) {
      await db.insert(schema.bookableSpaces).values({
        profileId: existing.id,
        ...AREAS[i],
      })
    }
    console.log(`✓ Enriched profile + added ${6 - existingAreas.length} areas.`)
    return
  }

  // No profile — create from scratch
  console.log('No profile found — creating Pinakothek profile + 6 areas.')
  if (!WRITE) { console.log('Dry run — pass --write to apply.'); return }

  const [p] = await db.insert(schema.profiles).values(PROFILE_DATA).returning({ id: schema.profiles.id })
  for (const area of AREAS) {
    await db.insert(schema.bookableSpaces).values({ profileId: p!.id, ...area })
  }
  console.log(`✓ Created profile (id=${p!.id}) + 6 areas.`)
}

run()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1) })
