import { describe, it, expect, vi } from 'vitest'
import { createTracker } from './useTrack'

function fakePosthog(distinctId = 'anon-1', loaded = true) {
  let id = distinctId
  return {
    __loaded: loaded,
    capture: vi.fn(),
    identify: vi.fn((next: string) => { id = next }),
    setPersonProperties: vi.fn(),
    reset: vi.fn(() => { id = 'anon-2' }),
    get_distinct_id: () => id,
    get_session_replay_url: vi.fn(() => 'https://eu.posthog.com/replay/abc?t=1'),
    group: vi.fn(),
  }
}

describe('useTrack core', () => {
  it('is a no-op until PostHog has loaded (and on the server)', () => {
    const ph = fakePosthog('anon', false)
    const t = createTracker(ph)
    t.track('x'); t.identify('d1'); t.reset()
    expect(ph.capture).not.toHaveBeenCalled()
    expect(ph.identify).not.toHaveBeenCalled()
    expect(t.sessionReplayUrl()).toBe('')

    const server = createTracker(fakePosthog(), false)
    expect(server.sessionReplayUrl()).toBe('')
  })

  it('identifies once, then only refreshes person properties', () => {
    const ph = fakePosthog()
    const t = createTracker(ph)
    t.identify('dancer-1', { city: 'munich' })
    expect(ph.identify).toHaveBeenCalledWith('dancer-1', { city: 'munich' })
    t.identify('dancer-1', { city: 'berlin' })
    t.identify('dancer-1')
    expect(ph.identify).toHaveBeenCalledTimes(1)
    expect(ph.setPersonProperties).toHaveBeenCalledOnce()
    expect(ph.setPersonProperties).toHaveBeenCalledWith({ city: 'berlin' })
  })

  it('re-identifies after reset or for a different dancer', () => {
    const ph = fakePosthog()
    const t = createTracker(ph)
    t.identify('dancer-1')
    t.reset()
    t.identify('dancer-1')
    t.identify('dancer-2')
    expect(ph.identify).toHaveBeenCalledTimes(3)
  })

  it('returns the session replay url', () => {
    const ph = fakePosthog()
    expect(createTracker(ph).sessionReplayUrl()).toBe('https://eu.posthog.com/replay/abc?t=1')
    expect(ph.get_session_replay_url).toHaveBeenCalledWith({ withTimestamp: true })
  })

  it('trackOnce drops a repeat of the same view inside the window', () => {
    const ph = fakePosthog()
    const t = createTracker(ph)
    t.trackOnce('e1', 'event_viewed', { event_id: 'e1' })
    t.trackOnce('e1', 'event_viewed', { event_id: 'e1' })
    t.trackOnce('e2', 'event_viewed', { event_id: 'e2' })
    t.trackOnce('e1', 'event_viewed', { event_id: 'e1' }, 0)
    expect(ph.capture).toHaveBeenCalledTimes(3)
  })

  it('groups the session under an organisation profile, never with an empty key', () => {
    const ph = fakePosthog()
    const t = createTracker(ph)
    t.group('profile', 'salsa-crew', { profile_type: 'organizer' })
    t.group('profile', '')
    t.group('profile', null)
    expect(ph.group).toHaveBeenCalledOnce()
    expect(ph.group).toHaveBeenCalledWith('profile', 'salsa-crew', { profile_type: 'organizer' })
    createTracker(fakePosthog('a', false)).group('profile', 'x')
  })
})
