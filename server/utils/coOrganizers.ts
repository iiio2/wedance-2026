import { inArray } from 'drizzle-orm'
import { profiles } from '../database/schema'
import { coOrganizerRole, type CoOrganizer } from '../../shared/utils/coOrganizers'

export type CoOrganizerView = { username: string; name: string; photo: string | null; type: string | null; role: string }

/** An event's co-organisers with their page's name and photo, for the event page (#456). */
export async function resolveCoOrganizers(db: any, list: CoOrganizer[] | null | undefined): Promise<CoOrganizerView[]> {
  if (!list?.length) return []
  const rows = await db.select({ username: profiles.username, name: profiles.name, photo: profiles.photo, type: profiles.type })
    .from(profiles).where(inArray(profiles.username, list.map(c => c.username)))
  const byHandle = new Map<string, any>(rows.map((r: any) => [r.username, r]))
  return list.map((c) => {
    const p = byHandle.get(c.username)
    return { username: c.username, name: p?.name || `@${c.username}`, photo: p?.photo ?? null, type: p?.type ?? null, role: coOrganizerRole(c) }
  })
}
