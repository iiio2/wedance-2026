<script setup lang="ts">
/**
 * ScheduleTab — chronological per-day workshop list, V3 tropical style.
 * Replaces the old shadcn time-x-room table: same data, easier to scan
 * on mobile, matches WeeklyCalendar visual language on /cities/[city].
 * The room becomes metadata alongside teacher + style rather than a
 * whole column of mostly-empty cells.
 */
import type { Workshop, Teacher } from '~/types/festival'
import { MapPin, Music, Users, Star } from 'lucide-vue-next'
import { chilis } from '~/lib/levels'
import { WD } from '~/lib/brand'
import { accentText, readableAccent } from '~/lib/accent'
import { Button } from '~/components/ui/button'
import { sessionPath } from '#shared/utils/eventSlug'

const props = defineProps<{
  workshops: Workshop[]
  teachers: Teacher[]
  days: string[]
  styles: string[]
  planIds: Set<string>
  selectedTeacherId: string | null
  startDate: string
  festivalSlug?: string
}>()

const emit = defineEmits<{
  toggleWorkshop: [id: string]
}>()

// Each schedule item opens its own event page. Compound id (festival~workshop)
// keeps it globally unique since workshop ids repeat across festivals. The
// title is the link, stretched over the row, so Save isn't nested in an <a>.
// A row SAVES the session to My plan; "Going?" is asked once, in the hero
// (RAZ-731), so the rows don't ask it again.
const eventHref = (wid: string) => (props.festivalSlug ? sessionPath(props.festivalSlug, wid) : undefined)

const dayLabels = computed(() => {
  const start = new Date(props.startDate)
  const map: Record<string, string> = {}
  props.days.forEach((day, i) => {
    const date = new Date(start)
    date.setDate(date.getDate() + i)
    map[day] = `${day}, ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  })
  return map
})

const selectedStyle = ref<string | null>(null)
const selectedLevel = ref<string | null>(null)

const levels = ['Beginner', 'Intermediate', 'Advanced']

function styleAccent(style: string): string {
  const map: Record<string, string> = {
    salsa:       WD.red600,
    bachata:     WD.purple500,
    kizomba:     WD.pink500,
    timba:       WD.amber500,
    son:         WD.green600,
    rumba:       WD.cyan600,
    'urban kiz': WD.violet600,
    semba:       WD.amber500,
    'hip hop':   WD.sky500,
  }
  return map[style.toLowerCase()] || WD.amber600
}

function filteredForDay(day: string) {
  return props.workshops
    .filter((w) => {
      if (w.day !== day) return false
      if (w.type === 'party') return false
      if (props.selectedTeacherId && w.teacherId !== props.selectedTeacherId && !w.withIds?.includes(props.selectedTeacherId)) return false
      if (selectedStyle.value && w.style !== selectedStyle.value) return false
      if (selectedLevel.value && w.level !== selectedLevel.value) return false
      return true
    })
    .sort((a, b) => a.time.localeCompare(b.time))
}

function partiesForDay(day: string) {
  return props.workshops
    .filter((w) => w.day === day && w.type === 'party')
    .sort((a, b) => a.time.localeCompare(b.time))
}

function teacherFor(workshop: Workshop): Teacher | undefined {
  const main = props.teachers.find((t) => t.id === workshop.teacherId)
  // Taught together ("Ivan & Ivana"): one name line for the pair.
  const others = (workshop.withIds ?? []).map(id => props.teachers.find(t => t.id === id)).filter(Boolean) as Teacher[]
  return main && others.length ? { ...main, name: [main, ...others].map(t => t.name).join(' & ') } : main
}

function toggleStyle(value: string) {
  selectedStyle.value = selectedStyle.value === value ? null : value
}

function toggleLevel(value: string) {
  selectedLevel.value = selectedLevel.value === value ? null : value
}

const levelColor: Record<string, string> = {
  Beginner:     WD.green600,
  Intermediate: WD.amber500,
  Advanced:     WD.red600,
}
</script>

<template>
  <div class="space-y-6">
    <!-- Filters — V3 warm palette -->
    <div class="rounded-2xl bg-card border border-border p-4 sm:p-5">
      <div class="text-eyebrow uppercase tracking-[0.3em] font-bold mb-2 text-secondary">Filter</div>
      <div class="flex flex-wrap gap-2 mb-3">
        <Button
          v-for="style in styles"
          :key="style"
          type="button"
          :variant="selectedStyle === style ? 'pill' : 'outline-pill'"
          size="pill-sm"
          :accent="readableAccent(styleAccent(style))"
          class="px-3"
          :aria-pressed="selectedStyle === style"
          @click="toggleStyle(style)"
        >
          {{ style }}
        </Button>
      </div>
      <div class="flex flex-wrap gap-2">
        <Button
          v-for="level in levels"
          :key="level"
          type="button"
          :variant="selectedLevel === level ? 'pill' : 'outline-pill'"
          size="pill-sm"
          :accent="readableAccent(levelColor[level]!)"
          class="gap-1.5 px-3"
          :aria-pressed="selectedLevel === level"
          @click="toggleLevel(level)"
        >
          <span class="text-sm" aria-hidden="true">{{ chilis(level) }}</span>
          {{ level }}
        </Button>
      </div>
    </div>

    <!-- Per-day sections -->
    <div v-for="day in days" :key="day" class="space-y-3">
      <!-- Sticky day header -->
      <div
        class="sticky z-10 pt-2 pb-3 flex items-baseline gap-3 backdrop-blur-sm"
        style="top: 3.75rem; background:rgba(251, 245, 234, 0.95); border-bottom:1px solid color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);"
      >
        <h3 class="text-xl font-black leading-none font-display text-foreground">
          {{ dayLabels[day] }}
        </h3>
      </div>

      <!-- Workshop rows -->
      <div v-if="filteredForDay(day).length > 0" class="grid gap-2">
        <div
          v-for="w in filteredForDay(day)"
          :key="w.id"
          class="group relative rounded-xl bg-white p-3 sm:p-4 border transition-all hover:-translate-y-0.5 flex items-start gap-3 sm:gap-4 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
          :style="{
            borderColor: styleAccent(w.style) + '55',
            boxShadow: '0 1px 0 ' + styleAccent(w.style) + '18, 0 4px 14px rgba(59,31,18,0.04)',
            background: planIds.has(w.id) ? styleAccent(w.style) + '08' : 'white',
          }"
        >
          <!-- Time (fixed width, bold, accent color) -->
          <div class="w-14 sm:w-16 shrink-0 text-center pt-0.5">
            <div
              class="text-lg font-black leading-none tabular-nums font-display"
              :style="{ color: styleAccent(w.style) }"
            >
              {{ w.time }}
            </div>
          </div>

          <!-- Middle: badges, title, teacher + room + going -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center flex-wrap gap-2">
              <span
                class="text-eyebrow font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                :style="{ background: styleAccent(w.style) + '18', color: accentText(styleAccent(w.style)) }"
              >
                {{ w.style }}
              </span>
              <span
                v-if="w.level"
                class="inline-flex items-center gap-1 text-eyebrow font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
                :style="{ background: levelColor[w.level] + '18', color: accentText(levelColor[w.level]!) }"
              >
                <span class="text-xs leading-none">{{ chilis(w.level) }}</span>
                {{ w.level }}
              </span>
            </div>
            <h4 class="text-sm sm:text-base font-bold leading-tight mt-1 text-foreground">
              <NuxtLink v-if="eventHref(w.id)" :to="eventHref(w.id)" class="outline-none after:absolute after:inset-0">
                {{ w.title }}
              </NuxtLink>
              <template v-else>{{ w.title }}</template>
            </h4>
            <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs font-sans text-muted-foreground">
              <span v-if="teacherFor(w)" class="italic" :style="{ color: styleAccent(w.style) }">
                {{ teacherFor(w)!.name }}
              </span>
              <span v-if="w.room" class="inline-flex items-center gap-1">
                <MapPin class="w-3 h-3 text-secondary" aria-hidden="true" />
                {{ w.room }}
              </span>
              <span v-if="w.goingCount" class="inline-flex items-center gap-1">
                <Users class="w-3 h-3 text-secondary" aria-hidden="true" />
                {{ w.goingCount }} going
              </span>
            </div>
          </div>

          <!-- Pick button -->
          <Button
            type="button"
            :variant="planIds.has(w.id) ? 'pill' : 'outline-pill'"
            size="pill-sm"
            :accent="readableAccent(styleAccent(w.style))"
            class="relative z-10 shrink-0 px-3 normal-case tracking-normal"
            :aria-pressed="planIds.has(w.id)"
            @click="emit('toggleWorkshop', w.id)"
          >
            <Star :class="planIds.has(w.id) ? 'fill-current' : ''" aria-hidden="true" /> {{ planIds.has(w.id) ? 'Saved' : 'Save' }}
          </Button>
        </div>
      </div>

      <p
        v-else-if="partiesForDay(day).length === 0"
        class="rounded-2xl p-6 text-center border-2 border-dashed text-sm border-input bg-white/50 text-muted-foreground font-sans"
      >
        No workshops match your filters for {{ day }}.
      </p>

      <!-- Parties for this day — bigger, warmer, standalone -->
      <div
        v-for="party in partiesForDay(day)"
        :key="party.id"
        class="rounded-2xl p-4 sm:p-5 border flex items-start gap-3 sm:gap-4"
        :style="{
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--wd-red-600) 3.1%, transparent), color-mix(in srgb, var(--wd-orange-500) 3.1%, transparent))',
          borderColor: 'color-mix(in srgb, var(--wd-red-600) 20%, transparent)',
          boxShadow: '0 1px 0 color-mix(in srgb, var(--wd-red-600) 13.3%, transparent), 0 4px 14px rgba(59,31,18,0.04)',
        }"
      >
        <div class="w-14 sm:w-16 shrink-0 text-center pt-0.5">
          <div class="text-lg font-black leading-none tabular-nums text-primary font-display">
            {{ party.time }}
          </div>
        </div>
        <div class="flex-1 min-w-0">
          <div class="inline-flex items-center gap-1.5 text-eyebrow font-bold uppercase tracking-widest px-2 py-0.5 rounded-full" style="background:color-mix(in srgb, var(--wd-red-600) 9.4%, transparent); color:var(--wd-red-800);">
            <Music class="w-3 h-3" aria-hidden="true" />
            Party
          </div>
          <h4 class="text-base sm:text-lg font-black leading-tight mt-1 font-display text-foreground">
            {{ party.title }}
          </h4>
          <p v-if="party.description" class="text-xs mt-1 font-sans text-muted-foreground">
            {{ party.description }}
          </p>
          <div class="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs font-sans text-muted-foreground">
            <span v-if="party.venue" class="inline-flex items-center gap-1">
              <MapPin class="w-3 h-3 text-secondary" aria-hidden="true" />
              {{ party.venue }}
            </span>
            <span v-if="party.goingCount" class="inline-flex items-center gap-1">
              <Users class="w-3 h-3 text-secondary" aria-hidden="true" />
              {{ party.goingCount }} going
            </span>
          </div>
        </div>
        <Button
          type="button"
          :variant="planIds.has(party.id) ? 'pill' : 'outline-pill'"
          size="pill-sm"
          class="shrink-0 px-3 normal-case tracking-normal"
          :aria-pressed="planIds.has(party.id)"
          @click="emit('toggleWorkshop', party.id)"
        >
          <Star :class="planIds.has(party.id) ? 'fill-current' : ''" aria-hidden="true" /> {{ planIds.has(party.id) ? 'Saved' : 'Save' }}
        </Button>
      </div>
    </div>
  </div>
</template>
