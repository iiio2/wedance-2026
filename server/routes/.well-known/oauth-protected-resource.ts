import { defineEventHandler, getMethod, setResponseHeaders, setResponseStatus } from 'h3'
import { allowCors, requestOrigin } from '../../oauth/http'
import { protectedResourceMetadata } from '../../oauth/metadata'

// RFC 9728: which authorization server protects /mcp.
export default defineEventHandler((event) => {
  allowCors(event, 'GET, OPTIONS')
  if (getMethod(event) === 'OPTIONS') { setResponseStatus(event, 204); return '' }
  setResponseHeaders(event, { 'Cache-Control': 'public, max-age=3600' })
  return protectedResourceMetadata(requestOrigin(event))
})
