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

  // Fetch the first few public dancers going to each festival for avatar stacks.
  // Uses a lateral join equivalent: fetch all going dancers for these festivals,
  // then group and cap in JS (row count is small — tens of festivals × ~50 each).
  let avatarsBySlug = new Map<string, GoingAvatar[]>()

  if (slugs.length > 0) {
    const goingRows = await db
      .select({
        festivalSlug: planItems.itemId,
        name: dancers.name,
        photo: dancers.photo,
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

    for (const row of goingRows) {
      const slug = row.festivalSlug
      const list = avatarsBySlug.get(slug) ?? []
      if (list.length < 5) {
        list.push({ name: row.name, photo: row.photo })
      }
      avatarsBySlug.set(slug, list)
    }
  }

  return rows.map(r => ({
    ...r,
    styles: r.styles ?? [],
    signupCount: Number(r.signupCount) || 0,
    goingAvatars: avatarsBySlug.get(r.slug) ?? [],
  }))
})
