import posthog from 'posthog-js'

/**
 * Thin analytics wrapper so call sites don't import posthog directly and don't
 * have to guard for SSR / un-keyed environments. Every method is a no-op unless
 * PostHog actually initialized (client-side + a key present). This keeps event
 * calls sprinkled through pages/components harmless in dev and tests.
 *
 * Event names are snake_case and stable — the full catalogue (client + the
 * `server_*` copies sent from tRPC, server/utils/posthog.ts) is in CLAUDE.md →
 * "Analytics (PostHog)". Never put PII (names, emails, raw search text) in props.
 */
export type TrackProps = Record<string, unknown>

type PosthogLike = {
  __loaded?: boolean
  capture: (event: string, props?: TrackProps) => unknown
  identify: (id: string, props?: TrackProps) => unknown
  setPersonProperties?: (props: TrackProps) => unknown
  reset: () => unknown
  get_distinct_id?: () => string
  get_session_replay_url?: (o?: { withTimestamp?: boolean }) => string
}

/**
 * The analytics core, parameterised by the client so it can be unit-tested.
 * `useTrack()` binds it to the posthog-js singleton.
 */
export function createTracker(ph: PosthogLike, isClient = true, recent: Map<string, number> = new Map()) {
  const ready = (): boolean => isClient && !!ph.__loaded

  const track = (event: string, props?: TrackProps) => {
    if (!ready()) return
    ph.capture(event, props)
  }

  // One event per user intent for "viewed" events: a page that remounts (a
  // canonical-URL replace, a hot reload, a quick back/forward) within
  // `windowMs` doesn't count the same view twice.
  const trackOnce = (key: string, event: string, props?: TrackProps, windowMs = 10_000) => {
    if (!ready()) return
    const k = `${event}:${key}`
    const now = Date.now()
    const last = recent.get(k)
    if (last && now - last < windowMs) return
    recent.set(k, now)
    ph.capture(event, props)
  }

  // Tie subsequent events to a known dancer. Idempotent: called on every
  // sign-in AND every session restore (auth.me), so when this browser is
  // already identified as the dancer we only refresh the person properties
  // instead of re-sending $identify.
  const identify = (distinctId: string, props?: TrackProps) => {
    if (!ready() || !distinctId) return
    if (ph.get_distinct_id?.() === distinctId) {
      if (props && Object.keys(props).length) ph.setPersonProperties?.(props)
      return
    }
    ph.identify(distinctId, props)
  }

  // Clear identity on sign-out so events aren't attributed across accounts.
  const reset = () => {
    if (!ready()) return
    ph.reset()
  }

  // Deep link to this session's replay (problem reports). '' when unavailable.
  const sessionReplayUrl = (): string => {
    if (!ready()) return ''
    try {
      return ph.get_session_replay_url?.({ withTimestamp: true }) || ''
    }
    catch {
      return ''
    }
  }

  return { track, trackOnce, identify, reset, sessionReplayUrl }
}

const recentViews = new Map<string, number>()

export function useTrack() {
  return createTracker(posthog as unknown as PosthogLike, import.meta.client, recentViews)
}
