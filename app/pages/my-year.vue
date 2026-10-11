<script setup lang="ts">
import type { YearPlanFestival, DanceRole } from '~/types/festival'
import { Button } from '~/components/ui/button'

definePageMeta({ layout: false })

const route = useRoute()
const router = useRouter()
const { $trpc } = useNuxtApp()
const { isSignedIn, username: myUsername } = useAuth()
const { yearPlanIds } = useYearPlan()

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

function fetchMyPlan() {
  if (!isSignedIn.value) return
  $trpc.plan.myPlan.query().then((rows) => {
    myFestivalsRaw.value = rows
  }).catch(() => {})
}

// Fetch data on mount.
if (import.meta.client) {
  if (isSharedView.value && sharerUsername.value) {
    $trpc.plan.sharedPlan.query({ username: sharerUsername.value }).then((result) => {
      sharedData.value = result
    }).catch(() => {})
  }

  fetchMyPlan()

  // Re-fetch when the plan changes (add/remove festival) so stats update.
  watch(yearPlanIds, fetchMyPlan)
}

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
    friendsGoing: [],
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
    friendsGoing: [],
    referralDiscountPercent: f.referralDiscountPercent,
    earlyBirdDeadline: f.earlyBirdDeadline || undefined,
    earlyBirdOffer: f.earlyBirdOffer || undefined,
    ticketUrl: f.ticketUrl || undefined,
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

  return {
    totalFestivals: fests.length,
    totalWorkshops: fests.reduce((sum, f) => sum + f.workshopCount, 0),
    countries,
    topStyles,
    partnerMatchRate: 0,
  }
})

// Share modal
const showShareModal = ref(false)

function openFestival(slug: string) {
  if (isSharedView.value) {
    const query: Record<string, string> = { plan: 'shared' }
    if (referralCode.value) query.ref = referralCode.value
    router.push({ path: `/festivals/${slug}`, query })
  } else {
    router.push(`/festivals/${slug}`)
  }
}

function onCreateYearPlan() {
  router.replace({ query: {} })
}

function onAddFriend() {
  useTrack().track('shared_plan_signup', { surface: 'my-year', sharer: sharer.value.name })
  navigateTo('/onboarding')
}

useHead({
  title: isSharedView.value
    ? `${sharer.value.name || 'A dancer'}'s 2026 Dance Year | WeDance`
    : 'My 2026 Dance Year | WeDance',
})
</script>

<template>
  <div class="min-h-screen" style="background:var(--wd-cream); color:var(--wd-brown-900); font-family:var(--wd-font-display);">
    <SiteHeader />

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
      <p style="color:var(--wd-brown-700);">This year plan is not available.</p>
      <Button class="mt-4" @click="onCreateYearPlan">
        Create your own year plan
      </Button>
    </div>

    <!-- Own year plan -->
    <template v-else>
      <YearPlan
        :festivals="myFestivals"
        :suggestions="[]"
        :stats="stats"
        :is-signed-in="isSignedIn"
        @open-festival="openFestival"
        @share="showShareModal = true"
        @sign-in="() => {}"
      />

      <ShareYearPlanModal
        v-model:open="showShareModal"
        :festivals="myFestivals"
        sharer-name="You"
      />
    </template>

    <SiteFooter />
  </div>
</template>
