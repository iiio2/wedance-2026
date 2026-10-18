import { BlockList, isIP } from 'node:net'
import { lookup as dnsLookup } from 'node:dns'
import { request as httpsRequest } from 'node:https'
import { redirectUriProblem } from './redirect'

/**
 * Client ID Metadata Documents (draft-ietf-oauth-client-id-metadata-document,
 * used by the MCP authorization spec): the client_id is an https URL and the
 * client's metadata is the JSON document at that URL.
 *
 * Fetching a URL a stranger hands us is an SSRF surface, so the fetch is
 * locked down: https only, default port only, no credentials, no redirects,
 * every resolved address must be public (checked inside the socket's DNS
 * lookup, so a rebinding answer can't slip past), 5 s timeout, 10 KB cap.
 */

export const CIMD_MAX_BYTES = 10 * 1024
export const CIMD_TIMEOUT_MS = 5000
export const CIMD_CACHE_MS = 60 * 60 * 1000

const blocked = new BlockList()
// IPv4: this network, private, CGNAT, loopback, link-local, protocol, docs, benchmarking, multicast, reserved, broadcast.
for (const [net, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15], ['198.51.100.0', 24],
  ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4], ['255.255.255.255', 32],
] as const) blocked.addSubnet(net, bits, 'ipv4')
// IPv6: unspecified, loopback, NAT64, discard, Teredo, documentation, 6to4, ULA, link-local, site-local, multicast.
// (IPv4-mapped ::ffff:a.b.c.d is judged as its IPv4 address in isPrivateAddress; a
// ::ffff:0:0/96 rule here would also match every plain IPv4 address in Node's BlockList.)
for (const [net, bits] of [
  ['::', 128], ['::1', 128], ['64:ff9b::', 96], ['64:ff9b:1::', 48], ['100::', 64], ['2001::', 32], ['2001:db8::', 32],
  ['2002::', 16], ['fc00::', 7], ['fe80::', 10], ['fec0::', 10], ['ff00::', 8],
] as const) blocked.addSubnet(net, bits, 'ipv6')

/** True for any address we must never connect to on a client's say-so. */
export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip)
  if (!family) return true
  if (family === 6) {
    // An IPv4-mapped address is judged as the IPv4 address it carries.
    const mapped = ip.toLowerCase().match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    if (mapped) return isPrivateAddress(mapped[1]!)
    return blocked.check(ip, 'ipv6')
  }
  return blocked.check(ip, 'ipv4')
}

/** Is this client_id a metadata-document URL we're willing to fetch? Error text, or null. */
export function cimdUrlProblem(clientId: string): string | null {
  let u: URL
  try { u = new URL(clientId) } catch { return 'client_id is not a URL' }
  if (u.protocol !== 'https:') return 'client_id URL must use https'
  if (u.username || u.password) return 'client_id URL must not contain credentials'
  if (u.hash) return 'client_id URL must not contain a fragment'
  if (u.port && u.port !== '443') return 'client_id URL must use the default https port'
  if (!u.pathname || u.pathname === '/') return 'client_id URL must have a path'
  // The URL parser resolves dot segments, so check what was sent.
  if (/\/\.{1,2}(\/|$|\?)/.test(clientId) || /%2e/i.test(clientId)) return 'client_id URL must not contain dot segments'
  if (isIP(u.hostname.replace(/^\[|\]$/g, ''))) return 'client_id URL must use a domain name, not an IP address'
  if (!u.hostname.includes('.') || /\.(local|localhost|internal|lan|home|corp)$/i.test(u.hostname) || u.hostname === 'localhost') return 'client_id URL must be on a public domain'
  return null
}

export interface ClientMetadata {
  clientId: string
  name: string
  redirectUris: string[]
  clientUri: string | null
  logoUri: string | null
  raw: Record<string, unknown>
}

/** Validate a fetched metadata document against the URL it came from. */
export function parseClientMetadata(clientId: string, doc: unknown): ClientMetadata {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new Error('client metadata must be a JSON object')
  const d = doc as Record<string, unknown>
  if (d.client_id !== clientId) throw new Error('client metadata client_id does not match its URL')
  if (d.client_secret !== undefined || d.client_secret_expires_at !== undefined) throw new Error('client metadata must not contain a client secret')
  const auth = d.token_endpoint_auth_method ?? 'none'
  if (auth !== 'none') throw new Error('client metadata documents are public clients: token_endpoint_auth_method must be none')
  const uris = d.redirect_uris
  if (!Array.isArray(uris) || !uris.length || uris.length > 20) throw new Error('client metadata needs 1–20 redirect_uris')
  for (const r of uris) {
    const problem = redirectUriProblem(r)
    if (problem) throw new Error(problem)
  }
  const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
  const httpsUrl = (v: unknown) => {
    const s = str(v, 500)
    try { return s && new URL(s).protocol === 'https:' ? s : null } catch { return null }
  }
  return {
    clientId,
    name: str(d.client_name, 120) ?? new URL(clientId).hostname,
    redirectUris: uris as string[],
    clientUri: httpsUrl(d.client_uri),
    logoUri: httpsUrl(d.logo_uri),
    raw: d,
  }
}

type LookupFn = typeof dnsLookup

/**
 * dns.lookup that refuses private answers. Used as the socket's lookup, so the
 * address we check is the address we connect to.
 */
export function safeLookup(resolve: LookupFn = dnsLookup): LookupFn {
  return ((hostname: string, options: any, callback: any) => {
    const cb = typeof options === 'function' ? options : callback
    const opts = typeof options === 'function' ? {} : (options ?? {})
    resolve(hostname, { ...opts, all: true }, (err: any, addresses: any) => {
      if (err) return cb(err)
      const list = (Array.isArray(addresses) ? addresses : [{ address: addresses, family: isIP(addresses) }]) as { address: string; family: number }[]
      if (!list.length) return cb(new Error(`no address for ${hostname}`))
      const bad = list.find(a => isPrivateAddress(a.address))
      if (bad) return cb(Object.assign(new Error(`refusing to connect to a private address for ${hostname}`), { code: 'EPRIVATEADDR' }))
      if (opts.all) return cb(null, list)
      return cb(null, list[0]!.address, list[0]!.family)
    })
  }) as LookupFn
}

/** GET the metadata document with every guard above. Resolves to the parsed JSON. */
export function fetchMetadataDocument(clientId: string, lookup: LookupFn = safeLookup()): Promise<unknown> {
  const problem = cimdUrlProblem(clientId)
  if (problem) return Promise.reject(new Error(problem))
  return new Promise((resolve, reject) => {
    const req = httpsRequest(clientId, {
      method: 'GET',
      lookup,
      agent: false,
      timeout: CIMD_TIMEOUT_MS,
      headers: { accept: 'application/json', 'user-agent': 'WeDance-OAuth/1.0 (+https://2026.wedance.vip/docs/connect-ai)' },
    }, (res) => {
      const status = res.statusCode ?? 0
      if (status !== 200) {
        res.resume()
        return reject(new Error(status >= 300 && status < 400 ? 'client metadata URL redirects; redirects are not followed' : `client metadata URL answered ${status}`))
      }
      const declared = Number(res.headers['content-length'] ?? 0)
      if (declared > CIMD_MAX_BYTES) {
        res.destroy()
        return reject(new Error('client metadata document is too large'))
      }
      const chunks: Buffer[] = []
      let size = 0
      res.on('data', (c: Buffer) => {
        size += c.length
        if (size > CIMD_MAX_BYTES) {
          res.destroy()
          reject(new Error('client metadata document is too large'))
          return
        }
        chunks.push(c)
      })
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { reject(new Error('client metadata is not valid JSON')) }
      })
      res.on('error', reject)
    })
    req.on('timeout', () => req.destroy(new Error('client metadata fetch timed out')))
    req.on('error', reject)
    req.end()
  })
}
