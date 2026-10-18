import { eq } from 'drizzle-orm'
import { events, mcpAudit, profiles } from '../database/schema'
import { hashArgs } from '../oauth/crypto'

/**
 * mcp_audit: every tool call, with a hash of its input (never the input),
 * the outcome and the latency. `profileId` lets a profile's team see what
 * connected apps did for it (oauth.auditForProfile).
 */

type Db = any

export interface AuditWho { grantId: string | null; dancerId: string | null; clientId: string | null }

/** The profile a call was for: its `profile`/`username` handle, or the host of its event. */
export async function auditTarget(db: Db, args: Record<string, unknown>): Promise<{ target: string | null; profileId: string | null }> {
  const handle = [args.profile, args.username, args.host_profile].find(v => typeof v === 'string') as string | undefined
  const eventId = [args.event_id, args.eventId].find(v => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v as string)) as string | undefined
  try {
    if (handle) {
      const [p] = await db.select({ id: profiles.id }).from(profiles).where(eq(profiles.username, handle))
      return { target: `@${handle}`, profileId: p?.id ?? null }
    }
    if (eventId) {
      const [e] = await db.select({ host: events.hostProfileId }).from(events).where(eq(events.id, eventId))
      return { target: `event:${eventId}`, profileId: e?.host ?? null }
    }
  } catch { /* the audit never breaks a call */ }
  return { target: null, profileId: null }
}

export async function writeAudit(db: Db, row: AuditWho & {
  tool: string
  args: Record<string, unknown>
  result: 'ok' | 'error' | 'preview' | 'denied'
  errorCode?: string | null
  latencyMs: number
  confirmNonce?: string | null
}) {
  try {
    const { target, profileId } = await auditTarget(db, row.args)
    await db.insert(mcpAudit).values({
      grantId: row.grantId, dancerId: row.dancerId, clientId: row.clientId, tool: row.tool, target, profileId,
      inputHash: hashArgs(row.args), result: row.result, errorCode: row.errorCode ?? null, latencyMs: Math.round(row.latencyMs),
      confirmNonce: row.confirmNonce ?? null,
    })
  } catch (e) {
    console.error('[mcp] audit write failed', (e as Error).message)
  }
}

/**
 * Spend a confirmation's nonce before committing. False when it was spent
 * already (the unique index says so), i.e. a replayed confirmation.
 */
export async function claimConfirmNonce(db: Db, who: AuditWho, tool: string, args: Record<string, unknown>, nonce: string): Promise<string | null> {
  try {
    const { target, profileId } = await auditTarget(db, args)
    const [row] = await db.insert(mcpAudit).values({
      grantId: who.grantId, dancerId: who.dancerId, clientId: who.clientId, tool, target, profileId,
      inputHash: hashArgs(args), result: 'ok', confirmNonce: nonce,
    }).onConflictDoNothing({ target: mcpAudit.confirmNonce }).returning({ id: mcpAudit.id })
    return row?.id ?? null
  } catch {
    return null
  }
}

export async function finishAudit(db: Db, id: string, result: 'ok' | 'error', latencyMs: number, errorCode?: string | null) {
  try {
    await db.update(mcpAudit).set({ result, latencyMs: Math.round(latencyMs), errorCode: errorCode ?? null }).where(eq(mcpAudit.id, id))
  } catch { /* never breaks a call */ }
}
