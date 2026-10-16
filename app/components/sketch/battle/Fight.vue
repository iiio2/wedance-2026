<script setup lang="ts">
/**
 * Sketch-only CityFight look-alike (pages/sketches/battle). Same card, VS badge,
 * accent pills and gradient as components/CityFight.vue, plus the options the
 * variants compare: media shape, watch-before-vote gate, and a result state.
 * Mock data only — no tRPC.
 */
import { Play, Check, Share2 } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { WD } from '~/lib/brand'

export interface SketchClip { key: string, city: string, title: string, style: string, img: string, stale?: boolean }

const props = withDefaults(defineProps<{
  a: SketchClip
  b: SketchClip
  va: number
  vb: number
  watched: string[]
  vote: string | null
  shape?: 'video' | 'portrait'
  gate?: boolean
  compact?: boolean
  isMobile?: boolean
  left?: number
}>(), { shape: 'portrait', gate: true, compact: false, isMobile: false, left: 0 })

const emit = defineEmits<{ play: [key: string], playBoth: [], vote: [key: string], next: [], share: [] }>()

const accents = [WD.red600, WD.cyan700] as const
const total = computed(() => props.va + props.vb)
const pct = computed(() => {
  const a = Math.round(props.va / total.value * 100)
  return [a, 100 - a]
})
const seenBoth = computed(() => props.watched.includes(props.a.key) && props.watched.includes(props.b.key))
const canVote = computed(() => !props.gate || seenBoth.value)
const shown = ref(false)
watch(() => props.vote, (v) => {
  shown.value = false
  if (v) requestAnimationFrame(() => requestAnimationFrame(() => { shown.value = true }))
}, { immediate: true })
</script>

<template>
  <div :class="isMobile ? '' : 'max-w-xl mx-auto'">
    <div class="relative grid grid-cols-2" :class="isMobile ? 'gap-3' : 'gap-5'">
      <div
        v-for="(c, i) in [a, b]" :key="c.key"
        class="rounded-2xl overflow-hidden bg-white border flex flex-col transition-transform duration-wd-standard ease-wd-spring"
        :class="vote === c.key ? '-translate-y-1' : ''"
        :style="{ borderColor: accents[i] + '55', boxShadow: '0 8px 22px rgba(59,31,18,0.06)' }"
      >
        <button
          type="button"
          class="group relative block w-full overflow-hidden bg-wd-brown-900"
          :class="shape === 'portrait' ? 'aspect-[4/5]' : 'aspect-video'"
          :aria-label="`Play the ${c.city} clip`"
          @click="emit('play', c.key)"
        >
          <img :src="c.img" :alt="c.title" class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105">
          <span class="absolute inset-0" style="background:linear-gradient(180deg, rgba(59,31,18,0) 40%, rgba(59,31,18,0.78) 100%);" />
          <span v-if="watched.includes(c.key)" class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-eyebrow font-bold uppercase tracking-wider text-foreground">
            <Check class="h-3 w-3 text-success" /> Watched
          </span>
          <span v-else-if="c.stale" class="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-eyebrow font-bold uppercase tracking-wider text-white">From July</span>
          <span class="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform group-hover:scale-110">
            <Play class="h-5 w-5 translate-x-0.5" :style="{ color: accents[i] }" fill="currentColor" />
          </span>
          <span class="absolute bottom-2 left-3 right-3 text-left text-white">
            <span class="block font-display font-bold leading-tight" :class="isMobile ? 'text-lg' : 'text-xl'" style="text-shadow:0 1px 12px rgba(0,0,0,0.4)">{{ c.city }}</span>
            <span class="block text-meta text-white/85 leading-snug line-clamp-2">{{ c.title }}</span>
          </span>
        </button>
        <div class="p-3 flex flex-col gap-2">
          <template v-if="vote">
            <div class="flex items-end justify-between">
              <span class="font-display font-bold text-2xl leading-none tabular-nums" :style="{ color: accents[i] }">{{ pct[i] }}%</span>
              <span v-if="vote === c.key" class="inline-flex items-center gap-1 text-eyebrow font-bold uppercase tracking-wider text-success"><Check class="h-3 w-3" />Your pick</span>
            </div>
            <div class="h-1.5 rounded-full bg-wd-brown-900/[8%] overflow-hidden">
              <div class="h-full rounded-full transition-[width] duration-700 ease-out" :style="{ width: (shown ? pct[i] : 0) + '%', background: accents[i] }" />
            </div>
          </template>
          <Button v-else variant="pill" :accent="accents[i]" class="w-full" :size="isMobile ? 'sm' : 'default'" :disabled="!canVote" @click="emit('vote', c.key)">
            Vote {{ c.city }}
          </Button>
        </div>
      </div>
      <div class="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 w-11 h-11 rounded-full grid place-items-center text-white font-black text-sm bg-wd-brown-900 font-display" style="box-shadow:0 4px 0 -1px color-mix(in srgb, var(--wd-brown-900) 70%, black), 0 6px 18px rgba(0,0,0,0.25);">
        VS
      </div>
    </div>

    <template v-if="!compact">
      <div v-if="!vote && gate && !seenBoth" class="mt-4 flex flex-col items-center gap-2">
        <Button variant="cta" :class="isMobile ? 'w-full h-12' : 'h-12 px-8'" @click="emit('playBoth')"><Play fill="currentColor" /> Watch the battle · 2 clips</Button>
        <p class="text-xs text-muted-foreground">Voting opens after you've seen both clips.</p>
      </div>
      <p v-else-if="!vote" class="mt-3 text-center text-xs text-muted-foreground">Who danced it better?</p>
      <div v-else class="mt-4 flex flex-col gap-3">
        <p class="text-center text-xs text-muted-foreground">{{ total }} votes on this battle</p>
        <div class="grid grid-cols-2 gap-3" :class="isMobile ? '' : 'max-w-md mx-auto w-full'">
          <Button variant="pill" :disabled="!left" @click="emit('next')">{{ left ? 'Next battle' : 'All voted' }}</Button>
          <Button variant="outline-pill" @click="emit('share')"><Share2 /> Share</Button>
        </div>
      </div>
    </template>
    <div v-else-if="!vote && gate && !seenBoth" class="mt-3">
      <Button variant="soft" class="w-full" @click="emit('playBoth')"><Play fill="currentColor" /> Watch both &amp; vote</Button>
    </div>
  </div>
</template>
