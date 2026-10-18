import { getHeader, getMethod, sendWebResponse, setResponseHeaders, setResponseStatus, toWebRequest, type H3Event } from 'h3'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { createContext, type Context } from '../trpc/context'
import { allowCors, clientIp, requestOrigin } from '../oauth/http'
import { mcpResourceFor, resourceMetadataUrlFor, PUBLIC_SCOPES } from '../oauth/config'
import { grantKey, hit, ipKey, LIMITS } from '../oauth/rateLimit'
import { buildMcpServer } from './server'
import { useDb } from '../utils/db'

/**
 * Streamable HTTP for MCP, stateless (each POST is answered on its own, as a
 * JSON response): /mcp needs a WeDance OAuth token, /mcp/public is the
 * anonymous read-only door.
 */

function jsonRpcError(event: H3Event, status: number, message: string, code = -32000) {
  setResponseStatus(event, status)
  setResponseHeaders(event, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  return { jsonrpc: '2.0', error: { code, message }, id: null }
}

/** 401 that tells the client where to log in (RFC 9728 §5.1). */
export function authChallenge(event: H3Event, origin: string, error?: { code: string; description: string }) {
  const parts = [`resource_metadata="${resourceMetadataUrlFor(origin)}"`, `scope="${PUBLIC_SCOPES.join(' ')}"`]
  if (error) parts.push(`error="${error.code}"`, `error_description="${error.description}"`)
  setResponseHeaders(event, { 'WWW-Authenticate': `Bearer ${parts.join(', ')}` })
  return jsonRpcError(event, 401, error ? error.description : 'Sign in to WeDance to use this server.')
}

async function serve(event: H3Event, req: Request, ctx: Context, origin: string) {
  const server = buildMcpServer(ctx, origin)
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
  try {
    await server.connect(transport)
    const res = await transport.handleRequest(req)
    // Read it all before closing: in JSON mode the answer is complete here.
    const body = res.status === 202 ? null : await res.text()
    return sendWebResponse(event, new Response(body, { status: res.status, headers: res.headers }))
  } finally {
    await server.close().catch(() => {})
  }
}

/** Shared preamble: CORS, preflight, and the only method stateless MCP needs (POST). */
function preflight(event: H3Event): unknown | undefined {
  allowCors(event, 'POST, GET, DELETE, OPTIONS')
  const method = getMethod(event)
  if (method === 'OPTIONS') { setResponseStatus(event, 204); return '' }
  if (method !== 'POST') {
    setResponseHeaders(event, { Allow: 'POST, OPTIONS' })
    return jsonRpcError(event, 405, 'This server is stateless: send JSON-RPC with POST. There is no SSE stream to open.')
  }
  return undefined
}

export async function handleAuthenticated(event: H3Event) {
  const origin = requestOrigin(event)
  const early = preflight(event)
  if (early !== undefined) return early
  const header = getHeader(event, 'authorization')
  if (!header?.startsWith('Bearer ')) return authChallenge(event, origin)
  const req = toWebRequest(event)
  const ctx = await createContext({ req, resHeaders: new Headers(), info: {} as any }, {
    resource: mcpResourceFor(origin), origin, waitUntil: p => event.waitUntil(p),
  })
  if (!ctx.oauthGrantId) return authChallenge(event, origin, { code: 'invalid_token', description: 'The access token is invalid, expired or revoked.' })
  const limit = await hit(ctx.db, grantKey(ctx.oauthGrantId), LIMITS.token)
  if (!limit.ok) {
    setResponseHeaders(event, { 'Retry-After': String(limit.retryAfter) })
    return jsonRpcError(event, 429, `Too many requests. Try again in ${limit.retryAfter} s.`)
  }
  return serve(event, req, ctx, origin)
}

export async function handleAnonymous(event: H3Event) {
  const origin = requestOrigin(event)
  const early = preflight(event)
  if (early !== undefined) return early
  const db = useDb()
  const limit = await hit(db, ipKey('mcp-public', clientIp(event)), LIMITS.anonymous)
  if (!limit.ok) {
    setResponseHeaders(event, { 'Retry-After': String(limit.retryAfter) })
    return jsonRpcError(event, 429, `Too many requests. Try again in ${limit.retryAfter} s, or connect with a WeDance account at ${mcpResourceFor(origin)}.`)
  }
  // Anonymous: no dancer, no scopes. Only public reads are listed or callable.
  const ctx: Context = { db, dancerId: null, isAdmin: false, scopes: [], grantedProfileIds: [], origin, voterSessionId: null, waitUntil: p => event.waitUntil(p) }
  return serve(event, toWebRequest(event), ctx, origin)
}
