<script setup lang="ts">
/**
 * /find-your-dance — placeholder for the dance-finder game (built in v4,
 * to be integrated here later). For now: a friendly holding page + the
 * big three as a quick manual start, plus a "free taster class" way in that
 * lands on a city's upcoming classes (/cities?taster=1 → /cities/[city]?taster=1).
 */
import { ArrowRight, Sparkles } from 'lucide-vue-next'
import { WD } from '~/lib/brand'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — Find your dance',
})

const quickPicks = [
  { style: 'Salsa', blurb: 'Fast, social, everywhere.', accent: WD.red600 },
  { style: 'Bachata', blurb: 'Close, romantic, easy start.', accent: WD.purple500 },
  { style: 'Kizomba', blurb: 'Slow, grounded, connected.', accent: WD.cyan600 },
]
</script>

<template>
  <div class="min-h-screen" style="background:var(--wd-cream); color:var(--wd-brown-900); font-family:var(--wd-font-display);">
    <SiteHeader />

    <section class="max-w-3xl mx-auto px-4 pt-14 pb-8 text-center">
      <div class="text-sm tracking-widest uppercase mb-3" style="color:var(--wd-amber-600);">Find your dance</div>
      <h1 class="text-5xl sm:text-6xl leading-[0.98]" style="color:var(--wd-brown-900);">
        Not sure where <em class="italic" style="color:var(--wd-red-600);">to start?</em>
      </h1>
      <p class="mt-5 text-base sm:text-lg leading-relaxed max-w-xl mx-auto" style="color:var(--wd-brown-700);">
        A quick quiz that matches you to a dance by feel — not jargon — is coming soon. Meanwhile, pick by vibe:
      </p>

      <!-- Placeholder banner -->
      <div class="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-bold uppercase tracking-widest" style="background:color-mix(in srgb, var(--wd-red-600) 7.8%, transparent); color:var(--wd-red-600);">
        <Sparkles class="w-4 h-4" /> Dance-finder quiz · coming soon
      </div>
    </section>

    <section class="max-w-3xl mx-auto px-4 pb-16">
      <div class="grid gap-4 sm:grid-cols-3">
        <NuxtLink
          v-for="p in quickPicks"
          :key="p.style"
          :to="`/cities?style=${p.style}`"
          :data-testid="`quick-pick-${p.style.toLowerCase()}`"
          class="group rounded-2xl bg-white border p-6 text-center transition-all hover:-translate-y-1"
          :style="{ borderColor: p.accent + '55', boxShadow: '0 1px 0 ' + p.accent + '22, 0 8px 22px rgba(59,31,18,0.05)' }"
        >
          <div class="text-2xl font-black" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">{{ p.style }}</div>
          <div class="mt-1 text-sm" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">{{ p.blurb }}</div>
          <div class="mt-4 inline-flex items-center gap-1 text-xs font-bold italic" :style="{ color: p.accent }">
            Find classes <ArrowRight class="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
          </div>
        </NuxtLink>
      </div>

      <!-- P1006: the low-pressure way in — no style to pick, just find a class to try once. -->
      <NuxtLink
        to="/cities?taster=1"
        data-testid="taster-cta"
        class="group mt-8 block rounded-2xl border border-dashed px-5 py-4 text-center transition-all hover:-translate-y-0.5"
        style="border-color:color-mix(in srgb, var(--wd-amber-600) 40%, transparent); background:rgba(255,255,255,0.55);"
      >
        <span class="block" style="color:var(--wd-amber-600); font-family:var(--wd-font-display);font-style:italic; font-size:22px; line-height:1.2;">
          — or just <span class="underline decoration-dotted underline-offset-4" style="color:var(--wd-green-600);">try a free taster class</span> and see what sticks.
          <ArrowRight class="inline w-4 h-4 align-middle transition-transform group-hover:translate-x-1" style="color:var(--wd-green-600);" />
        </span>
        <span class="mt-1 block text-xs" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
          No style to pick, no commitment. Turn up once and see how it feels.
        </span>
      </NuxtLink>
    </section>

    <SiteFooter />
  </div>
</template>
