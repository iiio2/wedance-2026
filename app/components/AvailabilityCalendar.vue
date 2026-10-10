<script setup lang="ts">
/**
 * Availability calendar for a bookable space (Google-Calendar-ish): a week grid
 * of areas × days showing existing bookings, click an empty cell to book that
 * area on that day. When availability slots are provided, only days matching a
 * published slot show the "+" — other days are greyed out. When no slots exist
 * for a space the calendar stays fully open (backward-compat).
 *
 * Emits `book({ spaceId, spaceName, date })`.
 */
import { ChevronLeft, ChevronRight, Plus } from 'lucide-vue-next'

const props = defineProps<{
  spaces: Array<{ id: string; name: string }>
  bookings: Array<{ spaceId: string; eventDate: string | null; title?: string | null; startTime?: string | null; status?: string }>
  availability?: Array<{ spaceId: string; dayOfWeek: number }>
}>()
const emit = defineEmits<{ book: [{ spaceId: string; spaceName: string; date: string }] }>()

// Monday of the current week + a week offset.
const weekOffset = ref(0)
function mondayOf(d: Date) { const x = new Date(d); const day = (x.getDay() + 6) % 7; x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x }
const weekStart = computed(() => { const m = mondayOf(new Date()); m.setDate(m.getDate() + weekOffset.value * 7); return m })

// Land on the week of the next upcoming booking so the grid isn't empty next to
// a schedule that has events. Runs once when bookings first arrive.
const jumped = ref(false)
watch(() => props.bookings, (bs) => {
  if (jumped.value || !bs?.length) return
  const today = new Date().toISOString().slice(0, 10)
  const next = bs.map(b => (b.eventDate ? String(b.eventDate).slice(0, 10) : ''))
    .filter(d => d && d >= today).sort()[0]
  if (next) {
    const cur = mondayOf(new Date()).getTime()
    const tgt = mondayOf(new Date(next)).getTime()
    weekOffset.value = Math.round((tgt - cur) / (7 * 86400000))
  }
  jumped.value = true
}, { immediate: true })
const days = computed(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(weekStart.value); d.setDate(d.getDate() + i); return d }))
const iso = (d: Date) => d.toISOString().slice(0, 10)
const weekLabel = computed(() => {
  const a = days.value[0], b = days.value[6]
  const f = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${f(a)} – ${f(b)}`
})

function bookingsFor(spaceId: string, d: Date) {
  const day = iso(d)
  return props.bookings
    .filter(b => b.spaceId === spaceId && b.eventDate && String(b.eventDate).slice(0, 10) === day)
    .sort((a, b) => String(a.startTime ?? '').localeCompare(String(b.startTime ?? '')))
}

// Build a Set of available ISO-days per space from the availability prop.
// When a space has no slots, it's treated as fully available (null = open).
const availableDays = computed(() => {
  const map = new Map<string, Set<number> | null>()
  if (!props.availability?.length) return map
  for (const slot of props.availability) {
    if (!map.has(slot.spaceId)) map.set(slot.spaceId, new Set())
    map.get(slot.spaceId)!.add(slot.dayOfWeek)
  }
  return map
})

function isAvailable(spaceId: string, d: Date): boolean {
  const set = availableDays.value.get(spaceId)
  if (!set) return true // no slots published → fully open
  // Use the date-only ISO string to derive a stable UTC weekday, avoiding
  // timezone-dependent shifts near midnight.
  const [y, m, day] = iso(d).split('-').map(Number)
  const utcDow = new Date(Date.UTC(y, m - 1, day)).getUTCDay()
  const isoDay = utcDow === 0 ? 7 : utcDow // 1=Mon…7=Sun
  return set.has(isoDay)
}

const todayIso = iso(new Date())
</script>

<template>
  <div class="font-sans">
    <!-- Week nav -->
    <div class="flex items-center justify-between mb-3">
      <button type="button" class="w-8 h-8 rounded-full flex items-center justify-center text-primary" style="background:color-mix(in srgb, var(--wd-red-600) 7.8%, transparent);" aria-label="Previous week" @click="weekOffset--"><ChevronLeft class="w-4 h-4" /></button>
      <div class="text-sm font-bold text-foreground font-display">{{ weekLabel }}<button v-if="weekOffset !== 0" type="button" class="ml-2 text-eyebrow uppercase tracking-wider text-primary" @click="weekOffset = 0">Today</button></div>
      <button type="button" class="w-8 h-8 rounded-full flex items-center justify-center text-primary" style="background:color-mix(in srgb, var(--wd-red-600) 7.8%, transparent);" aria-label="Next week" @click="weekOffset++"><ChevronRight class="w-4 h-4" /></button>
    </div>

    <div class="overflow-x-auto -mx-4 px-4">
      <div class="min-w-[640px]">
        <!-- Day header -->
        <div class="grid" style="grid-template-columns: 84px repeat(7, 1fr); gap:4px;">
          <div />
          <div v-for="d in days" :key="d.toISOString()" class="text-center py-1">
            <div class="text-eyebrow uppercase font-bold text-secondary">{{ d.toLocaleDateString(undefined, { weekday: 'short' }) }}</div>
            <div class="text-xs font-bold" :style="iso(d) === todayIso ? 'color:var(--wd-red-600);' : 'color:var(--wd-brown-900);'">{{ d.getDate() }}</div>
          </div>
        </div>

        <!-- Area rows -->
        <div v-for="sp in spaces" :key="sp.id" class="grid mt-1" style="grid-template-columns: 84px repeat(7, 1fr); gap:4px;">
          <div class="flex items-center text-meta font-bold pr-1 text-foreground">{{ sp.name }}</div>
          <div v-for="d in days" :key="d.toISOString()" class="min-h-[44px] rounded-lg border p-1" :style="isAvailable(sp.id, d) ? 'border-color:color-mix(in srgb, var(--wd-brown-900) 7.1%, transparent); background:white;' : 'border-color:color-mix(in srgb, var(--wd-brown-900) 3.1%, transparent); background:#f5f0e8;'">
            <template v-if="bookingsFor(sp.id, d).length">
              <div v-for="(b, i) in bookingsFor(sp.id, d)" :key="i" class="rounded px-1 py-0.5 mb-0.5 text-tag leading-tight truncate"
                :style="b.status === 'accepted' ? 'background:color-mix(in srgb, var(--wd-green-600) 10.2%, transparent); color:#166534;' : 'background:color-mix(in srgb, var(--wd-amber-500) 10.2%, transparent); color:var(--wd-amber-700);'"
                :title="(b.startTime ? b.startTime + ' ' : '') + (b.title || 'Event')">
                <span v-if="b.startTime" class="font-bold">{{ b.startTime }}</span> {{ b.title || 'Event' }}
              </div>
            </template>
            <button v-else-if="isAvailable(sp.id, d)" type="button" class="w-full h-full min-h-[36px] rounded flex items-center justify-center border border-dashed transition-colors hover:text-white" style="border-color:color-mix(in srgb, var(--wd-red-600) 33.3%, transparent); color:var(--wd-red-600);" onmouseover="this.style.background='var(--wd-red-600)'" onmouseout="this.style.background='transparent'" :aria-label="`Book ${sp.name} on ${iso(d)}`" @click="emit('book', { spaceId: sp.id, spaceName: sp.name, date: iso(d) })">
              <Plus class="w-4 h-4" />
            </button>
            <!-- unavailable + no bookings: empty greyed-out cell -->
          </div>
        </div>
      </div>
    </div>
    <p class="mt-2 text-meta text-secondary">Tap a free cell to propose an event in that area. Green = confirmed, amber = proposed.</p>
  </div>
</template>
