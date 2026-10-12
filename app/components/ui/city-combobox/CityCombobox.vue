<script setup lang="ts">
import type { HTMLAttributes, PropType } from "vue"
import type { ControlVariants } from "@/components/ui/input"
import type { CityOption } from "#shared/utils/citySearch"
import { MapPin } from "lucide-vue-next"
import { cn } from "@/lib/utils"
import { controlAria, FIELD_KEY } from "@/lib/field"
import { controlVariants } from "@/components/ui/input"
import { matchRange, searchCities } from "#shared/utils/citySearch"

/**
 * City typeahead — ARIA 1.2 combobox (list autocomplete, no auto-select).
 *
 * The value is the city NAME as a plain string, the same shape dancers.city /
 * profiles.city store. Free text is allowed by default: suggestions help people
 * spell a known city, they never block someone in a city we don't list yet.
 * Suggestions come from /api/city-options (WeDance's own cities + the
 * illustrated-city catalogue), loaded once on first focus and filtered locally.
 */
// Runtime props on purpose — see ui/button/Button.vue.
defineOptions({ inheritAttrs: false })

const props = defineProps({
  placeholder: { type: String, default: "Search a city" },
  size: { type: String as PropType<ControlVariants["size"]>, default: undefined },
  invalid: { type: Boolean, default: false },
  /** Keep whatever is typed as the value (default). false = only a picked suggestion counts; typing something else reverts on blur. */
  allowCustom: { type: Boolean, default: true },
  /** Say "we'll save it as you typed it" when nothing matches. Turn off when free text filters rather than saves (search boxes). */
  freeTextNote: { type: Boolean, default: true },
  /** Show the biggest communities when the field is focused but empty. */
  showPopular: { type: Boolean, default: true },
  /** Max suggestions shown. */
  limit: { type: Number, default: 8 },
  /** Debounce (ms) between typing and re-filtering. */
  debounce: { type: Number, default: 120 },
  /** Supply your own list instead of /api/city-options (docs, tests, scoped lists). */
  options: { type: Array as PropType<CityOption[]>, default: undefined },
  class: { type: [String, Array, Object] as PropType<HTMLAttributes["class"]>, default: undefined },
})

const emit = defineEmits<{
  /** A suggestion was picked (click, Enter). Carries slug + country for navigation or extra fields. */
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
const source = computed(() => props.options ?? (remote.options.value as CityOption[]))
const loading = computed(() => !props.options && remote.status.value === "loading")

const text = ref(model.value ?? "")
const query = ref("")
const open = ref(false)
const active = ref(-1)
const inputEl = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLUListElement | null>(null)

watch(model, (v) => { if ((v ?? "") !== text.value) text.value = v ?? "" })

let timer: ReturnType<typeof setTimeout> | undefined
function setQuery(v: string, now = false) {
  clearTimeout(timer)
  if (now || !props.debounce) query.value = v
  else timer = setTimeout(() => { query.value = v }, props.debounce)
}
onBeforeUnmount(() => clearTimeout(timer))

const results = computed(() => {
  if (!query.value.trim() && !props.showPopular) return []
  return searchCities(source.value, query.value, props.limit)
})
const popular = computed(() => !query.value.trim())
const exact = computed(() => results.value.some(r => r.name.toLowerCase() === text.value.trim().toLowerCase()))
const noMatch = computed(() => open.value && !loading.value && !!query.value.trim() && results.value.length === 0)
// A search box (free text, no save note) has its own "no results" on the page — keep the popup closed.
const showEmpty = computed(() => noMatch.value && !(props.allowCustom && !props.freeTextNote))
const showList = computed(() => open.value && results.value.length > 0)

watch(results, () => { active.value = -1 })
watch(active, (i) => {
  if (i < 0) return
  nextTick(() => document.getElementById(optionId(i))?.scrollIntoView({ block: "nearest" }))
})

function openList() {
  if (aria.value.disabled) return
  if (!props.options) remote.load()
  open.value = true
}
function close() {
  open.value = false
  active.value = -1
}

function onInput(e: Event) {
  const v = (e.target as HTMLInputElement).value
  text.value = v
  if (props.allowCustom) model.value = v
  setQuery(v)
  openList()
}

function pick(city: CityOption) {
  text.value = city.name
  model.value = city.name
  setQuery(city.name, true)
  emit("select", city)
  close()
  inputEl.value?.focus()
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
        setQuery("", true)
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
  if (!props.allowCustom && text.value !== (model.value ?? "")) {
    text.value = model.value ?? ""
    setQuery(text.value, true)
  }
}

/** [before, match, after] for the highlight. */
function parts(name: string): [string, string, string] {
  const r = matchRange(name, query.value)
  if (!r) return [name, "", ""]
  return [name.slice(0, r[0]), name.slice(r[0], r[1]), name.slice(r[1])]
}

const status = computed(() => {
  if (!open.value) return ""
  if (loading.value) return "Loading cities…"
  if (noMatch.value) return props.allowCustom && props.freeTextNote ? `No city found. “${text.value.trim()}” will be used as typed.` : "No city found."
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
      v-show="showList || showEmpty || (open && loading)"
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
          :key="c.slug"
          role="option"
          :aria-selected="i === active ? 'true' : 'false'"
          :data-active="i === active ? '' : undefined"
          class="flex cursor-pointer items-center gap-2.5 px-3.5 py-2.5 text-sm font-sans text-foreground data-[active]:bg-accent data-[active]:text-accent-foreground hover:bg-muted"
          @mousedown.prevent
          @click="pick(c)"
          @mousemove="active = i"
        >
          <MapPin class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate">
            <template v-for="(p, j) in [parts(c.name)]" :key="j">{{ p[0] }}<mark class="bg-transparent font-bold text-inherit">{{ p[1] }}</mark>{{ p[2] }}</template>
          </span>
          <span v-if="c.country" class="shrink-0 text-xs text-muted-foreground">{{ c.country }}</span>
        </li>
      </ul>
      <p v-if="open && loading && !results.length" class="px-3.5 py-3 text-sm text-muted-foreground font-sans">
        Loading cities…
      </p>
      <p v-else-if="showEmpty" class="px-3.5 py-3 text-sm text-muted-foreground font-sans" data-slot="city-combobox-empty">
        No city found<template v-if="allowCustom && freeTextNote"> — we'll save <strong class="text-foreground">“{{ text.trim() }}”</strong> as you typed it</template>.
      </p>
      <p v-else-if="showList && allowCustom && freeTextNote && !popular && !exact && text.trim()" class="border-t border-border px-3.5 py-2 text-xs text-muted-foreground font-sans">
        Not listed? Keep typing — we'll save it as written.
      </p>
    </div>

    <span class="sr-only" role="status" aria-live="polite">{{ status }}</span>
  </div>
</template>
