import { describe, it, expect } from 'vitest'
import { createHash } from 'node:crypto'
import { hashArgs, isValidCodeChallenge, randomToken, safeEqual, sha256Hex, signPayload, verifyPayload, verifyPkce, ACCESS_PREFIX } from './crypto'
import { redirectUriProblem, redirectUriRegistered, redirectWith } from './redirect'
import { cimdUrlProblem, isPrivateAddress, parseClientMetadata, safeLookup } from './cimd'
import { hasScope, isAdminClient, parseScopes, siteOrigin } from './config'
import { authorizationServerMetadata, protectedResourceMetadata } from './metadata'

const challengeOf = (v: string) => createHash('sha256').update(v).digest('base64url')

describe('PKCE S256', () => {
  const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk' // RFC 7636 appendix B
  it('accepts the matching verifier (RFC 7636 example)', () => {
    expect(challengeOf(verifier)).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
    expect(verifyPkce(verifier, 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')).toBe(true)
  })
  it('rejects a wrong, missing, short or malformed verifier', () => {
    const c = challengeOf(verifier)
    expect(verifyPkce(`${verifier.slice(0, -1)}x`, c)).toBe(false)
    expect(verifyPkce(undefined, c)).toBe(false)
    expect(verifyPkce('short', c)).toBe(false)
    expect(verifyPkce(`${verifier}!`, c)).toBe(false) // outside the unreserved set
  })
  it('only accepts 43-char base64url challenges', () => {
    expect(isValidCodeChallenge(challengeOf(verifier))).toBe(true)
    expect(isValidCodeChallenge('plain-verifier-is-not-a-challenge')).toBe(false)
    expect(isValidCodeChallenge(`${challengeOf(verifier)}=`)).toBe(false)
  })
})

describe('token hashing and comparison', () => {
  it('stores sha256 hex, never the token', () => {
    const t = randomToken(ACCESS_PREFIX)
    expect(t.startsWith('wda_')).toBe(true)
    expect(t.length).toBeGreaterThan(40)
    expect(sha256Hex(t)).toMatch(/^[0-9a-f]{64}$/)
    expect(sha256Hex(t)).not.toContain(t.slice(4, 20))
    expect(randomToken()).not.toBe(randomToken())
  })
  it('compares in constant time and exactly', () => {
    expect(safeEqual('abc', 'abc')).toBe(true)
    expect(safeEqual('abc', 'abd')).toBe(false)
    expect(safeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('signed payloads (consent request tokens, confirm tokens)', () => {
  it('round-trips, and binds the purpose', () => {
    const t = signPayload('a', { x: 1 }, 60)
    expect(verifyPayload('a', t)?.x).toBe(1)
    expect(verifyPayload('b', t)).toBeNull()
  })
  it('rejects tampering and expiry', () => {
    const t = signPayload('a', { x: 1 }, 60)
    const [body, mac] = t.split('.')
    const forged = Buffer.from(JSON.stringify({ x: 2, exp: 9e9 })).toString('base64url')
    expect(verifyPayload('a', `${forged}.${mac}`)).toBeNull()
    expect(verifyPayload('a', `${body}.${mac}x`)).toBeNull()
    expect(verifyPayload('a', t, Date.now() + 61_000)).toBeNull()
    expect(verifyPayload('a', 'not-a-token')).toBeNull()
  })
  it('hashes arguments independent of key order', () => {
    expect(hashArgs({ a: 1, b: [1, { c: 2, d: 3 }] })).toBe(hashArgs({ b: [1, { d: 3, c: 2 }], a: 1 }))
    expect(hashArgs({ a: 1 })).not.toBe(hashArgs({ a: 2 }))
  })
})

describe('redirect_uri', () => {
  it('registration accepts https, loopback http and private-use schemes', () => {
    expect(redirectUriProblem('https://claude.ai/api/mcp/auth_callback')).toBeNull()
    expect(redirectUriProblem('http://localhost:6274/oauth/callback')).toBeNull()
    expect(redirectUriProblem('http://127.0.0.1:33418/cb')).toBeNull()
    expect(redirectUriProblem('com.example.app:/oauth2redirect')).toBeNull()
  })
  it('registration refuses dangerous or sloppy URIs', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,hi', 'http://evil.example/cb', 'https://a.example/cb#frag', 'https://user:pw@a.example/cb', 'file:///etc/passwd', 'myapp:/cb', '', 'not a url']) {
      expect(redirectUriProblem(bad), bad).not.toBeNull()
    }
  })
  it('matches exactly: no prefix, case, trailing slash or query tricks', () => {
    const reg = ['https://claude.ai/api/mcp/auth_callback']
    expect(redirectUriRegistered(reg, 'https://claude.ai/api/mcp/auth_callback')).toBe(true)
    for (const bad of ['https://claude.ai/api/mcp/auth_callback/', 'https://claude.ai/api/mcp/auth_callback?x=1', 'https://CLAUDE.ai/api/mcp/auth_callback', 'https://claude.ai/api/mcp/auth_callback.evil.com', 'https://claude.ai/api/mcp', null, undefined]) {
      expect(redirectUriRegistered(reg, bad as any), String(bad)).toBe(false)
    }
  })
  it('builds the redirect with encoded params and keeps existing ones', () => {
    const u = new URL(redirectWith('https://a.example/cb?keep=1', { code: 'c&d', state: 'x y', iss: 'https://wedance', skip: null }))
    expect(u.searchParams.get('keep')).toBe('1')
    expect(u.searchParams.get('code')).toBe('c&d')
    expect(u.searchParams.get('state')).toBe('x y')
    expect(u.searchParams.has('skip')).toBe(false)
  })
})

describe('Client ID Metadata Documents — SSRF guards', () => {
  it('flags private, loopback, link-local, metadata and mapped addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', '::', 'fe80::1', 'fd00::1', '::ffff:127.0.0.1', '::ffff:10.0.0.1', '224.0.0.1', 'not-an-ip']) {
      expect(isPrivateAddress(ip), ip).toBe(true)
    }
    for (const ip of ['1.1.1.1', '140.82.112.3', '2606:4700:4700::1111', '::ffff:8.8.8.8']) {
      expect(isPrivateAddress(ip), ip).toBe(false)
    }
  })
  it('only fetches https URLs with a path on a public domain name', () => {
    expect(cimdUrlProblem('https://claude.ai/oauth/mcp-client-metadata.json')).toBeNull()
    for (const bad of ['http://claude.ai/meta.json', 'https://claude.ai/', 'https://127.0.0.1/meta.json', 'https://[::1]/meta.json', 'https://localhost/meta.json', 'https://printer.local/meta.json', 'https://u:p@a.example/meta', 'https://a.example:8443/meta', 'https://a.example/x/../meta', 'https://intranet/meta.json']) {
      expect(cimdUrlProblem(bad), bad).not.toBeNull()
    }
  })
  it('the socket lookup refuses a hostname that resolves to a private address (DNS rebinding)', async () => {
    const fake = (addrs: string[]) => ((_h: string, _o: any, cb: any) => cb(null, addrs.map(a => ({ address: a, family: a.includes(':') ? 6 : 4 })))) as any
    const run = (addrs: string[]) => new Promise<{ err: any; addr: any }>(res => safeLookup(fake(addrs))('x.example', {}, (err: any, addr: any) => res({ err, addr })))
    expect((await run(['93.184.216.34'])).addr).toBe('93.184.216.34')
    expect((await run(['93.184.216.34', '10.0.0.5'])).err?.code).toBe('EPRIVATEADDR')
    expect((await run(['169.254.169.254'])).err?.code).toBe('EPRIVATEADDR')
  })
  it('validates the document against its URL', () => {
    const id = 'https://app.example/client.json'
    const ok = parseClientMetadata(id, { client_id: id, client_name: 'App', redirect_uris: ['https://app.example/cb'] })
    expect(ok).toMatchObject({ name: 'App', redirectUris: ['https://app.example/cb'] })
    expect(() => parseClientMetadata(id, { client_id: 'https://other.example/client.json', redirect_uris: ['https://app.example/cb'] })).toThrow(/does not match/)
    expect(() => parseClientMetadata(id, { client_id: id, redirect_uris: ['javascript:alert(1)'] })).toThrow()
    expect(() => parseClientMetadata(id, { client_id: id, redirect_uris: ['https://app.example/cb'], client_secret: 's' })).toThrow(/secret/)
    expect(() => parseClientMetadata(id, { client_id: id, redirect_uris: ['https://app.example/cb'], token_endpoint_auth_method: 'client_secret_post' })).toThrow(/none/)
    expect(() => parseClientMetadata(id, { client_id: id, redirect_uris: ['https://app.example/cb'], token_endpoint_auth_method: 'private_key_jwt', token_endpoint_auth_methods_supported: ['private_key_jwt'] })).toThrow(/none/)
    expect(() => parseClientMetadata(id, [])).toThrow()
  })
  it('accepts a client that prefers private_key_jwt but also supports none (ChatGPT)', () => {
    const id = 'https://chatgpt.com/oauth/client.json'
    const doc = {
      client_id: id,
      client_name: 'ChatGPT',
      redirect_uris: ['https://chatgpt.com/connector_platform_oauth_redirect'],
      token_endpoint_auth_method: 'private_key_jwt',
      token_endpoint_auth_methods_supported: ['none', 'private_key_jwt'],
      token_endpoint_auth_signing_alg: 'RS256',
      jwks_uri: 'https://chatgpt.com/oauth/jwks.json',
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
    }
    expect(parseClientMetadata(id, doc)).toMatchObject({ name: 'ChatGPT', redirectUris: ['https://chatgpt.com/connector_platform_oauth_redirect'] })
  })
})

describe('scopes and config', () => {
  it('parses known scopes only', () => {
    expect(parseScopes('me:read  bogus business:write me:read')).toEqual(['me:read', 'business:write'])
    expect(parseScopes(undefined)).toEqual([])
  })
  it('business scopes nest: publish ⊃ write ⊃ read; others do not', () => {
    expect(hasScope(['business:publish'], 'business:read')).toBe(true)
    expect(hasScope(['business:publish'], 'business:write')).toBe(true)
    expect(hasScope(['business:write'], 'business:publish')).toBe(false)
    expect(hasScope(['business:read'], 'business:write')).toBe(false)
    expect(hasScope(['plan:write'], 'me:read')).toBe(false)
    expect(hasScope(['business:publish'], 'admin')).toBe(false)
    expect(hasScope(null, 'me:read')).toBe(false)
  })
  it('admin clients come only from MCP_ADMIN_CLIENT_IDS', () => {
    const prev = process.env.MCP_ADMIN_CLIENT_IDS
    process.env.MCP_ADMIN_CLIENT_IDS = 'wdcl_alex, https://agents.example/client.json'
    expect(isAdminClient('wdcl_alex')).toBe(true)
    expect(isAdminClient('https://agents.example/client.json')).toBe(true)
    expect(isAdminClient('wdcl_someone')).toBe(false)
    expect(isAdminClient(null)).toBe(false)
    process.env.MCP_ADMIN_CLIENT_IDS = ''
    expect(isAdminClient('wdcl_alex')).toBe(false)
    process.env.MCP_ADMIN_CLIENT_IDS = prev
  })
  it('production origin is the custom domain, whatever Host says', () => {
    const env = { ...process.env }
    delete process.env.SITE_URL
    process.env.VERCEL_ENV = 'production'
    expect(siteOrigin('https://evil.example')).toBe('https://2026.wedance.vip')
    process.env.VERCEL_ENV = 'preview'
    expect(siteOrigin('https://wedance-2026-git-x.vercel.app')).toBe('https://wedance-2026-git-x.vercel.app')
    Object.assign(process.env, env)
  })
  it('discovery documents point at each other and never list admin', () => {
    const as = authorizationServerMetadata('https://w.example')
    const pr = protectedResourceMetadata('https://w.example')
    expect(pr.authorization_servers).toEqual([as.issuer])
    expect(pr.resource).toBe('https://w.example/mcp')
    expect(as.code_challenge_methods_supported).toEqual(['S256'])
    expect(as.client_id_metadata_document_supported).toBe(true)
    expect(as.scopes_supported).not.toContain('admin')
  })
})
