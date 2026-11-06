import { getHeader, type H3Event } from 'h3'

/**
 * Where an MCP call came from: the app (ChatGPT, Claude, Cursor…) and the
 * country. Stateless MCP has no session, so every call carries its own
 * request headers; we keep the app, the raw User-Agent (to reclassify later)
 * and Vercel's country code. Never the IP.
 */
export interface McpCaller { app: string; userAgent: string | null; country: string | null }

const APPS: [RegExp, string][] = [
  [/openai|chatgpt/i, 'chatgpt'],
  [/claude|anthropic/i, 'claude'],
  [/cursor/i, 'cursor'],
  [/windsurf|codeium/i, 'windsurf'],
  [/vscode|visual studio code|copilot/i, 'vscode'],
  [/gemini|google/i, 'gemini'],
  [/perplexity/i, 'perplexity'],
  [/mistral|le ?chat/i, 'mistral'],
  [/inspector/i, 'mcp-inspector'],
]

/** The app behind a call: a known one from the User-Agent, else the OAuth client's host, else the UA's first product token. */
export function mcpApp(userAgent: string | null | undefined, oauthClientId?: string | null): string {
  const ua = userAgent?.trim() ?? ''
  for (const [re, app] of APPS) if (re.test(ua)) return app
  if (oauthClientId) {
    for (const [re, app] of APPS) if (re.test(oauthClientId)) return app
    try { return new URL(oauthClientId).host } catch { /* a DCR id, not a URL */ }
  }
  const product = ua.split(/[\s/]/)[0]?.toLowerCase()
  return product ? product.slice(0, 40) : 'unknown'
}

export function mcpCaller(event: H3Event, oauthClientId?: string | null): McpCaller {
  const userAgent = getHeader(event, 'user-agent')?.slice(0, 300) || null
  const country = getHeader(event, 'x-vercel-ip-country')?.toUpperCase() ?? ''
  return { app: mcpApp(userAgent, oauthClientId), userAgent, country: /^[A-Z]{2}$/.test(country) ? country : null }
}
