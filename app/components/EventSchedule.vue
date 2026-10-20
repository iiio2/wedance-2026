<script setup lang="ts">
/**
 * EventSchedule — a date-sectioned list of dance events with rich cards and a
 * "Pick" (add-to-my-week-plan) button. Shared by the venue profile schedule and
 * the city "What's on" feed so both look the same. Styled after WeeklyCalendar.
 *
 * Each event: { id, title, eventType?, styles?, artists?, eventDate, startTime?,
 * endTime?, status?, location?, href? }.  `location` = area (venue) or venue
 * name (city); `href` links the card (e.g. to the venue's /@handle).
 */
import { MapPin, Plus, Check } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { WD } from '~/lib/brand'
import { mixHex, readableOn } from '~/lib/contrast'

const props = defineProps<{ events: any[] }>()

const { weekPlanIds, toggleEvent } = useWeekPlan()

const typeColor: Record<string, string> = {
  Social: WD.red600, Party: WD.red600, Class: WD.cyan600, Practica: WD.amber500, Workshop: WD.purple500,
  Concert: WD.pink500, Show: WD.violet600,
}
const styleColor: Record<string, string> = {
  salsa: WD.red600, bachata: WD.purple500, kizomba: WD.pink500, timba: WD.amber500,
  casino: WD.green600, rueda: WD.cyan600, afro: WD.violet600, zouk: WD.cyan600, son: WD.green600,
}
const accent = (s: string) => styleColor[String(s).toLowerCase()] || WD.amber600
// Accent text on its own '18' tint (chips) or on white, darkened just enough for 4.5:1.
const chipInk = (c: string) => readableOn(c, mixHex(c, '#fff', 0.094))
const ink = (c: string) => readableOn(c)

const todayIso = new Date().toISOString().slice(0, 10)

// Group by date (ascending), events within a day sorted by start time.
const groups = computed(() => {
  const byDate = new Map<string, any[]>()
  for (const e of props.events ?? []) {
    const d = e.eventDate ? String(e.eventDate).slice(0, 10) : 'TBD'
    if (!byDate.has(d)) byDate.set(d, [])
    byDate.get(d)!.push(e)
  }
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, evs]) => ({
      date,
      label: date === 'TBD' ? 'Date TBD' : new Date(date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      isToday: date === todayIso,
      events: evs.sort((a, b) => String(a.startTime ?? '').localeCompare(String(b.startTime ?? ''))),
    }))
})
</script>

<template>
  <div class="space-y-6">
    <div v-for="g in groups" :key="g.date" class="space-y-2">
      <!-- Day header -->
      <div class="flex items-baseline gap-2 pt-1">
        <h4 class="text-lg font-black leading-none font-display" :style="{ color: g.isToday ? WD.red600 : WD.brown900 }">{{ g.label }}</h4>
        <span v-if="g.isToday" class="text-tag font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/[9.4%] text-wd-red-800 font-sans">Tonight</span>
      </div>

      <!-- Cards — stretched link: the title is the link (its ::after covers the card),
           the Going? button sits above it, so no <button> is nested in an <a>. -->
      <div
        v-for="e in g.events"
        :key="e.id"
        class="group relative rounded-xl bg-white p-3 sm:p-4 border transition-all hover:-translate-y-0.5 flex items-center gap-3 sm:gap-4 focus-within:ring-2 focus-within:ring-ring"
        :style="{ borderColor: accent(e.styles?.[0] || '') + '55', boxShadow: '0 1px 0 ' + accent(e.styles?.[0] || '') + '18, 0 4px 14px rgba(59,31,18,0.04)' }"
      >
        <!-- Time -->
        <div class="w-14 shrink-0 text-center">
          <div class="text-base font-black leading-none tabular-nums" :style="{ color: ink(accent(e.styles?.[0] || '')), fontFamily: 'var(--wd-font-display)' }">{{ e.startTime || '—' }}</div>
          <div v-if="e.endTime" class="text-eyebrow mt-0.5 text-secondary font-sans">{{ e.endTime }}</div>
        </div>

        <!-- Middle -->
        <div class="flex-1 min-w-0 font-sans">
          <div class="flex items-center flex-wrap gap-1.5">
            <span v-if="e.eventType" class="text-tag font-black uppercase tracking-widest px-1.5 py-0.5 rounded" :style="{ background: (typeColor[e.eventType] || WD.brown700) + '18', color: chipInk(typeColor[e.eventType] || WD.brown700) }">{{ e.eventType }}</span>
            <DanceStyleChips :styles="e.styles || []" />
            <span v-if="e.status && e.status !== 'accepted'" class="text-tag uppercase tracking-wider font-bold rounded-full px-1.5 py-0.5 bg-warning/[9.4%] text-wd-amber-700">Proposed</span>
          </div>
          <h4 class="text-sm sm:text-base font-bold leading-tight mt-1 text-foreground">
            <NuxtLink v-if="e.href" :to="e.href" class="outline-none after:absolute after:inset-0 after:rounded-xl">{{ e.title || 'Social' }}</NuxtLink>
            <template v-else>{{ e.title || 'Social' }}</template>
          </h4>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
            <span v-if="e.location" class="inline-flex items-center gap-1"><MapPin class="w-3 h-3 text-secondary" aria-hidden="true" /> {{ e.location }}</span>
            <span v-if="e.artists?.length" class="text-secondary">with {{ e.artists.join(', ') }}</span>
          </div>
        </div>

        <!-- Pick (add to my week plan) -->
        <Button
          type="button"
          variant="ghost"
          class="relative z-10 h-auto text-xs font-bold px-3 py-1.5 rounded-full transition-all shrink-0 gap-1 [&_svg]:size-3"
          :aria-pressed="weekPlanIds?.has(e.id) ? 'true' : 'false'"
          :style="weekPlanIds?.has(e.id) ? { background: ink(accent(e.styles?.[0] || '')), color: 'white' } : { background: 'white', color: ink(accent(e.styles?.[0] || '')), border: '1.5px solid ' + accent(e.styles?.[0] || '') + '55' }"
          @click="toggleEvent(e.id, { event_type: e.eventType ?? null, city: e.citySlug ?? null, surface: 'schedule' })"
        >
          <component :is="weekPlanIds?.has(e.id) ? Check : Plus" aria-hidden="true" />{{ weekPlanIds?.has(e.id) ? 'Going!' : 'Going?' }}
        </Button>
      </div>
    </div>
  </div>
</template>
