<script setup lang="ts">
/**
 * /my-plan — signed-in dashboard: the whole planning cascade.
 * Sections top-to-bottom follow the mental model that big motivates small:
 *   Heat strip -> Goals -> Year (festivals) -> Month (courses)
 *   -> Week (socials) -> Tonight (hangouts)
 * Every section uses the V3 tropical style + accordion / compact-list
 * pattern established by the Year cards. Week socials (plan.weekSocials)
 * and the discover deck (plan.discover + discover_swipes) are DB-backed;
 * ?preview=1 swaps in the preview* demo arrays and never writes.
 */
import { ArrowRight, MapPin, Calendar, Search, Ticket, Plane, Home, GraduationCap, Heart, Coffee, CalendarPlus, Check, ExternalLink, ChevronDown, Target, Flame, Sparkles, MoonStar, UtensilsCrossed, GlassWater, Car, X, Star, Clock, Users as UsersIcon, Undo2, Plus } from 'lucide-vue-next'
import * as salsaOpen from '~/data/mock-festival'
import * as meneate from '~/data/mock-meneate'
import * as cityMunich from '~/data/mock-city-munich'
import * as cityBerlin from '~/data/mock-city-berlin'
import type { CityEvent } from '~/types/city'
import { eventLocalDate, eventLocalTime, eventLocalWeekday } from '#shared/utils/eventTime'
import { detectDanceStyle, relatedDanceStyles } from '#shared/dance-styles'
import * as cubanFire from '~/data/mock-cuban-fire'
import * as caribbeanUrbanFire from '~/data/mock-caribbean-urban-fire'
import { WD } from '~/lib/brand'
import { eventPath, festivalPath } from '#shared/utils/eventSlug'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — My plan',
})

const {
  isSignedIn: isSignedInReal,
  dancerId: dancerIdReal,
  dancerName: dancerNameReal,
  city: dancerCityReal,
  danceStyles: dancerStylesReal,
  onboardedAt: onboardedAtReal,
  justRegistered,
} = useAuth()
const { yearPlanIds, removeFestival, toggleFestival, addFestival } = useYearPlan()

// ?preview=1 — dev shortcut. Fakes signed-in + seeds picks so we can
// eyeball the strip + cards without running the real magic-link flow.
// Doesn't mutate real auth or year-plan state.
const route = useRoute()
const { $trpc } = useNuxtApp()
const previewMode = computed(() => route.query.preview === '1')
const PREVIEW_PICK_SLUGS = new Set([
  'meneate-viena-2026',
  'bachata-stars-barcelona-2026',
  'kizomba-prague-2026',
])

const isSignedIn = computed(() => isSignedInReal.value || previewMode.value)
const dancerName = computed(() => previewMode.value ? 'Alex' : dancerNameReal.value)
const effectivePickIds = computed(() => previewMode.value ? PREVIEW_PICK_SLUGS : yearPlanIds.value)

// Signed-out state: "Join" opens the modal in register mode, "Sign in" in login
// mode. Once auth lands, isSignedIn flips and the dashboard renders in place.
const authAction = ref<'dashboard' | 'signin'>('dashboard')
const showAuth = ref(false)
function openAuth(action: 'dashboard' | 'signin') {
  authAction.value = action
  showAuth.value = true
}

// What the dashboard holds — shown to signed-out visitors as the promise.
const DASHBOARD_PILLARS = [
  { key: 'picks', icon: Star, title: 'My picks', body: 'The festivals, courses and socials you picked — your whole year at a glance.' },
  { key: 'partners', icon: UsersIcon, title: 'My partners', body: 'Who you\'re dancing with at each festival, and who still needs a partner.' },
  { key: 'tickets', icon: Ticket, title: 'My tickets', body: 'Passes you\'ve bought and the early-bird deadlines you can\'t miss.' },
] as const

// Personalization from the signed-in profile (via `me`). Preview fakes Munich +
// the big three so the personalized copy is visible without a real session.
const dancerCity = computed(() => previewMode.value ? 'Munich' : (dancerCityReal.value || null))
const dancerStyles = computed(() => previewMode.value ? ['Salsa', 'Bachata', 'Kizomba'] : [...(dancerStylesReal.value || [])])

// Onboarding state: guard banner when signed-in but not onboarded; first-run
// hint right after a fresh signup + onboarding this session.
const isOnboarded = computed(() => previewMode.value ? true : !!onboardedAtReal.value)
const needsOnboarding = computed(() => isSignedIn.value && !previewMode.value && !onboardedAtReal.value)
const showFirstRunHint = computed(() => isSignedIn.value && isOnboarded.value && justRegistered.value)

// Human-readable style list for scoped headings ("Salsa & Bachata in Munich").
const stylesLabel = computed(() => {
  const s = dancerStyles.value
  if (!s.length) return ''
  if (s.length === 1) return s[0]
  if (s.length === 2) return `${s[0]} & ${s[1]}`
  return `${s[0]}, ${s[1]} +${s.length - 2}`
})

// "Full week" link → the user's city page when we have one, else the cities
// index. Only munich/berlin have dedicated pages in the current mock data.
const CITY_PAGES = new Set(['munich', 'berlin'])
const citySocialsLink = computed(() => {
  const slug = (dancerCity.value || '').trim().toLowerCase()
  return CITY_PAGES.has(slug) ? `/cities/${slug}` : '/cities'
})

// Catalogue of festivals — same source /festivals uses. Extract to a
// composable once this data starts to matter.
function cheapestPrice(tickets: Array<{ price: number; soldOut?: boolean }>) {
  const available = tickets.filter(t => !t.soldOut).map(t => t.price)
  return available.length ? Math.min(...available) : undefined
}

const catalogue = [
  {
    slug: meneate.mockFestival.slug,
    name: meneate.mockFestival.name,
    startDate: meneate.mockFestival.startDate,
    endDate: meneate.mockFestival.endDate,
    location: 'Vienna, Austria',
    venue: meneate.mockFestival.venue.name,
    logo: meneate.mockFestival.logo,
    accentColor: meneate.mockFestival.accentColor,
    workshopCount: meneate.mockWorkshops.filter(w => w.type !== 'party').length,
    ticketUrl: meneate.mockFestival.ticketUrl,
    ticketFromPrice: cheapestPrice(meneate.mockFestival.tickets),
    earlyBirdDeadline: undefined as string | undefined,
    styles: ['Salsa', 'Bachata', 'Kizomba'] as string[],
  },
  {
    slug: cubanFire.mockFestival.slug,
    name: cubanFire.mockFestival.name,
    startDate: cubanFire.mockFestival.startDate,
    endDate: cubanFire.mockFestival.endDate,
    location: 'Munich, Germany',
    venue: cubanFire.mockFestival.venue.name,
    logo: '',
    accentColor: cubanFire.mockFestival.accentColor,
    workshopCount: cubanFire.mockWorkshops.filter(w => w.type !== 'party').length,
    ticketUrl: (cubanFire.mockFestival as any).ticketUrl,
    ticketFromPrice: cheapestPrice(cubanFire.mockFestival.tickets),
    earlyBirdDeadline: undefined as string | undefined,
    styles: ['Salsa', 'Timba', 'Afro-Cuban'] as string[],
  },
  {
    slug: caribbeanUrbanFire.mockFestival.slug,
    name: caribbeanUrbanFire.mockFestival.name,
    startDate: caribbeanUrbanFire.mockFestival.startDate,
    endDate: caribbeanUrbanFire.mockFestival.endDate,
    location: 'Munich, Germany',
    venue: caribbeanUrbanFire.mockFestival.venue.name,
    logo: '',
    accentColor: caribbeanUrbanFire.mockFestival.accentColor,
    workshopCount: caribbeanUrbanFire.mockWorkshops.filter(w => w.type !== 'party').length,
    ticketUrl: (caribbeanUrbanFire.mockFestival as any).ticketUrl,
    ticketFromPrice: cheapestPrice(caribbeanUrbanFire.mockFestival.tickets),
    earlyBirdDeadline: undefined as string | undefined,
    styles: ['Salsa', 'Bachata', 'Reggaeton'] as string[],
  },
  {
    slug: salsaOpen.mockFestival.slug,
    name: salsaOpen.mockFestival.name,
    startDate: salsaOpen.mockFestival.startDate,
    endDate: salsaOpen.mockFestival.endDate,
    location: 'Berlin, Germany',
    venue: salsaOpen.mockFestival.venue.name,
    logo: salsaOpen.mockFestival.logo,
    accentColor: salsaOpen.mockFestival.accentColor,
    workshopCount: salsaOpen.mockWorkshops.length,
    ticketUrl: (salsaOpen.mockFestival as any).ticketUrl,
    ticketFromPrice: cheapestPrice((salsaOpen.mockFestival as any).tickets || []),
    earlyBirdDeadline: '2026-06-01',
    styles: ['Salsa', 'Bachata'] as string[],
  },
  {
    slug: 'bachata-stars-barcelona-2026',
    name: 'Bachata Stars Barcelona',
    startDate: '2026-07-03',
    endDate: '2026-07-06',
    location: 'Barcelona, Spain',
    venue: 'Sala Apolo',
    logo: 'https://ui-avatars.com/api/?name=BSB&size=80&background=7c3aed&color=fff&bold=true&rounded=true',
    accentColor: WD.violet600,
    workshopCount: 24,
    ticketUrl: 'https://bachatastarsbarcelona.com/tickets',
    ticketFromPrice: 145,
    // Set close to "today" so the urgent-deadline UI has something to
    // fire on in the preview demo. When real data lands this becomes
    // whatever the organizer sets.
    earlyBirdDeadline: '2026-07-06',
    styles: ['Bachata'] as string[],
  },
  {
    slug: 'timba-fest-london-2026',
    name: 'Timba Fest London',
    startDate: '2026-09-18',
    endDate: '2026-09-21',
    location: 'London, UK',
    venue: 'Village Underground',
    logo: 'https://ui-avatars.com/api/?name=TFL&size=80&background=0ea5e9&color=fff&bold=true&rounded=true',
    accentColor: WD.sky500,
    workshopCount: 18,
    ticketUrl: 'https://timbafestlondon.co.uk/tickets',
    ticketFromPrice: 95,
    earlyBirdDeadline: undefined as string | undefined,
    styles: ['Timba', 'Salsa'] as string[],
  },
  {
    slug: 'kizomba-prague-2026',
    name: 'Kizomba & Urban Kiz Prague',
    startDate: '2026-10-10',
    endDate: '2026-10-12',
    location: 'Prague, Czech Republic',
    venue: 'La Loca Prague',
    logo: 'https://ui-avatars.com/api/?name=KPR&size=80&background=ec4899&color=fff&bold=true&rounded=true',
    accentColor: WD.pink500,
    workshopCount: 16,
    ticketUrl: 'https://kizombaprague.com/tickets',
    ticketFromPrice: 110,
    earlyBirdDeadline: undefined as string | undefined,
    styles: ['Kizomba', 'Semba'] as string[],
  },
]

type CatalogueEntry = typeof catalogue[number]

// Real festival data from the DB, fetched via plan.myPlan for signed-in users.
// These are the user's actual picked festivals resolved against the festivals table.
const dbFestivals = ref<CatalogueEntry[]>([])

async function loadMyPlanFestivals() {
  try {
    const rows = await $trpc.plan.myPlan.query()
    dbFestivals.value = rows.map(r => ({
      slug: r.slug,
      name: r.name,
      startDate: r.startDate,
      endDate: r.endDate,
      location: [r.location, r.country].filter(Boolean).join(', '),
      venue: '',
      logo: r.logo,
      accentColor: r.accentColor || WD.purple500,
      workshopCount: r.workshopCount,
      ticketUrl: '',
      ticketFromPrice: undefined as number | undefined,
      earlyBirdDeadline: undefined as string | undefined,
      styles: (r.styles || []) as string[],
    }))
  } catch (err) {
    console.warn('[my-plan] loadMyPlanFestivals failed:', err)
  }
}

const picked = computed(() => {
  // Preview mode: use mock catalogue only.
  if (previewMode.value) {
    return catalogue
      .filter(f => effectivePickIds.value.has(f.slug))
      .sort((a, b) => a.startDate.localeCompare(b.startDate))
  }

  // Real mode: merge DB festivals with mock catalogue entries.
  // DB data wins when slugs overlap; mock-only slugs still in yearPlanIds
  // are included as fallback (they exist in the plan but not yet in the
  // festivals table — e.g. hand-seeded mock entries).
  // Filter both sources by effectivePickIds so local removals are
  // reflected immediately (RAZ-285).
  const fromDb = dbFestivals.value.filter(f => effectivePickIds.value.has(f.slug))
  const dbSlugs = new Set(fromDb.map(f => f.slug))
  const fromMock = catalogue
    .filter(f => effectivePickIds.value.has(f.slug) && !dbSlugs.has(f.slug))

  return [...fromDb, ...fromMock]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
})

// City events by slug — used by autoFillPlan to seed courses.
const cityEventsMap: Record<string, CityEvent[]> = {
  munich: cityMunich.events,
  berlin: cityBerlin.events,
}

// Auto-fill the plan based on user preferences after onboarding.
// Seeds festivals (year) and courses (month) that match the dancer's selected
// dance styles and city. Socials (week) are not seeded: that section lists the
// real events of the coming 7 days, and going is the dancer's own RSVP.
function autoFillPlan() {
  if (previewMode.value) return
  if (!isSignedIn.value) return
  const styles = dancerStyles.value
  const city = dancerCity.value
  if (!styles.length) return

  const alreadyFilled = yearPlanIds.value.size > 0 || courses.value.length > 0
  if (alreadyFilled) return

  const upperStyles = styles.map(s => s.toUpperCase())

  // --- Festivals (year plan) ---
  const matchedFestivals = catalogue.filter(f => {
    const nameUpper = f.name.toUpperCase()
    return upperStyles.some(s => nameUpper.includes(s))
  })
  matchedFestivals.slice(0, 4).forEach(f => {
    if (!yearPlanIds.value.has(f.slug)) addFestival(f.slug)
  })

  // --- City events → courses ---
  // Prefer real DB events; fall back to mock only if none loaded yet.
  const citySlug = (city || '').trim().toLowerCase()
  const cityEvents = realCityEvents.value.length > 0
    ? realCityEvents.value
    : (cityEventsMap[citySlug] || [])
  const matchedEvents = cityEvents.filter(e =>
    upperStyles.some(s => e.style.toUpperCase().includes(s)),
  )

  // Courses from type 'class' events (up to 3).
  const classEvents = matchedEvents.filter(e => e.type === 'class')
  const WEEKDAY_SHORT: Record<string, string> = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' }
  const STYLE_COLORS: Record<string, string> = { Salsa: WD.red600, Bachata: WD.violet600, Kizomba: WD.pink500, Timba: WD.cyan600 }
  courses.value = classEvents.slice(0, 3).map(e => ({
    id: e.id,
    school: e.organizer,
    teacher: '',
    style: e.style,
    level: e.level || 'All levels',
    weekday: WEEKDAY_SHORT[e.day] || e.day,
    time: e.time,
    venue: e.venue,
    nextClassDate: e.date || '',
    attended: 0,
    total: 0,
    paidThroughMonth: false,
    color: STYLE_COLORS[e.style] || WD.gray500,
  }))

  // Persist seeded courses
  const { $trpc: trpc } = useNuxtApp()
  for (const e of classEvents.slice(0, 3)) {
    trpc.plan.add
      .mutate({ itemType: 'event', itemId: e.id, metadata: { type: 'class', style: e.style, school: e.organizer, venue: e.venue, weekday: e.day, time: e.time, date: e.date || '' } })
      .catch((err) => { console.warn('[my-plan] autoFill persist course failed:', err) })
  }
}

function onRemove(slug: string) {
  // In preview mode we don't mutate real state.
  if (previewMode.value) return
  removeFestival(slug)
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  const sameMonth = s.getMonth() === e.getMonth()
  if (sameMonth) return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${e.getDate()}, ${e.getFullYear()}`
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${e.getFullYear()}`
}

function daysUntilLabel(dateStr: string) {
  const now = new Date()
  const target = new Date(dateStr)
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { text: 'Happened', urgent: false }
  if (diff === 0) return { text: 'Today', urgent: true }
  if (diff === 1) return { text: 'Tomorrow', urgent: true }
  if (diff <= 7) return { text: `In ${diff} days`, urgent: true }
  if (diff <= 30) return { text: `In ${diff} days`, urgent: false }
  if (diff <= 60) return { text: `In ${Math.ceil(diff / 7)} weeks`, urgent: false }
  return { text: `In ${Math.ceil(diff / 30)} months`, urgent: false }
}

// Short label for the year-at-a-glance strip. Prefer the "brand short"
// (initials of significant words), fall back to first 3 chars.
function shortLabel(name: string) {
  const words = name
    .replace(/[¡¿!?().,]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 2 && !/^(the|and|of|de|la|el|los|las|for|with|to|in|on|at|by)$/i.test(w))
  if (words.length >= 2) return words.map(w => w[0]).join('').slice(0, 3).toUpperCase()
  return (name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3) || '?').toUpperCase()
}

const MONTH_LABELS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

// Year-at-a-glance grid. Each of the 12 months owns any picked
// festivals that START in that month (a fest spanning May → June
// lives under May).
const monthsGrid = computed(() =>
  MONTH_LABELS.map((label, i) => {
    const entries = picked.value
      .filter(f => new Date(f.startDate).getMonth() === i)
      .map(f => {
        const s = new Date(f.startDate)
        const e = new Date(f.endDate)
        const sameMonth = s.getMonth() === e.getMonth()
        return {
          slug: f.slug,
          name: f.name,
          short: shortLabel(f.name),
          accentColor: f.accentColor,
          dayRange: sameMonth
            ? `${s.getDate()}–${e.getDate()}`
            : `${s.getDate()} → ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
        }
      })
    return { label, entries }
  })
)

// Client-only: which month index (0–11) is today. Server-render as
// -1 so the "you're here" chip doesn't hydrate-mismatch.
const todayMonth = ref(-1)
onMounted(() => {
  todayMonth.value = new Date().getMonth()
  // Fetch real hangouts data and city events for signed-in users with a city
  if (isSignedIn.value && !previewMode.value && dancerCity.value) {
    fetchHangouts()
    loadCityEvents()
  }
  // Load persisted goals, enrolled courses, socials, and real festivals from DB
  if (isSignedIn.value && !previewMode.value) {
    loadGoalsFromDb()
    loadCoursesFromDb()
    loadWeekSocials()
    loadDiscoverDeck()
    loadMyPlanFestivals()
  }
})

// Refetch hangouts and city events when city changes
watch(() => dancerCity.value, () => {
  if (isSignedIn.value && !previewMode.value && dancerCity.value) {
    fetchHangouts()
    loadCityEvents()
  }
})

// -----------------------------------------------------------------------
// Progress store — per-festival "done" toggles kept in localStorage.
// The rows show honest current state (ticket price, workshop count,
// early-bird deadline). The user checks tracks off manually as they
// complete them. No fake progress data.
// -----------------------------------------------------------------------
type TrackKey = 'ticketBought' | 'travelBooked' | 'stayBooked' | 'partnerFound' | 'vacationBooked'
type Progress = Partial<Record<TrackKey, boolean>>
const STORAGE_KEY = 'wedance-plan-progress'

// -----------------------------------------------------------------------
// Workshop picker store — per-festival workshop selections in localStorage.
// Maps festival slug to a set of selected workshop IDs.
// -----------------------------------------------------------------------
const WORKSHOPS_STORAGE_KEY = 'wedance-plan-workshops'
type WorkshopSelections = Record<string, Set<string>>
const workshopSelections = ref<WorkshopSelections>({})

// Preview seed — applied synchronously during setup so the SSR paint
// already shows a rich mix of done/urgent/todo states in demo mode.
const PREVIEW_SEED: Record<string, Progress> = {
  'meneate-viena-2026':          { ticketBought: true, travelBooked: true, vacationBooked: true },
  'bachata-stars-barcelona-2026': {},
  'kizomba-prague-2026':          {},
}

const isPreviewInitial = route.query.preview === '1'
const progressStore = ref<Record<string, Progress>>(isPreviewInitial ? PREVIEW_SEED : {})

function persistProgress() {
  if (typeof localStorage === 'undefined') return
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progressStore.value)) } catch { /* quota */ }
}

function loadWorkshopSelections() {
  if (typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(WORKSHOPS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      // Convert arrays back to Sets
      workshopSelections.value = Object.fromEntries(
        Object.entries(parsed).map(([key, val]) => [key, new Set(val as string[])])
      )
    }
  } catch { /* corrupt payload — will be overwritten on next toggle */ }
}

function persistWorkshopSelections() {
  if (typeof localStorage === 'undefined') return
  try {
    // Convert Sets to arrays for JSON serialization
    const toSave = Object.fromEntries(
      Object.entries(workshopSelections.value).map(([key, set]) => [key, Array.from(set)])
    )
    localStorage.setItem(WORKSHOPS_STORAGE_KEY, JSON.stringify(toSave))
  } catch { /* quota */ }
}

onMounted(async () => {
  // Real user: load persisted state. Preview mode skips localStorage.
  if (previewMode.value) return
  if (typeof localStorage === 'undefined') return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) progressStore.value = JSON.parse(raw)
  } catch { /* corrupt payload — will be overwritten on next toggle */ }

  // Load workshop selections
  loadWorkshopSelections()

  // Sync ticket status from backend — a purchased ticket overrides localStorage
  if (isSignedIn.value) {
    try {
      const paidSlugs = await $trpc.festivalSignup.myTickets.query()
      for (const slug of paidSlugs) {
        const current = progressStore.value[slug] ?? {}
        if (!current.ticketBought) {
          progressStore.value = {
            ...progressStore.value,
            [slug]: { ...current, ticketBought: true },
          }
        }
      }
      persistProgress()
    } catch { /* non-critical — local state is the fallback */ }
  }
})

function getProgress(slug: string): Progress {
  return progressStore.value[slug] ?? {}
}

// Get workshops for a festival by slug
function getWorkshopsForFestival(slug: string): typeof meneate.mockWorkshops {
  if (slug === 'meneate-viena-2026') return meneate.mockWorkshops
  if (slug === 'salsa-open-berlin-2026') return salsaOpen.mockWorkshops
  if (slug === 'cuban-fire-munich-2026') return cubanFire.mockWorkshops
  if (slug === 'caribbean-urban-fire-munich-2026') return caribbeanUrbanFire.mockWorkshops
  return []
}

function getTeacherName(slug: string, teacherId: string): string {
  const teachers = {
    'meneate-viena-2026': meneate.mockTeachers,
    'salsa-open-berlin-2026': salsaOpen.mockTeachers,
    'cuban-fire-munich-2026': cubanFire.mockTeachers,
    'caribbean-urban-fire-munich-2026': caribbeanUrbanFire.mockTeachers,
  }
  const festivalTeachers = teachers[slug as keyof typeof teachers]
  if (!festivalTeachers) return ''
  const teacher = festivalTeachers.find((t: any) => t.id === teacherId)
  return teacher?.name || ''
}

function getSelectedWorkshops(slug: string): Set<string> {
  return workshopSelections.value[slug] ?? new Set()
}

function removeConflicting(slug: string, newWorkshopId: string) {
  // Remove any existing pick at the same day+time (different room)
  const allWorkshops = getWorkshopsForFestival(slug)
  const newWorkshop = allWorkshops.find((w: any) => w.id === newWorkshopId)
  if (!newWorkshop || newWorkshop.type === 'party') return

  const selected = getSelectedWorkshops(slug)
  const toRemove: string[] = []
  for (const existingId of selected) {
    const existing = allWorkshops.find((w: any) => w.id === existingId)
    if (existing && existing.id !== newWorkshop.id && existing.type !== 'party' && existing.day === newWorkshop.day && existing.time === newWorkshop.time) {
      toRemove.push(existingId)
    }
  }
  toRemove.forEach(id => selected.delete(id))
}

function toggleWorkshop(slug: string, workshopId: string) {
  if (!workshopSelections.value[slug]) {
    workshopSelections.value[slug] = new Set()
  }
  const selected = workshopSelections.value[slug]
  if (selected.has(workshopId)) {
    selected.delete(workshopId)
  } else {
    removeConflicting(slug, workshopId)
    selected.add(workshopId)
  }
  workshopSelections.value = { ...workshopSelections.value }
  if (!previewMode.value) persistWorkshopSelections()
}

function removeSelectedWorkshop(slug: string, workshopId: string) {
  const selected = getSelectedWorkshops(slug)
  if (selected.has(workshopId)) {
    selected.delete(workshopId)
    workshopSelections.value = { ...workshopSelections.value }
    if (!previewMode.value) persistWorkshopSelections()
  }
}

function toggleTrack(slug: string, key: TrackKey) {
  const current = getProgress(slug)
  progressStore.value = {
    ...progressStore.value,
    [slug]: { ...current, [key]: !current[key] },
  }
  if (!previewMode.value) persistProgress()
}

// -----------------------------------------------------------------------
// Helpers.
// -----------------------------------------------------------------------
function daysBetween(dateStr: string) {
  const now = new Date()
  const target = new Date(dateStr)
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

// Google Calendar prefill URL for an all-day vacation block.
// dates=YYYYMMDD/YYYYMMDD, end exclusive.
function gcalLink(f: CatalogueEntry) {
  const start = f.startDate.replace(/-/g, '')
  const endDate = new Date(f.endDate)
  endDate.setDate(endDate.getDate() + 1)
  const endStr = endDate.toISOString().slice(0, 10).replace(/-/g, '')
  const title = encodeURIComponent(`Vacation · ${f.name}`)
  const details = encodeURIComponent(`Dance festival — ${f.location}\nSee your plan: /my-plan`)
  const loc = encodeURIComponent(`${f.venue}, ${f.location}`)
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${endStr}&details=${details}&location=${loc}`
}

function flightsLink(f: CatalogueEntry) {
  return `https://www.google.com/travel/flights?q=flights%20to%20${encodeURIComponent(f.location)}%20${f.startDate}`
}

function staysLink(f: CatalogueEntry) {
  return `https://www.google.com/travel/hotels/${encodeURIComponent(f.location)}?q=${encodeURIComponent(f.venue)}&checkin=${f.startDate}&checkout=${f.endDate}`
}

// -----------------------------------------------------------------------
// Per-festival tracks. Each row: icon · label · state (color-coded) ·
// action (button/link). Real state where the data supports it; local
// toggle where it doesn't (we don't fake booking status).
// -----------------------------------------------------------------------
type TrackAction = { label: string; href: string; external: boolean }
type Track = {
  key: TrackKey | 'workshops' | 'community'
  icon: any
  label: string
  state: { text: string; tone: 'done' | 'urgent' | 'todo' | 'muted' }
  action: TrackAction | null
  altAction?: TrackAction  // "or X" fallback — used on tracks where WeDance has a native path (sharing) and Google is the fallback
  onAction?: () => void    // When set, action renders as a button (calls this) instead of a link
  toggleKey?: TrackKey
  done: boolean
}

function tracks(f: CatalogueEntry): Track[] {
  const p = getProgress(f.slug)
  const daysToStart = daysBetween(f.startDate)
  const daysToEarlyBird = f.earlyBirdDeadline ? daysBetween(f.earlyBirdDeadline) : null
  const earlyBirdActive = daysToEarlyBird !== null && daysToEarlyBird >= 0 && daysToEarlyBird <= 7
  const priceText = f.ticketFromPrice ? `€${f.ticketFromPrice}` : ''

  return [
    // Ticket
    {
      key: 'ticketBought',
      icon: Ticket,
      label: 'Ticket',
      state: p.ticketBought
        ? { text: 'Bought', tone: 'done' }
        : earlyBirdActive
          ? { text: `Early-bird ends in ${daysToEarlyBird}d${priceText ? ` · from ${priceText}` : ''}`, tone: 'urgent' }
          : f.ticketFromPrice
            ? { text: `From ${priceText}`, tone: 'todo' }
            : { text: 'Not bought', tone: 'todo' },
      // WeDance is the ticketing platform — buy on the festival page's
      // Tickets section, not on the organizer's own site.
      action: p.ticketBought
        ? null
        : { label: f.ticketFromPrice ? `Buy ${priceText}` : 'Buy', href: `${festivalPath(f.slug)}#tickets`, external: false },
      toggleKey: 'ticketBought',
      done: !!p.ticketBought,
    },
    // Vacation from work
    {
      key: 'vacationBooked',
      icon: CalendarPlus,
      label: 'Vacation',
      state: p.vacationBooked
        ? { text: 'On the calendar', tone: 'done' }
        : daysToStart <= 60 && daysToStart >= 0
          ? { text: 'Not booked from work', tone: 'urgent' }
          : { text: 'Not booked from work', tone: 'todo' },
      action: p.vacationBooked ? null : { label: 'Add to calendar', href: gcalLink(f), external: true },
      toggleKey: 'vacationBooked',
      done: !!p.vacationBooked,
    },
    // Travel — WeDance ride shares first, external flights as fallback
    {
      key: 'travelBooked',
      icon: Plane,
      label: 'Travel',
      state: p.travelBooked ? { text: 'Booked', tone: 'done' } : { text: 'Not booked', tone: 'todo' },
      action: p.travelBooked ? null : { label: rideOpenSlugs.value.has(f.slug) ? 'Close rides' : 'Find a ride', href: '#', external: false },
      onAction: p.travelBooked ? undefined : () => toggleRidePanel(f.slug),
      altAction: p.travelBooked ? undefined : { label: 'or flights', href: flightsLink(f), external: true },
      toggleKey: 'travelBooked',
      done: !!p.travelBooked,
    },
    // Stay — WeDance roommate matching first, external hotels as fallback
    {
      key: 'stayBooked',
      icon: Home,
      label: 'Stay',
      state: p.stayBooked ? { text: 'Booked', tone: 'done' } : { text: 'Not booked', tone: 'todo' },
      action: p.stayBooked ? null : { label: 'Share a room', href: `${festivalPath(f.slug)}#activities`, external: false },
      altAction: p.stayBooked ? undefined : { label: 'or hotel', href: staysLink(f), external: true },
      toggleKey: 'stayBooked',
      done: !!p.stayBooked,
    },
    // Workshops
    {
      key: 'workshops',
      icon: GraduationCap,
      label: 'Workshops',
      state: { text: `${f.workshopCount} on the schedule · ${getSelectedWorkshops(f.slug).size} picked`, tone: getSelectedWorkshops(f.slug).size > 0 ? 'done' : 'todo' },
      action: getWorkshopsForFestival(f.slug).length === 0 ? { label: 'Browse workshops', href: `${festivalPath(f.slug)}#schedule`, external: false } : null,
      done: getSelectedWorkshops(f.slug).size > 0,
    },
    // Partner
    {
      key: 'partnerFound',
      icon: Heart,
      label: 'Partner',
      state: p.partnerFound ? { text: 'Matched', tone: 'done' } : { text: 'Not looking yet', tone: 'todo' },
      action: p.partnerFound ? null : { label: 'Find one', href: `${festivalPath(f.slug)}#discover`, external: false },
      toggleKey: 'partnerFound',
      done: !!p.partnerFound,
    },
    // Community (dinners, rides, roommate)
    {
      key: 'community',
      icon: Coffee,
      label: 'Community',
      state: { text: 'Rides, dinners, roommate', tone: 'muted' },
      action: { label: 'Browse', href: `${festivalPath(f.slug)}#activities`, external: false },
      done: false,
    },
  ]
}

// -----------------------------------------------------------------------
// Cross-festival summary. Real math, no invented totals.
// -----------------------------------------------------------------------
const summary = computed(() => {
  const list = picked.value
  const committed = list.reduce((sum, f) => {
    const paid = getProgress(f.slug).ticketBought
    return sum + (paid && f.ticketFromPrice ? f.ticketFromPrice : 0)
  }, 0)
  const pending = list.reduce((sum, f) => {
    const paid = getProgress(f.slug).ticketBought
    return sum + (!paid && f.ticketFromPrice ? f.ticketFromPrice : 0)
  }, 0)
  const urgentDeadlines = list.filter(f => {
    if (!f.earlyBirdDeadline) return false
    const d = daysBetween(f.earlyBirdDeadline)
    return d >= 0 && d <= 7 && !getProgress(f.slug).ticketBought
  }).length
  return { count: list.length, committed, pending, urgentDeadlines }
})

const toneStyle = (tone: 'done' | 'urgent' | 'todo' | 'muted') => {
  if (tone === 'done')   return { color: WD.green600, background: (WD.green600 + '18') }
  if (tone === 'urgent') return { color: WD.red600, background: (WD.red600 + '18') }
  if (tone === 'muted')  return { color: WD.amber600, background: (WD.amber600 + '18') }
  return { color: WD.brown700, background: (WD.brown900 + '0a') }
}

// -----------------------------------------------------------------------
// Accordion — collapsed by default; click any card header to expand.
// Preview mode expands the "urgent" festival so both states are visible.
// -----------------------------------------------------------------------
const expandedSlugs = ref<Set<string>>(new Set(
  isPreviewInitial ? ['bachata-stars-barcelona-2026'] : [],
))

// Which festivals have the "Find a ride" panel open (toggled from the Travel track).
const rideOpenSlugs = ref<Set<string>>(new Set())

function toggleRidePanel(slug: string) {
  const s = new Set(rideOpenSlugs.value)
  if (s.has(slug)) s.delete(slug); else s.add(slug)
  rideOpenSlugs.value = s
}

function toggleExpanded(slug: string) {
  const s = new Set(expandedSlugs.value)
  if (s.has(slug)) s.delete(slug); else s.add(slug)
  expandedSlugs.value = s
}

// -----------------------------------------------------------------------
// GOALS · long arcs above the year. Editing not yet wired — content is
// user-owned data that will live server-side. Preview seeds a mix.
// -----------------------------------------------------------------------
// Preview goals for ?preview=1 mode.
type PreviewGoal = { id: string; title: string; why: string; progress: number; style: string; nudge?: string; icon: any; color: string }
const previewGoals: PreviewGoal[] = [
  { id: 'g1', title: 'Learn timba (advanced)',   why: 'Feel at home in a Cuban rueda.',             progress: 55, style: 'Timba', nudge: 'Book 2 more privates before Cuban Fire.', icon: Flame,     color: WD.red600 },
  { id: 'g2', title: 'Perform at Cuban Fire',    why: 'Duet with Emilia — 3-minute son piece.',    progress: 20, style: 'Salsa', nudge: 'Choose the song this week.',                icon: Sparkles,  color: WD.amber500 },
  { id: 'g3', title: 'Teach my first class',     why: 'Kids salsa Saturdays at 15x4.',              progress: 10, style: 'Salsa', nudge: 'Sit in on Anna\'s lesson Sunday.',           icon: GraduationCap, color: WD.green600 },
]

// Real goals — persisted via TRPC plan router.
const { goals: dbGoals, addGoal, removeGoal, updateGoal, hasGoal, loadFromDb: loadGoalsFromDb } = useGoals()


// Unified view: preview mode shows hard-coded preview goals; real mode shows DB goals.
const goalsList = computed(() => {
  if (previewMode.value) return previewGoals
  return dbGoals.value.map(g => ({
    id: g.id,
    title: g.title,
    why: g.why,
    progress: g.progress,
    style: g.style,
    nudge: undefined as string | undefined,
    icon: Target,
    color: WD.amber600,
  }))
})

// Resolve a goal's effective style: explicit tag, or auto-detect from title.
function goalEffectiveStyle(g: { title: string; style: string }): string {
  if (g.style) return g.style
  return detectDanceStyle(g.title)?.name || ''
}

// Map from dance style → goal titles that target it.
const goalsByStyle = computed(() => {
  const map = new Map<string, string[]>()
  for (const g of goalsList.value) {
    const s = goalEffectiveStyle(g)
    if (!s) continue
    const list = map.get(s) || []
    list.push(g.title)
    map.set(s, list)
  }
  return map
})

// Check if any goal targets a given dance style.
function goalsForStyle(style: string): string[] {
  if (!style) return []
  // A 'Salsa NY' goal is served by a 'Salsa' festival and vice versa.
  return [...goalsByStyle.value].filter(([s]) => relatedDanceStyles(s, style)).flatMap(([, titles]) => titles)
}

// Inline add-goal form state.
const showGoalForm = ref(false)
const goalFormTitle = ref('')
const goalFormWhy = ref('')
const goalFormStyle = ref('')
// The picker speaks string[]; a goal has at most one style.
const goalFormStyles = computed({
  get: () => (goalFormStyle.value ? [goalFormStyle.value] : []),
  set: (v: string[]) => { goalFormStyle.value = v[0] ?? '' },
})
const goalFormError = ref('')

// Progress editing state.
const editingProgressGoalId = ref<string | null>(null)

watch(goalFormTitle, () => { goalFormError.value = '' })

async function onGoalSubmit() {
  const t = goalFormTitle.value.trim()
  if (!t) return
  if (hasGoal(t)) {
    goalFormError.value = 'You already have this goal'
    return
  }
  const w = goalFormWhy.value.trim()
  const s = goalFormStyle.value
  goalFormTitle.value = ''
  goalFormWhy.value = ''
  goalFormStyle.value = ''
  goalFormError.value = ''
  showGoalForm.value = false
  await addGoal(t, w, s)
}
function onGoalCancel() {
  goalFormTitle.value = ''
  goalFormWhy.value = ''
  goalFormStyle.value = ''
  showGoalForm.value = false
}

async function onProgressChange(goalId: string, value: number) {
  await updateGoal(goalId, { progress: value })
}
function startEditingProgress(goalId: string) {
  if (!previewMode.value) editingProgressGoalId.value = goalId
}
function stopEditingProgress() {
  editingProgressGoalId.value = null
}

// -----------------------------------------------------------------------
// COURSES · monthly cadence: school + teacher + level + next class.
// -----------------------------------------------------------------------
type Course = {
  id: string; school: string; teacher: string; style: string; level: string
  weekday: string; time: string; venue: string
  nextClassDate: string
  attended: number; total: number
  paidThroughMonth: boolean
  color: string
}
const previewCourses: Course[] = [
  {
    id: 'c1',
    school: 'Cubaila Munich', teacher: 'Yordana + Alexei',
    style: 'Timba', level: 'Beginner+',
    weekday: 'Wed', time: '19:00',
    venue: 'La Rumba',
    nextClassDate: '2026-07-08',
    attended: 6, total: 8,
    paidThroughMonth: true,
    color: WD.red600,
  },
  {
    id: 'c2',
    school: '15x4 Munich', teacher: 'Emilia',
    style: 'Cuban Son', level: 'Intermediate',
    weekday: 'Mon', time: '20:00',
    venue: 'Buena Vista',
    nextClassDate: '2026-07-06',
    attended: 3, total: 4,
    paidThroughMonth: false,
    color: WD.cyan600,
  },
]
const courses = ref<Course[]>(isPreviewInitial ? previewCourses : [])

// Enrollment picker — shows available classes from real DB events.
const showEnrollPicker = ref(false)
const WEEKDAY_SHORT_ENROLL: Record<string, string> = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' }
const STYLE_COLORS_ENROLL: Record<string, string> = { Salsa: WD.red600, Bachata: WD.violet600, Kizomba: WD.pink500, Timba: WD.cyan600 }

// v3 event type → CityEvent type mapping (same as city page).
const EVENT_TYPE_MAP: Record<string, string> = { Course: 'class', Workshop: 'workshop', Party: 'social', Concert: 'social', Show: 'social' }

// Real upcoming events for the user's city, loaded from DB.
const realCityEvents = ref<CityEvent[]>([])
async function loadCityEvents() {
  const citySlug = (dancerCity.value || '').trim().toLowerCase()
  if (!citySlug) return
  try {
    const rows = await $trpc.events.byCity.query({ citySlug })
    realCityEvents.value = rows
      .filter((e: any) => !e.isFestival)
      .map((e: any) => ({
        id: e.id,
        name: e.name || 'Event',
        type: (EVENT_TYPE_MAP[e.type] || 'social') as CityEvent['type'],
        style: (e.styles as string[])?.[0] || '',
        day: eventLocalWeekday(e.startDate, e.timezone) as CityEvent['day'],
        time: eventLocalTime(e.startDate, e.timezone),
        duration: e.endDate ? Math.round((new Date(e.endDate).getTime() - new Date(e.startDate).getTime()) / 60000) : 0,
        venue: e.venueName || '',
        address: e.venueAddress || '',
        organizer: e.organizerName || '',
        organizerId: e.organizerUsername || undefined,
        level: undefined,
        accentColor: WD.red600,
        attendeeCount: 0,
        recurring: false,
        date: eventLocalDate(e.startDate, e.timezone),
      } as CityEvent))
  } catch (err) {
    console.warn('[my-plan] loadCityEvents failed:', err)
  }
}

const todayISO = computed(() => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
})

// 'YYYY-MM-DD' → 'Mon Oct 13' (human-readable short date).
function formatShortDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00Z`)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// Merge real DB events with mock fallback (mock only if no real events loaded).
const availableClasses = computed(() => {
  const citySlug = (dancerCity.value || '').trim().toLowerCase()
  const enrolledIds = new Set(courses.value.map(c => c.id))
  // Prefer real events from DB; fall back to mock data only if DB returned nothing.
  const source = realCityEvents.value.length > 0
    ? realCityEvents.value
    : (cityEventsMap[citySlug] || [])
  return source
    .filter(e => e.type === 'class' && !enrolledIds.has(e.id))
    .filter(e => !e.date || e.date >= todayISO.value)
})

function enrollClass(e: CityEvent) {
  const course: Course = {
    id: e.id,
    school: e.organizer,
    teacher: '',
    style: e.style,
    level: e.level || 'All levels',
    weekday: WEEKDAY_SHORT_ENROLL[e.day] || e.day,
    time: e.time,
    venue: e.venue,
    nextClassDate: e.date || '',
    attended: 0,
    total: 0,
    paidThroughMonth: false,
    color: STYLE_COLORS_ENROLL[e.style] || WD.gray500,
  }
  courses.value.push(course)
  useTrack().track('week_plan_add', { event_id: e.id, source: 'enroll_picker' })

  // Persist the enrollment
  const { $trpc } = useNuxtApp()
  $trpc.plan.add
    .mutate({ itemType: 'event', itemId: e.id, metadata: { type: 'class', style: e.style, school: e.organizer, venue: e.venue, weekday: e.day, time: e.time, date: e.date || '' } })
    .catch((err) => {
      console.warn('[my-plan] enrollCourse failed:', err)
    })

  // Auto-close picker if no more classes available
  if (availableClasses.value.length === 0) {
    showEnrollPicker.value = false
  }
}

function unenrollCourse(id: string) {
  courses.value = courses.value.filter(c => c.id !== id)
  const { $trpc } = useNuxtApp()
  $trpc.plan.remove
    .mutate({ itemType: 'event', itemId: id })
    .catch((err) => {
      console.warn('[my-plan] unenrollCourse failed:', err)
    })
}

// Load enrolled courses from the DB on mount.
function loadCoursesFromDb() {
  const { $trpc } = useNuxtApp()
  $trpc.plan.listDetailed
    .query()
    .then((rows) => {
      const dbCourses: Course[] = []
      for (const r of rows) {
        if (r.itemType === 'event' && r.metadata && (r.metadata as Record<string, string>).type === 'class') {
          const m = r.metadata as Record<string, string>
          // Skip courses with a specific past date — they already happened.
          if (m.date && m.date < todayISO.value) continue
          dbCourses.push({
            id: r.itemId,
            school: m.school || '',
            teacher: '',
            style: m.style || '',
            level: m.level || 'All levels',
            weekday: (m.weekday && WEEKDAY_SHORT_ENROLL[m.weekday]) || m.weekday || '',
            time: m.time || '',
            venue: m.venue || '',
            nextClassDate: m.date || '',
            attended: 0,
            total: 0,
            paidThroughMonth: false,
            color: (m.style && STYLE_COLORS_ENROLL[m.style]) || WD.gray500,
          })
        }
      }
      if (dbCourses.length > 0) {
        courses.value = dbCourses
      }
    })
    .catch((err) => {
      console.warn('[my-plan] loadCoursesFromDb failed:', err)
    })
}

// -----------------------------------------------------------------------
// SOCIALS · "Where you're dancing": ONLY the events the dancer put in their
// plan (plan.weekSocials — RSVPs from the city/event pages, discover Yes…)
// happening in the next 7 days. No suggestions here; discovery is "Full week".
// -----------------------------------------------------------------------
type Social = {
  /** The occurrence shown this week. */
  id: string
  /** The plan item's event id (differs for a recurring event added on another date). */
  planItemId: string
  name: string; dayLabel: string; dateISO: string; time: string
  venue: string; city: string; style: string
  friendsGoing: number
  color: string
}
// Preview dates are relative to today so the demo always shows a live week.
function previewDay(offset: number): { dayLabel: string; dateISO: string } {
  const d = new Date(Date.now() + offset * 86400_000)
  return {
    dayLabel: d.toLocaleDateString('en-US', { weekday: 'short' }),
    dateISO: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
  }
}
const previewSocials: Social[] = [
  { id: 's1', planItemId: 's1', name: 'La Rumba night',         ...previewDay(1), time: '21:00', venue: 'La Rumba',   city: 'Munich', style: 'Cuban',   friendsGoing: 5, color: WD.red600 },
  { id: 's2', planItemId: 's2', name: 'Rueda flashmob',         ...previewDay(2), time: '14:00', venue: 'Diana Tempel', city: 'Munich', style: 'Rueda',   friendsGoing: 12, color: WD.amber500 },
  { id: 's3', planItemId: 's3', name: 'Bailala night',          ...previewDay(2), time: '22:00', venue: 'Bailala',   city: 'Munich', style: 'Bachata', friendsGoing: 3, color: WD.purple500 },
  { id: 's4', planItemId: 's4', name: 'Cuban practica',         ...previewDay(3), time: '19:00', venue: 'Buena Vista', city: 'Munich', style: 'Practica', friendsGoing: 4, color: WD.green600 },
  { id: 's5', planItemId: 's5', name: 'Warm-up social',         ...previewDay(6), time: '20:30', venue: 'La Rumba',   city: 'Munich', style: 'All',     friendsGoing: 2, color: WD.cyan600 },
]
const socials = ref<Social[]>(isPreviewInitial ? previewSocials : [])
const weekSocialsLoaded = ref(isPreviewInitial)

/** 'YYYY-MM-DD' → 'Sat 18 Oct' for the day chip's second line. */
function shortDayDate(iso: string): string {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00Z`)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

async function loadWeekSocials() {
  if (previewMode.value || !isSignedIn.value) return
  try {
    const { socials: rows } = await $trpc.plan.weekSocials.query()
    socials.value = rows.map((e) => {
      const tz = e.timezone || undefined
      const style = e.styles[0] || e.type || ''
      return {
        id: e.id,
        name: e.name,
        dayLabel: (WEEKDAY_SHORT_ENROLL[eventLocalWeekday(e.startDate, tz)] || ''),
        dateISO: eventLocalDate(e.startDate, tz),
        time: eventLocalTime(e.startDate, tz),
        venue: e.venueName,
        city: e.city,
        style,
        friendsGoing: e.friendsGoing,
        planItemId: e.planItemId,
        color: STYLE_COLORS_ENROLL[style] || WD.gray500,
      }
    })
  } catch (err) {
    console.warn('[my-plan] loadWeekSocials failed:', err)
  } finally {
    weekSocialsLoaded.value = true
  }
}

// Trigger auto-fill when user lands on my-plan for the first time after onboarding.
// Must be placed after the courses ref to avoid TDZ errors in production builds.
// The flag prevents auto-fill from re-triggering after the user manually removes
// all plan items (RAZ-285).
const autoFillDone = ref(false)
watch([isSignedIn, onboardedAtReal, yearPlanIds], () => {
  if (autoFillDone.value) return
  if (isSignedIn.value && onboardedAtReal.value && yearPlanIds.value.size === 0 && courses.value.length === 0) {
    autoFillDone.value = true
    nextTick(() => autoFillPlan())
  } else if (yearPlanIds.value.size > 0 || courses.value.length > 0) {
    // Plan already has items (loaded from DB or just added) — suppress future auto-fills.
    autoFillDone.value = true
  }
}, { immediate: true })

// The server already limits the list to the coming week; drop anything that
// has started since the page loaded.
const upcomingSocials = computed(() =>
  socials.value.filter(s => !s.dateISO || s.dateISO >= todayISO.value),
)

const { removeEvent: removeWeekEvent, addEvent: addWeekEvent } = useWeekPlan()

// Last row taken out of the plan — the list offers a one-tap Undo for it.
const removedSocial = ref<Social | null>(null)

/** "✓ Going" off = out of the plan; the row leaves the list (Undo puts it back). */
function removeSocialFromPlan(id: string) {
  const s = socials.value.find(x => x.id === id)
  if (!s) return
  socials.value = socials.value.filter(x => x.id !== id)
  removedSocial.value = s
  if (!previewMode.value) removeWeekEvent(s.planItemId)
}

function undoRemoveSocial() {
  const s = removedSocial.value
  if (!s) return
  removedSocial.value = null
  socials.value = [...socials.value, s].sort((a, b) => (a.dateISO + a.time).localeCompare(b.dateISO + b.time))
  if (!previewMode.value) addWeekEvent(s.planItemId)
}

// -----------------------------------------------------------------------
// TONIGHT · spontaneous evening — dinners, bar hops, rides.
// -----------------------------------------------------------------------
type Hangout = {
  id: string; kind: 'dinner' | 'bar' | 'ride' | 'floor' | 'coffee'
  title: string; time: string; host?: string; venue?: string
  people: number; going: boolean
  color: string; mine: boolean
}

// Color map for hangout kinds
const hangoutColors: Record<string, string> = {
  dinner: WD.amber500,
  coffee: WD.green600,
  floor: WD.red600,
  bar: WD.purple500,
  ride: WD.cyan600,
}

const previewHangouts: Hangout[] = [
  { id: 'h1', kind: 'dinner', title: 'Dinner before La Rumba', time: '19:00', host: 'Mark + Klaus', venue: 'Xoco', people: 6,  going: false, color: WD.amber500, mine: false },
  { id: 'h2', kind: 'floor',  title: 'La Rumba floor',         time: '22:00', venue: 'La Rumba',   people: 40, going: true,  color: WD.red600, mine: true },
  { id: 'h3', kind: 'bar',    title: 'Post-social mojitos',    time: '02:30', venue: 'Café con Leche', people: 8,  going: false, color: WD.purple500, mine: false },
  { id: 'h4', kind: 'ride',   title: 'Ride to Diana Tempel',   time: '13:30', host: 'Egor',        people: 3,  going: false, color: WD.cyan600, mine: false },
]

const hangouts = ref<Hangout[]>(isPreviewInitial ? previewHangouts : [])
const loadingHangouts = ref(false)
const userRsvpedHangouts = ref<Set<string>>(new Set())

// Fetch tonight's hangouts from backend
async function fetchHangouts() {
  if (previewMode.value || !isSignedIn.value || !dancerCity.value) return

  loadingHangouts.value = true
  try {
    const citySlug = dancerCity.value?.toLowerCase() || 'munich'
    const result = await $trpc.hangouts.listTonight.query({ citySlug })
    const currentDancerId = dancerIdReal.value

    hangouts.value = (result as any[]).map((h: any) => ({
      id: h.id,
      kind: h.kind,
      title: h.title,
      time: h.time,
      host: h.host,
      venue: h.venue,
      people: h.rsvpCount || 0,
      going: h.rsvps?.includes(currentDancerId) || false,
      color: hangoutColors[h.kind] || WD.brown900,
      mine: h.dancerId === currentDancerId,
    }))

    // Track which hangouts user has RSVPed to
    userRsvpedHangouts.value = new Set((result as any[]).filter((h: any) => h.rsvps?.includes(currentDancerId)).map((h: any) => h.id))
  } catch (error) {
    console.error('Failed to fetch hangouts:', error)
  } finally {
    loadingHangouts.value = false
  }
}

async function toggleHangout(id: string) {
  if (previewMode.value) {
    hangouts.value = hangouts.value.map(h => h.id === id ? { ...h, going: !h.going } : h)
    return
  }

  try {
    await $trpc.hangouts.toggleRsvp.mutate({ hangoutId: id })

    // Update local state
    const wasGoing = userRsvpedHangouts.value.has(id)
    if (wasGoing) {
      userRsvpedHangouts.value.delete(id)
    } else {
      userRsvpedHangouts.value.add(id)
    }

    // Update the hangout in the list
    hangouts.value = hangouts.value.map(h =>
      h.id === id ? { ...h, going: !h.going } : h
    )
  } catch (error: any) {
    hangoutError.value = `Could not toggle RSVP: ${error?.message || 'unknown error'}`
  }
}
const hangoutIcon = (kind: Hangout['kind']) => kind === 'dinner' ? UtensilsCrossed : kind === 'coffee' ? Coffee : kind === 'bar' ? GlassWater : kind === 'ride' ? Car : MoonStar

// Create-hangout form state
const showHangoutForm = ref(false)
const newHangout = ref({ kind: 'dinner' as 'dinner' | 'bar' | 'ride' | 'floor' | 'coffee', title: '', time: '20:00', venue: '' })
const creatingHangout = ref(false)
const hangoutError = ref('')

async function createHangout() {
  if (previewMode.value) {
    const fake: Hangout = {
      id: `h-${Date.now()}`,
      kind: newHangout.value.kind,
      title: newHangout.value.title || `${newHangout.value.kind.charAt(0).toUpperCase() + newHangout.value.kind.slice(1)} hangout`,
      time: newHangout.value.time,
      venue: newHangout.value.venue || undefined,
      people: 1,
      going: true,
      color: hangoutColors[newHangout.value.kind] || WD.brown900,
      mine: true,
    }
    hangouts.value.unshift(fake)
    showHangoutForm.value = false
    newHangout.value = { kind: 'dinner', title: '', time: '20:00', venue: '' }
    return
  }

  if (!newHangout.value.title.trim()) return
  hangoutError.value = ''
  creatingHangout.value = true
  try {
    const citySlug = dancerCity.value?.toLowerCase() || 'munich'
    await $trpc.hangouts.create.mutate({
      kind: newHangout.value.kind,
      title: newHangout.value.title.trim(),
      time: newHangout.value.time,
      venue: newHangout.value.venue.trim() || undefined,
      citySlug,
    })
    showHangoutForm.value = false
    newHangout.value = { kind: 'dinner', title: '', time: '20:00', venue: '' }
    await fetchHangouts()
  } catch (error: any) {
    const msg = error?.message || ''
    if (msg.includes('UNAUTHORIZED') || msg.includes('Not signed in')) {
      hangoutError.value = 'Your session expired. Please sign out and sign in again.'
    } else if (msg.includes('Failed query') || msg.includes('insert into')) {
      hangoutError.value = 'Could not create hangout. Please try again later.'
    } else {
      hangoutError.value = msg || 'Something went wrong. Please try again.'
    }
  } finally {
    creatingHangout.value = false
  }
}

async function closeHangout(id: string) {
  if (previewMode.value) {
    hangouts.value = hangouts.value.filter(h => h.id !== id)
    return
  }
  try {
    await $trpc.hangouts.close.mutate({ id })
    hangouts.value = hangouts.value.filter(h => h.id !== id)
  } catch (error) {
    console.error('Failed to close hangout:', error)
  }
}

// -----------------------------------------------------------------------
// HEAT STRIP · the top 3 items across every scale, sorted by urgency.
// -----------------------------------------------------------------------
type HeatItem = { key: string; label: string; detail: string; href: string; external?: boolean; color: string; urgency: number }
const heatItems = computed<HeatItem[]>(() => {
  const items: HeatItem[] = []
  // Festivals: early-bird deadlines
  picked.value.forEach(f => {
    if (!f.earlyBirdDeadline) return
    const d = daysBetween(f.earlyBirdDeadline)
    if (d < 0 || d > 14 || getProgress(f.slug).ticketBought) return
    items.push({
      key: `fest-${f.slug}`,
      label: `${f.name} · early-bird`,
      detail: `Ends in ${d}d · from €${f.ticketFromPrice}`,
      href: `${festivalPath(f.slug)}#tickets`,
      external: false,
      color: WD.red600,
      urgency: 100 - d,
    })
  })
  // Courses: unpaid this month
  courses.value.filter(c => !c.paidThroughMonth).forEach(c => {
    items.push({
      key: `course-${c.id}`,
      label: `${c.school} · pay for July`,
      detail: `${c.style} ${c.level} · ${c.weekday} ${c.time}`,
      href: `/events/${c.id}`,
      color: WD.amber500,
      urgency: 70,
    })
  })
  // Socials: the next two nights out already in the plan
  upcomingSocials.value.slice(0, 2).forEach(s => {
    items.push({
      key: `social-${s.id}`,
      label: `${s.name} · ${s.dayLabel} ${s.time}`,
      detail: s.friendsGoing > 0 ? `${s.venue} · ${s.friendsGoing} friend${s.friendsGoing === 1 ? '' : 's'} going` : s.venue,
      href: '#socials',
      color: WD.cyan600,
      urgency: 40,
    })
  })
  // Tonight: any open invites
  hangouts.value.filter(h => !h.going).slice(0, 1).forEach(h => {
    items.push({
      key: `tonight-${h.id}`,
      label: `Tonight · ${h.title}`,
      detail: `${h.time} · ${h.venue ?? h.host ?? ''}`,
      href: '#tonight',
      color: WD.purple500,
      urgency: 90,
    })
  })
  return items.sort((a, b) => b.urgency - a.urgency).slice(0, 3)
})

// -----------------------------------------------------------------------
// DISCOVER · widen-your-year deck below hangouts.
// Swipeable cards mixing dancers going to fests + local dancers + events.
// Yes-swipe on a dancer heading to an unpicked festival accumulates a
// nudge in the Year section: "3 friends heading to Prague — add it?".
// -----------------------------------------------------------------------
// `target` is what a decision is stored against (discover_swipes); preview
// cards have none and never write.
type DeckTarget = { kind: 'dancer' | 'event' | 'festival'; id: string; festivalSlug?: string }
type DeckCard =
  | { id: string; kind: 'dancer-your-fest';   target?: DeckTarget; name: string; photo: string; city: string; danceStyles: string[]; festivalSlug: string; festivalName: string; festivalColor: string; reason: string }
  | { id: string; kind: 'dancer-new-fest';    target?: DeckTarget; name: string; photo: string; city: string; danceStyles: string[]; festivalSlug: string; festivalName: string; festivalColor: string; reason: string }
  | { id: string; kind: 'dancer-local';       target?: DeckTarget; name: string; photo: string; city: string; danceStyles: string[]; regularAt?: string; reason: string }
  | { id: string; kind: 'event-festival';     target?: DeckTarget; name: string; slug: string;  dateISO: string; venue: string; city: string; friendsGoing: number; color: string; reason: string }
  | { id: string; kind: 'event-social';       target?: DeckTarget; name: string; dayLabel: string; dateISO?: string; time: string; venue: string; city: string; style: string; friendsGoing: number; color: string; reason: string }

const previewDeck: DeckCard[] = [
  { id: 'd1', kind: 'dancer-your-fest',  name: 'Ivana',   city: 'Berlin',    photo: 'https://i.pravatar.cc/240?u=ivana',   danceStyles: ['Timba', 'Son'],       festivalSlug: 'meneate-viena-2026',           festivalName: 'Menéate Viena',        festivalColor: WD.red600, reason: 'You both dance Timba — and she\'s at Menéate Viena too.' },
  { id: 'd2', kind: 'dancer-new-fest',   name: 'Emilia',  city: 'Munich',    photo: 'https://i.pravatar.cc/240?u=emilia',  danceStyles: ['Kizomba', 'Urban Kiz'], festivalSlug: 'timba-fest-london-2026',      festivalName: 'Timba Fest London',    festivalColor: WD.sky500, reason: 'She dances Kizomba in Munich — and heads to a festival you haven\'t explored.' },
  { id: 'e1', kind: 'event-social',      name: 'Salsa on the Isar',  dayLabel: 'Sat', time: '15:00', venue: 'Muffatwerk terrace', city: 'Munich', style: 'Salsa', friendsGoing: 6, color: WD.amber500, reason: 'Salsa in your city, 6 friends going — matches your style.' },
  { id: 'd3', kind: 'dancer-local',      name: 'Klaus',   city: 'Munich',    photo: 'https://i.pravatar.cc/240?u=klaus',   danceStyles: ['Salsa', 'Bachata'],    regularAt: 'La Rumba Fridays', reason: 'You both do Salsa in Munich — he\'s at La Rumba every Friday.' },
  { id: 'd4', kind: 'dancer-new-fest',   name: 'Sasha',   city: 'Vienna',    photo: 'https://i.pravatar.cc/240?u=sasha',   danceStyles: ['Timba', 'Rumba'],     festivalSlug: 'timba-fest-london-2026',      festivalName: 'Timba Fest London',    festivalColor: WD.sky500, reason: 'Timba dancer from Vienna heading to a festival not in your year yet.' },
  { id: 'e2', kind: 'event-festival',    name: 'Salsa Fusion Prague', slug: 'salsa-fusion-prague-2026', dateISO: '2026-11-14', venue: 'La Loca', city: 'Prague',   friendsGoing: 2, color: WD.purple500, reason: 'Salsa festival a short trip away — 2 friends already going.' },
  { id: 'd5', kind: 'dancer-your-fest',  name: 'Silvio',  city: 'Havana',    photo: 'https://i.pravatar.cc/240?u=silvio',  danceStyles: ['Son', 'Timba'],       festivalSlug: 'bachata-stars-barcelona-2026', festivalName: 'Bachata Stars Barcelona', festivalColor: WD.violet600, reason: 'Son & Timba dancer from Havana — also going to Bachata Stars Barcelona.' },
  { id: 'd6', kind: 'dancer-local',      name: 'Barbara', city: 'Munich',    photo: 'https://i.pravatar.cc/240?u=barbara', danceStyles: ['Rumba', 'Son'],       regularAt: 'Cuban Sunday practica', reason: 'Rumba and Son right in Munich — you might click at the practica.' },
  { id: 'd7', kind: 'dancer-new-fest',   name: 'Egor',    city: 'Munich',    photo: 'https://i.pravatar.cc/240?u=egor',    danceStyles: ['Timba', 'Casino'],    festivalSlug: 'timba-fest-london-2026',      festivalName: 'Timba Fest London',    festivalColor: WD.sky500, reason: 'Local Timba dancer — a third person heading to Timba Fest London.' },
  { id: 'e3', kind: 'event-social',      name: 'Havana Nights',      dayLabel: 'Fri', time: '22:30', venue: '537 Bar',          city: 'Munich', style: 'Cuban', friendsGoing: 8, color: WD.red600, reason: 'Cuban night in Munich with 8 friends — right up your alley.' },
]

// Live deck state
const deck = ref<DeckCard[]>(isPreviewInitial ? [...previewDeck] : [])
// History stack for Undo
const swipeHistory = ref<Array<{ card: DeckCard; direction: 'yes' | 'skip' | 'later'; nudgeAdded?: string; addedFestival?: boolean; addedEvent?: boolean }>>([])
// Yes-swipes on dancers heading to a festival → accumulator. Real mode loads
// these from the server (built from stored Yes swipes), so they survive a reload.
type FestivalNudge = { festivalSlug: string; festivalName: string; festivalColor: string; dancerNames: string[]; dismissed: boolean }
const festivalNudges = ref<FestivalNudge[]>(isPreviewInitial
  ? [
      // Preview: prime the "add Timba Fest London" nudge so the loop is visible.
      { festivalSlug: 'timba-fest-london-2026', festivalName: 'Timba Fest London', festivalColor: WD.sky500, dancerNames: ['Emilia', 'Sasha'], dismissed: false },
    ]
  : [])

/** Load the discover deck from the backend for signed-in users. */
async function loadDiscoverDeck() {
  if (previewMode.value || !isSignedIn.value) return
  try {
    const result = await $trpc.plan.discover.query()

    festivalNudges.value = result.nudges.map(n => ({ ...n, dismissed: false }))

    const myCity = dancerCity.value ?? ''
    const myStyles = dancerStyles.value ?? []
    const sharedWith = (styles: string[]) => styles.filter(s => myStyles.some(m => relatedDanceStyles(s, m)))

    const mapped: DeckCard[] = []
    for (const c of result.cards) {
      const id = `${c.targetKind}:${c.targetId}`
      if (c.targetKind === 'dancer') {
        const target: DeckTarget = { kind: 'dancer', id: c.targetId, festivalSlug: c.festivalSlug }
        const shared = sharedWith(c.dancerStyles)
        if (c.kind === 'dancer-local') {
          mapped.push({
            id, target, kind: 'dancer-local',
            name: c.dancerName, photo: c.dancerPhoto, city: c.dancerCity, danceStyles: c.dancerStyles,
            // The chip already says where they dance; only add what you share.
            reason: shared.length
              ? `You both dance ${shared.join(' & ')}${c.dancerCity && c.dancerCity.toLowerCase() === myCity.toLowerCase() ? ` in ${c.dancerCity}` : ''}.`
              : '',
          })
        } else if (c.kind === 'dancer-new-fest') {
          mapped.push({
            id, target, kind: 'dancer-new-fest',
            name: c.dancerName, photo: c.dancerPhoto, city: c.dancerCity, danceStyles: c.dancerStyles,
            festivalSlug: c.festivalSlug ?? '', festivalName: c.festivalName ?? '', festivalColor: c.festivalColor ?? WD.sky500,
            reason: shared.length
              ? `${shared.join(' & ')} dancer heading to ${c.festivalName} — a festival not in your year yet.`
              : `Heading to ${c.festivalName} — a festival you haven't explored.`,
          })
        } else {
          mapped.push({
            id, target, kind: 'dancer-your-fest',
            name: c.dancerName, photo: c.dancerPhoto, city: c.dancerCity, danceStyles: c.dancerStyles,
            festivalSlug: c.festivalSlug ?? '', festivalName: c.festivalName ?? '', festivalColor: c.festivalColor ?? WD.violet600,
            reason: `Also going to ${c.festivalName} — you'll be at the same festival.`,
          })
        }
      } else if (c.kind === 'event-festival') {
        mapped.push({
          id, target: { kind: 'festival', id: c.targetId }, kind: 'event-festival',
          name: c.eventName, slug: c.eventSlug, dateISO: eventLocalDate(c.eventDateISO, c.eventTimezone || undefined),
          venue: c.eventVenue, city: c.eventCity, friendsGoing: c.friendsGoing, color: c.color,
          reason: `Festival in ${c.eventCity} — not in your year yet.`,
        })
      } else {
        const tz = c.eventTimezone || undefined
        mapped.push({
          id, target: { kind: 'event', id: c.targetId }, kind: 'event-social',
          name: c.eventName,
          dayLabel: WEEKDAY_SHORT_ENROLL[eventLocalWeekday(c.eventDateISO, tz)] || '',
          dateISO: eventLocalDate(c.eventDateISO, tz),
          time: eventLocalTime(c.eventDateISO, tz),
          venue: c.eventVenue, city: c.eventCity, style: c.eventStyle, friendsGoing: c.friendsGoing, color: c.color,
          reason: c.eventStyle && sharedWith([c.eventStyle]).length
            ? `${c.eventStyle} in ${c.eventCity} — matches your style.`
            : `${c.eventStyle || 'Dance'} event in ${c.eventCity}.`,
        })
      }
    }
    deck.value = mapped
  } catch (err) {
    console.error('[discover] loadDiscoverDeck failed:', err)
  }
}

const activeFestivalNudges = computed(() =>
  festivalNudges.value.filter(n => !n.dismissed && !effectivePickIds.value.has(n.festivalSlug) && n.dancerNames.length >= 2)
)

const deckCurrent = computed(() => deck.value[0] ?? null)
const deckNext    = computed(() => deck.value[1] ?? null)
const deckAfter   = computed(() => deck.value[2] ?? null)
const canUndo     = computed(() => swipeHistory.value.length > 0)

// Pointer-gesture state for the top card
const dragDx = ref(0)
const dragActive = ref(false)
const dragStartX = ref(0)
const dragPointerId = ref<number | null>(null)
const cardExitDir = ref<'yes' | 'skip' | 'later' | null>(null)

const SWIPE_THRESHOLD = 110

function currentCardTransform(): string {
  if (cardExitDir.value === 'yes')  return 'translateX(120vw) rotate(18deg)'
  if (cardExitDir.value === 'skip') return 'translateX(-120vw) rotate(-18deg)'
  if (cardExitDir.value === 'later') return 'translateY(120vh) scale(0.9)'
  const dx = dragDx.value
  const rot = dx * 0.06
  return `translateX(${dx}px) rotate(${rot}deg)`
}

function onCardPointerDown(e: PointerEvent) {
  if (cardExitDir.value) return
  dragPointerId.value = e.pointerId
  dragStartX.value = e.clientX
  dragActive.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
}

function onCardPointerMove(e: PointerEvent) {
  if (!dragActive.value || e.pointerId !== dragPointerId.value) return
  dragDx.value = e.clientX - dragStartX.value
}

function onCardPointerUp(e: PointerEvent) {
  if (e.pointerId !== dragPointerId.value) return
  dragActive.value = false
  dragPointerId.value = null
  if (dragDx.value > SWIPE_THRESHOLD)       commitSwipe('yes')
  else if (dragDx.value < -SWIPE_THRESHOLD) commitSwipe('skip')
  else                                      dragDx.value = 0
}

/** Store a decision server-side (real mode only). Failures are logged, not fatal. */
function persistSwipe(card: DeckCard, decision: 'yes' | 'skip') {
  if (previewMode.value || !card.target) return
  $trpc.plan.discoverSwipe
    .mutate({ targetKind: card.target.kind, targetId: card.target.id, decision, festivalSlug: card.target.festivalSlug })
    .catch(err => console.warn('[discover] swipe not saved:', err))
}

/**
 * Yes / Skip are stored, so the card never comes back. "Later" only moves the
 * card to the back of the deck for this visit — nothing is stored.
 */
function commitSwipe(direction: 'yes' | 'skip' | 'later') {
  const card = deckCurrent.value
  if (!card || cardExitDir.value) return
  cardExitDir.value = direction

  let nudgeAdded: string | undefined
  let addedFestival = false
  let addedEvent = false
  if (direction === 'yes') {
    if (card.kind === 'dancer-new-fest') {
      nudgeAdded = card.festivalSlug
      addNudge(card)
    }
    if (card.kind === 'event-festival' && !effectivePickIds.value.has(card.slug)) {
      // Add straight to the year picks
      if (!previewMode.value) addFestival(card.slug)
      addedFestival = true
    }
    if (card.kind === 'event-social') {
      addedEvent = true
      if (previewMode.value) {
        socials.value = [...socials.value, {
          id: card.id, planItemId: card.id, name: card.name, dayLabel: card.dayLabel, dateISO: card.dateISO ?? '', time: card.time,
          venue: card.venue, city: card.city, style: card.style, friendsGoing: card.friendsGoing, color: card.color,
        }]
      }
      if (!previewMode.value && card.target) {
        $trpc.plan.add
          .mutate({ itemType: 'event', itemId: card.target.id, metadata: { type: 'social', name: card.name, style: card.style, venue: card.venue, date: card.dateISO ?? '', time: card.time } })
          // Shows up under "Where you're dancing" if it's within the week.
          .then(() => loadWeekSocials())
          .catch(err => console.warn('[discover] add to plan failed:', err))
      }
    }
  }
  if (direction === 'yes' || direction === 'skip') persistSwipe(card, direction)

  // Animate out then advance
  setTimeout(() => {
    swipeHistory.value = [...swipeHistory.value, { card, direction, nudgeAdded, addedFestival, addedEvent }]
    deck.value = direction === 'later' ? [...deck.value.slice(1), card] : deck.value.slice(1)
    dragDx.value = 0
    cardExitDir.value = null
  }, 260)
}

function addNudge(card: Extract<DeckCard, { kind: 'dancer-new-fest' }>) {
  const existing = festivalNudges.value.find(n => n.festivalSlug === card.festivalSlug)
  if (existing) {
    if (!existing.dancerNames.includes(card.name)) {
      existing.dancerNames = [...existing.dancerNames, card.name]
    }
    existing.dismissed = false
  } else {
    festivalNudges.value = [
      ...festivalNudges.value,
      { festivalSlug: card.festivalSlug, festivalName: card.festivalName, festivalColor: card.festivalColor, dancerNames: [card.name], dismissed: false },
    ]
  }
}

function undoSwipe() {
  const last = swipeHistory.value[swipeHistory.value.length - 1]
  if (!last) return
  swipeHistory.value = swipeHistory.value.slice(0, -1)
  const card = last.card
  deck.value = [card, ...(last.direction === 'later' ? deck.value.filter(c => c.id !== card.id) : deck.value)]
  if (last.direction === 'later') return

  if (!previewMode.value && card.target) {
    $trpc.plan.discoverUnswipe
      .mutate({ targetKind: card.target.kind, targetId: card.target.id })
      .catch(err => console.warn('[discover] undo not saved:', err))
  }
  if (last.direction !== 'yes') return
  if (last.nudgeAdded) {
    const n = festivalNudges.value.find(x => x.festivalSlug === last.nudgeAdded)
    if (n && 'name' in card) n.dancerNames = n.dancerNames.filter(name => name !== card.name)
  }
  if (last.addedFestival && card.kind === 'event-festival' && !previewMode.value) {
    removeFestival(card.slug)
  }
  if (last.addedEvent && card.kind === 'event-social') {
    const eventId = card.target?.id ?? card.id
    socials.value = socials.value.filter(s => s.planItemId !== eventId)
    if (!previewMode.value && card.target) {
      $trpc.plan.remove
        .mutate({ itemType: 'event', itemId: card.target.id })
        .catch(err => console.warn('[discover] undo add failed:', err))
    }
  }
}

function acceptFestivalNudge(n: FestivalNudge) {
  if (!previewMode.value) addFestival(n.festivalSlug)
  n.dismissed = true
  festivalNudges.value = [...festivalNudges.value]
}

/** "Not this year" — stored as a Skip on the festival, so the nudge and its cards stay gone. */
function dismissFestivalNudge(n: FestivalNudge) {
  n.dismissed = true
  festivalNudges.value = [...festivalNudges.value]
  if (!previewMode.value) {
    $trpc.plan.discoverSwipe
      .mutate({ targetKind: 'festival', targetId: n.festivalSlug, decision: 'skip' })
      .catch(err => console.warn('[discover] dismiss not saved:', err))
  }
}

// -----------------------------------------------------------------------
// GOAL · progress ring color
// -----------------------------------------------------------------------
function goalProgressColor(p: number) {
  if (p >= 75) return WD.green600
  if (p >= 40) return WD.cyan600
  if (p >= 15) return WD.amber500
  return WD.red600
}

// Collapsed-view summary: how much of the plan is done, and what's the
// single most-urgent open track (the row that pulls the eye).
function cardSummary(f: CatalogueEntry) {
  const list = tracks(f)
  const toggleable = list.filter(t => t.toggleKey)
  const doneCount = toggleable.filter(t => t.done).length
  const totalCount = toggleable.length
  // Priority: urgent > todo-with-action > any-open-with-action.
  const headline
    = list.find(t => t.state.tone === 'urgent' && !t.done)
    ?? list.find(t => t.state.tone === 'todo' && !t.done && t.action)
    ?? list.find(t => !t.done && t.action)
    ?? null
  const allDone = doneCount === totalCount
  return { doneCount, totalCount, headline, allDone }
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <!-- V3 header -->
    <SiteHeader />

    <main>

    <!-- HERO -->
    <section class="max-w-4xl mx-auto px-4 pt-12 pb-6 text-center">
      <div class="text-sm tracking-widest uppercase mb-3 text-secondary">
        <template v-if="isSignedIn">Hey, {{ dancerName || 'dancer' }}</template>
        <template v-else>Your plan</template>
      </div>
      <h1 class="text-5xl sm:text-6xl leading-[0.98] text-foreground">
        <template v-if="isSignedIn && dancerCity">
          Your floor in <em class="italic text-primary">{{ dancerCity }}</em>
        </template>
        <template v-else>
          What's <em class="italic text-primary">next?</em>
        </template>
      </h1>
      <p class="mt-5 text-base sm:text-lg leading-relaxed max-w-xl mx-auto text-muted-foreground font-sans">
        <template v-if="isSignedIn && stylesLabel">
          {{ stylesLabel }} — every festival, course and social you care about, in one place.
        </template>
        <template v-else>
          Every festival you picked, in one place — with the one thing to do this week.
        </template>
      </p>
    </section>

    <!-- ONBOARDING GUARD — signed in but not onboarded. Gentle, not a trap. -->
    <section v-if="needsOnboarding" class="max-w-4xl mx-auto px-4">
      <div
        class="rounded-2xl px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
        style="background:white; border:1px solid color-mix(in srgb, var(--wd-red-600) 33.3%, transparent); box-shadow: 0 1px 0 color-mix(in srgb, var(--wd-red-600) 13.3%, transparent), 0 8px 22px rgba(59,31,18,0.05);"
      >
        <div>
          <div class="text-eyebrow uppercase tracking-[0.3em] font-bold mb-1 text-primary">Finish setup</div>
          <p class="text-sm text-muted-foreground font-sans">
            Tell us what you're into and we'll fill your plan with the right festivals, classes and socials.
          </p>
        </div>
        <NuxtLink
          to="/onboarding"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-bold uppercase tracking-wider shrink-0 bg-wd-red-600 font-sans"
          style="box-shadow: 0 3px 0 -1px var(--wd-red-800);"
        >
          Set up my plan <ArrowRight class="w-4 h-4" />
        </NuxtLink>
      </div>
    </section>

    <!-- FIRST-RUN HINT — right after a fresh signup + onboarding this session. -->
    <section v-else-if="showFirstRunHint" class="max-w-4xl mx-auto px-4">
      <div
        class="rounded-2xl px-5 py-4 flex items-center gap-3"
        style="background:linear-gradient(135deg, var(--wd-amber-100) 0%, var(--wd-red-100) 100%); border:1px solid color-mix(in srgb, var(--wd-red-600) 20%, transparent);"
      >
        <Sparkles class="w-5 h-5 shrink-0 text-primary" />
        <p class="text-sm text-muted-foreground font-sans">
          <span class="font-bold text-foreground">This is your home.</span>
          Come back weekly — your festivals, classes and socials live here.
        </p>
      </div>
    </section>

    <!-- SIGNED OUT — what the dashboard holds + sign in / join -->
    <section v-if="!isSignedIn" class="max-w-3xl mx-auto px-4 py-10" data-testid="my-plan-signed-out">
      <div class="rounded-2xl p-6 sm:p-8 bg-white border" style="border-color:color-mix(in srgb, var(--wd-red-600) 33.3%, transparent); box-shadow: 0 1px 0 color-mix(in srgb, var(--wd-red-600) 13.3%, transparent), 0 12px 28px rgba(59, 31, 18, 0.06);">
        <div class="text-center">
          <div class="text-eyebrow uppercase tracking-[0.3em] font-bold mb-3 text-primary">Your dashboard</div>
          <h2 class="text-2xl sm:text-3xl leading-tight font-display text-foreground">
            Your picks, your partners, your tickets — <em class="italic text-primary">one dashboard.</em>
          </h2>
        </div>

        <!-- What it holds -->
        <ul class="mt-6 grid gap-3 sm:grid-cols-3">
          <li
            v-for="p in DASHBOARD_PILLARS"
            :key="p.key"
            class="rounded-xl p-4 border bg-background"
            style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);"
            :data-testid="`my-plan-pillar-${p.key}`"
          >
            <component :is="p.icon" class="w-5 h-5 mb-2 text-primary" aria-hidden="true" />
            <div class="font-bold text-foreground">{{ p.title }}</div>
            <p class="mt-1 text-sm leading-snug text-muted-foreground font-sans">{{ p.body }}</p>
          </li>
        </ul>

        <!-- The promise: one next step at a time -->
        <div
          class="mt-4 rounded-xl px-4 py-3 flex items-start gap-3"
          style="background:linear-gradient(135deg, var(--wd-amber-100) 0%, var(--wd-red-100) 100%); border:1px solid color-mix(in srgb, var(--wd-red-600) 20%, transparent);"
          data-testid="my-plan-next-step-promise"
        >
          <Target class="w-5 h-5 mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <div class="font-bold text-foreground">One clear next step at a time.</div>
            <p class="mt-0.5 text-sm text-muted-foreground font-sans">
              No juggling tabs and chats — we surface the one thing to do next, like
              <span class="italic">“Grab your pass before the early-bird ends”</span> or
              <span class="italic">“Find a partner for Saturday's workshops”</span>.
            </p>
          </div>
        </div>

        <!-- Sign in / join -->
        <div class="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3 font-sans">
          <Button variant="cta" size="lg" class="px-6" @click="openAuth('dashboard')">
            Join &amp; build my dashboard <ArrowRight aria-hidden="true" />
          </Button>
          <Button variant="outline-pill" size="lg" class="px-6" @click="openAuth('signin')">
            Sign in
          </Button>
        </div>
        <p class="mt-4 text-center text-sm text-muted-foreground font-sans">
          Just looking? <NuxtLink to="/festivals" class="italic underline text-secondary">Browse festivals</NuxtLink>
        </p>
      </div>
      <SignUpModal v-model:open="showAuth" :action="authAction" />
    </section>

    <!-- SIGNED IN, EMPTY -->
    <section v-else-if="picked.length === 0 && courses.length === 0 && socials.length === 0" class="max-w-2xl mx-auto px-4 py-10">
      <div class="rounded-2xl p-10 text-center border-2 border-dashed border-input bg-white/50">
        <Search class="w-10 h-10 mx-auto mb-4 text-secondary" aria-hidden="true" />
        <p class="text-lg font-display text-foreground">
          You haven't picked anything yet.
        </p>
        <p class="mt-2 text-sm text-muted-foreground font-sans">
          Start by picking one festival — the rest of the year plans itself.
        </p>
        <Button as-child variant="cta" size="lg" class="mt-6 px-6">
          <NuxtLink to="/festivals">
            Browse festivals <ArrowRight aria-hidden="true" />
          </NuxtLink>
        </Button>
      </div>
    </section>

    <!-- SIGNED IN, WITH PICKS -->
    <section v-else class="max-w-4xl mx-auto px-4 py-6 pb-16">
      <!-- HEAT STRIP · the top 3 items across every scale, sorted by urgency. -->
      <div v-if="heatItems.length" class="rounded-2xl mb-8 p-5 sm:p-6 relative overflow-hidden" style="background:linear-gradient(135deg, var(--wd-amber-100) 0%, var(--wd-red-100) 100%); border:1px solid color-mix(in srgb, var(--wd-red-600) 20%, transparent);">
        <div class="flex items-baseline justify-between mb-3">
          <div class="text-xs uppercase tracking-[0.3em] font-bold text-primary">This week · do these first</div>
          <span class="text-xs text-secondary font-hand" style="font-size:18px;">
            — 3 things across your plan
          </span>
        </div>
        <div class="grid gap-2">
          <a
            v-for="item in heatItems"
            :key="item.key"
            :href="item.href"
            :target="item.external ? '_blank' : undefined"
            :rel="item.external ? 'noopener noreferrer' : undefined"
            class="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/80 hover:bg-white transition-all border"
            :style="{ borderColor: item.color + '55' }"
          >
            <span class="w-2 h-2 rounded-full shrink-0 animate-pulse" :style="{ background: item.color }" />
            <span class="font-bold text-sm text-foreground font-display">{{ item.label }}</span>
            <span class="text-xs italic hidden sm:inline text-muted-foreground font-sans">
              — {{ item.detail }}
            </span>
            <span class="ml-auto text-xs font-bold" :style="{ color: item.color }">
              <template v-if="item.external">Open ↗</template>
              <template v-else>Go →</template>
            </span>
          </a>
        </div>
      </div>

      <!-- GOALS · long arcs above the horizon. -->
      <div class="mb-10">
        <div class="flex items-baseline justify-between mb-4">
          <div>
            <div class="text-xs uppercase tracking-[0.3em] text-secondary">Goals · your compass</div>
            <h2 class="mt-2 text-2xl leading-tight font-display text-foreground">
              Where you're <em class="italic text-primary">headed.</em>
            </h2>
          </div>
          <Button
            v-if="!showGoalForm"
            variant="link"
            class="h-auto p-0 text-xs font-normal italic text-secondary font-display"
            @click="showGoalForm = true"
          >
            + Add a goal
          </Button>
        </div>

        <!-- Inline add-goal form -->
        <div v-if="showGoalForm" class="rounded-2xl bg-white p-6 border mb-4" style="border-color:color-mix(in srgb, var(--wd-amber-600) 33.3%, transparent); box-shadow: 0 4px 16px rgba(59,31,18,0.06);">
          <div class="text-sm font-bold mb-4 text-foreground font-display">
            What are you working toward this year?
          </div>
          <form class="space-y-4" novalidate @submit.prevent="onGoalSubmit">
            <Field id="goal-title" label="Your goal" :error="goalFormError || undefined">
              <Input v-model="goalFormTitle" placeholder="e.g. Learn Bachata Sensual" />
            </Field>
            <Field id="goal-why" label="Why does it matter?" optional>
              <Input v-model="goalFormWhy" placeholder="e.g. Feel confident on the dance floor" />
            </Field>
            <Field id="goal-style" label="Dance style" optional hint="Links this goal to your courses & festivals.">
              <DanceStylePicker v-model="goalFormStyles" single label="Dance style" :popular-count="6" />
            </Field>
            <div class="flex items-center gap-3 pt-1">
              <Button type="submit" variant="pill" :disabled="!goalFormTitle.trim() || !!goalFormError">
                Add goal
              </Button>
              <Button type="button" variant="ghost" class="rounded-full font-bold uppercase tracking-wider text-muted-foreground" @click="onGoalCancel">
                Cancel
              </Button>
            </div>
          </form>
        </div>

        <div v-if="!goalsList.length && !showGoalForm" class="rounded-2xl p-6 text-center border-2 border-dashed border-input bg-white/50">
          <Target class="w-8 h-8 mx-auto mb-3 text-secondary" aria-hidden="true" />
          <p class="text-sm text-muted-foreground font-sans">
            No goals yet. One year, one arc, one reason to keep showing up.
          </p>
          <Button variant="link" class="mt-2 h-auto p-0 text-xs font-bold underline text-primary font-sans" @click="showGoalForm = true">
            Set a goal
          </Button>
        </div>
        <div v-else-if="goalsList.length" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="g in goalsList"
            :key="g.id"
            class="rounded-2xl bg-white p-5 border group"
            :style="{ borderColor: g.color + '55', boxShadow: '0 1px 0 ' + g.color + '22, 0 8px 22px rgba(59,31,18,0.05)' }"
          >
            <div class="flex items-start gap-3 mb-3">
              <component :is="g.icon" class="w-5 h-5 shrink-0" :style="{ color: g.color, 'stroke-width': 1.5 }" />
              <div class="flex-1 min-w-0">
                <div class="text-base font-bold leading-tight text-foreground">
                  {{ g.title }}
                </div>
                <div class="mt-1 text-xs italic text-muted-foreground font-display">
                  {{ g.why }}
                </div>
                <span
                  v-if="goalEffectiveStyle(g)"
                  class="inline-block mt-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                  style="background:color-mix(in srgb, var(--wd-amber-600) 12%, transparent); color:var(--wd-amber-600);"
                >
                  {{ goalEffectiveStyle(g) }}
                </span>
              </div>
              <Button
                v-if="!previewMode"
                variant="ghost"
                size="icon-sm"
                class="size-7 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity shrink-0 rounded hover:bg-wd-red-50 text-primary hover:text-primary [&_svg]:size-3.5"
                :aria-label="`Remove goal: ${g.title}`"
                @click="removeGoal(g.id)"
              >
                <X aria-hidden="true" />
              </Button>
            </div>
            <!-- Progress bar — editable in real mode -->
            <div class="mt-4">
              <div class="flex items-baseline justify-between mb-1">
                <span class="text-eyebrow uppercase tracking-widest font-bold text-secondary">Progress</span>
                <button
                  v-if="!previewMode"
                  type="button"
                  class="text-xs font-black cursor-pointer hover:underline"
                  :style="{ color: goalProgressColor(g.progress), fontFamily: 'var(--wd-font-display)' }"
                  :aria-label="`Edit progress, currently ${g.progress}%`"
                  @click="startEditingProgress(g.id)"
                >
                  {{ g.progress }}%
                </button>
                <span v-else class="text-xs font-black" :style="{ color: goalProgressColor(g.progress), fontFamily: 'var(--wd-font-display)' }">{{ g.progress }}%</span>
              </div>
              <input
                v-if="editingProgressGoalId === g.id"
                type="range"
                min="0"
                max="100"
                :value="g.progress"
                class="w-full h-2 rounded-full appearance-none cursor-pointer"
                style="accent-color:var(--wd-amber-600);"
                @input="onProgressChange(g.id, Number(($event.target as HTMLInputElement).value))"
                @change="stopEditingProgress()"
              />
              <div v-else class="w-full h-2 rounded-full overflow-hidden" style="background:color-mix(in srgb, var(--wd-brown-900) 6.3%, transparent);">
                <div class="h-full transition-all" :style="{ width: g.progress + '%', background: goalProgressColor(g.progress) }" />
              </div>
            </div>
            <div v-if="g.nudge" class="mt-3 text-sm font-hand text-secondary" style="font-size:17px;">
              — {{ g.nudge }}
            </div>
          </div>
        </div>
      </div>

      <!-- YEAR · festivals section header -->
      <div class="mb-4">
        <div class="text-xs uppercase tracking-[0.3em] text-secondary">This year · festivals</div>
        <h2 class="mt-2 text-2xl leading-tight font-display text-foreground">
          Where you're <em class="italic text-primary">going.</em>
        </h2>
      </div>

      <!-- Cross-festival summary — the money + urgency crosscut. -->
      <div
        class="rounded-2xl bg-white border p-5 sm:p-6 mb-8"
        style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); box-shadow: 0 1px 0 color-mix(in srgb, var(--wd-brown-900) 3.9%, transparent), 0 6px 18px rgba(59,31,18,0.04);"
      >
        <div class="flex flex-wrap items-baseline gap-x-8 gap-y-3">
          <div>
            <div class="text-4xl font-black leading-none font-display text-foreground">
              {{ summary.count }}
            </div>
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold mt-1 text-secondary">
              Festivals this year
            </div>
          </div>
          <div v-if="summary.committed > 0">
            <div class="text-4xl font-black leading-none font-display text-wd-green-600">
              €{{ summary.committed }}
            </div>
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold mt-1 text-wd-green-600">
              Committed
            </div>
          </div>
          <div v-if="summary.pending > 0">
            <div class="text-4xl font-black leading-none font-display text-muted-foreground">
              €{{ summary.pending }}
            </div>
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold mt-1 text-muted-foreground">
              Still owed
            </div>
          </div>
          <div
            v-if="summary.urgentDeadlines > 0"
            class="ml-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-bold text-primary font-sans"
            style="background:color-mix(in srgb, var(--wd-red-600) 9.4%, transparent);"
          >
            <span class="w-2 h-2 rounded-full animate-pulse bg-wd-red-600" />
            {{ summary.urgentDeadlines }} early-bird deadline{{ summary.urgentDeadlines === 1 ? '' : 's' }} this week
          </div>
        </div>
      </div>

      <!-- Year-at-a-glance strip: 12 months, picks fall on their month.
           Elegant substitute for the retired YearCanvas sidebar — no
           side rail, no drawer, just one horizontal scan of the year. -->
      <div class="mb-10">
        <div class="flex items-baseline justify-between mb-3">
          <div class="text-xs uppercase tracking-[0.3em] text-secondary">Your year at a glance</div>
          <span class="text-xs text-secondary font-hand" style="font-size:18px;">
            — click a chip to jump
          </span>
        </div>
        <div class="rounded-2xl bg-white p-4 sm:p-5 border overflow-x-auto" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); box-shadow: 0 1px 0 color-mix(in srgb, var(--wd-brown-900) 3.9%, transparent), 0 6px 18px rgba(59,31,18,0.04);">
          <div class="grid grid-cols-12 gap-1 sm:gap-2 min-w-[560px]">
            <div
              v-for="(m, i) in monthsGrid"
              :key="m.label"
              class="flex flex-col items-center"
            >
              <div
                class="text-eyebrow uppercase tracking-widest font-bold mb-2"
                :style="{ color: m.entries.length ? WD.brown900 : WD.amber600, opacity: m.entries.length ? 1 : 0.5 }"
              >{{ m.label }}</div>
              <!-- Vertical rule for the month -->
              <div class="w-px h-8 sm:h-10" :style="{ background: m.entries.length ? (WD.brown900 + '33') : (WD.brown900 + '18') }" />
              <div class="mt-2 flex flex-col gap-1 items-center w-full">
                <a
                  v-for="e in m.entries"
                  :key="e.slug"
                  :href="`#f-${e.slug}`"
                  class="w-full max-w-[64px] px-1.5 py-1 rounded-md text-white text-tag font-bold uppercase tracking-wider truncate text-center hover:scale-[1.03] transition-transform"
                  :style="{ background: e.accentColor }"
                  :title="`${e.name} · ${e.dayRange}`"
                >{{ e.short }}</a>
                <div
                  v-if="!m.entries.length && i !== todayMonth"
                  class="w-1.5 h-1.5 rounded-full opacity-25 bg-wd-brown-900"
                />
                <div
                  v-if="i === todayMonth && !m.entries.length"
                  class="text-[8px] font-bold uppercase tracking-widest mt-1 text-primary font-hand"
                  style="font-size:13px; text-transform:none; letter-spacing:normal;"
                >you're here</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Nudges from Discover swipes — "3 friends heading to X, add it?" -->
      <div v-if="activeFestivalNudges.length" class="mb-4 grid gap-2">
        <div
          v-for="n in activeFestivalNudges"
          :key="n.festivalSlug"
          class="rounded-2xl p-4 flex flex-wrap items-center gap-3 bg-white border"
          :style="{ borderColor: n.festivalColor + '55', boxShadow: '0 1px 0 ' + n.festivalColor + '22, 0 6px 18px rgba(59,31,18,0.04)' }"
        >
          <span
            class="inline-flex items-center gap-1.5 text-eyebrow font-black uppercase tracking-widest px-2.5 py-1 rounded-full"
            :style="{ background: n.festivalColor + '18', color: n.festivalColor }"
          >
            <UsersIcon class="w-3 h-3" /> {{ n.dancerNames.length }} match{{ n.dancerNames.length === 1 ? '' : 'es' }}
          </span>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-bold text-foreground">
              {{ n.dancerNames.slice(0, 3).join(', ') }}<span v-if="n.dancerNames.length > 3"> and {{ n.dancerNames.length - 3 }} more</span> heading to
              <span :style="{ color: n.festivalColor }">{{ n.festivalName }}</span>.
            </div>
            <div class="text-xs italic text-muted-foreground font-display">
              Not in your year yet — add it and you'll meet them there.
            </div>
          </div>
          <Button variant="pill" size="pill-sm" :accent="n.festivalColor" class="tracking-widest" @click="acceptFestivalNudge(n)">
            Add to year
          </Button>
          <Button variant="link" class="h-auto p-0 text-xs font-normal italic shrink-0 text-secondary" @click="dismissFestivalNudge(n)">
            Not this year
          </Button>
        </div>
      </div>

      <div class="flex items-baseline justify-between mb-4">
        <div class="text-xs uppercase tracking-[0.3em] text-secondary">Going</div>
        <span class="text-xs text-secondary font-hand" style="font-size:18px;">
          — {{ picked.length }} in your year
        </span>
      </div>

      <div class="grid gap-4">
        <div
          v-for="f in picked"
          :id="`f-${f.slug}`"
          :key="f.slug"
          class="rounded-2xl overflow-hidden bg-white border transition-all scroll-mt-20"
          :style="{ borderColor: f.accentColor + '55', boxShadow: '0 1px 0 ' + f.accentColor + '22, 0 8px 22px rgba(59,31,18,0.05)' }"
        >
          <div class="h-1.5" :style="{ background: f.accentColor }" />

          <!-- CARD HEADER — always visible; click anywhere to toggle. -->
          <button
            type="button"
            class="w-full text-left flex items-start gap-4 p-4 sm:p-5 transition-colors hover:bg-black/[0.015]"
            :aria-expanded="expandedSlugs.has(f.slug)"
            @click="toggleExpanded(f.slug)"
          >
            <!-- Logo -->
            <div class="shrink-0">
              <img
                v-if="f.logo"
                :src="f.logo"
                :alt="f.name"
                class="w-12 h-12 rounded-full shadow-sm"
              >
              <div
                v-else
                class="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white shadow-sm"
                :style="{ background: f.accentColor }"
              >
                {{ f.name.charAt(0) }}
              </div>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between gap-3">
                <h3 class="font-bold text-lg leading-tight truncate text-foreground">
                  {{ f.name }}
                </h3>
                <span
                  class="text-xs shrink-0 mt-1 whitespace-nowrap"
                  :style="{
                    color: daysUntilLabel(f.startDate).urgent ? WD.red600 : f.accentColor,
                    fontFamily: 'var(--wd-font-hand)',
                    fontSize: '16px',
                  }"
                >
                  — {{ daysUntilLabel(f.startDate).text }}
                </span>
              </div>

              <div class="flex items-center flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground font-sans">
                <span class="inline-flex items-center gap-1">
                  <Calendar class="w-3 h-3 text-secondary" />
                  {{ formatDateRange(f.startDate, f.endDate) }}
                </span>
                <span class="inline-flex items-center gap-1">
                  <MapPin class="w-3 h-3 text-secondary" />
                  {{ f.venue }}, {{ f.location }}
                </span>
                <span
                  v-if="f.styles?.some((s: string) => goalsForStyle(s).length)"
                  class="inline-flex items-center gap-1 text-[10px] italic"
                  style="color:var(--wd-green-600); font-family:var(--wd-font-display);"
                >
                  <Target class="w-3 h-3" />
                  Serves: {{ f.styles.filter((s: string) => goalsForStyle(s).length).flatMap((s: string) => goalsForStyle(s)).filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).join(', ') }}
                </span>
              </div>

              <!-- Collapsed summary: progress pips + headline chip.
                   Only rendered when the card is collapsed. -->
              <div
                v-if="!expandedSlugs.has(f.slug)"
                class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2"
              >
                <!-- 5-pip progress bar (one pip per toggleable track) -->
                <div class="inline-flex items-center gap-1.5">
                  <span
                    v-for="i in cardSummary(f).totalCount"
                    :key="i"
                    class="w-2 h-2 rounded-full"
                    :style="{ background: i <= cardSummary(f).doneCount ? WD.green600 : (WD.brown900 + '22') }"
                  />
                  <span class="ml-1 text-meta font-bold text-muted-foreground font-sans">
                    {{ cardSummary(f).doneCount }} of {{ cardSummary(f).totalCount }} ready
                  </span>
                </div>

                <!-- Headline chip: the single most-urgent open track -->
                <span
                  v-if="cardSummary(f).allDone"
                  class="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                  :style="toneStyle('done')"
                >
                  <Check class="w-3 h-3" style="stroke-width:2.5;" />
                  <span class="font-sans">All planned</span>
                </span>
                <span
                  v-else-if="cardSummary(f).headline"
                  class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full"
                  :style="toneStyle(cardSummary(f).headline!.state.tone)"
                >
                  <component :is="cardSummary(f).headline!.icon" class="w-3 h-3" style="stroke-width:1.5;" />
                  <span class="font-bold font-sans">
                    {{ cardSummary(f).headline!.label }}:
                  </span>
                  <span class="font-sans">
                    {{ cardSummary(f).headline!.state.text }}
                  </span>
                </span>
              </div>
            </div>

            <!-- Chevron -->
            <ChevronDown
              class="w-5 h-5 shrink-0 mt-1 transition-transform"
              :style="{
                color: 'var(--wd-amber-600)',
                'stroke-width': 1.75,
                transform: expandedSlugs.has(f.slug) ? 'rotate(180deg)' : 'none',
              }"
            />
          </button>

          <!-- EXPANDED PANEL — multi-track detail + footer -->
          <div v-if="expandedSlugs.has(f.slug)" class="px-4 sm:px-5 pb-5">
            <div class="rounded-xl overflow-hidden border" style="border-color:color-mix(in srgb, var(--wd-brown-900) 8.2%, transparent);">
              <div
                v-for="(t, i) in tracks(f)"
                :key="t.key"
                class="flex flex-wrap items-center gap-3 px-3 sm:px-4 py-3"
                :class="i > 0 ? 'border-t' : ''"
                :style="{ borderColor: 'color-mix(in srgb, var(--wd-brown-900) 5.1%, transparent)', background: t.done ? (WD.green600 + '08') : 'white' }"
              >
                <component :is="t.icon" class="w-4 h-4 shrink-0" :style="{ color: t.done ? WD.green600 : WD.amber600, 'stroke-width': 1.5 }" />
                <div class="w-24 shrink-0 text-sm font-bold text-foreground">
                  {{ t.label }}
                </div>
                <span
                  class="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
                  :style="toneStyle(t.state.tone)"
                >
                  <Check v-if="t.done" class="w-3 h-3" style="stroke-width:2.5;" />
                  <span class="font-sans">{{ t.state.text }}</span>
                </span>

                <button
                  v-if="t.action && t.onAction"
                  type="button"
                  class="text-xs font-bold italic hover:underline ml-auto whitespace-nowrap"
                  :style="{ color: f.accentColor }"
                  @click.stop="t.onAction()"
                >
                  {{ t.action.label }} →
                </button>
                <NuxtLink
                  v-else-if="t.action && !t.action.external"
                  :to="t.action.href"
                  class="text-xs font-bold italic hover:underline ml-auto whitespace-nowrap"
                  :style="{ color: f.accentColor }"
                >
                  {{ t.action.label }} →
                </NuxtLink>
                <a
                  v-else-if="t.action && t.action.external"
                  :href="t.action.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs font-bold italic hover:underline ml-auto inline-flex items-center gap-1 whitespace-nowrap"
                  :style="{ color: f.accentColor }"
                >
                  {{ t.action.label }} <ExternalLink class="w-3 h-3" />
                </a>
                <span v-else class="ml-auto" />

                <a
                  v-if="t.altAction && t.altAction.external"
                  :href="t.altAction.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-eyebrow italic hover:underline inline-flex items-center gap-0.5 whitespace-nowrap text-secondary font-display"
                >
                  {{ t.altAction.label }} <ExternalLink class="w-2.5 h-2.5" />
                </a>
                <NuxtLink
                  v-else-if="t.altAction"
                  :to="t.altAction.href"
                  class="text-eyebrow italic hover:underline whitespace-nowrap text-secondary font-display"
                >
                  {{ t.altAction.label }} →
                </NuxtLink>

                <button
                  v-if="t.toggleKey"
                  type="button"
                  class="text-eyebrow font-bold italic hover:underline shrink-0 whitespace-nowrap text-secondary"
                  :aria-pressed="t.done"
                  @click.stop="toggleTrack(f.slug, t.toggleKey)"
                >
                  {{ t.done ? 'Undo' : 'Mark done' }}
                </button>
              </div>
            </div>

            <!-- FIND A RIDE PANEL -->
            <FindRidePanel
              v-if="rideOpenSlugs.has(f.slug)"
              :festival-slug="f.slug"
              :festival-location="f.location"
              :festival-start-date="f.startDate"
              :accent-color="f.accentColor"
              :is-signed-in="isSignedIn && !previewMode"
              class="mt-4"
              @sign-in="openAuth('signin')"
            />

            <!-- WORKSHOP PICKER -->
            <div v-if="getWorkshopsForFestival(f.slug).length > 0" class="mt-6 pt-6 border-t" style="border-color:color-mix(in srgb, var(--wd-brown-900) 5.1%, transparent);">
              <div class="mb-4">
                <h4 class="text-sm font-bold mb-3 text-foreground">
                  Pick workshops ({{ getSelectedWorkshops(f.slug).size }} selected)
                </h4>

                <!-- Group workshops by day -->
                <div
                  v-for="day in ['Friday', 'Saturday', 'Sunday', 'Monday', 'Tuesday']"
                  :key="day"
                  class="mb-4"
                >
                  <div
                    v-if="getWorkshopsForFestival(f.slug).filter(w => w.day === day).length > 0"
                  >
                    <div class="text-xs font-bold uppercase tracking-widest mb-2 text-secondary">
                      {{ day }}
                    </div>
                    <div class="space-y-2">
                      <label
                        v-for="w in getWorkshopsForFestival(f.slug).filter(ws => ws.day === day && ws.type !== 'party')"
                        :key="w.id"
                        class="flex items-start gap-3 p-2.5 rounded-lg hover:bg-black/[0.02] cursor-pointer"
                        @click.stop
                      >
                        <input
                          type="checkbox"
                          :checked="getSelectedWorkshops(f.slug).has(w.id)"
                          class="mt-0.5 size-4 shrink-0 cursor-pointer accent-primary"
                          @change="toggleWorkshop(f.slug, w.id)"
                        >
                        <div class="flex-1 min-w-0">
                          <div class="text-sm font-bold leading-tight text-foreground">
                            {{ w.time }} · {{ w.title }}
                          </div>
                          <div class="text-xs mt-0.5 text-muted-foreground font-sans">
                            <template v-if="w.teacherId">
                              {{ getTeacherName(f.slug, w.teacherId) }}
                            </template>
                            {{ w.level }}
                            <template v-if="w.room">
                              · {{ w.room }}
                            </template>
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Selected workshops summary -->
              <div v-if="getSelectedWorkshops(f.slug).size > 0" class="mt-4 pt-4 border-t" style="border-color:color-mix(in srgb, var(--wd-brown-900) 5.1%, transparent);">
                <div class="text-xs font-bold uppercase tracking-widest mb-3 text-secondary">
                  Your picks
                </div>
                <div class="space-y-2">
                  <div
                    v-for="w in getWorkshopsForFestival(f.slug).filter(ws => getSelectedWorkshops(f.slug).has(ws.id))"
                    :key="w.id"
                    class="flex items-start gap-2 p-2.5 rounded-lg bg-green-50"
                  >
                    <Check class="w-4 h-4 mt-0.5 shrink-0 text-wd-green-600" />
                    <div class="flex-1 min-w-0">
                      <div class="text-sm font-bold leading-tight text-foreground">
                        {{ w.time }} · {{ w.title }}
                      </div>
                      <div class="text-xs text-muted-foreground font-sans">
                        {{ w.day }} · {{ w.level }}
                      </div>
                    </div>
                    <button
                      type="button"
                      class="text-xs font-bold italic hover:underline shrink-0 text-primary"
                      @click.stop="removeSelectedWorkshop(f.slug, w.id)"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div class="mt-4 flex items-center gap-4 text-xs">
              <NuxtLink
                :to="`${festivalPath(f.slug)}`"
                class="italic hover:underline text-muted-foreground font-sans"
              >
                Open festival page →
              </NuxtLink>
              <Button variant="link" class="ml-auto h-auto p-0 text-xs font-normal italic text-secondary font-sans" @click.stop="onRemove(f.slug)">
                Remove
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- MONTH · Courses. -->
      <div id="courses" class="mt-14">
        <div class="flex items-baseline justify-between mb-4">
          <div>
            <div class="text-xs uppercase tracking-[0.3em] text-secondary">This month · courses</div>
            <h2 class="mt-2 text-2xl leading-tight font-display text-foreground">
              Where you <em class="italic text-primary">show up.</em>
            </h2>
          </div>
          <Button
            v-if="!showEnrollPicker && availableClasses.length > 0"
            variant="link"
            class="h-auto p-0 text-xs font-normal italic text-secondary font-display"
            @click="showEnrollPicker = true"
          >
            + Enroll
          </Button>
          <Button
            v-else-if="showEnrollPicker"
            variant="link"
            class="h-auto p-0 text-xs font-normal italic text-muted-foreground font-display"
            @click="showEnrollPicker = false"
          >
            Done
          </Button>
        </div>

        <!-- Enroll picker — available classes from the city -->
        <div v-if="showEnrollPicker" class="rounded-2xl bg-white p-5 border mb-4" style="border-color:color-mix(in srgb, var(--wd-amber-600) 33.3%, transparent); box-shadow: 0 4px 16px rgba(59,31,18,0.06);">
          <div class="text-sm font-bold mb-3 text-foreground font-display">
            Upcoming classes in {{ dancerCity || 'your city' }}
          </div>
          <div v-if="!availableClasses.length" class="text-xs py-2 text-muted-foreground font-sans">
            No upcoming classes found. Check your city page for more.
          </div>
          <div v-else class="space-y-2">
            <button
              v-for="cls in availableClasses"
              :key="cls.id"
              type="button"
              class="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl border hover:bg-amber-50/50 cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style="border-color:color-mix(in srgb, var(--wd-brown-900) 6.7%, transparent);"
              @click="enrollClass(cls)"
            >
              <span class="w-2 h-2 rounded-full shrink-0" :style="{ background: STYLE_COLORS_ENROLL[cls.style] || WD.gray500 }" />
              <span class="block flex-1 min-w-0">
                <span class="block text-sm font-bold text-foreground">{{ cls.name }}</span>
                <span class="block text-xs text-muted-foreground font-sans">
                  {{ cls.date ? formatShortDate(cls.date) : cls.day }}, {{ cls.time }} · {{ cls.venue }} · {{ cls.level || 'All levels' }}
                </span>
              </span>
              <span class="text-xs font-bold italic shrink-0 text-primary">+ Add</span>
            </button>
          </div>
        </div>

        <div v-if="!courses.length && !showEnrollPicker" class="rounded-2xl p-6 text-center border-2 border-dashed border-input bg-white/50">
          <GraduationCap class="w-8 h-8 mx-auto mb-3 text-secondary" />
          <p class="text-sm mb-3 text-muted-foreground font-sans">
            No monthly cadence yet. A weekly class is the quickest way to keep momentum.
          </p>
          <Button v-if="availableClasses.length > 0" variant="pill" class="px-5" @click="showEnrollPicker = true">
            Browse classes <ArrowRight aria-hidden="true" />
          </Button>
          <Button v-else as-child variant="pill" class="px-5">
            <NuxtLink :to="citySocialsLink">
              Browse city page <ArrowRight aria-hidden="true" />
            </NuxtLink>
          </Button>
        </div>
        <div v-else class="grid sm:grid-cols-2 gap-4">
          <div
            v-for="c in courses"
            :key="c.id"
            class="group rounded-2xl bg-white p-5 border"
            :style="{ borderColor: c.color + '55', boxShadow: '0 1px 0 ' + c.color + '22, 0 6px 18px rgba(59,31,18,0.04)' }"
          >
            <div class="flex items-start justify-between gap-3 mb-2">
              <div class="min-w-0">
                <div class="text-base font-bold leading-tight text-foreground">
                  {{ c.school }}
                </div>
                <div class="text-xs mt-0.5 text-muted-foreground font-sans">
                  {{ c.teacher }} · <span class="text-secondary">{{ c.style }} · {{ c.level }}</span>
                </div>
                <div
                  v-if="goalsForStyle(c.style).length"
                  class="text-[10px] mt-1 italic"
                  style="color:var(--wd-green-600); font-family:var(--wd-font-display);"
                >
                  Serves your goal: {{ goalsForStyle(c.style).join(', ') }}
                </div>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <NuxtLink
                  v-if="!c.paidThroughMonth"
                  :to="`/events/${c.id}`"
                  class="text-eyebrow font-bold uppercase tracking-widest px-2 py-1 rounded-full whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity"
                  :style="{ color: 'var(--wd-red-600)', background: 'color-mix(in srgb, var(--wd-red-600) 9.4%, transparent)' }"
                >
                  Pay due
                </NuxtLink>
                <span
                  v-else
                  class="text-eyebrow font-bold uppercase tracking-widest px-2 py-1 rounded-full whitespace-nowrap"
                  :style="{ color: 'var(--wd-green-600)', background: 'color-mix(in srgb, var(--wd-green-600) 9.4%, transparent)' }"
                >
                  Paid
                </span>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="size-7 rounded hover:bg-wd-red-50 text-primary hover:text-primary [&_svg]:size-3.5"
                  :aria-label="`Remove course: ${c.school}`"
                  @click="unenrollCourse(c.id)"
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            </div>

            <div class="mt-3 space-y-1.5 text-xs text-muted-foreground font-sans">
              <div class="flex items-center gap-2">
                <Calendar class="w-3 h-3 text-secondary" />
                Next class <strong>{{ c.nextClassDate ? formatShortDate(c.nextClassDate) : c.weekday }}, {{ c.time }}</strong>
              </div>
              <div class="flex items-center gap-2">
                <MapPin class="w-3 h-3 text-secondary" />
                {{ c.venue }}
              </div>
            </div>

            <div class="mt-4">
              <div class="flex items-baseline justify-between mb-1">
                <span class="text-eyebrow uppercase tracking-widest font-bold text-secondary">Attendance this cycle</span>
                <span class="text-xs font-black text-foreground font-display">{{ c.attended }} / {{ c.total }}</span>
              </div>
              <div class="w-full h-1.5 rounded-full overflow-hidden" style="background:color-mix(in srgb, var(--wd-brown-900) 6.3%, transparent);">
                <div class="h-full transition-all" :style="{ width: Math.round((c.attended / c.total) * 100) + '%', background: c.color }" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- WEEK · Socials. -->
      <div id="socials" class="mt-14">
        <div class="flex items-baseline justify-between mb-4">
          <div>
            <div class="text-xs uppercase tracking-[0.3em] text-secondary">
              This week · socials<template v-if="dancerCity"> · {{ dancerCity }}</template>
            </div>
            <h2 class="mt-2 text-2xl leading-tight font-display text-foreground">
              Where you're <em class="italic text-primary">dancing.</em>
            </h2>
          </div>
          <NuxtLink
            :to="citySocialsLink"
            class="text-xs italic hover:underline text-secondary font-display"
          >
            Full week →
          </NuxtLink>
        </div>

        <div v-if="removedSocial" class="mb-2 flex items-center gap-2 text-xs text-muted-foreground font-sans" role="status">
          Removed {{ removedSocial.name }} from your plan.
          <Button variant="link" class="h-auto p-0 text-xs font-bold text-primary" @click="undoRemoveSocial">Undo</Button>
        </div>

        <div v-if="!upcomingSocials.length && (weekSocialsLoaded || !dancerCity)" class="rounded-2xl p-6 text-center border-2 border-dashed border-input bg-white/50">
          <Sparkles class="w-8 h-8 mx-auto mb-3 text-secondary" aria-hidden="true" />
          <template v-if="dancerCity">
            <p class="text-sm font-bold text-foreground font-sans">Nothing planned this week.</p>
            <p class="mt-1 text-sm text-muted-foreground font-sans">Pick the nights you're going out from this week's socials in {{ dancerCity }}.</p>
            <NuxtLink :to="citySocialsLink" class="mt-3 inline-flex items-center gap-1 rounded-full px-4 py-2 text-xs font-bold bg-wd-brown-900 font-sans" style="color:white;">
              See this week in {{ dancerCity }} <ArrowRight class="w-3.5 h-3.5" aria-hidden="true" />
            </NuxtLink>
          </template>
          <template v-else>
            <p class="text-sm text-muted-foreground font-sans">Pick your city and we'll show this week's socials to choose from.</p>
            <NuxtLink to="/settings" class="mt-2 inline-block font-sans text-xs font-bold underline text-primary">
              Set your city
            </NuxtLink>
          </template>
        </div>
        <div v-else-if="upcomingSocials.length" class="rounded-2xl bg-white border overflow-hidden" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);">
          <div
            v-for="(s, i) in upcomingSocials"
            :key="s.id"
            class="flex flex-wrap items-center gap-3 px-4 py-3"
            :class="i > 0 ? 'border-t' : ''"
            :style="{ borderColor: 'color-mix(in srgb, var(--wd-brown-900) 5.1%, transparent)', background: WD.green600 + '08' }"
          >
            <span
              class="w-12 text-center text-eyebrow font-black uppercase tracking-widest px-1.5 py-0.5 rounded leading-tight"
              :style="{ background: s.color + '18', color: s.color }"
            >{{ s.dayLabel }}<span v-if="s.dateISO" class="block font-bold normal-case tracking-normal">{{ shortDayDate(s.dateISO) }}</span></span>
            <span class="text-sm font-bold text-foreground font-sans">
              {{ s.time }}
            </span>
            <div class="min-w-0 flex-1">
              <NuxtLink v-if="!previewMode" :to="eventPath({ id: s.id, name: s.name })" class="block text-sm font-bold truncate text-foreground hover:underline">{{ s.name }}</NuxtLink>
              <div v-else class="text-sm font-bold truncate text-foreground">{{ s.name }}</div>
              <div class="text-xs truncate text-muted-foreground font-sans">
                {{ s.venue }}<template v-if="s.style"> · <span :style="{ color: s.color }">{{ s.style }}</span></template><template v-if="s.friendsGoing > 0"> · {{ s.friendsGoing }} friend{{ s.friendsGoing === 1 ? '' : 's' }} going</template>
              </div>
            </div>
            <button
              type="button"
              class="text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
              style="background: var(--wd-green-600); color: white;"
              :aria-label="`Going to ${s.name} — tap to remove from your plan`"
              :title="'Tap to remove from your plan'"
              @click="removeSocialFromPlan(s.id)"
            >
              ✓ Going
            </button>
          </div>
        </div>
      </div>

      <!-- TONIGHT · Hangouts. -->
      <div id="tonight" class="mt-14">
        <div class="flex items-baseline justify-between mb-4">
          <div>
            <div class="text-xs uppercase tracking-[0.3em] text-secondary">Tonight · hangouts</div>
            <h2 class="mt-2 text-2xl leading-tight font-display text-foreground">
              Who's <em class="italic text-primary">out.</em>
            </h2>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="isSignedIn"
              type="button"
              class="inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-wd-brown-900 font-sans"
              style="color:white;"
              @click="showHangoutForm = !showHangoutForm"
            >
              <Plus class="w-3.5 h-3.5" />
              I'm out
            </button>
            <span
              class="inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full text-primary font-sans"
              style="background:color-mix(in srgb, var(--wd-red-600) 9.4%, transparent);"
            >
              <span class="w-1.5 h-1.5 rounded-full animate-pulse bg-wd-red-600" />
              Live
            </span>
          </div>
        </div>

        <!-- Create hangout form -->
        <div v-if="showHangoutForm" class="rounded-2xl bg-white border p-4 mb-4" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);">
          <div class="flex flex-wrap gap-2 mb-3">
            <button
              v-for="k in (['dinner', 'coffee', 'bar', 'ride', 'floor'] as const)"
              :key="k"
              type="button"
              class="text-xs font-bold px-3 py-1.5 rounded-full capitalize"
              :aria-pressed="newHangout.kind === k"
              :style="newHangout.kind === k
                ? { background: hangoutColors[k], color: 'white' }
                : { background: 'white', color: hangoutColors[k], border: '1.5px solid ' + hangoutColors[k] + '55' }"
              @click="newHangout.kind = k"
            >
              {{ k }}
            </button>
          </div>
          <div class="space-y-2 mb-3">
            <Field id="hangout-title" label="What's the plan?">
              <Input v-model="newHangout.title" size="sm" placeholder="e.g. Dinner before La Rumba" />
            </Field>
            <div class="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
              <Field id="hangout-time" label="Time">
                <Input v-model="newHangout.time" type="time" size="sm" />
              </Field>
              <Field id="hangout-venue" label="Where?" optional>
                <Input v-model="newHangout.venue" size="sm" placeholder="Venue or address" />
              </Field>
            </div>
          </div>
          <p v-if="hangoutError" class="text-xs mb-2 px-1 text-primary font-sans" role="alert">
            {{ hangoutError }}
          </p>
          <div class="flex justify-end gap-2">
            <Button variant="ghost" size="sm" class="rounded-full text-xs text-muted-foreground" @click="showHangoutForm = false">
              Cancel
            </Button>
            <Button
              variant="pill"
              size="pill-sm"
              :loading="creatingHangout"
              :disabled="!newHangout.title.trim()"
              @click="createHangout"
            >
              {{ creatingHangout ? 'Posting…' : 'Post' }}
            </Button>
          </div>
        </div>

        <div v-if="!hangouts.length && !showHangoutForm" class="rounded-2xl p-6 text-center border-2 border-dashed border-input bg-white/50">
          <MoonStar class="w-8 h-8 mx-auto mb-3 text-secondary" />
          <p class="text-sm text-muted-foreground font-sans">
            Nobody's out yet. Post a dinner, a bar hop, or a ride — dancers show up when someone starts.
          </p>
        </div>
        <div v-else class="rounded-2xl bg-white border overflow-hidden" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);">
          <div
            v-for="(h, i) in hangouts"
            :key="h.id"
            class="flex flex-wrap items-center gap-3 px-4 py-3"
            :class="i > 0 ? 'border-t' : ''"
            :style="{ borderColor: 'color-mix(in srgb, var(--wd-brown-900) 5.1%, transparent)', background: h.going ? (WD.green600 + '08') : 'white' }"
          >
            <component :is="hangoutIcon(h.kind)" class="w-4 h-4 shrink-0" :style="{ color: h.color, 'stroke-width': 1.5 }" />
            <span class="text-sm font-bold w-12 text-foreground font-sans">
              {{ h.time }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="text-sm font-bold truncate text-foreground">{{ h.title }}</div>
              <div class="text-xs truncate text-muted-foreground font-sans">
                <span v-if="h.host">{{ h.host }} · </span>
                <span v-if="h.venue">{{ h.venue }} · </span>
                {{ h.people }} in
              </div>
            </div>
            <button
              type="button"
              class="text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
              :aria-pressed="h.going"
              :style="h.going
                ? { background: 'var(--wd-green-600)', color: 'white' }
                : { background: 'white', color: h.color, border: '1.5px solid ' + h.color + '55' }"
              @click="toggleHangout(h.id)"
            >
              {{ h.going ? '✓ In' : 'Join' }}
            </button>
            <Button
              v-if="h.mine"
              variant="ghost"
              size="icon-sm"
              class="size-7 rounded-full text-secondary [&_svg]:size-3.5"
              aria-label="Close this hangout"
              @click="closeHangout(h.id)"
            >
              <X aria-hidden="true" />
            </Button>
          </div>
        </div>
      </div>

      <!-- DISCOVER · widen-your-year deck. -->
      <div id="discover" class="mt-14">
        <div class="flex items-baseline justify-between mb-4">
          <div>
            <div class="text-xs uppercase tracking-[0.3em] text-secondary">Widen your year · discover</div>
            <h2 class="mt-2 text-2xl leading-tight font-display text-foreground">
              What could <em class="italic text-primary">rearrange</em> the year?
            </h2>
          </div>
          <Button
            variant="link"
            class="h-auto p-0 gap-1 text-xs font-normal italic text-secondary font-display disabled:opacity-40 [&_svg]:size-3"
            :disabled="!canUndo"
            @click="undoSwipe"
          >
            <Undo2 aria-hidden="true" /> Undo
          </Button>
        </div>
        <p class="text-sm mb-6 max-w-xl text-muted-foreground font-sans">
          People and places that could pull you somewhere new. Yes on an event adds it to your plan; Yes on two dancers heading to the same festival suggests it for your year. Skip = we won't show it again.
        </p>

        <!-- Deck -->
        <div class="relative mx-auto max-w-md">
          <div v-if="!deckCurrent" class="rounded-2xl p-10 text-center border-2 border-dashed border-input bg-white/50">
            <Sparkles class="w-10 h-10 mx-auto mb-3 text-secondary" />
            <p class="text-lg font-display text-foreground">
              That's it for this pass.
            </p>
            <p class="mt-2 text-sm text-muted-foreground font-sans">
              You've seen everyone and everything we have for you right now. New dancers and events show up here as they join WeDance.
            </p>
          </div>

          <!-- min-height, not a fixed height: the card grows with its text (it used to clip). -->
          <div v-else class="relative min-h-[400px]">
            <!-- Peek: card 3 behind -->
            <div v-if="deckAfter" class="absolute inset-0 rounded-3xl bg-white border" style="transform: scale(0.88) translateY(20px); opacity:0.35; border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); box-shadow: 0 6px 22px rgba(0,0,0,0.08);" />
            <!-- Peek: card 2 behind -->
            <div v-if="deckNext" class="absolute inset-0 rounded-3xl bg-white border" style="transform: scale(0.94) translateY(10px); opacity:0.65; border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); box-shadow: 0 6px 22px rgba(0,0,0,0.08);" />
            <!-- Current card — gestures live here -->
            <div
              :key="deckCurrent.id"
              class="relative rounded-3xl bg-white border overflow-hidden touch-none select-none cursor-grab active:cursor-grabbing"
              :style="{
                borderColor: 'color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent)',
                boxShadow: '0 12px 32px rgba(0,0,0,0.14)',
                transform: currentCardTransform(),
                transition: dragActive || cardExitDir ? 'transform 260ms ease-out' : 'transform 220ms ease-out',
              }"
              @pointerdown="onCardPointerDown"
              @pointermove="onCardPointerMove"
              @pointerup="onCardPointerUp"
              @pointercancel="onCardPointerUp"
            >
              <!-- YES / SKIP labels tinted by drag -->
              <div
                class="absolute top-6 left-6 z-10 px-3 py-1 rounded-full border-2 text-sm font-black uppercase tracking-widest pointer-events-none transition-opacity text-primary border-wd-red-600"
                style="transform: rotate(-10deg);"
                :style="{ opacity: Math.min(1, Math.max(0, -dragDx / 100)) }"
              >Skip</div>
              <div
                class="absolute top-6 right-6 z-10 px-3 py-1 rounded-full border-2 text-sm font-black uppercase tracking-widest pointer-events-none transition-opacity text-wd-green-600 border-wd-green-600"
                style="transform: rotate(10deg);"
                :style="{ opacity: Math.min(1, Math.max(0, dragDx / 100)) }"
              >Yes</div>

              <!-- DANCER CARDS (any of the 3 dancer kinds) -->
              <template v-if="deckCurrent.kind === 'dancer-your-fest' || deckCurrent.kind === 'dancer-new-fest' || deckCurrent.kind === 'dancer-local'">
                <img :src="deckCurrent.photo" :alt="deckCurrent.name" class="w-full h-64 object-cover" draggable="false">
                <div class="p-5">
                  <div class="flex items-baseline justify-between gap-3">
                    <div class="text-xl font-black font-display text-foreground">
                      {{ deckCurrent.name }}
                    </div>
                    <div class="text-xs italic text-secondary font-display">
                      {{ deckCurrent.city }}
                    </div>
                  </div>
                  <!-- Context chip -->
                  <div v-if="deckCurrent.kind === 'dancer-your-fest'"
                       class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                       :style="{ background: deckCurrent.festivalColor + '18', color: deckCurrent.festivalColor }">
                    <Plane class="w-3 h-3" style="stroke-width:1.5;" />
                    Also going to {{ deckCurrent.festivalName }}
                  </div>
                  <div v-else-if="deckCurrent.kind === 'dancer-new-fest'"
                       class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
                       :style="{ background: deckCurrent.festivalColor + '18', color: deckCurrent.festivalColor }">
                    <Plane class="w-3 h-3" style="stroke-width:1.5;" />
                    Going to {{ deckCurrent.festivalName }} — you're not
                  </div>
                  <div v-else-if="deckCurrent.kind === 'dancer-local' && (deckCurrent.regularAt || deckCurrent.city)"
                       class="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-wd-green-600"
                       style="background:color-mix(in srgb, var(--wd-green-600) 9.4%, transparent);">
                    <MapPin class="w-3 h-3" style="stroke-width:1.5;" />
                    <template v-if="deckCurrent.regularAt">Regular at {{ deckCurrent.regularAt }}</template>
                    <template v-else>Dances in {{ deckCurrent.city }}</template>
                  </div>
                  <div class="mt-3 flex flex-wrap gap-1">
                    <span v-for="st in deckCurrent.danceStyles" :key="st"
                          class="text-eyebrow font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-muted-foreground"
                          style="background:color-mix(in srgb, var(--wd-brown-900) 3.9%, transparent);">
                      {{ st }}
                    </span>
                  </div>
                  <p v-if="deckCurrent.reason" class="mt-3 text-xs italic leading-snug text-muted-foreground font-display">
                    {{ deckCurrent.reason }}
                  </p>
                </div>
              </template>

              <!-- EVENT: FESTIVAL -->
              <template v-else-if="deckCurrent.kind === 'event-festival'">
                <div class="h-64 p-6 flex flex-col justify-end" :style="{ background: 'linear-gradient(135deg, ' + (deckCurrent as any).color + ', var(--wd-orange-500))' }">
                  <div class="text-eyebrow uppercase tracking-widest font-bold text-white/90">Festival · not in your year</div>
                  <div class="mt-1 text-3xl font-black leading-none text-white font-display">
                    {{ deckCurrent.name }}
                  </div>
                </div>
                <div class="p-5">
                  <div class="flex items-center gap-4 text-xs text-muted-foreground font-sans">
                    <span class="inline-flex items-center gap-1">
                      <Calendar class="w-3 h-3 text-secondary" />
                      {{ new Date(`${(deckCurrent as any).dateISO}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) }}
                    </span>
                    <span class="inline-flex items-center gap-1">
                      <MapPin class="w-3 h-3 text-secondary" />
                      {{ (deckCurrent as any).venue }}, {{ (deckCurrent as any).city }}
                    </span>
                  </div>
                  <div v-if="(deckCurrent as any).friendsGoing > 0" class="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-wd-amber-500"
                       style="background:color-mix(in srgb, var(--wd-amber-500) 9.4%, transparent);">
                    <UsersIcon class="w-3 h-3" style="stroke-width:1.5;" />
                    {{ (deckCurrent as any).friendsGoing }} friend{{ (deckCurrent as any).friendsGoing === 1 ? '' : 's' }} going
                  </div>
                  <p v-if="deckCurrent.reason" class="mt-3 text-xs italic leading-snug text-muted-foreground font-display">
                    {{ deckCurrent.reason }}
                  </p>
                </div>
              </template>

              <!-- EVENT: LOCAL SOCIAL -->
              <template v-else>
                <div class="h-64 p-6 flex flex-col justify-end" :style="{ background: 'linear-gradient(135deg, ' + (deckCurrent as any).color + ', var(--wd-violet-600))' }">
                  <div class="text-eyebrow uppercase tracking-widest font-bold text-white/90">Local · {{ (deckCurrent as any).style }}</div>
                  <div class="mt-1 text-3xl font-black leading-none text-white font-display">
                    {{ deckCurrent.name }}
                  </div>
                </div>
                <div class="p-5">
                  <div class="flex items-center gap-4 text-xs text-muted-foreground font-sans">
                    <span class="inline-flex items-center gap-1">
                      <Calendar class="w-3 h-3 text-secondary" />
                      {{ [(deckCurrent as any).dayLabel, shortDayDate((deckCurrent as any).dateISO ?? '')].filter(Boolean).join(' ') }} · {{ (deckCurrent as any).time }}
                    </span>
                    <span class="inline-flex items-center gap-1">
                      <MapPin class="w-3 h-3 text-secondary" />
                      {{ (deckCurrent as any).venue }}, {{ (deckCurrent as any).city }}
                    </span>
                  </div>
                  <div v-if="(deckCurrent as any).friendsGoing > 0" class="mt-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-wd-amber-500"
                       style="background:color-mix(in srgb, var(--wd-amber-500) 9.4%, transparent);">
                    <UsersIcon class="w-3 h-3" style="stroke-width:1.5;" />
                    {{ (deckCurrent as any).friendsGoing }} friend{{ (deckCurrent as any).friendsGoing === 1 ? '' : 's' }} going
                  </div>
                  <p v-if="deckCurrent.reason" class="mt-3 text-xs italic leading-snug text-muted-foreground font-display">
                    {{ deckCurrent.reason }}
                  </p>
                </div>
              </template>
            </div>
          </div>

          <!-- Action buttons -->
          <div v-if="deckCurrent" class="mt-8 flex items-center justify-center gap-6">
            <button
              type="button"
              class="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 text-primary"
              style="background:white; border:2px solid color-mix(in srgb, var(--wd-red-600) 33.3%, transparent);"
              aria-label="Skip"
              @click="commitSwipe('skip')"
            >
              <X class="w-6 h-6" />
            </button>
            <button
              type="button"
              class="w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 text-wd-amber-500"
              style="background:white; border:2px solid color-mix(in srgb, var(--wd-amber-500) 33.3%, transparent);"
              aria-label="Later — show again at the end"
              title="Later — show again at the end"
              @click="commitSwipe('later')"
            >
              <Clock class="w-5 h-5" />
            </button>
            <button
              type="button"
              class="w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-110 active:scale-95 text-wd-green-600"
              style="background:white; border:2px solid color-mix(in srgb, var(--wd-green-600) 33.3%, transparent);"
              aria-label="Yes"
              @click="commitSwipe('yes')"
            >
              <Heart class="w-6 h-6" />
            </button>
          </div>

          <p v-if="deckCurrent" class="mt-4 text-xs text-center italic text-secondary font-display">
            Drag or use the buttons · {{ deck.length }} left
          </p>
        </div>
      </div>
    </section>

    </main>

    <SiteFooter />

  </div>
</template>
