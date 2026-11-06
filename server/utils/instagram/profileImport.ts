/**
 * Instagram profile import (#452): fill a WeDance profile page added from an
 * Instagram handle with that account's public name, photo, bio, website and
 * city / address — so a line-up of handles looks like real people.
 *
 * Rules (the same spirit as the v3 profile sync):
 * - Only EMPTY fields are filled. The name only while it is still the handle.
 * - Claimed or managed pages are never written — except the page a dancer has
 *   just created for themselves (business.create), passed with `allowOwned`.
 * - The photo is re-hosted in our storage, never hot-linked to Instagram's CDN.
 * - Every attempt is recorded in source_ref.instagram_import = { at, ok, … },
 *   so failures can be found and retried (scripts/backfill-instagram-profiles.ts).
 *
 * Runs after the response (`scheduleInstagramImport` → ctx.waitUntil), batched:
 * handles added within a moment of each other (an assistant adding a line-up
 * one tool call at a time) go to Apify in one actor run.
 */
import { eq, inArray, sql, and } from 'drizzle-orm'
import { profiles, cities } from '../../database/schema'
import { apifyEnabled, fetchInstagramProfiles, type InstagramProfile } from './apify'
import { rehostImage } from '../rehostImage'

export type ImportTarget = {
  profileId: string
  /** Instagram handle, no @. */
  handle: string
  /** The page may be claimed / managed (a dancer's own new page). Still only empty fields. */
  allowOwned?: boolean
}

export type ProfileRow = {
  id: string
  username: string
  type: string
  name: string
  bio: string | null
  photo: string | null
  city: string | null
  citySlug: string | null
  address: string | null
  socials: { platform: string; url: string }[] | null
  claimed: boolean | null
  managed: boolean
  sourceRef: Record<string, unknown> | null
}

export type FillPlan = {
  name?: string
  bio?: string
  /** Instagram's picture URL, to re-host. */
  photoSource?: string
  socials?: { platform: string; url: string }[]
  city?: { name: string; slug: string }
  address?: string
  fields: string[]
}

export type ImportResult = {
  username: string
  handle: string
  status: 'filled' | 'nothing' | 'not_found' | 'failed' | 'skipped'
  fields: string[]
  reason?: string
}

const empty = (v: string | null | undefined) => !v || !v.trim()
const squash = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]/g, '')

/** True while the display name is just the handle (or its "Ritmo Jg" spelling). */
export function isPlaceholderName(name: string | null | undefined, handle: string) {
  if (empty(name)) return true
  return squash(name!.replace(/^@/, '')) === squash(handle)
}

const PLATFORMS: [RegExp, string][] = [
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$/, 'facebook'],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, 'youtube'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)t\.me$|(^|\.)telegram\.me$/, 'telegram'],
  [/(^|\.)wa\.me$|(^|\.)whatsapp\.com$/, 'whatsapp'],
]

/** The bio link as a social link: { platform, url }, or null when unusable. */
export function socialFromLink(url: string | null | undefined): { platform: string; url: string } | null {
  if (!url) return null
  let u: URL
  try { u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`) }
  catch { return null }
  if (!/^https?:$/.test(u.protocol)) return null
  const host = u.hostname.toLowerCase().replace(/^www\./, '')
  if (!host.includes('.') || /(^|\.)instagram\.com$/.test(host)) return null
  const platform = PLATFORMS.find(([re]) => re.test(host))?.[1] ?? 'website'
  return { platform, url: u.toString() }
}

/** What Instagram adds to this page: only what is empty here. Pure. */
export function planInstagramFill(row: ProfileRow, ig: InstagramProfile, city: { name: string; slug: string } | null): FillPlan {
  const plan: FillPlan = { fields: [] }
  const handle = ig.handle
  if (ig.fullName && isPlaceholderName(row.name, handle) && squash(ig.fullName) && squash(ig.fullName) !== squash(handle)) {
    plan.name = ig.fullName.slice(0, 120)
    plan.fields.push('name')
  }
  if (ig.biography && empty(row.bio)) {
    plan.bio = ig.biography.slice(0, 4000)
    plan.fields.push('bio')
  }
  if (ig.photoUrl && empty(row.photo)) {
    plan.photoSource = ig.photoUrl
    plan.fields.push('photo')
  }
  const link = socialFromLink(ig.externalUrl)
  const socials = row.socials ?? []
  if (link && !socials.some(s => s.platform === link.platform || s.url.replace(/\/$/, '') === link.url.replace(/\/$/, ''))) {
    plan.socials = [...socials, link]
    plan.fields.push(link.platform === 'website' ? 'website' : `social:${link.platform}`)
  }
  if (city && empty(row.city)) {
    plan.city = city
    plan.fields.push('city')
  }
  // A street address is a venue's; for people it would just be their agency.
  if (row.type === 'venue' && empty(row.address) && ig.address?.street) {
    plan.address = [ig.address.street, [ig.address.zip, ig.address.city].filter(Boolean).join(' ')].filter(Boolean).join(', ').slice(0, 300)
    plan.fields.push('address')
  }
  return plan
}

/** Instagram's "Munich, Germany" → the canonical city we know, or null. */
export async function resolveCity(db: any, raw: string | null | undefined): Promise<{ name: string; slug: string } | null> {
  const name = (raw ?? '').split(',')[0]!.trim()
  if (!name) return null
  try {
    const [c] = await db.select({ name: cities.name, slug: cities.slug }).from(cities)
      .where(sql`lower(${cities.name}) = lower(${name}) or lower(${cities.localName}) = lower(${name}) or ${cities.altNames} @> ${JSON.stringify([name])}::jsonb`)
      .limit(1)
    return c ? { name: c.name, slug: c.slug } : null
  } catch {
    return null
  }
}

async function loadRows(db: any, ids: string[]): Promise<ProfileRow[]> {
  if (!ids.length) return []
  return db.select({
    id: profiles.id, username: profiles.username, type: profiles.type, name: profiles.name, bio: profiles.bio, photo: profiles.photo,
    city: profiles.city, citySlug: profiles.citySlug, address: profiles.address, socials: profiles.socials, claimed: profiles.claimed,
    sourceRef: profiles.sourceRef,
    managed: sql<boolean>`exists (select 1 from profile_members m where m.profile_id = ${profiles.id})`,
  }).from(profiles).where(inArray(profiles.id, ids))
}

const RECENT_MS = 7 * 86400_000

export type ImportDeps = {
  fetchProfiles?: (handles: string[]) => Promise<Map<string, InstagramProfile | null>>
  rehost?: (url: string, folder: string) => Promise<string | null>
  now?: () => Date
  /** Re-import pages imported OK in the last week too. */
  force?: boolean
  /** Plan only, write nothing (the backfill's dry run). */
  dryRun?: boolean
}

/**
 * Import these handles now, one actor run for all. Never throws: an Apify
 * failure is recorded on each page as instagram_import { ok: false }.
 */
export async function importInstagramProfiles(db: any, targets: ImportTarget[], deps: ImportDeps = {}): Promise<ImportResult[]> {
  const now = (deps.now ?? (() => new Date()))()
  const byId = new Map<string, ImportTarget>()
  for (const t of targets) {
    const prev = byId.get(t.profileId)
    byId.set(t.profileId, { ...t, handle: t.handle.replace(/^@/, '').toLowerCase(), allowOwned: !!(t.allowOwned || prev?.allowOwned) })
  }
  const rows = await loadRows(db, [...byId.keys()])
  const results: ImportResult[] = []
  const todo: { row: ProfileRow; t: ImportTarget }[] = []
  for (const row of rows) {
    const t = byId.get(row.id)!
    const last = (row.sourceRef as any)?.instagram_import as { at?: string; ok?: boolean } | undefined
    if ((row.claimed || row.managed) && !t.allowOwned) results.push({ username: row.username, handle: t.handle, status: 'skipped', fields: [], reason: 'claimed' })
    else if (!deps.force && last?.ok && last.at && now.getTime() - new Date(last.at).getTime() < RECENT_MS) results.push({ username: row.username, handle: t.handle, status: 'skipped', fields: [], reason: 'imported recently' })
    else todo.push({ row, t })
  }
  if (!todo.length) return results

  let found: Map<string, InstagramProfile | null>
  try {
    found = await (deps.fetchProfiles ?? fetchInstagramProfiles)(todo.map(x => x.t.handle))
  } catch (e: any) {
    const error = String(e?.message ?? e).slice(0, 300)
    console.warn(`[instagram] import failed for ${todo.length} profile(s): ${error}`)
    for (const { row, t } of todo) {
      if (!deps.dryRun) await record(db, row, t, { at: now.toISOString(), ok: false, handle: t.handle, error })
      results.push({ username: row.username, handle: t.handle, status: 'failed', fields: [], reason: error })
    }
    return results
  }
  // No token → nothing came back, nothing to record (silent no-op).
  if (!found.size) return [...results, ...todo.map(({ row, t }) => ({ username: row.username, handle: t.handle, status: 'skipped' as const, fields: [], reason: 'apify off' }))]

  for (const { row, t } of todo) {
    const ig = found.get(t.handle)
    if (!ig) {
      if (!deps.dryRun) await record(db, row, t, { at: now.toISOString(), ok: false, handle: t.handle, error: 'not_found' })
      results.push({ username: row.username, handle: t.handle, status: 'not_found', fields: [] })
      continue
    }
    const plan = planInstagramFill(row, ig, await resolveCity(db, ig.address?.city))
    if (deps.dryRun) {
      results.push({ username: row.username, handle: t.handle, status: plan.fields.length ? 'filled' : 'nothing', fields: plan.fields })
      continue
    }
    let photo: string | null = null
    if (plan.photoSource) {
      photo = await (deps.rehost ?? rehostOrNull)(plan.photoSource, 'profiles')
      if (!photo) plan.fields = plan.fields.filter(f => f !== 'photo')
    }
    await write(db, row, t, plan, photo, { at: now.toISOString(), ok: true, handle: t.handle, fields: plan.fields, ...(plan.photoSource && !photo ? { photo: 'not stored' } : {}) })
    results.push({ username: row.username, handle: t.handle, status: plan.fields.length ? 'filled' : 'nothing', fields: plan.fields })
  }
  return results
}

/** Our Cloudinary copy of Instagram's picture, or null (upload not set up, CDN link refused). */
async function rehostOrNull(url: string, folder: 'profiles'): Promise<string | null> {
  try {
    return await rehostImage(url, folder)
  } catch (e: any) {
    console.warn(`[instagram] photo not stored: ${e?.message ?? e}`)
    return null
  }
}

const mergeRef = (status: Record<string, unknown>) =>
  sql`coalesce(${profiles.sourceRef}, '{}'::jsonb) || ${JSON.stringify({ instagram_import: status })}::jsonb`

// Re-checked at write time: the page may have been claimed while Apify ran.
const stillOpen = (t: ImportTarget) => t.allowOwned
  ? sql`true`
  : sql`${profiles.claimed} is not true and not exists (select 1 from profile_members m where m.profile_id = ${profiles.id})`

async function record(db: any, row: ProfileRow, t: ImportTarget, status: Record<string, unknown>) {
  await db.update(profiles).set({ sourceRef: mergeRef(status) }).where(and(eq(profiles.id, row.id), stillOpen(t)))
}

async function write(db: any, row: ProfileRow, t: ImportTarget, plan: FillPlan, photo: string | null, status: Record<string, unknown>) {
  const set: Record<string, unknown> = { sourceRef: mergeRef(status) }
  // Each column only if still empty when written (coalesce/nullif), so a manual
  // edit made in the meantime wins.
  if (plan.name) set.name = sql`case when ${profiles.name} = ${row.name} then ${plan.name} else ${profiles.name} end`
  if (plan.bio) set.bio = sql`coalesce(nullif(trim(${profiles.bio}), ''), ${plan.bio})`
  if (photo) set.photo = sql`coalesce(nullif(trim(${profiles.photo}), ''), ${photo})`
  if (plan.socials) set.socials = plan.socials
  if (plan.city) {
    set.city = sql`coalesce(nullif(trim(${profiles.city}), ''), ${plan.city.name})`
    set.citySlug = sql`coalesce(nullif(trim(${profiles.citySlug}), ''), ${plan.city.slug})`
  }
  if (plan.address) set.address = sql`coalesce(nullif(trim(${profiles.address}), ''), ${plan.address})`
  await db.update(profiles).set(set).where(and(eq(profiles.id, row.id), stillOpen(t)))
}

// ---- After the response, batched -------------------------------------------

const BATCH_MS = 1500
const BATCH_MAX = 25
type Batch = { db: any; targets: ImportTarget[]; done: Promise<void>; flush: () => void }
let open: Batch | null = null

function enqueue(db: any, targets: ImportTarget[], delayMs: number): Promise<void> {
  if (!open) {
    let flush!: () => void
    const done = new Promise<void>((resolve) => {
      flush = () => {
        if (b !== open) return
        open = null
        clearTimeout(timer)
        importInstagramProfiles(b.db, b.targets)
          .catch((e) => console.warn(`[instagram] import crashed: ${e?.message ?? e}`))
          .finally(resolve)
      }
    })
    const b: Batch = { db, targets: [], done, flush }
    const timer = setTimeout(() => b.flush(), delayMs)
    open = b
  }
  const b = open
  b.targets.push(...targets)
  if (b.targets.length >= BATCH_MAX) b.flush()
  return b.done
}

/**
 * Import after the response. A silent no-op without APIFY_TOKEN. The work is
 * handed to ctx.waitUntil so the serverless function lives until it's done.
 * Returns the promise (tests await it).
 */
export function scheduleInstagramImport(
  ctx: { db: any; waitUntil?: (p: Promise<unknown>) => void },
  targets: ImportTarget[],
  opts: { delayMs?: number } = {},
): Promise<void> | null {
  const list = targets.filter(t => t.profileId && t.handle)
  if (!list.length || !apifyEnabled()) return null
  const p = enqueue(ctx.db, list, opts.delayMs ?? BATCH_MS)
  if (ctx.waitUntil) ctx.waitUntil(p)
  return p
}
