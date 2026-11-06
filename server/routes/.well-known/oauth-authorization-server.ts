import { defineEventHandler, setResponseHeaders, setResponseStatus } from 'h3'
import { allowCors, requestOrigin } from '../../oauth/http'
import { authorizationServerMetadata } from '../../oauth/metadata'

// RFC 8414 discovery for MCP clients (Claude, ChatGPT).
export default defineEventHandler((event) => {
  allowCors(event, 'GET, OPTIONS')
  if (event.method === 'OPTIONS') { setResponseStatus(event, 204); return '' }
  setResponseHeaders(event, { 'Cache-Control': 'public, max-age=3600' })
  return authorizationServerMetadata(requestOrigin(event))
})
