<script setup lang="ts">
import { WD } from '~/lib/brand'
/**
 * StyleFilter — the dance-style chip row used on every filter surface.
 * Leads with the big three (Salsa, Bachata, Kizomba), collapses the rest
 * behind "More", and offers a "Don't know?" escape hatch to the
 * dance-finder (a v4 game to be integrated later — placeholder for now).
 */
const props = withDefaults(defineProps<{
  styles: string[]
  modelValue: string
  accents?: string[]
}>(), {
  accents: () => [WD.red600, WD.cyan600, WD.green600, WD.purple500, WD.amber500, WD.pink500, WD.violet600],
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const PRIMARY = ['Salsa', 'Bachata', 'Kizomba']
const expanded = ref(false)

// Primary styles present in the data lead; the rest follow.
const ordered = computed(() => {
  const primary = PRIMARY.filter((s) => props.styles.includes(s))
  const rest = props.styles.filter((s) => !PRIMARY.includes(s))
  return [...primary, ...rest]
})
const leadCount = computed(() => Math.max(PRIMARY.filter((s) => props.styles.includes(s)).length, 3))
const visible = computed(() => (expanded.value ? ordered.value : ordered.value.slice(0, leadCount.value)))
const hiddenCount = computed(() => Math.max(0, ordered.value.length - leadCount.value))

function select(s: string) {
  emit('update:modelValue', props.modelValue === s ? '' : s)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <div class="flex flex-wrap items-center gap-1.5">
      <button
        v-for="(style, i) in visible"
        :key="style"
        type="button"
        class="px-2.5 py-1 rounded-full text-meta font-bold uppercase tracking-wider transition-all"
        :style="modelValue === style
          ? { background: accents[i % accents.length], color: 'white' }
          : { background: 'white', color: accents[i % accents.length], border: '1px solid ' + accents[i % accents.length] + '55' }"
        @click="select(style)"
      >
        {{ style }}
      </button>

      <button
        v-if="hiddenCount && !expanded"
        type="button"
        class="px-2.5 py-1 rounded-full text-meta font-bold uppercase tracking-wider transition-all bg-white text-muted-foreground border border-input"
        @click="expanded = true"
      >
        + {{ hiddenCount }} more
      </button>
      <button
        v-else-if="expanded && ordered.length > leadCount"
        type="button"
        class="px-2.5 py-1 rounded-full text-meta font-bold uppercase tracking-wider transition-all bg-white text-secondary border border-input"
        @click="expanded = false"
      >
        Less
      </button>
    </div>
  </div>
</template>
