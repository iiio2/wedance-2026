import tailwindcss from "@tailwindcss/vite";
import path from "path";

const GOOGLE_FONTS_CSS =
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=Caveat:wght@400;700&display=swap';

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      link: [
        // WeDance flame mark, tinted V3 red (#dc2626 — same red as
        // "night" in the homepage H1). Modern browsers use the SVG;
        // older browsers + Windows fall back to the multi-size .ico;
        // iOS home-screen uses the 180x180 PNG.
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'alternate icon', href: '/favicon.ico', sizes: '16x16 32x32 48x48 64x64' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
        // Design-system display font, loaded ONCE for every page (see
        // docs/design-system.md → "Font loading"). Never add per-page font
        // links. Preconnects open the CSS + font-file connections early, the
        // preload starts the CSS fetch at top priority, display=swap keeps
        // text visible while Playfair downloads. Weights = exactly what the
        // UI renders: 400/700/900 upright + 400/700 italic; Caveat 400/700 for handwritten asides.
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'preload', as: 'style', href: GOOGLE_FONTS_CSS },
        { rel: 'stylesheet', href: GOOGLE_FONTS_CSS },
      ],
    },
  },
  routeRules: {
    '/datenschutz': { redirect: { to: '/privacy-policy', statusCode: 301 } },
    '/impressum': { redirect: { to: '/imprint', statusCode: 301 } },
    '/agb': { redirect: { to: '/terms', statusCode: 301 } },
    // The old single-page styleguide was replaced by the /docs/design docs.
    '/styleguide': { redirect: { to: '/docs/design', statusCode: 301 } },
    // /design and /architecture moved under the /docs umbrella (RAZ-305).
    '/design': { redirect: { to: '/docs/design', statusCode: 301 } },
    '/design/**': { redirect: { to: '/docs/design/**', statusCode: 301 } },
    '/architecture': { redirect: { to: '/docs/architecture', statusCode: 301 } },
    '/architecture/**': { redirect: { to: '/docs/architecture/**', statusCode: 301 } },
    // The old festival wizard: festivals are made in the event editor now.
    '/organizers/create': { redirect: { to: '/business/events/new?type=Festival', statusCode: 301 } },
    // One page for organizers: the festival pitch lives on /for-organizers#festivals.
    '/organizers': { redirect: { to: '/for-organizers#festivals', statusCode: 301 } },
    // Business "My profiles" became "Network" (2026-10-15); keep old links and emails working.
    '/business/profiles': { redirect: { to: '/business/network', statusCode: 301 } },
    '/business/profiles/**': { redirect: { to: '/business/network/**', statusCode: 301 } },
    // Auth-gated pages: all data is client-only (localStorage + TRPC behind
    // session cookie). SSR renders empty stats → hydration mismatch → Vue
    // fails to reconcile the DOM, so the user sees stale/empty data until a
    // hard refresh. Disabling SSR avoids the mismatch entirely.
    '/my-year': { ssr: false },
    '/my-plan': { ssr: false },
    '/settings': { ssr: false },
    '/settings/**': { ssr: false },
    // Connected apps (MCP): the consent screen runs on the client session and
    // must never be framed (clickjacking), cached or leak its URL in a Referer.
    '/oauth/authorize': {
      ssr: false,
      headers: {
        'Content-Security-Policy': "frame-ancestors 'none'",
        'X-Frame-Options': 'DENY',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    },
  },
  nitro: {
    preset: 'vercel',
    // Painting a flyer runs after the response (waitUntil): up to ~3 Gemini
    // rounds of 20–40 s each, so functions get the full 5 minutes.
    vercel: { functions: { maxDuration: 300 } },
  },
  // The architecture module regenerates the /docs/architecture docs data from code
  // (schema, tRPC routers, API handlers) before every dev/build — ADR-000.
  modules: ['shadcn-nuxt', '@sentry/nuxt/module', './scripts/architecture/nuxt-module'],
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },
  css: ['./app/assets/css/tailwind.css'],
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '#shared': path.resolve(__dirname, './shared'),
      },
    },
  },
  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    resendApiKey: process.env.RESEND_API_KEY || '',
    resendFromEmail: process.env.RESEND_FROM_EMAIL || 'WeDance <noreply@wedance.vip>',
    // Canonical, user-facing base URL for links in emails (magic link / reset).
    // Precedence: explicit SITE_URL → production always uses the custom domain
    // (never VERCEL_URL, which is the per-deployment hostname and leaks ugly
    // *.vercel.app links) → preview deploys use their VERCEL_URL → local dev.
    siteUrl:
      process.env.SITE_URL
      || (process.env.VERCEL_ENV === 'production'
        ? 'https://2026.wedance.vip'
        : process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'http://localhost:3000'),
    stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    stripeNetworkPriceId: process.env.STRIPE_NETWORK_PRICE_ID || '',
    tickettailorWebhookSecret: process.env.TICKETTAILOR_WEBHOOK_SECRET || '',
    // Event flyers (business mode): Gemini paints the poster and reads it back.
    geminiApiKey: process.env.GEMINI_API_KEY || '',
    cloudinaryApiKey: process.env.NUXT_CLOUDINARY_API_KEY || '',
    cloudinaryApiSecret: process.env.NUXT_CLOUDINARY_API_SECRET || '',
    public: {
      cloudinaryCloudName: process.env.NUXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '',
      // PostHog product analytics. Empty key => tracking is a no-op (safe to
      // ship un-keyed). Set NUXT_PUBLIC_POSTHOG_KEY (phc_…) to turn it on.
      posthogKey: process.env.NUXT_PUBLIC_POSTHOG_KEY || '',
      posthogHost: process.env.NUXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com',
      // Sentry error monitoring + session replay. Empty DSN => the SDK is a
      // no-op (safe to ship un-keyed, same pattern as PostHog). Set SENTRY_DSN
      // to turn it on; problem reports then link to the user's replay.
      sentryDsn: process.env.SENTRY_DSN || '',
      // Base URL of the Sentry replays view, e.g.
      // https://<org>.sentry.io/organizations/<org>/replays — the report widget
      // appends the replay id to deep-link triage straight to the recording.
      sentryReplayUrlBase: process.env.SENTRY_REPLAY_URL_BASE || '',
      // Short commit SHA, surfaced in problem reports as the build identifier.
      commitSha: (process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7),
    },
  },
  // Source-map upload for readable Sentry stack traces. Skipped automatically
  // (build still succeeds) when SENTRY_AUTH_TOKEN is absent.
  sentry: {
    sourceMapsUploadOptions: {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
    },
  },
})
