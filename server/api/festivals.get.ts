import { gte, sql, eq, and, inArray } from 'drizzle-orm'
import { useDb } from '../utils/db'
import { festivals, planItems, dancers } from '../database/schema'

/**
 * SSR-friendly festivals directory. Mirrors the cities.get.ts pattern so the
 * /festivals page can fetch with useFetch during SSR (no spinner on mount).
 *
 * Returns upcoming festivals sorted by start date ascending (nearest first).
 * Past festivals (endDate < today) are excluded server-side.
 * signupCount = number of dancers who clicked "Going" (plan_items).
 * goingAvatars = first 5 public dancers going (name + photo) for the avatar stack.
 */
export type GoingAvatar = {
  name: string
  photo: string | null
}

export type FestivalRow = {
  slug: string
  name: string
  startDate: string | null
  endDate: string | null
  city: string | null
  country: string | null
  description: string | null
  styles: string[]
  logo: string | null
  accentColor: string | null
  ticketUrl: string | null
  signupCount: number
  publicGoingCount: number
  goingAvatars: GoingAvatar[]
}

export default defineEventHandler(async (): Promise<FestivalRow[]> => {
  const db = useDb()
  const today = new Date().toISOString().slice(0, 10)

  const rows = await db
    .select({
      slug: festivals.slug,
      name: festivals.name,
      startDate: festivals.startDate,
      endDate: festivals.endDate,
      city: festivals.city,
      country: festivals.country,
      description: festivals.description,
      styles: festivals.styles,
      logo: festivals.logo,
      accentColor: festivals.accentColor,
      ticketUrl: festivals.ticketUrl,
      signupCount: sql<number>`coalesce((
        select count(*)::int from plan_items
        where plan_items.item_type = 'festival'
          and plan_items.item_id = ${festivals.slug}
      ), 0)`,
    })
    .from(festivals)
    .where(gte(festivals.endDate, today))
    .orderBy(festivals.startDate)

  const slugs = rows.map(r => r.slug)

  // Per-festival public going counts + first 5 avatars, both resolved in SQL.
  const avatarsBySlug = new Map<string, GoingAvatar[]>()
  const publicCountBySlug = new Map<string, number>()

  if (slugs.length > 0) {
    // Count public-profile attendees per festival.
    const countRows = await db
      .select({
        festivalSlug: planItems.itemId,
        cnt: sql<number>`count(*)::int`,
      })
      .from(planItems)
      .innerJoin(dancers, eq(planItems.dancerId, dancers.id))
      .where(
        and(
          eq(planItems.itemType, 'festival'),
          inArray(planItems.itemId, slugs),
          eq(dancers.profilePublic, true),
        ),
      )
      .groupBy(planItems.itemId)

    for (const row of countRows) {
      publicCountBySlug.set(row.festivalSlug, Number(row.cnt) || 0)
    }

    // First 5 public avatars per festival via row_number window — avoids
    // fetching every attendee row and capping in JS.
    const avatarRows = await db.execute<{
      festival_slug: string
      name: string
      photo: string | null
    }>(sql`
      select festival_slug, name, photo from (
        select
          pi.item_id as festival_slug,
          d.name,
          d.photo,
          row_number() over (partition by pi.item_id order by pi.created_at) as rn
        from plan_items pi
        inner join dancers d on d.id = pi.dancer_id
        where pi.item_type = 'festival'
          and pi.item_id = any(${slugs})
          and d.profile_public = true
      ) sub
      where rn <= 5
    `)

    for (const row of avatarRows) {
      const slug = row.festival_slug
      const list = avatarsBySlug.get(slug) ?? []
      list.push({ name: row.name, photo: row.photo })
      avatarsBySlug.set(slug, list)
    }
  }

  return rows.map(r => ({
    ...r,
    styles: r.styles ?? [],
    signupCount: Number(r.signupCount) || 0,
    publicGoingCount: publicCountBySlug.get(r.slug) ?? 0,
    goingAvatars: avatarsBySlug.get(r.slug) ?? [],
  }))
})
