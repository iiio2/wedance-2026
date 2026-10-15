import { z } from 'zod'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import {
  dancers,
  profiles,
  profileMembers,
  bookingRequests,
  moderatorElections,
  electionCandidates,
  electionVotes,
  electionVoteHistory,
  guidelineVersions,
} from '../../database/schema'
import { requireProfileRole } from '../../utils/profileAccess'

/**
 * Moderator elections — community governance for free/OpenAir commons (epic G800,
 * WED-152). A space's moderator is elected annually; candidates propose the
 * guidelines the space runs by (G802); the community votes on an OPEN, verifiable
 * ledger — timestamped, attributable, editable-with-history (G803); the winner's
 * guidelines become the active ruleset the moderator enforces on the free-booking
 * queue (G804). Eligibility: real (verified) profile, one vote per profile (G801).
 *
 * Ballot is open by deliberate design: transparency makes the count trustworthy
 * at the cost of making the choice coercible. Voter identity is exposed only to
 * signed-in members (an anti-scraping floor, not a coercion defence).
 */

// A dancer is election-eligible (candidate or voter) only with a real, claimed
// identity — here proxied by having a public username. Keeps fake/stub accounts
// (festival magic-link stubs with no username) off the ballot.
async function requireEligibleDancer(ctx: any) {
  const [d] = await ctx.db
    .select({ id: dancers.id, username: dancers.username, name: dancers.name, photo: dancers.photo })
    .from(dancers)
    .where(eq(dancers.id, ctx.dancerId))
  if (!d || !d.username) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'A complete WeDance profile is required to take part in an election.' })
  }
  return d
}

// Only an admin or a team member (owner/editor/moderator) may run an election
// or moderate bookings. Step 13 (ADR-004): uses membership check.
async function requireSpaceSteward(ctx: any, profileId: string) {
  if (ctx.isAdmin) return
  await requireProfileRole(ctx, profileId, 'moderator')
}

function addYear(iso: string) {
  const d = new Date(iso)
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

export const electionRouter = router({
  // The active (or latest) election for a space + candidates + open results.
  // Public: everyone sees candidates, guidelines, votes and their timestamps.
  // Voter identity (name/handle/photo) is attached only for signed-in callers.
  forProfile: publicProcedure
    .input(z.object({ profileId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [election] = await ctx.db
        .select()
        .from(moderatorElections)
        .where(eq(moderatorElections.profileId, input.profileId))
        .orderBy(desc(moderatorElections.createdAt))
        .limit(1)
      if (!election) return null

      const cands = await ctx.db
        .select({
          id: electionCandidates.id,
          dancerId: electionCandidates.dancerId,
          guidelines: electionCandidates.guidelines,
          statement: electionCandidates.statement,
          createdAt: electionCandidates.createdAt,
          name: dancers.name,
          username: dancers.username,
          photo: dancers.photo,
        })
        .from(electionCandidates)
        .innerJoin(dancers, eq(electionCandidates.dancerId, dancers.id))
        .where(eq(electionCandidates.electionId, election.id))
        .orderBy(electionCandidates.createdAt)

      // Latest vote per voter = the current tally + the open ledger.
      const votes = await ctx.db
        .select({
          candidateId: electionVotes.candidateId,
          voterDancerId: electionVotes.voterDancerId,
          updatedAt: electionVotes.updatedAt,
          createdAt: electionVotes.createdAt,
        })
        .from(electionVotes)
        .where(eq(electionVotes.electionId, election.id))
        .orderBy(desc(electionVotes.updatedAt))

      // Attach voter identity only for signed-in viewers (anti-scraping floor).
      const signedIn = Boolean(ctx.dancerId)
      let voterMap: Record<string, { name: string | null; username: string | null; photo: string | null }> = {}
      if (signedIn && votes.length) {
        const ids = [...new Set(votes.map(v => v.voterDancerId))]
        const rows = await ctx.db
          .select({ id: dancers.id, name: dancers.name, username: dancers.username, photo: dancers.photo })
          .from(dancers)
          .where(inArray(dancers.id, ids))
        voterMap = Object.fromEntries(rows.map(r => [r.id, { name: r.name, username: r.username, photo: r.photo }]))
      }

      const tally: Record<string, number> = {}
      for (const v of votes) tally[v.candidateId] = (tally[v.candidateId] ?? 0) + 1

      const ledger = votes.map(v => ({
        candidateId: v.candidateId,
        votedAt: v.updatedAt ?? v.createdAt,
        changed: Boolean(v.updatedAt && v.createdAt && +v.updatedAt !== +v.createdAt),
        // Identity present only when signed in; otherwise the vote is anonymous.
        voter: signedIn ? (voterMap[v.voterDancerId] ?? null) : null,
      }))

      return {
        election: {
          id: election.id,
          status: election.status,
          termStart: election.termStart,
          termEnd: election.termEnd,
          nominationsOpenAt: election.nominationsOpenAt,
          votingOpenAt: election.votingOpenAt,
          closesAt: election.closesAt,
          closedAt: election.closedAt,
          winnerCandidateId: election.winnerCandidateId,
        },
        candidates: cands.map(c => ({ ...c, votes: tally[c.id] ?? 0 })),
        ledger,
        totalVotes: votes.length,
        viewerSignedIn: signedIn,
      }
    }),

  // The caller's own current vote + full change history (G803 verification).
  myVote: protectedProcedure
    .input(z.object({ electionId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const [current] = await ctx.db
        .select()
        .from(electionVotes)
        .where(and(eq(electionVotes.electionId, input.electionId), eq(electionVotes.voterDancerId, ctx.dancerId)))
      const history = await ctx.db
        .select()
        .from(electionVoteHistory)
        .where(and(eq(electionVoteHistory.electionId, input.electionId), eq(electionVoteHistory.voterDancerId, ctx.dancerId)))
        .orderBy(electionVoteHistory.createdAt)
      return {
        candidateId: current?.candidateId ?? null,
        firstCastAt: current?.createdAt ?? null,
        lastChangedAt: current?.updatedAt ?? null,
        history,
      }
    }),

  // Open a new election for a space (G801). Admin or current moderator only.
  // Fails if a non-closed election already exists for the space.
  open: protectedProcedure
    .input(z.object({
      profileId: z.string().uuid(),
      termStart: z.string().optional(), // YYYY-MM-DD, defaults to today
    }))
    .mutation(async ({ ctx, input }) => {
      await requireSpaceSteward(ctx, input.profileId)
      const [existing] = await ctx.db
        .select({ id: moderatorElections.id })
        .from(moderatorElections)
        .where(and(eq(moderatorElections.profileId, input.profileId), inArray(moderatorElections.status, ['nominations', 'voting'])))
      if (existing) {
        throw new TRPCError({ code: 'CONFLICT', message: 'An election is already running for this space.' })
      }
      const termStart = input.termStart || new Date().toISOString().slice(0, 10)
      const [row] = await ctx.db
        .insert(moderatorElections)
        .values({ profileId: input.profileId, status: 'nominations', termStart, termEnd: addYear(termStart) })
        .returning({ id: moderatorElections.id })
      return { ok: true, electionId: row!.id }
    }),

  // Self-nominate as a candidate with proposed guidelines (G801 + G802).
  nominate: protectedProcedure
    .input(z.object({
      electionId: z.string().uuid(),
      guidelines: z.string().min(20).max(8000),
      statement: z.string().max(600).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const dancer = await requireEligibleDancer(ctx)
      const [election] = await ctx.db
        .select({ status: moderatorElections.status })
        .from(moderatorElections)
        .where(eq(moderatorElections.id, input.electionId))
      if (!election) throw new TRPCError({ code: 'NOT_FOUND', message: 'Election not found.' })
      if (election.status !== 'nominations') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nominations are closed for this election.' })
      }
      const [dup] = await ctx.db
        .select({ id: electionCandidates.id })
        .from(electionCandidates)
        .where(and(eq(electionCandidates.electionId, input.electionId), eq(electionCandidates.dancerId, dancer.id)))
      if (dup) throw new TRPCError({ code: 'CONFLICT', message: 'You are already a candidate in this election.' })
      const [row] = await ctx.db
        .insert(electionCandidates)
        .values({ electionId: input.electionId, dancerId: dancer.id, guidelines: input.guidelines, statement: input.statement ?? null })
        .returning({ id: electionCandidates.id })
      return { ok: true, candidateId: row!.id }
    }),

  // nominations → voting (G801). Admin/moderator; needs at least one candidate.
  advanceToVoting: protectedProcedure
    .input(z.object({ electionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [election] = await ctx.db
        .select()
        .from(moderatorElections)
        .where(eq(moderatorElections.id, input.electionId))
      if (!election) throw new TRPCError({ code: 'NOT_FOUND', message: 'Election not found.' })
      await requireSpaceSteward(ctx, election.profileId)
      if (election.status !== 'nominations') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This election is not taking nominations.' })
      }
      const cands = await ctx.db
        .select({ id: electionCandidates.id })
        .from(electionCandidates)
        .where(eq(electionCandidates.electionId, input.electionId))
      if (cands.length < 1) throw new TRPCError({ code: 'BAD_REQUEST', message: 'No candidates have stood yet.' })
      await ctx.db
        .update(moderatorElections)
        .set({ status: 'voting', votingOpenAt: new Date() })
        .where(eq(moderatorElections.id, input.electionId))
      return { ok: true }
    }),

  // Cast or change a vote (G803). Only during voting; one vote per real profile,
  // editable — every cast/change is appended to the immutable history.
  castVote: protectedProcedure
    .input(z.object({ electionId: z.string().uuid(), candidateId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const dancer = await requireEligibleDancer(ctx)
      const [election] = await ctx.db
        .select({ status: moderatorElections.status })
        .from(moderatorElections)
        .where(eq(moderatorElections.id, input.electionId))
      if (!election) throw new TRPCError({ code: 'NOT_FOUND', message: 'Election not found.' })
      if (election.status !== 'voting') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Voting is not open for this election.' })
      }
      // Candidate must belong to this election.
      const [cand] = await ctx.db
        .select({ id: electionCandidates.id })
        .from(electionCandidates)
        .where(and(eq(electionCandidates.id, input.candidateId), eq(electionCandidates.electionId, input.electionId)))
      if (!cand) throw new TRPCError({ code: 'BAD_REQUEST', message: 'That candidate is not in this election.' })

      const [existing] = await ctx.db
        .select({ id: electionVotes.id, candidateId: electionVotes.candidateId })
        .from(electionVotes)
        .where(and(eq(electionVotes.electionId, input.electionId), eq(electionVotes.voterDancerId, dancer.id)))

      if (existing && existing.candidateId === input.candidateId) {
        return { ok: true, unchanged: true } // no-op; don't spam the history
      }

      const now = new Date()
      if (existing) {
        await ctx.db
          .update(electionVotes)
          .set({ candidateId: input.candidateId, updatedAt: now })
          .where(eq(electionVotes.id, existing.id))
      } else {
        await ctx.db
          .insert(electionVotes)
          .values({ electionId: input.electionId, voterDancerId: dancer.id, candidateId: input.candidateId, createdAt: now, updatedAt: now })
      }
      await ctx.db
        .insert(electionVoteHistory)
        .values({ electionId: input.electionId, voterDancerId: dancer.id, fromCandidateId: existing?.candidateId ?? null, toCandidateId: input.candidateId, createdAt: now })
      return { ok: true, changed: Boolean(existing) }
    }),

  // Close the election, decide the winner, and make the winner's guidelines the
  // space's active ruleset — writing a per-term version (G803 close + G804).
  close: protectedProcedure
    .input(z.object({ electionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const [election] = await ctx.db
        .select()
        .from(moderatorElections)
        .where(eq(moderatorElections.id, input.electionId))
      if (!election) throw new TRPCError({ code: 'NOT_FOUND', message: 'Election not found.' })
      await requireSpaceSteward(ctx, election.profileId)
      if (election.status === 'closed') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'This election is already closed.' })
      }

      const cands = await ctx.db
        .select({ id: electionCandidates.id, dancerId: electionCandidates.dancerId, guidelines: electionCandidates.guidelines, createdAt: electionCandidates.createdAt })
        .from(electionCandidates)
        .where(eq(electionCandidates.electionId, input.electionId))
        .orderBy(electionCandidates.createdAt)

      const votes = await ctx.db
        .select({ candidateId: electionVotes.candidateId })
        .from(electionVotes)
        .where(eq(electionVotes.electionId, input.electionId))
      const tally: Record<string, number> = {}
      for (const v of votes) tally[v.candidateId] = (tally[v.candidateId] ?? 0) + 1

      // Winner = most latest-votes; tie-break by earliest candidacy (deterministic).
      let winner: (typeof cands)[number] | null = null
      let best = -1
      for (const c of cands) {
        const n = tally[c.id] ?? 0
        if (n > best) { best = n; winner = c }
      }

      await ctx.db
        .update(moderatorElections)
        .set({ status: 'closed', closedAt: new Date(), winnerCandidateId: winner?.id ?? null })
        .where(eq(moderatorElections.id, input.electionId))

      if (winner) {
        const [wd] = await ctx.db
          .select({ name: dancers.name, username: dancers.username })
          .from(dancers)
          .where(eq(dancers.id, winner.dancerId))
        // The winner's guidelines become the space's active ruleset + a version.
        await ctx.db
          .update(profiles)
          .set({
            guidelines: winner.guidelines,
            moderatorName: wd?.name ?? null,
            moderatorHandle: wd?.username ? `@${wd.username}` : null,
            moderatorSince: election.termStart ? Number(String(election.termStart).slice(0, 4)) : new Date().getFullYear(),
          })
          .where(eq(profiles.id, election.profileId))
        await ctx.db
          .insert(guidelineVersions)
          .values({
            profileId: election.profileId,
            electionId: election.id,
            moderatorDancerId: winner.dancerId,
            guidelines: winner.guidelines,
            termStart: election.termStart,
            termEnd: election.termEnd,
          })

        // Step 13 (ADR-004): grant a moderator membership to the winner so
        // requireProfileRole('moderator') works for the booking queue.
        await ctx.db
          .insert(profileMembers)
          .values({
            profileId: election.profileId,
            dancerId: winner.dancerId,
            role: 'moderator',
            title: 'Elected Moderator',
            termStart: election.termStart,
            termEnd: election.termEnd,
          })
          .onConflictDoUpdate({
            target: [profileMembers.profileId, profileMembers.dancerId],
            set: {
              role: 'moderator',
              title: 'Elected Moderator',
              termStart: election.termStart,
              termEnd: election.termEnd,
            },
          })
      }

      return { ok: true, winnerCandidateId: winner?.id ?? null, votes: best < 0 ? 0 : best }
    }),

  // --- G804: the elected moderator runs the free-booking queue ---------------

  // Pending free-booking requests for a space the caller stewards.
  pendingBookings: protectedProcedure
    .input(z.object({ profileId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      await requireSpaceSteward(ctx, input.profileId)
      return ctx.db
        .select()
        .from(bookingRequests)
        .where(and(eq(bookingRequests.profileId, input.profileId), eq(bookingRequests.status, 'pending')))
        .orderBy(bookingRequests.createdAt)
    }),

  // Approve or decline a free-booking request against the active guidelines.
  moderateBooking: protectedProcedure
    .input(z.object({
      bookingId: z.string().uuid(),
      action: z.enum(['accept', 'decline']),
      note: z.string().max(1000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const [booking] = await ctx.db
        .select({ id: bookingRequests.id, profileId: bookingRequests.profileId, status: bookingRequests.status })
        .from(bookingRequests)
        .where(eq(bookingRequests.id, input.bookingId))
      if (!booking) throw new TRPCError({ code: 'NOT_FOUND', message: 'Booking request not found.' })
      await requireSpaceSteward(ctx, booking.profileId)
      await ctx.db
        .update(bookingRequests)
        .set({
          status: input.action === 'accept' ? 'accepted' : 'declined',
          moderatedById: ctx.dancerId,
          moderatedAt: new Date(),
          moderationNote: input.note ?? null,
        })
        .where(eq(bookingRequests.id, input.bookingId))
      return { ok: true }
    }),

  // Past guideline versions for a space (governance history, G804).
  guidelineHistory: publicProcedure
    .input(z.object({ profileId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db
        .select()
        .from(guidelineVersions)
        .where(eq(guidelineVersions.profileId, input.profileId))
        .orderBy(desc(guidelineVersions.createdAt))
    }),
})
