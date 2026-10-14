<script setup lang="ts">
/**
 * WeeklyCalendar — chronological per-day list, V3 tropical style.
 * Replaces the old shadcn time-x-venue table: same data, easier to scan
 * on mobile, aligned with the cream + Playfair Display + Caveat
 * language used on /, /festivals, /cities, /my-plan.
 */
import { CalendarDays, Flame, MapPin, Plus, Check, Users } from 'lucide-vue-next'
import type { CityEvent, DayOfWeek } from '~/types/city'
import type { Teacher } from '~/types/festival'
import { getStyleColors } from '~/lib/style-colors'
import { Button } from '~/components/ui/button'
import { WD } from '~/lib/brand'
import { mixHex, readableOn } from '~/lib/contrast'
import { eventPath } from '#shared/utils/eventSlug'

const props = defineProps<{
  events: CityEvent[]
  weekPlanIds: ReadonlySet<string>
  teachers?: Teacher[]
  /** A filter (style, person) is narrowing the list — the empty state then offers "Clear filters". */
  filtered?: boolean
}>()

const emit = defineEmits<{
  toggle: [id: string]
  'select-teacher': [id: string]
  'clear-filters': []
}>()

// Accent text on its own '18' tint (chips) or on white, darkened just enough for 4.5:1.
const chipInk = (c: string) => readableOn(c, mixHex(c, '#fff', 0.094))
const ink = (c: string) => readableOn(c)

const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

// Day labels: e.g. "Monday, Jan 8" for the current week.
const dayLabels = computed(() => {
  const now = new Date()
  const currentDay = now.getDay()
  const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay
  const monday = new Date(now)
  monday.setDate(now.getDate() + mondayOffset)

  const map: Record<string, string> = {}
  days.forEach((day, i) => {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    map[day] = `${day}, ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  })
  return map
})

const peopleMap = computed(() => {
  const map = new Map<string, Teacher>()
  for (const t of props.teachers ?? []) map.set(t.id, t)
  return map
})

function personFor(event: CityEvent): { person: Teacher; id: string } | undefined {
  const id = event.teacherId ?? event.djId ?? event.organizerId
  if (!id) return undefined
  const person = peopleMap.value.get(id)
  return person ? { person, id } : undefined
}

const daysWithEvents = computed(() =>
  days.filter(day => props.events.some(e => e.day === day)),
)

function eventsForDay(day: DayOfWeek) {
  return props.events
    .filter(e => e.day === day)
    .sort((a, b) => a.time.localeCompare(b.time))
}

function levelChilis(level?: string): number {
  if (level === 'Beginner') return 1
  if (level === 'Intermediate') return 2
  if (level === 'Advanced') return 3
  return 0
}

// Type accent — warm, not shadcn palette
type EventType = 'class' | 'social' | 'practica' | 'workshop'
const typeStyle: Record<EventType, { label: string; color: string }> = {
  class:    { label: 'Class',    color: WD.cyan600 },
  social:   { label: 'Social',   color: WD.red600 },
  practica: { label: 'Practica', color: WD.amber500 },
  workshop: { label: 'Workshop', color: WD.purple500 },
}

// Style accent color — resolved from the shared getStyleColors util.
// Falls back to a warm neutral if the util returns a non-color class.
function styleAccent(style: string): string {
  const c = getStyleColors(style)
  const map: Record<string, string> = {
    salsa:    WD.red600,
    bachata:  WD.purple500,
    kizomba:  WD.pink500,
    timba:    WD.amber500,
    son:      WD.green600,
    rumba:    WD.cyan600,
    'urban kiz': WD.violet600,
    semba:    WD.amber500,
    'hip hop':WD.sky500,
  }
  return map[style.toLowerCase()] || (c as any)?.hex || WD.amber600
}

const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }) as DayOfWeek

// Real events link to their event page; mock weekly events don't link.
const isRealEvent = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}/i.test(String(id))
function eventHref(e: CityEvent): string | undefined {
  if (!isRealEvent(e.id)) return undefined
  // Bookings open by their full id; dated events by /events/<name>-<short id>.
  return (e as any).booking ? `/events/${e.id}` : eventPath(e)
}
</script>

<template>
  <div class="space-y-10">
    <!-- Empty (nothing across the whole week matches filters) -->
    <div
      v-if="!daysWithEvents.length"
      class="text-center py-14 px-6 rounded-2xl border-2 border-dashed border-input bg-white/50"
      aria-live="polite"
    >
      <CalendarDays class="w-8 h-8 mx-auto mb-3 text-secondary" aria-hidden="true" />
      <template v-if="filtered">
        <p class="text-sm text-muted-foreground font-sans">
          No events match your filters this week.
        </p>
        <Button type="button" variant="link" class="mt-1 h-auto p-0 text-xs font-bold underline font-sans" @click="emit('clear-filters')">
          Clear filters
        </Button>
      </template>
      <template v-else>
        <p class="text-sm text-muted-foreground font-sans">
          No events listed here this week yet.
        </p>
        <slot name="empty-action" />
      </template>
    </div>

    <!-- Per-day sections -->
    <div v-for="day in daysWithEvents" :key="day" class="space-y-3">
      <!-- Sticky day header -->
      <div
        class="sticky top-0 z-10 pt-2 pb-3 flex items-baseline gap-3 backdrop-blur-sm border-b border-border bg-background/95"
      >
        <h3
          class="text-xl font-black leading-none font-display"
          :style="{ color: day === today ? WD.red600 : WD.brown900 }"
        >
          {{ dayLabels[day] }}
        </h3>
        <span
          v-if="day === today"
          class="text-eyebrow font-bold uppercase tracking-widest px-2 py-0.5 rounded-full bg-primary/[9.4%] text-wd-red-800 font-sans"
        >
          Tonight
        </span>
      </div>

      <!-- Event rows -->
      <div class="grid grid-cols-1 gap-2">
        <!-- Real events link to their event page. -->
        <!-- Stretched link: the title is the link (its ::after covers the card); the
             person and Going? buttons sit above it — no <button> nested in an <a>. -->
        <div
          v-for="e in eventsForDay(day)"
          :key="e.id"
          class="group relative rounded-xl bg-white p-3 sm:p-4 border transition-all hover:-translate-y-0.5 flex items-center gap-3 sm:gap-4 focus-within:ring-2 focus-within:ring-ring"
          :style="{
            borderColor: styleAccent(e.style) + '55',
            boxShadow: '0 1px 0 ' + styleAccent(e.style) + '18, 0 4px 14px rgba(59,31,18,0.04)',
          }"
        >
          <!-- Time (fixed width, bold) -->
          <div class="w-14 shrink-0 text-center">
            <div
              class="text-lg font-black leading-none tabular-nums"
              :style="{ color: ink(styleAccent(e.style)), fontFamily: 'var(--wd-font-display)' }"
            >
              {{ e.time }}
            </div>
          </div>

          <!-- Middle: type badge, name, venue + teacher -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center flex-wrap gap-2">
              <span
                class="inline-flex items-center text-tag font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                :style="{ background: typeStyle[e.type as EventType]?.color + '18', color: chipInk(typeStyle[e.type as EventType]?.color || WD.brown700) }"
              >
                {{ typeStyle[e.type as EventType]?.label ?? e.type }}
              </span>
              <span
                class="text-eyebrow font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                :style="{ background: styleAccent(e.style) + '18', color: chipInk(styleAccent(e.style)) }"
              >
                {{ e.style }}
              </span>
            </div>
            <h4 class="text-sm sm:text-base font-bold leading-tight mt-1 break-words group-hover:underline text-foreground">
              <NuxtLink v-if="eventHref(e)" :to="eventHref(e)" class="outline-none after:absolute after:inset-0 after:rounded-xl">{{ e.name }}</NuxtLink>
              <template v-else>{{ e.name }}</template>
            </h4>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground font-sans">
              <span class="inline-flex items-center gap-1">
                <MapPin class="w-3 h-3 text-secondary" aria-hidden="true" />
                {{ e.venue }}
              </span>
              <Button
                v-if="personFor(e)"
                type="button"
                variant="link"
                class="relative z-10 h-auto p-0 text-xs font-normal italic whitespace-normal underline-offset-auto hover:underline"
                :style="{ color: ink(styleAccent(e.style)) }"
                @click="emit('select-teacher', personFor(e)!.id)"
              >
                {{ personFor(e)!.person.name }}
              </Button>
              <span
                v-if="levelChilis(e.level) > 0"
                class="inline-flex items-center gap-px"
                :title="e.level"
              >
                <Flame
                  v-for="n in levelChilis(e.level)"
                  :key="n"
                  class="w-3 h-3"
                  :style="{ color: levelChilis(e.level) === 3 ? WD.red600 : levelChilis(e.level) === 2 ? WD.amber500 : WD.amber400 }"
                />
              </span>
              <span
                v-else-if="e.level"
                class="text-eyebrow font-bold uppercase tracking-wider text-secondary"
              >
                {{ e.level }}
              </span>
              <span
                v-if="e.attendeeCount > 0"
                class="inline-flex items-center gap-0.5 text-[10px] font-bold"
                style="color:var(--wd-amber-600);"
              >
                <Users class="w-3 h-3" />
                {{ e.attendeeCount }} going
              </span>
            </div>
          </div>

          <!-- Pick button -->
          <Button
            type="button"
            variant="ghost"
            class="relative z-10 h-auto text-xs font-bold px-3 py-1.5 rounded-full transition-all shrink-0 gap-1 [&_svg]:size-3"
            :aria-pressed="weekPlanIds?.has(e.id) ? 'true' : 'false'"
            :style="weekPlanIds?.has(e.id)
              ? { background: ink(styleAccent(e.style)), color: 'white' }
              : { background: 'white', color: ink(styleAccent(e.style)), border: '1.5px solid ' + styleAccent(e.style) + '55' }"
            @click="emit('toggle', e.id)"
          >
            <component :is="weekPlanIds?.has(e.id) ? Check : Plus" aria-hidden="true" />{{ weekPlanIds?.has(e.id) ? 'Going!' : 'Going?' }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
