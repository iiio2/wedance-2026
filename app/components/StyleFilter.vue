<script setup lang="ts">
import { Button } from '~/components/ui/button'
import { WD } from '~/lib/brand'
import { readableOn } from '~/lib/contrast'
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

// Accent text on white (and white on accent) darkened just enough for 4.5:1.
const ink = (i: number) => readableOn(props.accents[i % props.accents.length] ?? WD.amber600)

function select(s: string) {
  emit('update:modelValue', props.modelValue === s ? '' : s)
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-1.5">
    <div class="flex flex-wrap items-center gap-1.5">
      <Button
        v-for="(style, i) in visible"
        :key="style"
        type="button"
        variant="ghost"
        class="h-auto px-2.5 py-1 rounded-full text-meta font-bold uppercase tracking-wider transition-all"
        :aria-pressed="modelValue === style ? 'true' : 'false'"
        :style="modelValue === style
          ? { background: ink(i), color: 'white' }
          : { background: 'white', color: ink(i), border: '1px solid ' + accents[i % accents.length] + '55' }"
        @click="select(style)"
      >
        {{ style }}
      </Button>

      <Button
        v-if="hiddenCount && !expanded"
        type="button"
        variant="outline"
        class="h-auto px-2.5 py-1 rounded-full text-meta font-bold uppercase tracking-wider transition-all bg-white text-muted-foreground border-input"
        @click="expanded = true"
      >
        + {{ hiddenCount }} more
      </Button>
      <Button
        v-else-if="expanded && ordered.length > leadCount"
        type="button"
        variant="outline"
        class="h-auto px-2.5 py-1 rounded-full text-meta font-bold uppercase tracking-wider transition-all bg-white text-secondary border-input"
        @click="expanded = false"
      >
        Less
      </Button>
    </div>
  </div>
</template>
