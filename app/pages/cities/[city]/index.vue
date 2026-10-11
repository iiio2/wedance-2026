<script setup lang="ts">
/**
 * /cities/[city] — a specific city.
 * Restyled 2026-07-02 to match V3 tropical direction.
 * layout: false + inline V3 header. Retired the WeekDrawer sidebar
 * and mobile drawer (same pattern the /festivals and /festivals/[slug]
 * retirements followed) — replaced with a soft floating nudge pill to
 * /my-plan when the user has picks in their week.
 * Shared child components (Lineup, TeacherProfile, WeeklyCalendar,
 * WeekDrawer) still carry shadcn styling and will get restyled in a
 * follow-up pass.
 * ?style=<Style> preselects the style filter; ?taster=1 (from the
 * /find-your-dance "free taster class" pick) shows a "Your first class"
 * section of upcoming classes, free-priced ones first (P1006).
 */
import { MapPin, Calendar, ArrowRight, Sparkles } from 'lucide-vue-next'
import type { Teacher } from '~/types/festival'
import { eventLocalDate, eventLocalTime, eventLocalWeekday, formatEventWhen } from '#shared/utils/eventTime'
import { isFreePrice, isTasterCandidate } from '#shared/utils/taster'
import { WD } from '~/lib/brand'

definePageMeta({ layout: false })

const route = useRoute()
const slug = route.params.city as string

// Week plan — sidebar retired; picks now surface via the floating
// nudge pill and the full view lives on /my-plan.
const { weekPlanIds, toggleEvent, weekCount } = useWeekPlan()

// Auth gate — "Going?" requires sign-in
const { isSignedIn } = useAuth()
const showSignUp = ref(false)

function onToggleEvent(id: string) {
  if (!isSignedIn.value) {
    showSignUp.value = true
    return
  }
  toggleEvent(id)
}

// People + venues from real migrated profiles (entity.cityDirectory), kept as
// refs and populated on mount (tRPC client is client-only). Same tabbed Lineup
// interface — only the data source changed (mock → DB).
const toPerson = (e: any): Teacher => ({
  id: e.username,
  name: e.name,
  photo: e.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(e.name)}&size=80&background=ec4899&color=fff&bold=true&rounded=true`,
  styles: e.styles || [],
  bio: '',
} as unknown as Teacher)

// Directory is SSR-rendered (see server/api/cities/[slug].get.ts) so the people
// list and the data-driven <title> ship in the HTML — crawlable + instant.
const { data: dir, pending: loadingDir } = await useFetch(`/api/cities/${slug}`, {
  key: `city-directory-${slug}`,
})
const cityName = computed(() =>
  dir.value?.city || slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
)
const teachers = computed<Teacher[]>(() => (dir.value?.artists ?? []).map(toPerson))
const djs = computed<Teacher[]>(() => [])
const organisers = computed<Teacher[]>(() => (dir.value?.organizers ?? []).map(toPerson))
const dbVenues = computed<Teacher[]>(() => (dir.value?.venues ?? []).map(toPerson))

// No mock weekly feed anymore — migrated events are historical, so the only live
// weekly events are real DB bookings (merged into the calendar below).
const events: any[] = []

const bookedEvents = ref<any[]>([])
const bookedEventsLoaded = ref(false)
// Dated public events (the wedance.vip mirror — scripts/sync-v3-events.ts).
const syncedEvents = ref<any[]>([])
// Going counts per event, batch-fetched after events load.
const eventGoingCounts = ref<Record<string, number>>({})
onMounted(async () => {
  try {
    const [booked, synced] = await Promise.all([
      $trpc.booking.upcomingByCity.query({ citySlug: slug }),
      $trpc.events.byCity.query({ citySlug: slug }).catch(() => []),
    ])
    bookedEvents.value = booked
    syncedEvents.value = synced as any[]
    // Batch-fetch going counts for all events so cards show real attendees.
    const allIds = [
      ...booked.map((b: any) => b.id),
      ...(synced as any[]).map((e: any) => e.id),
    ].filter(Boolean)
    if (allIds.length > 0) {
      try {
        eventGoingCounts.value = await $trpc.plan.countBatch.query({ itemType: 'event', itemIds: allIds })
      } catch { /* non-critical */ }
    }
  } finally { bookedEventsLoaded.value = true }
})
const bookedTypeMap: Record<string, string> = { Social: 'social', Party: 'social', Workshop: 'workshop', Class: 'class', Practica: 'practica' }
// Local YYYY-MM-DD (never toISOString — that shifts to UTC and, in a positive
// offset like CEST, moves every day back by one, so "this week" ends up a day off).
const fmtLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const thisWeekDates = computed(() => {
  const now = new Date(); const off = (now.getDay() + 6) % 7
  const mon = new Date(now); mon.setDate(now.getDate() - off); mon.setHours(0, 0, 0, 0)
  const set = new Set<string>()
  for (let i = 0; i < 7; i++) { const x = new Date(mon); x.setDate(mon.getDate() + i); set.add(fmtLocalDate(x)) }
  return set
})
const bookedThisWeek = computed(() => bookedEvents.value
  .filter(b => b.eventDate && thisWeekDates.value.has(String(b.eventDate).slice(0, 10)))
  .map(b => ({
    id: b.id, name: b.title || 'Social', type: bookedTypeMap[b.eventType] || 'social',
    style: b.styles?.[0] || '', day: new Date(String(b.eventDate).slice(0, 10)).toLocaleDateString('en-US', { weekday: 'long' }),
    time: b.startTime || '', duration: 0, venue: b.venueName, address: '', organizer: '',
    accentColor: WD.red600, attendeeCount: eventGoingCounts.value[b.id] ?? 0, recurring: false, date: b.eventDate,
    venueHandle: b.venueHandle || undefined,
  })))

// v3 eventType → WeeklyCalendar type badge.
const syncedTypeMap: Record<string, string> = { Course: 'class', Workshop: 'workshop', Party: 'social', Concert: 'social', Show: 'social' }
const toCityEvent = (e: any) => ({
  id: e.id, name: e.name || 'Event', type: syncedTypeMap[e.type] || 'social',
  style: e.styles?.[0] || '', styles: e.styles || [],
  day: eventLocalWeekday(e.startDate, e.timezone), time: eventLocalTime(e.startDate, e.timezone),
  duration: e.endDate ? Math.round((new Date(e.endDate).getTime() - new Date(e.startDate).getTime()) / 60000) : 0,
  venue: e.venueName || '', address: e.venueAddress || '', organizer: e.organizerName || '',
  organizerId: e.organizerUsername || undefined,
  venueId: e.venueUsername || undefined,
  venueHandle: e.venueUsername || undefined,
  artists: e.artists || [],
  accentColor: WD.red600, attendeeCount: eventGoingCounts.value[e.id] ?? 0, recurring: false,
  date: eventLocalDate(e.startDate, e.timezone),
})
// Festivals get their own section below — the week list is classes & socials.
const syncedNonFestival = computed(() => syncedEvents.value.filter(e => !e.isFestival))
const syncedThisWeek = computed(() => syncedNonFestival.value
  .filter(e => thisWeekDates.value.has(eventLocalDate(e.startDate, e.timezone)))
  .map(toCityEvent))
// After this week: the next weeks, grouped by local date (capped; "show more").
const upcomingLimit = ref(24)
const syncedLater = computed(() => {
  const weekEnd = [...thisWeekDates.value].sort().at(-1) ?? ''
  return syncedNonFestival.value
    .filter(e => eventLocalDate(e.startDate, e.timezone) > weekEnd)
    .filter(e => !selectedStyle.value || (e.styles || []).includes(selectedStyle.value))
})
// Booked events beyond this week (same shape as toCityEvent output).
const bookedLater = computed(() => {
  const weekEnd = [...thisWeekDates.value].sort().at(-1) ?? ''
  return bookedEvents.value
    .filter(b => b.eventDate && String(b.eventDate).slice(0, 10) > weekEnd)
    .filter(b => !selectedStyle.value || (b.styles || []).includes(selectedStyle.value))
    .map(b => {
      const date = String(b.eventDate).slice(0, 10)
      return {
        id: b.id, name: b.title || 'Social', type: bookedTypeMap[b.eventType] || 'social',
        style: b.styles?.[0] || '', styles: b.styles || [],
        time: b.startTime || '', venue: b.venueName || '', venueName: b.venueName || '',
        date,
        venueHandle: b.venueHandle || undefined,
      }
    })
})
const upcomingGroups = computed(() => {
  // Merge synced and booked future events, sorted by date then time.
  const allLater: { date: string; time: string; [k: string]: any }[] = [
    ...syncedLater.value.map(e => ({ ...e, date: eventLocalDate(e.startDate, e.timezone), time: eventLocalTime(e.startDate, e.timezone) })),
    ...bookedLater.value,
  ].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))

  const groups: { date: string; label: string; items: any[] }[] = []
  for (const e of allLater.slice(0, upcomingLimit.value)) {
    const date = e.date
    let g = groups.find(x => x.date === date)
    if (!g) {
      g = { date, label: new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' }), items: [] }
      groups.push(g)
    }
    g.items.push(e)
  }
  return groups
})

const cityAccent: Record<string, string> = {
  munich: WD.red600,
  berlin: WD.cyan600,
}
const accent = cityAccent[slug] || WD.purple500

// City meta the template renders (name / count / styles), derived from real data.
const city = computed(() => ({
  name: cityName.value,
  country: dir.value?.country || '',
  eventCount: bookedThisWeek.value.length + syncedThisWeek.value.length,
  styles: Array.from(new Set([
    ...teachers.value.flatMap((t: any) => t.styles || []),
    ...syncedEvents.value.flatMap((e: any) => e.styles || []),
  ])).slice(0, 12),
}))

// Intent-first, data-driven SEO. Dancers search by style ("salsa munich"), so
// the title leads with this city's actual top styles; brand goes last.
const hero = computed(() => dir.value?.hero ?? null)
const topStyles = computed(() => dir.value?.topStyles ?? [])
const stylePhrase = computed(() => {
  const s = topStyles.value
  if (s.length >= 3) return `${s[0]}, ${s[1]} & ${s[2]}`
  if (s.length === 2) return `${s[0]} & ${s[1]}`
  if (s.length === 1) return s[0]
  return 'Social Dance'
})
const seoTitle = computed(() => `${stylePhrase.value} in ${city.value.name} — Venues, Artists & Socials | WeDance`)
const seoDescription = computed(() =>
  `Find ${stylePhrase.value.toLowerCase()} venues, artists and organizers in ${city.value.name} — the local dance scene on WeDance.`,
)

useHead(() => ({
  title: seoTitle.value,
  meta: [
    { name: 'description', content: seoDescription.value },
  ],
}))

// Style filter — preselected from ?style= (the /find-your-dance quick picks).
const selectedStyle = ref(typeof route.query.style === 'string' ? route.query.style.trim() : '')

// People tabs (now also includes Venues — same Lineup shape with auto-generated avatars).
// Order: Venues first, then Organisers, then Artists.
type PeopleTab = 'teachers' | 'djs' | 'organisers' | 'venues'
const activeTab = ref<PeopleTab>('venues')

const peopleTabs: { key: PeopleTab; label: string }[] = [
  { key: 'venues', label: 'Venues' },
  { key: 'organisers', label: 'Organisers' },
  { key: 'teachers', label: 'Artists' },
]

// "Active this week" — who has an event on the calendar in the current week.
// Default view shows only these; "See all" reveals the full directory. The raw
// booked rows carry the identifiers we match on (venue/organiser @handle and the
// event's artists[] — names or @handles), so we derive one set per role.
const rawThisWeek = computed(() => bookedEvents.value.filter(
  b => b.eventDate && thisWeekDates.value.has(String(b.eventDate).slice(0, 10)),
))
const activeVenueIds = computed(() => new Set([
  ...rawThisWeek.value.map((b: any) => b.venueHandle),
  ...syncedThisWeek.value.map((e: any) => e.venueId),
].filter(Boolean)))
const activeOrganiserIds = computed(() => new Set([
  ...rawThisWeek.value.map((b: any) => b.organizerHandle),
  ...syncedThisWeek.value.map((e: any) => e.organizerId),
].filter(Boolean)))
const activeArtistTokens = computed(() => {
  const s = new Set<string>()
  for (const b of [...rawThisWeek.value, ...syncedThisWeek.value]) {
    for (const a of ((b as any).artists || [])) s.add(String(a).trim().replace(/^@/, '').toLowerCase())
  }
  return s
})
function personActiveThisWeek(tab: PeopleTab, p: any): boolean {
  // A handle counts in whichever role the event names it: many schools are typed
  // "venue" in 2026 but run the events as organiser (and vice versa).
  if (tab === 'venues' || tab === 'organisers') return activeVenueIds.value.has(p.id) || activeOrganiserIds.value.has(p.id)
  if (tab === 'teachers') {
    const t = activeArtistTokens.value
    return t.has(String(p.id).toLowerCase()) || t.has(String(p.name).trim().toLowerCase())
  }
  return false
}

// Real venue profiles in this city.
const venues = computed<Teacher[]>(() => dbVenues.value)

const allPeople = computed(() => [...teachers.value, ...djs.value, ...organisers.value, ...venues.value])

const selectedPersonId = ref<string | null>(null)

const selectedPerson = computed(() =>
  allPeople.value.find(p => p.id === selectedPersonId.value),
)

const filterLabel = computed(() => {
  if (!selectedPerson.value) return null
  const tab = activeTab.value
  const role = tab === 'teachers'
    ? 'teacher'
    : tab === 'djs'
      ? 'DJ'
      : tab === 'organisers'
        ? 'organiser'
        : 'venue'
  return { name: selectedPerson.value.name, role }
})

function onSelectPerson(id: string | null) {
  selectedPersonId.value = id
}

function clearPersonFilter() {
  selectedPersonId.value = null
}

function switchTab(tab: PeopleTab) {
  activeTab.value = tab
  selectedPersonId.value = null
}

const fullLineup = computed(() => {
  if (activeTab.value === 'teachers') return teachers.value
  if (activeTab.value === 'djs') return djs.value
  if (activeTab.value === 'organisers') return organisers.value
  return venues.value
})
// Each tab shows only who has an event this week; the full directory lives on a
// dedicated "See all" page (/cities/[city]/{role}) for its own SEO.
const activeLineup = computed(() => fullLineup.value.filter(p => personActiveThisWeek(activeTab.value, p)))
const currentLineup = activeLineup

const roleSlugFor = (tab: PeopleTab) =>
  tab === 'organisers' ? 'organisers' : tab === 'venues' ? 'venues' : 'artists'
const seeAllHref = computed(() => `/cities/${slug}/${roleSlugFor(activeTab.value)}`)

const filteredEvents = computed(() => {
  let result: any[] = [...events, ...bookedThisWeek.value, ...syncedThisWeek.value]
  if (selectedStyle.value) {
    result = result.filter(e => e.style === selectedStyle.value || (e.styles || []).includes(selectedStyle.value))
  }
  if (selectedPersonId.value) {
    const id = selectedPersonId.value
    if (activeTab.value === 'teachers') {
      result = result.filter(e => e.teacherId === id || (e.artists || []).some((a: string) => String(a).replace(/^@/, '').toLowerCase() === String(id).toLowerCase()))
    } else if (activeTab.value === 'djs') {
      result = result.filter(e => e.djId === id)
    } else if (activeTab.value === 'organisers') {
      result = result.filter(e => e.organizerId === id || e.venueId === id)
    } else {
      const venueName = id.replace(/^venue:/, '')
      result = result.filter(e => e.venue === venueName || e.venueId === id || e.organizerId === id)
    }
  }
  return result
})

// Upcoming festivals / congresses / weekenders in this city (synced events).
const cityFestivals = computed(() => syncedEvents.value
  .filter(e => e.isFestival)
  .map(e => ({
    id: e.id, name: e.name || 'Festival', logo: e.cover || '', accentColor: WD.red600,
    styles: e.styles || [], type: e.type, venueName: e.venueName,
    when: formatEventWhen(e.startDate, e.endDate, e.timezone),
  })))

// "Free taster class" (P1006): upcoming classes & workshops a beginner can try
// once. No source flags trial classes, so free-priced ones lead and the copy
// nudges people to ask for a free first class.
const tasterMode = computed(() => route.query.taster === '1')
const tasterLimit = 8
const tasterClasses = computed(() => {
  const synced = syncedEvents.value.filter(isTasterCandidate).map(e => ({
    id: e.id, name: e.name || 'Class', type: e.type, styles: e.styles || [],
    venueName: e.venueName || '', venueHandle: e.venueUsername || undefined,
    date: eventLocalDate(e.startDate, e.timezone), time: eventLocalTime(e.startDate, e.timezone),
    free: isFreePrice(e.price), price: e.price || '',
  }))
  const booked = bookedEvents.value.filter(b => b.eventDate && isTasterCandidate(b)).map(b => ({
    id: b.id, name: b.title || 'Class', type: b.eventType, styles: b.styles || [],
    venueName: b.venueName || '', venueHandle: b.venueHandle || undefined,
    date: String(b.eventDate).slice(0, 10), time: b.startTime || '',
    free: false, price: '',
  }))
  const sorted = [...synced, ...booked]
    .filter(e => !selectedStyle.value || e.styles.includes(selectedStyle.value))
    .sort((a, b) => Number(b.free) - Number(a.free) || a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  // A weekly course repeats every week — show only its next session so the
  // list offers different classes to try, not one course eight times.
  const seen = new Set<string>()
  return sorted
    .filter((e) => {
      const key = `${e.name}|${e.venueName}`.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, tasterLimit)
    .map(e => ({
      ...e,
      when: new Date(`${e.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }),
    }))
})
// Land visitors who came for a taster class on that section once data is in.
watch(bookedEventsLoaded, (loaded) => {
  if (!loaded || !tasterMode.value) return
  nextTick(() => document.getElementById('taster')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
})
function scrollToAskLocals() {
  document.getElementById('ask-locals')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

const styleChipColors = [WD.red600, WD.cyan600, WD.green600, WD.purple500, WD.amber500, WD.pink500, WD.violet600]

// --- City video competition + giveaways (O-009) ---------------------------
// All client-fetched: the tRPC client uses a relative URL that throws under
// Nitro SSR (same reason AttendeeRoster loads on mount).
const { $trpc } = useNuxtApp()

interface LeaderboardVideo {
  id: string
  title: string
  videoUrl: string
  thumbnailUrl: string | null
  danceStyle: string | null
  eloScore: number
  voteCount: number
}
const leaderboard = ref<LeaderboardVideo[]>([])
async function loadLeaderboard() {
  try {
    const rows = await $trpc.cityVideo.listApproved.query({ citySlug: slug })
    leaderboard.value = rows.slice(0, 5)
  } catch {
    leaderboard.value = []
  }
}

interface ActiveGiveaway {
  id: string
  sponsorName: string
  title: string
  description: string
  prizeDescription: string
  ctaUrl: string
  imageUrl: string | null
  termsUrl: string | null
  startsAt: string | Date
  endsAt: string | Date
}
const giveaways = ref<ActiveGiveaway[]>([])
async function loadGiveaways() {
  try {
    giveaways.value = await $trpc.giveaway.listActive.query({ citySlug: slug }) as ActiveGiveaway[]
  } catch {
    giveaways.value = []
  }
}

onMounted(() => {
  loadLeaderboard()
  loadGiveaways()
})
</script>

<template>
  <div class="min-h-screen" style="background:var(--wd-cream); color:var(--wd-brown-900); font-family:var(--wd-font-display);">
    <!-- V3 header — same as /, /festivals, /organizers, /for-events, /my-plan, /cities -->
    <SiteHeader />

    <!-- CITY HERO — landmark photo (Wikimedia) when we have one, else warm cream -->
    <section v-if="hero" class="relative">
      <div class="relative w-full h-64 sm:h-96 overflow-hidden">
        <img
          :src="hero.image"
          :alt="`${city.name} — landmark`"
          class="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          fetchpriority="high"
        >
        <!-- Scrim: keeps the overlaid title legible over any photo -->
        <div class="absolute inset-0" style="background:linear-gradient(180deg, rgba(59,31,18,0.15) 0%, rgba(59,31,18,0.05) 40%, rgba(59,31,18,0.75) 100%);" />

        <div class="relative h-full max-w-4xl mx-auto px-4 flex flex-col justify-end pb-6">
          <div class="text-lg leading-none mb-1" style="font-family:var(--wd-font-display);font-style:italic; color:#fbe3c2;">
            — {{ city.eventCount }} weekly events
          </div>
          <h1 class="text-5xl sm:text-7xl leading-[0.98] tracking-tight" style="font-family:var(--wd-font-display); color:#fff; text-shadow:0 2px 24px rgba(0,0,0,0.35);">
            {{ city.name }}
          </h1>
        </div>

        <!-- CC attribution (required for Wikimedia photos) -->
        <a
          v-if="hero.source"
          :href="hero.source" target="_blank" rel="noopener nofollow"
          class="absolute bottom-1.5 right-2 text-[10px] px-1.5 py-0.5 rounded"
          style="color:rgba(255,255,255,0.75); background:rgba(0,0,0,0.25); font-family:var(--wd-font-sans);"
          :title="`${hero.credit || 'Wikimedia Commons'}${hero.license ? ' · ' + hero.license : ''}`"
        >📷 {{ hero.credit || 'Wikimedia' }}<template v-if="hero.license"> · {{ hero.license }}</template></a>
      </div>

      <div class="relative max-w-4xl mx-auto px-4 pt-5 pb-2">
        <StyleFilter :styles="city.styles" v-model="selectedStyle" :accents="styleChipColors" />
      </div>

      <svg class="block w-full h-10 -mb-px" viewBox="0 0 1440 60" preserveAspectRatio="none">
        <path d="M0,40 Q360,0 720,30 T1440,20 V60 H0 Z" :fill="WD.brown900" opacity="0.08"/>
      </svg>
    </section>

    <!-- CITY HERO — fallback (no landmark image): original warm cream design -->
    <section v-else class="relative">
      <!-- Sun rays behind the whole hero, tinted by city accent -->
      <svg class="absolute -top-16 -right-16 w-64 h-64 opacity-20 pointer-events-none" viewBox="0 0 100 100">
        <g :stroke="accent" stroke-width="1.5" fill="none">
          <line v-for="i in 24" :key="i" x1="50" y1="50"
            :x2="50 + 48 * Math.cos(2 * Math.PI * i / 24)"
            :y2="50 + 48 * Math.sin(2 * Math.PI * i / 24)" />
        </g>
      </svg>

      <div class="relative max-w-4xl mx-auto px-4 pt-10 pb-6">
        <div class="text-lg leading-none mb-2" :style="{ fontFamily: 'var(--wd-font-display)', fontStyle: 'italic', color: accent }">
          — {{ city.eventCount }} weekly events
        </div>
        <h1 class="text-5xl sm:text-7xl leading-[0.98] tracking-tight" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">
          {{ city.name }}
        </h1>
        <p class="mt-2 text-sm sm:text-base flex items-center gap-1 italic" style="color:var(--wd-brown-700); font-family:var(--wd-font-display);">
          <MapPin class="w-3.5 h-3.5" style="color:var(--wd-amber-600);" />
          {{ city.country }}
        </p>

        <!-- Style filter chips (V3 warm palette) -->
        <StyleFilter :styles="city.styles" v-model="selectedStyle" :accents="styleChipColors" class="mt-6" />
      </div>

      <!-- Wave divider -->
      <svg class="block w-full h-10 -mb-px" viewBox="0 0 1440 60" preserveAspectRatio="none">
        <path d="M0,40 Q360,0 720,30 T1440,20 V60 H0 Z" :fill="WD.brown900" opacity="0.08"/>
      </svg>
    </section>

    <!-- PEOPLE TABS -->
    <section class="border-b" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); background:rgba(251, 245, 234, 0.5);">
      <div class="max-w-4xl mx-auto px-4">
        <div class="flex items-baseline justify-between gap-3 pt-6">
          <div>
            <div class="text-xs uppercase tracking-[0.3em]" style="color:var(--wd-amber-600);">Who's on the floor</div>
            <h2 class="mt-2 text-2xl leading-tight" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">
              The <em class="italic" style="color:var(--wd-red-600);">people</em> behind it all.
            </h2>
          </div>
          <NuxtLink
            :to="seeAllHref"
            class="text-xs italic hover:underline whitespace-nowrap shrink-0"
            style="color:var(--wd-amber-600); font-family:var(--wd-font-display);"
          >
            All {{ city.name }} {{ activeTab === 'organisers' ? 'organisers' : activeTab === 'venues' ? 'venues' : 'artists' }} →
          </NuxtLink>
        </div>

        <!-- Tab headers -->
        <div class="flex gap-1 mt-4 border-b -mb-px overflow-x-auto" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);">
          <button
            v-for="tab in peopleTabs"
            :key="tab.key"
            type="button"
            class="px-4 py-3 text-sm italic whitespace-nowrap transition-all -mb-px border-b-2"
            :style="activeTab === tab.key
              ? { borderColor: accent, color: accent, fontWeight: 700, fontFamily: 'var(--wd-font-display)' }
              : { borderColor: 'transparent', color: 'var(--wd-brown-700)', fontFamily: 'var(--wd-font-display)' }"
            @click="switchTab(tab.key)"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- This-week relevance label — the tab shows only who has an event this
             week; the full directory is the "All … →" link in the header above. -->
        <div class="pt-4 pb-1">
          <span class="text-xs italic" style="color:var(--wd-amber-600); font-family:var(--wd-font-display);">
            {{ activeLineup.length
              ? `${activeLineup.length} with events this week`
              : 'None with events this week' }}
          </span>
        </div>

        <!-- Tab content -->
        <div class="py-5">
          <p
            v-if="!currentLineup.length"
            class="text-sm italic py-4"
            style="color:var(--wd-brown-700); font-family:var(--wd-font-display);"
          >
            <template v-if="fullLineup.length">
              Nobody has an event this week yet.
            </template>
            <template v-else>
              No {{ activeTab === 'venues' ? 'venues' : activeTab === 'organisers' ? 'organisers' : 'artists' }} listed here yet.
            </template>
          </p>
          <Lineup
            v-else
            :teachers="currentLineup"
            :selected-id="selectedPersonId"
            @select="onSelectPerson"
          />
          <TeacherProfile
            v-if="selectedPerson"
            :teacher="selectedPerson"
            class="mt-4"
            @close="clearPersonFilter"
          />
        </div>
      </div>
    </section>

    <!-- YOUR FIRST CLASS — ?taster=1 from the /find-your-dance taster pick (P1006) -->
    <section v-if="tasterMode" id="taster" data-testid="taster-section" class="max-w-4xl mx-auto px-4 pt-12 scroll-mt-4">
      <div class="rounded-2xl p-5 sm:p-6" style="background:white; border:1px solid color-mix(in srgb, var(--wd-green-600) 33.3%, transparent); box-shadow: 0 1px 0 color-mix(in srgb, var(--wd-green-600) 13.3%, transparent), 0 8px 22px rgba(59,31,18,0.05);">
        <div class="text-xs uppercase tracking-[0.3em] flex items-center gap-1.5" style="color:var(--wd-green-600);">
          <Sparkles class="w-3.5 h-3.5" /> Try it, no pressure
        </div>
        <h2 class="mt-2 text-2xl leading-tight" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">
          Your first <em class="italic" style="color:var(--wd-green-600);">class.</em>
        </h2>
        <p class="mt-2 text-sm leading-relaxed" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
          Pick any class below and just go once — many schools let you try the first one free, just ask at the door.
          No partner, no experience, no commitment. See what sticks.
        </p>

        <div v-if="!bookedEventsLoaded" class="mt-5 text-sm italic" style="color:var(--wd-amber-600);">Finding classes…</div>

        <div v-else-if="tasterClasses.length" class="mt-5 grid grid-cols-1 gap-2">
          <NuxtLink
            v-for="e in tasterClasses"
            :key="e.id"
            :to="e.venueHandle ? `/@${e.venueHandle}` : `/events/${e.id}`"
            data-testid="taster-class"
            class="group rounded-xl p-3 border flex items-center gap-3 hover:-translate-y-0.5 transition-all"
            style="border-color:color-mix(in srgb, var(--wd-brown-900) 12.2%, transparent); background:color-mix(in srgb, var(--wd-cream) 50.2%, transparent);"
          >
            <div class="w-20 shrink-0 text-center" style="font-family:var(--wd-font-display);">
              <div class="text-[10px] font-bold uppercase tracking-wide whitespace-nowrap" style="color:var(--wd-amber-600);">{{ e.when }}</div>
              <div class="text-base font-black tabular-nums" style="color:var(--wd-green-600);">{{ e.time }}</div>
            </div>
            <div class="flex-1 min-w-0" style="font-family:var(--wd-font-sans);">
              <p class="text-sm font-bold truncate group-hover:underline" style="color:var(--wd-brown-900); font-family:var(--wd-font-display);">
                {{ e.name }}
                <span v-if="e.free" class="ml-1 align-middle px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style="background:color-mix(in srgb, var(--wd-green-600) 9.4%, transparent); color:var(--wd-green-600); font-family:var(--wd-font-sans);">Free</span>
              </p>
              <p class="text-xs truncate" style="color:var(--wd-brown-700);">
                <span class="font-bold uppercase tracking-wider text-[10px]" style="color:var(--wd-amber-600);">{{ e.type }}</span>
                <span v-if="e.styles.length"> · {{ e.styles.slice(0, 3).join(', ') }}</span>
                <span v-if="e.venueName"> · {{ e.venueName }}</span>
                <span v-if="e.price && !e.free"> · {{ e.price }}</span>
              </p>
            </div>
            <ArrowRight class="w-4 h-4 shrink-0" style="color:var(--wd-green-600);" />
          </NuxtLink>
        </div>

        <div v-else data-testid="taster-empty" class="mt-5 text-sm" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
          No {{ selectedStyle ? `${selectedStyle} ` : '' }}classes listed here yet —
          <button type="button" class="font-bold underline" style="color:var(--wd-green-600);" @click="scrollToAskLocals">ask the locals where beginners start</button>.
        </div>
      </div>
    </section>

    <!-- LOCAL COMMUNITY GROUPS — cold-start filler when there are few/no events -->
    <ClientOnly v-if="bookedEventsLoaded && bookedThisWeek.length === 0 && syncedThisWeek.length === 0">
      <CommunityGroupsSection :city-slug="slug" :city-name="city.name" />
    </ClientOnly>

    <!-- WEEKLY SCHEDULE -->
    <section class="max-w-4xl mx-auto px-4 py-12">
      <div class="flex flex-wrap items-baseline justify-between gap-3 mb-6">
        <div>
          <div class="text-xs uppercase tracking-[0.3em]" style="color:var(--wd-amber-600);">This week</div>
          <h2 class="mt-2 text-2xl leading-tight" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">
            Where you're <em class="italic" style="color:var(--wd-red-600);">dancing.</em>
          </h2>
        </div>
        <div v-if="filterLabel" class="flex items-center gap-2 text-xs" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
          <span>
            Filtering by {{ filterLabel.role }} <strong style="color:var(--wd-brown-900);">{{ filterLabel.name }}</strong>
          </span>
          <button
            type="button"
            class="text-xs font-bold underline"
            :style="{ color: accent, fontFamily: 'var(--wd-font-sans)' }"
            @click="clearPersonFilter"
          >
            Clear
          </button>
        </div>
      </div>
      <WeeklyCalendar
        :events="filteredEvents"
        :week-plan-ids="weekPlanIds"
        :teachers="[...teachers, ...djs, ...organisers]"
        @toggle="onToggleEvent"
        @select-teacher="onSelectPerson"
      />
    </section>

    <!-- COMING UP — dated events after this week (wedance.vip mirror) -->
    <section v-if="upcomingGroups.length" class="max-w-4xl mx-auto px-4 pb-12">
      <div class="mb-6">
        <div class="text-xs uppercase tracking-[0.3em]" style="color:var(--wd-amber-600);">After this week</div>
        <h2 class="mt-2 text-2xl leading-tight" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">
          Coming <em class="italic" :style="{ color: accent }">up.</em>
        </h2>
      </div>
      <div class="space-y-6">
        <div v-for="g in upcomingGroups" :key="g.date">
          <h3 class="text-sm font-black mb-2" style="color:var(--wd-brown-900); font-family:var(--wd-font-display);">{{ g.label }}</h3>
          <div class="grid grid-cols-1 gap-2">
            <NuxtLink
              v-for="e in g.items"
              :key="e.id"
              :to="e.venueHandle ? `/@${e.venueHandle}` : `/events/${e.id}`"
              class="group rounded-xl bg-white p-3 border flex items-center gap-3 hover:-translate-y-0.5 transition-all"
              style="border-color:color-mix(in srgb, var(--wd-brown-900) 12.2%, transparent); box-shadow:0 1px 0 color-mix(in srgb, var(--wd-brown-900) 5.1%, transparent);"
            >
              <div class="w-12 shrink-0 text-center text-base font-black tabular-nums" :style="{ color: accent, fontFamily: 'var(--wd-font-display)' }">{{ e.time }}</div>
              <div class="flex-1 min-w-0" style="font-family:var(--wd-font-sans);">
                <p class="text-sm font-bold truncate group-hover:underline" style="color:var(--wd-brown-900); font-family:var(--wd-font-display);">{{ e.name }}</p>
                <p class="text-xs truncate" style="color:var(--wd-brown-700);">
                  <span class="font-bold uppercase tracking-wider text-[10px]" style="color:var(--wd-amber-600);">{{ e.type }}</span>
                  <span v-if="e.styles?.length"> · {{ e.styles.slice(0, 3).join(', ') }}</span>
                  <span v-if="e.venueName"> · {{ e.venueName }}</span>
                </p>
              </div>
              <ArrowRight class="w-4 h-4 shrink-0" style="color:var(--wd-amber-600);" />
            </NuxtLink>
          </div>
        </div>
      </div>
      <button
        v-if="syncedLater.length + bookedLater.length > upcomingLimit"
        type="button"
        class="mt-6 text-xs font-bold underline"
        :style="{ color: accent, fontFamily: 'var(--wd-font-sans)' }"
        @click="upcomingLimit += 24"
      >
        Show more ({{ syncedLater.length + bookedLater.length - upcomingLimit }} more)
      </button>
    </section>

    <!-- VIDEO OF THE DAY — pairwise vote -->
    <section id="vote" class="border-t" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); background:rgba(251, 245, 234, 0.5);">
      <div class="max-w-4xl mx-auto px-4 py-12">
        <CityVideoVote :city-slug="slug" :accent="accent" />
      </div>
    </section>

    <!-- COMPETITION — leaderboard + submit -->
    <section id="compete" class="max-w-4xl mx-auto px-4 py-12">
      <div class="mb-6">
        <div class="text-xs uppercase tracking-[0.3em]" style="color:var(--wd-amber-600);">This month's competition</div>
        <h2 class="mt-2 text-2xl leading-tight" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">
          The <em class="italic" :style="{ color: accent }">leaderboard.</em>
        </h2>
        <p class="mt-2 max-w-2xl text-sm" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
          Post a clip from a {{ city.name }} dance floor and the community votes head-to-head
          in the matchup above. The highest-ranked video this month gets featured on WeDance{{ ' ' + city.name }}<template v-if="giveaways.length">, and wins this month's prize</template>. Any dancer, any style.
        </p>
      </div>

      <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
        <!-- Leaderboard -->
        <div>
          <ol v-if="leaderboard.length" class="space-y-2">
            <li
              v-for="(v, i) in leaderboard"
              :key="v.id"
              class="flex items-center gap-3 rounded-xl border bg-white p-3"
              :style="{ borderColor: accent + '33', boxShadow: '0 1px 0 ' + accent + '14' }"
            >
              <span
                class="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
                :style="{ background: i === 0 ? accent : WD.amber600 }"
              >{{ i + 1 }}</span>
              <a
                :href="v.videoUrl"
                target="_blank"
                rel="noopener"
                class="min-w-0 flex-1"
              >
                <p class="truncate text-sm font-bold hover:underline" style="color:var(--wd-brown-900); font-family:var(--wd-font-display);">
                  {{ v.title }}
                </p>
                <p class="text-[11px]" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
                  <span v-if="v.danceStyle">{{ v.danceStyle }} · </span>ELO {{ v.eloScore }} · {{ v.voteCount }} vote{{ v.voteCount === 1 ? '' : 's' }}
                </p>
              </a>
            </li>
          </ol>
          <div
            v-else
            class="rounded-xl border-2 border-dashed p-6 text-center"
            style="border-color:color-mix(in srgb, var(--wd-brown-900) 20%, transparent); background:rgba(255,255,255,0.5);"
          >
            <p class="text-sm font-bold" style="color:var(--wd-brown-900); font-family:var(--wd-font-display);">
              No entries yet
            </p>
            <p class="mt-1 text-xs" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
              Be the first to enter this month's competition.
            </p>
          </div>
        </div>

        <!-- Submit form -->
        <SubmitVideoForm
          :city-slug="slug"
          :city-name="city.name"
          :accent="accent"
          :prize="giveaways.length ? (giveaways[0].prizeDescription || giveaways[0].title) : undefined"
          @submitted="loadLeaderboard"
        />
      </div>
    </section>

    <!-- GIVEAWAYS -->
    <section
      v-if="giveaways.length"
      id="giveaways"
      class="border-t"
      style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); background:rgba(251, 245, 234, 0.5);"
    >
      <div class="max-w-4xl mx-auto px-4 py-12">
        <div class="mb-6">
          <div class="text-xs uppercase tracking-[0.3em]" style="color:var(--wd-amber-600);">Win something</div>
          <h2 class="mt-2 text-2xl leading-tight" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">
            Local <em class="italic" :style="{ color: accent }">giveaways.</em>
          </h2>
        </div>
        <div class="grid grid-cols-1 gap-4">
          <GiveawayCard
            v-for="g in giveaways"
            :key="g.id"
            :giveaway="g"
            :accent="accent"
          />
        </div>
      </div>
    </section>

    <!-- UPCOMING FESTIVALS IN THIS CITY (V3-styled cards) -->
    <section v-if="cityFestivals.length > 0" class="border-t" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); background:rgba(251, 245, 234, 0.5);">
      <div class="max-w-4xl mx-auto px-4 py-12">
        <div class="flex items-baseline justify-between mb-6">
          <div>
            <div class="text-xs uppercase tracking-[0.3em]" style="color:var(--wd-amber-600);">Coming to {{ city.name }}</div>
            <h2 class="mt-2 text-2xl leading-tight" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">
              Upcoming <em class="italic" style="color:var(--wd-red-600);">festivals.</em>
            </h2>
          </div>
          <NuxtLink
            to="/festivals"
            class="text-xs italic hover:underline"
            style="color:var(--wd-amber-600); font-family:var(--wd-font-display);"
          >
            All festivals →
          </NuxtLink>
        </div>

        <div class="grid grid-cols-1 gap-4">
          <NuxtLink
            v-for="f in cityFestivals"
            :key="f.id"
            :to="`/events/${f.id}`"
            class="group block rounded-2xl overflow-hidden bg-white border transition-all hover:-translate-y-1"
            :style="{ borderColor: f.accentColor + '55', boxShadow: '0 1px 0 ' + f.accentColor + '22, 0 8px 22px rgba(59,31,18,0.05)' }"
          >
            <div class="h-1.5" :style="{ background: f.accentColor }" />
            <div class="p-5">
              <div class="flex items-start gap-4">
                <img
                  v-if="f.logo"
                  :src="f.logo"
                  :alt="f.name"
                  class="w-14 h-14 rounded-full shrink-0 shadow-sm object-cover"
                  loading="lazy"
                >
                <div
                  v-else
                  class="w-14 h-14 rounded-full shrink-0 flex items-center justify-center text-xl font-bold text-white shadow-sm"
                  :style="{ background: f.accentColor }"
                >
                  {{ f.name.charAt(0) }}
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-bold text-lg leading-tight" style="color:var(--wd-brown-900);">
                    {{ f.name }}
                  </h3>
                  <div class="flex items-center gap-4 mt-1 text-xs" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
                    <span class="inline-flex items-center gap-1">
                      <Calendar class="w-3 h-3" style="color:var(--wd-amber-600);" />
                      {{ f.when }}
                    </span>
                    <span v-if="f.venueName" class="inline-flex items-center gap-1 min-w-0">
                      <MapPin class="w-3 h-3 shrink-0" style="color:var(--wd-amber-600);" />
                      <span class="truncate">{{ f.venueName }}</span>
                    </span>
                  </div>
                  <div class="flex flex-wrap gap-1.5 mt-3">
                    <span
                      v-for="style in f.styles.slice(0, 4)"
                      :key="style"
                      class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                      :style="{ background: f.accentColor + '18', color: f.accentColor }"
                    >
                      {{ style }}
                    </span>
                  </div>
                </div>
                <ArrowRight class="w-4 h-4 mt-1.5 shrink-0 transition-transform group-hover:translate-x-1" :style="{ color: f.accentColor }" />
              </div>
            </div>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Ask locals (client-only: tRPC has no SSR). Local groups now live under
         the Organisers directory (/cities/[city]/organisers) — one home. -->
    <ClientOnly>
      <section id="ask-locals" class="max-w-2xl mx-auto px-4 pb-10 scroll-mt-4">
        <AskLocalsSection :city-slug="slug" :city-name="city.name" />
      </section>
    </ClientOnly>

    <SiteFooter />

    <!-- Soft plan nudge — same pattern as /festivals and /festivals/[slug]. -->
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
          v-if="weekCount > 0"
          to="/my-plan"
          class="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 pl-3 pr-4 py-2.5 rounded-full text-white text-sm font-bold shadow-lg hover:shadow-xl transition-all"
          :style="{ background: accent, boxShadow: '0 6px 20px rgba(0,0,0,0.18), 0 3px 0 -1px rgba(0,0,0,0.15)' }"
        >
          <span
            class="inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black bg-white"
            :style="{ color: accent }"
          >{{ weekCount }}</span>
          <span style="font-family:var(--wd-font-display); letter-spacing:0.01em;">in your week</span>
          <span style="font-family:var(--wd-font-display);font-style:italic; font-size:16px; opacity:0.85;">— see dashboard</span>
          <ArrowRight class="w-4 h-4" />
        </NuxtLink>
      </Transition>
    </Teleport>

    <SignUpModal v-model:open="showSignUp" action="plan" />
  </div>
</template>
