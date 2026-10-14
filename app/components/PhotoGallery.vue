<script setup lang="ts">
/**
 * Instagram-story-like fullscreen photo gallery.
 * Opens over the page; swipe / tap left-right to navigate; tap close or backdrop to dismiss.
 */
import { X, ChevronLeft, ChevronRight } from 'lucide-vue-next'

const props = defineProps<{
  photos: string[]
  startIndex?: number
}>()

const emit = defineEmits<{ close: [] }>()

const current = ref(props.startIndex ?? 0)
const touchStartX = ref(0)

function next() { if (current.value < props.photos.length - 1) current.value++ }
function prev() { if (current.value > 0) current.value-- }

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
  if (e.key === 'ArrowRight') next()
  if (e.key === 'ArrowLeft') prev()
}

function onTouchStart(e: TouchEvent) { touchStartX.value = e.touches[0].clientX }
function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - touchStartX.value
  if (Math.abs(dx) > 50) { dx < 0 ? next() : prev() }
}

onMounted(() => { window.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden' })
onUnmounted(() => { window.removeEventListener('keydown', onKey); document.body.style.overflow = '' })
</script>

<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-[100] flex items-center justify-center bg-black/95"
      @click.self="emit('close')"
      @touchstart.passive="onTouchStart"
      @touchend.passive="onTouchEnd"
    >
      <!-- Close button -->
      <button
        class="absolute top-4 right-4 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="Close"
        @click="emit('close')"
      >
        <X class="w-6 h-6" />
      </button>

      <!-- Counter -->
      <div v-if="photos.length > 1" class="absolute top-4 left-4 z-10 text-sm text-white/70 font-sans">
        {{ current + 1 }} / {{ photos.length }}
      </div>

      <!-- Previous -->
      <button
        v-if="current > 0"
        class="absolute left-2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="Previous photo"
        @click.stop="prev"
      >
        <ChevronLeft class="w-6 h-6" />
      </button>

      <!-- Photo -->
      <img
        :src="photos[current]"
        :alt="`Photo ${current + 1}`"
        class="max-h-[90vh] max-w-[90vw] object-contain select-none"
        draggable="false"
      />

      <!-- Next -->
      <button
        v-if="current < photos.length - 1"
        class="absolute right-2 z-10 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="Next photo"
        @click.stop="next"
      >
        <ChevronRight class="w-6 h-6" />
      </button>

      <!-- Dots -->
      <div v-if="photos.length > 1" class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
        <button
          v-for="(_, i) in photos"
          :key="i"
          class="w-2 h-2 rounded-full transition-colors"
          :class="i === current ? 'bg-white' : 'bg-white/40'"
          :aria-label="`Go to photo ${i + 1}`"
          @click.stop="current = i"
        />
      </div>
    </div>
  </Teleport>
</template>
