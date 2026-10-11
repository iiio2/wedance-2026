<script setup lang="ts">
/**
 * Video of the Month for a city — the current people's-choice winner
 * (highest ELO among approved videos this month). Renders the thumbnail with
 * a play affordance; clicking opens the source video in a new tab. Real empty
 * state when there's no winner yet ("no fake winner" rule).
 *
 * Client-fetches (the tRPC client uses a relative URL that throws during Nitro
 * SSR — same reason AttendeeRoster fetches on mount).
 */
import { Play, Trophy } from 'lucide-vue-next'
import { parseVideoUrl } from '~/lib/videoEmbed'
import { WD } from '~/lib/brand'

const props = defineProps<{
  citySlug: string
  accent?: string
}>()

const { $trpc } = useNuxtApp()

interface Winner {
  id: string
  title: string
  videoUrl: string
  thumbnailUrl: string | null
  danceStyle: string | null
  eloScore: number
  voteCount: number
}

const winner = ref<Winner | null>(null)
const loading = ref(true)
const accent = computed(() => props.accent ?? WD.red600)

const thumb = computed(() => {
  if (!winner.value) return null
  return winner.value.thumbnailUrl ?? parseVideoUrl(winner.value.videoUrl).thumbnailUrl
})

async function load() {
  loading.value = true
  try {
    winner.value = await $trpc.cityVideo.monthWinner.query({ citySlug: props.citySlug })
  } catch {
    winner.value = null
  } finally {
    loading.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div
      v-if="loading"
      class="aspect-video w-full rounded-xl animate-pulse"
      style="background:color-mix(in srgb, var(--wd-brown-900) 5.1%, transparent);"
    />

    <!-- Button (not <a>) so this can nest inside a parent NuxtLink card without
         producing invalid nested anchors. Opens the source video in a new tab. -->
    <button
      v-else-if="winner"
      type="button"
      class="group/vom relative block aspect-video w-full overflow-hidden rounded-xl text-left"
      :style="{ background: 'var(--wd-brown-900)', boxShadow: '0 1px 0 ' + accent + '22' }"
      @click.stop.prevent="() => window.open(winner!.videoUrl, '_blank', 'noopener')"
    >
      <img
        v-if="thumb"
        :src="thumb"
        :alt="winner.title"
        class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover/vom:scale-105"
        loading="lazy"
      >
      <div class="absolute inset-0" style="background:linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.05));" />

      <!-- Winner ribbon -->
      <div
        class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-eyebrow font-bold uppercase tracking-wider text-white"
        :style="{ background: accent }"
      >
        <Trophy class="h-3 w-3" /> Video of the Month
      </div>

      <!-- Play -->
      <div class="absolute inset-0 flex items-center justify-center">
        <span class="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform group-hover/vom:scale-110">
          <Play class="h-5 w-5 translate-x-0.5" :style="{ color: accent }" fill="currentColor" />
        </span>
      </div>

      <!-- Title -->
      <div class="absolute inset-x-0 bottom-0 p-2.5">
        <p class="truncate text-sm font-bold text-white font-display">
          {{ winner.title }}
        </p>
        <p v-if="winner.danceStyle" class="text-meta text-white/80 font-sans">
          {{ winner.danceStyle }}
        </p>
      </div>
    </button>

    <!-- Real empty state — no fabricated winner. Plain div (no nested anchor);
         the surrounding city card already links through to the city page. -->
    <div
      v-else
      class="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input bg-white/50 text-center"
    >
      <Trophy class="h-5 w-5 text-secondary" aria-hidden="true" />
      <p class="text-xs font-bold" :style="{ color: accent, fontFamily: 'var(--wd-font-sans)' }">
        Be the first to enter
      </p>
      <p class="text-meta text-muted-foreground font-sans">
        No Video of the Month yet
      </p>
    </div>
  </div>
</template>
