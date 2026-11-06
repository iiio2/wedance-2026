import { eq, and, inArray } from 'drizzle-orm'
import { dancers, profiles, profileMembers } from '../database/schema'

/**
 * One handle per person (#474, ADR-012). A dancer may mark one page they own as
 * "this is me" (`dancers.page_profile_id`). That page's /@handle is then their
 * public identity: /u/<username> forwards to it, and the page shows their dancer
 * side and the other pages they run.
 *
 * Only pages that can be a person: an artist, or an organiser / promoter who
 * runs events under their own name. Venues are places, never people.
 */
export const PERSON_PAGE_TYPES = ['artist', 'organizer', 'promoter'] as const

export function canBePersonPage(type: string | null | undefined) {
  return (PERSON_PAGE_TYPES as readonly string[]).includes(type ?? '')
}

export type PersonOnPage = {
  // The dancer's own handle — for their year plan (plan.sharedPlan).
  username: string | null
  role: string | null
  danceStyles: string[]
  // Other visible pages this person owns (their school, festival, venue). Never
  // another artist page: that's someone else they manage, not something they run.
  runs: { username: string; name: string; type: string; photo: string | null }[]
}

/**
 * The person behind a page, or null. A dancer whose profile is private stays
 * private: the page then shows only itself, never who owns it.
 */
export async function personForPage(db: any, profileId: string): Promise<PersonOnPage | null> {
  const [d] = await db
    .select({
      id: dancers.id,
      username: dancers.username,
      role: dancers.role,
      danceStyles: dancers.danceStyles,
      profilePublic: dancers.profilePublic,
    })
    .from(dancers)
    .where(eq(dancers.pageProfileId, profileId))
  if (!d || d.profilePublic === false) return null

  const owned = await db
    .select({ profileId: profileMembers.profileId })
    .from(profileMembers)
    .where(and(eq(profileMembers.dancerId, d.id), eq(profileMembers.role, 'owner')))
  const ids = owned.map((m: { profileId: string }) => m.profileId).filter((id: string) => id !== profileId)
  const runs = ids.length
    ? await db
        .select({ username: profiles.username, name: profiles.name, type: profiles.type, photo: profiles.photo })
        .from(profiles)
        .where(and(inArray(profiles.id, ids), eq(profiles.status, 'visible')))
    : []

  return {
    username: d.username ?? null,
    role: d.role ?? null,
    danceStyles: d.danceStyles ?? [],
    runs: runs.filter((r: any) => r.type !== 'artist').map((r: any) => ({ username: r.username, name: r.name, type: r.type, photo: r.photo ?? null })),
  }
}

/** The handle a dancer's public identity lives at: their page when it's set and visible. */
export async function pageHandleFor(db: any, pageProfileId: string | null | undefined): Promise<string | null> {
  if (!pageProfileId) return null
  const [p] = await db
    .select({ username: profiles.username })
    .from(profiles)
    .where(and(eq(profiles.id, pageProfileId), eq(profiles.status, 'visible')))
  return p?.username ?? null
}
