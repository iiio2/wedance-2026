<script setup lang="ts">
/**
 * PromoterProfile — the tabbed profile page for promoter-type profiles.
 * Three fan tabs (Concerts · Artists · Book) and a dashboard toggle for
 * the promoter's team. Follows Option C from the sketch at /sketches/promoter.
 *
 * Concerts: upcoming events from the promoter's profile (events.byProfile),
 *   with city-filter buttons and a "Not in your city?" follow prompt.
 * Artists: 2-column grid of the promoter's roster (entity.promoterRoster),
 *   linked to /@handle artist pages.
 * Book: multi-step booking flow using the existing inquiries.send tRPC.
 */
import {
  MapPin, Ticket, Calendar, Send, Heart, Check, Bell,
  ChevronRight, ChevronLeft, Building2, Sparkles, Users,
  BarChart3, RefreshCw, MessageCircle,
} from 'lucide-vue-next'
import { eventLocalDate, eventLocalTime } from '#shared/utils/eventTime'
import { eventPath } from '#shared/utils/eventSlug'

const props = defineProps<{
  profile: {
    id: string
    username: string
    name: string
    type: string
    city: string | null
    citySlug: string | null
    photo: string | null
    bio: string | null
    styles: string[]
    socials: { platform: string; url: string }[]
    claimed: boolean
  }
  canManage: boolean
}>()

const { $trpc } = useNuxtApp()
const { isSignedIn } = useAuth()

// ── Tab state ────────────────────────────────────────────────────────────
const tab = ref<'concerts' | 'artists' | 'book'>('concerts')

// ── Roster (artists in the promoter's network) ──────────────────────────
const roster = ref<any[]>([])
const rosterPending = ref(true)
onMounted(async () => {
  try {
    roster.value = await $trpc.entity.promoterRoster.query({ profileId: props.profile.id })
  } catch {}
  rosterPending.value = false
})

// ── Events (concerts this promoter runs / is associated with) ───────────
const events = ref<any[]>([])
const eventsPending = ref(true)
onMounted(async () => {
  try {
    events.value = await $trpc.events.byProfile.query({
      username: props.profile.username,
      name: props.profile.name,
    })
  } catch {}
  eventsPending.value = false
})

// City filter for the Concerts tab.
const cities = computed(() => {
  const set = new Set<string>()
  for (const e of events.value) {
    if (e.city) set.add(e.city)
  }
  return ['All', ...Array.from(set).sort()]
})
const cityFilter = ref('All')
const filteredEvents = computed(() => {
  if (cityFilter.value === 'All') return events.value
  return events.value.filter((e: any) => e.city === cityFilter.value)
})

// ── Follow (the promoter page itself) ───────────────────────────────────
const following = ref(false)
const followBusy = ref(false)
const followerCount = ref(0)

onMounted(async () => {
  try { followerCount.value = await $trpc.follow.count.query({ profileId: props.profile.id }) } catch {}
  if (isSignedIn.value) {
    try { following.value = await $trpc.follow.isFollowing.query({ profileId: props.profile.id }) } catch {}
  }
})

async function toggleFollow() {
  if (followBusy.value) return
  if (!isSignedIn.value) { await navigateTo('/auth/login'); return }
  followBusy.value = true
  try {
    const result = await $trpc.follow.toggle.mutate({ profileId: props.profile.id })
    following.value = result.following
    followerCount.value += result.following ? 1 : -1
  } catch {} finally { followBusy.value = false }
}

// ── Artist detail overlay ───────────────────────────────────────────────
const openArtist = ref<any | null>(null)
const artistEvents = ref<any[]>([])
const artistFollowing = ref(false)
const artistFollowBusy = ref(false)

async function viewArtist(a: any) {
  openArtist.value = a
  artistEvents.value = []
  artistFollowing.value = false
  try {
    artistEvents.value = await $trpc.events.byProfile.query({ username: a.username, name: a.name })
  } catch {}
  if (isSignedIn.value) {
    try {
      const p = await $trpc.entity.getByHandle.query({ handle: a.username })
      if (p) artistFollowing.value = await $trpc.follow.isFollowing.query({ profileId: p.profile.id })
    } catch {}
  }
}

async function toggleArtistFollow() {
  if (!openArtist.value || artistFollowBusy.value) return
  if (!isSignedIn.value) { await navigateTo('/auth/login'); return }
  artistFollowBusy.value = true
  try {
    const p = await $trpc.entity.getByHandle.query({ handle: openArtist.value.username })
    if (p) {
      const result = await $trpc.follow.toggle.mutate({ profileId: p.profile.id })
      artistFollowing.value = result.following
    }
  } catch {} finally { artistFollowBusy.value = false }
}

// ── Booking flow (Book tab) ─────────────────────────────────────────────
const bookStep = ref(0) // 0 pick artist · 1 details · 2 confirm
const bookArtist = ref<any | null>(null)
const bookForm = reactive({
  city: '', month: '', size: '200–400', budget: '', name: '', email: '', message: '',
})
const bookBusy = ref(false)
const bookErr = ref('')
const bookDone = ref(false)

function startBooking(a: any) {
  bookArtist.value = a
  bookStep.value = 1
  openArtist.value = null
  tab.value = 'book'
}

async function submitBooking() {
  bookErr.value = ''
  if (!bookForm.name.trim() || !bookForm.email.trim() || !bookForm.message.trim()) {
    bookErr.value = 'Please fill in your name, email and a message.'
    return
  }
  bookBusy.value = true
  try {
    await $trpc.inquiries.send.mutate({
      handle: props.profile.username,
      name: bookForm.name,
      email: bookForm.email,
      what: 'Book an artist',
      city: bookForm.city,
      budget: bookForm.budget,
      message: `Artist: ${bookArtist.value?.name ?? 'Any'}\nWhen: ${bookForm.month}\nAudience: ${bookForm.size}\n\n${bookForm.message}`,
      website: '',
    })
    bookDone.value = true
    useTrack().track('booking_inquiry_sent', { profile: props.profile.username, type: 'promoter', what: 'Book an artist' })
  } catch (e: any) {
    bookErr.value = e?.message || 'Could not send. Try again.'
  } finally { bookBusy.value = false }
}

function resetBooking() {
  bookStep.value = 0
  bookArtist.value = null
  bookDone.value = false
  bookErr.value = ''
  Object.assign(bookForm, { city: '', month: '', size: '200–400', budget: '', name: '', email: '', message: '' })
}

// ── Dashboard ───────────────────────────────────────────────────────────
const showDashboard = ref(false)
const dashboard = ref<any>(null)
const dashboardPending = ref(false)

watch(showDashboard, async (v) => {
  if (v && !dashboard.value && props.canManage) {
    dashboardPending.value = true
    try {
      dashboard.value = await $trpc.entity.promoterDashboard.query({ profileId: props.profile.id })
    } catch {}
    dashboardPending.value = false
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')
function fmtDate(d: any) {
  if (!d) return 'Date TBD'
  try { return new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) } catch { return String(d) }
}
</script>

<template>
  <div class="pb-8">
    <!-- Dashboard toggle (only for managers) -->
    <div v-if="canManage" class="max-w-2xl mx-auto px-4 pt-2 pb-1">
      <div class="flex rounded-full border border-border p-0.5 bg-background w-fit">
        <button
          v-for="m in (['fan', 'promoter'] as const)" :key="m"
          class="px-3 h-8 rounded-full text-xs font-bold transition-colors"
          :class="(m === 'promoter') === showDashboard ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'"
          @click="showDashboard = m === 'promoter'"
        >{{ m === 'fan' ? 'Fan view' : 'Your dashboard' }}</button>
      </div>
    </div>

    <!-- ══════ Promoter Dashboard ══════ -->
    <template v-if="showDashboard && canManage">
      <div class="max-w-2xl mx-auto px-4 py-4 space-y-4">
        <div v-if="dashboardPending" class="text-center py-8">
          <div class="inline-block w-6 h-6 rounded-full border-2 animate-spin" style="border-color:color-mix(in srgb, var(--wd-red-600) 20%, transparent); border-top-color:var(--wd-red-600);" />
        </div>
        <template v-else-if="dashboard">
          <!-- Audience -->
          <div class="rounded-2xl border border-border p-4">
            <div class="flex items-center gap-2 text-sm font-bold"><Users class="w-4 h-4 text-wd-cyan-700" /> Your audience</div>
            <p class="mt-2 text-2xl font-display">{{ dashboard.followerCount }} <span class="text-sm text-muted-foreground font-sans">follower{{ dashboard.followerCount === 1 ? '' : 's' }}</span></p>
            <p class="mt-1 text-2xl font-display">{{ dashboard.rosterCount }} <span class="text-sm text-muted-foreground font-sans">artist{{ dashboard.rosterCount === 1 ? '' : 's' }} in roster</span></p>
            <p class="mt-2 text-xs text-muted-foreground">People who follow your artists get notified when you add a date in their city.</p>
          </div>

          <!-- Booking requests -->
          <div class="rounded-2xl border border-border p-4">
            <div class="flex items-center gap-2 text-sm font-bold"><Send class="w-4 h-4 text-primary" /> Booking requests</div>
            <div v-if="!dashboard.inquiries.length" class="mt-2 text-sm text-muted-foreground">No booking requests yet. Share your page to start receiving them.</div>
            <ul v-else class="mt-3 space-y-2">
              <li v-for="inq in dashboard.inquiries" :key="inq.id" class="rounded-xl bg-muted/60 p-3 text-xs">
                <p class="font-bold">{{ inq.what }} · {{ inq.city || 'No city' }}</p>
                <p class="text-muted-foreground mt-0.5">{{ inq.name }} · {{ inq.email }}<span v-if="inq.guests"> · {{ inq.guests }} people</span><span v-if="inq.budget"> · {{ inq.budget }}</span></p>
                <p v-if="inq.message" class="mt-1 text-muted-foreground line-clamp-2">{{ inq.message }}</p>
                <p class="mt-1 text-muted-foreground/60">{{ fmtDate(inq.createdAt) }} · {{ inq.status }}</p>
              </li>
            </ul>
          </div>

          <!-- Sync status (placeholder) -->
          <div class="rounded-2xl border border-border p-4">
            <div class="flex items-center gap-2 text-sm font-bold"><RefreshCw class="w-4 h-4 text-wd-green-700" /> Event sync</div>
            <p class="mt-1 text-xs text-muted-foreground">External sync (Fourvenues, Jamboree) is coming. Events are currently managed manually or pulled from wedance.vip.</p>
          </div>

          <!-- Analytics (placeholder) -->
          <div class="rounded-2xl border border-border p-4">
            <div class="flex items-center gap-2 text-sm font-bold"><BarChart3 class="w-4 h-4 text-primary" /> Page analytics</div>
            <p class="mt-1 text-xs text-muted-foreground">Detailed click and plan stats per city are coming. Your page is live and collecting data.</p>
          </div>
        </template>
        <div v-else class="text-sm text-muted-foreground text-center py-8">Could not load dashboard data.</div>
      </div>
    </template>

    <!-- ══════ Fan View (tabs) ══════ -->
    <template v-else>
      <!-- Artist detail overlay -->
      <template v-if="openArtist">
        <div class="max-w-2xl mx-auto px-4 py-4">
          <button class="inline-flex items-center gap-1 text-xs font-bold text-primary font-sans" @click="openArtist = null"><ChevronLeft class="w-3.5 h-3.5" /> {{ profile.name }}</button>
          <div class="mt-4 h-40 rounded-2xl bg-gradient-to-br from-wd-red-600 to-wd-orange-500 flex items-end p-4 text-white overflow-hidden relative">
            <img v-if="openArtist.photo" :src="openArtist.photo" :alt="openArtist.name" class="absolute inset-0 w-full h-full object-cover object-top opacity-60">
            <div class="relative z-10">
              <p class="text-eyebrow uppercase tracking-[0.2em] opacity-90 font-sans">Artist</p>
              <h2 class="font-display text-2xl leading-tight">{{ openArtist.name }}</h2>
            </div>
          </div>
          <p v-if="openArtist.bio" class="mt-3 text-sm text-muted-foreground font-sans">{{ openArtist.bio }}</p>
          <DanceStyleChips v-if="openArtist.styles?.length" :styles="openArtist.styles" class="mt-2 gap-1.5" />
          <div class="mt-4 flex gap-2">
            <button class="flex-1 h-10 rounded-full bg-primary text-primary-foreground text-sm font-bold inline-flex items-center justify-center gap-1.5" @click="startBooking(openArtist)"><Send class="w-4 h-4" /> Book for your event</button>
            <button class="h-10 px-4 rounded-full border text-sm font-bold inline-flex items-center gap-1.5" :class="artistFollowing ? 'bg-foreground text-background border-foreground' : 'border-border'" @click="toggleArtistFollow">
              <Heart class="w-4 h-4" :class="artistFollowing ? 'fill-current' : ''" /> {{ artistFollowing ? 'Following' : 'Follow' }}
            </button>
          </div>
          <p v-if="artistFollowing" class="mt-2 text-xs text-wd-green-700 font-sans">We'll tell you when {{ openArtist.name.split(' ')[0] }} plays near you.</p>
          <h3 class="mt-6 font-display text-lg">Upcoming</h3>
          <ul v-if="artistEvents.length" class="mt-2 divide-y divide-border font-sans">
            <li v-for="e in artistEvents" :key="e.id" class="py-3 flex items-center gap-3">
              <div class="w-12 text-center shrink-0">
                <p class="text-[10px] uppercase font-bold text-secondary">{{ eventLocalDate(e.startDate, e.timezone).slice(5) }}</p>
              </div>
              <div class="flex-1 min-w-0">
                <p class="font-bold text-sm">{{ e.name }}</p>
                <p class="text-xs text-muted-foreground truncate">{{ e.venueName || e.city }}</p>
              </div>
              <NuxtLink :to="eventPath(e)" class="shrink-0 h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1">
                <Ticket class="w-3.5 h-3.5" /> Details
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="mt-2 text-sm text-muted-foreground font-sans italic">No upcoming events listed yet.</p>
          <NuxtLink :to="`/@${openArtist.username}`" class="mt-4 inline-flex items-center gap-1 text-xs font-bold text-primary font-sans">Full profile <ChevronRight class="w-3.5 h-3.5" /></NuxtLink>
        </div>
      </template>

      <!-- Tabs -->
      <template v-else>
        <div class="sticky top-[56px] z-10 bg-background/95 backdrop-blur border-b border-border max-w-2xl mx-auto">
          <div class="flex px-4">
            <button
              v-for="t in ([['concerts', 'Concerts'], ['artists', 'Artists'], ['book', 'Book']] as const)" :key="t[0]"
              class="flex-1 h-11 text-sm font-bold border-b-2 -mb-px transition-colors font-sans"
              :class="tab === t[0] ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'"
              @click="tab = t[0]"
            >{{ t[1] }}</button>
          </div>
        </div>

        <div class="max-w-2xl mx-auto px-4">
          <!-- ── Concerts tab ── -->
          <div v-if="tab === 'concerts'">
            <!-- City filter -->
            <div v-if="cities.length > 2" class="mt-4 flex gap-1.5 overflow-x-auto pb-1 font-sans">
              <button
                v-for="c in cities" :key="c"
                class="shrink-0 h-8 px-3 rounded-full text-xs font-bold border transition-colors"
                :class="cityFilter === c ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground'"
                @click="cityFilter = c"
              ><MapPin v-if="c !== 'All'" class="inline w-3 h-3 -mt-0.5" /> {{ c }}</button>
            </div>

            <div v-if="eventsPending" class="mt-8 text-center">
              <div class="inline-block w-6 h-6 rounded-full border-2 animate-spin" style="border-color:color-mix(in srgb, var(--wd-red-600) 20%, transparent); border-top-color:var(--wd-red-600);" />
            </div>
            <template v-else>
              <ul v-if="filteredEvents.length" class="mt-4 divide-y divide-border font-sans">
                <li v-for="e in filteredEvents" :key="e.id" class="py-3 flex items-center gap-3">
                  <div class="w-12 text-center shrink-0">
                    <p class="text-[10px] uppercase font-bold text-secondary">{{ new Date(e.startDate).toLocaleDateString(undefined, { weekday: 'short' }) }}</p>
                    <p class="font-display text-base leading-none">{{ new Date(e.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }}</p>
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-bold">{{ e.name }}</p>
                    <p class="text-xs text-muted-foreground truncate">{{ e.venueName || '' }}{{ e.venueName && e.city ? ' · ' : '' }}{{ e.city || '' }}</p>
                  </div>
                  <NuxtLink :to="eventPath(e)" class="shrink-0 h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1">
                    <Ticket class="w-3.5 h-3.5" /> Tickets
                  </NuxtLink>
                </li>
              </ul>
              <div v-else class="mt-6 text-center text-sm text-muted-foreground font-sans">
                {{ cityFilter === 'All' ? 'No upcoming events yet.' : `No shows in ${cityFilter} yet.` }}
              </div>
            </template>

            <!-- Follow prompt -->
            <div class="mt-5 rounded-2xl bg-muted/60 p-4 flex items-start gap-3 font-sans">
              <Bell class="w-5 h-5 text-primary shrink-0" />
              <div class="text-xs">
                <p class="font-bold text-sm">Not in your city?</p>
                <p class="text-muted-foreground">Follow {{ profile.name }} and we'll tell you when they announce shows near you.</p>
              </div>
            </div>
          </div>

          <!-- ── Artists tab ── -->
          <div v-else-if="tab === 'artists'">
            <div v-if="rosterPending" class="mt-8 text-center">
              <div class="inline-block w-6 h-6 rounded-full border-2 animate-spin" style="border-color:color-mix(in srgb, var(--wd-red-600) 20%, transparent); border-top-color:var(--wd-red-600);" />
            </div>
            <template v-else>
              <ul v-if="roster.length" class="mt-4 grid grid-cols-2 gap-3 font-sans">
                <li v-for="a in roster" :key="a.username">
                  <button class="w-full text-left rounded-2xl border border-border overflow-hidden" @click="viewArtist(a)">
                    <div class="aspect-square overflow-hidden relative" style="background:linear-gradient(135deg,var(--wd-red-600),var(--wd-orange-500))">
                      <img v-if="a.photo" :src="a.photo" :alt="a.name" class="w-full h-full object-cover object-top">
                      <div v-else class="w-full h-full flex items-center justify-center text-white font-display text-3xl">{{ initials(a.name) }}</div>
                    </div>
                    <div class="p-2.5">
                      <p class="text-sm font-bold leading-tight line-clamp-2">{{ a.name }}</p>
                      <DanceStyleChips v-if="a.styles?.length" :styles="a.styles" :max="2" class="mt-1" />
                    </div>
                  </button>
                </li>
              </ul>
              <div v-else class="mt-6 text-center text-sm text-muted-foreground font-sans">
                <p>No artists in the roster yet.</p>
                <p v-if="canManage" class="mt-1">Add artists to your network from the <NuxtLink :to="`/business/network/${profile.username}`" class="font-bold text-primary underline">business panel</NuxtLink>.</p>
              </div>
            </template>
          </div>

          <!-- ── Book tab ── -->
          <div v-else>
            <!-- Step indicator -->
            <div v-if="!bookDone" class="mt-4 flex items-center gap-1.5 text-[11px] font-bold font-sans">
              <span class="rounded-full px-2.5 py-1" :class="bookStep >= 0 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'">1 · Artist</span>
              <span class="rounded-full px-2.5 py-1" :class="bookStep >= 1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'">2 · Details</span>
            </div>

            <!-- Step 0: pick artist -->
            <div v-if="bookStep === 0 && !bookDone" class="mt-4 font-sans">
              <p class="font-display text-xl">Who do you want to book?</p>
              <p class="text-xs text-muted-foreground mt-1">For organisers, festivals and venues. {{ profile.name }} replies directly.</p>
              <ul v-if="roster.length" class="mt-3 grid gap-2">
                <li v-for="a in roster" :key="a.username">
                  <button class="w-full rounded-xl border border-border p-3 flex items-center gap-3 text-left hover:border-primary/40" @click="startBooking(a)">
                    <div class="w-10 h-10 rounded-full overflow-hidden shrink-0" style="background:linear-gradient(135deg,var(--wd-red-600),var(--wd-orange-500))">
                      <img v-if="a.photo" :src="a.photo" :alt="a.name" class="w-full h-full object-cover object-top">
                      <div v-else class="w-full h-full flex items-center justify-center text-white font-bold text-xs">{{ initials(a.name) }}</div>
                    </div>
                    <span class="flex-1 text-sm font-bold">{{ a.name }}</span>
                    <ChevronRight class="w-4 h-4 text-muted-foreground" />
                  </button>
                </li>
              </ul>
              <p v-else class="mt-3 text-sm text-muted-foreground italic">No artists in the roster yet.</p>
              <button class="mt-3 w-full rounded-xl border border-border p-3 flex items-center gap-3 text-left hover:border-primary/40" @click="bookArtist = null; bookStep = 1">
                <div class="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0"><MessageCircle class="w-4 h-4 text-muted-foreground" /></div>
                <span class="flex-1 text-sm font-bold">General inquiry</span>
                <ChevronRight class="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <!-- Step 1: details -->
            <div v-else-if="bookStep === 1 && !bookDone" class="mt-4 font-sans">
              <p class="font-display text-xl">{{ bookArtist ? `${bookArtist.name} in your city` : 'Tell us about your event' }}</p>
              <div class="mt-3 grid gap-3 text-sm">
                <label class="grid gap-1"><span class="text-xs font-bold text-muted-foreground">City</span><input v-model="bookForm.city" class="h-10 rounded-xl border border-border px-3 bg-background" placeholder="e.g. Munich"></label>
                <label class="grid gap-1"><span class="text-xs font-bold text-muted-foreground">When</span><input v-model="bookForm.month" class="h-10 rounded-xl border border-border px-3 bg-background" placeholder="e.g. March 2027"></label>
                <div class="grid gap-1">
                  <span class="text-xs font-bold text-muted-foreground">Expected audience</span>
                  <div class="flex flex-wrap gap-1.5">
                    <button v-for="sz in ['< 200', '200–400', '400–800', '800+']" :key="sz" class="h-8 px-3 rounded-full border text-xs font-bold" :class="bookForm.size === sz ? 'bg-foreground text-background border-foreground' : 'border-border'" @click="bookForm.size = sz">{{ sz }}</button>
                  </div>
                </div>
                <label class="grid gap-1"><span class="text-xs font-bold text-muted-foreground">Budget (optional)</span><input v-model="bookForm.budget" placeholder="e.g. €3,000–5,000" class="h-10 rounded-xl border border-border px-3 bg-background"></label>
                <label class="grid gap-1"><span class="text-xs font-bold text-muted-foreground">Your name</span><input v-model="bookForm.name" class="h-10 rounded-xl border border-border px-3 bg-background"></label>
                <label class="grid gap-1"><span class="text-xs font-bold text-muted-foreground">Email</span><input v-model="bookForm.email" type="email" class="h-10 rounded-xl border border-border px-3 bg-background"></label>
                <label class="grid gap-1"><span class="text-xs font-bold text-muted-foreground">Message</span><textarea v-model="bookForm.message" rows="3" class="rounded-xl border border-border px-3 py-2 bg-background" placeholder="Anything else they should know"></textarea></label>
              </div>
              <p v-if="bookErr" class="mt-2 text-sm font-bold text-primary">{{ bookErr }}</p>
              <div class="mt-4 flex gap-2">
                <button class="h-10 px-4 rounded-full border border-border text-sm font-bold" @click="bookStep = 0">Back</button>
                <button class="flex-1 h-10 rounded-full bg-primary text-primary-foreground text-sm font-bold inline-flex items-center justify-center gap-1.5" :disabled="bookBusy" @click="submitBooking"><Send class="w-4 h-4" /> {{ bookBusy ? 'Sending…' : `Send to ${profile.name}` }}</button>
              </div>
            </div>

            <!-- Sent confirmation -->
            <div v-if="bookDone" class="mt-6 text-center font-sans">
              <div class="w-14 h-14 mx-auto rounded-full bg-wd-green-600 text-white inline-flex items-center justify-center"><Check class="w-7 h-7" /></div>
              <p class="mt-3 font-display text-2xl">Request sent</p>
              <p class="mt-1 text-sm text-muted-foreground">{{ profile.name }} will get back to you at {{ bookForm.email }}.</p>
              <div class="mt-4 rounded-2xl bg-muted/60 p-4 text-left text-xs">
                <p class="font-bold text-sm flex items-center gap-1.5"><Sparkles class="w-4 h-4 text-secondary" /> What happens next</p>
                <ul class="mt-2 space-y-1 text-muted-foreground">
                  <li>{{ profile.name }} reviews your request and replies by email</li>
                  <li v-if="bookArtist">Once confirmed, the event page is created automatically</li>
                  <li v-if="bookArtist">Fans following {{ bookArtist.name.split(' ')[0] }} near {{ bookForm.city || 'your city' }} get notified</li>
                </ul>
              </div>
              <button class="mt-4 text-xs font-bold text-primary underline" @click="resetBooking">Book another artist</button>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
