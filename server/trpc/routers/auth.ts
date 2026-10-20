import { z } from 'zod'
import { eq, and, gt, or, sql } from 'drizzle-orm'
import { TRPCError } from '@trpc/server'
import { FirebaseScrypt } from 'firebase-scrypt'
import { router, publicProcedure, protectedProcedure } from '../trpc'
import {
  dancers, sessions, dinnerSignups, dinnerGroupMembers, videoVotes,
  cityBattleVotes, giveawayEntries, reviews, bookingRequests,
  electionCandidates, electionVotes, electionVoteHistory,
  recommendationRequests, festivalSubmissions, festivalSignups, cityVideos,
  guidelineVersions, moderatorElections, gigs, hangouts, hangoutRsvps,
  communityGroupReports, planItems, festivalRideShares,
  festivalRoommateLookups, referrals, profiles, bookingInquiries,
} from '../../database/schema'
import { sendMagicLinkEmail, sendPasswordResetEmail } from '../../utils/email'
import { generateUsername } from '../../utils/slug'
import { freeHandle } from '../../utils/handles'
import { recordLinkAction } from '../../utils/trackedLinks'
import { trackServer } from '../../utils/posthog'
import { isMagicLinkSignup } from '../../utils/magicLinkSignup'

// FirebaseScrypt parameters, ported verbatim from wedance-v4
// (server/api/auth/[...].ts). These MUST match v4 exactly so legacy user
// hashes (salt + hash copied from v4's Postgres) verify unchanged. The
// signer key and salt separator are secrets supplied via env — see the
// FIREBASE_SALT_SEPARATOR / FIREBASE_SIGNER_KEY entries in .env (and the
// Vercel project env for deploy).
const firebaseScryptParameters = {
  memCost: 14,
  rounds: 8,
  saltSeparator: String(process.env.FIREBASE_SALT_SEPARATOR),
  signerKey: String(process.env.FIREBASE_SIGNER_KEY),
}

// Mint a 30-day session row for a dancer and return the same shape the whole
// app already consumes via setSession() / auth.me. Extracted so magic-link,
// login, and register all mint sessions identically.
async function createSession(
  db: {
    insert: (table: typeof sessions) => {
      values: (v: Record<string, unknown>) => Promise<unknown>
    }
  },
  dancer: { id: string; name: string; isAdmin: boolean | null },
) {
  const sessionToken = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days

  await db.insert(sessions).values({
    dancerId: dancer.id,
    token: sessionToken,
    expiresAt,
  })

  return {
    sessionToken,
    dancerId: dancer.id,
    name: dancer.name,
    isAdmin: dancer.isAdmin ?? false,
  }
}

export const authRouter = router({
  requestMagicLink: publicProcedure
    .input(z.object({
      name: z.string().min(1).optional(),
      email: z.string().email().transform((s) => s.trim().toLowerCase()),
      danceStyles: z.array(z.string()).default([]),
      role: z.enum(['lead', 'follow', 'both']).optional(),
      city: z.string().optional(),
      purpose: z.enum(['login', 'recovery']).default('login'),
    }))
    .mutation(async ({ ctx, input }): Promise<{ sent: boolean; accountExists?: boolean }> => {
      // Return { sent: true } whether or not the DB/email send succeeded, so
      // raw SQL errors never leak to the client (the neon-http driver embeds
      // query params including the magic token in its error messages). The
      // one exception: recovery for an unregistered email answers
      // { sent: false, accountExists: false }.
      try {
        const magicToken = crypto.randomUUID()
        const magicTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes

        const updateSet: Record<string, unknown> = {
          magicToken,
          magicTokenExpiresAt,
        }
        if (input.name) updateSet.name = input.name
        if (input.danceStyles.length > 0) updateSet.danceStyles = input.danceStyles
        if (input.role) updateSet.role = input.role
        if (input.city) updateSet.city = input.city

        // A first magic link creates the account: a promoter's link may get the credit.
        const [before] = ctx.viaCode ? await ctx.db.select({ id: dancers.id }).from(dancers).where(eq(dancers.email, input.email)) : [null]

        try {
          if (input.purpose === 'recovery') {
            // Recovery only ever targets an existing account: no new dancer
            // row, no email to addresses that never signed up. Telling the
            // caller so leaks nothing new — register already answers "Email
            // already in use." — and lets the UI point them to sign-up.
            const [existing] = await ctx.db
              .select({ id: dancers.id })
              .from(dancers)
              .where(eq(dancers.email, input.email))
            if (!existing) return { sent: false, accountExists: false }

            await ctx.db
              .update(dancers)
              .set({ magicToken, magicTokenExpiresAt })
              .where(eq(dancers.id, existing.id))
          } else {
            // Upsert: create new user or update existing user's magic token.
            await ctx.db
              .insert(dancers)
              .values({
                name: input.name || input.email.split('@')[0],
                email: input.email,
                danceStyles: input.danceStyles,
                role: input.role ?? null,
                city: input.city ?? null,
                magicToken,
                magicTokenExpiresAt,
              })
              .onConflictDoUpdate({
                target: dancers.email,
                set: updateSet,
              })
          }
        } catch (dbErr) {
          console.error('[auth.requestMagicLink] DB upsert failed for', input.email, dbErr)
          // Bail — without a stored token the email link would be dead anyway.
          return { sent: true }
        }

        // Get the dancer name for the email greeting
        const [dancer] = await ctx.db
          .select({ id: dancers.id, name: dancers.name })
          .from(dancers)
          .where(eq(dancers.email, input.email))
        if (ctx.viaCode && !before && dancer) await recordLinkAction(ctx.db, ctx.viaCode, 'signup', { dancerId: dancer.id })

        const config = useRuntimeConfig()
        const siteUrl = config.siteUrl || 'http://localhost:3000'
        const magicLinkUrl = input.purpose === 'recovery'
          ? `${siteUrl}/auth/verify?token=${magicToken}&mode=reset`
          : `${siteUrl}/auth/verify?token=${magicToken}`

        try {
          if (input.purpose === 'recovery') {
            await sendPasswordResetEmail(input.email, dancer?.name || 'Dancer', magicLinkUrl)
          } else {
            await sendMagicLinkEmail(input.email, dancer?.name || 'Dancer', magicLinkUrl)
          }
        } catch (emailErr) {
          console.error('[auth.requestMagicLink] email send failed for', input.email, emailErr)
        }
      } catch (err) {
        // Catch-all for unexpected errors — never surface to the client.
        console.error('[auth.requestMagicLink] unexpected error for', input.email, err)
      }

      return { sent: true }
    }),

  verifyMagicLink: publicProcedure
    .input(z.object({
      token: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const token = input.token

      // Look up dancer by magic token, check not expired
      const [dancer] = await ctx.db
        .select({
          id: dancers.id,
          name: dancers.name,
          isAdmin: dancers.isAdmin,
          emailVerifiedAt: dancers.emailVerifiedAt,
          hash: dancers.hash,
          createdAt: dancers.createdAt,
          sourceRef: dancers.sourceRef,
        })
        .from(dancers)
        .where(
          and(
            eq(dancers.magicToken, token),
            gt(dancers.magicTokenExpiresAt, new Date()),
          ),
        )

      if (!dancer) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired link. Please request a new one.',
        })
      }

      // Clear magic token (single-use) and mark email as verified — the user
      // proved ownership by clicking a link sent to this address. Ticket
      // claiming (claim.ts) gates on emailVerifiedAt to prevent an attacker
      // from registering someone else's email and grabbing their tickets.
      await ctx.db
        .update(dancers)
        .set({ magicToken: null, magicTokenExpiresAt: null, emailVerifiedAt: new Date() })
        .where(eq(dancers.id, dancer.id))

      // A sign-up only when this flow just created the account (recent, not
      // migrated, no password, never verified, no earlier session) — see
      // server/utils/magicLinkSignup.ts. Migrated v4 dancers never count.
      const [prior] = await ctx.db.select({ id: sessions.id }).from(sessions).where(eq(sessions.dancerId, dancer.id)).limit(1)
      const isNew = isMagicLinkSignup({ ...dancer, hadSession: !!prior })
      trackServer(ctx, isNew ? 'signup_completed' : 'login_completed', { method: 'magic_link' }, { distinctId: dancer.id })
      return { ...(await createSession(ctx.db, dancer)), isNew }
    }),

  // Reset password via magic-link token. The "forgot password" flow sends a
  // magic link with `mode=reset`; this procedure consumes the token, sets a new
  // password, and mints a session — so the user is logged in with their new
  // credentials in one step.
  resetPassword: publicProcedure
    .input(z.object({
      token: z.string().min(1),
      newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
    }))
    .mutation(async ({ ctx, input }) => {
      const [dancer] = await ctx.db
        .select({
          id: dancers.id,
          name: dancers.name,
          isAdmin: dancers.isAdmin,
        })
        .from(dancers)
        .where(
          and(
            eq(dancers.magicToken, input.token),
            gt(dancers.magicTokenExpiresAt, new Date()),
          ),
        )

      if (!dancer) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid or expired link. Please request a new one.',
        })
      }

      // Hash the new password with a fresh salt (same FirebaseScrypt scheme).
      const salt = Buffer.from(String(Math.random()).slice(7)).toString('base64')
      const scrypt = new FirebaseScrypt(firebaseScryptParameters)
      const hash = await scrypt.hash(input.newPassword, salt)

      // Update password, clear magic token (single-use), and mark email
      // verified — the user proved ownership by clicking the reset link.
      await ctx.db
        .update(dancers)
        .set({ salt, hash, magicToken: null, magicTokenExpiresAt: null, emailVerifiedAt: new Date() })
        .where(eq(dancers.id, dancer.id))

      return createSession(ctx.db, dancer)
    }),

  // Email + password login. Ported functionally from wedance-v4's Credentials
  // `authorize`. Verifies against the stored FirebaseScrypt salt/hash so legacy
  // users keep their existing passwords once their rows are copied into this DB.
  // Never leaks whether the email exists: both "unknown email" and "wrong
  // password" surface the same generic error.
  login: publicProcedure
    .input(z.object({
      email: z.string().email().transform((s) => s.trim().toLowerCase()),
      password: z.string().min(1),
    }))
    .mutation(async ({ ctx, input }) => {
      const invalidCredentials = new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid email or password.',
      })

      const [dancer] = await ctx.db
        .select({
          id: dancers.id,
          name: dancers.name,
          isAdmin: dancers.isAdmin,
          salt: dancers.salt,
          hash: dancers.hash,
        })
        .from(dancers)
        .where(eq(dancers.email, input.email))

      // Unknown email, or a dancer that has no password set (created via
      // magic-link / festival flow) — same generic error either way.
      if (!dancer || !dancer.salt || !dancer.hash) {
        throw invalidCredentials
      }

      const scrypt = new FirebaseScrypt(firebaseScryptParameters)
      const isValid = await scrypt.verify(input.password, dancer.salt, dancer.hash)

      if (!isValid) {
        throw invalidCredentials
      }

      trackServer(ctx, 'login_completed', { method: 'password' }, { distinctId: dancer.id })
      return createSession(ctx.db, dancer)
    }),

  // Email + password registration. Generates salt + hash exactly as wedance-v4
  // does (salt from Math.random, FirebaseScrypt hash), preserving the onboarding
  // fields the magic-link signup already collected so nothing downstream breaks.
  register: publicProcedure
    .input(z.object({
      name: z.string().min(1, 'Name is required.'),
      email: z.string().email().transform((s) => s.trim().toLowerCase()),
      password: z.string().min(8, 'Password must be at least 8 characters.'),
      danceStyles: z.array(z.string()).default([]),
      role: z.enum(['lead', 'follow', 'both']).optional(),
      city: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Reject duplicate email up front with a clean message. The unique
      // constraint on dancers.email is the real guard (handled below too), but
      // this gives a friendly error for the common case.
      const [existing] = await ctx.db
        .select({ id: dancers.id })
        .from(dancers)
        .where(eq(dancers.email, input.email))

      if (existing) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Email already in use.',
        })
      }

      // Salt + hash, identical scheme to wedance-v4.
      const salt = Buffer.from(String(Math.random()).slice(7)).toString('base64')
      const scrypt = new FirebaseScrypt(firebaseScryptParameters)
      const hash = await scrypt.hash(input.password, salt)

      // Insert with a generated username. A 23505 unique violation is either
      // the email (→ clean "already in use") or a username collision (~1e-6) —
      // in the latter case we regenerate the handle and retry rather than
      // surfacing a wrong "email in use" error and failing the signup.
      let dancer: { id: string; name: string; isAdmin: boolean | null } | undefined
      const MAX_USERNAME_TRIES = 5
      for (let attempt = 0; attempt < MAX_USERNAME_TRIES && !dancer; attempt++) {
        try {
          const [inserted] = await ctx.db
            .insert(dancers)
            .values({
              name: input.name,
              email: input.email,
              // A readable handle ("ana-garcia"); a random one only if a
              // simultaneous signup took it first.
              username: attempt === 0 ? await freeHandle(ctx.db, input.name, input.city) : generateUsername(input.name),
              danceStyles: input.danceStyles,
              role: input.role ?? null,
              city: input.city ?? null,
              salt,
              hash,
            })
            .returning({
              id: dancers.id,
              name: dancers.name,
              isAdmin: dancers.isAdmin,
            })
          dancer = inserted
        } catch (error: unknown) {
          const e = error as { code?: string; constraint?: string }
          if (e?.code === '23505') {
            // Username clash: regenerate and retry. Any other unique violation
            // (email, or an unknown constraint) is the email-in-use case.
            if (e.constraint === 'dancers_username_unique') continue
            throw new TRPCError({ code: 'CONFLICT', message: 'Email already in use.' })
          }
          throw error
        }
      }

      if (!dancer) {
        // Exhausted retries on username collisions — astronomically unlikely.
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not create your account. Please try again.',
        })
      }

      // Came through a promoter's tracked link: credit the sign-up.
      await recordLinkAction(ctx.db, ctx.viaCode, 'signup', { dancerId: dancer.id })

      // Booking requests they sent before they had an account become theirs.
      try {
        await ctx.db.update(bookingInquiries).set({ requesterId: dancer.id })
          .where(and(eq(bookingInquiries.email, input.email), sql`${bookingInquiries.requesterId} is null`))
      } catch (e) { console.error('[auth] linking booking requests failed', e) }

      trackServer(ctx, 'signup_completed', { method: 'password', has_city: !!input.city, via_link: !!ctx.viaCode }, { distinctId: dancer.id })
      return createSession(ctx.db, dancer)
    }),

  // Change the signed-in dancer's password: verify the current one, then
  // re-hash the new one with a fresh salt (same FirebaseScrypt scheme as
  // register). A dancer with no password set (magic-link signup) has empty
  // salt/hash and will fail the current-password check — they recover via the
  // magic link instead.
  changePassword: protectedProcedure
    .input(z.object({
      currentPassword: z.string().min(1),
      newPassword: z.string().min(8, 'Password must be at least 8 characters.'),
    }))
    .mutation(async ({ ctx, input }) => {
      const [dancer] = await ctx.db
        .select({ salt: dancers.salt, hash: dancers.hash })
        .from(dancers)
        .where(eq(dancers.id, ctx.dancerId))

      const scrypt = new FirebaseScrypt(firebaseScryptParameters)
      const ok = dancer && dancer.salt && dancer.hash
        && await scrypt.verify(input.currentPassword, dancer.salt, dancer.hash)
      if (!ok) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Current password is incorrect.' })
      }

      const salt = Buffer.from(String(Math.random()).slice(7)).toString('base64')
      const hash = await scrypt.hash(input.newPassword, salt)
      await ctx.db.update(dancers).set({ salt, hash }).where(eq(dancers.id, ctx.dancerId))
      return { ok: true }
    }),

  // Persist the onboarding choice. Protected: requires a signed-in dancer.
  // Sets the chosen persona + any collected fields and stamps onboardedAt so
  // the onboarding guard never nags again (Skip calls this too, intent-only).
  completeOnboarding: protectedProcedure
    .input(z.object({
      intent: z.string().min(1),
      city: z.string().optional(),
      danceStyles: z.array(z.string()).optional(),
      role: z.enum(['lead', 'follow', 'both']).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updateSet: Record<string, unknown> = {
        intent: input.intent,
        onboardedAt: new Date(),
      }
      // Only overwrite collected fields when the branch actually provided them,
      // so a Skip (intent-only) doesn't wipe anything already on the profile.
      if (input.city !== undefined) updateSet.city = input.city
      if (input.danceStyles !== undefined) updateSet.danceStyles = input.danceStyles
      if (input.role !== undefined) updateSet.role = input.role

      // Backfill a username for dancers created before the field existed
      // (magic-link / festival-claim signups). New registrations already have
      // one; this ensures anyone who reaches onboarding gets a profile URL.
      const [current] = await ctx.db
        .select({ username: dancers.username, name: dancers.name })
        .from(dancers)
        .where(eq(dancers.id, ctx.dancerId))
      if (current && !current.username) {
        updateSet.username = await freeHandle(ctx.db, current.name)
      }

      await ctx.db
        .update(dancers)
        .set(updateSet)
        .where(eq(dancers.id, ctx.dancerId))

      trackServer(ctx, 'onboarding_completed', { intent: input.intent })
      return { ok: true }
    }),

  me: publicProcedure
    .query(async ({ ctx }) => {
      if (!ctx.dancerId) return null

      const [dancer] = await ctx.db
        .select({
          id: dancers.id,
          name: dancers.name,
          username: dancers.username,
          isAdmin: dancers.isAdmin,
          city: dancers.city,
          danceStyles: dancers.danceStyles,
          danceLevels: dancers.danceLevels,
          role: dancers.role,
          intent: dancers.intent,
          onboardedAt: dancers.onboardedAt,
          bio: dancers.bio,
          photo: dancers.photo,
          instagram: dancers.instagram,
          youtube: dancers.youtube,
          website: dancers.website,
          profilePublic: dancers.profilePublic,
        })
        .from(dancers)
        .where(eq(dancers.id, ctx.dancerId))

      if (!dancer) return null

      return {
        id: dancer.id,
        name: dancer.name,
        username: dancer.username ?? null,
        isAdmin: dancer.isAdmin ?? false,
        city: dancer.city ?? null,
        danceStyles: dancer.danceStyles ?? [],
        danceLevels: dancer.danceLevels ?? {},
        role: dancer.role ?? null,
        intent: dancer.intent ?? null,
        onboardedAt: dancer.onboardedAt ? dancer.onboardedAt.toISOString() : null,
        bio: dancer.bio ?? null,
        photo: dancer.photo ?? null,
        instagram: dancer.instagram ?? null,
        youtube: dancer.youtube ?? null,
        website: dancer.website ?? null,
        profilePublic: dancer.profilePublic ?? true,
      }
    }),

  // The signed-in dancer's account email. Not part of `me` (which the whole app
  // reads); connected-app tools that share it with someone the dancer contacts
  // (booking request, gig post, giveaway entry) fetch it here, under me:read.
  myEmail: protectedProcedure.query(async ({ ctx }) => {
    const [d] = await ctx.db.select({ email: dancers.email }).from(dancers).where(eq(dancers.id, ctx.dancerId))
    if (!d) throw new TRPCError({ code: 'NOT_FOUND', message: 'Account not found.' })
    return { email: d.email }
  }),

  // GDPR account deletion: permanently remove the dancer and cascade delete or
  // anonymize referencing rows in FK-safe order. All writes execute atomically
  // in a transaction. Session is invalidated immediately on return.
  //
  // Deletion strategy:
  // - Hard delete: sessions, dinnerSignups, dinnerGroupMembers, giveawayEntries,
  //   bookingRequests, electionVotes (where voter is this dancer),
  //   electionVoteHistory (where voter is this dancer), electionCandidates,
  //   recommendationRequests, festivalSubmissions.
  // - Handle FK constraints: null moderator_dancer_id in guidelineVersions,
  //   null winner_candidate_id in moderatorElections, delete votes targeting
  //   deleted candidates.
  // - Anonymize: set dancerId=null or clear emails in videoVotes,
  //   cityBattleVotes, festivalSignups, cityVideos, reviews.
  deleteAccount: protectedProcedure
    .mutation(async ({ ctx }) => {
      const dancerId = ctx.dancerId
      if (!dancerId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'You must be signed in to delete your account.',
        })
      }

      try {
        // Get dancer email and dependent IDs first (before batch, since batch doesn't support dependent queries)
        const [dancer] = await ctx.db
          .select({ email: dancers.email })
          .from(dancers)
          .where(eq(dancers.id, dancerId))

        if (!dancer) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found.',
          })
        }

        const dancerEmail = dancer.email

        const candidateIds = await ctx.db
          .select({ id: electionCandidates.id })
          .from(electionCandidates)
          .where(eq(electionCandidates.dancerId, dancerId))

        const ownedHangoutIds = await ctx.db
          .select({ id: hangouts.id })
          .from(hangouts)
          .where(eq(hangouts.dancerId, dancerId))

        const emailLower = dancerEmail.toLowerCase()

        // Build all mutation statements in FK-safe order
        const statements = [
          // 1. Delete votes cast by this dancer (both tables)
          ctx.db.delete(electionVoteHistory).where(eq(electionVoteHistory.voterDancerId, dancerId)),
          ctx.db.delete(electionVotes).where(eq(electionVotes.voterDancerId, dancerId)),

          // 2. Delete/anonymize votes that target this dancer's candidates
          ...candidateIds.flatMap(candidate => [
            ctx.db.delete(electionVotes).where(eq(electionVotes.candidateId, candidate.id)),
            ctx.db.delete(electionVoteHistory).where(eq(electionVoteHistory.toCandidateId, candidate.id)),
            ctx.db.delete(electionVoteHistory).where(eq(electionVoteHistory.fromCandidateId, candidate.id)),
          ]),

          // 3. Clear denormalized moderator identity on profiles where this dancer won
          // (must run before nulling winnerCandidateId, since the subquery reads it)
          ...candidateIds.map(candidate =>
            ctx.db.update(profiles)
              .set({ moderatorName: null, moderatorHandle: null })
              .where(sql`${profiles.id} IN (
                SELECT ${moderatorElections.profileId} FROM ${moderatorElections}
                WHERE ${moderatorElections.winnerCandidateId} = ${candidate.id}
              )`)
          ),

          // 4. Null out winner_candidate_id references for candidates from this dancer
          ...candidateIds.map(candidate =>
            ctx.db.update(moderatorElections)
              .set({ winnerCandidateId: null })
              .where(eq(moderatorElections.winnerCandidateId, candidate.id))
          ),

          // 5. Delete candidates from this dancer
          ctx.db.delete(electionCandidates).where(eq(electionCandidates.dancerId, dancerId)),

          // 6. Delete hangout RSVPs where this dancer is RSVP'd
          ctx.db.delete(hangoutRsvps).where(eq(hangoutRsvps.dancerId, dancerId)),

          // 7. Delete RSVPs on hangouts this dancer created
          ...ownedHangoutIds.map(hangout =>
            ctx.db.delete(hangoutRsvps).where(eq(hangoutRsvps.hangoutId, hangout.id))
          ),

          // 8. Delete owned hangouts
          ctx.db.delete(hangouts).where(eq(hangouts.dancerId, dancerId)),

          // 9. Anonymize gigs: null dancerId AND scrub identifying fields
          ctx.db.update(gigs)
            .set({
              dancerId: null,
              posterName: 'Deleted user',
              contactEmail: 'anonymized@wedance.local',
              contactUrl: null,
            })
            .where(eq(gigs.dancerId, dancerId)),

          // 10. Delete direct FK references
          ctx.db.delete(recommendationRequests).where(eq(recommendationRequests.askerId, dancerId)),
          ctx.db.delete(dinnerGroupMembers).where(eq(dinnerGroupMembers.dancerId, dancerId)),
          ctx.db.delete(dinnerSignups).where(eq(dinnerSignups.dancerId, dancerId)),
          ctx.db.delete(communityGroupReports).where(eq(communityGroupReports.dancerId, dancerId)),
          ctx.db.delete(planItems).where(eq(planItems.dancerId, dancerId)),
          ctx.db.delete(festivalRideShares).where(eq(festivalRideShares.dancerId, dancerId)),
          ctx.db.delete(festivalRoommateLookups).where(eq(festivalRoommateLookups.dancerId, dancerId)),
          ctx.db.delete(reviews).where(eq(reviews.dancerId, dancerId)),

          // 11. Delete giveaway entries by dancerId + email-only rows (case-insensitive)
          ctx.db.delete(giveawayEntries).where(or(
            eq(giveawayEntries.dancerId, dancerId),
            sql`${giveawayEntries.dancerId} IS NULL AND lower(${giveawayEntries.email}) = ${emailLower}`,
          )),

          // 12. Handle bookingRequests: delete where requester (by id or email), null where moderator
          ctx.db.delete(bookingRequests).where(or(
            eq(bookingRequests.requesterId, dancerId),
            sql`${bookingRequests.requesterId} IS NULL AND lower(${bookingRequests.requesterEmail}) = ${emailLower}`,
          )),
          ctx.db.update(bookingRequests).set({ moderatedById: null }).where(eq(bookingRequests.moderatedById, dancerId)),

          // 13. Handle referrals (delete where referrer or referee)
          ctx.db.delete(referrals).where(or(
            eq(referrals.referrerId, dancerId),
            eq(referrals.refereeId, dancerId),
          )),

          // 14. Null out guidelineVersions.moderator_dancer_id
          ctx.db.update(guidelineVersions).set({ moderatorDancerId: null }).where(eq(guidelineVersions.moderatorDancerId, dancerId)),

          // 15. Anonymize rows where the dancer is a voter/submitter but the row should survive
          ctx.db.update(videoVotes).set({ voterDancerId: null }).where(eq(videoVotes.voterDancerId, dancerId)),
          ctx.db.update(cityBattleVotes).set({ voterDancerId: null }).where(eq(cityBattleVotes.voterDancerId, dancerId)),

          // 16. Festival signups: anonymize by dancerId AND email-only rows
          ctx.db.update(festivalSignups)
            .set({ dancerId: null, tickettailorBuyerEmail: null })
            .where(or(
              eq(festivalSignups.dancerId, dancerId),
              sql`${festivalSignups.dancerId} IS NULL AND lower(${festivalSignups.tickettailorBuyerEmail}) = ${emailLower}`,
            )),

          // 17. City videos: anonymize by dancerId AND email-only rows (case-insensitive)
          ctx.db.update(cityVideos)
            .set({ dancerId: null, submittedByEmail: 'anonymized@wedance.local' })
            .where(or(
              eq(cityVideos.dancerId, dancerId),
              sql`${cityVideos.dancerId} IS NULL AND lower(${cityVideos.submittedByEmail}) = ${emailLower}`,
            )),

          // 18. Festival submissions: delete by submittedById, anonymize email-only rows (case-insensitive)
          ctx.db.delete(festivalSubmissions).where(eq(festivalSubmissions.submittedById, dancerId)),
          ctx.db.update(festivalSubmissions)
            .set({ submittedByEmail: 'anonymized@wedance.local' })
            .where(sql`lower(${festivalSubmissions.submittedByEmail}) = ${emailLower}`),

          // 19. Delete sessions and the dancer row (must be last)
          ctx.db.delete(sessions).where(eq(sessions.dancerId, dancerId)),
          ctx.db.delete(dancers).where(eq(dancers.id, dancerId)),
        ]

        // Execute all statements atomically in one batch (neon-http driver)
        await ctx.db.batch(statements as any)

        return { ok: true, deleted: true }
      } catch (error) {
        console.error('Account deletion error:', error)
        if (error instanceof TRPCError) throw error
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not delete your account. Please try again or contact support.',
        })
      }
    }),
})
