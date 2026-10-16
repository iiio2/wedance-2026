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
import { venueTypeLabel, amenityLabel } from '#shared/types/venueDetails'
import { eventLocalDate, eventLocalTime } from '#shared/utils/eventTime'
import { bookingRequestSchema } from '#shared/validation'
import { MapPin, Instagram, Youtube, Globe, Facebook, LayoutGrid, ArrowLeft, Check, Calendar, ScrollText, ShieldCheck, Trees, Plus, Heart, Send } from 'lucide-vue-next'
import { eventPath } from '#shared/utils/eventSlug'

definePageMeta({ layout: false })

const route = useRoute()
const { $trpc } = useNuxtApp()
const { dancerName, isSignedIn } = useAuth()

const handle = computed(() => String(route.params.handle))

const pending = ref(true)
const data = ref<Awaited<ReturnType<typeof $trpc.entity.getByHandle.query>> | null>(null)
const schedule = ref<any[]>([])
const availability = ref<any[]>([])
// Dated public events (wedance.vip mirror) this profile hosts / runs / plays at.
const syncedEvents = ref<any[]>([])
const isStub = ref(false)
// Business: managers get an Edit link; unmanaged profiles get a Claim link.
const canManage = ref(false)
const managed = ref(true)

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
      const access = await $trpc.business.canManage.query({ username: pro.profile.username }).catch(() => ({ canManage: false, managed: true }))
      canManage.value = access.canManage
      managed.value = access.managed
      return
    }
    // An old handle: merged into another profile, or renamed.
    const moved = await $trpc.entity.movedTo.query({ handle: handle.value }).catch(() => null)
    if (moved) { await navigateTo(`/@${moved.handle}`, { replace: true, redirectCode: 301 }); return }
    try {
      await $trpc.profile.getByUsername.query({ username: handle.value })
      await navigateTo(`/u/${handle.value}`, { replace: true })
      return
    } catch {
      const dancerMoved = await $trpc.profile.movedTo.query({ username: handle.value }).catch(() => null)
      if (dancerMoved) { await navigateTo(`/u/${dancerMoved.username}`, { replace: true, redirectCode: 301 }); return }
      isStub.value = true
    }
  } catch { isStub.value = true }
  pending.value = false
}
onMounted(resolve)

// --- Follow artist ---
const following = ref(false)
const followBusy = ref(false)
const followerCount = ref(0)

watch(() => data.value?.profile, async (p) => {
  if (!p) return
  try { followerCount.value = await $trpc.follow.count.query({ profileId: p.id }) } catch {}
  if (isSignedIn.value) {
    try { following.value = await $trpc.follow.isFollowing.query({ profileId: p.id }) } catch {}
  }
}, { immediate: true })

async function toggleFollow() {
  const p = data.value?.profile
  if (!p || followBusy.value) return
  if (!isSignedIn.value) { await navigateTo('/auth/login'); return }
  followBusy.value = true
  try {
    const result = await $trpc.follow.toggle.mutate({ profileId: p.id })
    following.value = result.following
    followerCount.value += result.following ? 1 : -1
  } catch {} finally { followBusy.value = false }
}

const profile = computed(() => data.value?.profile ?? null)

// --- Photo gallery (Instagram-story-like) ---
const galleryOpen = ref(false)
const galleryStartIndex = ref(0)
const allPhotos = computed(() => {
  const p = profile.value
  if (!p) return []
  const urls: string[] = []
  if (p.photo) urls.push(p.photo)
  if (p.photos?.length) {
    for (const ph of p.photos) { if (ph.url && ph.url !== p.photo) urls.push(ph.url) }
  }
  return urls
})
function openGallery(index = 0) {
  if (!allPhotos.value.length) return
  galleryStartIndex.value = index
  galleryOpen.value = true
}

// --- Book them (anyone, no account) on /@handle/book: artists, and venues
// without bookable spaces (those use the space request below).
const canBook = computed(() => !!profile.value && (profile.value.type === 'artist' || (profile.value.type === 'venue' && !(data.value?.spaces ?? []).length)))
const bookName = computed(() => profile.value?.type === 'artist' ? profile.value.name.split(/\s+/)[0] : 'this venue')
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
    href: eventPath(e),
  })),
])
// Busy schools have 100+ dated classes — show the next ones, expand on demand.
const scheduleLimit = ref(12)
const visibleScheduleCards = computed(() => [...scheduleCards.value]
  .sort((a: any, b: any) => `${a.eventDate ?? ''} ${a.startTime ?? ''}`.localeCompare(`${b.eventDate ?? ''} ${b.startTime ?? ''}`))
  .slice(0, scheduleLimit.value))
// v4-imported venues carry a Google Maps LINK in map_url, not a drawn map image.
const mapIsImage = computed(() => !!profile.value?.mapUrl && !/(maps\.google\.|google\.[a-z.]+\/maps|goo\.gl\/maps)/i.test(profile.value.mapUrl))
// The floor plan: its own image (0036), else an old map_url that is an image.
const floorPlan = computed(() => profile.value?.floorPlan || (mapIsImage.value ? profile.value!.mapUrl : null))
const hasVenueFacts = computed(() => profile.value?.type === 'venue' && !!(profile.value.capacity || profile.value.amenities?.length || profile.value.openingHours?.length || (profile.value.venueType && profile.value.venueType !== 'OpenAir') || profile.value.floorType))
const directionsUrl = computed(() => {
  const p = profile.value
  if (!p) return ''
  if (p.mapUrl && !mapIsImage.value) return p.mapUrl
  return p.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}` : ''
})

const typeLabel: Record<string, string> = { venue: 'Venue', artist: 'Artist', organizer: 'Organizer', promoter: 'Promoter' }
const isPromoter = computed(() => profile.value?.type === 'promoter')
const socialIcon: Record<string, any> = { instagram: Instagram, youtube: Youtube, facebook: Facebook, website: Globe }
const langLabel: Record<string, string> = { en: 'English', es: 'Spanish', de: 'German', fr: 'French', pt: 'Portuguese', it: 'Italian', ru: 'Russian', hu: 'Hungarian', sl: 'Slovenian' }
const initials = computed(() => {
  const n = (profile.value?.name || '').trim()
  return n ? n.split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') : '?'
})
function fmtDate(d: any) { if (!d) return 'Date TBD'; try { return new Date(d).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) } catch { return String(d) } }

// --- Booking modal (a booking IS a scheduled event — collect enough info) ---
const EVENT_TYPES = ['Social', 'Party', 'Workshop', 'Class', 'Practica', 'Private']
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
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />

    <main>
    <section v-if="pending" class="max-w-2xl mx-auto px-4 py-24 text-center">
      <div class="inline-block w-8 h-8 rounded-full border-2 animate-spin" style="border-color:color-mix(in srgb, var(--wd-red-600) 20%, transparent); border-top-color:var(--wd-red-600);" />
    </section>

    <section v-else-if="isStub" class="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 class="text-4xl text-foreground">Not on WeDance yet</h1>
      <p class="mt-4 text-sm text-muted-foreground font-sans">
        <span class="font-bold">@{{ handle }}</span> doesn't have a page here yet. Run this venue or organise here? Claim it.
      </p>
      <Button as-child variant="cta" class="mt-6"><NuxtLink to="/for-events">Claim / list a space</NuxtLink></Button>
      <div class="mt-4"><NuxtLink to="/cities" class="inline-flex items-center gap-1 text-xs font-bold text-primary font-sans"><ArrowLeft class="w-3 h-3" /> Browse cities</NuxtLink></div>
    </section>

    <template v-else-if="profile">
      <!-- Header -->
      <section class="max-w-2xl mx-auto px-4 pt-12 pb-6">
        <div class="rounded-2xl overflow-hidden bg-white border" style="border-color:color-mix(in srgb, var(--wd-red-600) 20%, transparent); box-shadow: 0 1px 0 color-mix(in srgb, var(--wd-red-600) 13.3%, transparent), 0 10px 28px rgba(59,31,18,0.06);">
          <div class="h-2" style="background:linear-gradient(135deg, var(--wd-red-600), var(--wd-orange-500));" />
          <div class="p-6 sm:p-8">
            <!-- Centered hero photo circle -->
            <div class="flex flex-col items-center">
              <button v-if="profile.photo" class="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary" :class="allPhotos.length > 1 ? 'ring-2 ring-primary ring-offset-2' : ''" @click="openGallery(0)">
                <img :src="profile.photo" :alt="profile.name" class="w-32 h-32 sm:w-40 sm:h-40 rounded-full object-cover object-top" style="border:3px solid color-mix(in srgb, var(--wd-red-600) 20%, transparent);">
              </button>
              <div v-else class="w-32 h-32 sm:w-40 sm:h-40 rounded-full flex items-center justify-center text-4xl font-bold text-white" style="background:linear-gradient(135deg,var(--wd-red-600),var(--wd-orange-500));">{{ initials }}</div>
              <div class="flex items-center gap-2 mt-4">
                <span class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary font-sans">{{ typeLabel[profile.type] || 'Profile' }}</span>
                <span v-if="profile.venueType === 'OpenAir'" class="inline-flex items-center gap-1 text-eyebrow font-bold uppercase tracking-wider rounded-full px-2 py-0.5 text-wd-green-600 font-sans" style="background:color-mix(in srgb, var(--wd-green-600) 9.4%, transparent);"><Trees class="w-3 h-3" /> Open air</span>
                <span v-if="isFree" class="text-eyebrow font-bold uppercase tracking-wider rounded-full px-2 py-0.5 text-primary font-sans" style="background:color-mix(in srgb, var(--wd-red-600) 7.8%, transparent);">Free · community-run</span>
              </div>
              <h1 class="text-3xl leading-tight mt-1 text-foreground text-center">{{ profile.name }}</h1>
              <div class="text-sm mt-0.5 text-secondary font-hand" style="font-size:18px;">@{{ profile.username }}</div>
              <div v-if="profile.address" class="flex items-start gap-1 mt-2 text-xs text-muted-foreground font-sans"><MapPin class="w-3 h-3 mt-0.5 shrink-0 text-secondary" /> <span>{{ profile.address }}<a v-if="directionsUrl" :href="directionsUrl" target="_blank" rel="noopener noreferrer" class="ml-1.5 font-bold underline text-primary">Map</a></span></div>
              <NuxtLink v-if="profile.citySlug && profile.city" :to="`/cities/${profile.citySlug}`" class="inline-block mt-1 text-xs font-bold hover:underline text-secondary font-sans">{{ profile.city }} →</NuxtLink>
            </div>
            <BioText v-if="profile.bio" :text="profile.bio" class="mt-5 text-sm leading-relaxed text-muted-foreground font-sans" />
            <DanceStyleChips :styles="profile.styles || []" class="mt-3 gap-1.5" />
            <div v-if="profile.languages?.length" class="mt-2 flex flex-wrap items-center gap-1.5">
              <span class="text-eyebrow uppercase tracking-wider text-secondary font-sans">Speaks</span>
              <span v-for="lang in profile.languages" :key="lang" class="text-eyebrow font-bold tracking-wide px-1.5 py-0.5 rounded font-sans bg-wd-cyan-600/8 text-wd-cyan-700">{{ langLabel[lang] || lang.toUpperCase() }}</span>
            </div>
            <div v-if="profile.socials?.length" class="mt-4 flex items-center gap-2">
              <a v-for="s in profile.socials" :key="s.platform" :href="s.url" target="_blank" rel="noopener" class="inline-flex items-center justify-center w-9 h-9 rounded-full text-primary" style="background:color-mix(in srgb, var(--wd-red-600) 7.8%, transparent);" :aria-label="s.platform"><component :is="socialIcon[s.platform] || Globe" class="w-4 h-4" /></a>
            </div>
            <div v-if="canBook || profile.type === 'artist' || isPromoter" class="mt-4 flex flex-wrap items-center gap-3">
              <Button v-if="canBook && !isPromoter" variant="cta" size="pill-sm" as-child>
                <NuxtLink :to="`/@${profile.username}/book`"><Send class="w-3.5 h-3.5" aria-hidden="true" /> Book {{ bookName }}</NuxtLink>
              </Button>
              <Button
                v-if="profile.type === 'artist' || isPromoter"
                :variant="following ? 'pill' : 'soft'"
                size="pill-sm"
                :disabled="followBusy"
                :aria-pressed="following"
                @click="toggleFollow"
              >
                <Heart class="w-3.5 h-3.5" :class="following ? 'fill-white' : ''" aria-hidden="true" />
                {{ following ? 'Following' : 'Follow' }}
              </Button>
              <span v-if="(profile.type === 'artist' || isPromoter) && followerCount" class="text-xs text-muted-foreground font-sans">
                {{ followerCount }} follower{{ followerCount === 1 ? '' : 's' }}
              </span>
            </div>
            <div v-if="profile.moderatorName" class="mt-4 flex items-center gap-1.5 text-xs text-secondary font-sans">
              <ShieldCheck class="w-3.5 h-3.5" /> Moderated by the {{ profile.moderatorName }}<span v-if="profile.moderatorSince"> · since {{ profile.moderatorSince }}</span>
            </div>
            <NuxtLink v-if="isFree" :to="`/elections/${handle}`" class="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-primary font-sans">
              <ShieldCheck class="w-3.5 h-3.5" /> {{ profile.moderatorName ? 'Moderator election' : 'Elect a moderator' }} →
            </NuxtLink>
            <div class="mt-5 pt-4 border-t text-xs font-sans">
              <NuxtLink v-if="canManage" :to="`/business/network/${profile.username}`" class="font-bold text-wd-red-800 hover:underline">Edit this page →</NuxtLink>
              <NuxtLink v-else-if="!managed" :to="`/business/claim?profile=${profile.username}`" class="text-muted-foreground hover:text-foreground hover:underline">Is this you? Claim this page →</NuxtLink>
              <NuxtLink v-else :to="`/business/claim?profile=${profile.username}`" class="text-muted-foreground hover:text-foreground hover:underline">Work with them? Join the team →</NuxtLink>
            </div>
          </div>
        </div>
      </section>

      <!-- ══════ Promoter: tabbed layout ══════ -->
      <PromoterProfile v-if="isPromoter" :profile="profile" :can-manage="canManage" />

      <!-- ══════ Non-promoter: existing sections ══════ -->
      <template v-else>
      <!-- The venue: kind, size, amenities, opening hours -->
      <section v-if="hasVenueFacts" class="max-w-2xl mx-auto px-4 pb-6 font-sans">
        <div class="rounded-2xl border bg-card p-5">
          <dl class="grid gap-3 text-sm sm:grid-cols-2">
            <div v-if="profile.venueType && profile.venueType !== 'OpenAir'"><dt class="text-eyebrow font-bold uppercase tracking-wider text-secondary">Kind of place</dt><dd>{{ venueTypeLabel(profile.venueType) }}</dd></div>
            <div v-if="profile.capacity"><dt class="text-eyebrow font-bold uppercase tracking-wider text-secondary">Holds</dt><dd>Up to {{ profile.capacity }} people</dd></div>
            <div v-if="profile.floorType"><dt class="text-eyebrow font-bold uppercase tracking-wider text-secondary">Floor</dt><dd>{{ profile.floorType }}</dd></div>
          </dl>
          <div v-if="profile.amenities?.length" class="mt-4 flex flex-wrap gap-1.5">
            <span v-for="a in profile.amenities" :key="a" class="rounded-full bg-muted px-2.5 py-1 text-xs">{{ amenityLabel(a) }}</span>
          </div>
          <div v-if="profile.openingHours?.length" class="mt-4">
            <p class="text-eyebrow font-bold uppercase tracking-wider text-secondary">Opening hours</p>
            <ul class="mt-1 grid gap-0.5 text-sm">
              <li v-for="h in profile.openingHours" :key="h.day" class="grid grid-cols-[7rem_minmax(0,1fr)]"><span class="text-muted-foreground">{{ h.day }}</span><span>{{ h.hours }}</span></li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Floor plan -->
      <section v-if="floorPlan" class="max-w-2xl mx-auto px-4 pb-6 font-sans">
        <div class="flex items-center gap-2 mb-2"><LayoutGrid class="w-5 h-5 text-primary" /><h2 class="text-2xl font-display text-foreground">The floor plan</h2></div>
        <img :src="floorPlan" alt="Floor plan of the dance areas" class="w-full rounded-2xl border" style="border-color:color-mix(in srgb, var(--wd-brown-900) 10.2%, transparent);">
      </section>

      <!-- Scheduled events (first) -->
      <section class="max-w-2xl mx-auto px-4 pb-6 font-sans">
        <div class="flex items-center gap-2 mb-3"><Calendar class="w-5 h-5 text-primary" /><h2 class="text-2xl font-display text-foreground">{{ profile.type === 'venue' ? 'Scheduled' : 'Events' }}</h2></div>
        <EventSchedule v-if="scheduleCards.length" :events="visibleScheduleCards" />
        <Button v-if="scheduleCards.length > scheduleLimit" variant="link" size="sm" class="mt-4 px-0 h-auto text-xs font-bold underline" @click="scheduleLimit += 24">Show more ({{ scheduleCards.length - scheduleLimit }} more)</Button>
        <p v-if="!scheduleCards.length" class="mt-3 text-sm italic text-secondary">{{ spaces.length ? 'Nothing scheduled yet — book the first slot.' : 'No upcoming events.' }}</p>
      </section>

      <!-- Book a (free) slot -->
      <section v-if="spaces.length" class="max-w-2xl mx-auto px-4 pb-4 font-sans">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2"><LayoutGrid class="w-5 h-5 text-primary" /><h2 class="text-2xl font-display text-foreground">{{ isFree ? 'Book a free slot' : 'Book a space' }}</h2></div>
          <Button variant="cta" size="pill-sm" class="shrink-0" @click="openBooking(spaces[0])"><Plus aria-hidden="true" /> Propose an event</Button>
        </div>
        <p class="mt-1 text-sm text-muted-foreground">{{ isFree ? `Tap a free cell to reserve that area — it's free. A community moderator confirms it against the guidelines.` : `Tap an available slot in one of the ${spaces.length} areas.` }}</p>
        <AvailabilityCalendar :spaces="spaces" :bookings="schedule" :availability="availability" class="mt-4" @book="onCalendarBook" />
      </section>

      <!-- Guidelines -->
      <section v-if="profile.guidelines" id="guidelines" class="max-w-2xl mx-auto px-4 pb-6 font-sans">
        <div class="flex items-center gap-2"><ScrollText class="w-5 h-5 text-primary" /><h2 class="text-2xl font-display text-foreground">Guidelines</h2></div>
        <p class="mt-1 text-xs text-secondary">Proposed by the elected moderator — keep to them and the spot stays ours.</p>
        <div class="mt-3 rounded-2xl border p-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground" style="border-color:color-mix(in srgb, var(--wd-red-600) 20%, transparent); background:white;">{{ profile.guidelines }}</div>
      </section>

      <!-- Reviews -->
      <section class="max-w-2xl mx-auto px-4 pb-16">
        <ReviewsSection :target-type="profile.type" :target-slug="profile.username" :target-name="profile.name" :city-slug="profile.citySlug || undefined" />
      </section>
      </template>
    </template>
    </main>

    <SiteFooter />

    <!-- Photo gallery -->
    <PhotoGallery v-if="galleryOpen" :photos="allPhotos" :start-index="galleryStartIndex" @close="galleryOpen = false" />

    <!-- Booking modal -->
    <div v-if="booking.open" class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" style="background:rgba(59,31,18,0.4);" @click.self="booking.open = false">
      <div role="dialog" aria-modal="true" aria-labelledby="booking-dialog-title" class="w-full max-w-md rounded-2xl bg-white p-6 font-sans" style="box-shadow: 0 20px 50px rgba(0,0,0,0.25);">
        <template v-if="!booking.done">
          <h3 id="booking-dialog-title" class="text-xl font-bold font-display text-foreground">{{ isFree ? 'Propose an event' : 'Request a space' }}</h3>
          <p class="text-xs mt-1 text-secondary">{{ isFree ? 'Free — a community moderator confirms it against the guidelines.' : 'WeDance connects you with the venue — no payment here.' }}</p>
          <form id="booking-form" class="mt-4 space-y-3 max-h-[60vh] overflow-y-auto pr-1" novalidate @submit.prevent="submitBooking">
            <div class="grid grid-cols-2 gap-2">
              <Field id="booking-space" label="Area" :error="bookingForm.errors.spaceId">
                <Select v-model="booking.spaceId" size="sm" :options="spaces.map((sp: any) => ({ label: sp.name, value: sp.id }))" v-bind="bookingForm.fieldAttrs('spaceId', 'booking-space-error')" />
              </Field>
              <Field id="booking-type" label="Type">
                <Select v-model="booking.eventType" size="sm" :options="EVENT_TYPES" />
              </Field>
            </div>
            <Field id="booking-title" label="Event name" :error="bookingForm.errors.title">
              <Input v-model="booking.title" size="sm" maxlength="120" placeholder="e.g. Sunday Salsa Social" v-bind="bookingForm.fieldAttrs('title', 'booking-title-error')" />
            </Field>
            <div class="flex flex-col gap-1.5">
              <label for="booking-styles" class="text-sm font-bold text-foreground leading-snug">Styles <span class="font-normal text-muted-foreground">(optional)</span></label>
              <DanceStylePicker id="booking-styles" v-model="booking.styles" label="Styles" :popular-count="6" />
            </div>
            <Field id="booking-date" label="Date" optional :error="bookingForm.errors.eventDate">
              <Input v-model="booking.eventDate" type="date" size="sm" v-bind="bookingForm.fieldAttrs('eventDate', 'booking-date-error')" />
            </Field>
            <div class="grid grid-cols-2 gap-2">
              <Field id="booking-start" label="Start" optional :error="bookingForm.errors.startTime">
                <Input v-model="booking.startTime" type="time" size="sm" v-bind="bookingForm.fieldAttrs('startTime', 'booking-start-error')" />
              </Field>
              <Field id="booking-end" label="End" optional :error="bookingForm.errors.endTime">
                <Input v-model="booking.endTime" type="time" size="sm" v-bind="bookingForm.fieldAttrs('endTime', 'booking-end-error')" />
              </Field>
            </div>
            <Field id="booking-artists" label="Artists, DJs, teachers" optional hint="Comma-separated — @handle or name.">
              <Input v-model="booking.artists" size="sm" />
            </Field>
            <Field id="booking-organizer" label="Organiser @handle" optional hint="Who runs this event." :error="bookingForm.errors.organizerHandle">
              <Input v-model="booking.organizerHandle" size="sm" v-bind="bookingForm.fieldAttrs('organizerHandle', 'booking-organizer-error')" />
            </Field>
            <Field id="booking-message" label="Anything the community should know" optional :error="bookingForm.errors.message">
              <Textarea v-model="booking.message" :rows="2" maxlength="2000" :resize="false" class="min-h-16" placeholder="Level, entry…" v-bind="bookingForm.fieldAttrs('message', 'booking-message-error')" />
            </Field>
            <div class="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
              <Field id="booking-name" label="Your name" optional :error="bookingForm.errors.name">
                <Input v-model="booking.name" size="sm" autocomplete="name" v-bind="bookingForm.fieldAttrs('name', 'booking-name-error')" />
              </Field>
              <Field id="booking-headcount" label="Guests" optional :error="bookingForm.errors.headcount">
                <Input v-model="booking.headcount" type="number" min="1" size="sm" v-bind="bookingForm.fieldAttrs('headcount', 'booking-headcount-error')" />
              </Field>
            </div>
            <Field id="booking-email" label="Email" hint="So the moderator can reply." :error="bookingForm.errors.email">
              <Input v-model="booking.email" type="email" size="sm" autocomplete="email" v-bind="bookingForm.fieldAttrs('email', 'booking-email-error')" />
            </Field>
            <Field id="booking-terms" :error="bookingForm.errors.terms">
              <Checkbox v-model="booking.terms" class="items-start text-xs text-muted-foreground min-h-0" v-bind="bookingForm.fieldAttrs('terms', 'booking-terms-error')">
                <span v-if="isFree && profile.guidelines">I've read and will follow the <a href="#guidelines" class="underline font-bold text-primary" @click.prevent="document.getElementById('guidelines')?.scrollIntoView({behavior:'smooth'})">community guidelines</a>.</span>
                <span v-else-if="isFree">I'll respect this space and its community.</span>
                <span v-else>I accept the <NuxtLink to="/booking-terms" target="_blank" class="underline font-bold text-primary">booking terms</NuxtLink>.</span>
              </Checkbox>
            </Field>
            <p v-if="booking.err" role="alert" class="text-sm font-bold text-primary">{{ booking.err }}</p>
          </form>
          <div class="mt-4 flex gap-2">
            <Button type="submit" form="booking-form" variant="cta" class="flex-1 h-11" :loading="booking.busy">{{ booking.busy ? 'Sending…' : (isFree ? 'Book it' : 'Send request') }}</Button>
            <Button type="button" variant="ghost" class="h-11 px-4 rounded-full font-bold text-secondary" @click="booking.open = false">Cancel</Button>
          </div>
        </template>
        <template v-else>
          <div class="text-center py-4">
            <div class="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white bg-wd-green-600"><Check class="w-6 h-6" /></div>
            <h3 class="text-xl font-bold mt-3 font-display text-foreground">{{ isFree ? 'Slot proposed' : 'Request sent' }}</h3>
            <p class="text-sm mt-1 text-muted-foreground">{{ isFree ? 'The moderator will confirm against the guidelines. See you on the floor!' : 'The venue will reply to your email.' }}</p>
            <Button variant="pill" class="mt-4" @click="booking.open = false">Done</Button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
