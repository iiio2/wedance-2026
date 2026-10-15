import { eq, sql } from 'drizzle-orm'
import { handles, dancers, profiles } from '../database/schema'

export type Db = any

/**
 * Step 12 (ADR-004): resolve a handle to its target. Returns the dancer or
 * profile row, or null if the handle isn't registered.
 */
export async function resolveHandle(db: Db, handle: string): Promise<
  | { kind: 'dancer'; id: string; row: any }
  | { kind: 'profile'; id: string; row: any }
  | null
> {
  const [h] = await db.select().from(handles).where(sql`lower(${handles.handle}) = lower(${handle})`)
  if (!h) return null

  if (h.dancerId) {
    const [d] = await db.select().from(dancers).where(eq(dancers.id, h.dancerId))
    return d ? { kind: 'dancer', id: d.id, row: d } : null
  }
  if (h.profileId) {
    const [p] = await db.select().from(profiles).where(eq(profiles.id, h.profileId))
    return p ? { kind: 'profile', id: p.id, row: p } : null
  }
  return null
}

/**
 * Register a handle for a dancer or profile. Throws on collision.
 * Used by sign-up flow and backfill.
 */
export async function registerHandle(
  db: Db,
  handle: string,
  target: { dancerId: string } | { profileId: string },
) {
  await db.insert(handles).values({
    handle,
    ...('dancerId' in target ? { dancerId: target.dancerId, profileId: null } : { dancerId: null, profileId: target.profileId }),
  })
}

/**
 * Generate a collision-free handle from a name. Tries the slug first, then
 * appends a short random suffix. Returns the registered handle.
 */
export async function generateHandle(
  db: Db,
  name: string,
  target: { dancerId: string } | { profileId: string },
): Promise<string> {
  const base = slugify(name)
  // Try the clean slug first
  const [existing] = await db.select({ handle: handles.handle }).from(handles)
    .where(sql`lower(${handles.handle}) = lower(${base})`)
  if (!existing) {
    await registerHandle(db, base, target)
    return base
  }
  // Append a short random suffix
  for (let i = 0; i < 10; i++) {
    const candidate = `${base}-${randomSuffix()}`
    const [clash] = await db.select({ handle: handles.handle }).from(handles)
      .where(sql`lower(${handles.handle}) = lower(${candidate})`)
    if (!clash) {
      await registerHandle(db, candidate, target)
      return candidate
    }
  }
  throw new Error(`Could not generate a unique handle for "${name}" after 10 attempts`)
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'user'
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 6)
}
