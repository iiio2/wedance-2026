<script setup lang="ts">
import type { HTMLAttributes, PropType } from 'vue'
import { cn } from '@/lib/utils'

/**
 * A pressable pill for picking one or many options (dance styles, role, level).
 * Renders a real <button type="button"> with aria-pressed, so keyboard and
 * screen-reader users get the on/off state. Selected = solid fill.
 *
 *   <ToggleChip :pressed="form.styles.includes(s)" @click="toggle(s)">{{ s }}</ToggleChip>
 *
 * Variants describe the unselected look:
 *   outline — white with the input border (default; forms)
 *   soft    — red tint (dense chip clouds)
 *   ink     — white with the input border, fills brown when pressed (a second
 *             row of choices under red chips, e.g. levels)
 */
// Runtime props on purpose — see ui/button/Button.vue.
const props = defineProps({
  pressed: { type: Boolean, default: false },
  variant: { type: String as PropType<'outline' | 'soft' | 'ink'>, default: 'outline' },
  class: { type: [String, Array, Object] as PropType<HTMLAttributes['class']>, default: undefined },
})

const look = computed(() => {
  if (props.variant === 'ink') {
    return props.pressed
      ? 'bg-foreground text-white border border-foreground'
      : 'bg-card text-muted-foreground border border-input hover:border-foreground/40'
  }
  if (props.variant === 'soft') {
    return props.pressed
      ? 'bg-primary text-primary-foreground'
      : 'bg-primary/8 text-primary hover:bg-primary/15'
  }
  return props.pressed
    ? 'bg-primary text-primary-foreground border border-primary'
    : 'bg-card text-muted-foreground border border-input hover:border-primary/40'
})
</script>

<template>
  <button
    type="button"
    :aria-pressed="pressed"
    :class="cn(
      'inline-flex items-center justify-center gap-1 rounded-full font-bold transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
      look,
      props.class,
    )"
  >
    <slot />
  </button>
</template>
