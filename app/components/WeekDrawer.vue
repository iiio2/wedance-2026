<script setup lang="ts">
import { X, CalendarDays, Save, Flame, Users } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import type { CityEvent, DayOfWeek } from '~/types/city'
import type { Teacher } from '~/types/festival'

const props = defineProps<{
  events: CityEvent[]
  weekPlanIds: ReadonlySet<string>
  cityName: string
  teachers?: Teacher[]
}>()

const emit = defineEmits<{
  remove: [id: string]
  'sign-in': []
  close: []
}>()

const days: DayOfWeek[] = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const dayShort: Record<DayOfWeek, string> = {
  Monday: 'Mon',
  Tuesday: 'Tue',
  Wednesday: 'Wed',
  Thursday: 'Thu',
  Friday: 'Fri',
  Saturday: 'Sat',
  Sunday: 'Sun',
}

const picked = computed(() =>
  props.events.filter(e => props.weekPlanIds.has(e.id)),
)

const pickedByDay = computed(() => {
  const map: Partial<Record<DayOfWeek, CityEvent[]>> = {}
  for (const event of picked.value) {
    if (!map[event.day]) map[event.day] = []
    map[event.day]!.push(event)
  }
  // Sort each day by time
  for (const day of days) {
    if (map[day]) map[day]!.sort((a, b) => a.time.localeCompare(b.time))
  }
  return map
})

const daysWithEvents = computed(() =>
  days.filter(d => pickedByDay.value[d]?.length),
)

const count = computed(() => props.weekPlanIds.size)

// Stats
const totalHours = computed(() => {
  const mins = picked.value.reduce((sum, e) => sum + e.duration, 0)
  return Math.round(mins / 60)
})

const styles = computed(() => {
  const s = new Set(picked.value.map(e => e.style))
  return Array.from(s)
})

const teacherMap = computed(() => {
  const map = new Map<string, Teacher>()
  for (const t of props.teachers ?? []) map.set(t.id, t)
  return map
})

function personName(event: CityEvent): string | undefined {
  const id = event.teacherId ?? event.djId ?? event.organizerId
  return id ? teacherMap.value.get(id)?.name : undefined
}

function levelChilis(level?: string): number {
  if (level === 'Beginner') return 1
  if (level === 'Intermediate') return 2
  if (level === 'Advanced') return 3
  return 0
}

const typeBadge: Record<string, { label: string; class: string }> = {
  class: { label: 'Class', class: 'bg-blue-100 text-blue-700' },
  social: { label: 'Social', class: 'bg-rose-100 text-rose-700' },
  practica: { label: 'Practica', class: 'bg-amber-100 text-amber-700' },
  workshop: { label: 'Workshop', class: 'bg-purple-100 text-purple-700' },
}
</script>

<template>
  <div class="h-full flex flex-col bg-background">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground">
      <div class="flex items-center gap-2">
        <CalendarDays class="w-4 h-4" />
        <span class="text-sm font-semibold">My Week</span>
        <span v-if="count > 0" class="bg-primary-foreground/20 text-xs font-medium px-1.5 py-0.5 rounded">{{ count }}</span>
      </div>
      <Button variant="ghost" size="icon-sm" class="lg:hidden hover:bg-primary-foreground/10 hover:text-primary-foreground" aria-label="Close my week" @click="emit('close')">
        <X aria-hidden="true" />
      </Button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      <!-- Empty state -->
      <div v-if="count === 0" class="m-4 text-center py-8 px-4 rounded-2xl border-2 border-dashed border-input bg-white/50">
        <CalendarDays class="w-8 h-8 mx-auto mb-3 text-secondary" aria-hidden="true" />
        <p class="text-sm font-bold font-display text-foreground">Build your week</p>
        <p class="text-xs text-muted-foreground mt-1 font-sans">
          Tap “Going?” on classes and socials to plan your dance week in {{ cityName }}.
        </p>
        <Button variant="soft" size="pill-sm" class="mt-3 lg:hidden" @click="emit('close')">
          See this week’s classes
        </Button>
      </div>

      <!-- Picked events by day -->
      <div v-else class="divide-y">
        <div v-for="day in daysWithEvents" :key="day" class="px-4 py-3">
          <h3 class="text-eyebrow font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {{ day }}
          </h3>
          <div class="space-y-2">
            <div
              v-for="event in pickedByDay[day]"
              :key="event.id"
              class="flex items-start justify-between gap-2"
            >
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5">
                  <span class="text-meta font-mono text-muted-foreground">{{ event.time }}</span>
                  <span
                    class="px-1 py-0.5 rounded text-tag font-medium leading-none"
                    :class="typeBadge[event.type]?.class"
                  >
                    {{ typeBadge[event.type]?.label }}
                  </span>
                </div>
                <p class="text-xs font-medium mt-0.5 leading-tight">{{ event.name }}</p>
                <p v-if="personName(event)" class="text-eyebrow text-muted-foreground mt-0.5">{{ personName(event) }}</p>
                <div class="flex items-center gap-1.5 mt-0.5">
                  <span class="text-eyebrow text-muted-foreground">{{ event.venue }}</span>
                  <span v-if="levelChilis(event.level) > 0" class="flex items-center gap-px">
                    <Flame
                      v-for="n in levelChilis(event.level)"
                      :key="n"
                      class="w-2.5 h-2.5"
                      :class="levelChilis(event.level) === 3 ? 'text-red-500' : levelChilis(event.level) === 2 ? 'text-orange-500' : 'text-amber-400'"
                    />
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                class="shrink-0 size-7 text-muted-foreground hover:text-destructive [&_svg]:size-3"
                :aria-label="`Remove ${event.name}`"
                @click="emit('remove', event.id)"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>

        <!-- Summary -->
        <div class="px-4 py-3">
          <div class="text-xs text-muted-foreground space-y-1">
            <p>{{ count }} events · ~{{ totalHours }}h of dancing</p>
            <div v-if="styles.length" class="flex flex-wrap gap-1">
              <span
                v-for="s in styles"
                :key="s"
                class="px-1.5 py-0.5 rounded text-eyebrow font-medium bg-muted text-muted-foreground"
              >
                {{ s }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Save CTA -->
    <div class="border-t px-4 py-3">
      <Button class="w-full" size="sm" @click="emit('sign-in')">
        <Save class="w-3.5 h-3.5 mr-2" />
        Save my week
      </Button>
    </div>
  </div>
</template>
