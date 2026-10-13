import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
import { eq, and, gt } from 'drizzle-orm'
import { useDb } from '../utils/db'
import { dancers, sessions } from '../database/schema'

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
}

export async function createContext(
  opts: FetchCreateContextFnOptions,
  extra?: { voterSessionId?: string | null; waitUntil?: (p: Promise<unknown>) => void },
): Promise<Context> {
  const db = useDb()

  const authHeader = opts.req.headers.get('authorization')
  let dancerId: string | null = null
  let isAdmin = false

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

  return { db, dancerId, isAdmin, voterSessionId: extra?.voterSessionId ?? null, waitUntil: extra?.waitUntil }
}
