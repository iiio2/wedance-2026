import { defineEventHandler, getHeader, getMethod, setResponseStatus } from 'h3'
import { allowCors, limitOAuthIp, noStore, oauthErrorResponse, readParams } from '../../oauth/http'
import { OAuthError } from '../../oauth/errors'
import { authenticateClient } from '../../oauth/clients'
import { revokeToken } from '../../oauth/tokens'
import { useDb } from '../../utils/db'

// RFC 7009 token revocation. 200 whether or not the token was known.
export default defineEventHandler(async (event) => {
  allowCors(event, 'POST, OPTIONS')
  const method = getMethod(event)
  if (method === 'OPTIONS') { setResponseStatus(event, 204); return '' }
  try {
    if (method !== 'POST') throw new OAuthError('invalid_request', 'Use POST', 405)
    await limitOAuthIp(event, 'revoke')
    const db = useDb()
    const form = await readParams(event)
    const client = await authenticateClient(db, form, getHeader(event, 'authorization'))
    await revokeToken(db, client, form.token)
    noStore(event)
    return {}
  } catch (e) {
    return oauthErrorResponse(event, e)
  }
})
