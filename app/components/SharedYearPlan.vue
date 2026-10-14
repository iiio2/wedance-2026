<script setup lang="ts">
import type { YearPlanFestival, DanceRole } from '~/types/festival'
import { UserPlus, Check, Calendar, MapPin, ChevronRight, Heart, Gift, ArrowRight, Globe, Music, Sparkles } from 'lucide-vue-next'
import { WD } from '~/lib/brand'

const props = defineProps<{
  sharer: { name: string; photo: string; role: DanceRole }
  festivals: YearPlanFestival[]
  viewerFestivalSlugs: string[]
  referralCode?: string
}>()

const emit = defineEmits<{
  'add-friend': []
  'open-festival': [slug: string]
  'create-year-plan': []
  'sign-in': []
}>()

const friendAdded = ref(false)

function addFriend() {
  emit('add-friend')
}

// Group festivals by month
const groupedByMonth = computed(() => {
  const months = new Map<string, YearPlanFestival[]>()
  for (const f of props.festivals) {
    const date = new Date(f.startDate)
    const key = date.toLocaleString('en', { month: 'long', year: 'numeric' })
    const list = months.get(key) || []
    list.push(f)
    months.set(key, list)
  }
  return months
})

// Overlap: festivals the viewer is also attending
const overlapSlugs = computed(() => {
  const sharerSlugs = new Set(props.festivals.map((f) => f.slug))
  return props.viewerFestivalSlugs.filter((s) => sharerSlugs.has(s))
})

const overlapFestivals = computed(() => {
  const slugs = new Set(overlapSlugs.value)
  return props.festivals.filter((f) => slugs.has(f.slug))
})

const totalWorkshops = computed(() => props.festivals.reduce((sum, f) => sum + f.workshopCount, 0))
const totalLooking = computed(() => props.festivals.reduce((sum, f) => sum + f.lookingCount, 0))

// ── Wrapped-style stats (derived from the sharer's shared data) ──
const countries = computed(() => [...new Set(props.festivals.map((f) => f.country).filter(Boolean))])

const topStyles = computed(() => {
  const styleMap = new Map<string, number>()
  for (const f of props.festivals) {
    for (const s of f.styles) {
      styleMap.set(s, (styleMap.get(s) ?? 0) + 1)
    }
  }
  const total = [...styleMap.values()].reduce((a, b) => a + b, 0) || 1
  return [...styleMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([style, count]) => ({ style, percent: Math.round((count / total) * 100) }))
})

const monthSpan = computed(() => {
  if (props.festivals.length === 0) return ''
  const dates = props.festivals.map((f) => new Date(f.startDate)).sort((a, b) => a.getTime() - b.getTime())
  const first = dates[0]
  const last = dates[dates.length - 1]
  const fMonth = first.toLocaleString('en', { month: 'short' })
  const lMonth = last.toLocaleString('en', { month: 'short' })
  if (fMonth === lMonth) return fMonth
  return `${fMonth} – ${lMonth}`
})

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sMonth = s.toLocaleString('en', { month: 'short' })
  const eMonth = e.toLocaleString('en', { month: 'short' })
  if (sMonth === eMonth) {
    return `${sMonth} ${s.getDate()}–${e.getDate()}`
  }
  return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}`
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-8 space-y-6">
    <!-- Sharer profile card -->
    <div class="rounded-xl border-2 border-dashed p-6 text-center space-y-4" style="border-color:color-mix(in srgb, var(--wd-red-600) 26.7%, transparent); background:rgba(255,255,255,0.8);">
      <img
        v-if="sharer.photo"
        :src="sharer.photo"
        :alt="sharer.name"
        class="w-16 h-16 rounded-full object-cover mx-auto border-2"
        style="border-color:color-mix(in srgb, var(--wd-red-600) 26.7%, transparent);"
      />
      <div
        v-else
        class="w-16 h-16 rounded-full flex items-center justify-center text-lg font-bold text-white mx-auto border-2"
        style="border-color:color-mix(in srgb, var(--wd-red-600) 26.7%, transparent); background:var(--wd-red-600);"
      >
        {{ sharer.name.split(' ').map(w => w.charAt(0)).join('').toUpperCase().slice(0, 2) }}
      </div>
      <div>
        <h1 class="text-xl font-bold font-display text-foreground">{{ sharer.name }}'s 2026 Dance Year</h1>
        <div class="flex items-center justify-center gap-2 mt-2 flex-wrap">
          <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-foreground" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); background:rgba(251,245,234,0.8);">{{ sharer.role === 'lead' ? 'Lead' : 'Follow' }}</span>
          <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-secondary" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);">{{ festivals.length }} festivals</span>
          <span class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-secondary" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);">{{ totalWorkshops }} workshops</span>
          <span v-if="totalLooking > 0" class="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium text-wd-amber-800" style="border-color:color-mix(in srgb, var(--wd-amber-500) 33.3%, transparent); background:rgba(245, 158, 11, 0.08);">
            {{ totalLooking }} needs partner
          </span>
        </div>
      </div>

      <!-- Add friend button -->
      <Button v-if="!friendAdded" variant="cta" class="mx-auto px-5 text-xs" @click="addFriend">
        <UserPlus aria-hidden="true" />
        Add {{ sharer.name }} as friend
      </Button>
      <p v-else role="status" class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider mx-auto text-foreground opacity-60 border-2 border-dashed border-foreground/27">
        <Check class="w-4 h-4" aria-hidden="true" />
        Friend added
      </p>
    </div>

    <!-- Year in Numbers — Wrapped-style stats -->
    <div v-if="festivals.length > 0" class="rounded-xl border-2 border-dashed p-5 space-y-4" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); background:rgba(255,255,255,0.7);">
      <h2 class="text-base font-bold font-display text-foreground">{{ sharer.name }}'s Year in Numbers</h2>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
        <div>
          <p class="text-3xl font-black font-display text-primary">{{ festivals.length }}</p>
          <p class="text-eyebrow uppercase tracking-[0.2em] text-secondary">Festivals</p>
        </div>
        <div>
          <p class="text-3xl font-black font-display text-wd-green-600">{{ totalWorkshops }}</p>
          <p class="text-eyebrow uppercase tracking-[0.2em] text-secondary">Workshops</p>
        </div>
        <div>
          <p class="text-3xl font-black font-display text-wd-cyan-600">{{ countries.length }}</p>
          <p class="text-eyebrow uppercase tracking-[0.2em] text-secondary">{{ countries.length === 1 ? 'Country' : 'Countries' }}</p>
        </div>
      </div>

      <!-- Top dance styles -->
      <div v-if="topStyles.length > 0" class="space-y-1.5">
        <p class="text-xs font-bold text-secondary">Top dance styles</p>
        <div v-for="entry in topStyles" :key="entry.style" class="flex items-center gap-2">
          <span class="text-xs w-16 shrink-0 text-muted-foreground font-sans">{{ entry.style }}</span>
          <div class="flex-1 h-2 rounded-full overflow-hidden" style="background:color-mix(in srgb, var(--wd-brown-900) 8.2%, transparent);">
            <div
              class="h-full rounded-full"
              :style="{ width: entry.percent + '%', background: 'linear-gradient(135deg, var(--wd-red-600), var(--wd-orange-500))' }"
            />
          </div>
          <span class="text-eyebrow w-8 text-right text-secondary">{{ entry.percent }}%</span>
        </div>
      </div>

      <!-- Month span -->
      <div v-if="monthSpan" class="flex items-center justify-between text-xs">
        <span class="text-secondary">Festival season</span>
        <span class="font-bold text-foreground">{{ monthSpan }}</span>
      </div>

      <!-- Countries list -->
      <div v-if="countries.length > 0" class="flex items-center justify-between text-xs">
        <span class="text-secondary">Dancing in</span>
        <span class="font-bold text-foreground">{{ countries.join(', ') }}</span>
      </div>
    </div>

    <!-- Overlap banner — shared festivals -->
    <div v-if="overlapSlugs.length > 0" class="rounded-xl border-2 border-dashed p-4 space-y-2 border-wd-cyan-600" style="background:rgba(8, 145, 178, 0.06);">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style="background:rgba(8, 145, 178, 0.12);">
          <Calendar class="w-4 h-4 text-wd-cyan-600" />
        </div>
        <div>
          <p class="text-sm font-bold font-display text-foreground">
            You overlap on {{ overlapSlugs.length }} {{ overlapSlugs.length === 1 ? 'festival' : 'festivals' }}!
          </p>
          <p class="text-xs text-muted-foreground">You and {{ sharer.name }} are both going to:</p>
        </div>
      </div>
      <ul class="ml-11 space-y-1">
        <li v-for="f in overlapFestivals" :key="f.slug" class="text-xs font-medium flex items-center gap-1.5 text-wd-cyan-600">
          <Check class="w-3 h-3 shrink-0" />
          {{ f.name }}
        </li>
      </ul>
    </div>

    <!-- No overlap banner -->
    <div v-else class="rounded-xl border-2 border-dashed p-4 flex items-center gap-3" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); background:rgba(251,245,234,0.8);">
      <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style="background:rgba(59, 31, 13, 0.06);">
        <Calendar class="w-4 h-4 text-secondary" />
      </div>
      <div>
        <p class="text-sm font-bold font-display text-foreground">
          No festival overlap yet
        </p>
        <p v-if="viewerFestivalSlugs.length > 0" class="text-xs text-muted-foreground">You and {{ sharer.name }} aren't going to the same festivals — browse theirs and add one to your plan!</p>
        <p v-else class="text-xs text-muted-foreground">Add festivals to your plan to see where you overlap with {{ sharer.name }}!</p>
      </div>
    </div>

    <!-- Festival timeline -->
    <div class="space-y-6">
      <h3 class="text-lg font-bold font-display text-foreground">Their Festivals</h3>

      <div v-for="[month, monthFestivals] in groupedByMonth" :key="month">
        <p class="text-eyebrow uppercase tracking-[0.2em] font-bold mb-3 text-secondary">{{ month }}</p>

        <div class="space-y-3">
          <div
            v-for="f in monthFestivals"
            :key="f.slug"
            class="rounded-xl border-2 overflow-hidden"
            :style="{ borderColor: f.accentColor + '55', boxShadow: '3px 4px 0 -1px ' + f.accentColor + '2e' }"
            style="background:rgba(255,255,255,0.85);"
          >
            <!-- Festival header -->
            <div
              class="px-4 py-3 flex items-center gap-3"
              :style="{ background: f.accentColor + '0d' }"
            >
              <img
                v-if="f.logo"
                :src="f.logo"
                :alt="f.name"
                class="w-10 h-10 rounded-lg object-cover shrink-0"
              />
              <div
                v-else
                class="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0"
                :style="{ background: f.accentColor || WD.amber600 }"
              >
                {{ f.name.charAt(0) }}
              </div>
              <div class="flex-1 min-w-0">
                <h4 class="text-sm font-bold leading-tight font-display text-foreground">{{ f.name }}</h4>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-xs flex items-center gap-1 text-secondary">
                    <Calendar class="w-3 h-3" />
                    {{ formatDateRange(f.startDate, f.endDate) }}
                  </span>
                  <span class="text-xs flex items-center gap-1 text-secondary">
                    <MapPin class="w-3 h-3" />
                    {{ f.location }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Details -->
            <div class="px-4 py-3 space-y-2.5 border-t" :style="{ borderColor: f.accentColor + '22' }">
              <div class="flex items-center gap-2 flex-wrap">
                <span v-if="f.workshopCount > 0" class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-foreground" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); background:rgba(251,245,234,0.8);">
                  {{ f.workshopCount }} workshops
                </span>
                <span v-if="f.workshopCount === 0" class="inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-xs italic text-secondary" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);">
                  Plan not started
                </span>
                <span v-if="f.role" class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-foreground" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); background:rgba(251,245,234,0.8);">
                  {{ f.role === 'lead' ? 'Lead' : 'Follow' }}
                </span>
                <span
                  v-if="f.lookingCount > 0"
                  class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-wd-amber-800"
                  style="border-color:color-mix(in srgb, var(--wd-amber-500) 33.3%, transparent); background:rgba(245, 158, 11, 0.08);"
                >
                  {{ f.lookingCount }} need partner
                </span>
                <span
                  v-if="viewerFestivalSlugs.includes(f.slug)"
                  class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-wd-cyan-600"
                  style="border-color:color-mix(in srgb, var(--wd-cyan-600) 33.3%, transparent); background:rgba(8, 145, 178, 0.06);"
                >
                  You're going too!
                </span>
              </div>

              <!-- Referral hint -->
              <div v-if="f.ticketStatus === 'purchased' && referralCode && f.referralDiscountPercent" class="rounded-lg border-2 border-dashed p-2.5 flex items-center gap-2" style="border-color:color-mix(in srgb, var(--wd-green-600) 33.3%, transparent); background:rgba(22, 163, 74, 0.06);">
                <Gift class="w-3.5 h-3.5 shrink-0 text-wd-green-600" />
                <p class="text-xs text-wd-green-700">
                  Buy your ticket through {{ sharer.name }}'s link — you both get {{ f.referralDiscountPercent }}% off.
                </p>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2">
                <Button variant="outline-pill" size="pill-sm" class="px-3" @click="emit('open-festival', f.slug)">
                  See plan
                  <ChevronRight class="size-3" aria-hidden="true" />
                </Button>
                <Button v-if="f.lookingCount > 0" variant="soft" size="pill-sm" class="px-3" @click="emit('open-festival', f.slug)">
                  <Heart class="size-3" aria-hidden="true" />
                  Be their partner
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- CTA: Start your own dance year -->
    <div class="rounded-xl border-2 border-dashed p-6 text-center space-y-4" style="border-color:color-mix(in srgb, var(--wd-red-600) 26.7%, transparent); background:rgba(255,255,255,0.8);">
      <Sparkles class="w-8 h-8 mx-auto text-primary" aria-hidden="true" />
      <h3 class="text-xl font-bold font-display text-foreground">Your Next Dance Year Starts Here</h3>
      <p class="text-sm text-muted-foreground max-w-md mx-auto">
        Browse festivals, choose workshops, find dance partners, and share your dance-year plans with friends. Create your own Dance Year and start planning your next adventure.
      </p>
      <Button variant="cta" size="lg" class="px-6" @click="emit('create-year-plan')">
        {{ viewerFestivalSlugs.length > 0 ? 'Go to my year plan' : 'Start My Dance Year' }}
        <ArrowRight aria-hidden="true" />
      </Button>
    </div>
  </div>
</template>
