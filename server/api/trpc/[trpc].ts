import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { appRouter } from '../../trpc'
import { createContext } from '../../trpc/context'
import { requestOrigin } from '../../oauth/http'

const VOTE_SID_COOKIE = 'wd_vote_sid'

export default defineEventHandler(async (event) => {
  const request = toWebRequest(event)

  // Anonymous voting session id — read from cookie, mint + set if missing.
  // This is the anti-gaming key for the city-video pairwise vote: dedupe pairs
  // and cap votes per session without requiring sign-in.
  let voterSessionId = getCookie(event, VOTE_SID_COOKIE) ?? null
  if (!voterSessionId) {
    voterSessionId = (globalThis.crypto?.randomUUID?.() ?? `sid_${Date.now()}_${Math.random().toString(36).slice(2)}`)
    setCookie(event, VOTE_SID_COOKIE, voterSessionId, {
      maxAge: 365 * 24 * 60 * 60, // 1 year
      path: '/',
      sameSite: 'lax',
      httpOnly: true,
    })
  }

  const response = await fetchRequestHandler({
    endpoint: '/api/trpc',
    req: request,
    router: appRouter,
    // Long work (painting a flyer) keeps running after the response, on Vercel too.
    // No `resource`: connected apps' tokens are for /mcp only and are ignored here.
    createContext: (opts) => createContext(opts, { voterSessionId, waitUntil: p => event.waitUntil(p), origin: requestOrigin(event) }),
    // A 500 without a log line can't be debugged (RAZ-618): log every server error.
    onError: ({ path, error }) => {
      if (error.code === 'INTERNAL_SERVER_ERROR') console.error(`[trpc] ${path}:`, error.cause ?? error)
    },
  })

  // Use sendWebResponse to correctly forward the tRPC Response to the client
  return sendWebResponse(event, response)
})
