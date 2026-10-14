<script setup lang="ts">
import type { YearPlanFestival, YearStats } from '~/types/festival'
import { Calendar, MapPin, Users, Ticket, Clock, ChevronRight, Share2, Sparkles, ExternalLink } from 'lucide-vue-next'
import { WD } from '~/lib/brand'

const props = defineProps<{
  festivals: YearPlanFestival[]
  suggestions: YearPlanFestival[]
  stats: YearStats
  isSignedIn: boolean
}>()

const emit = defineEmits<{
  'open-festival': [slug: string]
  'add-festival': [slug: string]
  'share': []
  'sign-in': []
  'browse-festivals': []
}>()

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

// Upcoming ticket deadlines — only for festivals where the user hasn't bought yet
const upcomingDeadlines = computed(() => {
  const now = new Date()
  return props.festivals
    .filter((f) => f.earlyBirdDeadline && new Date(f.earlyBirdDeadline) > now && f.ticketStatus !== 'purchased')
    .sort((a, b) => new Date(a.earlyBirdDeadline!).getTime() - new Date(b.earlyBirdDeadline!).getTime())
    .slice(0, 3)
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

function daysUntil(date: string): number {
  const now = new Date()
  const target = new Date(date)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

const ticketStatusLabel: Record<string, string> = {
  'purchased': 'Ticket purchased',
  'not-purchased': 'No ticket yet',
  'sold-out': 'Sold out',
}

const ticketStatusClass: Record<string, string> = {
  'purchased': 'bg-green-50 text-green-700 border-green-200',
  'not-purchased': 'bg-orange-50 text-orange-700 border-orange-200',
  'sold-out': 'bg-red-50 text-red-700 border-red-200',
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-8 space-y-8">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl sm:text-3xl leading-tight font-display text-foreground">My 2026 Dance Year</h1>
        <p class="text-sm mt-1 text-secondary">
          {{ stats.totalFestivals }} festivals · {{ stats.totalWorkshops }} workshops · {{ stats.countries.length }} {{ stats.countries.length === 1 ? 'country' : 'countries' }}
        </p>
      </div>
      <Button variant="outline-pill" size="pill-sm" @click="emit('share')">
        <Share2 class="size-3.5" aria-hidden="true" />
        Share
      </Button>
    </div>

    <!-- Ticket deadline alerts -->
    <div v-if="upcomingDeadlines.length > 0" class="space-y-2">
      <div
        v-for="f in upcomingDeadlines"
        :key="f.slug + '-deadline'"
        class="relative rounded-xl border-2 border-dashed p-3 flex items-center gap-3 cursor-pointer hover:-translate-y-0.5 transition-transform border-wd-amber-500 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
        style="background:rgba(245, 158, 11, 0.08);"
      >
        <div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style="background:rgba(245, 158, 11, 0.15);">
          <Clock class="w-4 h-4 text-wd-amber-500" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-bold text-foreground font-display">
            <button type="button" class="text-left after:absolute after:inset-0 after:content-[''] after:rounded-xl outline-none cursor-pointer" @click="emit('open-festival', f.slug)">Early bird for {{ f.name }}</button>
            <span v-if="f.earlyBirdOffer" class="font-normal text-xs text-secondary"> — {{ f.earlyBirdOffer }}</span>
          </p>
          <p class="text-xs text-secondary">Expires in {{ daysUntil(f.earlyBirdDeadline!) }} days</p>
        </div>
        <Button
          v-if="f.ticketUrl"
          as-child
          variant="pill"
          size="pill-sm"
          accent="var(--wd-amber-700)"
          class="relative z-10 shrink-0"
        >
          <a :href="f.ticketUrl" target="_blank" rel="noopener" @click.stop>
            Buy
            <ExternalLink class="w-3 h-3" aria-hidden="true" />
          </a>
        </Button>
        <ChevronRight v-else class="w-4 h-4 shrink-0 text-wd-amber-500" />
      </div>
    </div>

    <!-- Festival timeline -->
    <div class="space-y-6">
      <div v-for="[month, monthFestivals] in groupedByMonth" :key="month">
        <p class="text-eyebrow uppercase tracking-[0.2em] font-bold mb-3 text-secondary">{{ month }}</p>

        <div class="space-y-3">
          <div
            v-for="f in monthFestivals"
            :key="f.slug"
            class="relative rounded-xl border-2 overflow-hidden cursor-pointer hover:-translate-y-0.5 transition-all focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
            :style="{ borderColor: f.accentColor + '55', boxShadow: '3px 4px 0 -1px ' + f.accentColor + '2e' }"
            style="background:rgba(255,255,255,0.85);"
          >
            <!-- Festival header with accent -->
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
                <h3 class="text-sm font-bold leading-tight font-display text-foreground">
                  <button type="button" class="text-left after:absolute after:inset-0 after:content-[''] after:rounded-xl outline-none cursor-pointer" @click="emit('open-festival', f.slug)">{{ f.name }}</button>
                </h3>
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
              <ChevronRight class="w-4 h-4 shrink-0 text-secondary" />
            </div>

            <!-- Festival details -->
            <div class="px-4 py-3 space-y-2.5 border-t" :style="{ borderColor: f.accentColor + '22' }">
              <!-- Plan stats -->
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
              </div>

              <!-- Ticket status -->
              <div class="flex items-center gap-2">
                <span
                  class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
                  :class="ticketStatusClass[f.ticketStatus]"
                >
                  <Ticket class="w-3 h-3 mr-1" />
                  {{ f.ticketName || ticketStatusLabel[f.ticketStatus] }}
                </span>
              </div>

              <!-- Styles -->
              <div v-if="f.styles.length > 0" class="flex flex-wrap gap-1">
                <span
                  v-for="style in f.styles"
                  :key="style"
                  class="inline-flex items-center rounded-full border px-1.5 py-0 text-eyebrow text-secondary"
                  style="border-color:color-mix(in srgb, var(--wd-brown-900) 8.2%, transparent);"
                >
                  {{ style }}
                </span>
              </div>

              <!-- Friends going -->
              <div v-if="f.friendsGoing.length > 0" class="flex items-center gap-2">
                <div class="flex -space-x-2">
                  <template v-for="friend in f.friendsGoing.slice(0, 5)" :key="friend.name">
                    <img
                      v-if="friend.photo"
                      :src="friend.photo"
                      :alt="friend.name"
                      class="w-6 h-6 rounded-full border-2 object-cover border-wd-cream"
                    />
                    <div
                      v-else
                      class="w-6 h-6 rounded-full border-2 border-wd-cream bg-secondary flex items-center justify-center text-eyebrow font-bold text-white"
                    >
                      {{ friend.name.charAt(0).toUpperCase() }}
                    </div>
                  </template>
                </div>
                <span class="text-xs text-secondary">
                  {{ f.friendsGoing.map((fr) => fr.name.split(' ')[0]).slice(0, 3).join(', ') }}
                  <template v-if="f.friendsGoing.length > 3">
                    +{{ f.friendsGoing.length - 3 }} more
                  </template>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Suggestions -->
    <div v-if="suggestions.length > 0" class="space-y-3">
      <div class="flex items-center gap-2">
        <Sparkles class="w-4 h-4 text-secondary" />
        <h3 class="text-sm font-bold text-secondary font-display">Discover festivals</h3>
      </div>

      <div
        v-for="f in suggestions"
        :key="f.slug"
        class="relative rounded-xl border-2 border-dashed p-4 hover:-translate-y-0.5 transition-transform focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
        style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); background:rgba(255,255,255,0.7);"
      >
        <div class="flex items-center gap-3">
          <img
            v-if="f.logo"
            :src="f.logo"
            :alt="f.name"
            class="w-10 h-10 rounded-lg object-cover shrink-0 cursor-pointer"
            @click="emit('open-festival', f.slug)"
          />
          <div
            v-else
            class="w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold text-white shrink-0 cursor-pointer"
            :style="{ background: f.accentColor || WD.amber600 }"
            @click="emit('open-festival', f.slug)"
          >
            {{ f.name.charAt(0) }}
          </div>
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-bold font-display text-foreground">
              <button type="button" class="text-left after:absolute after:inset-0 after:content-[''] after:rounded-xl outline-none cursor-pointer" @click="emit('open-festival', f.slug)">{{ f.name }}</button>
            </h4>
            <p class="text-xs text-secondary">
              {{ formatDateRange(f.startDate, f.endDate) }} · {{ f.location }}
            </p>
          </div>
          <Button
            variant="outline-pill"
            size="pill-sm"
            :accent="f.accentColor || undefined"
            class="relative z-10 shrink-0"
            @click="emit('add-festival', f.slug)"
          >
            Going?
          </Button>
        </div>
        <div class="mt-2 flex items-center gap-3">
          <span v-if="f.styles.length > 0" class="text-xs text-secondary">
            {{ f.styles.join(', ') }}
          </span>
        </div>
      </div>

      <NuxtLink
        to="/festivals"
        class="block text-center text-lg font-bold py-2 hover:underline text-wd-red-800 font-display italic"
      >
        Browse all festivals →
      </NuxtLink>
    </div>

    <!-- Empty state: no festivals yet -->
    <div
      v-else-if="festivals.length === 0"
      class="rounded-xl border-2 border-dashed border-primary/25 bg-white/80 p-6 text-center space-y-3"
    >
      <Sparkles class="w-8 h-8 mx-auto text-primary" aria-hidden="true" />
      <h3 class="text-lg font-bold font-display text-foreground">Start planning your dance year</h3>
      <p class="text-sm text-muted-foreground">
        Browse upcoming festivals and add them to your year plan.
      </p>
      <Button as-child variant="cta" size="lg">
        <NuxtLink to="/festivals">Explore festivals</NuxtLink>
      </Button>
    </div>

    <!-- Year stats -->
    <div v-if="festivals.length > 0" class="rounded-xl border-2 border-dashed p-5 space-y-4" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); background:rgba(255,255,255,0.7);">
      <h3 class="text-base font-bold font-display text-foreground">My Year in Numbers</h3>

      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; text-align: center;">
        <div>
          <p class="text-3xl font-black font-display text-primary">{{ stats.totalFestivals }}</p>
          <p class="text-eyebrow uppercase tracking-[0.2em] text-secondary">Festivals</p>
        </div>
        <div>
          <p class="text-3xl font-black font-display text-wd-green-600">{{ stats.totalWorkshops }}</p>
          <p class="text-eyebrow uppercase tracking-[0.2em] text-secondary">Workshops</p>
        </div>
        <div>
          <p class="text-3xl font-black font-display text-wd-cyan-600">{{ stats.countries.length }}</p>
          <p class="text-eyebrow uppercase tracking-[0.2em] text-secondary">Countries</p>
        </div>
      </div>

      <!-- Style breakdown -->
      <div class="space-y-1.5">
        <p class="text-xs font-bold text-secondary">Dance styles</p>
        <div v-for="entry in stats.topStyles" :key="entry.style" class="flex items-center gap-2">
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

      <!-- Partner match rate -->
      <div class="flex items-center justify-between text-xs">
        <span class="text-secondary">Partner match rate</span>
        <span class="font-bold text-foreground">{{ stats.partnerMatchRate }}%</span>
      </div>
    </div>

    <!-- Not signed in CTA -->
    <div v-if="!isSignedIn" class="rounded-xl border-2 border-dashed p-6 text-center space-y-3" style="border-color:color-mix(in srgb, var(--wd-red-600) 26.7%, transparent); background:rgba(255,255,255,0.8);">
      <Calendar class="w-8 h-8 mx-auto text-primary" />
      <h3 class="text-lg font-bold font-display text-foreground">Track your dance year</h3>
      <p class="text-sm text-muted-foreground">
        Sign in to save your plans across festivals and share your year with friends.
      </p>
      <Button variant="cta" size="lg" class="px-6" @click="emit('sign-in')">Sign in</Button>
    </div>
  </div>
</template>
