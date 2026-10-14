<script setup lang="ts">
/**
 * What else is on the days an organizer is picking: events in the same city,
 * and festivals elsewhere in the country. Shown under "When" in the event
 * editor, so the date is chosen knowing the competition.
 *
 *   <BusinessSameDays :city="form.city" :from="form.date" :to="form.endDate" :except-id="eventId" />
 */
import type { PropType } from 'vue'
import { CalendarSearch } from 'lucide-vue-next'

const props = defineProps({
  city: { type: String, default: '' },
  from: { type: String, default: '' },
  to: { type: String, default: '' },
  exceptId: { type: String, default: undefined },
  /** The event's own music: the style filter starts on these. */
  styles: { type: Array as PropType<string[]>, default: () => [] },
})

const { $trpc } = useNuxtApp()
type Result = Awaited<ReturnType<typeof $trpc.events.sameDays.query>>
const data = ref<Result | null>(null)
const loading = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
watch(() => [props.city, props.from, props.to], () => {
  clearTimeout(timer)
  if (!props.city || !props.from) { data.value = null; return }
  timer = setTimeout(async () => {
    const n = ++seq
    loading.value = true
    try {
      const r = await $trpc.events.sameDays.query({ city: props.city, from: props.from, to: props.to || undefined, exceptId: props.exceptId })
      if (n === seq) data.value = r
    } catch { if (n === seq) data.value = null } finally { if (n === seq) loading.value = false }
  }, 300)
}, { immediate: true })

// Style filter: the styles on those days, most common first. It starts on the
// event's own music (once it's set) until the organizer picks for themselves.
const all = computed(() => [...(data.value?.inCity ?? []), ...(data.value?.festivals ?? [])])
const styleCounts = computed(() => {
  const n = new Map<string, number>()
  for (const e of all.value) for (const st of e.styles ?? []) n.set(st, (n.get(st) ?? 0) + 1)
  return [...n.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
})
const picked = ref<string[]>([])
const touched = ref(false)
watch(() => props.styles, (v) => { if (!touched.value) picked.value = [...v] }, { immediate: true, deep: true })
function toggleStyle(st: string) {
  touched.value = true
  picked.value = picked.value.includes(st) ? picked.value.filter(x => x !== st) : [...picked.value, st]
}
function clearStyles() { touched.value = true; picked.value = [] }
const matches = (e: any) => !picked.value.length || (e.styles ?? []).some((st: string) => picked.value.includes(st))
// Picked styles nobody else dances those days still show, so they can be unpicked.
const chips = computed(() => [
  ...styleCounts.value,
  ...picked.value.filter(st => !styleCounts.value.some(([x]) => x === st)).map(st => [st, 0] as [string, number]),
])

// Classes rarely compete with a night out: they fold away under the rest.
const isClass = (e: any) => ['Workshop', 'Course'].includes(e.type)
const inCity = computed(() => (data.value?.inCity ?? []).filter(matches))
const nights = computed(() => inCity.value.filter(e => !isClass(e)))
const classes = computed(() => inCity.value.filter(isClass))
const festivals = computed(() => (data.value?.festivals ?? []).filter(matches))
const manyDays = computed(() => !!props.to && props.to > props.from)
</script>

<template>
  <div class="min-w-0 rounded-xl bg-muted/50 p-3">
    <p class="flex items-center gap-1.5 text-sm font-bold"><CalendarSearch class="size-4 text-muted-foreground" aria-hidden="true" /> Also on these days</p>
    <p v-if="!from" class="mt-1 text-xs text-muted-foreground">Pick a date to see what else is on.</p>
    <p v-else-if="!city" class="mt-1 text-xs text-muted-foreground">Set the city under “Where” to see what else is on.</p>
    <p v-else-if="loading && !data" class="mt-1 text-xs text-muted-foreground">Looking…</p>
    <template v-else-if="data">
      <div v-if="chips.length" class="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Filter by dance style">
        <Button type="button" size="sm" :variant="picked.length ? 'outline' : 'soft'" :aria-pressed="!picked.length" @click="clearStyles">All styles</Button>
        <Button
          v-for="[st, n] in chips"
          :key="st"
          type="button"
          size="sm"
          :variant="picked.includes(st) ? 'soft' : 'outline'"
          :aria-pressed="picked.includes(st)"
          @click="toggleStyle(st)"
        >{{ st }} <span class="tabular-nums text-muted-foreground">{{ n }}</span></Button>
      </div>
      <p class="mt-2 text-xs text-muted-foreground" aria-live="polite">
        {{ inCity.length ? `${inCity.length} other event${inCity.length === 1 ? '' : 's'} in ${data.city}` : `Nothing else in ${data.city} on WeDance` }}{{ picked.length ? ` with ${picked.join(' or ')}` : '' }}<template v-if="festivals.length"> · {{ festivals.length }} festival{{ festivals.length === 1 ? '' : 's' }} elsewhere in {{ data.country }}</template>.
      </p>
      <BusinessSameDaysList v-if="nights.length" :events="nights" :many-days="manyDays" class="mt-3" />
      <details v-if="classes.length" class="mt-3">
        <summary class="cursor-pointer text-xs font-bold text-secondary">{{ classes.length }} class{{ classes.length === 1 ? '' : 'es' }} and workshop{{ classes.length === 1 ? '' : 's' }}</summary>
        <BusinessSameDaysList :events="classes" :many-days="manyDays" class="mt-2" />
      </details>
      <template v-if="festivals.length">
        <p class="mt-4 text-xs font-bold uppercase tracking-wider text-secondary">Festivals elsewhere in {{ data.country }}</p>
        <BusinessSameDaysList :events="festivals" with-city class="mt-2" />
      </template>
    </template>
  </div>
</template>
