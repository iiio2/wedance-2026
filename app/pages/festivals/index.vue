<script setup lang="ts">
/**
 * /festivals — the listing.
 * Restyled 2026-07-02 to match V3 tropical direction on /.
 * `layout: false` + inline V3 header so other pages that still use
 * the default layout are unaffected. YearCanvas sidebar + mobile
 * year drawer preserved. Fake stats bar (12k+ dancers / 180+ / 35)
 * removed — same "no fake friends" rule the homepage runs.
 *
 * RAZ-105: data now fetched from /api/festivals (DB-driven, SSR) instead
 * of hardcoded mock imports. Past festivals filtered server-side.
 * Since 2026-10-16 the rows are festival events (ADR-006): the wedance.vip
 * mirror plus festivals listed on WeDance, each with its own plan reference.
 */
import { DANCE_STYLES, findDanceStyle, matchesDanceStyleQuery, sortDanceStyles } from '#shared/dance-styles'
import {
  Search,
  ArrowRight,
} from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Field } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import type { FestivalRow } from '~~/server/api/festivals.get'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — Festivals',
  meta: [
    { name: 'description', content: 'Every dance festival mapped. See who is going before you book.' },
  ],
})

// Year plan — sidebar retired; picks now surface via the floating
// nudge pill and the full view lives on /my-plan.
const { yearPlanIds, toggleFestival, yearCount } = useYearPlan()
const { weekPlanIds, toggleEvent } = useWeekPlan()

// "Going?" stores what the festival's own page stores: its key in the year
// plan, or — a festival event without festival details — its id in the week plan.
function isPicked(f: FestivalRow) {
  return f.planType === 'festival' ? yearPlanIds.value.has(f.planId) : weekPlanIds.value.has(f.planId)
}

// Auth gate — "Going?" requires sign-in
const { isSignedIn } = useAuth()
const showSignUp = ref(false)

function onPick(f: FestivalRow) {
  if (!isSignedIn.value) {
    showSignUp.value = true
    return
  }
  if (f.planType === 'festival') toggleFestival(f.planId)
  else toggleEvent(f.planId)
}

// Festivals from DB (SSR — no spinner). Past festivals already excluded
// server-side, sorted by startDate ascending.
const { data: allFestivals } = await useFetch<FestivalRow[]>('/api/festivals', {
  key: 'festivals-directory',
})

// Search
const searchQuery = ref('')

function location(f: FestivalRow): string {
  return [f.city, f.country].filter(Boolean).join(', ') || 'TBA'
}

const filteredFestivals = computed(() => {
  const festivals = allFestivals.value ?? []

  if (!searchQuery.value.trim()) return festivals

  const q = searchQuery.value.toLowerCase()
  return festivals.filter(f =>
    f.name.toLowerCase().includes(q)
    || location(f).toLowerCase().includes(q)
    || f.styles.some((s: string) => {
      // Alias-aware: "cuban salsa" finds Casino, "on2" finds Salsa NY.
      const st = findDanceStyle(s)
      return st ? matchesDanceStyleQuery(st, q) : s.toLowerCase().includes(q)
    }),
  )
})

useTrackSearch('festivals', () => ({ query: searchQuery.value }), () => filteredFestivals.value.length)

// Styles the listed festivals actually have, most popular first.
const styleChips = computed(() => {
  const present = sortDanceStyles((allFestivals.value ?? []).flatMap(f => f.styles || []))
  return present.length ? present : DANCE_STYLES.slice(0, 5).map(s => s.name)
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <!-- V3 header — same as / and /organizers -->
    <SiteHeader />
    <main>

    <!-- HERO -->
    <section class="relative">
      <div class="max-w-4xl mx-auto px-4 pt-12 pb-8 text-center">
        <div class="text-sm tracking-widest uppercase mb-3 text-secondary">
          The festival year
        </div>
        <h1 class="text-5xl sm:text-6xl leading-[0.98] text-foreground">
          Pick your <em class="italic text-primary">next one.</em>
          <span class="font-hand text-wd-green-600 text-[0.9em]"> Plan the year.</span>
        </h1>
        <p class="mt-5 text-base sm:text-lg leading-relaxed max-w-xl mx-auto text-muted-foreground">
          Every festival mapped. See who is going before you book.
        </p>

        <!-- Search + chips -->
        <div class="mt-8 max-w-lg mx-auto">
          <Field id="festival-search" label="Search festivals" hide-label class="text-left">
            <div class="relative">
              <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary" aria-hidden="true" />
              <Input
                v-model="searchQuery"
                type="search"
                placeholder="Search by city, style, or festival"
                class="h-12 rounded-full pl-11 pr-4 shadow-wd-card"
              />
            </div>
          </Field>
          <DanceStyleFilter v-model="searchQuery" :styles="styleChips" class="mt-4 justify-center" />
        </div>
      </div>

      <!-- Wave divider -->
      <WaveDivider />
    </section>

    <!-- Festival grid -->
    <section class="max-w-4xl mx-auto px-4 pb-12">
      <div class="flex items-baseline justify-between mb-6">
        <h2 class="text-2xl leading-tight font-display text-foreground">
          {{ searchQuery ? 'Results' : 'Upcoming festivals' }}
        </h2>
        <span class="font-hand text-[18px] text-secondary">
          — {{ filteredFestivals.length }} event{{ filteredFestivals.length === 1 ? '' : 's' }}
        </span>
      </div>

      <div
        v-if="!filteredFestivals.length"
        class="text-center py-14 rounded-2xl border-2 border-dashed border-input bg-white/50"
      >
        <Search class="w-8 h-8 mx-auto mb-3 text-secondary" aria-hidden="true" />
        <p class="text-sm font-sans text-muted-foreground">Nothing matches "{{ searchQuery }}"</p>
        <Button variant="link" size="sm" class="mt-2 h-auto p-0 text-xs font-bold underline" @click="searchQuery = ''">
          Clear search
        </Button>
      </div>

      <div v-else class="grid gap-4">
        <FestivalCard
          v-for="f in filteredFestivals"
          :key="f.href"
          :festival="f"
          :picked="isPicked(f)"
          @pick="onPick(f)"
        />
      </div>
    </section>

    <!-- Organizer CTA -->
    <section class="max-w-4xl mx-auto px-4 py-10">
      <div
        class="rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white"
        style="border:1px solid color-mix(in srgb, var(--wd-cyan-600) 33.3%, transparent); box-shadow: 0 1px 0 color-mix(in srgb, var(--wd-cyan-600) 13.3%, transparent), 0 8px 22px rgba(59,31,18,0.05);"
      >
        <div>
          <div class="text-eyebrow uppercase tracking-[0.3em] font-bold mb-1 text-wd-cyan-600">For organizers</div>
          <h3 class="text-lg font-bold text-foreground">Organize a dance festival?</h3>
          <p class="text-sm mt-1 font-sans text-muted-foreground">
            List your event for free. Ticket it on us.
          </p>
        </div>
        <Button as-child variant="pill" accent="var(--wd-cyan-700)" class="shrink-0">
          <NuxtLink to="/business/events/new?type=Festival">
            Start listing <ArrowRight class="w-4 h-4" aria-hidden="true" />
          </NuxtLink>
        </Button>
      </div>
    </section>

    </main>
    <SiteFooter />

    <!-- Soft year-plan nudge — appears only when the user has picks.
         Same pattern as the /festivals/[slug] plan nudge. YearCanvas
         sidebar + mobile drawer retired; full year view lives on /my-plan. -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 translate-y-2"
        enter-to-class="opacity-100 translate-y-0"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0"
        leave-to-class="opacity-0 translate-y-2"
      >
        <NuxtLink
          v-if="yearCount > 0"
          to="/my-plan"
          class="fixed bottom-[calc(1.25rem+var(--wd-tabbar-h,0px))] right-5 z-40 inline-flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full text-white text-sm font-bold bg-primary shadow-wd-float transition-all"
        >
          <span
            class="inline-flex items-center justify-center w-6 h-6 rounded-full text-meta font-black bg-white text-primary"
          >{{ yearCount }}</span>
          <span class="font-display tracking-[0.01em]">in your year</span>
          <span class="font-hand text-base opacity-85">— see dashboard</span>
          <ArrowRight class="w-4 h-4" />
        </NuxtLink>
      </Transition>
    </Teleport>

    <SignUpModal v-model:open="showSignUp" action="plan" />
  </div>
</template>
