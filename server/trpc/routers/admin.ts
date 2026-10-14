import { z } from 'zod'
import { eq, and, sql } from 'drizzle-orm'
import { router, adminProcedure } from '../trpc'
import { dinners, dinnerSignups, dinnerGroups, dinnerGroupMembers, dancers, festivals } from '../../database/schema'

// Business profiles each user manages, as JSON, for the users list.
const managedProfiles = sql<{ username: string; name: string; type: string; role: string }[]>`coalesce((
  select json_agg(json_build_object('username', p.username, 'name', p.name, 'type', p.type, 'role', m.role) order by p.name)
  from profile_members m join profiles p on p.id = m.profile_id where m.dancer_id = "dancers"."id"
), '[]'::json)`
const pendingClaims = sql<number>`(select count(*)::int from profile_claims c where c.dancer_id = "dancers"."id" and c.status = 'pending')`

export const adminRouter = router({
  // Every user, newest first, with the business profiles they manage. Search by
  // name or email; "business" keeps only people who manage or claim a profile.
  users: adminProcedure
    .input(z.object({ q: z.string().trim().max(120).default(''), business: z.boolean().default(false), offset: z.number().int().min(0).default(0) }))
    .query(async ({ ctx, input }) => {
      const like = `%${input.q}%`
      const where = and(
        input.q ? sql`(${dancers.name} ILIKE ${like} OR ${dancers.email} ILIKE ${like})` : undefined,
        input.business ? sql`(exists (select 1 from profile_members m where m.dancer_id = "dancers"."id") or exists (select 1 from profile_claims c where c.dancer_id = "dancers"."id"))` : undefined,
      )
      const rows = await ctx.db
        .select({
          id: dancers.id, name: dancers.name, email: dancers.email, photo: dancers.photo, city: dancers.city,
          username: dancers.username, isAdmin: dancers.isAdmin, createdAt: dancers.createdAt,
          profiles: managedProfiles, pendingClaims,
        })
        .from(dancers).where(where)
        .orderBy(sql`${dancers.createdAt} desc nulls last`)
        .limit(50).offset(input.offset)
      const [count] = await ctx.db.select({ total: sql<number>`count(*)::int` }).from(dancers).where(where)
      return { rows, total: count?.total ?? 0 }
    }),

  dinnerSignups: adminProcedure
    .input(z.object({ dinnerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const signups = await ctx.db
        .select({
          signupId: dinnerSignups.id,
          dancerId: dancers.id,
          name: dancers.name,
          email: dancers.email,
          photo: dancers.photo,
          createdAt: dinnerSignups.createdAt,
        })
        .from(dinnerSignups)
        .innerJoin(dancers, eq(dinnerSignups.dancerId, dancers.id))
        .where(eq(dinnerSignups.dinnerId, input.dinnerId))

      return signups
    }),

  assignGroups: adminProcedure
    .input(z.object({
      dinnerId: z.string().uuid(),
      groupSize: z.number().min(4).max(6).default(5),
    }))
    .mutation(async ({ ctx, input }) => {
      // Get all signups for this dinner
      const signups = await ctx.db
        .select({ dancerId: dinnerSignups.dancerId })
        .from(dinnerSignups)
        .where(eq(dinnerSignups.dinnerId, input.dinnerId))

      if (signups.length < 4) {
        // Not enough for a group — clean up any stale groups
        const staleGroups = await ctx.db
          .select({ id: dinnerGroups.id })
          .from(dinnerGroups)
          .where(eq(dinnerGroups.dinnerId, input.dinnerId))
        for (const g of staleGroups) {
          await ctx.db.delete(dinnerGroupMembers).where(eq(dinnerGroupMembers.groupId, g.id))
        }
        await ctx.db.delete(dinnerGroups).where(eq(dinnerGroups.dinnerId, input.dinnerId))
        return { groups: [] }
      }

      // Delete existing groups before reassigning
      const existingGroups = await ctx.db
        .select({ id: dinnerGroups.id })
        .from(dinnerGroups)
        .where(eq(dinnerGroups.dinnerId, input.dinnerId))

      for (const group of existingGroups) {
        await ctx.db.delete(dinnerGroupMembers).where(eq(dinnerGroupMembers.groupId, group.id))
      }
      await ctx.db.delete(dinnerGroups).where(eq(dinnerGroups.dinnerId, input.dinnerId))

      // Chunk dancers into balanced groups of 4-6
      const dancerIds = signups.map((s) => s.dancerId)
      const gs = input.groupSize
      // Use ceil to get enough groups, then adjust so all groups stay within 4-6
      let numGroups = Math.ceil(dancerIds.length / gs)
      if (numGroups === 0) numGroups = 1
      // Increase groups if any would exceed groupSize
      while (numGroups > 0 && Math.ceil(dancerIds.length / numGroups) > gs) {
        numGroups++
      }
      // Decrease groups if any would be below 4
      while (numGroups > 1 && Math.floor(dancerIds.length / numGroups) < 4) {
        numGroups--
      }
      const groups: string[][] = Array.from({ length: numGroups }, () => [])

      // Round-robin distribute
      dancerIds.forEach((id, i) => {
        groups[i % numGroups].push(id)
      })

      // Create groups in DB — clear chat links since membership may have changed
      const createdGroups = []
      for (let gi = 0; gi < groups.length; gi++) {
        const memberIds = groups[gi]
        const chatLink = null

        const [group] = await ctx.db
          .insert(dinnerGroups)
          .values({ dinnerId: input.dinnerId, chatLink })
          .returning()

        for (const dancerId of memberIds) {
          await ctx.db.insert(dinnerGroupMembers).values({
            groupId: group.id,
            dancerId,
          })
        }

        createdGroups.push({
          groupId: group.id,
          memberCount: memberIds.length,
        })
      }

      return { groups: createdGroups }
    }),

  setGroupChatLink: adminProcedure
    .input(z.object({
      groupId: z.string().uuid(),
      chatLink: z.string().url(),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(dinnerGroups)
        .set({ chatLink: input.chatLink })
        .where(eq(dinnerGroups.id, input.groupId))

      return { updated: true }
    }),

  revealRestaurant: adminProcedure
    .input(z.object({ dinnerId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const today = new Date().toISOString().slice(0, 10)
      await ctx.db
        .update(dinners)
        .set({ revealDate: today })
        .where(eq(dinners.id, input.dinnerId))

      return { revealed: true }
    }),

  listDinners: adminProcedure
    .input(z.object({ festivalSlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const [festival] = await ctx.db
        .select()
        .from(festivals)
        .where(eq(festivals.slug, input.festivalSlug))

      if (!festival) return []

      const rows = await ctx.db
        .select({
          id: dinners.id,
          day: dinners.day,
          date: dinners.date,
          timeSlot: dinners.timeSlot,
          restaurant: dinners.restaurant,
          restaurantAddress: dinners.restaurantAddress,
          revealDate: dinners.revealDate,
          maxSize: dinners.maxSize,
          signupCount: sql<number>`(SELECT COUNT(*) FROM ${dinnerSignups} WHERE ${dinnerSignups.dinnerId} = ${dinners.id})`,
        })
        .from(dinners)
        .where(eq(dinners.festivalId, festival.id))

      return rows.map((r) => ({ ...r, signupCount: Number(r.signupCount) }))
    }),

  dinnerGroups: adminProcedure
    .input(z.object({ dinnerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const groups = await ctx.db
        .select({
          id: dinnerGroups.id,
          chatLink: dinnerGroups.chatLink,
        })
        .from(dinnerGroups)
        .where(eq(dinnerGroups.dinnerId, input.dinnerId))

      const result = await Promise.all(groups.map(async (group) => {
        const members = await ctx.db
          .select({
            id: dancers.id,
            name: dancers.name,
            photo: dancers.photo,
            email: dancers.email,
          })
          .from(dinnerGroupMembers)
          .innerJoin(dancers, eq(dinnerGroupMembers.dancerId, dancers.id))
          .where(eq(dinnerGroupMembers.groupId, group.id))

        return { ...group, members }
      }))

      return result
    }),

  // Admin: festivals to manage (dinner assignment lives at /admin/festivals/[slug]).
  listFestivals: adminProcedure
    .query(async ({ ctx }) => {
      return ctx.db
        .select({
          slug: festivals.slug,
          name: festivals.name,
          startDate: festivals.startDate,
          endDate: festivals.endDate,
        })
        .from(festivals)
        .orderBy(festivals.startDate)
    }),

  // The AI usage log (ai_usage): what every Gemini call cost and how it went.
  // Totals for today / 7 / 30 days, per purpose and per day over the range,
  // and the latest calls with their event and who asked.
  aiUsage: adminProcedure
    .input(z.object({ days: z.number().int().min(1).max(365).default(30), purpose: z.string().max(80).optional() }))
    .query(async ({ ctx, input }) => {
      const q = async (s: any) => { const r: any = await ctx.db.execute(s); return (r.rows ?? r) as any[] }
      const since = new Date(Date.now() - input.days * 86400_000)
      const only = input.purpose ? sql`and purpose = ${input.purpose}` : sql``
      const [totals] = await q(sql`select
        coalesce(sum(cost_usd) filter (where created_at >= date_trunc('day', now())), 0)::float as today,
        coalesce(sum(cost_usd) filter (where created_at >= now() - interval '7 days'), 0)::float as week,
        coalesce(sum(cost_usd) filter (where created_at >= now() - interval '30 days'), 0)::float as month,
        count(*) filter (where created_at >= now() - interval '30 days')::int as calls30,
        count(*) filter (where created_at >= now() - interval '30 days' and cost_usd is null)::int as unpriced30
        from ai_usage`)
      const byPurpose = await q(sql`select purpose, count(*)::int as calls,
        count(*) filter (where status = 'ok')::int as ok, count(*) filter (where status = 'refused')::int as refused, count(*) filter (where status = 'error')::int as errors,
        round(avg(duration_ms))::int as avg_ms, (percentile_cont(0.95) within group (order by duration_ms))::int as p95_ms,
        coalesce(sum(input_tokens), 0)::int as input_tokens, coalesce(sum(output_text_tokens + thought_tokens), 0)::int as text_tokens, coalesce(sum(output_image_tokens), 0)::int as image_tokens,
        coalesce(sum(cost_usd), 0)::float as cost
        from ai_usage where created_at >= ${since} ${only} group by purpose order by cost desc, calls desc`)
      const byDay = await q(sql`select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day, count(*)::int as calls, coalesce(sum(cost_usd), 0)::float as cost,
        count(*) filter (where status <> 'ok')::int as failed
        from ai_usage where created_at >= ${since} ${only} group by 1 order by 1`)
      const recent = await q(sql`select a.id, a.created_at as "createdAt", a.purpose, a.source, a.model_version as "modelVersion", a.model, a.status, a.duration_ms as "durationMs",
        a.input_tokens as "inputTokens", a.output_text_tokens + a.thought_tokens as "textTokens", a.output_image_tokens as "imageTokens", a.cost_usd::float as cost, a.error,
        a.event_id as "eventId", e.name as "eventName", d.name as "dancerName", d.username as "dancerUsername", f.url as "flyerUrl"
        from ai_usage a left join events e on e.id = a.event_id left join dancers d on d.id = a.dancer_id left join event_flyers f on f.id = a.flyer_id
        where a.created_at >= ${since} ${only} order by a.created_at desc limit 200`)
      return { totals, byPurpose, byDay, recent, days: input.days }
    }),
})
