import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildFeedback, getSentry, submitFeedback } from './sentry-feedback'

const context = {
  url: 'https://2026.wedance.vip/cities/munich?tab=events',
  routePath: '/cities/munich?tab=events',
  viewport: '1280×800',
  consoleErrors: ['TypeError: x is undefined'],
  posthogSessionUrl: 'https://eu.posthog.com/replay/abc',
  sentryReplayId: 'r1',
  sentryReplayUrl: 'https://sentry.io/replays/r1',
}

describe('buildFeedback', () => {
  it('prefixes the message and tags the type so bugs and ideas are filterable', () => {
    const bug = buildFeedback({ type: 'bug', description: '  Save does nothing ', context })
    expect(bug.params.message).toBe('🐞 Save does nothing')
    expect(bug.hint.captureContext.tags.feedback_type).toBe('bug')
    const idea = buildFeedback({ type: 'idea', description: 'Filter by style', context })
    expect(idea.params.message).toBe('💡 Filter by style')
    expect(idea.hint.captureContext.tags.feedback_type).toBe('idea')
    expect(idea.params.source).toBe('talk-to-us:idea')
  })

  it('links the replay and carries the context bundle as extra (minus replay ids)', () => {
    const { params, hint } = buildFeedback({ type: 'bug', description: 'x', context })
    expect(hint.includeReplay).toBe(true)
    expect(params.url).toBe(context.url)
    expect(hint.captureContext.tags.route).toBe('/cities/munich')
    expect(hint.captureContext.extra).toMatchObject({ viewport: '1280×800', consoleErrors: context.consoleErrors, posthogSessionUrl: context.posthogSessionUrl })
    expect(hint.captureContext.extra).not.toHaveProperty('sentryReplayId')
  })

  it('attaches the screenshot as image/jpeg only when there is one', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff])
    const withShot = buildFeedback({ type: 'bug', description: 'x', context, screenshot: bytes })
    expect(withShot.hint.attachments).toEqual([{ filename: 'screenshot.jpg', data: bytes, contentType: 'image/jpeg' }])
    expect(buildFeedback({ type: 'bug', description: 'x', context }).hint.attachments).toBeUndefined()
  })

  it('identifies signed-in dancers; anonymous gets just the typed email', () => {
    const signedIn = buildFeedback({ type: 'idea', description: 'x', context, dancerId: 'd1', username: 'ana', name: 'Ana', email: 'ana@x.io' })
    expect(signedIn.params).toMatchObject({ name: 'Ana', email: 'ana@x.io' })
    expect(signedIn.hint.captureContext.user).toEqual({ id: 'd1', username: 'ana', name: 'Ana', email: 'ana@x.io' })
    expect(signedIn.hint.captureContext.tags.signed_in).toBe('yes')
    const anon = buildFeedback({ type: 'bug', description: 'x', context, email: '' })
    expect(anon.params.email).toBeUndefined()
    expect(anon.hint.captureContext.user).toBeUndefined()
    expect(anon.hint.captureContext.tags.signed_in).toBe('no')
  })
})

describe('submitFeedback', () => {
  afterEach(() => { vi.unstubAllGlobals() })

  it('rejects when Sentry is not initialised (no DSN)', async () => {
    vi.stubGlobal('window', {})
    expect(getSentry()).toBeNull()
    await expect(submitFeedback({ type: 'bug', description: 'x', context })).rejects.toThrow(/not initialised/)
  })

  it('sends via sendFeedback, flushes, and returns the event id', async () => {
    const sendFeedback = vi.fn().mockResolvedValue('evt123')
    const flush = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('window', { Sentry: { isInitialized: () => true, sendFeedback, flush } })
    await expect(submitFeedback({ type: 'bug', description: 'x', context })).resolves.toBe('evt123')
    expect(sendFeedback).toHaveBeenCalledWith(expect.objectContaining({ message: '🐞 x' }), expect.objectContaining({ includeReplay: true }))
    expect(flush).toHaveBeenCalled()
  })
})
