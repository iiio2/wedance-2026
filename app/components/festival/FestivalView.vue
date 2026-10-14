<script setup lang="ts">
import type { Festival, Teacher, Workshop, PlanEntry, DanceRole, DancePartner, FestivalFriend, PartnerMatch, ExtraActivity, SwipeCard, FreemiumState } from '~/types/festival'
import { ArrowRight, Sparkles, Check, Pencil } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { artistPlaces, artistLanguages } from '~/data/artists'
import { WD } from '~/lib/brand'
import { accentText } from '~/lib/accent'

// Status chip text on its own 9 % tint — darkened where the hue is too light for 4.5:1.
const CHIP = {
  green: accentText(WD.green600),
  cyan: accentText(WD.cyan600),
  purple: accentText(WD.purple500),
  amber: accentText(WD.amber500),
}

const route = useRoute()
const router = useRouter()

// The festival, its workshops and teachers come from the event (events.festival
// query, server/utils/festivalView.ts); this component renders them.
const props = defineProps<{
  data: { festival: Festival; workshops: Workshop[]; teachers: Teacher[]; eventId: string }
  /** Set for the festival's managers (and admins): the Business editor. */
  editTo?: string
  /** The event's type ("Weekender"), for the wording: "You manage this weekender". */
  type?: string | null
}>()
const kind = computed(() => (props.type || 'festival').toLowerCase())
const data = props.data
const festival = data.festival
const workshops = data.workshops
const teachers = data.teachers
const slug = festival.slug

// Live "planning" count from the DB — replaces the hardcoded mock value.
const liveAttendeeCount = ref(festival.attendeeCount)
const heroFestival = computed(() => ({ ...festival, attendeeCount: liveAttendeeCount.value }))

// Fetch the real count client-side (public, no auth required).
const { $trpc } = useNuxtApp()
onMounted(async () => {
  try {
    const count = await $trpc.plan.count.query({ itemType: 'festival', itemId: festival.slug })
    liveAttendeeCount.value = count
  } catch { /* keep mock fallback */ }
})

// Festival-level "Pick" — adds the whole festival to the year plan (distinct
// from the per-workshop picks below).
const { yearPlanIds, toggleFestival } = useYearPlan()

// Shared plan view detection — supports both the new `?invite=<encoded>` token
// and the legacy `?plan=shared` query for backward compatibility.
const { decode: decodeSharePlan } = useSharePlan()

const decodedShare = computed(() => {
  const token = route.query.invite as string | undefined
  if (token) return decodeSharePlan(token)
  return null
})

const isSharedView = computed(() => !!decodedShare.value || route.query.plan === 'shared')
const hasReferral = computed(() => !!route.query.ref)
const referralCode = computed(() => (route.query.ref as string) || '')

// Validate the referral code against the backend and get referrer info.
const referralInfo = ref<{ referrerName: string; referrerUsername: string | null; discountPercent: number } | null>(null)

if (import.meta.client && referralCode.value) {
  $trpc.referral.validate.query({
    festivalSlug: festival.slug,
    referralCode: referralCode.value,
  }).then((result) => {
    referralInfo.value = result
  }).catch(() => { /* ignore validation errors */ })
}

// Shared-plan data: decoded from the invite token when available, otherwise
// a lightweight fallback so the legacy `?plan=shared` URL still renders.
const sharer = computed(() => {
  if (decodedShare.value) {
    return {
      name: decodedShare.value.name,
      photo: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(decodedShare.value.name)}`,
      role: decodedShare.value.role,
    }
  }
  // Legacy fallback
  return { name: 'A dancer', photo: 'https://api.dicebear.com/7.x/initials/svg?seed=WD', role: 'follow' as DanceRole }
})

const sharerPlan = computed(() => {
  if (decodedShare.value) return decodedShare.value.plan
  return [] as { workshopId: string; role: DanceRole | null; partnerStatus: string }[]
})

function onCreatePlan() {
  router.replace({ query: {} })
}

function onBePartner(workshopId: string) {
  if (!isSignedIn.value) {
    signUpAction.value = 'partner'
    showSignUp.value = true
    return
  }
  // Add the workshop to user's plan and scroll to schedule
  toggleWorkshop(workshopId)
  router.replace({ query: {} })
  nextTick(() => scrollTo('schedule'))
}

const days = [...new Set(workshops.map((w) => w.day))]
const styles = [...new Set(workshops.map((w) => w.style))]

// Auth state (needed early for workshop persistence)
const { isSignedIn, danceStyles: myDanceStyles, role: myRole, city: myCity, onboardedAt, completeOnboarding, updateProfile } = useAuth()

// Plan state
const plan = ref(new Map<string, PlanEntry>())
const planIds = computed(() => new Set(plan.value.keys()))

// Partners list
const partners = ref<DancePartner[]>([])

// Role picker modal
const showRolePicker = ref(false)
const rolePickerWorkshopId = ref<string | null>(null)
const rememberedRole = ref<DanceRole | null>(null)
const rememberedHasPartner = ref<boolean | null>(null)
const rememberedPartnerId = ref<string | undefined>(undefined)

const rolePickerTitle = computed(() => {
  if (!rolePickerWorkshopId.value) return ''
  return workshops.find((w) => w.id === rolePickerWorkshopId.value)?.title || ''
})

function removeConflicting(next: Map<string, PlanEntry>, workshop: Workshop) {
  // Remove any existing pick at the same day+time (different room)
  if (workshop.type === 'party') return
  for (const [existingId] of next) {
    const existing = workshops.find((w) => w.id === existingId)
    if (existing && existing.id !== workshop.id && existing.type !== 'party' && existing.day === workshop.day && existing.time === workshop.time) {
      next.delete(existingId)
      persistWorkshopRemove(existingId)
    }
  }
}

function toggleWorkshop(id: string) {
  const next = new Map(plan.value)
  if (next.has(id)) {
    next.delete(id)
    persistWorkshopRemove(id)
    plan.value = next
  } else {
    const workshop = workshops.find((w) => w.id === id)
    if (workshop?.type === 'party') {
      // Parties don't need role/partner — add directly
      next.set(id, { workshopId: id, role: null, partnerStatus: 'solo' })
      persistWorkshopAdd(id)
      plan.value = next
    } else if (workshop && rememberedRole.value && rememberedHasPartner.value !== null) {
      // Both role and partner answer remembered — skip modal entirely
      removeConflicting(next, workshop)
      next.set(id, {
        workshopId: id,
        role: rememberedRole.value,
        partnerStatus: rememberedHasPartner.value ? 'with-partner' : 'looking',
        partnerId: rememberedHasPartner.value ? rememberedPartnerId.value : undefined,
      })
      persistWorkshopAdd(id)
      plan.value = next
    } else {
      rolePickerWorkshopId.value = id
      showRolePicker.value = true
    }
  }
}

function onRoleConfirm(role: DanceRole, hasPartner: boolean, remember: boolean, partnerId?: string) {
  const id = rolePickerWorkshopId.value
  if (!id) return
  if (remember) {
    rememberedRole.value = role
    rememberedHasPartner.value = hasPartner
    rememberedPartnerId.value = partnerId
  }
  const workshop = workshops.find((w) => w.id === id)
  const next = new Map(plan.value)
  if (workshop) removeConflicting(next, workshop)
  next.set(id, {
    workshopId: id,
    role,
    partnerStatus: hasPartner ? 'with-partner' : 'looking',
    partnerId: hasPartner ? partnerId : undefined,
  })
  persistWorkshopAdd(id)
  plan.value = next
}

function addPartner(name: string): DancePartner {
  const partner: DancePartner = { id: crypto.randomUUID(), name }
  partners.value = [...partners.value, partner]
  return partner
}

function removeFromPlan(id: string) {
  const next = new Map(plan.value)
  next.delete(id)
  persistWorkshopRemove(id)
  plan.value = next
}

function updatePlanEntry(id: string, updates: Partial<PlanEntry>) {
  const entry = plan.value.get(id)
  if (!entry) return
  const next = new Map(plan.value)
  next.set(id, { ...entry, ...updates })
  plan.value = next
}

// ── Persist workshop selections ─────────────────────────────────────
// Workshop plan items are stored in plan_items with itemType='workshop'
// and itemId='{festivalSlug}:{workshopId}' so the year plan can count them.
const persistedWorkshopIds = ref(new Set<string>())

// Per-workshop mutation queue: serializes add/remove so rapid toggles
// (add→remove→add) don't race. Each key maps to the tail promise of
// that workshop's chain.
const mutationQueue = new Map<string, Promise<void>>()

// Removals made while the initial plan.list query is still in flight.
// These are reconciled when the list arrives so we don't accidentally
// restore a workshop the user already removed.
const pendingRemovals = new Set<string>()
const listLoading = ref(false)

function enqueue(workshopId: string, fn: () => Promise<void>): void {
  const prev = mutationQueue.get(workshopId) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  mutationQueue.set(workshopId, next)
}

function persistWorkshopAdd(workshopId: string) {
  if (!isSignedIn.value) return
  pendingRemovals.delete(workshopId)
  if (persistedWorkshopIds.value.has(workshopId)) return
  persistedWorkshopIds.value.add(workshopId)
  enqueue(workshopId, () =>
    $trpc.plan.add
      .mutate({ itemType: 'workshop', itemId: `${slug}:${workshopId}` })
      .catch(() => { persistedWorkshopIds.value.delete(workshopId) }),
  )
}

function persistWorkshopRemove(workshopId: string) {
  if (!isSignedIn.value) return
  // If the initial list hasn't loaded yet, record the intent so we can
  // reconcile when it arrives — don't silently discard the removal.
  if (listLoading.value) {
    pendingRemovals.add(workshopId)
  }
  if (!persistedWorkshopIds.value.has(workshopId)) return
  persistedWorkshopIds.value.delete(workshopId)
  enqueue(workshopId, () =>
    $trpc.plan.remove
      .mutate({ itemType: 'workshop', itemId: `${slug}:${workshopId}` })
      .catch(() => { persistedWorkshopIds.value.add(workshopId) }),
  )
}

// Load persisted workshops and reconcile with the local plan.
// Called on mount (if already signed in) and again when isSignedIn
// becomes true (sign-in on an already-open page).
async function loadPersistedWorkshops() {
  if (!isSignedIn.value) return
  listLoading.value = true
  try {
    const items = await $trpc.plan.list.query()
    const prefix = `${slug}:`
    const loaded = new Map<string, PlanEntry>()
    for (const item of items) {
      if (item.itemType === 'workshop' && item.itemId.startsWith(prefix)) {
        const workshopId = item.itemId.slice(prefix.length)
        // If the user removed this workshop while the list was loading,
        // send the server-side removal instead of restoring it.
        if (pendingRemovals.has(workshopId)) {
          pendingRemovals.delete(workshopId)
          persistedWorkshopIds.value.add(workshopId)
          persistWorkshopRemove(workshopId)
          continue
        }
        persistedWorkshopIds.value.add(workshopId)
        if (!plan.value.has(workshopId)) {
          loaded.set(workshopId, { workshopId, role: null, partnerStatus: 'solo' })
        }
      }
    }
    if (loaded.size > 0) {
      const merged = new Map(plan.value)
      for (const [k, v] of loaded) merged.set(k, v)
      plan.value = merged
    }

    // Persist any guest selections that aren't on the server yet
    // (user picked workshops before signing in).
    for (const workshopId of plan.value.keys()) {
      if (!persistedWorkshopIds.value.has(workshopId)) {
        persistWorkshopAdd(workshopId)
      }
    }
  } catch { /* keep local state */ }
  finally {
    listLoading.value = false
    pendingRemovals.clear()
  }
}

if (import.meta.client) {
  onMounted(() => { loadPersistedWorkshops() })

  // When the user signs in on an already-open page, load their
  // persisted plan and push any guest selections to the server.
  watch(isSignedIn, (signed) => {
    if (signed) loadPersistedWorkshops()
  })
}

// Teacher filter
const selectedTeacherId = ref<string | null>(null)
const selectedTeacher = computed(() =>
  teachers.find((t) => t.id === selectedTeacherId.value) || null,
)

// Lineup cards — face-forward artist cards (shared with /artists) with
// origin + residence. Clicking one filters the schedule to that teacher.
const lineupAccents = [WD.red600, WD.cyan600, WD.green600, WD.purple500, WD.amber500, WD.pink500, WD.violet600]
const lineupCards = teachers.map((teacher, i) => {
  const places = artistPlaces(teacher)
  return {
    teacher,
    accent: lineupAccents[i % lineupAccents.length],
    ...places,
    languages: artistLanguages(places.origin, places.residence),
  }
})

function toggleTeacherFilter(id: string) {
  selectedTeacherId.value = selectedTeacherId.value === id ? null : id
  nextTick(() => scrollTo('schedule'))
}

// Friends and partner matches: none until they come from real data (no
// made-up people on an event page).
const friends = computed<FestivalFriend[]>(() => [])
const partnerMatches = computed<PartnerMatch[]>(() => [])

// Discover dancers are now loaded by the DiscoverDancers component itself
// via tRPC (wave.discoverPool) — no mock data needed here.

// Payment success confirmation
const showPaymentSuccess = ref(false)
const paymentSuccessInfo = ref<{ festivalName: string; ticketName: string; amount: number } | null>(null)
let paymentSuccessTimer: ReturnType<typeof setTimeout> | undefined

// Profile nudge after ticket purchase
const profileIncomplete = computed(() =>
  isSignedIn.value && (!myDanceStyles.value?.length || !myRole.value),
)
const showProfileNudge = ref(false)
const nudgeForm = reactive({
  danceStyles: [] as string[],
  role: '' as '' | 'lead' | 'follow' | 'both',
})
const nudgeSaving = ref(false)

async function submitNudge() {
  if (!nudgeForm.danceStyles.length || !nudgeForm.role) return
  nudgeSaving.value = true
  try {
    if (onboardedAt.value) {
      await updateProfile({ danceStyles: [...nudgeForm.danceStyles], role: nudgeForm.role })
    } else {
      await completeOnboarding({ intent: 'festivals', danceStyles: [...nudgeForm.danceStyles], role: nudgeForm.role })
    }
    showProfileNudge.value = false
  } catch {
    // best-effort — let the user continue to the festival page
    showProfileNudge.value = false
  } finally {
    nudgeSaving.value = false
  }
}

function dismissPaymentSuccess() {
  showPaymentSuccess.value = false
  paymentSuccessInfo.value = null
  if (paymentSuccessTimer) clearTimeout(paymentSuccessTimer)
  // After dismissing payment success, show the profile nudge if incomplete
  if (profileIncomplete.value) {
    showProfileNudge.value = true
  }
}

// Group dinners — fetched from database via composable
const { dinners: groupDinners, loadDinners, joinDinner: doJoinDinner, leaveDinner: doLeaveDinner } = useDinners(festival.slug)

onMounted(async () => {
  loadDinners()
  loadRideShares()
  loadRoommateStatus()
  await loadFreemiumStatus()

  // Handle redirect back from Stripe Checkout
  if (route.query.payment === 'success') {
    // Webhook may take a moment — poll briefly
    let attempts = 0
    while (!freemiumState.value.userUnlocked && attempts < 5) {
      await new Promise(r => setTimeout(r, 1000))
      await loadFreemiumStatus()
      attempts++
    }

    // Show success confirmation
    const stored = sessionStorage.getItem('wedance_checkout')
    if (stored) {
      paymentSuccessInfo.value = JSON.parse(stored)
      sessionStorage.removeItem('wedance_checkout')
    } else {
      paymentSuccessInfo.value = { festivalName: festival.name, ticketName: 'Festival Pass', amount: 0 }
    }
    showPaymentSuccess.value = true
    // Don't auto-dismiss when profile is incomplete — let the user see the
    // success, then tap "Let's go" to reach the profile nudge.
    if (!profileIncomplete.value) {
      paymentSuccessTimer = setTimeout(dismissPaymentSuccess, 8000)
    }

    // Clean up URL
    router.replace({ query: { ...route.query, payment: undefined } })
  } else if (route.query.payment === 'cancel') {
    router.replace({ query: { ...route.query, payment: undefined } })
  }
})

function joinDinner(id: string) {
  tryUnlockSocialActivity(() => {
    doJoinDinner(id).catch(() => {})
  })
}

function leaveDinner(id: string) {
  doLeaveDinner(id).catch(() => {})
}

// Extra activities: none until they come from real data (the old demo list
// put a Vienna walking tour on every festival page).
const extraActivities = ref<ExtraActivity[]>([])

function joinActivity(id: string) {
  tryUnlockSocialActivity(() => {
    const a = extraActivities.value.find(x => x.id === id)
    if (a && !a.userJoined) {
      a.userJoined = true
      a.participantCount++
    }
  })
}

// Ride shares — persisted in database
const { rideShares, loadRideShares, postRide: doPostRide } = useRideShares(festival.slug)

function postRide(ride: { type: 'offering' | 'looking'; originCity: string; date: string; seats?: number; contactLink?: string }) {
  if (!isSignedIn.value) {
    signUpAction.value = 'social'
    showSignUp.value = true
    return
  }
  doPostRide(ride).catch(() => {})
}

// Roommate toggle — persisted in database
const { lookingForRoommate, roommateOthers, loadRoommateStatus, toggleRoommate: doToggleRoommate } = useRoommates(festival.slug)

// Hotel search fallback URL for when no roommates are found
const hotelSearchUrl = computed(() => {
  const loc = festival.venue?.address || festival.venue?.name || ''
  if (!loc) return undefined
  const q = encodeURIComponent(loc)
  const params = new URLSearchParams({ q })
  if (festival.startDate) params.set('checkin', festival.startDate)
  if (festival.endDate) params.set('checkout', festival.endDate)
  return `https://www.google.com/travel/hotels?${params.toString()}`
})

function toggleRoommate() {
  if (!isSignedIn.value) {
    signUpAction.value = 'social'
    showSignUp.value = true
    return
  }
  doToggleRoommate().catch(() => {})
}

// Freemium state — loaded from backend
const freemiumState = ref<FreemiumState>({
  totalSignups: 0,
  maxFreeSpots: 10,
  userUnlocked: false,
  verifiedTicketHolder: false,
  paymentUrl: 'https://buy.stripe.com/placeholder',
})

async function loadFreemiumStatus() {
  try {
    const result = await $trpc.festivalSignup.status.query({ festivalSlug: festival.slug })
    freemiumState.value.totalSignups = result.totalSignups
    freemiumState.value.maxFreeSpots = result.maxFreeSpots
    freemiumState.value.userUnlocked = result.userSignedUp
    freemiumState.value.verifiedTicketHolder = result.verifiedTicketHolder
    if (result.stripePaymentLink) {
      freemiumState.value.paymentUrl = result.stripePaymentLink
    }
  } catch (e) {
    console.warn('Failed to load freemium status:', e)
  }
}

// Rides, dinners and activities are free: signing in is the only gate.
function tryUnlockSocialActivity(action: () => void) {
  if (!isSignedIn.value) {
    onSignIn('social')
    return
  }
  action()
}

// Extra cards (dinner, activity, onboarding) interleaved into the swipe deck
// by DiscoverDancers. Dancer cards come from the component's own tRPC query.
const extraSwipeCards = computed<SwipeCard[]>(() => {
  const dinners: SwipeCard[] = groupDinners.value.map(d => ({ ...d, cardType: 'dinner' as const }))
  const activities: SwipeCard[] = extraActivities.value.map(a => ({ ...a, cardType: 'activity' as const }))
  const result: SwipeCard[] = [...dinners, ...activities]

  // Insert onboarding cards at the front when not signed in
  if (!isSignedIn.value) {
    result.unshift(
      {
        id: 'onboarding-dancecard',
        cardType: 'onboarding-dancecard',
        availableStyles: styles,
      },
      {
        id: 'onboarding-profile',
        cardType: 'onboarding-profile',
      },
    )
  }

  return result
})

// Sign-up gate
const showSignUp = ref(false)
const signUpAction = ref('share')
const signUpPrefill = ref<{ name?: string; danceStyles?: string[]; role?: 'lead' | 'follow' | 'both'; city?: string }>({})

function onSignIn(action?: string) {
  signUpAction.value = action || 'share'
  showSignUp.value = true
}

function onOnboardingComplete(role: DanceRole, styles: string[], name: string, city: string) {
  signUpPrefill.value = {
    name: name || undefined,
    danceStyles: styles,
    role: role as 'lead' | 'follow' | 'both',
    city: city || undefined,
  }
}

function onSignedIn() {
  loadDinners()
  loadRideShares()
  loadRoommateStatus()
  loadFreemiumStatus()
}

function onPick() {
  if (!isSignedIn.value) {
    signUpAction.value = 'plan'
    showSignUp.value = true
    return
  }
  const wasGoing = yearPlanIds.value.has(festival.slug)
  liveAttendeeCount.value = Math.max(0, liveAttendeeCount.value + (wasGoing ? -1 : 1))
  toggleFestival(festival.slug)
}

function onSave() {
  if (!isSignedIn.value) {
    signUpAction.value = 'save'
    showSignUp.value = true
  }
  // When signed in, save is a no-op (mock — would persist to backend)
}

// Share modal
const showSharePlan = ref(false)

function onShare() {
  if (!isSignedIn.value) {
    signUpAction.value = 'share'
    showSignUp.value = true
  } else {
    showSharePlan.value = true
  }
}

// Cart state — badge count only. The desktop sidebar + mobile drawer
// were retired in favor of /my-plan; this keeps any global count badge
// (e.g. a future nav pill) in sync.
const { setCartCount } = useCart()
watch(() => plan.value.size, (n) => setCartCount(n), { immediate: true })

// Navigation — only show sections that have content for this festival.
const allSections = ['about', 'discover', 'activities', 'lineup', 'schedule', 'tickets', 'venue'] as const
const sections = computed(() =>
  allSections.filter((s) => {
    if (s === 'schedule') return workshops.length > 0
    if (s === 'lineup') return teachers.length > 0
    if (s === 'tickets') return (festival.tickets?.length ?? 0) > 0
    return true
  }),
)
const sectionLabels: Record<string, string> = {
  'about': 'About',
  'discover': 'Shall we dance?',
  'activities': 'Activities',
  'lineup': 'Lineup',
  'schedule': 'Schedule',
  'tickets': 'Tickets',
  'venue': 'Venue',
}

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  activeSection.value = id // immediate feedback; observer keeps it honest
}

// ── Sticky nav behaviour ──────────────────────────────────────────
// - The festival name only appears in the sticky nav once the hero has
//   scrolled out of view (so a deep-link straight to #tickets still
//   shows which festival you're on).
// - The nav highlights the section currently at the top and updates as
//   you scroll (scrollspy).
const heroRef = ref<HTMLElement | null>(null)
const heroVisible = ref(true)
const activeSection = ref<string>('about')

let heroObserver: IntersectionObserver | null = null
let sectionObserver: IntersectionObserver | null = null

onMounted(() => {
  if (heroRef.value) {
    heroObserver = new IntersectionObserver(
      ([entry]) => { heroVisible.value = entry.isIntersecting },
      { threshold: 0 },
    )
    heroObserver.observe(heroRef.value)
  }

  // Scrollspy — track which section sits under the sticky nav.
  const seen = new Set<string>()
  sectionObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) seen.add(e.target.id)
        else seen.delete(e.target.id)
      }
      const active = sections.value.find((s) => seen.has(s))
      if (active) activeSection.value = active
    },
    { rootMargin: '-64px 0px -60% 0px', threshold: 0 },
  )
  for (const s of sections.value) {
    const el = document.getElementById(s)
    if (el) sectionObserver.observe(el)
  }
})

onBeforeUnmount(() => {
  heroObserver?.disconnect()
  sectionObserver?.disconnect()
  if (paymentSuccessTimer) clearTimeout(paymentSuccessTimer)
})

// ── WeDance ticketing ─────────────────────────────────────────────
// WeDance IS the ticketing platform — dancers buy their pass here, and
// the purchase is what puts their face on the event page ("see who's
// going before you book"). No link-out to the organizer's own site.
//
// The real payment goes through Stripe Checkout (same session backend
// the €1 social unlock already uses). Until the ticket-purchase
// endpoint is wired, the checkout modal collects the intent and shows
// the value prop; `startTicketCheckout` is the single place to plug
// the real createCheckoutSession call.
type TicketOption = NonNullable<typeof festival.tickets>[number]
const selectedTickets = ref<TicketOption[]>([])
const showCheckout = ref(false)
const checkoutLoading = ref(false)

const selectedTicket = computed(() => selectedTickets.value[0] ?? null)
const checkoutTotal = computed(() => selectedTickets.value.reduce((s, t) => s + t.price, 0))
const checkoutLabel = computed(() => selectedTickets.value.map(t => t.name).join(' + '))

// Whether the current user already holds a verified ticket for this festival.
const hasTicket = computed(() => freemiumState.value.verifiedTicketHolder)

function chooseTicket(ticket: TicketOption) {
  if (hasTicket.value) return
  selectedTickets.value = [ticket]
  showCheckout.value = true
}

const checkoutError = ref('')

async function startTicketCheckout() {
  if (selectedTickets.value.length === 0) return
  if (hasTicket.value) return
  if (!isSignedIn.value) {
    // Buying = joining the wall, so we need an account first.
    signUpAction.value = 'ticket'
    showSignUp.value = true
    return
  }
  checkoutLoading.value = true
  checkoutError.value = ''
  useTrack().track('ticket_cta_click', {
    festival: festival.slug,
    ticket: checkoutLabel.value,
    amount: checkoutTotal.value,
  })
  try {
    const { $trpc: trpc } = useNuxtApp()
    const res = await trpc.festivalSignup.ticketCheckout.mutate({
      festivalSlug: festival.slug,
      ticketNames: selectedTickets.value.map(t => t.name),
      ...(referralCode.value ? { referralCode: referralCode.value } : {}),
    })
    if (res.checkoutUrl) {
      sessionStorage.setItem('wedance_checkout', JSON.stringify({
        festivalName: festival.name,
        ticketName: checkoutLabel.value,
        amount: checkoutTotal.value,
      }))
      window.location.href = res.checkoutUrl
    }
  } catch (err: any) {
    checkoutError.value = err?.message?.includes('sold out')
      ? 'This ticket is sold out.'
      : 'Something went wrong — please try again.'
  } finally {
    checkoutLoading.value = false
  }
}

// ── Smart ticket recommendation ───────────────────────────────────
// As the dancer picks workshops + parties, WeDance figures out the
// cheapest pass (or combo of day passes) that covers their plan.
// This is the core "add workshops → we recommend the best ticket"
// pitch. Greedy day-coverage + party add-on, lifted from the
// TicketRecommendation component and adapted to the page's plan Map.
const plannedDays = computed(() => {
  const days = new Set<string>()
  for (const w of workshops) {
    if (planIds.value.has(w.id)) days.add(w.day)
  }
  return days
})
const plannedWorkshopCount = computed(() =>
  workshops.filter((w) => planIds.value.has(w.id) && w.type !== 'party').length,
)
const hasPartyInPlan = computed(() =>
  workshops.some((w) => planIds.value.has(w.id) && w.type === 'party'),
)

function cheapestDayCoverage(dayPasses: TicketOption[], targetDays: Set<string>): TicketOption[] {
  const sorted = [...dayPasses].sort((a, b) => a.price - b.price)
  for (const t of sorted) {
    if ([...targetDays].every((d) => t.days.includes(d))) return [t]
  }
  const uncovered = new Set(targetDays)
  const selected: TicketOption[] = []
  for (const t of sorted) {
    if (t.days.some((d) => uncovered.has(d))) {
      selected.push(t)
      t.days.forEach((d) => uncovered.delete(d))
      if (uncovered.size === 0) break
    }
  }
  // Only a full-coverage combo is a valid recommendation. If day passes
  // can't cover every planned day (e.g. no Friday day-pass exists), bail
  // — the full pass path will carry the plan instead.
  return uncovered.size === 0 ? selected : []
}

interface Recommendation {
  tickets: TicketOption[]
  total: number
  savings?: number
  soldOut: boolean
}

// A pass with no days, workshop count or party flag reads as "covers
// everything", so passes entered as just name + price would make the €12
// party-only pass "best value" for a full bootcamp. Only recommend when the
// passes say what they cover.
const passesDescribed = (festival.tickets ?? []).some((t) =>
  t.days.length > 0 || t.workshopCount !== undefined || t.includesParty !== undefined,
)

const recommendation = computed<Recommendation | null>(() => {
  if (plannedDays.value.size === 0) return null
  return recommendFor(plannedDays.value, plannedWorkshopCount.value, hasPartyInPlan.value)
})

// Before the dancer picks anything: the cheapest way to the whole programme.
const bestValueNames = computed(() => new Set((recommendFor(
  new Set(workshops.map((w) => w.day)),
  workshops.filter((w) => w.type !== 'party').length,
  workshops.some((w) => w.type === 'party'),
)?.tickets ?? []).map((t) => t.name)))

function recommendFor(days: Set<string>, workshopCount: number, wantsParty: boolean): Recommendation | null {
  const all = festival.tickets
  if (!all?.length || !passesDescribed || days.size === 0) return null

  interface Candidate { tickets: TicketOption[]; total: number; soldOut: boolean }
  const candidates: Candidate[] = []

  // A combo can only be bought if every part is available.
  const comboSoldOut = (ts: TicketOption[]) => ts.some((t) => t.soldOut)

  // Cheapest party-only add-on — prefer a buyable one over a sold-out one.
  const partyAddOn = () => {
    const partyOnly = all.filter((t) => t.includesParty && (t.workshopCount === undefined || t.workshopCount === 0))
    const buyable = partyOnly.filter((t) => !t.soldOut).sort((a, b) => a.price - b.price)
    if (buyable.length) return buyable[0]
    return partyOnly.sort((a, b) => a.price - b.price)[0]
  }

  for (const ticket of all) {
    // workshopCount === 0 marks a party-only pass (grants no workshop
    // access); undefined means unlimited. A plan with 0 workshops is
    // trivially covered by any pass.
    const coversWorkshops = workshopCount === 0
      || (ticket.workshopCount !== 0 && (ticket.workshopCount === undefined || ticket.workshopCount >= workshopCount))
    const coversDays = ticket.days.length === 0 || [...days].every((d) => ticket.days.includes(d))
    const coversParty = !wantsParty || !!ticket.includesParty
    if (coversWorkshops && coversDays && (workshopCount > 0 || wantsParty)) {
      if (coversParty) {
        candidates.push({ tickets: [ticket], total: ticket.price, soldOut: !!ticket.soldOut })
      } else {
        const party = partyAddOn()
        if (party) {
          candidates.push({ tickets: [ticket, party], total: ticket.price + party.price, soldOut: comboSoldOut([ticket, party]) })
        } else {
          candidates.push({ tickets: [ticket], total: ticket.price, soldOut: !!ticket.soldOut })
        }
      }
    }
  }

  const dayPasses = all.filter((t) => t.days.length > 0 && !t.includesParty && t.workshopCount === undefined)
  if (dayPasses.length > 0) {
    const combo = cheapestDayCoverage(dayPasses, days)
    if (combo.length > 0) {
      const party = wantsParty ? partyAddOn() : null
      const tickets = party ? [...combo, party] : combo
      candidates.push({ tickets, total: tickets.reduce((s, t) => s + t.price, 0), soldOut: comboSoldOut(tickets) })
    }
  }

  if (workshopCount === 0 && wantsParty) {
    const party = partyAddOn()
    if (party) candidates.push({ tickets: [party], total: party.price, soldOut: !!party.soldOut })
  }

  if (candidates.length === 0) return null
  // Prefer buyable options over sold-out ones, then cheapest.
  candidates.sort((a, b) => (Number(a.soldOut) - Number(b.soldOut)) || (a.total - b.total))
  const best = candidates[0]
  const next = candidates[1]
  return {
    tickets: best.tickets,
    total: best.total,
    savings: next && next.total > best.total ? next.total - best.total : undefined,
    soldOut: best.soldOut,
  }
}

// Which ticket names are in the current recommendation (for grid highlight)
const recommendedNames = computed(() => new Set((recommendation.value?.tickets ?? []).map((t) => t.name)))

function getRecommendedPass() {
  if (hasTicket.value) return
  const rec = recommendation.value
  if (!rec) return
  const buyable = rec.tickets.filter((t) => !t.soldOut)
  if (buyable.length === 0) return
  selectedTickets.value = buyable
  showCheckout.value = true
}

// Which grid card gets the highlight: the recommended pass(es) once the
// dancer has a plan, otherwise the cheapest pass for the whole programme.
// No highlight when the passes don't say what they cover.
function isTopPass(t: TicketOption): boolean {
  if (recommendation.value) return recommendedNames.value.has(t.name)
  return bestValueNames.value.has(t.name)
}

// V3 tropical direction — layout:false + inline header so we can wrap
// the whole page in the cream + Playfair aesthetic without touching
// the default layout (which other pages still depend on). The shared
// components inside (FestivalHero, AboutTab, DiscoverDancers,
// ActivitiesTab, MySpace, Lineup, ScheduleTab, VenueTab, CartDrawer,
// SharedPlanView, modals) still carry shadcn styling — those get
// restyled in a follow-up pass.

useHead({
  title: `${festival.name} | WeDance`,
  meta: [
    { name: 'description', content: festival.description },
  ],
})
</script>

<template>
  <!-- Shared plan view (read-only) -->
  <SharedPlanView
    v-if="isSharedView"
    :festival-name="festival.name"
    :workshops="workshops"
    :teachers="teachers"
    :sharer="sharer"
    :sharer-plan="sharerPlan"
    :has-referral="hasReferral"
    :referral-info="referralInfo"
    @create-plan="onCreatePlan"
    @be-partner="onBePartner"
    @add-friend="() => { useTrack().track('shared_plan_signup', { surface: 'festival', slug: festival.slug, sharer: sharer.name }); onSignIn('friend') }"
    @sign-in="onSignIn"
  />

  <!-- Normal festival page -->
  <div v-else class="min-h-screen bg-background text-foreground font-display">
    <!-- V3 header — same as /, /festivals, /organizers -->
    <SiteHeader />

    <div v-if="editTo" class="border-b bg-secondary/[8%] border-border">
      <div class="max-w-3xl mx-auto px-4 py-2 flex items-center gap-3 text-sm font-sans">
        <span class="text-muted-foreground">You manage this {{ kind }}.</span>
        <Button variant="outline-pill" size="pill-sm" class="ml-auto" as-child>
          <NuxtLink :to="editTo"><Pencil /> Edit {{ kind }}</NuxtLink>
        </Button>
      </div>
    </div>

    <div ref="heroRef">
      <FestivalHero :festival="heroFestival" :picked="yearPlanIds.has(festival.slug)" @pick="onPick" />
    </div>

    <!-- Section anchor nav — V3 restyled. Festival identity slides in on
         the left once the hero has scrolled out of view, so a deep-link
         (Buy Tickets from the official site) always shows which festival
         you're on. The active section is highlighted and tracks scroll. -->
    <nav class="sticky top-0 z-20 border-b" style="background:rgba(251, 245, 234, 0.95); backdrop-filter: blur(8px); border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);">
      <div class="max-w-4xl mx-auto flex items-center gap-2 px-4 min-w-0">
        <Transition
          enter-active-class="transition-all duration-200 ease-out"
          enter-from-class="opacity-0 -translate-x-2"
          enter-to-class="opacity-100 translate-x-0"
          leave-active-class="transition-all duration-150 ease-in"
          leave-from-class="opacity-100 translate-x-0"
          leave-to-class="opacity-0 -translate-x-2"
        >
          <NuxtLink
            v-if="!heroVisible"
            :to="`/events/${festival.slug}`"
            class="flex items-center gap-2 shrink-0 pr-3 mr-1 border-r"
            style="border-color:color-mix(in srgb, var(--wd-brown-900) 8.2%, transparent);"
            @click.prevent="scrollTo('about')"
          >
            <img
              v-if="festival.logo"
              :src="festival.logo"
              :alt="festival.name"
              class="w-6 h-6 rounded-full shrink-0"
            >
            <div
              v-else
              class="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-eyebrow font-bold text-white"
              :style="{ background: festival.accentColor }"
            >
              {{ festival.name.charAt(0) }}
            </div>
            <span class="text-sm font-bold whitespace-nowrap hidden sm:inline font-display text-foreground">
              {{ festival.name }}
            </span>
          </NuxtLink>
        </Transition>
        <div class="flex gap-0 overflow-x-auto min-w-0">
          <button
            v-for="section in sections"
            :key="section"
            type="button"
            class="relative px-3 py-3 text-sm italic whitespace-nowrap transition-colors font-display cursor-pointer"
            :class="activeSection === section ? 'font-bold' : 'font-normal text-muted-foreground'"
            :style="activeSection === section ? { color: festival.accentColor } : undefined"
            :aria-current="activeSection === section ? 'location' : undefined"
            @click="scrollTo(section)"
          >
            {{ sectionLabels[section] }}
            <span
              v-if="activeSection === section"
              class="absolute left-3 right-3 bottom-0 h-[2px] rounded-full"
              :style="{ background: festival.accentColor }"
            />
          </button>
        </div>
      </div>
    </nav>

    <div class="max-w-3xl mx-auto px-4 space-y-14 pt-8 pb-20">
        <section id="about" class="scroll-mt-12">
          <AboutTab :festival="festival" />
        </section>

        <section id="discover" class="scroll-mt-16">
          <h2 class="text-2xl font-black leading-tight mb-1 text-foreground">Shall we <em class="italic text-primary">dance?</em></h2>
          <p class="text-sm mb-4 text-muted-foreground font-sans">Swipe to discover dancers, group dinners, and activities happening around the {{ kind }}.</p>
          <DiscoverDancers
            :festival-slug="festival.slug"
            :city="festival.city"
            :extra-cards="extraSwipeCards"
            :workshops="workshops"
            :plan-ids="planIds"
            :is-signed-in="isSignedIn"
            @sign-in="onSignIn"
            @onboarding-complete="onOnboardingComplete"
            @join-dinner="joinDinner"
            @join-activity="joinActivity"
          />
          <!-- Verified ticket holders: the TicketTailor claim flow exists for Charanga only (/charanga/claim). -->
          <div v-if="festival.slug === 'charanga-habanera-munich-2026'" class="mt-6">
            <h3 class="mb-3 text-lg font-bold font-display">Verified attendees</h3>
            <AttendeeRoster :festival-slug="festival.slug" />
          </div>
        </section>

        <section id="activities" class="scroll-mt-16">
          <h2 class="text-2xl font-black leading-tight mb-1 text-foreground">Activities</h2>
          <p class="text-sm mb-4 text-muted-foreground font-sans">Rides, rooms, dinners and more — connect with fellow dancers.</p>
          <ActivitiesTab
            :ride-shares="rideShares"
            :group-dinners="groupDinners"
            :extra-activities="extraActivities"
            :looking-for-roommate="lookingForRoommate"
            :roommate-others="roommateOthers"
            :hotel-search-url="hotelSearchUrl"
            :is-signed-in="isSignedIn"
            @join-dinner="joinDinner"
            @join-activity="joinActivity"
            @post-ride="postRide"
            @toggle-roommate="toggleRoommate"
            @sign-in="onSignIn"
          />
        </section>

        <section v-if="isSignedIn" id="my-plan" class="scroll-mt-16">
          <MySpace
            :workshops="workshops"
            :plan-ids="planIds"
            :plan="plan"
            :is-signed-in="isSignedIn"
            :friends="friends"
            :partner-matches="partnerMatches"
            @sign-in="onSignIn"
            @invite-friends="onShare"
            @add-workshop="toggleWorkshop"
          />
        </section>

        <section v-if="teachers.length > 0" id="lineup" class="scroll-mt-16">
          <div class="flex items-baseline justify-between gap-3 mb-1">
            <h2 class="text-2xl font-black leading-tight text-foreground">Lineup</h2>
            <Button
              v-if="selectedTeacherId"
              type="button"
              variant="link"
              size="sm"
              class="h-auto p-0 text-xs font-bold font-sans"
              @click="selectedTeacherId = null"
            >
              Clear filter ✕
            </Button>
          </div>
          <p class="text-sm mb-4 text-muted-foreground font-sans">Tap an artist to filter the schedule to their sessions — or open their full profile.</p>
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div v-for="c in lineupCards" :key="c.teacher.id" class="relative">
              <ArtistCard
                :artist="c.teacher"
                :accent="c.accent"
                :origin="c.origin"
                :residence="c.residence"
                :languages="c.languages"
                selectable
                :selected="selectedTeacherId === c.teacher.id"
                @select="toggleTeacherFilter(c.teacher.id)"
              />
              <span v-if="c.teacher.tbc" class="pointer-events-none absolute right-3 top-3 rounded-full bg-card/95 px-2 py-0.5 text-eyebrow font-bold uppercase tracking-wider text-muted-foreground shadow-sm font-sans">To be confirmed</span>
            </div>
          </div>
        </section>

        <section v-if="workshops.length > 0" id="schedule" class="scroll-mt-16">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-2xl font-black leading-tight text-foreground">Schedule</h2>
            <Button
              v-if="selectedTeacherId"
              type="button"
              variant="link"
              size="sm"
              class="h-auto p-0 gap-1 text-xs font-bold font-sans"
              @click="selectedTeacherId = null"
            >
              Filtering by {{ selectedTeacher?.name }}
              <span class="text-secondary" aria-hidden="true">✕</span>
              <span class="sr-only">— clear filter</span>
            </Button>
          </div>
          <ScheduleTab
            :workshops="workshops"
            :teachers="teachers"
            :days="days"
            :styles="styles"
            :plan-ids="planIds"
            :selected-teacher-id="selectedTeacherId"
            :start-date="festival.startDate"
            :festival-slug="festival.slug"
            @toggle-workshop="toggleWorkshop"
          />
        </section>

        <section v-if="festival.tickets?.length" id="tickets" class="scroll-mt-16">
          <div class="mb-4">
            <div class="text-xs uppercase tracking-[0.3em] text-secondary">Passes</div>
            <h2 v-if="hasTicket" class="mt-2 text-2xl font-black leading-tight text-foreground">
              You're <em class="italic text-wd-green-600">in.</em>
            </h2>
            <h2 v-else class="mt-2 text-2xl font-black leading-tight text-foreground">
              Pick your <em class="italic text-primary">pass.</em>
            </h2>
          </div>

          <!-- Already purchased — ticket holder confirmation -->
          <div
            v-if="hasTicket"
            class="rounded-2xl p-5 sm:p-6 mb-6"
            style="background:linear-gradient(135deg, color-mix(in srgb, var(--wd-green-600) 14%, white), color-mix(in srgb, var(--wd-green-600) 19%, white)); border:1px solid color-mix(in srgb, var(--wd-green-600) 20%, transparent);"
          >
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-white">
                <Check class="w-5 h-5 text-wd-green-600" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-wd-green-600">
                  You have a ticket
                </div>
                <div class="mt-1 text-sm text-foreground font-display">
                  Your pass for {{ festival.name }} is confirmed.
                </div>
                <div class="mt-1 text-xs text-muted-foreground font-sans">
                  Plan your workshops in the schedule above and connect with other dancers.
                </div>
              </div>
            </div>
          </div>

          <!-- Smart recommendation for the dancer's current plan -->
          <div
            v-else-if="recommendation"
            class="rounded-2xl p-5 sm:p-6 mb-6"
            style="background:linear-gradient(135deg, var(--wd-amber-100), var(--wd-red-100)); border:1px solid color-mix(in srgb, var(--wd-red-600) 20%, transparent);"
          >
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-white">
                <Sparkles class="w-5 h-5 text-primary" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-primary">
                  Best value for your plan
                </div>
                <div class="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span class="text-lg font-black font-display text-foreground">
                    {{ recommendation.tickets.map(t => t.name).join(' + ') }}
                  </span>
                  <span class="text-2xl font-black font-display text-primary">
                    €{{ recommendation.total }}
                  </span>
                  <span
                    v-if="recommendation.savings"
                    class="text-xs font-bold px-2 py-0.5 rounded-full font-sans"
                    :style="{ background: 'color-mix(in srgb, var(--wd-green-600) 9.4%, transparent)', color: CHIP.green }"
                  >
                    saves €{{ recommendation.savings }}
                  </span>
                </div>
                <div class="mt-1 text-xs text-muted-foreground font-sans">
                  Covers your {{ plannedWorkshopCount }} workshop{{ plannedWorkshopCount === 1 ? '' : 's' }}<span v-if="hasPartyInPlan"> + parties</span>
                  across {{ plannedDays.size }} day{{ plannedDays.size === 1 ? '' : 's' }}.
                </div>
                <Button
                  v-if="!recommendation.soldOut"
                  type="button"
                  variant="cta"
                  class="mt-3 px-5 text-xs"
                  @click="getRecommendedPass"
                >
                  Get this pass <ArrowRight aria-hidden="true" />
                </Button>
                <div
                  v-else
                  class="mt-3 text-xs italic text-muted-foreground font-display"
                >
                  Sold out — we'll notify you when a dancer offers theirs.
                </div>
              </div>
            </div>
          </div>

          <!-- Nudge: no plan yet (only when we can actually recommend) -->
          <NuxtLink
            v-else-if="passesDescribed"
            to="#schedule"
            class="rounded-2xl p-5 mb-6 flex items-center gap-3 border-2 border-dashed transition-colors hover:bg-white/60"
            style="border-color:color-mix(in srgb, var(--wd-brown-900) 20%, transparent); background:rgba(255,255,255,0.4);"
            @click="scrollTo('schedule')"
          >
            <Sparkles class="w-6 h-6 shrink-0 text-secondary" />
            <div>
              <div class="text-sm font-bold text-foreground font-display">
                Not sure which pass?
              </div>
              <div class="text-xs text-muted-foreground font-sans">
                Pick the workshops + parties you want in the schedule above — we'll find your best-value pass.
              </div>
            </div>
            <ArrowRight class="w-4 h-4 ml-auto shrink-0 text-primary" />
          </NuxtLink>

          <!-- Referral discount banner -->
          <div
            v-if="referralInfo && !hasTicket"
            class="rounded-2xl p-4 sm:p-5 mb-6 flex items-center gap-3"
            style="background:linear-gradient(135deg, color-mix(in srgb, var(--wd-green-600) 14%, white), color-mix(in srgb, var(--wd-green-600) 19%, white)); border:1px solid color-mix(in srgb, var(--wd-green-600) 20%, transparent);"
          >
            <div class="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-white">
              <span class="text-lg font-black text-wd-green-600">%</span>
            </div>
            <div class="flex-1 min-w-0">
              <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-wd-green-600">
                Referral discount
              </div>
              <div class="mt-0.5 text-sm text-foreground font-display">
                {{ referralInfo.referrerName }} shared this link — you both get {{ referralInfo.discountPercent }}% off.
              </div>
            </div>
          </div>

          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="t in festival.tickets"
              :key="t.name"
              class="relative rounded-2xl bg-white p-5 border transition-all"
              :class="isTopPass(t) ? 'md:-translate-y-1' : ''"
              :style="{
                borderColor: (isTopPass(t) ? WD.red600 : (WD.brown900 + '22')),
                borderWidth: isTopPass(t) ? '2px' : '1px',
                boxShadow: isTopPass(t)
                  ? '6px 8px 0 -2px var(--wd-red-600), 0 12px 28px rgba(59,31,18,0.08)'
                  : '0 1px 0 color-mix(in srgb, var(--wd-brown-900) 3.9%, transparent), 0 6px 18px rgba(59,31,18,0.04)',
                opacity: t.soldOut ? 0.75 : 1,
              }"
            >
              <div
                v-if="isTopPass(t) && !t.soldOut"
                class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-eyebrow font-black uppercase tracking-widest text-white whitespace-nowrap bg-primary"
              >
                {{ recommendation ? 'Recommended for you' : 'Best value' }}
              </div>
              <div
                v-if="t.soldOut"
                class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-eyebrow font-black uppercase tracking-widest text-white whitespace-nowrap bg-wd-brown-700"
              >
                Sold out
              </div>

              <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">
                {{ t.name }}
              </div>
              <div class="mt-2 mb-1 flex items-baseline gap-1">
                <span class="text-4xl font-black text-foreground font-display">
                  €{{ t.price }}
                </span>
              </div>
              <p v-if="t.description" class="text-sm mb-4 text-muted-foreground font-sans">
                {{ t.description }}
              </p>

              <div class="flex flex-wrap gap-1.5 mb-4">
                <span
                  v-if="t.days.length === 0 && !t.includesParty"
                  class="text-eyebrow font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  :style="{ background: 'color-mix(in srgb, var(--wd-green-600) 9.4%, transparent)', color: CHIP.green }"
                >
                  All days
                </span>
                <span
                  v-for="d in t.days"
                  :key="d"
                  class="text-eyebrow font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  :style="{ background: 'color-mix(in srgb, var(--wd-cyan-600) 9.4%, transparent)', color: CHIP.cyan }"
                >
                  {{ d }}
                </span>
                <span
                  v-if="t.includesParty"
                  class="text-eyebrow font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  :style="{ background: 'color-mix(in srgb, var(--wd-purple-500) 9.4%, transparent)', color: CHIP.purple }"
                >
                  Parties incl.
                </span>
                <span
                  v-if="t.workshopCount !== undefined && t.workshopCount !== null"
                  class="text-eyebrow font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  :style="{ background: 'color-mix(in srgb, var(--wd-amber-500) 9.4%, transparent)', color: CHIP.amber }"
                >
                  {{ t.workshopCount }} workshop{{ t.workshopCount === 1 ? '' : 's' }}
                </span>
              </div>

              <div
                v-if="hasTicket"
                class="inline-flex items-center justify-center gap-2 w-full py-3 rounded-full text-xs font-bold uppercase tracking-wider"
                :style="{ background: 'color-mix(in srgb, var(--wd-green-600) 9.4%, transparent)', color: CHIP.green }"
              >
                <Check class="w-3.5 h-3.5" />
                You have a ticket
              </div>
              <Button
                v-else-if="!t.soldOut"
                type="button"
                :variant="i === 0 ? 'cta' : 'pill'"
                :accent="i === 0 ? undefined : 'var(--wd-brown-900)'"
                class="w-full h-11 text-xs"
                @click="chooseTicket(t)"
              >
                Get this pass
                <ArrowRight aria-hidden="true" />
              </Button>
              <div
                v-else
                class="inline-flex items-center justify-center gap-2 w-full py-3 rounded-full text-xs font-bold uppercase tracking-wider text-secondary"
                style="background:color-mix(in srgb, var(--wd-brown-900) 3.9%, transparent);"
              >
                No longer available
              </div>
            </div>
          </div>
        </section>

        <section id="venue" class="scroll-mt-16">
          <h2 class="text-2xl font-black leading-tight mb-4 text-foreground">Venue</h2>
          <VenueTab :venue="festival.venue" />
        </section>
    </div>

    <!-- Soft dashboard nudge — only when the user has picks in this
         festival. Replaces the old desktop sidebar + mobile drawer.
         Everything else moved to /my-plan. -->
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
          v-if="planIds.size > 0"
          to="/my-plan"
          class="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full text-white text-sm font-bold shadow-wd-float transition-all"
          :style="{ background: festival.accentColor }"
        >
          <span
            class="inline-flex items-center justify-center w-6 h-6 rounded-full text-meta font-black bg-white"
            :style="{ color: festival.accentColor }"
          >{{ planIds.size }}</span>
          <span class="font-display tracking-[0.01em]">in your plan</span>
          <span class="font-hand text-base opacity-85">— see dashboard</span>
          <ArrowRight class="w-4 h-4" />
        </NuxtLink>
      </Transition>
    </Teleport>

    <RolePickerModal
      v-model:open="showRolePicker"
      :workshop-title="rolePickerTitle"
      :remembered-role="rememberedRole"
      :partners="partners"
      @confirm="onRoleConfirm"
      @add-partner="addPartner"
    />

    <SignUpModal v-model:open="showSignUp" :action="signUpAction" :prefill="signUpPrefill" />

    <!-- WeDance ticket checkout — buying happens here, on WeDance. -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showCheckout && selectedTickets.length > 0"
          class="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
          @click.self="showCheckout = false"
        >
          <div
            class="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl bg-background"
          >
            <!-- Header band -->
            <div class="p-5 sm:p-6" style="background:linear-gradient(135deg, var(--wd-red-600), var(--wd-orange-500));">
              <div class="flex items-center gap-2 text-white/90 text-eyebrow font-bold uppercase tracking-[0.3em]">
                <img src="/icon.svg" alt="" class="w-4 h-4 brightness-0 invert" >
                Checkout on WeDance
              </div>
              <div class="mt-2 text-2xl font-black leading-tight text-white font-display">
                {{ festival.name }}
              </div>
              <div class="text-xs text-white/85 mt-0.5 font-sans">
                {{ checkoutLabel }}
              </div>
            </div>

            <div class="p-5 sm:p-6">
              <!-- Price rows -->
              <div
                v-for="t in selectedTickets"
                :key="t.name"
                class="flex items-baseline justify-between"
                :class="selectedTickets.length > 1 ? 'pb-2' : 'pb-4 mb-4 border-b'"
                :style="selectedTickets.length > 1 ? '' : 'border-color:color-mix(in srgb, var(--wd-brown-900) 8.2%, transparent);'"
              >
                <div class="text-sm text-muted-foreground font-sans">
                  {{ t.name }}
                </div>
                <div class="text-foreground font-display"
                  :class="selectedTickets.length > 1 ? 'text-lg font-bold' : 'text-3xl font-black'"
                >
                  €{{ t.price }}
                </div>
              </div>
              <!-- Combo total -->
              <div
                v-if="selectedTickets.length > 1"
                class="flex items-baseline justify-between pt-2 pb-4 mb-4 border-t border-b"
                style="border-color:color-mix(in srgb, var(--wd-brown-900) 8.2%, transparent);"
              >
                <div class="text-sm font-bold text-foreground font-sans">
                  Total
                </div>
                <div class="text-3xl font-black text-foreground font-display">
                  €{{ checkoutTotal }}
                </div>
              </div>

              <!-- Referral discount line in checkout -->
              <div
                v-if="referralInfo"
                class="flex items-baseline justify-between pb-4 mb-4 border-b"
                style="border-color:color-mix(in srgb, var(--wd-green-600) 20%, transparent);"
              >
                <div class="text-sm text-wd-green-600 font-sans">
                  Referral {{ referralInfo.discountPercent }}% off
                </div>
                <div class="text-lg font-bold text-wd-green-600 font-display">
                  −€{{ Math.round(checkoutTotal * referralInfo.discountPercent / 100) }}
                </div>
              </div>

              <!-- What you get -->
              <ul class="space-y-2 mb-5 text-sm text-muted-foreground font-sans">
                <li class="flex items-start gap-2">
                  <Check class="w-4 h-4 shrink-0 mt-0.5 text-wd-green-600" />
                  <span v-if="selectedTickets.length === 1 && selectedTickets[0].description">{{ selectedTickets[0].description }}</span>
                  <span v-else>Access to {{ festival.name }}</span>
                </li>
                <li class="flex items-start gap-2">
                  <Check class="w-4 h-4 shrink-0 mt-0.5 text-wd-green-600" />
                  <span>Your face on the event page — <strong class="text-foreground">see who else is going</strong></span>
                </li>
                <li class="flex items-start gap-2">
                  <Check class="w-4 h-4 shrink-0 mt-0.5 text-wd-green-600" />
                  <span>Plan workshops, find a partner, share your plan</span>
                </li>
              </ul>

              <div v-if="checkoutError" class="mb-3 rounded-lg px-4 py-2 text-sm text-center bg-wd-red-50 text-destructive font-sans" role="alert">
                {{ checkoutError }}
              </div>

              <Button
                type="button"
                variant="cta"
                size="lg"
                class="w-full h-12 px-4"
                :loading="checkoutLoading"
                @click="startTicketCheckout"
              >
                <template v-if="checkoutLoading">Taking you to payment…</template>
                <template v-else-if="!isSignedIn">Sign in &amp; pay €{{ checkoutTotal }}</template>
                <template v-else>Pay €{{ checkoutTotal }} <ArrowRight aria-hidden="true" /></template>
              </Button>

              <div class="mt-3 text-center text-xs text-secondary font-hand" style="font-size:16px;">
                — secure payment · instant confirmation
              </div>

              <Button
                type="button"
                variant="link"
                size="sm"
                class="mt-3 w-full h-auto py-1 text-xs italic font-sans text-secondary"
                @click="showCheckout = false"
              >
                Maybe later
              </Button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Payment success confirmation -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showPaymentSuccess && paymentSuccessInfo"
          class="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
          @click.self="dismissPaymentSuccess"
        >
          <div
            class="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl bg-background"
          >
            <!-- Success header -->
            <div class="p-6 sm:p-8 text-center" style="background:linear-gradient(135deg, var(--wd-green-600), color-mix(in srgb, var(--wd-green-600) 75%, white));">
              <div class="w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center" style="background:rgba(255,255,255,0.25);">
                <Check class="w-8 h-8 text-white" />
              </div>
              <div class="text-2xl font-black text-white font-display">
                You're in!
              </div>
              <div class="text-sm text-white/90 mt-1 font-sans">
                Payment confirmed
              </div>
            </div>

            <div class="p-5 sm:p-6">
              <!-- Purchase details -->
              <div class="space-y-3 pb-4 mb-4 border-b" style="border-color:color-mix(in srgb, var(--wd-brown-900) 8.2%, transparent);">
                <div class="flex items-center justify-between">
                  <span class="text-xs uppercase tracking-wider font-bold text-secondary">{{ kind.charAt(0).toUpperCase() + kind.slice(1) }}</span>
                  <span class="text-sm font-bold text-foreground font-display">{{ paymentSuccessInfo.festivalName }}</span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-xs uppercase tracking-wider font-bold text-secondary">Pass</span>
                  <span class="text-sm font-bold text-foreground font-display">{{ paymentSuccessInfo.ticketName }}</span>
                </div>
                <div v-if="paymentSuccessInfo.amount > 0" class="flex items-center justify-between">
                  <span class="text-xs uppercase tracking-wider font-bold text-secondary">Paid</span>
                  <span class="text-sm font-bold text-foreground font-display">&euro;{{ paymentSuccessInfo.amount }}</span>
                </div>
              </div>

              <p class="text-xs text-center mb-4 text-muted-foreground font-sans">
                A confirmation email is on its way. Start planning your workshops and connect with other dancers!
              </p>

              <Button
                type="button"
                variant="pill"
                accent="var(--wd-green-700)"
                class="w-full h-12"
                @click="dismissPaymentSuccess"
              >
                Let's go
                <ArrowRight aria-hidden="true" />
              </Button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- Profile completion nudge (shown after payment success when profile is incomplete) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition duration-300 ease-out"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition duration-200 ease-in"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="showProfileNudge"
          class="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-0 sm:px-4"
        >
          <div
            class="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl bg-background"
          >
            <!-- Nudge header -->
            <div class="p-6 sm:p-8 text-center" style="background:linear-gradient(135deg, var(--wd-red-600), color-mix(in srgb, var(--wd-red-600) 80%, white));">
              <div class="text-2xl font-black text-white font-display">
                One more step
              </div>
              <div class="text-sm text-white/90 mt-1 font-sans">
                Help us match you with the right people
              </div>
            </div>

            <div class="p-5 sm:p-6">
              <!-- Dance styles -->
              <div class="mb-5">
                <label for="nudge-styles" class="text-sm font-bold block mb-2 text-foreground">Which dances?</label>
                <DanceStylePicker id="nudge-styles" v-model="nudgeForm.danceStyles" label="Which dances?" :popular-count="6" />
              </div>

              <!-- Role -->
              <div class="mb-5">
                <span class="text-sm font-bold block mb-2 text-foreground">Do you lead or follow?</span>
                <div class="flex gap-3">
                  <label
                    v-for="r in [{ value: 'lead', label: 'Lead' }, { value: 'follow', label: 'Follow' }, { value: 'both', label: 'Both' }]"
                    :key="r.value"
                    class="flex-1 flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold cursor-pointer transition-colors"
                    :style="nudgeForm.role === r.value
                      ? 'background:var(--wd-red-600); color:white; border:1px solid var(--wd-red-600);'
                      : 'background:white; color:var(--wd-brown-700); border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent);'"
                  >
                    <input v-model="nudgeForm.role" type="radio" name="nudge-role" :value="r.value" class="sr-only">
                    {{ r.label }}
                  </label>
                </div>
              </div>

              <Button
                type="button"
                variant="pill"
                class="w-full h-12"
                :disabled="!nudgeForm.danceStyles.length || !nudgeForm.role"
                :loading="nudgeSaving"
                @click="submitNudge"
              >
                {{ nudgeSaving ? 'Saving…' : 'Save & start planning' }}
                <ArrowRight v-if="!nudgeSaving" aria-hidden="true" />
              </Button>

              <div class="text-center mt-3">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  class="h-auto p-0 text-sm underline font-sans text-secondary"
                  @click="showProfileNudge = false"
                >
                  Skip for now
                </Button>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <SharePlanModal
      v-model:open="showSharePlan"
      :workshops="workshops"
      :teachers="teachers"
      :plan="plan"
      :plan-ids="planIds"
      :festival-name="festival.name"
      :festival-slug="festival.slug"
    />


    <ClientOnly>
      <section id="reviews" class="max-w-4xl mx-auto px-4 pb-10 scroll-mt-16">
        <ReviewsSection target-type="festival" :target-slug="festival.slug" :target-name="festival.name" />
      </section>
    </ClientOnly>

    <SiteFooter />
  </div>
</template>
