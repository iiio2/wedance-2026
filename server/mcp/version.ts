/**
 * Telling a connected AI app that WeDance's tools changed since it loaded them.
 *
 * MCP clients load the tool list once (ChatGPT when the connector is added or
 * refreshed) and keep using that copy, so a new tool stays invisible in them
 * until the user refreshes. The server is stateless and can't push the change,
 * so it remembers per grant which tool list it last served (tools/list) and,
 * when a later tool call comes from an older list, adds a notice to the result
 * that tells the model to have the user refresh the connector.
 */
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { oauthGrants } from '../database/schema'
import type { ToolDef } from './tools'

/** What a grant was last served by tools/list. */
export type ListedTools = { version: string; names: string[]; at: string }

/** A short fingerprint of a tool list: names, descriptions and input schemas. */
export function toolsVersion(tools: readonly ToolDef[]): string {
  const shape = [...tools]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(t => [t.name, t.title, t.description, t.scopes, z.toJSONSchema(z.object(t.input), { unrepresentable: 'any', io: 'input' })])
  return createHash('sha256').update(JSON.stringify(shape)).digest('hex').slice(0, 12)
}

export function listedTools(tools: readonly ToolDef[], now = new Date()): ListedTools {
  return { version: toolsVersion(tools), names: tools.map(t => t.name).sort(), at: now.toISOString() }
}

/** How to reload the tool list, in the app the call came from. */
export function refreshSteps(app: string | null | undefined): string {
  if (app === 'chatgpt') return 'In ChatGPT: Settings → Apps & Connectors → WeDance → Refresh, then start a new chat.'
  if (app === 'claude') return 'In Claude: start a new conversation; if the new tools still don’t show, Settings → Connectors → WeDance → Disconnect, then connect it again.'
  return 'Refresh or reconnect the WeDance connector in this app’s settings, then start a new chat.'
}

export type UpdateNotice = { version: string; listedVersion: string; newTools: string[]; removedTools: string[]; text: string }

/**
 * A notice when the tools this client was given (listed) differ from the ones
 * this grant gets now (current). Nothing when they match, or when we never
 * saw this grant list its tools (we can't tell what it has).
 */
export function updateNotice(listed: ListedTools | null | undefined, current: readonly ToolDef[], app?: string | null): UpdateNotice | null {
  if (!listed?.version) return null
  const version = toolsVersion(current)
  if (version === listed.version) return null
  // No names = a list from before we kept track (migration 0061): we only know it's old.
  const known = (listed.names ?? []).length > 0
  const had = new Set(listed.names ?? [])
  const now = current.map(t => t.name)
  const newTools = known ? now.filter(n => !had.has(n)).sort() : []
  const removedTools = known ? [...had].filter(n => !now.includes(n)).sort() : []
  const what = newTools.length
    ? `New WeDance tools you can't see yet: ${newTools.join(', ')}.`
    : known ? 'WeDance tools changed (descriptions or options).' : 'WeDance has new tools since this app loaded its list (e.g. editing the page’s own website: get_my_site / update_my_site).'
  const text = `WeDance update available: this app is using an older WeDance tool list (version ${listed.version}, now ${version}). ${what} `
    + `If the user's request needs something you can't do with your current tools, don't say it's impossible: tell the user WeDance has been updated and how to load the update. ${refreshSteps(app)}`
  return { version, listedVersion: listed.version, newTools, removedTools, text }
}

/** Remember what this grant was served (only when it changed). Never throws. */
export async function recordListedTools(db: any, grantId: string, listed: ListedTools, previous: ListedTools | null | undefined): Promise<void> {
  if (previous?.version === listed.version) return
  try {
    await db.update(oauthGrants).set({ mcpToolsListed: listed }).where(eq(oauthGrants.id, grantId))
  } catch (e) {
    console.warn('[mcp] could not record the listed tools', (e as Error)?.message)
  }
}

export async function readListedTools(db: any, grantId: string): Promise<ListedTools | null> {
  try {
    const [row] = await db.select({ listed: oauthGrants.mcpToolsListed }).from(oauthGrants).where(eq(oauthGrants.id, grantId))
    return (row?.listed as ListedTools | null) ?? null
  } catch {
    return null
  }
}

/** JSON-RPC methods in a request body (one message or a batch). */
export function rpcMethods(body: unknown): string[] {
  const msgs = Array.isArray(body) ? body : [body]
  return msgs.map(m => (m && typeof m === 'object' && typeof (m as any).method === 'string' ? (m as any).method : null)).filter(Boolean) as string[]
}
