<script setup lang="ts">
/**
 * Events as a short programme: those running over several days first, then a
 * heading per day; each row is the time, the name, and venue · organizer ·
 * styles on a second line. Used by BusinessSameDays.
 *
 *   <BusinessSameDaysList :events="nights" :many-days="true" />
 */
import type { PropType } from 'vue'
import { eventPath } from '#shared/utils/eventSlug'
import { eventLocalDate, eventLocalTime } from '#shared/utils/eventTime'

const props = defineProps({
  events: { type: Array as PropType<any[]>, required: true },
  /** The organizer picked several days: show a heading per day. */
  manyDays: { type: Boolean, default: false },
  /** Name the city on each row (festivals elsewhere in the country). */
  withCity: { type: Boolean, default: false },
})

const tzOf = (e: any) => e.timezone || 'Europe/Berlin'
const part = (iso: string, tz: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-GB', { ...o, timeZone: tz })
const dayKey = (e: any) => eventLocalDate(e.startDate, tzOf(e))
const isMulti = (e: any) => !!e.endDate && eventLocalDate(e.endDate, tzOf(e)) !== dayKey(e)
  && (e.isFestival || ['Festival', 'Weekender', 'Congress'].includes(e.type))
/** "16 – 18 Oct" in one month, else "30 Oct – 1 Nov". */
const range = (e: any) => {
  const sameMonth = part(e.startDate, tzOf(e), { month: 'short' }) === part(e.endDate, tzOf(e), { month: 'short' })
  return `${part(e.startDate, tzOf(e), sameMonth ? { day: 'numeric' } : { day: 'numeric', month: 'short' })} – ${part(e.endDate, tzOf(e), { day: 'numeric', month: 'short' })}`
}
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const details = (e: any) => [
  props.withCity ? e.city : '',
  e.venueName,
  e.organizerName && e.organizerName !== e.venueName ? e.organizerName : '',
  e.styles?.length ? e.styles.slice(0, 3).join(', ') : '',
].filter(Boolean).join(' · ')

const groups = computed(() => {
  const out: { label: string; items: { e: any; when: string }[] }[] = []
  const multi = props.events.filter(isMulti)
  if (multi.length) out.push({ label: 'Over several days', items: multi.map(e => ({ e, when: range(e) })) })
  const days = new Map<string, any[]>()
  for (const e of props.events.filter(e => !isMulti(e))) days.set(dayKey(e), [...(days.get(dayKey(e)) ?? []), e])
  for (const [d, items] of [...days.entries()].sort(([a], [b]) => a.localeCompare(b)))
    out.push({ label: fmtDay(d), items: items.map(e => ({ e, when: eventLocalTime(e.startDate, tzOf(e)) })) })
  return out
})
// One day picked and nothing over several days: the heading would only repeat the date.
const showHeadings = computed(() => props.manyDays || groups.value.length > 1)
</script>

<template>
  <div class="grid grid-cols-1 gap-3">
    <div v-for="g in groups" :key="g.label">
      <p v-if="showHeadings" class="mb-1.5 text-xs font-bold text-muted-foreground">{{ g.label }}</p>
      <ul class="grid grid-cols-1 gap-2">
        <li v-for="{ e, when } in g.items" :key="e.id" class="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 text-sm">
          <span class="whitespace-nowrap tabular-nums text-muted-foreground">{{ when }}</span>
          <span>
            <NuxtLink :to="eventPath(e)" target="_blank" class="font-bold leading-snug hover:underline">{{ e.name }}</NuxtLink>
            <span v-if="details(e)" class="block text-xs text-muted-foreground">{{ details(e) }}</span>
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
