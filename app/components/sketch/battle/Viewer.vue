<script setup lang="ts">
/**
 * Sketch-only full-screen vertical player (pages/sketches/battle). Plays the
 * queued clips story-style: a still frame with a slow zoom and a progress bar
 * stands in for the video. Tap to skip. Emits `watched` per clip, `done` at the end.
 */
import { X } from 'lucide-vue-next'
import { WD } from '~/lib/brand'
import type { SketchClip } from './Fight.vue'

const props = defineProps<{ queue: SketchClip[], title: string, sides: string[] }>()
const emit = defineEmits<{ watched: [key: string], done: [], close: [] }>()

const idx = ref(0)
const progress = ref(0)
let timer: ReturnType<typeof setInterval> | null = null
const DURATION = 5000

function start() {
  stop()
  const clip = props.queue[idx.value]
  if (!clip) return emit('done')
  emit('watched', clip.key)
  const t0 = performance.now()
  progress.value = 0
  timer = setInterval(() => {
    progress.value = Math.min(1, (performance.now() - t0) / DURATION)
    if (progress.value >= 1) skip()
  }, 60)
}
function stop() { if (timer) clearInterval(timer); timer = null }
function skip() {
  stop()
  if (idx.value + 1 >= props.queue.length) return emit('done')
  idx.value++
  start()
}
onMounted(start)
onBeforeUnmount(stop)
const clip = computed(() => props.queue[idx.value]!)
const accent = computed(() => props.sides.indexOf(clip.value.key) === 1 ? WD.cyan700 : WD.red600)
</script>

<template>
  <div class="absolute inset-0 z-50 bg-black text-white overflow-hidden" role="dialog" :aria-label="`${clip.city} clip`">
    <div :key="clip.key" class="absolute inset-0 overflow-hidden">
      <img :src="clip.img" :alt="clip.title" class="absolute inset-0 h-full w-full object-cover sketch-kenburns">
    </div>
    <div class="absolute inset-0" style="background:linear-gradient(180deg, rgba(0,0,0,.55), transparent 22%, transparent 58%, rgba(0,0,0,.8))" />
    <div class="absolute top-3 inset-x-3 z-10 flex gap-1">
      <span v-for="(q, i) in queue" :key="q.key" class="h-[3px] flex-1 rounded bg-white/30 overflow-hidden">
        <span class="block h-full bg-white" :style="{ width: (i < idx ? 100 : i === idx ? progress * 100 : 0) + '%' }" />
      </span>
    </div>
    <div class="absolute top-6 inset-x-3.5 z-10 flex items-center justify-between text-xs font-semibold">
      <span>{{ title }}</span>
      <button type="button" class="size-9 rounded-full bg-white/15 grid place-items-center" aria-label="Close" @click="emit('close')"><X class="w-4 h-4" /></button>
    </div>
    <button type="button" class="absolute inset-x-0 top-16 bottom-0 z-[5]" aria-label="Next clip" @click="skip" />
    <div class="absolute left-4 right-4 bottom-7 z-10 flex flex-col gap-1.5 pointer-events-none">
      <span class="self-start rounded-full px-2.5 py-0.5 text-eyebrow font-bold uppercase tracking-[0.14em]" :style="{ background: accent }">
        Clip {{ idx + 1 }} of {{ queue.length }}
      </span>
      <h3 class="font-display font-bold text-4xl leading-none" style="text-shadow:0 1px 12px rgba(0,0,0,.4)">{{ clip.city }}</h3>
      <span class="text-sm text-white/90">{{ clip.title }}</span>
      <span class="font-hand text-lg text-white/80">tap to skip →</span>
    </div>
  </div>
</template>

<style scoped>
.sketch-kenburns { animation: kb 6s ease-out forwards; }
@keyframes kb { from { transform: scale(1); } to { transform: scale(1.12) translateY(-2%); } }
@media (prefers-reduced-motion: reduce) { .sketch-kenburns { animation: none; } }
</style>
