import { createError, defineEventHandler, getRouterParam, setResponseHeaders, setResponseStatus } from 'h3'
import { allowCors, requestOrigin } from '../../../oauth/http'
import { protectedResourceMetadata } from '../../../oauth/metadata'

// RFC 9728 §3.1 path-suffixed form: /.well-known/oauth-protected-resource/mcp.
export default defineEventHandler((event) => {
  allowCors(event, 'GET, OPTIONS')
  if (event.method === 'OPTIONS') { setResponseStatus(event, 204); return '' }
  if (getRouterParam(event, 'path') !== 'mcp') throw createError({ statusCode: 404, statusMessage: 'Not Found' })
  setResponseHeaders(event, { 'Cache-Control': 'public, max-age=3600' })
  return protectedResourceMetadata(requestOrigin(event))
})
