import { defineEventHandler, getMethod, setResponseStatus } from 'h3'
import { allowCors, limitOAuthIp, noStore, oauthErrorResponse, readJsonObject } from '../../oauth/http'
import { OAuthError } from '../../oauth/errors'
import { registerClient } from '../../oauth/clients'
import { useDb } from '../../utils/db'

// RFC 7591 Dynamic Client Registration. Open (no initial access token), as MCP
// clients expect; registrations are rate limited per IP and only store what we use.
export default defineEventHandler(async (event) => {
  allowCors(event, 'POST, OPTIONS')
  const method = getMethod(event)
  if (method === 'OPTIONS') { setResponseStatus(event, 204); return '' }
  try {
    if (method !== 'POST') throw new OAuthError('invalid_request', 'Use POST', 405)
    await limitOAuthIp(event, 'register')
    const res = await registerClient(useDb(), await readJsonObject(event))
    setResponseStatus(event, 201)
    noStore(event)
    return res
  } catch (e) {
    return oauthErrorResponse(event, e)
  }
})
