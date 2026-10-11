<script setup lang="ts">
/**
 * /@<handle> — the unified profile route (v4-style). Resolves, in order:
 *   1. a professional profile (venue / artist / organizer) → rich layout here
 *   2. a dancer (by username) → redirect to the existing /u/<handle> page
 *   3. neither → a graceful "not on WeDance yet" stub (no 404)
 *
 * Venue layout adapts to the booking model:
 *   - 'free'  → a community commons (e.g. the Pinakothek open-air spot): a drawn
 *     map, community guidelines, an elected moderator, the scheduled events, and
 *     a FREE "book a slot" flow (accept the guidelines).
 *   - 'commercial' → a rentable venue: bookable spaces with a request flow.
 */
import { eventLocalDate, eventLocalTime } from '#shared/utils/eventTime'
import { bookingRequestSchema } from '#shared/validation'
import { MapPin, Instagram, Youtube, Globe, Facebook, LayoutGrid, ArrowLeft, Check, Calendar, ScrollText, ShieldCheck, Trees, Plus } from 'lucide-vue-next'

definePageMeta({ layout: false })

const route = useRoute()
const { $trpc } = useNuxtApp()
const { dancerName } = useAuth()

const handle = computed(() => String(route.params.handle))

const pending = ref(true)
const data = ref<Awaited<ReturnType<typeof $trpc.entity.getByHandle.query>> | null>(null)
const schedule = ref<any[]>([])
const availability = ref<any[]>([])
// Dated public events (wedance.vip mirror) this profile hosts / runs / plays at.
const syncedEvents = ref<any[]>([])
const isStub = ref(false)

async function resolve() {
  pending.value = true
  isStub.value = false
  try {
    const pro = await $trpc.entity.getByHandle.query({ handle: handle.value })
    if (pro) {
      data.value = pro
      pending.value = false
      const [sched, avail, synced] = await Promise.all([
        $trpc.booking.scheduleForProfile.query({ profileId: pro.profile.id }).catch(() => []),
        $trpc.booking.availabilityForProfile.query({ profileId: pro.profile.id }).catch(() => []),
        $trpc.events.byProfile.query({
          username: pro.profile.username,
          ...(pro.profile.type === 'artist' ? { name: pro.profile.name } : {}),
        }).catch(() => []),
      ])
      schedule.value = sched as any[]
      availability.value = avail as any[]
      syncedEvents.value = synced as any[]
      return
    }
    try {
      await $trpc.profile.getByUsername.query({ username: handle.value })
      await navigateTo(`/u/${handle.value}`, { replace: true })
      return
    } catch { isStub.value = true }
  } catch { isStub.value = true }
  pending.value = false
}
onMounted(resolve)

const profile = computed(() => data.value?.profile ?? null)
const spaces = computed(() => data.value?.spaces ?? [])
const isFree = computed(() => profile.value?.bookingModel === 'free')
const spaceName = (id: string) => spaces.value.find((s: any) => s.id === id)?.name ?? 'Area'
// Schedule mapped to the shared EventSchedule card shape (area as location).
const v3TypeLabel: Record<string, string> = { Course: 'Class', Party: 'Party', Workshop: 'Workshop', Concert: 'Social', Show: 'Social' }
const scheduleCards = computed(() => [
  ...(schedule.value ?? []).map((ev: any) => ({ ...ev, location: spaceName(ev.spaceId), href: `/events/${ev.id}` })),
  ...syncedEvents.value.map((e: any) => ({
    id: e.id, title: e.name, eventType: v3TypeLabel[e.type] ?? e.type, styles: e.styles || [], artists: [],
    eventDate: eventLocalDate(e.startDate, e.timezone), startTime: eventLocalTime(e.startDate, e.timezone),
    endTime: e.endDate ? eventLocalTime(e.endDate, e.timezone) : undefined,
    location: e.venueUsername === profile.value?.username ? (e.organizerName || '') : (e.venueName || ''),
    href: `/events/${e.id}`,
  })),
])
// Busy schools have 100+ dated classes — show the next ones, expand on demand.
const scheduleLimit = ref(12)
const visibleScheduleCards = computed(() => [...scheduleCards.value]
  .sort((a: any, b: any) => `${a.eventDate ?? ''} ${a.startTime ?? ''}`.localeCompare(`${b.eventDate ?? ''} ${b.startTime ?? ''}`))
  .slice(0, scheduleLimit.value))
// v4-imported venues carry a Google Maps LINK in map_url, not a drawn map image.
const mapIsImage = computed(() => !!profile.value?.mapUrl && !/(maps\.google\.|google\.[a-z.]+\/maps|goo\.gl\/maps)/i.test(profile.value.mapUrl))
const directionsUrl = computed(() => {
  const p = profile.value
  if (!p) return ''
  if (p.mapUrl && !mapIsImage.value) return p.mapUrl
  return p.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}` : ''
})

const typeLabel: Record<string, string> = { venue: 'Venue', artist: 'Artist', organizer: 'Organizer' }
const socialIcon: Record<string, any> = { instagram: Instagram, youtube: Youtube, facebook: Facebook, website: Globe }
const langLabel: Record<string, string> = { en: 'English', es: 'Spanish', de: 'German', fr: 'French', pt: 'Portuguese', it: 'Italian', ru: 'Russian', hu: 'Hungarian', sl: 'Slovenian' }
const initials = computed(() => {
  const n = (profile.value?.name || '').trim()
  return n ? n.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') : '?'
})
function fmtDate(d: any) { if (!d) return 'Date TBD'; try { return new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) } catch { return String(d) } }

// --- Booking modal (a booking IS a scheduled event — collect enough info) ---
const EVENT_TYPES = ['Social', 'Party', 'Workshop', 'Class', 'Practica', 'Private']
const DANCE_STYLES = ['Salsa', 'Bachata', 'Kizomba', 'Zouk', 'Timba', 'Casino', 'Rueda', 'Afro']
const booking = reactive({
  open: false, spaceId: '', spaceName: '',
  title: '', eventType: 'Social', styles: [] as string[], artists: '', organizerHandle: '',
  email: '', name: '', eventDate: '', startTime: '', endTime: '',
  headcount: '' as string | number, message: '', terms: false, busy: false, err: '', done: false,
})
const bookingForm = reactive(useFormValidation(() => bookingRequestSchema({ free: isFree.value }), booking))
function openBooking(space: any) {
  bookingForm.reset()
  Object.assign(booking, {
    open: true, spaceId: space.id, spaceName: space.name,
    title: '', eventType: 'Social', styles: [], artists: '', organizerHandle: '',
    email: '', name: (dancerName.value as string) || '', eventDate: '', startTime: '', endTime: '',
    headcount: '', message: '', terms: false, err: '', done: false,
  })
}
function toggleBookingStyle(s: string) {
  const i = booking.styles.indexOf(s)
  if (i >= 0) booking.styles.splice(i, 1); else booking.styles.push(s)
}
// From the availability calendar: open the form pre-filled with the picked slot.
function onCalendarBook(slot: { spaceId: string; spaceName: string; date: string }) {
  openBooking({ id: slot.spaceId, name: slot.spaceName })
  booking.eventDate = slot.date
}
async function submitBooking() {
  booking.err = ''
  const result = bookingForm.validate()
  if (!result.success) return
  booking.busy = true
  try {
    const { terms, ...request } = result.data
    await $trpc.booking.request.mutate({ ...request, termsAccepted: terms })
    booking.done = true
    // CUJ: "Book a venue space" — request submitted.
    useTrack().track('booking_request_submitted', { space_id: booking.spaceId, event_type: booking.eventType, free: isFree.value })
    if (profile.value) { try { schedule.value = await $trpc.booking.scheduleForProfile.query({ profileId: profile.value.id }) } catch {} }
  } catch (e: any) { booking.err = e?.message || 'Could not send your request.' } finally { booking.busy = false }
}

useHead(() => ({
  title: profile.value ? `${profile.value.name} — WeDance` : 'WeDance',
}))
</script>

<template>
  <div class="min-h-screen" style="background:var(--wd-cream); color:var(--wd-brown-900); font-family:var(--wd-font-display);">
    <SiteHeader />

    <section v-if="pending" class="max-w-2xl mx-auto px-4 py-24 text-center">
      <div class="inline-block w-8 h-8 rounded-full border-2 animate-spin" style="border-color:color-mix(in srgb, var(--wd-red-600) 20%, transparent); border-top-color:var(--wd-red-600);" />
    </section>

    <section v-else-if="isStub" class="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 class="text-4xl" style="color:var(--wd-brown-900);">Not on WeDance yet</h1>
      <p class="mt-4 text-sm" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
        <span class="font-bold">@{{ handle }}</span> doesn't have a page here yet. Run this venue or organise here? Claim it.
      </p>
      <NuxtLink to="/for-events" class="inline-flex items-center gap-2 mt-6 rounded-full px-5 py-2.5 text-white text-sm font-bold uppercase tracking-wider" style="background:linear-gradient(135deg,var(--wd-red-600),var(--wd-orange-500));">Claim / list a space</NuxtLink>
      <div class="mt-4"><NuxtLink to="/cities" class="inline-flex items-center gap-1 text-xs font-bold" style="color:var(--wd-red-600); font-family:var(--wd-font-sans);"><ArrowLeft class="w-3 h-3" /> Browse cities</NuxtLink></div>
    </section>

    <template v-else-if="profile">
      <!-- Header -->
      <section class="max-w-2xl mx-auto px-4 pt-12 pb-6">
        <div class="rounded-2xl overflow-hidden bg-white border" style="border-color:color-mix(in srgb, var(--wd-red-600) 20%, transparent); box-shadow: 0 1px 0 color-mix(in srgb, var(--wd-red-600) 13.3%, transparent), 0 10px 28px rgba(59,31,18,0.06);">
          <div class="h-2" style="background:linear-gradient(135deg, var(--wd-red-600), var(--wd-orange-500));" />
          <div class="p-6 sm:p-8">
            <div class="flex items-start gap-5">
              <div class="shrink-0">
                <img v-if="profile.photo" :src="profile.photo" :alt="profile.name" class="w-20 h-20 rounded-full object-cover" style="border:2px solid color-mix(in srgb, var(--wd-red-600) 20%, transparent);">
                <div v-else class="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold text-white" style="background:linear-gradient(135deg,var(--wd-red-600),var(--wd-orange-500));">{{ initials }}</div>
              </div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] uppercase tracking-[0.3em] font-bold" style="color:var(--wd-amber-600); font-family:var(--wd-font-sans);">{{ typeLabel[profile.type] || 'Profile' }}</span>
                  <span v-if="profile.venueType === 'OpenAir'" class="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5" style="background:color-mix(in srgb, var(--wd-green-600) 9.4%, transparent); color:var(--wd-green-600); font-family:var(--wd-font-sans);"><Trees class="w-3 h-3" /> Open air</span>
                  <span v-if="isFree" class="text-[10px] font-bold uppercase tracking-wider rounded-full px-2 py-0.5" style="background:color-mix(in srgb, var(--wd-red-600) 7.8%, transparent); color:var(--wd-red-600); font-family:var(--wd-font-sans);">Free · community-run</span>
                </div>
                <h1 class="text-3xl leading-tight mt-0.5" style="color:var(--wd-brown-900);">{{ profile.name }}</h1>
                <div class="text-sm mt-0.5" style="color:var(--wd-amber-600); font-family:var(--wd-font-display);font-style:italic; font-size:18px;">@{{ profile.username }}</div>
                <div v-if="profile.address" class="flex items-start gap-1 mt-2 text-xs" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);"><MapPin class="w-3 h-3 mt-0.5 shrink-0" style="color:var(--wd-amber-600);" /> <span>{{ profile.address }}<a v-if="directionsUrl" :href="directionsUrl" target="_blank" rel="noopener noreferrer" class="ml-1.5 font-bold underline" style="color:var(--wd-red-600);">Map</a></span></div>
                <NuxtLink v-if="profile.citySlug && profile.city" :to="`/cities/${profile.citySlug}`" class="inline-block mt-1 text-xs font-bold hover:underline" style="color:var(--wd-amber-600); font-family:var(--wd-font-sans);">{{ profile.city }} →</NuxtLink>
              </div>
            </div>
            <p v-if="profile.bio" class="mt-5 text-sm leading-relaxed" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">{{ profile.bio }}</p>
            <div v-if="profile.styles?.length" class="mt-3 flex flex-wrap gap-1.5">
              <span v-for="st in profile.styles" :key="st" class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider" style="background:color-mix(in srgb, var(--wd-red-600) 7.8%, transparent); color:var(--wd-red-600); font-family:var(--wd-font-sans);">{{ st }}</span>
            </div>
            <div v-if="profile.languages?.length" class="mt-2 flex flex-wrap items-center gap-1.5">
              <span class="text-[10px] uppercase tracking-wider" style="color:#9a5614; font-family: system-ui, sans-serif;">Speaks</span>
              <span v-for="lang in profile.languages" :key="lang" class="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded" style="background:#0891b214; color:#0891b2; font-family: system-ui, sans-serif;">{{ langLabel[lang] || lang.toUpperCase() }}</span>
            </div>
            <div v-if="profile.socials?.length" class="mt-4 flex items-center gap-2">
              <a v-for="s in profile.socials" :key="s.platform" :href="s.url" target="_blank" rel="noopener" class="inline-flex items-center justify-center w-9 h-9 rounded-full" style="background:color-mix(in srgb, var(--wd-red-600) 7.8%, transparent); color:var(--wd-red-600);" :aria-label="s.platform"><component :is="socialIcon[s.platform] || Globe" class="w-4 h-4" /></a>
            </div>
            <div v-if="profile.moderatorName" class="mt-4 flex items-center gap-1.5 text-xs" style="color:var(--wd-amber-600); font-family:var(--wd-font-sans);">
              <ShieldCheck class="w-3.5 h-3.5" /> Moderated by the {{ profile.moderatorName }}<span v-if="profile.moderatorSince"> · since {{ profile.moderatorSince }}</span>
            </div>
            <NuxtLink v-if="isFree" :to="`/elections/${handle}`" class="mt-2 inline-flex items-center gap-1.5 text-xs font-bold" style="color:var(--wd-red-600); font-family:var(--wd-font-sans);">
              <ShieldCheck class="w-3.5 h-3.5" /> {{ profile.moderatorName ? 'Moderator election' : 'Elect a moderator' }} →
            </NuxtLink>
          </div>
        </div>
      </section>

      <!-- Map -->
      <section v-if="mapIsImage" class="max-w-2xl mx-auto px-4 pb-6" style="font-family:var(--wd-font-sans);">
        <div class="flex items-center gap-2 mb-2"><LayoutGrid class="w-5 h-5" style="color:var(--wd-red-600);" /><h2 class="text-2xl" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">The map</h2></div>
        <img :src="profile.mapUrl" alt="Map of the dance areas" class="w-full rounded-2xl border" style="border-color:color-mix(in srgb, var(--wd-brown-900) 10.2%, transparent);">
      </section>

      <!-- Scheduled events (first) -->
      <section class="max-w-2xl mx-auto px-4 pb-6" style="font-family:var(--wd-font-sans);">
        <div class="flex items-center gap-2 mb-3"><Calendar class="w-5 h-5" style="color:var(--wd-red-600);" /><h2 class="text-2xl" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">{{ profile.type === 'venue' ? 'Scheduled' : 'Events' }}</h2></div>
        <EventSchedule v-if="scheduleCards.length" :events="visibleScheduleCards" />
        <button v-if="scheduleCards.length > scheduleLimit" type="button" class="mt-4 text-xs font-bold underline" style="color:var(--wd-red-600);" @click="scheduleLimit += 24">Show more ({{ scheduleCards.length - scheduleLimit }} more)</button>
        <p v-if="!scheduleCards.length" class="mt-3 text-sm italic" style="color:var(--wd-amber-600);">{{ spaces.length ? 'Nothing scheduled yet — book the first slot.' : 'No upcoming events.' }}</p>
      </section>

      <!-- Book a (free) slot -->
      <section v-if="spaces.length" class="max-w-2xl mx-auto px-4 pb-4" style="font-family:var(--wd-font-sans);">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2"><LayoutGrid class="w-5 h-5" style="color:var(--wd-red-600);" /><h2 class="text-2xl" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">{{ isFree ? 'Book a free slot' : 'Book a space' }}</h2></div>
          <button type="button" class="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold uppercase tracking-wider text-white shrink-0" style="background:linear-gradient(135deg,var(--wd-red-600),var(--wd-orange-500));" @click="openBooking(spaces[0])"><Plus class="w-3.5 h-3.5" /> Propose an event</button>
        </div>
        <p class="mt-1 text-sm" style="color:var(--wd-brown-700);">{{ isFree ? `Tap a free cell to reserve that area — it's free. A community moderator confirms it against the guidelines.` : `Tap an available slot in one of the ${spaces.length} areas.` }}</p>
        <AvailabilityCalendar :spaces="spaces" :bookings="schedule" :availability="availability" class="mt-4" @book="onCalendarBook" />
      </section>

      <!-- Guidelines -->
      <section v-if="profile.guidelines" id="guidelines" class="max-w-2xl mx-auto px-4 pb-6" style="font-family:var(--wd-font-sans);">
        <div class="flex items-center gap-2"><ScrollText class="w-5 h-5" style="color:var(--wd-red-600);" /><h2 class="text-2xl" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">Guidelines</h2></div>
        <p class="mt-1 text-xs" style="color:var(--wd-amber-600);">Proposed by the elected moderator — keep to them and the spot stays ours.</p>
        <div class="mt-3 rounded-2xl border p-4 whitespace-pre-line text-sm leading-relaxed" style="border-color:color-mix(in srgb, var(--wd-red-600) 20%, transparent); background:white; color:var(--wd-brown-700);">{{ profile.guidelines }}</div>
      </section>

      <!-- Reviews -->
      <section class="max-w-2xl mx-auto px-4 pb-16">
        <ReviewsSection :target-type="profile.type" :target-slug="profile.username" :target-name="profile.name" :city-slug="profile.citySlug || undefined" />
      </section>
    </template>

    <SiteFooter />

    <!-- Booking modal -->
    <div v-if="booking.open" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style="background:rgba(59,31,18,0.4);" @click.self="booking.open = false">
      <div class="w-full max-w-md rounded-2xl bg-white p-6" style="font-family:var(--wd-font-sans); box-shadow: 0 20px 50px rgba(0,0,0,0.25);">
        <template v-if="!booking.done">
          <h3 class="text-xl font-bold" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">{{ isFree ? 'Propose an event' : 'Request a space' }}</h3>
          <p class="text-xs mt-1" style="color:var(--wd-amber-600);">{{ isFree ? 'Free — a community moderator confirms it against the guidelines.' : 'WeDance connects you with the venue — no payment here.' }}</p>
          <div class="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            <div class="grid grid-cols-2 gap-2">
              <select v-model="booking.spaceId" class="h-10 rounded-xl px-3 text-sm outline-none" style="background:var(--wd-cream); border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent);" aria-label="Area">
                <option v-for="sp in spaces" :key="sp.id" :value="sp.id">{{ sp.name }}</option>
              </select>
              <select v-model="booking.eventType" class="h-10 rounded-xl px-3 text-sm outline-none" style="background:var(--wd-cream); border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent);" aria-label="Type">
                <option v-for="t in EVENT_TYPES" :key="t" :value="t">{{ t }}</option>
              </select>
            </div>
            <div>
              <input v-model="booking.title" type="text" maxlength="120" placeholder="Event name — e.g. Sunday Salsa Social" class="w-full h-10 rounded-xl px-3 text-sm outline-none" style="background:var(--wd-cream); border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent);" v-bind="bookingForm.fieldAttrs('title', 'booking-title-error')">
              <FieldError id="booking-title-error" :message="bookingForm.errors.title" />
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wider font-bold mb-1.5" style="color:var(--wd-amber-600);">Styles</div>
              <div class="flex flex-wrap gap-1.5">
                <button v-for="s in DANCE_STYLES" :key="s" type="button" class="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider" :style="booking.styles.includes(s) ? 'background:var(--wd-red-600); color:white;' : 'background:color-mix(in srgb, var(--wd-red-600) 7.8%, transparent); color:var(--wd-red-600);'" @click="toggleBookingStyle(s)">{{ s }}</button>
              </div>
            </div>
            <div>
              <div class="flex gap-2">
                <input v-model="booking.eventDate" type="date" class="flex-1 h-10 rounded-xl px-3 text-sm outline-none" style="background:var(--wd-cream); border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent);" aria-label="Date" v-bind="bookingForm.fieldAttrs('eventDate', 'booking-date-error')">
                <input v-model="booking.startTime" type="time" class="w-28 h-10 rounded-xl px-2 text-sm outline-none" style="background:var(--wd-cream); border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent);" aria-label="Start" v-bind="bookingForm.fieldAttrs('startTime', 'booking-start-error')">
                <input v-model="booking.endTime" type="time" class="w-28 h-10 rounded-xl px-2 text-sm outline-none" style="background:var(--wd-cream); border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent);" aria-label="End" v-bind="bookingForm.fieldAttrs('endTime', 'booking-end-error')">
              </div>
              <FieldError id="booking-date-error" :message="bookingForm.errors.eventDate" />
              <FieldError id="booking-start-error" :message="bookingForm.errors.startTime" />
              <FieldError id="booking-end-error" :message="bookingForm.errors.endTime" />
            </div>
            <input v-model="booking.artists" type="text" placeholder="Artists / DJs / teachers (comma-separated · @handle or name)" class="w-full h-10 rounded-xl px-3 text-sm outline-none" style="background:var(--wd-cream); border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent);">
            <div>
              <input v-model="booking.organizerHandle" type="text" placeholder="Organiser @handle (optional — who runs this event)" class="w-full h-10 rounded-xl px-3 text-sm outline-none" style="background:var(--wd-cream); border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent);" v-bind="bookingForm.fieldAttrs('organizerHandle', 'booking-organizer-error')">
              <FieldError id="booking-organizer-error" :message="bookingForm.errors.organizerHandle" />
            </div>
            <div>
              <textarea v-model="booking.message" rows="2" maxlength="2000" placeholder="Anything the community should know (level, entry…)" class="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none" style="background:var(--wd-cream); border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent);" v-bind="bookingForm.fieldAttrs('message', 'booking-message-error')" />
              <FieldError id="booking-message-error" :message="bookingForm.errors.message" />
            </div>
            <div>
              <div class="flex gap-2">
                <input v-model="booking.name" type="text" placeholder="Your name" class="flex-1 h-10 rounded-xl px-3 text-sm outline-none" style="background:var(--wd-cream); border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent);" v-bind="bookingForm.fieldAttrs('name', 'booking-name-error')">
                <input v-model="booking.headcount" type="number" min="1" placeholder="Guests" class="w-24 h-10 rounded-xl px-3 text-sm outline-none" style="background:var(--wd-cream); border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent);" v-bind="bookingForm.fieldAttrs('headcount', 'booking-headcount-error')">
              </div>
              <FieldError id="booking-name-error" :message="bookingForm.errors.name" />
              <FieldError id="booking-headcount-error" :message="bookingForm.errors.headcount" />
            </div>
            <div>
              <input v-model="booking.email" type="email" placeholder="Email (so the moderator can reply)" class="w-full h-10 rounded-xl px-3 text-sm outline-none" style="background:var(--wd-cream); border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent);" v-bind="bookingForm.fieldAttrs('email', 'booking-email-error')">
              <FieldError id="booking-email-error" :message="bookingForm.errors.email" />
            </div>
            <div>
              <label class="flex items-start gap-2 text-xs cursor-pointer" style="color:var(--wd-brown-700);">
                <input v-model="booking.terms" type="checkbox" class="mt-0.5 w-4 h-4 accent-wd-red-600" v-bind="bookingForm.fieldAttrs('terms', 'booking-terms-error')">
                <span v-if="isFree && profile.guidelines">I've read and will follow the <a href="#guidelines" class="underline font-bold" style="color:var(--wd-red-600);" @click.prevent="document.getElementById('guidelines')?.scrollIntoView({behavior:'smooth'})">community guidelines</a>.</span>
                <span v-else-if="isFree">I'll respect this space and its community.</span>
                <span v-else>I accept the <NuxtLink to="/booking-terms" target="_blank" class="underline font-bold" style="color:var(--wd-red-600);">booking terms</NuxtLink>.</span>
              </label>
              <FieldError id="booking-terms-error" :message="bookingForm.errors.terms" />
            </div>
            <p v-if="booking.err" class="text-sm font-bold" style="color:var(--wd-red-600);">{{ booking.err }}</p>
          </div>
          <div class="mt-4 flex gap-2">
            <button type="button" :disabled="booking.busy" class="flex-1 h-11 rounded-full text-white text-sm font-bold uppercase tracking-wider disabled:opacity-60" style="background:linear-gradient(135deg,var(--wd-red-600),var(--wd-orange-500));" @click="submitBooking">{{ booking.busy ? 'Sending…' : (isFree ? 'Book it' : 'Send request') }}</button>
            <button type="button" class="h-11 px-4 rounded-full text-sm font-bold" style="color:var(--wd-amber-600);" @click="booking.open = false">Cancel</button>
          </div>
        </template>
        <template v-else>
          <div class="text-center py-4">
            <div class="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white" style="background:var(--wd-green-600);"><Check class="w-6 h-6" /></div>
            <h3 class="text-xl font-bold mt-3" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">{{ isFree ? 'Slot proposed' : 'Request sent' }}</h3>
            <p class="text-sm mt-1" style="color:var(--wd-brown-700);">{{ isFree ? 'The moderator will confirm against the guidelines. See you on the floor!' : 'The venue will reply to your email.' }}</p>
            <button type="button" class="mt-4 rounded-full px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-white" style="background:var(--wd-red-600);" @click="booking.open = false">Done</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
