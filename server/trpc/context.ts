import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import { eq, and, gt } from 'drizzle-orm'
import { useDb } from '../utils/db'
import { dancers, sessions } from '../database/schema'
import { ACCESS_PREFIX } from '../oauth/crypto'
import { resolveAccessToken } from '../oauth/tokens'

export interface Context {
  db: ReturnType<typeof useDb>
  dancerId: string | null
  isAdmin: boolean
  // Anonymous voting session id (from the `wd_vote_sid` cookie). Used by the
  // city-video vote flow to dedupe pairs and cap votes per session. Set by the
  // trpc event handler, which also writes the cookie back when it mints a new
  // one. Optional so direct `createCaller` sites (tests, other entry points)
  // don't have to supply it; the vote flow treats a missing id as "no session".
  voterSessionId?: string | null
  // Run work after the response is sent (flyer painting). Absent in tests and
  // createCaller sites, where callers fall back to fire-and-forget.
  waitUntil?: (p: Promise<unknown>) => void
  // Admin "view as": an admin opened /business as another user (x-wedance-view-as).
  // protectedProcedure then runs everything as that user (admin rights kept).
  viewAs?: { id: string; name: string } | null
  // A connected app's OAuth token (MCP). Null/absent for web sessions, which
  // may do everything the dancer may do. With a token: the scopes the dancer
  // allowed (checked per procedure, server/trpc/scopes.ts) and the business
  // profiles the app may act for (checked in the profile access helpers).
  scopes?: string[] | null
  grantedProfileIds?: string[] | null
  oauthClientId?: string | null
  oauthGrantId?: string | null
  // Our public origin for this request (OAuth issuer / MCP resource).
  origin?: string | null
}

export interface ContextExtra {
  voterSessionId?: string | null
  waitUntil?: (p: Promise<unknown>) => void
  // The resource this request is for (`${origin}/mcp`). OAuth access tokens are
  // audience-bound: one presented anywhere else is ignored (RFC 8707).
  resource?: string | null
  origin?: string | null
}

export async function createContext(
  opts: FetchCreateContextFnOptions,
  extra?: ContextExtra,
): Promise<Context> {
  const db = useDb()

  const authHeader = opts.req.headers.get('authorization')
  let dancerId: string | null = null
  let isAdmin = false

  // A connected app (MCP): an OAuth access token, valid only for its resource.
  if (authHeader?.startsWith(`Bearer ${ACCESS_PREFIX}`)) {
    const auth = await resolveAccessToken(db, authHeader.slice(7), extra?.resource)
    if (!auth) {
      // Unknown, expired, revoked or for another resource: anonymous, and
      // still scoped (empty) so nothing beyond public reads runs.
      return { db, dancerId: null, isAdmin: false, scopes: [], grantedProfileIds: [], origin: extra?.origin ?? null, voterSessionId: null, waitUntil: extra?.waitUntil }
    }
    return {
      db,
      dancerId: auth.dancerId,
      isAdmin: auth.isAdmin,
      scopes: auth.scopes,
      grantedProfileIds: auth.grantedProfileIds,
      oauthClientId: auth.clientId,
      oauthGrantId: auth.grantId,
      origin: extra?.origin ?? null,
      // City-video votes from an app dedupe per connection.
      voterSessionId: `mcp:${auth.grantId}`,
      waitUntil: extra?.waitUntil,
      viewAs: null,
    }
  }

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)

    // Look up session by token, check not expired
    const [session] = await db
      .select({ dancerId: sessions.dancerId })
      .from(sessions)
      .where(
        and(
          eq(sessions.token, token),
          gt(sessions.expiresAt, new Date()),
        ),
      )

    if (session) {
      const [dancer] = await db
        .select({ id: dancers.id, isAdmin: dancers.isAdmin })
        .from(dancers)
        .where(eq(dancers.id, session.dancerId))

      if (dancer) {
        dancerId = dancer.id
        isAdmin = dancer.isAdmin ?? false
      }
    }
  }

  // Only an admin can view as someone else; anyone else's header is ignored.
  let viewAs: Context['viewAs'] = null
  const asId = opts.req.headers.get('x-wedance-view-as')
  if (isAdmin && asId && /^[0-9a-f-]{36}$/i.test(asId) && asId !== dancerId) {
    const [d] = await db.select({ id: dancers.id, name: dancers.name }).from(dancers).where(eq(dancers.id, asId))
    if (d) viewAs = d
  }

  return { db, dancerId, isAdmin, voterSessionId: extra?.voterSessionId ?? null, waitUntil: extra?.waitUntil, viewAs, origin: extra?.origin ?? null }
}
