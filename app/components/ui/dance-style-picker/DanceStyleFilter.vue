<script setup lang="ts">
import type { HTMLAttributes, PropType } from 'vue'
import { Check } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { displayDanceStyle, sameDanceStyle, sortDanceStyles } from '#shared/dance-styles'
import { danceStyleChipClass, danceStyleMoreClass } from './chip-classes'

/**
 * DanceStyleFilter — single-select row of dance-style chips for filter surfaces.
 *
 *   <DanceStyleFilter v-model="selectedStyle" :styles="city.styles" />
 *
 * Same chips as DanceStylePicker (ToggleChip, check when on). Orders the given styles
 * by popularity, de-duplicates aliases, leads with the top `lead` and collapses the rest
 * behind "+N more". Tapping the active chip clears it. Emits the style value as passed
 * in (or '' when cleared), so callers keep their stored values.
 */
// Runtime props on purpose — see ui/button/Button.vue.
const props = defineProps({
  styles: { type: Array as PropType<string[]>, default: () => [] },
  modelValue: { type: String, default: '' },
  /** How many styles show before "+N more". */
  lead: { type: Number, default: 3 },
  /** Accessible name of the chip group. */
  label: { type: String, default: 'Filter by dance style' },
  class: { type: [String, Array, Object] as PropType<HTMLAttributes['class']>, default: undefined },
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const expanded = ref(false)

const isOn = (s: string) => !!props.modelValue && sameDanceStyle(s, props.modelValue)

// Most popular first (taxonomy rank); unknown values last.
const ordered = computed(() => sortDanceStyles(props.styles))
// Keep the active style visible while collapsed.
const leadCount = computed(() => Math.max(props.lead, ordered.value.findIndex(isOn) + 1))
const visible = computed(() => (expanded.value ? ordered.value : ordered.value.slice(0, leadCount.value)))
const hiddenCount = computed(() => Math.max(0, ordered.value.length - leadCount.value))

function toggle(s: string) {
  emit('update:modelValue', isOn(s) ? '' : s)
}
</script>

<template>
  <div
    v-if="ordered.length"
    role="group"
    :aria-label="label"
    data-slot="dance-style-filter"
    :class="cn('flex flex-wrap items-center gap-1.5', props.class)"
  >
    <ToggleChip
      v-for="s in visible"
      :key="s"
      :pressed="isOn(s)"
      :class="danceStyleChipClass"
      @click="toggle(s)"
    >
      <Check v-if="isOn(s)" class="size-3" aria-hidden="true" />
      {{ displayDanceStyle(s) }}
    </ToggleChip>
    <button
      v-if="hiddenCount && !expanded"
      type="button"
      :class="danceStyleMoreClass"
      :aria-expanded="false"
      @click="expanded = true"
    >
      + {{ hiddenCount }} more
    </button>
    <button
      v-else-if="expanded && hiddenCount"
      type="button"
      :class="danceStyleMoreClass"
      :aria-expanded="true"
      @click="expanded = false"
    >
      Less
    </button>
  </div>
</template>
