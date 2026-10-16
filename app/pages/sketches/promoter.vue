<script setup lang="ts">
/**
 * Sketch: a promoter's page that beats their Linktree.
 *
 * Real case: Hummo Productions (Barcelona) sends fans to linktr.ee/hummopro —
 * ten flat links (a 6-city Kelvis Ochoa tour on Fourvenues, four Jamboree
 * shows, two broken socials). Their WeDance page shows "No upcoming events".
 * The goal: send them https://2026.wedance.vip/@hummoproductions and they
 * switch on the spot.
 *
 * Three directions, each with a fan view (what the IG-bio visitor sees) and
 * a promoter view (what Hummo gets that Linktree can't give):
 *   A — Tour-first: next date + grouped tour, roster below
 *   B — Roster-first: artists are the page, each with dates + "Book"
 *   C — Recommended: tabs (Concerts · Artists · Book) + promoter dashboard
 *
 * Event data is copied from the live Linktree on 2026-10-16. Jamboree dates
 * weren't on the Linktree, so they show "Dates on Jamboree". Every number in
 * the promoter view is an example, labelled as such.
 */
import {
  MapPin, Ticket, Calendar, Send, Heart, Instagram, Facebook, Youtube, Music2,
  ChevronRight, ChevronLeft, Check, BarChart3, Image as ImageIcon, RefreshCw,
  Users, Building2, Sparkles, Bell, MessageCircle, Route,
} from 'lucide-vue-next'

definePageMeta({ layout: false })
useHead({ title: 'WeDance — Promoter page sketch', meta: [{ name: 'robots', content: 'noindex' }] })

type Variant = 'A' | 'B' | 'C'
const VARIANTS: { id: Variant, name: string, idea: string, good: string, cost: string }[] = [
  {
    id: 'A',
    name: 'Tour-first',
    idea: 'The next concert is the hero. Tour dates are grouped into one card with a route line, so 6 Kelvis links become 1. Other shows and the artist roster follow.',
    good: 'Closest to what fans come from Instagram for: "when and where, give me a ticket". An easy switch from Linktree, because it does the same job, better.',
    cost: 'Booking artists is buried at the bottom. It sells tickets but not Hummo\'s management business.',
  },
  {
    id: 'B',
    name: 'Roster-first',
    idea: 'The page is an agency: each artist is a card with their next dates and a "Book" button. Tap an artist → their own page with dates and a booking request.',
    good: 'Sells the business ("Shows, Management & Booking"), not just tickets. Organizers land straight on what they can book.',
    cost: 'Fans have to tap twice to find a ticket. Needs the answer to "do they manage these artists or only promote them?"',
  },
  {
    id: 'C',
    name: 'Recommended: tabs + promoter view',
    idea: 'Concerts · Artists · Book. Fans default to Concerts (with a city filter), organizers get a clear Book tab that goes from artist to date to venue. Switch to "Promoter view" to see what Hummo gets.',
    good: 'Serves both audiences without making either wait. The promoter view (stats, auto-flyers, Fourvenues sync) is the part Linktree can\'t copy.',
    cost: 'More to build: tabs, a booking flow, a sync, and a dashboard. Start with Concerts + Artists and add Book once the first organizer asks.',
  },
]
const variant = ref<Variant>('C')
const current = computed(() => VARIANTS.find(v => v.id === variant.value)!)
const view = ref<'fan' | 'promoter'>('fan')

// ── Data (from linktr.ee/hummopro, 2026-10-16) ────────────────────────────
const LOGO = 'https://res.cloudinary.com/djumxevsm/image/upload/v1791999324/wedance-2026/profiles/gl44m6jwjs6jr7jrx68n.jpg'

interface Artist { id: string, name: string, lineup: string, tags: string[], hue: string }
const ARTISTS: Artist[] = [
  { id: 'kelvis', name: 'Kelvis Ochoa', lineup: 'Singer-songwriter · Spain tour Nov 2026', tags: ['Cuban', 'Trova', 'Live band'], hue: 'from-wd-red-600 to-wd-orange-500' },
  { id: 'joma', name: 'Dúo JOMA', lineup: 'Magela (vocals) · José (guitar, vocals)', tags: ['Cuban', 'Duo'], hue: 'from-wd-amber-500 to-wd-orange-500' },
  { id: 'joya', name: 'Gastón Joya & The New Cuban Trio', lineup: 'Gastón Joya (bass) · Miguel "Wiwi" García (piano) · Frank Durán (drums)', tags: ['Cuban jazz', 'Trio'], hue: 'from-wd-cyan-600 to-wd-green-600' },
  { id: 'habana', name: 'Habana Abierta', lineup: 'Alejandro Gutiérrez · Vanito Brown · José Luis Medina · Roberto Carcasés · José Atero', tags: ['Cuban', 'Band'], hue: 'from-wd-brown-700 to-wd-red-600' },
  { id: 'sarduy', name: 'Carlos Sarduy Trio', lineup: 'Carlos Sarduy (trumpet, congas, keys, vocals) · Frank Durand (drums)', tags: ['Cuban jazz', 'Trio'], hue: 'from-wd-green-600 to-wd-cyan-600' },
]
const artist = (id: string) => ARTISTS.find(a => a.id === id)!

interface Show { id: string, artistId: string, city: string, place: string, date?: string, dow?: string, vendor: 'Fourvenues' | 'Jamboree', note?: string }
const SHOWS: Show[] = [
  { id: 'k1', artistId: 'kelvis', city: 'Jávea', place: 'Only show in the Valencia region', date: '7 Nov', dow: 'Sat', vendor: 'Fourvenues' },
  { id: 'k2', artistId: 'kelvis', city: 'Madrid', place: 'Madrid', date: '8 Nov', dow: 'Sun', vendor: 'Fourvenues' },
  { id: 'k3', artistId: 'kelvis', city: 'Barcelona', place: "L'Hospitalet de Llobregat", date: '13 Nov', dow: 'Fri', vendor: 'Fourvenues' },
  { id: 'k4', artistId: 'kelvis', city: 'Gran Canaria', place: 'San Bartolomé de Tirajana', date: '14 Nov', dow: 'Sat', vendor: 'Fourvenues' },
  { id: 'k5', artistId: 'kelvis', city: 'Tenerife', place: 'San Cristóbal de La Laguna', date: '15 Nov', dow: 'Sun', vendor: 'Fourvenues' },
  { id: 'k6', artistId: 'kelvis', city: 'Málaga', place: 'Málaga', date: '20 Nov', dow: 'Fri', vendor: 'Fourvenues' },
  { id: 'j1', artistId: 'joma', city: 'Barcelona', place: 'Jamboree', vendor: 'Jamboree' },
  { id: 'j2', artistId: 'joya', city: 'Barcelona', place: 'Jamboree', vendor: 'Jamboree' },
  { id: 'j3', artistId: 'habana', city: 'Barcelona', place: 'Jamboree', vendor: 'Jamboree' },
  { id: 'j4', artistId: 'sarduy', city: 'Barcelona', place: 'Jamboree', vendor: 'Jamboree' },
]
const tour = SHOWS.filter(s => s.artistId === 'kelvis')
const clubShows = SHOWS.filter(s => s.artistId !== 'kelvis')
const showsOf = (id: string) => SHOWS.filter(s => s.artistId === id)
const CITIES = ['All', ...new Set(SHOWS.map(s => s.city))]
const cityFilter = ref('All')
const filteredTour = computed(() => tour.filter(s => cityFilter.value === 'All' || s.city === cityFilter.value))
const filteredClub = computed(() => clubShows.filter(s => cityFilter.value === 'All' || s.city === cityFilter.value))

const SOCIALS = [
  { icon: Instagram, label: 'Instagram' },
  { icon: Music2, label: 'TikTok' },
  { icon: Youtube, label: 'YouTube' },
  { icon: Facebook, label: 'Facebook' },
  { icon: MessageCircle, label: 'WhatsApp' },
]

const SHORT: Record<string, string> = { 'Kelvis Ochoa': 'KO', 'Dúo JOMA': 'JOMA', 'Gastón Joya & The New Cuban Trio': 'GJ', 'Habana Abierta': 'HA', 'Carlos Sarduy Trio': 'CS' }
const initials = (n: string) => SHORT[n] ?? n.slice(0, 2).toUpperCase()

// ── Fan interactions ──────────────────────────────────────────────────────
const followed = ref<Set<string>>(new Set())
function toggleFollow(id: string) {
  const s = new Set(followed.value)
  s.has(id) ? s.delete(id) : s.add(id)
  followed.value = s
}
const planned = ref<Set<string>>(new Set())
function togglePlan(id: string) {
  const s = new Set(planned.value)
  s.has(id) ? s.delete(id) : s.add(id)
  planned.value = s
}

// ── Navigation inside the phone ───────────────────────────────────────────
const tab = ref<'concerts' | 'artists' | 'book'>('concerts')
const openArtist = ref<string | null>(null)

// ── Booking flow (organizer) ──────────────────────────────────────────────
const bookStep = ref(0) // 0 artist · 1 when/where · 2 venue · 3 sent
const book = reactive({ artistId: '', city: 'Munich', month: 'March 2027', size: '200–400', budget: '' })
const VENUES = [
  { name: 'Club with stage', cap: '350', note: 'Has PA + backline' },
  { name: 'Latin bar, back room', cap: '180', note: 'Friday nights free' },
  { name: 'Concert hall', cap: '600', note: 'Seated or standing' },
]
const pickedVenue = ref<string | null>(null)
function startBooking(id: string) {
  book.artistId = id
  bookStep.value = 1
  openArtist.value = null
  tab.value = 'book'
}
function resetAll() {
  tab.value = 'concerts'
  openArtist.value = null
  bookStep.value = 0
  book.artistId = ''
  pickedVenue.value = null
  cityFilter.value = 'All'
  followed.value = new Set()
  planned.value = new Set()
}
watch(variant, resetAll)

// ── Promoter view (example numbers) ───────────────────────────────────────
const STATS = [
  { city: 'Madrid', clicks: 412, plans: 38 },
  { city: 'Barcelona', clicks: 356, plans: 41 },
  { city: 'Málaga', clicks: 188, plans: 12 },
  { city: 'Tenerife', clicks: 141, plans: 9 },
  { city: 'Gran Canaria', clicks: 97, plans: 6 },
  { city: 'Jávea', clicks: 64, plans: 4 },
]
const maxClicks = Math.max(...STATS.map(s => s.clicks))
</script>

<template>
  <div class="min-h-screen bg-muted/40 text-foreground">
    <!-- Sketch controls -->
    <div class="sticky top-0 z-[60] border-b border-border bg-card/95 backdrop-blur">
      <div class="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
        <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">Promoter page · Hummo</span>
        <div class="flex rounded-full border border-border p-0.5 bg-background">
          <button
            v-for="v in VARIANTS" :key="v.id"
            class="px-3 h-8 rounded-full text-sm font-bold transition-colors"
            :class="variant === v.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
            @click="variant = v.id"
          >{{ v.id }}</button>
        </div>
        <div class="flex rounded-full border border-border p-0.5 bg-background">
          <button
            v-for="m in (['fan', 'promoter'] as const)" :key="m"
            class="px-3 h-8 rounded-full text-xs font-bold transition-colors"
            :class="view === m ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground'"
            @click="view = m"
          >{{ m === 'fan' ? 'Fan view' : 'Promoter view' }}</button>
        </div>
        <button class="ml-auto text-xs font-bold text-primary underline underline-offset-2" @click="resetAll">Reset</button>
      </div>
      <div class="max-w-6xl mx-auto px-4 pb-3 grid sm:grid-cols-[1.2fr_1fr_1fr] gap-3 text-xs">
        <p><span class="font-display text-base font-bold block">{{ current.id }} · {{ current.name }}</span>{{ current.idea }}</p>
        <p><span class="font-bold text-green-700 block uppercase tracking-wider">Good</span>{{ current.good }}</p>
        <p><span class="font-bold text-primary block uppercase tracking-wider">Cost</span>{{ current.cost }}</p>
      </div>
    </div>

    <div class="max-w-6xl mx-auto px-4 py-8 grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr] items-start justify-center">
      <!-- ═══════════════════ Phone ═══════════════════ -->
      <div class="mx-auto w-full max-w-[420px] rounded-[2rem] border-[6px] border-foreground/85 bg-background shadow-2xl overflow-hidden">
        <div class="h-[760px] overflow-y-auto font-sans">
          <!-- ── Promoter dashboard ── -->
          <template v-if="view === 'promoter'">
            <div class="p-5">
              <div class="flex items-center gap-3">
                <img :src="LOGO" alt="Hummo Productions" class="w-12 h-12 rounded-full object-cover">
                <div>
                  <p class="text-eyebrow uppercase tracking-[0.2em] font-bold text-secondary">Your page</p>
                  <p class="font-display text-xl leading-tight">Hummo Productions</p>
                </div>
              </div>
              <p class="mt-3 rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">Example numbers. This is a sketch.</p>

              <div class="mt-4 rounded-2xl border border-border p-4">
                <div class="flex items-center gap-2 text-sm font-bold"><RefreshCw class="w-4 h-4 text-wd-green-700" /> Kept up to date for you</div>
                <p class="mt-1 text-xs text-muted-foreground">We copy new dates from your Fourvenues page and Jamboree every morning. You change nothing. Tickets still sell on Fourvenues.</p>
                <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div class="rounded-xl bg-muted/60 p-2"><span class="font-bold">Fourvenues</span><br><span class="text-wd-green-700">6 dates · synced 07:00</span></div>
                  <div class="rounded-xl bg-muted/60 p-2"><span class="font-bold">Jamboree</span><br><span class="text-wd-green-700">4 shows · synced 07:00</span></div>
                </div>
              </div>

              <div class="mt-4 rounded-2xl border border-border p-4">
                <div class="flex items-center gap-2 text-sm font-bold"><BarChart3 class="w-4 h-4 text-primary" /> Ticket clicks · last 30 days</div>
                <ul class="mt-3 space-y-2">
                  <li v-for="s in STATS" :key="s.city" class="text-xs">
                    <div class="flex justify-between"><span class="font-semibold">{{ s.city }}</span><span class="text-muted-foreground">{{ s.clicks }} clicks · {{ s.plans }} going</span></div>
                    <div class="mt-1 h-1.5 rounded-full bg-muted"><div class="h-1.5 rounded-full bg-primary" :style="{ width: `${(s.clicks / maxClicks) * 100}%` }" /></div>
                  </li>
                </ul>
                <p class="mt-3 text-xs text-muted-foreground">Linktree charges for this. Here it's free.</p>
              </div>

              <div class="mt-4 rounded-2xl border border-border p-4">
                <div class="flex items-center gap-2 text-sm font-bold"><ImageIcon class="w-4 h-4 text-secondary" /> Stories ready to post</div>
                <p class="mt-1 text-xs text-muted-foreground">One Instagram story per tour stop, made automatically from each new date.</p>
                <div class="mt-3 flex gap-2 overflow-x-auto pb-1">
                  <div v-for="s in tour" :key="s.id" class="shrink-0 w-20 h-36 rounded-xl bg-gradient-to-br from-wd-red-600 to-wd-orange-500 text-white p-2 flex flex-col justify-end">
                    <span class="text-[9px] uppercase tracking-wider opacity-80">Kelvis Ochoa</span>
                    <span class="font-display text-sm leading-tight">{{ s.city }}</span>
                    <span class="text-[10px] font-bold">{{ s.dow }} {{ s.date }}</span>
                  </div>
                </div>
              </div>

              <div class="mt-4 rounded-2xl border border-border p-4">
                <div class="flex items-center gap-2 text-sm font-bold"><Send class="w-4 h-4 text-primary" /> Booking requests</div>
                <div class="mt-3 rounded-xl bg-muted/60 p-3 text-xs">
                  <p class="font-bold">Kelvis Ochoa · Munich · March 2027</p>
                  <p class="text-muted-foreground mt-0.5">Organizer, 200–400 people · picked venue: Club with stage (350)</p>
                  <div class="mt-2 flex gap-2">
                    <span class="rounded-full bg-primary text-primary-foreground px-3 py-1 font-bold">Reply</span>
                    <span class="rounded-full border border-border px-3 py-1 font-bold">Send fee sheet</span>
                  </div>
                </div>
              </div>

              <div class="mt-4 rounded-2xl border border-border p-4">
                <div class="flex items-center gap-2 text-sm font-bold"><Bell class="w-4 h-4 text-wd-cyan-700" /> Your audience</div>
                <p class="mt-1 text-xs text-muted-foreground">People who follow your artists get a message when a date is added in their city. Linktree has no way to reach them again.</p>
              </div>
            </div>
          </template>

          <!-- ── Fan view ── -->
          <template v-else>
            <!-- Artist sub-page (B and C) -->
            <template v-if="openArtist">
              <div class="p-5">
                <button class="inline-flex items-center gap-1 text-xs font-bold text-primary" @click="openArtist = null"><ChevronLeft class="w-3.5 h-3.5" /> Hummo Productions</button>
                <div class="mt-4 h-40 rounded-2xl bg-gradient-to-br flex items-end p-4 text-white" :class="artist(openArtist).hue">
                  <div>
                    <p class="text-eyebrow uppercase tracking-[0.2em] opacity-90">Artist · represented by Hummo</p>
                    <h2 class="font-display text-2xl leading-tight">{{ artist(openArtist).name }}</h2>
                  </div>
                </div>
                <p class="mt-3 text-sm text-muted-foreground">{{ artist(openArtist).lineup }}</p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <span v-for="t in artist(openArtist).tags" :key="t" class="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold">{{ t }}</span>
                </div>
                <div class="mt-4 flex gap-2">
                  <button class="flex-1 h-10 rounded-full bg-primary text-primary-foreground text-sm font-bold inline-flex items-center justify-center gap-1.5" @click="startBooking(openArtist)"><Send class="w-4 h-4" /> Book for your event</button>
                  <button class="h-10 px-4 rounded-full border text-sm font-bold inline-flex items-center gap-1.5" :class="followed.has(openArtist) ? 'bg-foreground text-background border-foreground' : 'border-border'" @click="toggleFollow(openArtist)">
                    <Heart class="w-4 h-4" :class="followed.has(openArtist) ? 'fill-current' : ''" /> {{ followed.has(openArtist) ? 'Following' : 'Follow' }}
                  </button>
                </div>
                <p v-if="followed.has(openArtist)" class="mt-2 text-xs text-wd-green-700">We'll tell you when {{ artist(openArtist).name.split(' ')[0] }} plays near you.</p>
                <h3 class="mt-6 font-display text-lg">Upcoming</h3>
                <ul class="mt-2 divide-y divide-border">
                  <li v-for="s in showsOf(openArtist)" :key="s.id" class="py-3 flex items-center gap-3">
                    <div class="w-12 text-center shrink-0">
                      <template v-if="s.date"><p class="text-[10px] uppercase font-bold text-secondary">{{ s.dow }}</p><p class="font-display text-lg leading-none">{{ s.date }}</p></template>
                      <Calendar v-else class="w-5 h-5 mx-auto text-muted-foreground" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="font-bold text-sm">{{ s.city }}</p>
                      <p class="text-xs text-muted-foreground truncate">{{ s.place }}<span v-if="!s.date"> · dates on Jamboree</span></p>
                    </div>
                    <span class="shrink-0 h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1"><Ticket class="w-3.5 h-3.5" /> Tickets</span>
                  </li>
                </ul>
              </div>
            </template>

            <template v-else>
              <!-- Header (shared) -->
              <div class="h-2 bg-gradient-to-r from-wd-red-600 to-wd-orange-500" />
              <div class="px-5 pt-5 text-center">
                <img :src="LOGO" alt="Hummo Productions" class="w-24 h-24 rounded-full object-cover mx-auto border-[3px] border-primary/20">
                <p class="mt-3 text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">Promoter · Barcelona</p>
                <h1 class="font-display text-3xl leading-tight">Hummo Productions</h1>
                <p class="mt-1 text-sm text-muted-foreground">20 years of cultural promotion. Shows, management and booking.</p>
                <div class="mt-3 flex justify-center gap-2">
                  <span v-for="s in SOCIALS" :key="s.label" class="w-9 h-9 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center" :title="s.label"><component :is="s.icon" class="w-4 h-4" /></span>
                </div>
              </div>

              <!-- ═══ A · Tour-first ═══ -->
              <div v-if="variant === 'A'" class="px-5 pb-8">
                <!-- Next up hero -->
                <div class="mt-5 rounded-2xl bg-gradient-to-br from-wd-red-600 to-wd-orange-500 text-white p-4">
                  <p class="text-eyebrow uppercase tracking-[0.2em] opacity-90">Next up · Sat 7 Nov</p>
                  <p class="font-display text-2xl leading-tight mt-1">Kelvis Ochoa in Jávea</p>
                  <p class="text-xs opacity-90">Only show in the Valencia region</p>
                  <div class="mt-3 flex gap-2">
                    <span class="h-9 px-4 rounded-full bg-white text-wd-red-800 text-sm font-bold inline-flex items-center gap-1.5"><Ticket class="w-4 h-4" /> Tickets</span>
                    <button class="h-9 px-4 rounded-full border border-white/60 text-sm font-bold" @click="togglePlan('k1')">{{ planned.has('k1') ? '✓ In my plan' : 'I\'m going' }}</button>
                  </div>
                </div>

                <!-- Tour card -->
                <div class="mt-5 rounded-2xl border border-border p-4">
                  <div class="flex items-center gap-2">
                    <Route class="w-4 h-4 text-primary" />
                    <p class="font-display text-lg">Kelvis Ochoa · Spain tour</p>
                  </div>
                  <p class="text-xs text-muted-foreground">6 cities · 7–20 Nov 2026</p>
                  <ol class="mt-3 relative border-l-2 border-primary/30 ml-2 space-y-3">
                    <li v-for="s in tour" :key="s.id" class="pl-4 relative">
                      <span class="absolute -left-[7px] top-1.5 w-3 h-3 rounded-full bg-primary" />
                      <div class="flex items-center gap-2">
                        <div class="flex-1 min-w-0">
                          <p class="text-sm font-bold">{{ s.dow }} {{ s.date }} · {{ s.city }}</p>
                          <p class="text-xs text-muted-foreground truncate">{{ s.place }}</p>
                        </div>
                        <span class="shrink-0 h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1"><Ticket class="w-3.5 h-3.5" /> Tickets</span>
                      </div>
                    </li>
                  </ol>
                </div>

                <!-- Club shows -->
                <h3 class="mt-6 font-display text-lg">At Jamboree, Barcelona</h3>
                <ul class="mt-2 grid gap-2">
                  <li v-for="s in clubShows" :key="s.id" class="rounded-xl border border-border p-3 flex items-center gap-3">
                    <div class="w-10 h-10 rounded-full bg-gradient-to-br text-white font-bold text-xs inline-flex items-center justify-center shrink-0" :class="artist(s.artistId).hue">{{ initials(artist(s.artistId).name) }}</div>
                    <div class="flex-1 min-w-0"><p class="text-sm font-bold truncate">{{ artist(s.artistId).name }}</p><p class="text-xs text-muted-foreground">Dates on Jamboree</p></div>
                    <ChevronRight class="w-4 h-4 text-muted-foreground" />
                  </li>
                </ul>

                <!-- Roster strip -->
                <h3 class="mt-6 font-display text-lg">Book our artists</h3>
                <div class="mt-2 flex gap-3 overflow-x-auto pb-2">
                  <div v-for="a in ARTISTS" :key="a.id" class="shrink-0 w-28 text-center">
                    <div class="w-20 h-20 mx-auto rounded-full bg-gradient-to-br text-white font-display text-xl inline-flex items-center justify-center" :class="a.hue">{{ initials(a.name) }}</div>
                    <p class="mt-1 text-xs font-bold leading-tight">{{ a.name }}</p>
                  </div>
                </div>
                <button class="mt-2 w-full h-10 rounded-full border border-primary text-primary text-sm font-bold">Ask about booking</button>
              </div>

              <!-- ═══ B · Roster-first ═══ -->
              <div v-else-if="variant === 'B'" class="px-5 pb-8">
                <div class="mt-5 flex items-center justify-between">
                  <h3 class="font-display text-lg">Our artists</h3>
                  <span class="text-xs text-muted-foreground">{{ ARTISTS.length }} acts · {{ SHOWS.length }} upcoming shows</span>
                </div>
                <ul class="mt-3 grid gap-3">
                  <li v-for="a in ARTISTS" :key="a.id" class="rounded-2xl border border-border overflow-hidden">
                    <button class="w-full text-left" @click="openArtist = a.id">
                      <div class="h-20 bg-gradient-to-br flex items-end p-3 text-white" :class="a.hue">
                        <p class="font-display text-xl leading-tight">{{ a.name }}</p>
                      </div>
                      <div class="p-3">
                        <p class="text-xs text-muted-foreground line-clamp-1">{{ a.lineup }}</p>
                        <p class="mt-1 text-xs font-semibold">
                          <Calendar class="inline w-3.5 h-3.5 -mt-0.5 text-secondary" />
                          <template v-if="showsOf(a.id).length > 1">{{ showsOf(a.id).length }} dates · {{ showsOf(a.id).map(s => s.city).join(', ') }}</template>
                          <template v-else>{{ showsOf(a.id)[0]?.place }}, {{ showsOf(a.id)[0]?.city }}</template>
                        </p>
                      </div>
                    </button>
                    <div class="px-3 pb-3 flex gap-2">
                      <button class="flex-1 h-9 rounded-full border border-border text-xs font-bold inline-flex items-center justify-center gap-1" @click="openArtist = a.id"><Ticket class="w-3.5 h-3.5" /> Dates & tickets</button>
                      <button class="flex-1 h-9 rounded-full bg-primary text-primary-foreground text-xs font-bold inline-flex items-center justify-center gap-1" @click="startBooking(a.id)"><Send class="w-3.5 h-3.5" /> Book</button>
                    </div>
                  </li>
                </ul>
              </div>

              <!-- ═══ C · Tabs ═══ -->
              <div v-else class="pb-8">
                <div class="sticky top-0 z-10 mt-4 bg-background/95 backdrop-blur border-b border-border px-5">
                  <div class="flex">
                    <button
                      v-for="t in ([['concerts', 'Concerts'], ['artists', 'Artists'], ['book', 'Book']] as const)" :key="t[0]"
                      class="flex-1 h-11 text-sm font-bold border-b-2 -mb-px transition-colors"
                      :class="tab === t[0] ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'"
                      @click="tab = t[0]"
                    >{{ t[1] }}</button>
                  </div>
                </div>

                <!-- Concerts -->
                <div v-if="tab === 'concerts'" class="px-5">
                  <div class="mt-4 flex gap-1.5 overflow-x-auto pb-1">
                    <button
                      v-for="c in CITIES" :key="c"
                      class="shrink-0 h-8 px-3 rounded-full text-xs font-bold border transition-colors"
                      :class="cityFilter === c ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground'"
                      @click="cityFilter = c"
                    ><MapPin v-if="c !== 'All'" class="inline w-3 h-3 -mt-0.5" /> {{ c }}</button>
                  </div>

                  <div v-if="filteredTour.length" class="mt-4 rounded-2xl border border-border overflow-hidden">
                    <div class="bg-gradient-to-br from-wd-red-600 to-wd-orange-500 text-white p-4">
                      <p class="text-eyebrow uppercase tracking-[0.2em] opacity-90">Tour · 6 cities · 7–20 Nov</p>
                      <p class="font-display text-2xl leading-tight">Kelvis Ochoa</p>
                    </div>
                    <ul class="divide-y divide-border">
                      <li v-for="s in filteredTour" :key="s.id" class="px-4 py-3 flex items-center gap-3">
                        <div class="w-11 text-center shrink-0"><p class="text-[10px] uppercase font-bold text-secondary">{{ s.dow }}</p><p class="font-display text-base leading-none">{{ s.date }}</p></div>
                        <div class="flex-1 min-w-0"><p class="text-sm font-bold">{{ s.city }}</p><p class="text-xs text-muted-foreground truncate">{{ s.place }}</p></div>
                        <button class="shrink-0 w-8 h-8 rounded-full border inline-flex items-center justify-center" :class="planned.has(s.id) ? 'bg-wd-green-600 text-white border-wd-green-600' : 'border-border text-muted-foreground'" :title="planned.has(s.id) ? 'In your plan' : 'I\'m going'" @click="togglePlan(s.id)"><Check class="w-4 h-4" /></button>
                        <span class="shrink-0 h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1"><Ticket class="w-3.5 h-3.5" /> Tickets</span>
                      </li>
                    </ul>
                  </div>

                  <div v-if="filteredClub.length" class="mt-4">
                    <p class="text-eyebrow uppercase tracking-[0.2em] font-bold text-secondary">Jamboree · Barcelona</p>
                    <ul class="mt-2 grid gap-2">
                      <li v-for="s in filteredClub" :key="s.id" class="rounded-xl border border-border p-3 flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-br text-white font-bold text-xs inline-flex items-center justify-center shrink-0" :class="artist(s.artistId).hue">{{ initials(artist(s.artistId).name) }}</div>
                        <button class="flex-1 min-w-0 text-left" @click="openArtist = s.artistId"><p class="text-sm font-bold truncate">{{ artist(s.artistId).name }}</p><p class="text-xs text-muted-foreground">Dates on Jamboree</p></button>
                        <span class="shrink-0 h-8 px-3 rounded-full bg-primary text-primary-foreground text-xs font-bold inline-flex items-center gap-1"><Ticket class="w-3.5 h-3.5" /> Tickets</span>
                      </li>
                    </ul>
                  </div>

                  <div v-if="!filteredTour.length && !filteredClub.length" class="mt-6 text-center text-sm text-muted-foreground">No shows in {{ cityFilter }} yet.</div>

                  <div class="mt-5 rounded-2xl bg-muted/60 p-4 flex items-start gap-3">
                    <Bell class="w-5 h-5 text-primary shrink-0" />
                    <div class="text-xs"><p class="font-bold text-sm">Not in your city?</p><p class="text-muted-foreground">Follow an artist and we'll tell you when they come near you.</p></div>
                  </div>
                </div>

                <!-- Artists -->
                <div v-else-if="tab === 'artists'" class="px-5">
                  <ul class="mt-4 grid grid-cols-2 gap-3">
                    <li v-for="a in ARTISTS" :key="a.id">
                      <button class="w-full text-left rounded-2xl border border-border overflow-hidden" @click="openArtist = a.id">
                        <div class="aspect-square bg-gradient-to-br text-white font-display text-3xl flex items-center justify-center" :class="a.hue">{{ initials(a.name) }}</div>
                        <div class="p-2.5">
                          <p class="text-sm font-bold leading-tight line-clamp-2">{{ a.name }}</p>
                          <p class="mt-1 text-[11px] text-muted-foreground">{{ showsOf(a.id).length }} upcoming</p>
                        </div>
                      </button>
                    </li>
                  </ul>
                </div>

                <!-- Book -->
                <div v-else class="px-5">
                  <!-- Step indicator -->
                  <div v-if="bookStep < 3" class="mt-4 flex items-center gap-1.5 text-[11px] font-bold">
                    <template v-for="(label, i) in ['Artist', 'When & where', 'Venue']" :key="label">
                      <span class="rounded-full px-2.5 py-1" :class="bookStep >= i ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'">{{ i + 1 }} · {{ label }}</span>
                    </template>
                  </div>

                  <!-- 0 · pick artist -->
                  <div v-if="bookStep === 0" class="mt-4">
                    <p class="font-display text-xl">Who do you want to book?</p>
                    <p class="text-xs text-muted-foreground mt-1">For organizers, festivals and venues. Hummo replies directly.</p>
                    <ul class="mt-3 grid gap-2">
                      <li v-for="a in ARTISTS" :key="a.id">
                        <button class="w-full rounded-xl border border-border p-3 flex items-center gap-3 text-left hover:border-primary/40" @click="startBooking(a.id)">
                          <div class="w-10 h-10 rounded-full bg-gradient-to-br text-white font-bold text-xs inline-flex items-center justify-center shrink-0" :class="a.hue">{{ initials(a.name) }}</div>
                          <span class="flex-1 text-sm font-bold">{{ a.name }}</span>
                          <ChevronRight class="w-4 h-4 text-muted-foreground" />
                        </button>
                      </li>
                    </ul>
                  </div>

                  <!-- 1 · when & where -->
                  <div v-else-if="bookStep === 1" class="mt-4">
                    <p class="font-display text-xl">{{ artist(book.artistId).name }} in your city</p>
                    <div class="mt-3 grid gap-3 text-sm">
                      <label class="grid gap-1"><span class="text-xs font-bold text-muted-foreground">City</span><input v-model="book.city" class="h-10 rounded-xl border border-border px-3 bg-background"></label>
                      <label class="grid gap-1"><span class="text-xs font-bold text-muted-foreground">When</span><input v-model="book.month" class="h-10 rounded-xl border border-border px-3 bg-background"></label>
                      <div class="grid gap-1">
                        <span class="text-xs font-bold text-muted-foreground">Expected audience</span>
                        <div class="flex flex-wrap gap-1.5">
                          <button v-for="sz in ['< 200', '200–400', '400–800', '800+']" :key="sz" class="h-8 px-3 rounded-full border text-xs font-bold" :class="book.size === sz ? 'bg-foreground text-background border-foreground' : 'border-border'" @click="book.size = sz">{{ sz }}</button>
                        </div>
                      </div>
                      <label class="grid gap-1"><span class="text-xs font-bold text-muted-foreground">Budget (optional)</span><input v-model="book.budget" placeholder="e.g. €3,000–5,000" class="h-10 rounded-xl border border-border px-3 bg-background"></label>
                    </div>
                    <div class="mt-4 flex gap-2">
                      <button class="h-10 px-4 rounded-full border border-border text-sm font-bold" @click="bookStep = 0">Back</button>
                      <button class="flex-1 h-10 rounded-full bg-primary text-primary-foreground text-sm font-bold" @click="bookStep = 2">Next: find a venue</button>
                    </div>
                  </div>

                  <!-- 2 · venue -->
                  <div v-else-if="bookStep === 2" class="mt-4">
                    <p class="font-display text-xl">Need a venue in {{ book.city }}?</p>
                    <p class="text-xs text-muted-foreground mt-1">Venues on WeDance that fit {{ book.size }} people. Optional. Skip if you have one.</p>
                    <ul class="mt-3 grid gap-2">
                      <li v-for="v in VENUES" :key="v.name">
                        <button class="w-full rounded-xl border p-3 flex items-center gap-3 text-left" :class="pickedVenue === v.name ? 'border-primary bg-primary/5' : 'border-border'" @click="pickedVenue = pickedVenue === v.name ? null : v.name">
                          <Building2 class="w-5 h-5 text-secondary shrink-0" />
                          <div class="flex-1"><p class="text-sm font-bold">{{ v.name }}</p><p class="text-xs text-muted-foreground">Up to {{ v.cap }} · {{ v.note }}</p></div>
                          <Check v-if="pickedVenue === v.name" class="w-4 h-4 text-primary" />
                        </button>
                      </li>
                    </ul>
                    <div class="mt-4 flex gap-2">
                      <button class="h-10 px-4 rounded-full border border-border text-sm font-bold" @click="bookStep = 1">Back</button>
                      <button class="flex-1 h-10 rounded-full bg-primary text-primary-foreground text-sm font-bold inline-flex items-center justify-center gap-1.5" @click="bookStep = 3"><Send class="w-4 h-4" /> Send request to Hummo</button>
                    </div>
                  </div>

                  <!-- 3 · sent -->
                  <div v-else class="mt-6 text-center">
                    <div class="w-14 h-14 mx-auto rounded-full bg-wd-green-600 text-white inline-flex items-center justify-center"><Check class="w-7 h-7" /></div>
                    <p class="mt-3 font-display text-2xl">Request sent</p>
                    <p class="mt-1 text-sm text-muted-foreground">Hummo gets {{ artist(book.artistId).name }} · {{ book.city }} · {{ book.month }} · {{ book.size }} people<span v-if="pickedVenue">, with {{ pickedVenue }} on hold</span>.</p>
                    <div class="mt-4 rounded-2xl bg-muted/60 p-4 text-left text-xs">
                      <p class="font-bold text-sm flex items-center gap-1.5"><Sparkles class="w-4 h-4 text-secondary" /> Once they say yes</p>
                      <ul class="mt-2 space-y-1 text-muted-foreground">
                        <li>• The event page is made for you, with tickets</li>
                        <li>• It shows on Hummo's and the artist's pages automatically</li>
                        <li>• Fans following {{ artist(book.artistId).name.split(' ')[0] }} near {{ book.city }} get a message</li>
                      </ul>
                    </div>
                    <button class="mt-4 text-xs font-bold text-primary underline" @click="bookStep = 0; book.artistId = ''; pickedVenue = null">Book another artist</button>
                  </div>
                </div>
              </div>
            </template>
          </template>
        </div>
      </div>

      <!-- ═══════════════════ Side notes ═══════════════════ -->
      <aside class="font-sans text-sm space-y-4 max-w-xl">
        <div class="rounded-2xl border border-border bg-card p-5">
          <p class="text-eyebrow uppercase tracking-[0.2em] font-bold text-secondary">Linktree today</p>
          <ul class="mt-2 space-y-1 text-muted-foreground text-xs">
            <li>• 10 flat links: 6 for the same tour, 4 for Jamboree</li>
            <li>• No dates on the Jamboree links, no map, no city filter</li>
            <li>• YouTube and TikTok links are broken (spaces in the URL)</li>
            <li>• No way to book an artist, no way to reach fans again</li>
            <li>• Click stats only on the paid plan</li>
          </ul>
        </div>
        <div class="rounded-2xl border border-border bg-card p-5">
          <p class="text-eyebrow uppercase tracking-[0.2em] font-bold text-primary">What they get here</p>
          <ul class="mt-2 space-y-1.5 text-xs">
            <li class="flex gap-2"><RefreshCw class="w-4 h-4 text-wd-green-700 shrink-0" /> Zero upkeep: dates are copied from Fourvenues and Jamboree daily. Tickets still sell there.</li>
            <li class="flex gap-2"><Route class="w-4 h-4 text-primary shrink-0" /> A tour reads as a tour, not 6 links.</li>
            <li class="flex gap-2"><Users class="w-4 h-4 text-secondary shrink-0" /> One page per artist, each bookable.</li>
            <li class="flex gap-2"><Building2 class="w-4 h-4 text-secondary shrink-0" /> Organizers go from artist to date to venue in one flow.</li>
            <li class="flex gap-2"><ImageIcon class="w-4 h-4 text-secondary shrink-0" /> A ready Instagram story for every new date.</li>
            <li class="flex gap-2"><BarChart3 class="w-4 h-4 text-primary shrink-0" /> Free clicks per city.</li>
          </ul>
        </div>
        <div class="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-xs text-amber-900">
          <p class="font-bold uppercase tracking-wider">Open questions</p>
          <ul class="mt-2 space-y-1">
            <li>• Does Hummo manage these artists, or only promote the shows? "Represented by" and "Book" depend on it.</li>
            <li>• Artist photos: we use none until Hummo sends them (no stock, no AI faces).</li>
            <li>• Jamboree dates weren't on the Linktree. The sync would read them from jamboreejazz.com.</li>
          </ul>
        </div>
      </aside>
    </div>
  </div>
</template>
