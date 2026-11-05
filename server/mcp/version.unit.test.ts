import { describe, expect, it } from 'vitest'
import { TOOLS, TOOL_BY_NAME, visibleTools, type ToolDef } from './tools'
import { listedTools, refreshSteps, rpcMethods, toolsVersion, updateNotice } from './version'
import { callTool, SERVER_INFO } from './server'

const all = { scopes: ['me:read', 'plan:write', 'social:write', 'business:read', 'business:write', 'business:publish'] as any, grantedProfileIds: ['p1'], isAdmin: false }
const current = visibleTools(all)
/** The list an app got before the site tools existed. */
const older = current.filter(t => !['get_my_site', 'update_my_site'].includes(t.name))

describe('toolsVersion', () => {
  it('is stable and ignores order', () => {
    expect(toolsVersion(current)).toBe(toolsVersion([...current].reverse()))
    expect(toolsVersion(current)).toMatch(/^[0-9a-f]{12}$/)
  })
  it('changes with a new tool, a new description or a new option', () => {
    const v = toolsVersion(current)
    expect(toolsVersion(older)).not.toBe(v)
    const me = TOOL_BY_NAME.get('me')!
    expect(toolsVersion(current.map(t => t === me ? { ...me, description: `${me.description} More.` } : t))).not.toBe(v)
    const changedInput: ToolDef = { ...me, input: { extra: (TOOL_BY_NAME.get('get_my_site')!.input as any).profile } }
    expect(toolsVersion(current.map(t => t === me ? changedInput : t))).not.toBe(v)
  })
  it('is part of the server version', () => {
    expect(SERVER_INFO.version).toBe(`1.0.0+${toolsVersion(TOOLS)}`)
  })
})

describe('updateNotice', () => {
  it('nothing when the app has the current list, or we never saw it list tools', () => {
    expect(updateNotice(listedTools(current), current, 'chatgpt')).toBeNull()
    expect(updateNotice(null, current, 'chatgpt')).toBeNull()
  })
  it('names the new tools and tells a ChatGPT user how to refresh', () => {
    const n = updateNotice(listedTools(older), current, 'chatgpt')!
    expect(n.newTools).toEqual(['get_my_site', 'update_my_site'])
    expect(n.text).toContain('get_my_site, update_my_site')
    expect(n.text).toContain('Apps & Connectors → WeDance → Refresh')
    expect(n.text).toContain("don't say it's impossible")
  })
  it('a changed description is an update too, with no new tools', () => {
    const listed = { ...listedTools(current), version: 'aaaaaaaaaaaa' }
    const n = updateNotice(listed, current, 'claude')!
    expect(n.newTools).toEqual([])
    expect(n.text).toContain('descriptions or options')
    expect(n.text).toContain('In Claude')
  })
  it('a list from before we kept track (migration 0061) is old, without claiming every tool is new', () => {
    const n = updateNotice({ version: 'before-0061', names: [], at: '2026-11-05T00:00:00Z' }, current, 'chatgpt')!
    expect(n.newTools).toEqual([])
    expect(n.text).toContain('get_my_site / update_my_site')
    expect(n.text).toContain('Refresh')
  })
  it('steps for other apps are generic', () => {
    expect(refreshSteps('cursor')).toMatch(/Refresh or reconnect/)
  })
})

describe('rpcMethods', () => {
  it('reads one message or a batch', () => {
    expect(rpcMethods({ jsonrpc: '2.0', id: 1, method: 'tools/list' })).toEqual(['tools/list'])
    expect(rpcMethods([{ method: 'tools/call' }, { result: {} }, { method: 'ping' }])).toEqual(['tools/call', 'ping'])
    expect(rpcMethods(null)).toEqual([])
  })
})

describe('callTool adds the notice to a result from an old list', () => {
  const db = { insert: () => { throw new Error('no db') }, select: () => { throw new Error('no db') } }
  const t = (listed: any) => ({
    caller: { auth: { me: async () => ({ dancer: { id: 'd1', name: 'Alex' } }) } },
    ctx: { db, dancerId: 'd1', isAdmin: false, scopes: all.scopes, grantedProfileIds: all.grantedProfileIds, oauthGrantId: 'g1', origin: 'https://x' },
    origin: 'https://x', client: { app: 'chatgpt', userAgent: null, country: null }, listed,
  }) as any

  it('first block is the notice, the data follows', async () => {
    const r = await callTool(TOOL_BY_NAME.get('me')!, {}, t(listedTools(older)))
    expect(r.content).toHaveLength(2)
    expect(r.content[0]!.text).toMatch(/^WeDance update available/)
    expect(r.content[1]!.text).toContain('<wedance-data>')
  })
  it('no notice for an up-to-date app', async () => {
    const r = await callTool(TOOL_BY_NAME.get('me')!, {}, t(listedTools(current)))
    expect(r.content).toHaveLength(1)
  })
})
