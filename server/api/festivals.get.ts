import { gte, sql, eq, and, inArray } from 'drizzle-orm'
import { useDb } from '../utils/db'
import { festivals, festivalSignups, dancers } from '../database/schema'

/**
 * SSR-friendly festivals directory. Mirrors the cities.get.ts pattern so the
 * /festivals page can fetch with useFetch during SSR (no spinner on mount).
 *
 * Returns upcoming festivals sorted by start date ascending (nearest first).
 * Past festivals (endDate < today) are excluded server-side.
 * signupCount = number of dancers who clicked "Going" (plan_items).
 * publicGoingCount = verified ticket holders with public profiles (RAZ-314).
 * goingAvatars = first 5 verified ticket holders (RAZ-314, "no fake friends").
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
      id: festivals.id,
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

  const festivalIds = rows.map(r => r.id)
  const slugById = new Map(rows.map(r => [r.id, r.slug]))

  // Per-festival verified-ticket-holder counts + first 5 avatars (RAZ-314).
  const avatarsBySlug = new Map<string, GoingAvatar[]>()
  const publicCountBySlug = new Map<string, number>()

  if (festivalIds.length > 0) {
    // Count verified ticket holders with public profiles per festival.
    const countRows = await db
      .select({
        festivalId: festivalSignups.festivalId,
        cnt: sql<number>`count(*)::int`,
      })
      .from(festivalSignups)
      .innerJoin(dancers, eq(festivalSignups.dancerId, dancers.id))
      .where(
        and(
          inArray(festivalSignups.festivalId, festivalIds),
          eq(festivalSignups.verifiedTicketHolder, true),
          eq(dancers.profilePublic, true),
        ),
      )
      .groupBy(festivalSignups.festivalId)

    for (const row of countRows) {
      const slug = slugById.get(row.festivalId)
      if (slug) publicCountBySlug.set(slug, Number(row.cnt) || 0)
    }

    // First 5 verified-ticket-holder avatars per festival via row_number
    // window — avoids fetching every row and capping in JS.
    const avatarResult = await db.execute<{
      festival_id: string
      name: string
      photo: string | null
    }>(sql`
      select festival_id, name, photo from (
        select
          fs.festival_id,
          d.name,
          d.photo,
          row_number() over (partition by fs.festival_id order by fs.created_at) as rn
        from festival_signups fs
        inner join dancers d on d.id = fs.dancer_id
        where fs.verified_ticket_holder = true
          and fs.roster_visibility <> 'hidden'
          and fs.festival_id in (${sql.join(festivalIds.map(id => sql`${id}`), sql`, `)})
          and d.profile_public = true
      ) sub
      where rn <= 5
    `)
    // neon-http returns { rows }, not an array (RAZ-297).
    const avatarRows = (avatarResult as unknown as { rows?: typeof avatarResult }).rows ?? avatarResult

    for (const row of avatarRows) {
      const slug = slugById.get(row.festival_id)
      if (!slug) continue
      const list = avatarsBySlug.get(slug) ?? []
      list.push({ name: row.name, photo: row.photo })
      avatarsBySlug.set(slug, list)
    }
  }

  return rows.map(r => ({
    slug: r.slug,
    name: r.name,
    startDate: r.startDate,
    endDate: r.endDate,
    city: r.city,
    country: r.country,
    description: r.description,
    styles: r.styles ?? [],
    logo: r.logo,
    accentColor: r.accentColor,
    ticketUrl: r.ticketUrl,
    signupCount: Number(r.signupCount) || 0,
    publicGoingCount: publicCountBySlug.get(r.slug) ?? 0,
    goingAvatars: avatarsBySlug.get(r.slug) ?? [],
  }))
})
