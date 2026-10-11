<script setup lang="ts">
import type { PropType } from 'vue'
/**
 * Status pill for admin lists and internal tools — "pending", "active",
 * "hidden", a city slug, a count.
 * (text-eyebrow sits outside cn(): tailwind-merge doesn't know the custom
 * size tokens and would drop it as a "text colour" next to the tone class.) One look, six tones; text colours are the
 * darker steps so every tone clears 4.5:1 on its tint over white.
 *
 *   <AdminStatus tone="success">active</AdminStatus>
 *   <AdminStatus tone="accent" solid>3</AdminStatus>   ← count badge
 */
import { cn } from '@/lib/utils'

type AdminStatusTone = 'neutral' | 'accent' | 'success' | 'warning' | 'info' | 'danger'

// Runtime props on purpose — see ui/button/Button.vue.
const props = defineProps({
  tone: { type: String as PropType<AdminStatusTone>, default: 'neutral' },
  /** Filled pill (white text) — for counts that must pop, e.g. the nav badge. */
  solid: { type: Boolean, default: false },
  class: { type: [String, Array, Object] as PropType<string | string[] | Record<string, boolean>>, default: undefined },
})

const tint: Record<AdminStatusTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  accent: 'bg-primary/10 text-wd-red-800',
  success: 'bg-success/10 text-wd-green-700',
  warning: 'bg-warning/15 text-wd-amber-800',
  info: 'bg-info/10 text-wd-cyan-700',
  danger: 'bg-destructive/10 text-wd-red-800',
}
const fill: Record<AdminStatusTone, string> = {
  neutral: 'bg-muted-foreground text-white',
  accent: 'bg-primary text-primary-foreground',
  success: 'bg-wd-green-700 text-white',
  warning: 'bg-warning text-warning-foreground',
  info: 'bg-wd-cyan-700 text-white',
  danger: 'bg-wd-red-800 text-white',
}
</script>

<template>
  <span
    data-slot="admin-status"
    class="text-eyebrow"
    :class="cn(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold uppercase tracking-wider font-sans leading-normal whitespace-nowrap',
      (props.solid ? fill : tint)[props.tone] ?? tint.neutral,
      props.class,
    )"
  >
    <slot />
  </span>
</template>
