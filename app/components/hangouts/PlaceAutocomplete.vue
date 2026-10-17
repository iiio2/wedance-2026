<script setup lang="ts">
import type { HTMLAttributes, PropType } from 'vue'
import type { ControlVariants } from '@/components/ui/input'
import { MapPin } from 'lucide-vue-next'
import { cn } from '@/lib/utils'
import { controlAria, FIELD_KEY } from '@/lib/field'
import { controlVariants } from '@/components/ui/input'

/**
 * Venue typeahead for a hangout's "Where?" — ARIA 1.2 combobox over Google
 * Places autocomplete (establishments near the dancer's city), via the
 * signed-in hangouts.placeSearch / placeDetails procedures (the API key stays
 * on the server). Typing alone is allowed: free text is a place name without
 * a place id. Picking a suggestion emits the full place (id, address, coords).
 * One Places session per typing session, closed by the details call.
 */
defineOptions({ inheritAttrs: false })

export type PickedPlace = { placeId: string; name: string; address: string; lat: number | null; lng: number | null }

const props = defineProps({
  citySlug: { type: String, required: true },
  placeholder: { type: String, default: 'Search a place' },
  size: { type: String as PropType<ControlVariants['size']>, default: undefined },
  class: { type: [String, Array, Object] as PropType<HTMLAttributes['class']>, default: undefined },
})

const emit = defineEmits<{
  /** A suggestion was picked; null when the text was edited after a pick. */
  place: [place: PickedPlace | null]
}>()

const model = defineModel({ type: String, default: '' })

const { $trpc } = useNuxtApp()
const attrs = useAttrs()
const field = inject(FIELD_KEY, null)
const aria = computed(() => controlAria({ ...(attrs as Record<string, unknown>) }, field?.value))
const uid = useId()
const inputId = computed(() => aria.value.id || `place-${uid}`)
const listId = computed(() => `${inputId.value}-listbox`)
const optionId = (i: number) => `${inputId.value}-opt-${i}`

type Suggestion = { placeId: string; name: string; address: string }
const results = ref<Suggestion[]>([])
const open = ref(false)
const active = ref(-1)
const searching = ref(false)
const resolving = ref(false)
let session = ''
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0

function newSession() {
  session = (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`)
}

function onInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  model.value = v
  emit('place', null)
  clearTimeout(timer)
  const q = v.trim()
  if (q.length < 2) { results.value = []; open.value = false; searching.value = false; return }
  if (!session) newSession()
  searching.value = true
  open.value = true
  const mine = ++seq
  timer = setTimeout(async () => {
    try {
      const res = await $trpc.hangouts.placeSearch.query({ q, citySlug: props.citySlug, session })
      if (mine === seq) { results.value = res; active.value = -1 }
    } catch {
      if (mine === seq) results.value = []
    } finally {
      if (mine === seq) searching.value = false
    }
  }, 300)
}
onBeforeUnmount(() => clearTimeout(timer))

async function pick(s: Suggestion) {
  model.value = s.name
  open.value = false
  resolving.value = true
  try {
    const d = await $trpc.hangouts.placeDetails.query({ placeId: s.placeId, session: session || undefined })
    emit('place', d ? { placeId: d.placeId, name: s.name, address: d.address || s.address, lat: d.lat, lng: d.lng } : { placeId: s.placeId, name: s.name, address: s.address, lat: null, lng: null })
  } catch {
    emit('place', { placeId: s.placeId, name: s.name, address: s.address, lat: null, lng: null })
  } finally {
    resolving.value = false
    session = ''
  }
}

function onKeydown(e: KeyboardEvent) {
  const n = results.value.length
  if (e.key === 'ArrowDown') { e.preventDefault(); if (n) { open.value = true; active.value = (active.value + 1) % n } }
  else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) { open.value = true; active.value = active.value <= 0 ? n - 1 : active.value - 1 } }
  else if (e.key === 'Enter' && open.value && active.value >= 0 && results.value[active.value]) { e.preventDefault(); pick(results.value[active.value]!) }
  else if (e.key === 'Escape' && open.value) { e.preventDefault(); open.value = false }
  else if (e.key === 'Tab') open.value = false
}

const showList = computed(() => open.value && results.value.length > 0)
const status = computed(() => {
  if (resolving.value) return 'Getting the address…'
  if (!open.value) return ''
  if (searching.value && !results.value.length) return 'Searching places…'
  return results.value.length ? `${results.value.length} places suggested. Use up and down arrows to choose.` : ''
})
</script>

<template>
  <div class="relative w-full" data-slot="place-autocomplete">
    <input
      type="text"
      role="combobox"
      autocomplete="off"
      spellcheck="false"
      v-bind="{ ...$attrs, ...aria }"
      :id="inputId"
      :value="model"
      :placeholder="placeholder"
      aria-autocomplete="list"
      :aria-expanded="showList ? 'true' : 'false'"
      :aria-controls="listId"
      :aria-activedescendant="showList && active >= 0 ? optionId(active) : undefined"
      data-slot="input"
      :class="cn(controlVariants({ size }), props.class)"
      @input="onInput"
      @focus="open = results.length > 0"
      @blur="open = false"
      @keydown="onKeydown"
    >
    <div
      v-show="showList || (open && searching)"
      class="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl text-left border border-border bg-popover text-popover-foreground shadow-wd-float"
    >
      <ul :id="listId" role="listbox" aria-label="Place suggestions" class="max-h-64 overflow-y-auto overscroll-contain py-1">
        <li
          v-for="(s, i) in results"
          :id="optionId(i)"
          :key="s.placeId"
          role="option"
          :aria-selected="i === active ? 'true' : 'false'"
          :data-active="i === active ? '' : undefined"
          class="flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-sm font-sans text-foreground data-[active]:bg-accent data-[active]:text-accent-foreground hover:bg-muted"
          @mousedown.prevent
          @click="pick(s)"
          @mousemove="active = i"
        >
          <MapPin class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">{{ s.name }}</span>
          <span v-if="s.address" class="shrink-0 max-w-[50%] truncate text-xs text-muted-foreground">{{ s.address }}</span>
        </li>
      </ul>
      <p v-if="open && searching && !results.length" class="px-3.5 py-3 text-sm text-muted-foreground font-sans">Searching places…</p>
      <p v-if="showList" class="border-t border-border px-3.5 py-1.5 text-right text-meta text-muted-foreground font-sans">powered by Google</p>
    </div>
    <span class="sr-only" role="status" aria-live="polite">{{ status }}</span>
  </div>
</template>
