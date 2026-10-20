import { describe, it, expect, vi } from 'vitest'
import { buildServerEvent, posthogServerConfig, sendServerEvent, trackServer } from './posthog'

const config = { key: 'phc_test', host: 'https://eu.i.posthog.com/' }

describe('server posthog capture', () => {
  it('is unkeyed under vitest, so router tests never send real events', () => {
    expect(posthogServerConfig()).toBeNull()
  })

  it('is a no-op without a key', async () => {
    const fetch = vi.fn()
    await sendServerEvent('signup_completed', 'd1', {}, { config: null, fetch })
    await sendServerEvent('signup_completed', 'd1', {}, { config: { key: '', host: 'x' }, fetch })
    expect(fetch).not.toHaveBeenCalled()
  })

  it('posts the capture payload to /i/v0/e/', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    await sendServerEvent('event_created', 'dancer-1', { event_id: 'e1' }, { config, fetch })
    expect(fetch).toHaveBeenCalledOnce()
    const [url, init] = fetch.mock.calls[0]!
    expect(url).toBe('https://eu.i.posthog.com/i/v0/e/')
    expect(init.method).toBe('POST')
    const body = JSON.parse(init.body)
    expect(body).toMatchObject({
      api_key: 'phc_test',
      event: 'server_event_created',
      distinct_id: 'dancer-1',
      properties: { event_id: 'e1', app: 'wedance-2026', $lib: 'wedance-server' },
    })
    expect(body.properties.$process_person_profile).toBeUndefined()
    expect(typeof body.timestamp).toBe('string')
  })

  it('prefixes names once and keeps app/$lib authoritative', () => {
    const body = buildServerEvent(config, 'server_login_completed', 'd', { app: 'other', $lib: 'x' })
    expect(body.event).toBe('server_login_completed')
    expect(body.properties.app).toBe('wedance-2026')
    expect(body.properties.$lib).toBe('wedance-server')
  })

  it('anonymous callers get a random id and no person profile', () => {
    const body = buildServerEvent(config, 'booking_requested', null)
    expect(body.distinct_id).toMatch(/^anon-server-/)
    expect(body.properties.$process_person_profile).toBe(false)
  })

  it('swallows fetch errors and non-2xx answers', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    await expect(sendServerEvent('x', 'd', {}, { config, fetch: vi.fn().mockRejectedValue(new Error('offline')) })).resolves.toBeUndefined()
    await expect(sendServerEvent('x', 'd', {}, { config, fetch: vi.fn().mockResolvedValue({ ok: false, status: 500 }) })).resolves.toBeUndefined()
    await expect(sendServerEvent('x', 'd', {}, { config, fetch: () => { throw new Error('sync') } })).resolves.toBeUndefined()
    warn.mockRestore()
  })

  it('trackServer hands the request to waitUntil, uses ctx.dancerId and tags the channel', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    const waitUntil = vi.fn()
    trackServer({ dancerId: 'd9', waitUntil, oauthClientId: 'app' }, 'event_published', { event_id: 'e' }, { config, fetch })
    expect(waitUntil).toHaveBeenCalledOnce()
    await waitUntil.mock.calls[0]![0]
    const body = JSON.parse(fetch.mock.calls[0]![1].body)
    expect(body.distinct_id).toBe('d9')
    expect(body.properties.channel).toBe('mcp')
  })

  it('trackServer never throws without a ctx or key', () => {
    expect(() => trackServer(undefined, 'x')).not.toThrow()
    expect(() => trackServer({ dancerId: 'd' }, 'x', {}, { distinctId: 'other' })).not.toThrow()
  })
})
