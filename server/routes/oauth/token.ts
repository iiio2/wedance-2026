import { defineEventHandler, getHeader, getMethod, setResponseStatus } from 'h3'
import { allowCors, limitOAuthIp, noStore, oauthErrorResponse, readParams } from '../../oauth/http'
import { OAuthError } from '../../oauth/errors'
import { authenticateClient } from '../../oauth/clients'
import { exchangeCode, refreshTokens } from '../../oauth/tokens'
import { useDb } from '../../utils/db'

// Token endpoint: authorization_code (PKCE S256) and refresh_token (rotating).
export default defineEventHandler(async (event) => {
  allowCors(event, 'POST, OPTIONS')
  const method = getMethod(event)
  if (method === 'OPTIONS') { setResponseStatus(event, 204); return '' }
  try {
    if (method !== 'POST') throw new OAuthError('invalid_request', 'Use POST', 405)
    await limitOAuthIp(event, 'token')
    const db = useDb()
    const form = await readParams(event)
    const client = await authenticateClient(db, form, getHeader(event, 'authorization'))
    noStore(event)
    if (form.grant_type === 'authorization_code') return await exchangeCode(db, client, form)
    if (form.grant_type === 'refresh_token') return await refreshTokens(db, client, form)
    throw new OAuthError('unsupported_grant_type', 'grant_type must be authorization_code or refresh_token')
  } catch (e) {
    return oauthErrorResponse(event, e)
  }
})
