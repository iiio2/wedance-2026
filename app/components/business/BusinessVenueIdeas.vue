<script setup lang="ts">
/**
 * Venues to consider for the chosen days, under "Where" in the event editor:
 * who hosts nights in the city (and which music), whether they already have a
 * night on those days, whether they host on that weekday, and whether someone
 * runs their page on WeDance. Picking one sets the event's venue.
 *
 *   <BusinessVenueIdeas v-model="form.venueUsername" :city="form.city" :from="form.date" :to="form.endDate" :styles="form.styles" :except-id="eventId" />
 */
import type { PropType } from 'vue'
import { Building2, Check, Send } from 'lucide-vue-next'
import { venueTypeLabel } from '#shared/types/venueDetails'

const model = defineModel<string | null>({ default: null })
const props = defineProps({
  city: { type: String, default: '' },
  from: { type: String, default: '' },
  to: { type: String, default: '' },
  styles: { type: Array as PropType<string[]>, default: () => [] },
  exceptId: { type: String, default: undefined },
  /** Venues already asked (username → their answer), from BusinessVenueAsks. */
  asked: { type: Object as PropType<Record<string, string>>, default: () => ({}) },
  /** Asking needs the saved event. */
  canAsk: { type: Boolean, default: false },
})
const emit = defineEmits<{ pick: [venue: { username: string; name: string }]; ask: [venue: { username: string; name: string }] }>()
const ASKED: Record<string, string> = { invited: 'Asked · waiting', confirmed: 'Asked · can host it', proposed: 'Asked · another date', declined: 'Asked · can’t', booked: 'Booked', elsewhere: 'Asked' }

const { $trpc } = useNuxtApp()
type Result = Awaited<ReturnType<typeof $trpc.businessEvents.venueIdeas.query>>
const data = ref<Result | null>(null)
const loading = ref(false)
const limit = ref(5)
let timer: ReturnType<typeof setTimeout> | undefined
let seq = 0
watch(() => [props.city, props.from, props.to, props.styles.join('|'), limit.value], () => {
  clearTimeout(timer)
  if (!props.city || !props.from) { data.value = null; return }
  timer = setTimeout(async () => {
    const n = ++seq
    loading.value = true
    try {
      const r = await $trpc.businessEvents.venueIdeas.query({ city: props.city, from: props.from, to: props.to || undefined, styles: props.styles, exceptId: props.exceptId, limit: limit.value })
      if (n === seq) data.value = r
    } catch { if (n === seq) data.value = null } finally { if (n === seq) loading.value = false }
  }, 300)
}, { immediate: true })

const days = computed(() => {
  const w = data.value?.weekdays ?? []
  return w.length === 1 ? `${w[0]}s` : w.length ? 'those days' : ''
})
const dayLabel = computed(() => {
  if (!props.from) return ''
  const f = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
  return props.to && props.to > props.from ? `${f(props.from)} – ${f(props.to)}` : f(props.from)
})
const history = (v: any) => {
  if (v.nights) return `${v.nights} night${v.nights === 1 ? '' : 's'} on WeDance this year${v.nightStyles.length ? ` · ${v.nightStyles.slice(0, 4).join(', ')}` : ''}`
  if (v.classes) return `${v.classes} classes this year, no nights yet`
  return ''
}
function pick(v: any) {
  model.value = v.username
  emit('pick', { username: v.username, name: v.name })
}
</script>

<template>
  <div class="min-w-0 rounded-xl bg-muted/50 p-3">
    <p class="flex items-center gap-1.5 text-sm font-bold"><Building2 class="size-4 text-muted-foreground" aria-hidden="true" /> Venues to consider</p>
    <p v-if="!from" class="mt-1 text-xs text-muted-foreground">Pick a date under “When” to see which venues fit.</p>
    <p v-else-if="!city" class="mt-1 text-xs text-muted-foreground">Pick the city to see which venues fit.</p>
    <p v-else-if="loading && !data" class="mt-1 text-xs text-muted-foreground">Looking…</p>
    <template v-else-if="data">
      <p class="mt-1 text-xs text-muted-foreground">
        For {{ dayLabel }}, from what’s on WeDance: who hosts nights in {{ data.city }}{{ styles.length ? ` with ${styles.join(', ')}` : '' }}, and who already has one then. <template v-if="canAsk">Ask a few: they answer with their terms.</template><template v-else>Save the event to ask them.</template>
      </p>
      <p v-if="!data.venues.length" class="mt-2 text-sm text-muted-foreground">No venues in {{ data.city }} on WeDance yet.</p>
      <ul class="mt-3 grid grid-cols-1 gap-2">
        <li v-for="v in data.venues" :key="v.username" class="flex min-w-0 gap-3 rounded-xl border bg-card p-2.5" :class="model === v.username ? 'border-primary' : ''">
          <img v-if="v.photo" :src="v.photo" alt="" class="size-12 shrink-0 rounded-lg object-cover">
          <div v-else class="grid size-12 shrink-0 place-items-center rounded-lg bg-muted"><Building2 class="size-5 text-muted-foreground" aria-hidden="true" /></div>
          <div class="min-w-0 flex-1 text-sm">
            <p class="font-bold leading-snug">
              <NuxtLink :to="`/@${v.username}`" target="_blank" class="hover:underline">{{ v.name }}</NuxtLink>
            </p>
            <p v-if="v.address" class="text-xs text-muted-foreground">{{ v.address }}</p>
            <p v-if="history(v)" class="text-xs text-muted-foreground">{{ history(v) }}</p>
            <ul class="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
              <li v-if="v.busy.length" class="font-bold text-destructive">Has a night then: {{ v.busy.map(b => `${b.name} ${b.time}`).join(' · ') }}</li>
              <li v-else class="font-bold text-secondary">Nothing listed then</li>
              <li v-if="v.weekdayNights && !v.busy.length">Hosts on {{ days }}</li>
              <li v-if="v.classesThen && !v.busy.length" class="text-muted-foreground">{{ v.classesThen }} class{{ v.classesThen === 1 ? '' : 'es' }} that day</li>
              <li v-if="v.managed">Runs its page on WeDance</li>
              <li v-if="v.spaces.length">{{ v.spaces.length }} space{{ v.spaces.length === 1 ? '' : 's' }} to book{{ v.spaces.some((s: any) => s.capacity) ? ` · up to ${Math.max(...v.spaces.map((s: any) => s.capacity || 0))} people` : '' }}</li>
              <li v-if="v.venueType && v.venueType !== 'Other'" class="text-muted-foreground">{{ venueTypeLabel(v.venueType) }}</li>
              <li v-if="v.capacity" class="text-muted-foreground">Holds {{ v.capacity }}</li>
              <li v-if="v.floorType" class="text-muted-foreground">{{ v.floorType }} floor</li>
              <li v-if="asked[v.username]" class="font-bold">{{ ASKED[asked[v.username]!] }}</li>
            </ul>
          </div>
          <div class="flex shrink-0 flex-col items-stretch justify-center gap-1.5">
            <Button type="button" size="sm" :variant="model === v.username ? 'soft' : 'outline'" :aria-pressed="model === v.username" @click="pick(v)">
              <template v-if="model === v.username"><Check /> Picked</template><template v-else>Pick</template>
            </Button>
            <Button v-if="!asked[v.username]" type="button" size="sm" variant="ghost" :disabled="!canAsk" :title="canAsk ? undefined : 'Save the event first'" @click="emit('ask', { username: v.username, name: v.name })"><Send /> Ask</Button>
          </div>
        </li>
      </ul>
      <Button v-if="data.total > data.venues.length" type="button" variant="ghost" size="sm" class="mt-2" :loading="loading" @click="limit += 10">Show more ({{ data.total - data.venues.length }})</Button>
    </template>
  </div>
</template>
