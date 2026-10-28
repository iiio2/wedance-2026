<script setup lang="ts">
/**
 * SiteHeader — the shared V3 navigation used on every dancing-side page.
 *
 * Desktop (sm+): brand · Festivals / Cities / Artists / Find your dance ·
 * My plan (badge) · AccountMenu (profile, year, settings, Business, sign out).
 * Phone: slim top bar (My plan icon + avatar-only AccountMenu when signed in),
 * section chips on the Explore pages, and SiteTabBar (Explore · Cities ·
 * My plan · Me). Chosen from /sketches/nav (prototype E).
 * The Business layout uses the same AccountMenu + SiteTabBar in business mode.
 */
import { CalendarDays, MapPin, Sparkles, Users, Music } from 'lucide-vue-next'

const route = useRoute()
const { appearsSignedIn } = useAccountNav('dance')
const showSignIn = ref(false)

// My plan badge = festivals in the year plan + events in the week plan.
// Loaded by plugins/04.plan.client.ts after hydration, so SSR and the
// client's first render agree (both 0).
const { yearCount } = useYearPlan()
const { weekCount } = useWeekPlan()
const planCount = computed(() => yearCount.value + weekCount.value)

const discover = [
  { to: '/festivals', label: 'Festivals', icon: Sparkles },
  { to: '/cities', label: 'Cities', icon: MapPin },
  { to: '/artists', label: 'Artists', icon: Users },
  { to: '/find-your-dance', label: 'Find your dance', icon: Music },
]
const exploreChips = discover.filter(l => l.to !== '/cities')
const EXPLORE_ROOTS = ['/festivals', '/artists', '/find-your-dance']

function under(path: string) {
  return route.path === path || route.path.startsWith(`${path}/`)
}
const onExploreIndex = computed(() => route.path === '/' || EXPLORE_ROOTS.includes(route.path))
const onPlan = computed(() => under('/my-plan') || under('/my-year'))
</script>

<template>
  <header class="border-b border-border">
    <div class="max-w-6xl mx-auto px-4 h-14 sm:h-16 flex items-center gap-6">
      <Brand class="shrink-0" />

      <!-- Desktop: public sections -->
      <nav class="hidden sm:flex items-center gap-5 text-sm self-stretch" aria-label="Main">
        <NuxtLink
          v-for="l in discover"
          :key="l.to"
          :to="l.to"
          class="relative flex items-center transition-colors"
          :class="under(l.to) ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'"
        >
          {{ l.label }}
          <span v-if="under(l.to)" class="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
        </NuxtLink>
      </nav>

      <div class="ml-auto flex items-center gap-4">
        <template v-if="appearsSignedIn">
          <NuxtLink
            to="/my-plan"
            class="flex items-center gap-1.5 text-sm font-semibold transition-colors"
            :class="onPlan ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'"
            aria-label="My plan"
          >
            <CalendarDays class="w-5 h-5" />
            <span class="hidden sm:inline">My plan</span>
            <span
              v-if="planCount > 0"
              class="bg-primary text-primary-foreground text-[10px] font-bold min-w-4 h-4 rounded-full grid place-items-center px-1"
            >{{ planCount }}</span>
          </NuxtLink>
          <AccountMenu mode="dance" />
        </template>
        <template v-else>
          <NuxtLink to="/for-organizers" class="hidden sm:inline text-sm text-muted-foreground hover:text-foreground">For organizers</NuxtLink>
          <Button
            type="button"
            variant="pill"
            size="pill-sm"
            class="h-7 shrink-0"
            @click="showSignIn = true"
          >Sign in</Button>
        </template>
      </div>
    </div>

    <!-- Phone: section chips on the Explore pages -->
    <nav v-if="onExploreIndex" class="sm:hidden px-4 pb-3 flex gap-2 overflow-x-auto text-xs" aria-label="Explore">
      <NuxtLink
        v-for="l in exploreChips"
        :key="l.to"
        :to="l.to"
        class="shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-full border font-semibold"
        :class="under(l.to) ? 'border-primary bg-primary/10 text-wd-red-800' : 'border-border text-muted-foreground'"
      ><component :is="l.icon" class="w-3.5 h-3.5" />{{ l.label }}</NuxtLink>
    </nav>

    <SiteTabBar mode="dance" :plan-count="planCount" />
    <SignUpModal v-model:open="showSignIn" action="signin" />
  </header>
</template>
