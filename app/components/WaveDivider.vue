<script setup lang="ts">
/**
 * The wavy section divider used under heroes (/docs/design/patterns/heroes).
 * Decorative only. Height comes from the class (default h-10).
 *
 *   <WaveDivider />                       brown at 8%, wave on top
 *   <WaveDivider class="h-12" flip />     upside down (wave at the bottom)
 *   <WaveDivider color="var(--wd-red-600)" :opacity="0.12" />
 */
import type { HTMLAttributes, PropType } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps({
  /** Fill opacity. The system standard is 0.08. */
  opacity: { type: Number, default: 0.08 },
  /** Mirror vertically so the flat edge is on top. */
  flip: { type: Boolean, default: false },
  /** Fill colour — a CSS token, e.g. var(--wd-brown-900). */
  color: { type: String, default: 'var(--wd-brown-900)' },
  class: { type: [String, Array, Object] as PropType<HTMLAttributes['class']>, default: undefined },
})
</script>

<template>
  <svg
    :class="cn('block w-full h-10', flip && '-scale-y-100', props.class)"
    viewBox="0 0 1440 60"
    preserveAspectRatio="none"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M0,40 Q360,0 720,30 T1440,20 V60 H0 Z" :style="{ fill: color }" :opacity="opacity" />
  </svg>
</template>
