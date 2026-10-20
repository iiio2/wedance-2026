/**
 * Structural + behavioural guard test for tRPC mutations.
 *
 * 1. Walks `appRouter` and asserts every mutation uses `protectedProcedure` or
 *    `adminProcedure`, unless it appears in an explicit allow-list with a
 *    one-line reason.
 * 2. Calls a sample of protected mutations as an anonymous caller and asserts
 *    they throw UNAUTHORIZED.
 *
 * Adding a new public mutation without updating the allow-list fails this test.
 * RAZ-281
 */
import { describe, it, expect } from 'vitest'
import { TRPCError } from '@trpc/server'
import { appRouter } from '../index'
import { protectedProcedure, adminProcedure } from '../trpc'

// ---------------------------------------------------------------------------
// Allow-list: public mutations that intentionally skip auth.
// Every entry needs a one-line reason so reviewers know why it's public.
// ---------------------------------------------------------------------------
const PUBLIC_MUTATIONS_ALLOW_LIST: Record<string, string> = {
  'auth.requestMagicLink': 'unauthenticated by definition — initiates the sign-in flow',
  'auth.verifyMagicLink': 'unauthenticated by definition — completes the magic-link sign-in',
  'auth.resetPassword': 'unauthenticated by definition — password recovery flow',
  'auth.login': 'unauthenticated by definition — email+password sign-in',
  'auth.register': 'unauthenticated by definition — account creation',
  'booking.request': 'public booking form — guests can request without an account',
  'inquiries.send': 'book an artist or venue from their page or /@handle/book link — no account; honeypot + per-day limits',
  'cityVideo.vote': 'anonymous community voting on city videos',
  'cityVideo.submit': 'anonymous video submission (moderated via admin)',
  'cityVideo.battleVote': 'anonymous battle voting on city videos',
  'feedback.inquiry': 'public contact/inquiry form — no account required',
  'artistInvites.respond': 'an artist answers an organizer’s invite link without an account; only while nobody manages the page — a managed page needs its team signed in (checked inside)',
  'festival.submitDraft': 'public festival submission (moderated via admin)',
  'giveaway.enter': 'public giveaway entry — low-risk, promotional',
  'referral.trackVisit': 'counts a visit to a promoter’s tracked link before anyone signs in; once per browser session, unknown codes count nothing',
}

// Reference middleware functions from the procedure builders
// The guard is each builder's last middleware (a shared logging one runs first).
const protectedMw = (protectedProcedure as any)._def.middlewares.at(-1)
const adminMw = (adminProcedure as any)._def.middlewares.at(-1)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getAllMutations(): { path: string; guard: 'public' | 'protected' | 'admin' }[] {
  const procedures = (appRouter as any)._def.procedures as Record<string, any>
  const result: { path: string; guard: 'public' | 'protected' | 'admin' }[] = []

  for (const [path, proc] of Object.entries(procedures)) {
    if (proc._def.type !== 'mutation') continue

    const middlewares: any[] = proc._def.middlewares
    const hasProtected = middlewares.some((mw: any) => mw === protectedMw)
    const hasAdmin = middlewares.some((mw: any) => mw === adminMw)

    let guard: 'public' | 'protected' | 'admin' = 'public'
    if (hasAdmin) guard = 'admin'
    else if (hasProtected) guard = 'protected'

    result.push({ path, guard })
  }

  return result
}

// ---------------------------------------------------------------------------
// Test 1 — structural: every mutation is guarded or explicitly allowed
// ---------------------------------------------------------------------------
describe('auth guard — structural', () => {
  const mutations = getAllMutations()

  it('every mutation is protected/admin or in the allow-list', () => {
    const unguarded: string[] = []

    for (const { path, guard } of mutations) {
      if (guard !== 'public') continue
      if (PUBLIC_MUTATIONS_ALLOW_LIST[path]) continue
      unguarded.push(path)
    }

    if (unguarded.length > 0) {
      throw new Error(
        `These mutations use publicProcedure but are NOT in the allow-list.\n` +
        `Either switch them to protectedProcedure/adminProcedure, or add them ` +
        `to PUBLIC_MUTATIONS_ALLOW_LIST in authGuard.test.ts with a reason:\n\n` +
        unguarded.map(p => `  - ${p}`).join('\n'),
      )
    }
  })

  it('allow-list entries are all real public mutations (no stale entries)', () => {
    const publicPaths = new Set(
      mutations.filter(m => m.guard === 'public').map(m => m.path),
    )

    const stale: string[] = []
    for (const path of Object.keys(PUBLIC_MUTATIONS_ALLOW_LIST)) {
      if (!publicPaths.has(path)) {
        stale.push(path)
      }
    }

    if (stale.length > 0) {
      throw new Error(
        `These allow-list entries no longer match a public mutation ` +
        `(removed or switched to protected?) — clean them up:\n\n` +
        stale.map(p => `  - ${p}`).join('\n'),
      )
    }
  })

  it('at least one protected and one admin mutation exist (sanity check)', () => {
    expect(mutations.some(m => m.guard === 'protected')).toBe(true)
    expect(mutations.some(m => m.guard === 'admin')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Test 2 — behavioural: anonymous callers get UNAUTHORIZED on protected mutations
// ---------------------------------------------------------------------------
describe('auth guard — anonymous caller gets UNAUTHORIZED', () => {
  // Sample of protected mutations across different routers
  const protectedSamples = [
    'profile.update',
    'plan.add',
    'review.create',
    'gigs.create',
    'hangouts.create',
    'dinner.join',
    'auth.changePassword',
    'booking.setAvailability',
  ]

  // Create an anonymous caller (no dancerId, not admin)
  const anonymousCaller = appRouter.createCaller({
    db: {} as any, // procedures should reject before touching the DB
    dancerId: null,
    isAdmin: false,
  })

  for (const path of protectedSamples) {
    it(`${path} rejects anonymous callers with UNAUTHORIZED`, async () => {
      const [namespace, method] = path.split('.') as [string, string]
      const routerNs = (anonymousCaller as any)[namespace]
      const fn = routerNs[method]

      try {
        await fn({})
        throw new Error(`Expected ${path} to throw UNAUTHORIZED, but it succeeded`)
      }
      catch (err) {
        if (err instanceof TRPCError) {
          expect(err.code).toBe('UNAUTHORIZED')
        }
        else {
          // Re-throw if it's our "expected to throw" error
          const msg = (err as Error).message
          if (msg.startsWith('Expected')) throw err
          // Other errors (e.g. DB access) are acceptable — the auth
          // middleware ran but the procedure continued into DB code with
          // a null context. This shouldn't happen with protectedProcedure
          // but if it does, the structural test above already catches it.
          throw err
        }
      }
    })
  }
})
