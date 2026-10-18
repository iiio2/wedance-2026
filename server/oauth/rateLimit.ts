import { lt, sql } from 'drizzle-orm'
import { mcpRateLimits } from '../database/schema'
import { sha256Hex } from './crypto'

/**
 * Fixed-window rate limits in Postgres, so they hold across Vercel's
 * serverless instances without another service. One upsert per request.
 */

type Db = any

export const LIMITS = {
  /** Signed-in assistant calls, per grant. */
  token: { limit: 120, windowS: 60 },
  /** Anonymous /mcp/public calls, per IP: public reads are a scraping surface. */
  anonymous: { limit: 30, windowS: 60 },
  /** /oauth/register, /oauth/token, /oauth/revoke, per IP. */
  oauth: { limit: 30, windowS: 60 },
} as const

export function windowStart(now: number, windowS: number) {
  return new Date(Math.floor(now / (windowS * 1000)) * windowS * 1000)
}

/** Count one hit. `ok: false` once the window's limit is passed; `retryAfter` in seconds. */
export async function hit(db: Db, key: string, rule: { limit: number; windowS: number }, now = Date.now()) {
  const start = windowStart(now, rule.windowS)
  const [row] = await db.insert(mcpRateLimits).values({ key, windowStart: start, count: 1 })
    .onConflictDoUpdate({ target: [mcpRateLimits.key, mcpRateLimits.windowStart], set: { count: sql`${mcpRateLimits.count} + 1` } })
    .returning({ count: mcpRateLimits.count })
  // Prune old windows now and then.
  if (Math.random() < 0.01) await db.delete(mcpRateLimits).where(lt(mcpRateLimits.windowStart, new Date(now - 3600_000)))
  const count = Number(row?.count ?? 1)
  const retryAfter = Math.max(1, Math.ceil((start.getTime() + rule.windowS * 1000 - now) / 1000))
  return { ok: count <= rule.limit, count, retryAfter }
}

/** Keys never hold a raw IP. */
export const ipKey = (scope: string, ip: string | null | undefined) => `${scope}:ip:${sha256Hex(ip || 'unknown').slice(0, 32)}`
export const grantKey = (grantId: string) => `mcp:grant:${grantId}`
