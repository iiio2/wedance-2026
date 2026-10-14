<script setup lang="ts">
/**
 * /find-your-dance — helps beginners pick a dance style without jargon.
 * Three style cards with video previews, plus a taster-class CTA.
 */
import { ArrowRight, Play } from 'lucide-vue-next'
import { WD } from '~/lib/brand'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — Find your dance',
})

const quickPicks = [
  { style: 'Salsa', blurb: 'Fast, social, everywhere.', accent: WD.red600, videoId: 'C4MAFLeWY7c' },
  { style: 'Bachata', blurb: 'Close, romantic, easy start.', accent: WD.purple500, videoId: '1cDNbnMtf2E' },
  { style: 'Kizomba', blurb: 'Slow, grounded, connected.', accent: WD.cyan600, videoId: 'MCaKDMMf-Cw' },
]

const activeVideo = ref<string | null>(null)

function playVideo(videoId: string) {
  activeVideo.value = videoId
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />
    <main>

    <section class="max-w-3xl mx-auto px-4 pt-14 pb-8 text-center">
      <div class="text-sm tracking-widest uppercase mb-3 text-secondary">Find your dance</div>
      <h1 class="text-5xl sm:text-6xl leading-[0.98] text-foreground">
        Not sure where <em class="italic text-primary">to start?</em>
      </h1>
    </section>

    <section class="max-w-3xl mx-auto px-4 pb-16">
      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="p in quickPicks"
          :key="p.style"
          :data-testid="`quick-pick-${p.style.toLowerCase()}`"
          class="group rounded-2xl bg-white border overflow-hidden transition-all hover:-translate-y-1"
          :style="{ borderColor: p.accent + '33', boxShadow: '0 2px 4px rgba(59,31,18,0.06), 0 8px 22px rgba(59,31,18,0.04)' }"
        >
          <!-- Video facade: thumbnail + play button, swaps to iframe on click -->
          <div class="relative w-full" style="aspect-ratio:16/9;">
            <iframe
              v-if="activeVideo === p.videoId"
              :src="`https://www.youtube-nocookie.com/embed/${p.videoId}?autoplay=1&rel=0`"
              :title="`${p.style} dance demonstration`"
              class="absolute inset-0 w-full h-full"
              frameborder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowfullscreen
              loading="lazy"
            />
            <button
              v-else
              class="absolute inset-0 w-full h-full cursor-pointer bg-black"
              :aria-label="`Play ${p.style} dance video`"
              @click="playVideo(p.videoId)"
            >
              <img
                :src="`https://img.youtube.com/vi/${p.videoId}/hqdefault.jpg`"
                :alt="`${p.style} dance preview`"
                class="w-full h-full object-cover"
                loading="lazy"
              />
              <div class="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
                <div
                  class="flex items-center justify-center w-14 h-14 rounded-full bg-white/90 shadow-lg transition-transform group-hover:scale-110"
                >
                  <Play class="w-6 h-6 ml-0.5" :style="{ color: p.accent }" />
                </div>
              </div>
            </button>
          </div>

          <!-- Card body -->
          <div class="p-5 text-center">
            <div class="text-xl font-black font-display text-foreground">{{ p.style }}</div>
            <div class="mt-1 text-sm text-muted-foreground font-sans">{{ p.blurb }}</div>
            <NuxtLink
              :to="`/cities?style=${p.style}`"
              class="mt-4 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all hover:opacity-90"
              :style="{ background: p.accent }"
            >
              Choose {{ p.style }} <ArrowRight class="w-4 h-4" />
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- P1006: the low-pressure way in — no style to pick, just find a class to try once. -->
      <NuxtLink
        to="/cities?taster=1"
        data-testid="taster-cta"
        class="group mt-8 block rounded-2xl border border-dashed px-5 py-4 text-center transition-all hover:-translate-y-0.5"
        style="border-color:color-mix(in srgb, var(--wd-amber-600) 40%, transparent); background:rgba(255,255,255,0.55);"
      >
        <span class="block text-secondary font-hand" style="font-size:22px; line-height:1.2;">
          — or just <span class="underline decoration-dotted underline-offset-4 text-wd-green-600">try a free taster class</span> and see what sticks.
          <ArrowRight class="inline w-4 h-4 align-middle transition-transform group-hover:translate-x-1 text-wd-green-600" />
        </span>
        <span class="mt-1 block text-xs text-muted-foreground font-sans">
          No style to pick, no commitment. Turn up once and see how it feels.
        </span>
      </NuxtLink>
    </section>

    </main>

    <SiteFooter />
  </div>
</template>
