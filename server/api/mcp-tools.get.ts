import { defineEventHandler, setResponseHeaders } from 'h3'
import { TOOLS } from '../mcp/tools'
import { PUBLIC_SCOPES, SCOPE_INFO } from '../oauth/config'

/**
 * The MCP tool catalogue for the docs (/docs/mcp, /docs/connect-ai), straight
 * from server/mcp/tools.ts so the docs never drift from the server.
 */
export default defineEventHandler((event) => {
  setResponseHeaders(event, { 'Cache-Control': 'public, max-age=300' })
  return {
    scopes: PUBLIC_SCOPES.map(id => ({ id, ...SCOPE_INFO[id] })),
    tools: TOOLS.map(t => ({
      name: t.name,
      title: t.title,
      description: t.description,
      scopes: t.scopes,
      business: !!t.business,
      confirm: t.confirm === true ? 'always' : t.confirm ? 'when public' : null,
      readOnly: !!t.annotations.readOnlyHint,
      destructive: !!t.annotations.destructiveHint,
      openWorld: !!t.annotations.openWorldHint,
      args: Object.keys(t.input).filter(k => k !== 'confirm_token'),
    })),
  }
})
