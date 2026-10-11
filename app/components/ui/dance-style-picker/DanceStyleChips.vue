<script setup lang="ts">
import type { HTMLAttributes, PropType } from 'vue'
import { cn } from '@/lib/utils'
import { readableOn } from '~/lib/contrast'
import { danceStyleAccent, displayDanceStyle, sortDanceStyles } from '#shared/dance-styles'

/**
 * DanceStyleChips — read-only list of a profile's / event's styles.
 *
 *   <DanceStyleChips :styles="artist.styles" :max="3" />
 *
 * Sorted by popularity, aliases shown under their canonical name, each chip
 * tinted with its family accent. Not interactive — for picking use DanceStylePicker.
 */
// Runtime props on purpose — see ui/button/Button.vue.
const props = defineProps({
  styles: { type: Array as PropType<string[]>, default: () => [] },
  /** Show at most this many, then "+N". 0 = all. */
  max: { type: Number, default: 0 },
  size: { type: String as PropType<'sm' | 'md'>, default: 'sm' },
  class: { type: [String, Array, Object] as PropType<HTMLAttributes['class']>, default: undefined },
})

const sorted = computed(() => sortDanceStyles(props.styles).map(displayDanceStyle))
const shown = computed(() => (props.max > 0 ? sorted.value.slice(0, props.max) : sorted.value))
const rest = computed(() => sorted.value.length - shown.value.length)
</script>

<template>
  <ul v-if="sorted.length" data-slot="dance-style-chips" :class="cn('flex flex-wrap gap-1', props.class)" aria-label="Dance styles">
    <li
      v-for="s in shown"
      :key="s"
      :class="cn('rounded-full font-bold uppercase tracking-wider font-sans', size === 'sm' ? 'px-2 py-0.5 text-eyebrow' : 'px-2.5 py-1 text-meta')"
      :style="{ color: readableOn(danceStyleAccent(s), undefined, 5.5), background: `color-mix(in srgb, ${danceStyleAccent(s)} 12%, white)` }"
    >
      {{ s }}
    </li>
    <li
      v-if="rest > 0"
      :class="cn('rounded-full font-bold uppercase tracking-wider font-sans text-muted-foreground bg-muted', size === 'sm' ? 'px-2 py-0.5 text-eyebrow' : 'px-2.5 py-1 text-meta')"
      :aria-label="`and ${rest} more`"
    >
      +{{ rest }}
    </li>
  </ul>
</template>
