import { z } from 'zod'
import { eq, and, desc, or, sql, inArray } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, adminProcedure } from '../trpc'
import { cityVideos, videoVotes, cityBattleVotes, profiles } from '../../database/schema'
import { updateElo, INITIAL_ELO } from '../lib/elo'
import { pairKey, selectNextPair } from '../lib/pairSelect'
import { pickChampions } from '../lib/battleChampions'

/** Current competition month key, e.g. '2026-07' (UTC). */
export function currentMonth(now: Date = new Date()): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/**
 * Server-side YouTube thumbnail derivation for `submit`. We keep this minimal
 * copy here rather than import `app/lib/videoEmbed.ts` across the Nuxt
 * app/server boundary. The client uses the richer app helper for rendering.
 */
function deriveThumbnail(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?(?:.*&)?v=)([\w-]{11})/,
    /(?:youtu\.be\/)([\w-]{11})/,
    /(?:youtube\.com\/shorts\/)([\w-]{11})/,
    /(?:youtube\.com\/embed\/)([\w-]{11})/,
  ]
  for (const re of patterns) {
    const m = url.match(re)
    if (m) return `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg`
  }
  return null
}

// Reasonable per-session vote cap for one city+month. High enough that a real
// enthusiast never hits it, low enough to blunt scripted ballot-stuffing.
const MAX_VOTES_PER_SESSION = 200

const titleCaseSlug = (slug: string) =>
  slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

// Unordered city pair key, so (munich,havana) and (havana,munich) collide.
const cityPairKey = (a: string, b: string) => [a, b].sort().join('|')

type Champion = {
  citySlug: string; city: string; videoId: string; title: string
  videoUrl: string; thumbnailUrl: string | null; danceStyle: string | null; eloScore: number
}

// Each city's champion = its highest-ELO approved video this month, or — when
// fewer than two cities have a current-month video — its best from any month
// (see lib/battleChampions). Names come from the profiles table (no
// country/name column on city_videos).
async function getChampions(db: any, month: string): Promise<Champion[]> {
  const vids = await db
    .select({
      id: cityVideos.id, citySlug: cityVideos.citySlug, title: cityVideos.title,
      videoUrl: cityVideos.videoUrl, thumbnailUrl: cityVideos.thumbnailUrl,
      danceStyle: cityVideos.danceStyle, eloScore: cityVideos.eloScore,
      competitionMonth: cityVideos.competitionMonth,
    })
    .from(cityVideos)
    .where(eq(cityVideos.status, 'approved'))
  const { champions: list } = pickChampions(vids as Array<typeof vids[number]>, month)
  const slugs = list.map(c => c.citySlug)
  const names = slugs.length
    ? await db.select({ city: profiles.city, citySlug: profiles.citySlug }).from(profiles).where(inArray(profiles.citySlug, slugs))
    : []
  const nameOf = (slug: string) => names.find((n: any) => n.citySlug === slug)?.city ?? titleCaseSlug(slug)
  return list.map(c => ({
    citySlug: c.citySlug, city: nameOf(c.citySlug), videoId: c.id, title: c.title,
    videoUrl: c.videoUrl, thumbnailUrl: c.thumbnailUrl, danceStyle: c.danceStyle, eloScore: c.eloScore,
  }))
}

export const cityVideoRouter = router({
  // Approved videos for a city (optionally a specific month), best first.
  listApproved: publicProcedure
    .input(z.object({
      citySlug: z.string(),
      competitionMonth: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const month = input.competitionMonth ?? currentMonth()
      return ctx.db
        .select({
          id: cityVideos.id,
          title: cityVideos.title,
          videoUrl: cityVideos.videoUrl,
          thumbnailUrl: cityVideos.thumbnailUrl,
          danceStyle: cityVideos.danceStyle,
          eloScore: cityVideos.eloScore,
          voteCount: cityVideos.voteCount,
          competitionMonth: cityVideos.competitionMonth,
        })
        .from(cityVideos)
        .where(and(
          eq(cityVideos.citySlug, input.citySlug),
          eq(cityVideos.status, 'approved'),
          eq(cityVideos.competitionMonth, month),
        ))
        .orderBy(desc(cityVideos.eloScore))
    }),

  // Video of the Month = highest-ELO approved video for the current month.
  // Returns null (never a fabricated winner) when the city has no entries yet.
  monthWinner: publicProcedure
    .input(z.object({
      citySlug: z.string(),
      competitionMonth: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const month = input.competitionMonth ?? currentMonth()
      const [winner] = await ctx.db
        .select({
          id: cityVideos.id,
          title: cityVideos.title,
          videoUrl: cityVideos.videoUrl,
          thumbnailUrl: cityVideos.thumbnailUrl,
          danceStyle: cityVideos.danceStyle,
          eloScore: cityVideos.eloScore,
          voteCount: cityVideos.voteCount,
          competitionMonth: cityVideos.competitionMonth,
        })
        .from(cityVideos)
        .where(and(
          eq(cityVideos.citySlug, input.citySlug),
          eq(cityVideos.status, 'approved'),
          eq(cityVideos.competitionMonth, month),
        ))
        .orderBy(desc(cityVideos.eloScore))
        .limit(1)

      return winner ?? null
    }),

  // Next pair to vote on for this session — two approved videos this session
  // hasn't already paired. Returns { pair: null, ... } when exhausted.
  getPair: publicProcedure
    .input(z.object({ citySlug: z.string() }))
    .query(async ({ ctx, input }) => {
      const month = currentMonth()
      const sessionId = ctx.voterSessionId

      const videos = await ctx.db
        .select({
          id: cityVideos.id,
          title: cityVideos.title,
          videoUrl: cityVideos.videoUrl,
          thumbnailUrl: cityVideos.thumbnailUrl,
          danceStyle: cityVideos.danceStyle,
        })
        .from(cityVideos)
        .where(and(
          eq(cityVideos.citySlug, input.citySlug),
          eq(cityVideos.status, 'approved'),
          eq(cityVideos.competitionMonth, month),
        ))

      const byId = new Map(videos.map(v => [v.id, v]))
      const ids = videos.map(v => v.id)

      // Pairs this session already voted on (for dedupe).
      const seen = new Set<string>()
      let votesCast = 0
      if (sessionId) {
        const prior = await ctx.db
          .select({
            winnerVideoId: videoVotes.winnerVideoId,
            loserVideoId: videoVotes.loserVideoId,
          })
          .from(videoVotes)
          .where(and(
            eq(videoVotes.citySlug, input.citySlug),
            eq(videoVotes.voterSessionId, sessionId),
          ))
        votesCast = prior.length
        for (const v of prior) seen.add(pairKey(v.winnerVideoId, v.loserVideoId))
      }

      if (votesCast >= MAX_VOTES_PER_SESSION) {
        return { pair: null as null, poolSize: ids.length, exhausted: false, capped: true }
      }

      const chosen = selectNextPair(ids, seen)
      if (!chosen) {
        return { pair: null as null, poolSize: ids.length, exhausted: ids.length >= 2, capped: false }
      }

      return {
        pair: [byId.get(chosen[0])!, byId.get(chosen[1])!] as const,
        poolSize: ids.length,
        exhausted: false,
        capped: false,
      }
    }),

  // Record a pairwise vote: insert the vote row and update BOTH videos' ELO +
  // voteCount. Idempotent per (session, unordered pair) — a duplicate is a
  // no-op rather than a double-count.
  vote: publicProcedure
    .input(z.object({
      citySlug: z.string(),
      winnerVideoId: z.string().uuid(),
      loserVideoId: z.string().uuid(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.winnerVideoId === input.loserVideoId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A video cannot beat itself.' })
      }

      const sessionId = ctx.voterSessionId
      if (!sessionId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'No voting session.' })
      }

      // Load both videos; they must be approved and in this city.
      const rows = await ctx.db
        .select({
          id: cityVideos.id,
          eloScore: cityVideos.eloScore,
          status: cityVideos.status,
          citySlug: cityVideos.citySlug,
        })
        .from(cityVideos)
        .where(or(
          eq(cityVideos.id, input.winnerVideoId),
          eq(cityVideos.id, input.loserVideoId),
        ))

      const winner = rows.find(r => r.id === input.winnerVideoId)
      const loser = rows.find(r => r.id === input.loserVideoId)

      if (!winner || !loser) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Video not found.' })
      }
      if (
        winner.status !== 'approved' || loser.status !== 'approved'
        || winner.citySlug !== input.citySlug || loser.citySlug !== input.citySlug
      ) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Both videos must be approved in this city.' })
      }

      // Dedupe: if this session already voted on this unordered pair, no-op.
      const priorSame = await ctx.db
        .select({ id: videoVotes.id })
        .from(videoVotes)
        .where(and(
          eq(videoVotes.citySlug, input.citySlug),
          eq(videoVotes.voterSessionId, sessionId),
          or(
            and(eq(videoVotes.winnerVideoId, input.winnerVideoId), eq(videoVotes.loserVideoId, input.loserVideoId)),
            and(eq(videoVotes.winnerVideoId, input.loserVideoId), eq(videoVotes.loserVideoId, input.winnerVideoId)),
          ),
        ))
        .limit(1)

      if (priorSame.length > 0) {
        return { recorded: false, duplicate: true }
      }

      const { winner: newWinnerElo, loser: newLoserElo } = updateElo(winner.eloScore, loser.eloScore)

      await ctx.db.insert(videoVotes).values({
        citySlug: input.citySlug,
        winnerVideoId: input.winnerVideoId,
        loserVideoId: input.loserVideoId,
        voterSessionId: sessionId,
        voterDancerId: ctx.dancerId,
      })

      await ctx.db
        .update(cityVideos)
        .set({ eloScore: newWinnerElo, voteCount: sql`${cityVideos.voteCount} + 1` })
        .where(eq(cityVideos.id, input.winnerVideoId))

      await ctx.db
        .update(cityVideos)
        .set({ eloScore: newLoserElo, voteCount: sql`${cityVideos.voteCount} + 1` })
        .where(eq(cityVideos.id, input.loserVideoId))

      return { recorded: true, duplicate: false }
    }),

  // Public submission — enters the current month's competition as `pending`.
  submit: publicProcedure
    .input(z.object({
      citySlug: z.string().min(1),
      title: z.string().min(2).max(120),
      videoUrl: z.string().url(),
      danceStyle: z.string().max(60).optional(),
      email: z.string().email(),
    }))
    .mutation(async ({ ctx, input }) => {
      const month = currentMonth()
      const [row] = await ctx.db
        .insert(cityVideos)
        .values({
          citySlug: input.citySlug,
          submittedByEmail: input.email,
          dancerId: ctx.dancerId,
          title: input.title,
          videoUrl: input.videoUrl,
          thumbnailUrl: deriveThumbnail(input.videoUrl),
          danceStyle: input.danceStyle ?? null,
          competitionMonth: month,
          status: 'pending',
          eloScore: INITIAL_ELO,
        })
        .returning({ id: cityVideos.id })

      return { id: row!.id, status: 'pending' as const }
    }),

  // ---- admin moderation ----

  pendingList: adminProcedure
    .input(z.object({ citySlug: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const where = input?.citySlug
        ? and(eq(cityVideos.status, 'pending'), eq(cityVideos.citySlug, input.citySlug))
        : eq(cityVideos.status, 'pending')
      return ctx.db
        .select()
        .from(cityVideos)
        .where(where)
        .orderBy(desc(cityVideos.createdAt))
    }),

  setStatus: adminProcedure
    .input(z.object({
      videoId: z.string().uuid(),
      status: z.enum(['pending', 'approved', 'rejected']),
    }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db
        .update(cityVideos)
        .set({ status: input.status })
        .where(eq(cityVideos.id, input.videoId))
      return { videoId: input.videoId, status: input.status }
    }),

  // --- Cross-city battle (the tier above per-city voting) -------------------

  // Next city-vs-city matchup for this session: two cities' champion videos
  // (current month, else best-ever), skipping pairs this session already voted
  // this month. matchup: null when fewer than two cities have any approved video, the session is capped, or every
  // pairing has been voted.
  battleMatchup: publicProcedure.query(async ({ ctx }) => {
    const month = currentMonth()
    const champions = await getChampions(ctx.db, month)
    if (champions.length < 2) return { matchup: null, poolCities: champions.length, votesCast: 0, reason: 'not_enough_cities' as const }

    const sessionId = ctx.voterSessionId
    const seen = new Set<string>()
    let votesCast = 0
    if (sessionId) {
      const prior = await ctx.db
        .select({ w: cityBattleVotes.winnerCitySlug, l: cityBattleVotes.loserCitySlug })
        .from(cityBattleVotes)
        .where(and(eq(cityBattleVotes.voterSessionId, sessionId), eq(cityBattleVotes.competitionMonth, month)))
      votesCast = prior.length
      for (const p of prior) seen.add(cityPairKey(p.w, p.l))
    }
    if (votesCast >= MAX_VOTES_PER_SESSION) return { matchup: null, poolCities: champions.length, votesCast, reason: 'capped' as const }

    const unseen: [Champion, Champion][] = []
    for (let i = 0; i < champions.length; i++)
      for (let j = i + 1; j < champions.length; j++)
        if (!seen.has(cityPairKey(champions[i].citySlug, champions[j].citySlug))) unseen.push([champions[i], champions[j]])
    if (!unseen.length) return { matchup: null, poolCities: champions.length, votesCast, reason: 'exhausted' as const }

    const picked = unseen[Math.floor(Math.random() * unseen.length)]
    const [a, b] = Math.random() < 0.5 ? picked : [picked[1], picked[0]]
    return { matchup: { month, a, b }, poolCities: champions.length, votesCast, reason: null }
  }),

  // Record one cross-city vote. Deduped per session per unordered city pair per
  // month; capped per session. Ranks cities, not videos.
  battleVote: publicProcedure
    .input(z.object({
      winnerCitySlug: z.string().min(1),
      loserCitySlug: z.string().min(1),
      winnerVideoId: z.string().uuid().optional(),
      loserVideoId: z.string().uuid().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.winnerCitySlug === input.loserCitySlug) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'A city cannot beat itself.' })
      }
      const sessionId = ctx.voterSessionId
      if (!sessionId) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No voting session.' })
      const month = currentMonth()

      const prior = await ctx.db
        .select({ id: cityBattleVotes.id })
        .from(cityBattleVotes)
        .where(and(
          eq(cityBattleVotes.voterSessionId, sessionId),
          eq(cityBattleVotes.competitionMonth, month),
          or(
            and(eq(cityBattleVotes.winnerCitySlug, input.winnerCitySlug), eq(cityBattleVotes.loserCitySlug, input.loserCitySlug)),
            and(eq(cityBattleVotes.winnerCitySlug, input.loserCitySlug), eq(cityBattleVotes.loserCitySlug, input.winnerCitySlug)),
          ),
        ))
        .limit(1)
      if (prior.length > 0) return { recorded: false, duplicate: true }

      await ctx.db.insert(cityBattleVotes).values({
        competitionMonth: month,
        winnerCitySlug: input.winnerCitySlug,
        loserCitySlug: input.loserCitySlug,
        winnerVideoId: input.winnerVideoId ?? null,
        loserVideoId: input.loserVideoId ?? null,
        voterSessionId: sessionId,
        voterDancerId: ctx.dancerId,
      })
      return { recorded: true, duplicate: false }
    }),

  // "Top dance cities" — cities ranked by battle wins for the current month.
  cityLeaderboard: publicProcedure
    .input(z.object({ limit: z.number().min(1).max(50).default(10) }).optional())
    .query(async ({ ctx, input }) => {
      const month = currentMonth()
      const rows = await ctx.db
        .select({ w: cityBattleVotes.winnerCitySlug, l: cityBattleVotes.loserCitySlug })
        .from(cityBattleVotes)
        .where(eq(cityBattleVotes.competitionMonth, month))

      const stat = new Map<string, { wins: number; losses: number }>()
      const bump = (slug: string, k: 'wins' | 'losses') => {
        const e = stat.get(slug) ?? { wins: 0, losses: 0 }
        e[k]++; stat.set(slug, e)
      }
      for (const r of rows) { bump(r.w, 'wins'); bump(r.l, 'losses') }

      const slugs = [...stat.keys()]
      const names = slugs.length
        ? await ctx.db.select({ city: profiles.city, citySlug: profiles.citySlug }).from(profiles).where(inArray(profiles.citySlug, slugs))
        : []
      const nameOf = (slug: string) => names.find((n: any) => n.citySlug === slug)?.city ?? titleCaseSlug(slug)

      const cities = slugs.map((s) => {
        const { wins, losses } = stat.get(s)!
        const battles = wins + losses
        return { citySlug: s, city: nameOf(s), wins, losses, battles, winRate: battles ? wins / battles : 0 }
      }).sort((a, b) => b.wins - a.wins || b.winRate - a.winRate || b.battles - a.battles)

      return { month, totalVotes: rows.length, cities: cities.slice(0, input?.limit ?? 10) }
    }),
})
