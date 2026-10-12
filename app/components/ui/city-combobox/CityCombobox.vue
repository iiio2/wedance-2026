<script setup lang="ts">
import type { HTMLAttributes, PropType } from "vue"
import type { ControlVariants } from "@/components/ui/input"
import type { CityOption } from "#shared/utils/citySearch"
import { MapPin, Plus } from "lucide-vue-next"
import { cn } from "@/lib/utils"
import { controlAria, FIELD_KEY } from "@/lib/field"
import { controlVariants } from "@/components/ui/input"
import { cityKey, matchRange, mergeCityResults, needsResolve, normalizeCity, searchCities } from "#shared/utils/citySearch"

/**
 * City typeahead — ARIA 1.2 combobox (list autocomplete, no auto-select).
 *
 * The value is always a canonical city: one of our `cities` rows, or a Google
 * Places city that is added to `cities` the moment it is picked. Typing alone
 * never sets the value — "München", "Мюнхен", "Munique" and "munich" all save
 * as "Munich". v-model is the canonical English NAME (the shape the free-text
 * city columns still store); @select hands over the full city ({ id, slug,
 * name, country, placeId, … }) for callers that store the id or slug.
 *
 * Known cities come from /api/city-options (fetched once on first focus,
 * filtered locally — no request per keystroke). Only when that list has fewer
 * than 3 matches does the field ask /api/city-search (→ Google Places, debounced,
 * 2+ letters, one billed session per typing session).
 */
// Runtime props on purpose — see ui/button/Button.vue.
defineOptions({ inheritAttrs: false })

const props = defineProps({
  placeholder: { type: String, default: "Search a city" },
  size: { type: String as PropType<ControlVariants["size"]>, default: undefined },
  invalid: { type: Boolean, default: false },
  /**
   * Search-box mode: the typed text IS the value (the /cities directory filter).
   * Never use it for a field that is saved — saved cities must be canonical.
   */
  freeText: { type: Boolean, default: false },
  /** Show the biggest communities when the field is focused but empty. */
  showPopular: { type: Boolean, default: true },
  /** Max suggestions shown. */
  limit: { type: Number, default: 8 },
  /** Debounce (ms) before asking the server/Google. Never below 250. */
  debounce: { type: Number, default: 300 },
  /** Supply your own list instead of /api/city-options (docs, tests, scoped lists). Disables the Google search. */
  options: { type: Array as PropType<CityOption[]>, default: undefined },
  class: { type: [String, Array, Object] as PropType<HTMLAttributes["class"]>, default: undefined },
})

const emit = defineEmits<{
  /** A city was picked (click, Enter) — already canonical (resolved through Google if it was new). */
  select: [city: CityOption]
}>()

const model = defineModel({ type: String as PropType<string | null | undefined>, default: "" })

const attrs = useAttrs()
const field = inject(FIELD_KEY, null)
const aria = computed(() => controlAria({ ...attrs, invalid: props.invalid }, field?.value))

const uid = useId()
const inputId = computed(() => aria.value.id || `city-${uid}`)
const listId = computed(() => `${inputId.value}-listbox`)
const optionId = (i: number) => `${inputId.value}-opt-${i}`

const remote = useCityOptions()
const lookup = useCityLookup()
const useRemote = computed(() => !props.options)
const source = computed(() => props.options ?? (remote.options.value as CityOption[]))
const loading = computed(() => useRemote.value && remote.status.value === "loading")

const text = ref(model.value ?? "")
const query = ref("")
const open = ref(false)
const active = ref(-1)
const inputEl = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLUListElement | null>(null)

// Server/Google results for `remoteFor` (the folded query they answer).
const remoteResults = ref<CityOption[]>([])
const remoteFor = ref("")
const searching = ref(false)
const resolving = ref<string | null>(null)
const error = ref("")

watch(model, (v) => { if ((v ?? "") !== text.value) text.value = v ?? "" })

const local = computed(() => {
  if (!query.value.trim() && !props.showPopular) return []
  return searchCities(source.value, query.value, props.limit)
})
const results = computed(() => {
  const q = normalizeCity(query.value)
  if (q && remoteFor.value === q && remoteResults.value.length) return mergeCityResults([local.value, remoteResults.value], props.limit)
  return local.value
})
const hasGoogle = computed(() => results.value.some(r => r.source === "google"))
const popular = computed(() => !query.value.trim())
const pending = computed(() => searching.value && !results.value.length)
const noMatch = computed(() => open.value && !loading.value && !pending.value && !!query.value.trim() && results.value.length === 0)
// A search box has its own "no results" on the page — keep the popup closed there.
const showEmpty = computed(() => (noMatch.value || !!error.value) && !props.freeText)
const showList = computed(() => open.value && results.value.length > 0)

let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
function scheduleRemote() {
  clearTimeout(timer)
  const q = normalizeCity(query.value)
  if (!useRemote.value || props.freeText || q.length < 2 || local.value.length >= 3 || remoteFor.value === q) {
    searching.value = false
    return
  }
  searching.value = true
  const raw = query.value.trim()
  const mine = ++seq
  timer = setTimeout(async () => {
    try {
      const res = await lookup.search(raw, props.limit)
      if (mine !== seq) return
      remoteResults.value = res.results
      remoteFor.value = q
    }
    catch { if (mine === seq) { remoteResults.value = []; remoteFor.value = q } }
    finally { if (mine === seq) searching.value = false }
  }, Math.max(250, props.debounce))
}
onBeforeUnmount(() => clearTimeout(timer))

watch(results, () => { active.value = -1 })
watch(active, (i) => {
  if (i < 0) return
  nextTick(() => document.getElementById(optionId(i))?.scrollIntoView({ block: "nearest" }))
})

function openList() {
  if (aria.value.disabled) return
  if (useRemote.value) remote.load()
  open.value = true
}
function close() {
  open.value = false
  active.value = -1
}

function onInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  text.value = v
  error.value = ""
  if (props.freeText) model.value = v
  else if (!v.trim()) model.value = ""
  query.value = v
  openList()
  scheduleRemote()
}

function commit(city: CityOption) {
  text.value = city.name
  model.value = city.name
  query.value = city.name
  emit("select", city)
  close()
  inputEl.value?.focus()
}

async function pick(city: CityOption) {
  if (resolving.value) return
  if (!needsResolve(city)) { commit(city); lookup.endSession(); return }
  resolving.value = cityKey(city)
  error.value = ""
  try {
    const res = await lookup.resolve(city.placeId!, query.value.trim() || undefined)
    remote.remember(res.city)
    commit(res.city)
  }
  catch {
    error.value = `Couldn't add ${city.name} right now. Please try again.`
  }
  finally {
    resolving.value = null
    lookup.endSession()
  }
}

function move(step: number) {
  if (!open.value) { openList(); if (step < 0) active.value = results.value.length - 1; return }
  const n = results.value.length
  if (!n) return
  active.value = active.value < 0 ? (step > 0 ? 0 : n - 1) : (active.value + step + n) % n
}

function onKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault()
      if (e.altKey) { openList(); return }
      move(1)
      break
    case "ArrowUp":
      e.preventDefault()
      if (e.altKey) { close(); return }
      move(-1)
      break
    case "Enter":
      // Only swallow Enter when it picks something; otherwise let the form submit.
      if (open.value && active.value >= 0 && results.value[active.value]) {
        e.preventDefault()
        pick(results.value[active.value]!)
      }
      break
    case "Escape":
      if (open.value) { e.preventDefault(); close() }
      else if (text.value) {
        e.preventDefault()
        text.value = ""
        model.value = ""
        query.value = ""
      }
      break
    case "Home":
    case "End":
      // Keep caret movement in the text box (ARIA 1.2 editable combobox).
      break
    case "Tab":
      close()
      break
  }
}

function onBlur() {
  close()
  // Typed-but-not-picked text is not a city: put the saved value back.
  if (!props.freeText && !resolving.value && text.value !== (model.value ?? "")) {
    text.value = model.value ?? ""
    query.value = text.value
    error.value = ""
  }
}

/** [before, match, after] for the highlight. */
function parts(name: string): [string, string, string] {
  const r = matchRange(name, query.value)
  if (!r) return [name, "", ""]
  return [name.slice(0, r[0]), name.slice(r[0], r[1]), name.slice(r[1])]
}

/** Second line of an option: "Bavaria, Germany" for Google, else the country. */
function detail(c: CityOption) {
  return c.source === "google" ? (c.description || c.country) : c.country
}

const status = computed(() => {
  if (!open.value) return ""
  if (resolving.value) return "Adding the city…"
  if (error.value) return error.value
  if (loading.value || pending.value) return "Searching cities…"
  if (noMatch.value) return "No city found. Check the spelling or try the English name."
  const n = results.value.length
  return n ? `${n} cit${n === 1 ? "y" : "ies"} suggested. Use up and down arrows to choose.` : ""
})
</script>

<template>
  <div class="relative w-full" data-slot="city-combobox">
    <input
      ref="inputEl"
      type="text"
      role="combobox"
      autocomplete="off"
      autocapitalize="words"
      spellcheck="false"
      v-bind="{ ...$attrs, ...aria }"
      :id="inputId"
      :value="text"
      :placeholder="placeholder"
      aria-autocomplete="list"
      :aria-expanded="showList ? 'true' : 'false'"
      :aria-controls="listId"
      :aria-activedescendant="showList && active >= 0 ? optionId(active) : undefined"
      data-slot="input"
      :class="cn(controlVariants({ size }), props.class)"
      @input="onInput"
      @focus="openList"
      @click="openList"
      @blur="onBlur"
      @keydown="onKeydown"
    >

    <div
      v-show="showList || showEmpty || (open && (loading || pending))"
      class="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl text-left border border-border bg-popover text-popover-foreground shadow-wd-float"
      data-slot="city-combobox-popup"
    >
      <p v-if="showList && popular" class="px-3.5 pt-2.5 pb-1 text-meta font-bold uppercase tracking-wider text-muted-foreground">
        Popular on WeDance
      </p>
      <ul
        :id="listId"
        ref="listEl"
        role="listbox"
        :aria-label="popular ? 'Popular cities' : 'City suggestions'"
        class="max-h-64 overflow-y-auto overscroll-contain py-1"
      >
        <li
          v-for="(c, i) in results"
          :id="optionId(i)"
          :key="cityKey(c)"
          role="option"
          :aria-selected="i === active ? 'true' : 'false'"
          :aria-busy="resolving === cityKey(c) ? 'true' : undefined"
          :data-source="c.source"
          :data-active="i === active ? '' : undefined"
          class="flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-sm font-sans text-foreground data-[active]:bg-accent data-[active]:text-accent-foreground hover:bg-muted"
          @mousedown.prevent
          @click="pick(c)"
          @mousemove="active = i"
        >
          <component :is="c.source === 'google' ? Plus : MapPin" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">
            <template v-for="(p, j) in [parts(c.name)]" :key="j">{{ p[0] }}<mark class="bg-transparent font-bold text-inherit">{{ p[1] }}</mark>{{ p[2] }}</template>
          </span>
          <span v-if="resolving === cityKey(c)" class="shrink-0 text-xs text-muted-foreground">Adding…</span>
          <span v-else-if="detail(c)" class="shrink-0 max-w-[45%] truncate text-xs text-muted-foreground">{{ detail(c) }}</span>
        </li>
      </ul>
      <p v-if="open && (loading || pending) && !results.length" class="px-3.5 py-3 text-sm text-muted-foreground font-sans">
        Searching cities…
      </p>
      <p v-else-if="error" class="px-3.5 py-3 text-sm text-destructive font-sans" data-slot="city-combobox-error">
        {{ error }}
      </p>
      <p v-else-if="showEmpty" class="px-3.5 py-3 text-sm text-muted-foreground font-sans" data-slot="city-combobox-empty">
        No city found. Check the spelling or try the English name.
      </p>
      <p v-if="showList && hasGoogle" class="border-t border-border px-3.5 py-1.5 text-right text-meta text-muted-foreground font-sans" data-slot="city-combobox-attribution">
        powered by Google
      </p>
    </div>

    <span class="sr-only" role="status" aria-live="polite">{{ status }}</span>
  </div>
</template>
