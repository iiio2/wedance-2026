/**
 * Builds the diagnostic context bundle attached to a problem report.
 *
 * Everything here is best-effort and defensive: any single probe that throws
 * (or isn't available — SSR, no Sentry, no PostHog) is swallowed so gathering
 * context can never break the report flow. Nothing sensitive is collected —
 * URLs, device metadata, and error strings only.
 */

export interface ReportContext {
  url?: string
  routePath?: string
  userAgent?: string
  viewport?: string
  screen?: string
  devicePixelRatio?: number
  language?: string
  timezone?: string
  referrer?: string
  appVersion?: string
  online?: boolean
  consoleErrors?: string[]
  sentryReplayUrl?: string
  sentryReplayId?: string
  sentryLastEventId?: string
  posthogSessionUrl?: string
}

export function useReportContext() {
  const route = useRoute()
  const config = useRuntimeConfig()
  const { $errorBuffer } = useNuxtApp() as unknown as { $errorBuffer?: () => string[] }

  function collect(): ReportContext {
    const ctx: ReportContext = {}
    if (!import.meta.client) return ctx

    try {
      ctx.url = window.location.href
      ctx.routePath = route.fullPath
      ctx.userAgent = navigator.userAgent
      ctx.viewport = `${window.innerWidth}×${window.innerHeight}`
      ctx.screen = `${window.screen?.width}×${window.screen?.height}`
      ctx.devicePixelRatio = Math.round((window.devicePixelRatio || 1) * 100) / 100
      ctx.language = navigator.language
      ctx.online = navigator.onLine
      ctx.referrer = document.referrer || undefined
      ctx.appVersion = (config.public as Record<string, string>).commitSha || undefined
      try {
        ctx.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
      } catch { /* ignore */ }
    } catch { /* ignore */ }

    try {
      ctx.consoleErrors = $errorBuffer ? $errorBuffer() : []
    } catch { /* ignore */ }

    // Sentry — replay id + last event id, so triage can jump to the recording.
    try {
      const Sentry = (window as unknown as { Sentry?: typeof import('@sentry/nuxt') }).Sentry
      if (Sentry) {
        const replay = typeof Sentry.getReplay === 'function' ? Sentry.getReplay() : undefined
        const replayId = replay && typeof replay.getReplayId === 'function' ? replay.getReplayId() : undefined
        if (replayId) {
          ctx.sentryReplayId = replayId
          const base = (config.public as Record<string, string>).sentryReplayUrlBase
          if (base) ctx.sentryReplayUrl = `${base.replace(/\/$/, '')}/${replayId}`
        }
        const lastEvent = typeof Sentry.lastEventId === 'function' ? Sentry.lastEventId() : undefined
        if (lastEvent) ctx.sentryLastEventId = lastEvent
      }
    } catch { /* ignore */ }

    // PostHog — session replay deep link. The npm build never sets
    // window.posthog, so read it through useTrack (the imported singleton).
    try {
      const url = useTrack().sessionReplayUrl()
      if (url) ctx.posthogSessionUrl = url
    } catch { /* ignore */ }

    return ctx
  }

  return { collect }
}
