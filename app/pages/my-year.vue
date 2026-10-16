<script setup lang="ts">
import type { YearPlanFestival, DanceRole } from '~/types/festival'
import { Button } from '~/components/ui/button'
import { festivalPath } from '#shared/utils/eventSlug'

definePageMeta({ layout: false })

const route = useRoute()
const router = useRouter()
const { $trpc } = useNuxtApp()
const { isSignedIn, username: myUsername } = useAuth()
const { yearPlanIds } = useYearPlan()

// Progress store — reads the same localStorage key as my-plan.vue so the
// partner match rate on My Year stays in sync with the per-festival
// "Partner found" toggle on My Plan.
const PROGRESS_KEY = 'wedance-plan-progress'
const progressStore = ref<Record<string, Partial<Record<string, boolean>>>>({})

function loadProgress() {
  if (typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(PROGRESS_KEY)
    if (raw) progressStore.value = JSON.parse(raw)
  } catch { /* corrupt payload — treat as empty */ }
}

// Shared view detection — ?user=<username>.
const sharerUsername = computed(() => {
  const u = route.query.user as string | undefined
  if (!u) return ''
  return u === 'shared' ? '' : u
})
const isSharedView = computed(() => !!route.query.user)
const referralCode = computed(() => (route.query.ref as string) || '')

// ── Shared view data ──
const sharedData = ref<{
  sharer: { name: string; photo: string | null; role: 'lead' | 'follow' | null; username: string | null }
  festivals: Array<{
    slug: string; name: string; startDate: string; endDate: string
    location: string; country: string; logo: string; accentColor: string; styles: string[]
    workshopCount: number; hasTicket: boolean; referralDiscountPercent: number
    ticketUrl: string; earlyBirdDeadline: string; earlyBirdOffer: string
  }>
} | null>(null)

// ── Own view data ──
const myFestivalsRaw = ref<Array<{
  slug: string; name: string; startDate: string; endDate: string
  location: string; country: string; logo: string; accentColor: string; styles: string[]
  workshopCount: number; ticketStatus: 'purchased' | 'not-purchased'; referralDiscountPercent: number
  ticketUrl: string; earlyBirdDeadline: string; earlyBirdOffer: string
}>>([])

// friendsGoing per festival slug (fetched in batch after plan loads)
const goingBySlug = ref<Record<string, Array<{ name: string; photo: string | null; username: string | null }>>>({})

async function fetchGoingBatch(slugs: string[]) {
  if (slugs.length === 0) return
  try {
    goingBySlug.value = await $trpc.plan.goingBatch.query({ itemType: 'festival', itemIds: slugs })
  } catch { /* non-critical */ }
}

// ── Suggestions data ──
const suggestionsRaw = ref<Array<{
  slug: string; name: string; startDate: string; endDate: string
  location: string; country: string; logo: string; accentColor: string; styles: string[]
  signupCount: number
}>>([])

function fetchMyPlan() {
  if (!isSignedIn.value) return
  $trpc.plan.myPlan.query().then((rows) => {
    myFestivalsRaw.value = rows
    fetchGoingBatch(rows.map(r => r.slug))
  }).catch(() => {})
}

function fetchSuggestions() {
  $trpc.plan.suggestions.query().then((rows) => {
    suggestionsRaw.value = rows
  }).catch(() => {})
}

// All client-only data loading runs in onMounted so the initial (hydration)
// render matches the server — server renders with empty state, client hydrates
// identically, THEN loads real data. Running localStorage reads or tRPC queries
// during setup (import.meta.client) caused a hydration mismatch: the server
// rendered partnerMatchRate=0 while the client read a non-zero value from
// localStorage during setup, producing different initial HTML.
function onStorageChange(e: StorageEvent) {
  if (e.key === PROGRESS_KEY) loadProgress()
}

onMounted(() => {
  // Read progress from localStorage after hydration is complete.
  loadProgress()
  // Re-read when the user comes back from my-plan (another tab writes localStorage).
  window.addEventListener('storage', onStorageChange)

  // Fetch plan data.
  if (isSharedView.value && sharerUsername.value) {
    $trpc.plan.sharedPlan.query({ username: sharerUsername.value }).then((result) => {
      sharedData.value = result
      if (result?.festivals.length) {
        fetchGoingBatch(result.festivals.map(f => f.slug))
      }
    }).catch(() => {})
  }

  fetchMyPlan()
  fetchSuggestions()

  // Re-fetch when the plan changes (add/remove festival) so stats update.
  watch(yearPlanIds, () => {
    fetchMyPlan()
    fetchSuggestions()
  })
})

onUnmounted(() => {
  window.removeEventListener('storage', onStorageChange)
})

// Map shared data into YearPlanFestival shape.
const sharedFestivals = computed<YearPlanFestival[]>(() => {
  if (!sharedData.value) return []
  return sharedData.value.festivals.map((f) => ({
    slug: f.slug,
    name: f.name,
    startDate: f.startDate,
    endDate: f.endDate,
    location: f.location,
    country: f.country,
    logo: f.logo,
    accentColor: f.accentColor,
    styles: f.styles,
    workshopCount: f.workshopCount,
    role: null,
    lookingCount: 0,
    ticketStatus: f.hasTicket ? 'purchased' as const : 'not-purchased' as const,
    friendsGoing: (goingBySlug.value[f.slug] ?? []).map(d => ({ name: d.name, photo: d.photo ?? '' })),
    referralDiscountPercent: f.referralDiscountPercent,
    earlyBirdDeadline: f.earlyBirdDeadline || undefined,
    earlyBirdOffer: f.earlyBirdOffer || undefined,
    ticketUrl: f.ticketUrl || undefined,
  }))
})

// Map own data into YearPlanFestival shape.
const myFestivals = computed<YearPlanFestival[]>(() => {
  return myFestivalsRaw.value.map((f) => ({
    slug: f.slug,
    name: f.name,
    startDate: f.startDate,
    endDate: f.endDate,
    location: f.location,
    country: f.country,
    logo: f.logo,
    accentColor: f.accentColor,
    styles: f.styles,
    workshopCount: f.workshopCount,
    role: null,
    lookingCount: 0,
    ticketStatus: f.ticketStatus,
    friendsGoing: (goingBySlug.value[f.slug] ?? []).map(d => ({ name: d.name, photo: d.photo ?? '' })),
    referralDiscountPercent: f.referralDiscountPercent,
    earlyBirdDeadline: f.earlyBirdDeadline || undefined,
    earlyBirdOffer: f.earlyBirdOffer || undefined,
    ticketUrl: f.ticketUrl || undefined,
  }))
})

// Map suggestions into YearPlanFestival shape.
const suggestions = computed<YearPlanFestival[]>(() => {
  return suggestionsRaw.value.map((f) => ({
    slug: f.slug,
    name: f.name,
    startDate: f.startDate,
    endDate: f.endDate,
    location: f.location,
    country: f.country,
    logo: f.logo,
    accentColor: f.accentColor,
    styles: f.styles,
    workshopCount: 0,
    role: null,
    lookingCount: 0,
    ticketStatus: 'not-purchased' as const,
    friendsGoing: [],
  }))
})

// Viewer's own festival slugs (for overlap detection in shared view).
const viewerFestivalSlugs = computed(() => myFestivalsRaw.value.map((f) => f.slug))

const sharer = computed(() => {
  if (!sharedData.value) return { name: '', photo: '', role: null as DanceRole | null }
  return {
    name: sharedData.value.sharer.name,
    photo: sharedData.value.sharer.photo ?? '',
    role: sharedData.value.sharer.role as DanceRole | null,
  }
})

const stats = computed(() => {
  const fests = myFestivals.value
  const countries = [...new Set(fests.map((f) => f.country).filter(Boolean))]
  const cities = [...new Set(fests.map((f) => f.location).filter(Boolean))]

  const styleMap = new Map<string, number>()
  for (const f of fests) {
    for (const s of f.styles) {
      styleMap.set(s, (styleMap.get(s) ?? 0) + 1)
    }
  }
  const total = [...styleMap.values()].reduce((a, b) => a + b, 0) || 1
  const topStyles = [...styleMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([style, count]) => ({ style, percent: Math.round((count / total) * 100) }))

  // Total dance days (sum of festival durations)
  let totalDanceDays = 0
  for (const f of fests) {
    if (f.startDate && f.endDate) {
      const start = new Date(f.startDate)
      const end = new Date(f.endDate)
      totalDanceDays += Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1)
    }
  }

  // Unique friends across all festivals
  const friendNames = new Set<string>()
  for (const f of fests) {
    for (const fr of f.friendsGoing) {
      friendNames.add(fr.name)
    }
  }

  // Tickets purchased
  const ticketsPurchased = fests.filter((f) => f.ticketStatus === 'purchased').length

  // Busiest month
  const monthCounts = new Map<string, number>()
  for (const f of fests) {
    if (f.startDate) {
      const month = new Date(f.startDate).toLocaleString('en', { month: 'long' })
      monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1)
    }
  }
  const busiestMonth = [...monthCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''

  // Festival season span
  let festivalSeason = ''
  if (fests.length > 0) {
    const sorted = [...fests].sort((a, b) => a.startDate.localeCompare(b.startDate))
    const firstMonth = new Date(sorted[0].startDate).toLocaleString('en', { month: 'short' })
    const lastMonth = new Date(sorted[sorted.length - 1].startDate).toLocaleString('en', { month: 'short' })
    festivalSeason = firstMonth === lastMonth ? firstMonth : `${firstMonth} – ${lastMonth}`
  }

  // Achievements
  const achievements: { id: string; label: string; icon: string }[] = []
  if (countries.length >= 3) achievements.push({ id: 'globe-trotter', label: 'Globe Trotter', icon: '🌍' })
  if (fests.length >= 5) achievements.push({ id: 'festival-addict', label: 'Festival Addict', icon: '🎪' })
  if (totalDanceDays >= 20) achievements.push({ id: 'marathon-dancer', label: 'Marathon Dancer', icon: '💃' })
  if (styleMap.size >= 4) achievements.push({ id: 'style-explorer', label: 'Style Explorer', icon: '🎨' })
  if (ticketsPurchased >= 3) achievements.push({ id: 'early-bird', label: 'Ticket Collector', icon: '🎟️' })
  if (friendNames.size >= 5) achievements.push({ id: 'social-butterfly', label: 'Social Butterfly', icon: '🦋' })
  if (fests.length >= 10) achievements.push({ id: 'unstoppable', label: 'Unstoppable', icon: '🔥' })
  if (cities.length >= 5) achievements.push({ id: 'city-hopper', label: 'City Hopper', icon: '✈️' })

  return {
    totalFestivals: fests.length,
    totalWorkshops: fests.reduce((sum, f) => sum + f.workshopCount, 0),
    countries,
    cities,
    topStyles,
    partnerMatchRate: fests.length === 0
      ? 0
      : Math.round(
          (fests.filter((f) => progressStore.value[f.slug]?.partnerFound).length / fests.length) * 100,
        ),
    totalDanceDays,
    totalFriends: friendNames.size,
    ticketsPurchased,
    busiestMonth,
    festivalSeason,
    achievements,
  }
})

// Share modal
const showShareModal = ref(false)
const showSignIn = ref(false)
const signInAction = ref('signin')

function promptSignIn(action: string) {
  signInAction.value = action
  showSignIn.value = true
}

function openFestival(slug: string) {
  if (isSharedView.value) {
    const query: Record<string, string> = { plan: 'shared' }
    if (referralCode.value) query.ref = referralCode.value
    router.push({ path: `${festivalPath(slug)}`, query })
  } else {
    router.push(`${festivalPath(slug)}`)
  }
}

function onCreateYearPlan() {
  if (!isSignedIn.value) {
    promptSignIn('save')
    return
  }
  router.replace({ query: {} })
}

function onBrowseFestivals() {
  navigateTo('/festivals')
}

function onAddFestival(slug: string) {
  if (!isSignedIn.value) {
    promptSignIn('going')
    return
  }
  const { addFestival } = useYearPlan()
  addFestival(slug)
}

function onAddFriend() {
  useTrack().track('shared_plan_signup', { surface: 'my-year', sharer: sharer.value.name })
  if (!isSignedIn.value) {
    promptSignIn('social')
    return
  }
  navigateTo('/onboarding')
}

useHead({
  title: isSharedView.value
    ? `${sharer.value.name || 'A dancer'}'s 2026 Dance Year | WeDance`
    : 'My 2026 Dance Year | WeDance',
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />

    <main>
    <!-- Shared view -->
    <SharedYearPlan
      v-if="isSharedView && sharedData"
      :sharer="sharer"
      :festivals="sharedFestivals"
      :viewer-festival-slugs="viewerFestivalSlugs"
      :referral-code="referralCode"
      @add-friend="onAddFriend"
      @open-festival="openFestival"
      @create-year-plan="onCreateYearPlan"
      @sign-in="onAddFriend"
    />

    <!-- Loading / not found for shared view -->
    <div v-else-if="isSharedView && !sharedData" class="max-w-3xl mx-auto px-4 py-16 text-center">
      <h1 class="text-muted-foreground">This year plan is not available.</h1>
      <Button class="mt-4" @click="onCreateYearPlan">
        Create your own year plan
      </Button>
    </div>

    <!-- Own year plan -->
    <template v-else>
      <YearPlan
        :festivals="myFestivals"
        :suggestions="suggestions"
        :stats="stats"
        :is-signed-in="isSignedIn"
        @open-festival="openFestival"
        @add-festival="onAddFestival"
        @share="showShareModal = true"
        @sign-in="promptSignIn('signin')"
        @browse-festivals="onBrowseFestivals"
      />

      <ShareYearPlanModal
        v-model:open="showShareModal"
        :festivals="myFestivals"
        sharer-name="You"
      />
    </template>

    <SignUpModal v-model:open="showSignIn" :action="signInAction" />
    </main>

    <SiteFooter />
  </div>
</template>
