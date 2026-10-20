<script setup lang="ts">
/**
 * /open — "Open metrics": WeDance publishes its real usage numbers.
 * Public + indexed. Links out to the public PostHog dashboard (no iframe —
 * page speed matters more than an embedded chart). The link lives in
 * app/lib/open-metrics.ts; while it's empty the page shows a muted
 * "coming shortly" state instead of a dead button.
 * Conventions follow /press and /whats-new: layout:false with SiteHeader/SiteFooter.
 */
import { ArrowRight, ArrowUpRight, BarChart3, Clock, Github, ShieldCheck } from 'lucide-vue-next'
import { OPEN_METRICS_DASHBOARD_URL, OPEN_METRICS_TILES, hasOpenMetricsDashboard } from '~/lib/open-metrics'
import { REPO_URL } from '~/lib/docs-nav'

definePageMeta({ layout: false })

const origin = useRequestURL().origin
const title = 'Open metrics — WeDance'
const description = 'WeDance is built in the open. Our real usage numbers — active users, sign-ups, events, page speed — on a public live dashboard, small as they are.'

useSeoMeta({
  title,
  ogTitle: title,
  description,
  ogDescription: description,
  ogType: 'website',
  ogUrl: `${origin}/open`,
  robots: 'index, follow',
})
useHead({ link: [{ rel: 'canonical', href: `${origin}/open` }] })

const dashboardUrl = OPEN_METRICS_DASHBOARD_URL
const hasDashboard = hasOpenMetricsDashboard(dashboardUrl)

const tracked = [
  'Product analytics with PostHog, hosted in the EU.',
  'Session replay, so we can see where a screen confuses people. Form inputs are masked.',
  'Sign-ups, logins and other conversions are also counted on our server, so ad blockers don’t skew them.',
]
const notTracked = [
  'Your name or email — analytics only ever sees an anonymous account id.',
  'What you search for — we record only how long the query was, never the text.',
  'Other sites — the dashboard only counts traffic on 2026.wedance.vip.',
]

const links = [
  { label: 'Source code on GitHub', to: REPO_URL, external: true },
  { label: 'Docs', to: '/docs', external: false },
  { label: 'What’s new', to: '/whats-new', external: false },
  { label: 'Press', to: '/press', external: false },
]
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />
    <main>
      <!-- HERO -->
      <section class="max-w-3xl mx-auto px-4 pt-10 sm:pt-14 pb-8">
        <div class="inline-flex items-center gap-1.5 text-sm tracking-widest uppercase mb-3 text-secondary font-sans">
          <BarChart3 class="w-4 h-4" aria-hidden="true" /> Building in the open
        </div>
        <h1 class="text-5xl sm:text-6xl leading-[0.95] text-foreground">
          Open <em class="italic text-primary">metrics.</em>
        </h1>
        <p class="mt-4 sm:mt-6 text-base sm:text-lg leading-relaxed max-w-xl text-muted-foreground font-sans">
          WeDance is built in the open — the code is public, and so are the numbers. Here are our real usage figures, small as they are. No vanity stats, no rounding up.
        </p>

        <div class="mt-8">
          <Button v-if="hasDashboard" as-child variant="cta" size="lg" class="font-sans">
            <a :href="dashboardUrl" target="_blank" rel="noopener">
              View live dashboard <ArrowUpRight aria-hidden="true" />
            </a>
          </Button>
          <p
            v-else
            class="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground font-sans"
            data-testid="open-metrics-pending"
          >
            <Clock class="w-4 h-4" aria-hidden="true" /> Live dashboard coming shortly
          </p>
        </div>
      </section>

      <!-- TILES -->
      <section class="max-w-3xl mx-auto px-4 pb-12" aria-labelledby="tiles-heading">
        <h2 id="tiles-heading" class="text-3xl sm:text-4xl leading-tight mb-6">
          What’s on the <em class="italic text-primary">dashboard.</em>
        </h2>
        <ul class="grid sm:grid-cols-2 gap-3">
          <li v-for="t in OPEN_METRICS_TILES" :key="t.title" class="rounded-2xl bg-card border border-border p-5">
            <h3 class="text-lg font-bold text-foreground">{{ t.title }}</h3>
            <p class="mt-1 text-sm leading-relaxed text-muted-foreground font-sans">{{ t.body }}</p>
          </li>
        </ul>
      </section>

      <!-- PRIVACY -->
      <section class="max-w-3xl mx-auto px-4 pb-12" aria-labelledby="privacy-heading">
        <h2 id="privacy-heading" class="text-3xl sm:text-4xl leading-tight mb-6">
          What we track, <em class="italic text-primary">and what we don’t.</em>
        </h2>
        <div class="grid sm:grid-cols-2 gap-3 font-sans">
          <div class="rounded-2xl bg-card border border-border p-5">
            <div class="text-xs uppercase tracking-wider text-secondary mb-3">We track</div>
            <ul class="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li v-for="item in tracked" :key="item" class="flex items-start gap-2">
                <span class="text-primary" aria-hidden="true">·</span> {{ item }}
              </li>
            </ul>
          </div>
          <div class="rounded-2xl bg-card border border-border p-5">
            <div class="flex items-center gap-1.5 text-xs uppercase tracking-wider text-secondary mb-3">
              <ShieldCheck class="w-4 h-4" aria-hidden="true" /> We don’t send
            </div>
            <ul class="space-y-2 text-sm leading-relaxed text-muted-foreground">
              <li v-for="item in notTracked" :key="item" class="flex items-start gap-2">
                <span class="text-primary" aria-hidden="true">·</span> {{ item }}
              </li>
            </ul>
          </div>
        </div>
        <p class="mt-4 text-sm text-muted-foreground font-sans">
          The details are in our
          <NuxtLink to="/privacy-policy" class="font-bold text-wd-red-800 hover:underline">privacy policy</NuxtLink>.
        </p>
      </section>

      <!-- LINKS -->
      <section class="max-w-3xl mx-auto px-4 pb-16" aria-labelledby="links-heading">
        <h2 id="links-heading" class="text-3xl sm:text-4xl leading-tight mb-6">
          More in the <em class="italic text-primary">open.</em>
        </h2>
        <ul class="grid sm:grid-cols-2 gap-3 font-sans">
          <li v-for="l in links" :key="l.to">
            <a
              v-if="l.external"
              :href="l.to"
              target="_blank"
              rel="noopener"
              class="group flex items-center justify-between gap-3 rounded-2xl bg-card border border-border p-4 font-bold text-foreground transition-colors hover:border-primary/40"
            >
              <span class="inline-flex items-center gap-2"><Github class="w-4 h-4" aria-hidden="true" /> {{ l.label }}</span>
              <ArrowUpRight class="w-4 h-4 text-primary" aria-hidden="true" />
            </a>
            <NuxtLink
              v-else
              :to="l.to"
              class="group flex items-center justify-between gap-3 rounded-2xl bg-card border border-border p-4 font-bold text-foreground transition-colors hover:border-primary/40"
            >
              {{ l.label }}
              <ArrowRight class="w-4 h-4 text-primary transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </NuxtLink>
          </li>
        </ul>
      </section>
    </main>

    <SiteFooter />
  </div>
</template>
