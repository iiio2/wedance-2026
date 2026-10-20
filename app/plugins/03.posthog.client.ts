import posthog from 'posthog-js'
import { isLocalHost } from '~/lib/analytics-host'
import { organiserProfileFromPath } from '~/lib/analytics-groups'

/**
 * PostHog product analytics — client only. Initializes once with the public
 * ingest key. When the key is empty, on a dev build, or on a local host
 * (localhost / 127.0.0.1 / ::1 / *.localhost / *.test) this is a complete no-op: `useTrack()` guards on `posthog.__loaded`, so no events and
 * no network calls happen. Pageviews are captured manually on route change
 * because Nuxt is an SPA after first load.
 */
export default defineNuxtPlugin({
  name: 'posthog',
  setup() {
    const { public: { posthogKey, posthogHost } } = useRuntimeConfig()
    if (!posthogKey) return
    // The Vercel-pulled .env carries the PRODUCTION key, so a local `bun run dev`
    // (or a local build served on localhost) would send events to the prod
    // project. Never initialise on a dev build or a local host.
    if (import.meta.dev || isLocalHost(window.location.hostname)) return

    posthog.init(posthogKey as string, {
      api_host: posthogHost as string,
      person_profiles: 'identified_only',
      capture_pageview: false, // we send $pageview manually on route change
      capture_pageleave: true,
      defaults: '2025-05-24',
    })

    // WeDance 2026 currently shares the WeDance v4 PostHog project (the EU org's
    // free plan is capped at one project). Tag every event with `app` so 2026
    // data is trivially filterable and never confused with v4 — and so it can
    // be split into a dedicated project later with zero code change.
    posthog.register({ app: 'wedance-2026' })

    const router = useRouter()
    router.afterEach((to) => {
      // Business mode for an organisation → its events count for that group.
      const org = organiserProfileFromPath(to.path)
      if (org) posthog.group('profile', org)
      // Wait a tick so document.title reflects the new page.
      nextTick(() => {
        posthog.capture('$pageview', { path: to.fullPath })
      })
    })

    return {
      provide: { posthog },
    }
  },
})
