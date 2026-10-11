<script setup lang="ts">
import type { Workshop, Teacher, PlanEntry, DanceRole, TicketOption, DancePartner, FestivalFriend, PartnerMatch, DiscoverDancer, RideShare, GroupDinner, ExtraActivity, FreemiumState } from '~/types/festival'
import { X, ClipboardList, Save, Check, Ticket, CalendarPlus, MapPin, Car, Shirt, UtensilsCrossed, Compass, ChevronDown, Users, Handshake, Sparkles, ExternalLink, BedDouble, Home, Search, MessageCircle } from 'lucide-vue-next'
import { Badge } from '~/components/ui/badge'
import { Button } from '~/components/ui/button'
import { RidePostSchema } from '#shared/validation'

const props = defineProps<{
  workshops: Workshop[]
  teachers: Teacher[]
  planIds: Set<string>
  plan: Map<string, PlanEntry>
  partners: DancePartner[]
  tickets?: TicketOption[]
  ticketUrl?: string
  isSignedIn?: boolean
  organizerName?: string
  friends?: FestivalFriend[]
  partnerMatches?: PartnerMatch[]
  discoverDancers?: DiscoverDancer[]
  festivalName?: string
  startDate?: string
  endDate?: string
  venueName?: string
  venueAddress?: string
  city?: string
  rideShares?: RideShare[]
  groupDinners?: GroupDinner[]
  extraActivities?: ExtraActivity[]
  lookingForRoommate?: boolean
  freemiumState?: FreemiumState
}>()

const emit = defineEmits<{
  remove: [id: string]
  save: []
  share: []
  'sign-in': []
  subscribe: []
  close: []
  'invite-friends': []
  'find-partner': []
  'discover-dancers': []
  'join-dinner': [id: string]
  'join-activity': [id: string]
  'post-ride': [ride: { type: 'offering' | 'looking'; originCity: string; date: string; seats?: number }]
  'toggle-roommate': []
}>()

const planned = computed(() => {
  return props.workshops
    .filter((w) => props.planIds.has(w.id))
    .sort((a, b) => {
      const dayOrder = ['Thursday', 'Friday', 'Saturday', 'Sunday']
      const dayDiff = dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day)
      if (dayDiff !== 0) return dayDiff
      return a.time.localeCompare(b.time)
    })
})

const groupedByDay = computed(() => {
  const map = new Map<string, Workshop[]>()
  for (const w of planned.value) {
    const list = map.get(w.day) || []
    list.push(w)
    map.set(w.day, list)
  }
  return map
})

function teacherFor(workshop: Workshop): Teacher | undefined {
  return props.teachers.find((t) => t.id === workshop.teacherId)
}

const count = computed(() => props.planIds.size)

function entryFor(workshopId: string): PlanEntry | undefined {
  return props.plan.get(workshopId)
}

const roleLabel: Record<DanceRole, string> = { lead: 'Lead', follow: 'Follow' }

function partnerName(entry: PlanEntry): string {
  if (entry.partnerStatus === 'looking') return 'Looking for partner'
  if (entry.partnerStatus === 'with-partner' && entry.partnerId) {
    const p = props.partners.find((pt) => pt.id === entry.partnerId)
    return p ? `with ${p.name}` : 'Have partner'
  }
  if (entry.partnerStatus === 'with-partner') return 'Have partner'
  return ''
}

// Checklist state
const checklist = ref<Record<string, boolean>>({
  dates: false,
  tickets: false,
  stay: false,
  travel: false,
  packing: false,
  food: false,
  explore: false,
})

function toggleCheck(key: string) {
  checklist.value[key] = !checklist.value[key]
}

// Auto-check: workshops count as done when picks > 0
const workshopsDone = computed(() => count.value > 0)

const checklistItems = [
  { key: 'dates', icon: CalendarPlus, label: 'Save the dates', hint: 'Add to calendar' },
  { key: 'stay', icon: MapPin, label: 'Book stay', hint: 'Hotel / Airbnb' },
  { key: 'packing', icon: Shirt, label: 'Pack', hint: 'Shoes, party outfits' },
]

const completedCount = computed(() => {
  let done = workshopsDone.value ? 1 : 0
  for (const key of Object.keys(checklist.value)) {
    if (checklist.value[key]) done++
  }
  return done
})

const totalItems = computed(() => checklistItems.length + 1) // +1 for workshops

// Expandable sections
const workshopsExpanded = ref(true)
const datesExpanded = ref(false)
const ticketsExpanded = ref(false)
const friendsExpanded = ref(false)
const partnersExpanded = ref(false)
const stayExpanded = ref(false)

// Social activities — expanded state
const travelExpanded = ref(false)
const mealsExpanded = ref(false)
const exploreExpanded = ref(false)

// Share a ride — form state (local UI)
const rideMode = ref<'looking' | 'offering' | null>(null)
const rideOriginCity = ref('')
const rideDate = ref('')
const rideSeats = ref(2)
const rideForm = reactive(useFormValidation(RidePostSchema, () => ({
  type: rideMode.value ?? 'offering',
  originCity: rideOriginCity.value,
  date: rideDate.value,
  seats: rideMode.value === 'offering' ? rideSeats.value : undefined,
})))
watch(rideMode, () => rideForm.reset())

// Use props from parent when available, fallback to empty
const rides = computed(() => props.rideShares ?? [])
const failedRidePhotos = ref(new Set<string>())
const dinners = computed(() => props.groupDinners ?? [])
const activities = computed(() => props.extraActivities ?? [])
const isLookingForRoommate = computed(() => props.lookingForRoommate ?? false)

function isRevealDay(date?: string): boolean {
  if (!date) return false
  const today = new Date().toISOString().slice(0, 10)
  return today >= date
}

// Freemium gate
const fallbackFreemium = ref<FreemiumState>({
  totalSignups: 7,
  maxFreeSpots: 10,
  userUnlocked: false,
  paymentUrl: 'https://buy.stripe.com/placeholder',
})

const freemium = computed(() => props.freemiumState ?? fallbackFreemium.value)
const isFreeAvailable = computed(() => freemium.value.totalSignups < freemium.value.maxFreeSpots)

const showPaywall = ref(false)

function tryJoinActivity(callback: () => void) {
  if (!props.isSignedIn) {
    emit('sign-in')
    return
  }
  if (freemium.value.userUnlocked || isFreeAvailable.value) {
    if (!props.freemiumState && !freemium.value.userUnlocked) {
      fallbackFreemium.value.totalSignups++
      fallbackFreemium.value.userUnlocked = true
    }
    callback()
  } else {
    showPaywall.value = true
  }
}

function joinDinner(id: string) {
  tryJoinActivity(() => {
    emit('join-dinner', id)
  })
}

function joinActivity(id: string) {
  tryJoinActivity(() => {
    emit('join-activity', id)
  })
}

function submitRide() {
  tryJoinActivity(() => {
    if (!rideMode.value) return
    const result = rideForm.validate()
    if (!result.success) return
    emit('post-ride', result.data)
    rideOriginCity.value = ''
    rideDate.value = ''
    rideSeats.value = 2
    rideMode.value = null
    checklist.value.travel = true
  })
}

// Friends going to this festival
const friendsGoing = computed(() => props.friends?.length ?? 0)

// Partner matches for workshops where user is "looking"
const lookingForPartner = computed(() => {
  let count = 0
  for (const [, entry] of props.plan) {
    if (entry.partnerStatus === 'looking') count++
  }
  return count
})

const relevantMatches = computed(() => {
  if (!props.partnerMatches?.length) return []
  const userWorkshopIds = [...props.planIds]
  return props.partnerMatches.filter(m =>
    m.workshopIds.some(id => userWorkshopIds.includes(id))
  )
})

// User's travel dates (default to festival dates)
const arrivalDate = ref(props.startDate || '')
const departureDate = ref(props.endDate || '')

// Watch for prop changes
watch(() => props.startDate, (v) => { if (v && !arrivalDate.value) arrivalDate.value = v })
watch(() => props.endDate, (v) => { if (v && !departureDate.value) departureDate.value = v })

// Date formatting
function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const formattedDateRange = computed(() => {
  if (!arrivalDate.value || !departureDate.value) return null
  const startStr = formatDate(arrivalDate.value)
  const end = new Date(departureDate.value + 'T00:00:00')
  const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${startStr} – ${endStr}`
})

const tripDayCount = computed(() => {
  if (!arrivalDate.value || !departureDate.value) return 0
  const start = new Date(arrivalDate.value)
  const end = new Date(departureDate.value)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
})

const festivalDateRange = computed(() => {
  if (!props.startDate || !props.endDate) return null
  return `${formatDate(props.startDate)} – ${formatDate(props.endDate)}`
})

// Google Calendar link (uses user's travel dates)
const calendarUrl = computed(() => {
  if (!arrivalDate.value || !departureDate.value) return null
  const title = encodeURIComponent(props.festivalName || 'Festival')
  const start = arrivalDate.value.replace(/-/g, '')
  // Google Calendar "all day" end date is exclusive, so add 1 day
  const endDate = new Date(departureDate.value)
  endDate.setDate(endDate.getDate() + 1)
  const end = endDate.toISOString().slice(0, 10).replace(/-/g, '')
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}`
})

// Booking URLs
const bookingComUrl = computed(() => {
  const city = props.city || ''
  const checkin = arrivalDate.value || props.startDate || ''
  const checkout = departureDate.value || props.endDate || ''
  const params = new URLSearchParams({
    ss: city,
    checkin,
    checkout,
    group_adults: '1',
    no_rooms: '1',
  })
  return `https://www.booking.com/searchresults.html?${params}`
})

const airbnbUrl = computed(() => {
  const city = props.city || ''
  const checkin = arrivalDate.value || props.startDate || ''
  const checkout = departureDate.value || props.endDate || ''
  return `https://www.airbnb.com/s/${encodeURIComponent(city)}/homes?checkin=${checkin}&checkout=${checkout}&adults=1`
})

const googleMapsUrl = computed(() => {
  if (!props.venueAddress) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(props.venueAddress)}`
})
</script>

<template>
  <div class="h-full flex flex-col bg-background">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground">
      <div class="flex items-center gap-2">
        <ClipboardList class="w-4 h-4" />
        <span class="text-sm font-semibold">My Plan</span>
        <span v-if="completedCount > 0" class="bg-primary-foreground/20 text-xs font-medium px-1.5 py-0.5 rounded">{{ completedCount }}/{{ totalItems }}</span>
      </div>
      <button class="p-1 rounded hover:bg-primary-foreground/10 lg:hidden" @click="emit('close')">
        <X class="w-4 h-4" />
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      <!-- Checklist -->
      <div class="divide-y">
        <!-- Workshops (auto-checked, expandable) -->
        <div class="px-4 py-2.5">
          <button
            class="w-full flex items-center gap-3"
            @click="workshopsExpanded = !workshopsExpanded"
          >
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              :class="workshopsDone ? 'bg-primary border-primary' : 'border-muted-foreground/30'"
            >
              <Check v-if="workshopsDone" class="w-3 h-3 text-primary-foreground" />
            </div>
            <span class="text-sm font-medium flex-1 text-left" :class="workshopsDone ? '' : 'text-muted-foreground'">
              Workshops
              <span class="text-xs text-muted-foreground font-normal ml-1">{{ count > 0 ? `${count} going` : 'Tap Going? in schedule' }}</span>
            </span>
            <ChevronDown
              v-if="count > 0"
              class="w-4 h-4 text-muted-foreground transition-transform"
              :class="workshopsExpanded ? 'rotate-180' : ''"
            />
          </button>

          <!-- Workshop list (collapsible) -->
          <div v-if="workshopsExpanded && count > 0" class="ml-8 mt-2 space-y-3">
            <div v-for="[day, dayWorkshops] in groupedByDay" :key="day">
              <h4 class="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">{{ day }}</h4>
              <div class="space-y-0.5">
                <div
                  v-for="w in dayWorkshops"
                  :key="w.id"
                  class="py-1.5 flex items-start justify-between gap-2"
                >
                  <div class="min-w-0">
                    <p class="text-xs font-medium leading-tight">{{ w.title }}</p>
                    <p v-if="w.type === 'party'" class="text-[11px] text-muted-foreground">{{ w.time }}<span v-if="w.venue"> · {{ w.venue }}</span></p>
                    <p v-else class="text-[11px] text-muted-foreground">{{ w.time }} · {{ teacherFor(w)?.name }}</p>
                    <div v-if="entryFor(w.id)?.role" class="mt-1 flex items-center gap-1">
                      <Badge variant="secondary" class="text-[9px] px-1 py-0">
                        {{ roleLabel[entryFor(w.id)!.role!] }}
                      </Badge>
                      <Badge
                        v-if="entryFor(w.id)!.partnerStatus !== 'solo'"
                        :variant="entryFor(w.id)!.partnerStatus === 'looking' ? 'outline' : 'secondary'"
                        :class="entryFor(w.id)!.partnerStatus === 'looking' ? 'bg-orange-100 text-orange-700 border-orange-200' : ''"
                        class="text-[9px] px-1 py-0"
                      >
                        {{ partnerName(entryFor(w.id)!) }}
                      </Badge>
                    </div>
                  </div>
                  <button
                    class="shrink-0 text-muted-foreground hover:text-destructive p-0.5"
                    @click="emit('remove', w.id)"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Save the dates (expandable) -->
        <div class="px-4 py-2.5">
          <button
            class="w-full flex items-center gap-3"
            @click="datesExpanded = !datesExpanded"
          >
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              :class="checklist.dates ? 'bg-primary border-primary' : 'border-muted-foreground/30'"
              @click.stop="toggleCheck('dates')"
            >
              <Check v-if="checklist.dates" class="w-3 h-3 text-primary-foreground" />
            </div>
            <CalendarPlus class="w-4 h-4 shrink-0" :class="checklist.dates ? 'text-primary' : 'text-muted-foreground'" />
            <span class="text-sm font-medium flex-1 text-left" :class="checklist.dates ? 'line-through text-muted-foreground' : ''">
              Save the dates
              <span v-if="formattedDateRange && !datesExpanded" class="text-xs text-muted-foreground font-normal ml-1">{{ formattedDateRange }}</span>
            </span>
            <ChevronDown
              class="w-4 h-4 text-muted-foreground transition-transform"
              :class="datesExpanded ? 'rotate-180' : ''"
            />
          </button>

          <div v-if="datesExpanded" class="ml-8 mt-2 space-y-3">
            <!-- Festival dates (reference) -->
            <p v-if="festivalDateRange" class="text-xs text-muted-foreground">
              Festival: {{ festivalDateRange }}
            </p>

            <!-- Arrival / Departure pickers -->
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Arrive</label>
                <input
                  v-model="arrivalDate"
                  type="date"
                  class="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                />
              </div>
              <div>
                <label class="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Depart</label>
                <input
                  v-model="departureDate"
                  type="date"
                  class="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                />
              </div>
            </div>

            <p v-if="tripDayCount > 0" class="text-xs text-muted-foreground">
              {{ tripDayCount }} days — consider extra days to explore the city and enjoy local parties.
            </p>

            <!-- Add to Google Calendar -->
            <Button
              v-if="calendarUrl"
              size="sm"
              variant="outline"
              class="w-full text-xs"
              as="a"
              :href="calendarUrl"
              target="_blank"
            >
              <CalendarPlus class="w-3.5 h-3.5 mr-1.5" />
              Add to Google Calendar
              <ExternalLink class="w-3 h-3 ml-1.5" />
            </Button>
          </div>
        </div>

        <!-- Get tickets (expandable) -->
        <div class="px-4 py-2.5">
          <button
            class="w-full flex items-center gap-3"
            @click="ticketsExpanded = !ticketsExpanded"
          >
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              :class="checklist.tickets ? 'bg-primary border-primary' : 'border-muted-foreground/30'"
              @click.stop="toggleCheck('tickets')"
            >
              <Check v-if="checklist.tickets" class="w-3 h-3 text-primary-foreground" />
            </div>
            <Ticket class="w-4 h-4 shrink-0" :class="checklist.tickets ? 'text-primary' : 'text-muted-foreground'" />
            <span class="text-sm font-medium flex-1 text-left" :class="checklist.tickets ? 'line-through text-muted-foreground' : ''">
              Get tickets
            </span>
            <ChevronDown
              class="w-4 h-4 text-muted-foreground transition-transform"
              :class="ticketsExpanded ? 'rotate-180' : ''"
            />
          </button>

          <!-- Ticket details (collapsible) -->
          <div v-if="ticketsExpanded" class="ml-8 mt-3 space-y-3">
            <TicketRecommendation
              v-if="tickets?.length"
              :tickets="tickets"
              :workshops="workshops"
              :plan-ids="planIds"
              :ticket-url="ticketUrl"
              :is-signed-in="isSignedIn"
              :organizer-name="organizerName"
              @join-waitlist="emit('save')"
              @offer-ticket="emit('save')"
              @sign-in="emit('sign-in')"
              @subscribe="emit('subscribe')"
            />
          </div>
        </div>

        <!-- Invite friends (expandable) -->
        <div class="px-4 py-2.5">
          <button
            class="w-full flex items-center gap-3"
            @click="friendsExpanded = !friendsExpanded"
          >
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              :class="friendsGoing > 0 ? 'bg-primary border-primary' : 'border-muted-foreground/30'"
            >
              <Check v-if="friendsGoing > 0" class="w-3 h-3 text-primary-foreground" />
            </div>
            <Users class="w-4 h-4 shrink-0" :class="friendsGoing > 0 ? 'text-primary' : 'text-muted-foreground'" />
            <span class="text-sm font-medium flex-1 text-left">
              Invite friends
              <span v-if="friendsGoing > 0" class="text-xs text-muted-foreground font-normal ml-1">{{ friendsGoing }} going</span>
              <span v-else class="text-xs text-muted-foreground font-normal ml-1">Who's coming?</span>
            </span>
            <ChevronDown
              class="w-4 h-4 text-muted-foreground transition-transform"
              :class="friendsExpanded ? 'rotate-180' : ''"
            />
          </button>

          <div v-if="friendsExpanded" class="ml-8 mt-2 space-y-2">
            <!-- Friend avatars -->
            <div v-if="friends?.length" class="space-y-1.5">
              <div
                v-for="friend in friends"
                :key="friend.id"
                class="flex items-center gap-2 py-1"
              >
                <img :src="friend.photo" :alt="friend.name" class="w-6 h-6 rounded-full" />
                <span class="text-xs font-medium">{{ friend.name }}</span>
                <Badge variant="secondary" class="text-[9px] px-1 py-0 ml-auto">
                  {{ friend.workshopIds.length }} picks
                </Badge>
              </div>
            </div>
            <Button size="sm" variant="outline" class="w-full text-xs" @click="emit('invite-friends')">
              Share your plan with friends
            </Button>
          </div>
        </div>

        <!-- Find partner (expandable) -->
        <div class="px-4 py-2.5">
          <button
            class="w-full flex items-center gap-3"
            @click="partnersExpanded = !partnersExpanded"
          >
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              :class="lookingForPartner > 0 ? 'bg-orange-400 border-orange-400' : 'border-muted-foreground/30'"
            >
              <Check v-if="lookingForPartner > 0" class="w-3 h-3 text-white" />
            </div>
            <Handshake class="w-4 h-4 shrink-0" :class="relevantMatches.length > 0 ? 'text-orange-500' : 'text-muted-foreground'" />
            <span class="text-sm font-medium flex-1 text-left">
              Find partner
              <span v-if="relevantMatches.length > 0" class="text-xs text-orange-600 font-normal ml-1">{{ relevantMatches.length }} matches</span>
              <span v-else class="text-xs text-muted-foreground font-normal ml-1">For workshops</span>
            </span>
            <ChevronDown
              class="w-4 h-4 text-muted-foreground transition-transform"
              :class="partnersExpanded ? 'rotate-180' : ''"
            />
          </button>

          <div v-if="partnersExpanded" class="ml-8 mt-2 space-y-2">
            <div v-if="relevantMatches.length" class="space-y-1.5">
              <div
                v-for="match in relevantMatches.slice(0, 3)"
                :key="match.id"
                class="flex items-center gap-2 py-1"
              >
                <img :src="match.photo" :alt="match.name" class="w-6 h-6 rounded-full" />
                <div class="min-w-0 flex-1">
                  <span class="text-xs font-medium">{{ match.name }}</span>
                  <span class="text-[10px] text-muted-foreground ml-1">{{ match.level }} · {{ match.role }}</span>
                </div>
              </div>
              <p v-if="relevantMatches.length > 3" class="text-[11px] text-muted-foreground">+{{ relevantMatches.length - 3 }} more matches</p>
            </div>
            <div v-else class="text-xs text-muted-foreground py-1">
              Pick workshops and choose "Looking for partner" to find matches
            </div>
            <Button size="sm" variant="outline" class="w-full text-xs" @click="emit('find-partner')">
              Browse all matches
            </Button>
          </div>
        </div>

        <!-- Book stay (expandable) -->
        <div class="px-4 py-2.5">
          <button
            class="w-full flex items-center gap-3"
            @click="stayExpanded = !stayExpanded"
          >
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              :class="checklist.stay ? 'bg-primary border-primary' : 'border-muted-foreground/30'"
              @click.stop="toggleCheck('stay')"
            >
              <Check v-if="checklist.stay" class="w-3 h-3 text-primary-foreground" />
            </div>
            <MapPin class="w-4 h-4 shrink-0" :class="checklist.stay ? 'text-primary' : 'text-muted-foreground'" />
            <span class="text-sm font-medium flex-1 text-left" :class="checklist.stay ? 'line-through text-muted-foreground' : ''">
              Book stay
              <span v-if="!checklist.stay" class="text-xs text-muted-foreground font-normal ml-1">Hotel / Airbnb</span>
            </span>
            <ChevronDown
              class="w-4 h-4 text-muted-foreground transition-transform"
              :class="stayExpanded ? 'rotate-180' : ''"
            />
          </button>

          <div v-if="stayExpanded" class="ml-8 mt-2 space-y-3">
            <!-- Venue reference -->
            <div v-if="venueName" class="text-xs text-muted-foreground">
              <p class="font-medium text-foreground">{{ venueName }}</p>
              <a
                v-if="googleMapsUrl"
                :href="googleMapsUrl"
                target="_blank"
                class="text-primary hover:underline inline-flex items-center gap-1 mt-0.5"
              >
                {{ venueAddress }} <ExternalLink class="w-3 h-3" />
              </a>
              <p v-else>{{ venueAddress }}</p>
            </div>

            <p class="text-xs text-muted-foreground">
              Book within walking distance — festivals end late, you'll thank yourself.
            </p>

            <!-- Search links -->
            <div class="space-y-1.5">
              <Button
                size="sm"
                variant="outline"
                class="w-full text-xs justify-start"
                as="a"
                :href="bookingComUrl"
                target="_blank"
              >
                <Search class="w-3.5 h-3.5 mr-1.5" />
                Search Booking.com
                <ExternalLink class="w-3 h-3 ml-auto" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                class="w-full text-xs justify-start"
                as="a"
                :href="airbnbUrl"
                target="_blank"
              >
                <Home class="w-3.5 h-3.5 mr-1.5" />
                Search Airbnb
                <ExternalLink class="w-3 h-3 ml-auto" />
              </Button>
            </div>

            <!-- Looking for a roommate -->
            <div class="rounded-md border p-3 space-y-2">
              <button
                class="w-full flex items-center justify-between"
                @click="emit('toggle-roommate')"
              >
                <div class="flex items-center gap-2">
                  <BedDouble class="w-4 h-4" :class="isLookingForRoommate ? 'text-primary' : 'text-muted-foreground'" />
                  <span class="text-xs font-medium">Looking for a roommate?</span>
                </div>
                <div
                  class="w-8 h-5 rounded-full transition-colors flex items-center px-0.5"
                  :class="isLookingForRoommate ? 'bg-primary' : 'bg-muted'"
                >
                  <div
                    class="w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                    :class="isLookingForRoommate ? 'translate-x-3' : 'translate-x-0'"
                  />
                </div>
              </button>
              <p v-if="isLookingForRoommate" class="text-[11px] text-muted-foreground">
                Other attendees looking for roommates will be able to see you. Share your plan to connect!
              </p>
            </div>
          </div>
        </div>

        <!-- Share a ride (was "Plan travel") -->
        <div class="px-4 py-2.5">
          <button
            class="w-full flex items-center gap-3"
            @click="travelExpanded = !travelExpanded"
          >
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              :class="checklist.travel ? 'bg-primary border-primary' : 'border-muted-foreground/30'"
              @click.stop="toggleCheck('travel')"
            >
              <Check v-if="checklist.travel" class="w-3 h-3 text-primary-foreground" />
            </div>
            <Car class="w-4 h-4 shrink-0" :class="checklist.travel ? 'text-primary' : 'text-muted-foreground'" />
            <span class="text-sm font-medium flex-1 text-left" :class="checklist.travel ? 'line-through text-muted-foreground' : ''">
              Share a ride
              <span v-if="rides.length > 0 && !travelExpanded" class="text-xs text-muted-foreground font-normal ml-1">{{ rides.length }} sharing</span>
            </span>
            <ChevronDown class="w-4 h-4 text-muted-foreground transition-transform" :class="travelExpanded ? 'rotate-180' : ''" />
          </button>

          <div v-if="travelExpanded" class="ml-8 mt-2 space-y-3">
            <!-- Toggle: Offering / Looking -->
            <div class="rounded-md border p-3 space-y-2">
              <div class="flex gap-2">
                <button
                  class="flex-1 text-xs font-medium py-1.5 rounded-md transition-colors"
                  :class="rideMode === 'offering' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
                  @click="rideMode = rideMode === 'offering' ? null : 'offering'"
                >
                  Offering a ride
                </button>
                <button
                  class="flex-1 text-xs font-medium py-1.5 rounded-md transition-colors"
                  :class="rideMode === 'looking' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'"
                  @click="rideMode = rideMode === 'looking' ? null : 'looking'"
                >
                  Looking for a ride
                </button>
              </div>

              <div v-if="rideMode" class="space-y-2">
                <div>
                  <label class="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">From city</label>
                  <input v-model="rideOriginCity" type="text" placeholder="e.g. Munich" class="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" v-bind="rideForm.fieldAttrs('originCity', 'cart-ride-origin-error')" />
                  <FieldError id="cart-ride-origin-error" :message="rideForm.errors.originCity" />
                </div>
                <div>
                  <label class="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{{ rideMode === 'offering' ? 'Departure date' : 'Preferred date' }}</label>
                  <input v-model="rideDate" type="date" class="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" v-bind="rideForm.fieldAttrs('date', 'cart-ride-date-error')" />
                  <FieldError id="cart-ride-date-error" :message="rideForm.errors.date" />
                </div>
                <div v-if="rideMode === 'offering'">
                  <label class="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Seats available</label>
                  <input v-model.number="rideSeats" type="number" min="1" max="6" class="mt-0.5 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs" v-bind="rideForm.fieldAttrs('seats', 'cart-ride-seats-error')" />
                  <FieldError id="cart-ride-seats-error" :message="rideForm.errors.seats" />
                </div>
                <Button size="sm" variant="outline" class="w-full text-xs" @click="submitRide">
                  Post my ride
                </Button>
              </div>
            </div>

            <!-- Others sharing rides -->
            <div v-if="rides.length" class="space-y-1.5">
              <p class="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Others sharing rides</p>
              <div v-for="ride in rides" :key="ride.id" class="flex items-center gap-2 py-1">
                <img v-if="ride.dancerPhoto && !failedRidePhotos.has(ride.id)" :src="ride.dancerPhoto" :alt="ride.dancerName" class="w-6 h-6 rounded-full object-cover" @error="failedRidePhotos.add(ride.id)" />
                <span v-else class="w-6 h-6 rounded-full shrink-0 inline-flex items-center justify-center text-[9px] font-bold uppercase bg-secondary text-secondary-foreground">{{ ride.dancerName.charAt(0) }}</span>
                <div class="min-w-0 flex-1">
                  <span class="text-xs font-medium">{{ ride.dancerName }}</span>
                  <span class="text-[10px] text-muted-foreground ml-1">
                    {{ ride.type === 'offering' ? 'from' : 'looking from' }} {{ ride.originCity }}
                    <span v-if="ride.seatsAvailable"> · {{ ride.seatsAvailable }} seats</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Pack (simple checkbox) -->
        <button
          class="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
          @click="toggleCheck('packing')"
        >
          <div
            class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
            :class="checklist.packing ? 'bg-primary border-primary' : 'border-muted-foreground/30'"
          >
            <Check v-if="checklist.packing" class="w-3 h-3 text-primary-foreground" />
          </div>
          <Shirt class="w-4 h-4 shrink-0" :class="checklist.packing ? 'text-primary' : 'text-muted-foreground'" />
          <div class="min-w-0">
            <span class="text-sm" :class="checklist.packing ? 'line-through text-muted-foreground' : ''">Pack</span>
            <span v-if="!checklist.packing" class="text-xs text-muted-foreground ml-1.5">Shoes, party outfits</span>
          </div>
        </button>

        <!-- Share a meal (was "Plan meals") -->
        <div class="px-4 py-2.5">
          <button
            class="w-full flex items-center gap-3"
            @click="mealsExpanded = !mealsExpanded"
          >
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              :class="checklist.food ? 'bg-primary border-primary' : 'border-muted-foreground/30'"
              @click.stop="toggleCheck('food')"
            >
              <Check v-if="checklist.food" class="w-3 h-3 text-primary-foreground" />
            </div>
            <UtensilsCrossed class="w-4 h-4 shrink-0" :class="checklist.food ? 'text-primary' : 'text-muted-foreground'" />
            <span class="text-sm font-medium flex-1 text-left" :class="checklist.food ? 'line-through text-muted-foreground' : ''">
              Share a meal
              <span v-if="!mealsExpanded" class="text-xs text-muted-foreground font-normal ml-1">Group dinners</span>
            </span>
            <ChevronDown class="w-4 h-4 text-muted-foreground transition-transform" :class="mealsExpanded ? 'rotate-180' : ''" />
          </button>

          <div v-if="mealsExpanded" class="ml-8 mt-2 space-y-3">
            <p class="text-xs text-muted-foreground">
              Join a group dinner with fellow dancers — meet new friends over a meal.
            </p>

            <div v-for="dinner in dinners" :key="dinner.id" class="rounded-md border p-3 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-medium">{{ dinner.day }} dinner</span>
                <Badge variant="secondary" class="text-[9px] px-1 py-0">{{ dinner.joined }}/{{ dinner.maxSize }} joined</Badge>
              </div>
              <p class="text-[11px] text-muted-foreground">
                {{ dinner.timeSlot }}
                <span v-if="dinner.restaurant"> · {{ dinner.restaurant }}</span>
                <span v-else-if="dinner.date" class="italic"> · Restaurant revealed on {{ dinner.day }}</span>
              </p>
              <!-- Progress bar -->
              <div class="w-full bg-muted rounded-full h-1.5">
                <div class="bg-primary rounded-full h-1.5 transition-all" :style="{ width: `${(dinner.joined / dinner.maxSize) * 100}%` }" />
              </div>
              <Button
                v-if="!dinner.userJoined && dinner.joined < dinner.maxSize"
                size="sm"
                variant="outline"
                class="w-full text-xs"
                @click="joinDinner(dinner.id)"
              >
                Join this dinner
              </Button>
              <template v-else-if="dinner.userJoined">
                <p class="text-xs text-primary font-medium flex items-center gap-1">
                  <Check class="w-3 h-3" /> You're in!
                </p>
                <div v-if="dinner.groupChatLink" class="flex items-center gap-2 mt-1">
                  <a :href="dinner.groupChatLink" target="_blank" class="text-xs text-primary hover:underline flex items-center gap-1">
                    <MessageCircle class="w-3 h-3" /> Open group chat
                  </a>
                  <div v-if="dinner.groupMembers?.length" class="flex -space-x-1">
                    <img v-for="m in dinner.groupMembers" :key="m.name" :src="m.photo" :alt="m.name" class="w-4 h-4 rounded-full border border-background" />
                  </div>
                </div>
              </template>
              <p v-else class="text-xs text-muted-foreground">Full</p>
            </div>
          </div>
        </div>

        <!-- Extra activities (was "Explore city") -->
        <div class="px-4 py-2.5">
          <button
            class="w-full flex items-center gap-3"
            @click="exploreExpanded = !exploreExpanded"
          >
            <div
              class="w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors"
              :class="checklist.explore ? 'bg-primary border-primary' : 'border-muted-foreground/30'"
              @click.stop="toggleCheck('explore')"
            >
              <Check v-if="checklist.explore" class="w-3 h-3 text-primary-foreground" />
            </div>
            <Compass class="w-4 h-4 shrink-0" :class="checklist.explore ? 'text-primary' : 'text-muted-foreground'" />
            <span class="text-sm font-medium flex-1 text-left" :class="checklist.explore ? 'line-through text-muted-foreground' : ''">
              Extra activities
              <span v-if="!exploreExpanded" class="text-xs text-muted-foreground font-normal ml-1">{{ activities.length }} available</span>
            </span>
            <ChevronDown class="w-4 h-4 text-muted-foreground transition-transform" :class="exploreExpanded ? 'rotate-180' : ''" />
          </button>

          <div v-if="exploreExpanded" class="ml-8 mt-2 space-y-2">
            <div v-for="activity in activities" :key="activity.id" class="rounded-md border p-3 space-y-1.5">
              <div class="flex items-center justify-between">
                <span class="text-xs font-medium">{{ activity.title }}</span>
                <Badge variant="secondary" class="text-[9px] px-1 py-0">
                  {{ activity.participantCount }}<span v-if="activity.maxParticipants">/{{ activity.maxParticipants }}</span> joined
                </Badge>
              </div>
              <p class="text-[11px] text-muted-foreground">{{ formatDate(activity.date) }} · {{ activity.time }}</p>
              <Button
                v-if="!activity.userJoined"
                size="sm"
                variant="outline"
                class="w-full text-xs"
                @click="joinActivity(activity.id)"
              >
                Join
              </Button>
              <p v-else class="text-xs text-primary font-medium flex items-center gap-1">
                <Check class="w-3 h-3" /> You're in!
              </p>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Paywall modal -->
    <Teleport to="body">
      <div v-if="showPaywall" class="fixed inset-0 z-[60] flex items-center justify-center bg-black/50" @click.self="showPaywall = false">
        <div class="bg-background rounded-lg p-6 mx-4 max-w-sm space-y-4">
          <div class="text-center space-y-2">
            <Sparkles class="w-8 h-8 text-primary mx-auto" />
            <h3 class="text-sm font-semibold">Unlock social activities</h3>
            <p class="text-xs text-muted-foreground">
              All {{ freemium.maxFreeSpots }} free spots have been claimed. Unlock rides, dinners, and activities for just &euro;1.
            </p>
          </div>
          <Button class="w-full" size="sm" as="a" :href="freemium.paymentUrl" target="_blank" @click="showPaywall = false">
            Unlock for &euro;1
          </Button>
          <button class="w-full text-xs text-muted-foreground hover:text-foreground transition-colors" @click="showPaywall = false">
            Maybe later
          </button>
        </div>
      </div>
    </Teleport>

    <!-- Save CTA -->
    <div v-if="!isSignedIn" class="border-t px-4 py-3">
      <Button class="w-full" size="sm" @click="emit('sign-in')">
        <Save class="w-3.5 h-3.5 mr-2" />
        Save my plan
      </Button>
    </div>
  </div>
</template>
