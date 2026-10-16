<script setup lang="ts">
import type { HTMLAttributes, PropType } from 'vue'
import { Check, Search, X } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { controlAria, FIELD_KEY } from '@/lib/field'
import {
  DANCE_FAMILIES,
  DANCE_STYLES,
  type DanceStyle,
  findDanceStyle,
  matchesDanceStyleQuery,
} from '#shared/dance-styles'
import { danceStyleChipClass, danceStyleMoreClass } from './chip-classes'

/**
 * DanceStylePicker — choose the dances someone does (or a festival teaches).
 *
 *   <Field label="Which dances?" :error="errors.danceStyles">
 *     <DanceStylePicker v-model="form.danceStyles" />
 *   </Field>
 *
 * Popular styles first; "All styles" opens the full taxonomy grouped by family;
 * typing searches names, aliases ("LA style", "On2", "Kompa") and families. v-model is
 * the string[] of canonical style names 2026 stores (`'Salsa'`, `'Urban Kiz'`).
 * Values the taxonomy doesn't know are kept and shown so they can be removed.
 */
// Runtime props on purpose — see ui/button/Button.vue.
defineOptions({ inheritAttrs: false })

const props = defineProps({
  /** Restrict the choice to these style names (e.g. a festival's styles). Default: whole taxonomy. */
  options: { type: Array as PropType<string[]>, default: undefined },
  /** Pick at most one — choosing another replaces it (v-model is still an array). */
  single: { type: Boolean, default: false },
  /** Show the search box. Off for short option lists. */
  searchable: { type: Boolean, default: true },
  /** Start with every family open instead of "popular first". */
  expanded: { type: Boolean, default: false },
  /** How many popular styles lead before "All styles". */
  popularCount: { type: Number, default: 8 },
  /** Accessible name of the chip group (the Field label names the search box). */
  label: { type: String, default: 'Dance styles' },
  /** Search placeholder. Default: "Search 150 dances — e.g. kizomba, lindy, LA style". */
  placeholder: { type: String, default: undefined },
  disabled: { type: Boolean, default: false },
  invalid: { type: Boolean, default: false },
  class: { type: [String, Array, Object] as PropType<HTMLAttributes['class']>, default: undefined },
})

const model = defineModel({ type: Array as PropType<string[]>, default: () => [] })

const attrs = useAttrs()
const field = inject(FIELD_KEY, null)
const aria = computed(() => controlAria({ ...attrs, invalid: props.invalid, disabled: props.disabled }, field?.value))
const uid = useId()
const listId = `dsp-${uid}-list`
const statusId = `dsp-${uid}-status`

const query = ref('')
const open = ref(props.expanded)

/** The styles this picker offers, in popularity order. */
const pool = computed<DanceStyle[]>(() => {
  if (!props.options) return DANCE_STYLES
  const ids = new Set(props.options.map(o => findDanceStyle(o)?.id).filter(Boolean))
  return DANCE_STYLES.filter(s => ids.has(s.id))
})

/** Selected values the taxonomy doesn't know (legacy free text) — shown so they can be removed. */
const unknownSelected = computed(() => model.value.filter(v => !findDanceStyle(v)))

function isOn(style: DanceStyle) {
  return model.value.some(v => findDanceStyle(v)?.id === style.id)
}

function toggle(style: DanceStyle) {
  if (props.disabled) return
  if (isOn(style)) {
    model.value = model.value.filter(v => findDanceStyle(v)?.id !== style.id)
  } else {
    model.value = props.single ? [style.name] : [...model.value, style.name]
  }
}

function removeRaw(value: string) {
  model.value = model.value.filter(v => v !== value)
}

const popular = computed(() => {
  const lead = pool.value.slice(0, props.popularCount)
  // A selected style outside the lead stays visible while the list is collapsed.
  const extra = pool.value.slice(props.popularCount).filter(isOn)
  return [...lead, ...extra]
})

const hiddenCount = computed(() => Math.max(0, pool.value.length - props.popularCount))
const showAll = computed(() => open.value || !!query.value.trim() || pool.value.length <= props.popularCount)

/** Families with their matching styles (search applied), empty families dropped. */
const groups = computed(() => {
  const q = query.value.trim()
  return DANCE_FAMILIES
    .map(f => ({
      family: f,
      styles: pool.value.filter(s => s.family === f.id && (!q || matchesDanceStyleQuery(s, q))),
    }))
    .filter(g => g.styles.length)
})

const resultCount = computed(() => groups.value.reduce((n, g) => n + g.styles.length, 0))
const status = computed(() => {
  if (query.value.trim()) return resultCount.value ? `${resultCount.value} matching ${resultCount.value === 1 ? 'dance' : 'dances'}` : 'No dance matches'
  return model.value.length ? `${model.value.length} selected` : ''
})

function onSearchKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && query.value) {
    e.preventDefault()
    query.value = ''
  } else if (e.key === 'Enter') {
    // Enter picks the single best match — fast path for keyboard users.
    e.preventDefault()
    const first = groups.value[0]?.styles[0]
    if (query.value.trim() && first) {
      toggle(first)
      query.value = ''
    }
  }
}

// Keep keyboard focus in place when the disclosure swaps the chip list.
async function expand() {
  open.value = true
  await nextTick()
  document.getElementById(listId)?.querySelector<HTMLElement>('section button')?.focus()
}
async function collapse() {
  open.value = false
  await nextTick()
  document.getElementById(listId)?.querySelector<HTMLElement>('[data-test="dsp-show-all"]')?.focus()
}

const chipClass = danceStyleChipClass
/** The disclosure button: dashed outline, so it never reads as a style. */
const moreClass = danceStyleMoreClass
</script>

<template>
  <div
    data-slot="dance-style-picker"
    :class="cn('flex flex-col gap-3', props.class)"
  >
    <div v-if="searchable && pool.length > popularCount" class="relative">
      <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" aria-hidden="true" />
      <Input
        v-bind="aria"
        v-model="query"
        type="search"
        :placeholder="placeholder || `Search ${pool.length} dances — e.g. kizomba, lindy, LA style`"
        :aria-controls="listId"
        autocomplete="off"
        class="pl-9"
        data-test="dsp-search"
        @keydown="onSearchKey"
      />
    </div>

    <div
      :id="listId"
      role="group"
      :aria-label="label"
      :aria-describedby="aria['aria-describedby']"
      :aria-invalid="aria['aria-invalid']"
      class="flex flex-col gap-3"
    >
      <!-- Legacy values the taxonomy doesn't know: visible + removable, never silently dropped. -->
      <div v-if="unknownSelected.length" class="flex flex-wrap gap-1.5">
        <ToggleChip
          v-for="v in unknownSelected"
          :key="'raw-' + v"
          pressed
          :disabled="disabled"
          :class="chipClass"
          :aria-label="`${v}, selected. Remove`"
          @click="removeRaw(v)"
        >
          {{ v }} <X class="size-3" aria-hidden="true" />
        </ToggleChip>
      </div>

      <!-- Popular first -->
      <div v-if="!showAll" class="flex flex-wrap gap-1.5" data-test="dsp-popular">
        <ToggleChip
          v-for="s in popular"
          :key="s.id"
          :pressed="isOn(s)"
          :disabled="disabled"
          :class="chipClass"
          :data-style="s.id"
          @click="toggle(s)"
        >
          <Check v-if="isOn(s)" class="size-3" aria-hidden="true" />
          {{ s.display }}
        </ToggleChip>
        <button
          v-if="hiddenCount"
          type="button"
          :disabled="disabled"
          :class="cn(moreClass, chipClass)"
          aria-expanded="false"
          :aria-controls="listId"
          data-test="dsp-show-all"
          @click="expand"
        >
          All {{ pool.length }} styles
        </button>
      </div>

      <!-- Everything, grouped by family (also the search results) -->
      <template v-else>
        <div v-if="open && !query.trim() && !expanded && pool.length > popularCount">
          <button type="button" :class="cn(moreClass, chipClass)" aria-expanded="true" :aria-controls="listId" data-test="dsp-show-less" @click="collapse">
            Popular only
          </button>
        </div>
        <section
          v-for="g in groups"
          :key="g.family.id"
          :aria-labelledby="`dsp-${uid}-${g.family.id}`"
          class="flex flex-col gap-1.5"
          :data-family="g.family.id"
        >
          <h3 :id="`dsp-${uid}-${g.family.id}`" class="flex items-center gap-1.5 text-eyebrow font-bold uppercase tracking-wider text-muted-foreground font-sans">
            <span class="inline-block size-2 rounded-full" :style="{ background: g.family.accent }" aria-hidden="true" />
            {{ g.family.name }}
          </h3>
          <div class="flex flex-wrap gap-1.5">
            <ToggleChip
              v-for="s in g.styles"
              :key="s.id"
              :pressed="isOn(s)"
              :disabled="disabled"
              :class="chipClass"
              :data-style="s.id"
              @click="toggle(s)"
            >
              <Check v-if="isOn(s)" class="size-3" aria-hidden="true" />
              {{ s.display }}
            </ToggleChip>
          </div>
        </section>
        <p v-if="!groups.length" class="text-sm text-muted-foreground font-sans">
          No dance called “{{ query }}” yet. Try another spelling.
        </p>
      </template>
    </div>

    <p :id="statusId" class="sr-only" role="status" aria-live="polite">{{ status }}</p>
  </div>
</template>
