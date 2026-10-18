import { randomBytes } from 'node:crypto'
import { hashArgs, signPayload, verifyPayload } from '../oauth/crypto'
import { CONFIRM_TTL_S } from '../oauth/config'

/**
 * business:publish tools run in two steps. The first call returns a preview
 * and a `confirm_token`; the second call, with the same arguments plus that
 * token, commits. The token is signed and short lived, and bound to the grant,
 * the tool and a hash of the arguments, so it can't be replayed on another
 * connection, another tool or changed arguments. Its nonce makes it single use
 * (mcp_audit.confirm_nonce is unique).
 */

const PURPOSE = 'mcp-confirm'

/** The arguments a confirmation covers: everything except the token itself. */
export function confirmedArgs(args: Record<string, unknown>) {
  const { confirm_token: _t, ...rest } = args
  return rest
}

export function mintConfirmToken(grantId: string, tool: string, args: Record<string, unknown>, now = Date.now()) {
  return signPayload(PURPOSE, { g: grantId, t: tool, a: hashArgs(confirmedArgs(args)), n: randomBytes(12).toString('base64url') }, CONFIRM_TTL_S, now)
}

export type ConfirmCheck = { ok: true; nonce: string } | { ok: false; reason: string }

export function checkConfirmToken(token: string, grantId: string, tool: string, args: Record<string, unknown>, now = Date.now()): ConfirmCheck {
  const p = verifyPayload<{ g: string; t: string; a: string; n: string }>(PURPOSE, token, now)
  if (!p) return { ok: false, reason: 'The confirmation expired or is invalid. Call the tool again without confirm_token to get a fresh preview.' }
  if (p.g !== grantId) return { ok: false, reason: 'This confirmation belongs to another connection.' }
  if (p.t !== tool) return { ok: false, reason: `This confirmation is for ${p.t}, not ${tool}.` }
  if (p.a !== hashArgs(confirmedArgs(args))) return { ok: false, reason: 'The arguments changed since the preview. Get a new preview and show it to the user first.' }
  return { ok: true, nonce: p.n }
}
