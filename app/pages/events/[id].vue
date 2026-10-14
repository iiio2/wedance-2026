<script setup lang="ts">
/**
 * /events/<name>-<short id> (old /events/<id> links redirect here) — a single event, rendered through the SAME rich view as a
 * festival (an event is just a smaller festival). It reuses FestivalHero and the
 * festival section language; sections appear only when the event has that
 * content, so an event can grow into a full festival-grade page over time.
 */
import { Check, ArrowLeft, MapPin, Globe, User, Euro, Pencil } from 'lucide-vue-next'
import type { DanceRole, SwipeCard } from '~/types/festival'
import { findMockEvent } from '~/lib/mockEvents'
import { formatEventWhen, eventLocalDate } from '#shared/utils/eventTime'
import { Button } from '~/components/ui/button'
import { WD } from '~/lib/brand'
import { mixHex, readableOn } from '~/lib/contrast'
import { isUuid, eventSlug } from '#shared/utils/eventSlug'
import { festivalPath } from '#shared/utils/eventSlug'

definePageMeta({ layout: false })

const route = useRoute()
const router = useRouter()
const { $trpc } = useNuxtApp()
const { weekPlanIds, toggleEvent } = useWeekPlan()

// Auth gate — "Going?" requires sign-in
const { isSignedIn } = useAuth()
const showSignUp = ref(false)
const signUpAction = ref('plan')
const signUpPrefill = ref<{ name?: string; danceStyles?: string[]; role?: 'lead' | 'follow' | 'both'; city?: string }>({})

function onSignIn(action?: string) {
  signUpAction.value = action || 'plan'
  showSignUp.value = true
}

function onPick() {
  if (!isSignedIn.value) {
    onSignIn('plan')
    return
  }
  const wasGoing = picked.value
  toggleEvent(ev.value.id)
  liveGoingCount.value = Math.max(0, liveGoingCount.value + (wasGoing ? -1 : 1))
}

// "Shall we dance?" — same swipe deck as festivals, fed by this event's
// going list. Signed-out visitors start with the dance card + profile cards.
const swipeCards = computed<SwipeCard[]>(() => isSignedIn.value
  ? []
  : [
      { id: 'onboarding-dancecard', cardType: 'onboarding-dancecard', availableStyles: ev.value?.styles ?? [] },
      { id: 'onboarding-profile', cardType: 'onboarding-profile' },
    ])
const noPlan = new Set<string>()

function onOnboardingComplete(role: DanceRole, styles: string[], name: string, city: string) {
  signUpPrefill.value = { name: name || undefined, danceStyles: styles, role: role as 'lead' | 'follow' | 'both', city: city || undefined }
}

const id = computed(() => String(route.params.id))
const ev = ref<any>(null)
const festivalData = ref<Awaited<ReturnType<typeof $trpc.events.festival.query>> | null>(null)
const pending = ref(true)
const failed = ref(false)

async function load() {
  pending.value = true; failed.value = false
  try {
    // Booking requests are only linked by their full id; anything else is a dated event.
    if (!isUuid(id.value)) throw new Error('not a booking')
    ev.value = await $trpc.booking.getEvent.query({ id: id.value })
  } catch {
    try {
      // A dated public event (wedance.vip mirror) — adapt to the booking shape.
      const e = await $trpc.events.get.query({ id: id.value })
      // A festival renders the festival page (programme, passes, line-up, dinners…).
      if (e.festival) festivalData.value = await $trpc.events.festival.query({ id: e.id })
      ev.value = fromSyncedEvent(e)
      // An old /events/<id> link, or a name that changed since → the current
      // address, without a new history entry.
      const canonical = eventSlug(e)
      if (id.value !== canonical) router.replace({ path: `/events/${canonical}`, query: route.query, hash: route.hash })
    } catch {
      // Neither — fall back to a mock city event so it still has a page.
      const mock = findMockEvent(id.value)
      if (mock) ev.value = mock
      else failed.value = true
    }
  } finally { pending.value = false }
}
onMounted(load)

// Managers of the hosting profile (and admins) get an Edit button. Bookings and
// synced events have no host on WeDance, so nobody edits them here.
const canEdit = ref(false)
watch(() => ev.value?.id, async (eid) => {
  canEdit.value = false
  if (!eid || !isUuid(eid)) return
  try { canEdit.value = (await $trpc.businessEvents.canEdit.query({ id: eid })).canEdit } catch { /* stays hidden */ }
})

function fromSyncedEvent(e: any) {
  return {
    id: e.id,
    title: e.name,
    eventType: e.type,
    styles: e.styles || [],
    artists: [],
    eventDate: eventLocalDate(e.startDate, e.timezone),
    startDate: e.startDate,
    endDate: e.endDate,
    when: formatEventWhen(e.startDate, e.endDate, e.timezone),
    timezone: e.timezone,
    message: e.description || '',
    ticketUrl: e.ticketUrl || '',
    link: e.link || '',
    price: e.price || '',
    editedAt: e.editedAt || null,
    checkedBy: e.checkedBy || null,
    // The night's programme (business-mode events): [{ time, what }].
    agenda: (e.agenda || []) as { time: string; what: string }[],
    cover: e.cover || '',
    venueName: e.venueName || '',
    venueAddress: e.venueAddress || '',
    venueCity: e.city || '',
    citySlug: e.citySlug || '',
    mapUrl: e.venueLat != null && e.venueLng != null
      ? `https://www.google.com/maps/search/?api=1&query=${e.venueLat},${e.venueLng}`
      : (e.venueAddress ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.venueAddress)}` : ''),
    organizerName: e.organizerName || '',
    organizerHandle: e.organizerUsername || '',
    archived: !!e.archived,
    synced: e.source === 'wedance-v3',
  }
}

const styleColor: Record<string, string> = {
  salsa: WD.red600, bachata: WD.purple500, kizomba: WD.pink500, timba: WD.amber500,
  casino: WD.green600, rueda: WD.cyan600, afro: WD.violet600, zouk: WD.cyan600,
}
const accent = computed(() => styleColor[String(ev.value?.styles?.[0] || '').toLowerCase()] || WD.red600)
// Accent text darkened just enough for 4.5:1 — on the cream page, or on its own '14' tint (chips).
const ink = (c: string) => readableOn(c, WD.cream)
const chipInk = (c: string) => readableOn(c, mixHex(c, WD.cream, 0.078))
const picked = computed(() => !!ev.value && weekPlanIds?.value?.has(ev.value.id))
const parentFestival = computed(() => ev.value?.parentFestival ?? null)

// Live going count from plan items (replaces static headcount).
// Keyed by the event's id — that's what "Going" stores, not the URL slug.
const liveGoingCount = ref(0)
watch(() => ev.value?.id, async (eid) => {
  if (!eid) return
  try {
    liveGoingCount.value = await $trpc.plan.count.query({ itemType: 'event', itemId: eid })
  } catch { /* non-critical */ }
})

// Adapt the event into the Festival shape FestivalHero expects.
const asFestival = computed(() => ({
  slug: ev.value.id,
  name: ev.value.title || 'Event',
  logo: '',
  accentColor: accent.value,
  startDate: ev.value.startDate || ev.value.eventDate,
  endDate: ev.value.endDate || ev.value.eventDate,
  venue: { name: [ev.value.spaceName, ev.value.venueName].filter(Boolean).join(' · ') },
  attendeeCount: liveGoingCount.value,
  socialLinks: [] as any[],
  ticketUrl: ev.value.ticketUrl || undefined,
  tickets: [] as any[],
})) as any

// Which sections have content (so nav + page grow with the event).
const sections = computed(() => {
  const s: { id: string; label: string }[] = []
  if (ev.value?.message || ev.value?.cover || ev.value?.link || ev.value?.price || ev.value?.agenda?.length) s.push({ id: 'about', label: 'About' })
  s.push({ id: 'discover', label: 'Shall we dance?' })
  if (ev.value?.artists?.length) s.push({ id: 'lineup', label: 'Lineup' })
  s.push({ id: 'venue', label: 'Venue' })
  s.push({ id: 'reviews', label: 'Reviews' })
  return s
})
function scrollTo(anchor: string) {
  document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth' })
}

useHead(() => ({
  title: ev.value ? `${ev.value.title || 'Event'} — WeDance` : 'WeDance — Event',
}))
</script>

<template>
  <FestivalView v-if="festivalData && !pending" :data="festivalData" :type="ev?.eventType" :edit-to="canEdit ? `/business/events/${festivalData.eventId}` : undefined" />
  <div v-else class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />

    <main>

    <section v-if="pending" class="max-w-2xl mx-auto px-4 py-24 text-center">
      <div class="inline-block w-8 h-8 rounded-full border-2 animate-spin border-primary/20 border-t-primary" role="status" aria-label="Loading event" />
    </section>

    <section v-else-if="failed || !ev" class="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 class="text-4xl text-foreground">Event not found</h1>
      <NuxtLink to="/cities" class="inline-flex items-center gap-1 text-xs font-bold mt-6 text-primary font-sans"><ArrowLeft class="w-3 h-3" /> Browse cities</NuxtLink>
    </section>

    <template v-else>
      <!-- Part-of-festival banner (workshops / festival schedule items) -->
      <NuxtLink v-if="parentFestival" :to="`${festivalPath(parentFestival.slug)}`" class="block border-b hover:brightness-95 transition-all bg-primary/[6.3%] border-border">
        <div class="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-2 text-sm text-muted-foreground font-sans">
          <span class="text-eyebrow uppercase tracking-widest font-black shrink-0 text-primary">Festival</span>
          <span class="truncate">Part of <b class="text-foreground">{{ parentFestival.name }}</b></span>
          <span class="ml-auto font-bold whitespace-nowrap shrink-0 text-primary">View festival →</span>
        </div>
      </NuxtLink>

      <div v-if="canEdit" class="border-b bg-secondary/[8%] border-border">
        <div class="max-w-3xl mx-auto px-4 py-2 flex items-center gap-3 text-sm font-sans">
          <span class="text-muted-foreground">You manage this event.</span>
          <Button variant="outline-pill" size="pill-sm" class="ml-auto" as-child>
            <NuxtLink :to="`/business/events/${ev.id}`"><Pencil /> Edit event</NuxtLink>
          </Button>
        </div>
      </div>

      <div v-if="ev.editedAt" class="max-w-3xl mx-auto px-4 pt-3 font-sans">
        <p class="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-wd-green-700">
          <Check class="size-3.5" aria-hidden="true" /> Checked{{ ev.checkedBy ? ` by ${ev.checkedBy}` : '' }} · {{ new Date(ev.editedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }}
        </p>
      </div>

      <!-- Same hero as festivals -->
      <FestivalHero :festival="asFestival" review-target-type="event" entity-label="event" cta-anchor="#discover" cta-fallback-label="I'm going" :picked="picked" :date-label="ev.when" :venue-address="ev.venueAddress" :map-url="ev.mapUrl" @pick="onPick" />

      <div v-if="ev.archived" class="max-w-3xl mx-auto px-4 pt-4 font-sans">
        <p class="rounded-xl px-4 py-3 text-sm bg-warning/[12.2%] text-wd-amber-800">This event is no longer listed by its organiser — it may have been cancelled or moved.</p>
      </div>

      <!-- Section anchor nav (festival-style) -->
      <nav class="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm" aria-label="Event sections">
        <div class="max-w-3xl mx-auto flex items-center gap-1 px-4 overflow-x-auto">
          <Button v-for="s in sections" :key="s.id" type="button" variant="ghost" class="h-auto rounded-none px-3 py-3 text-sm italic font-normal whitespace-nowrap text-muted-foreground font-display hover:bg-transparent hover:text-foreground" @click="scrollTo(s.id)">{{ s.label }}</Button>
        </div>
      </nav>

      <div class="max-w-3xl mx-auto px-4 space-y-14 pt-8 pb-20 font-sans">
        <!-- About -->
        <section v-if="ev.message || ev.cover || ev.link || ev.price || ev.agenda?.length" id="about" class="scroll-mt-16">
          <h2 class="text-2xl font-black leading-tight mb-3 font-display text-foreground">About</h2>
          <img v-if="ev.cover" :src="ev.cover" :alt="ev.title" class="w-full max-h-[28rem] object-contain rounded-2xl mb-4 bg-wd-brown-900/[3.9%]" loading="lazy">
          <div class="flex flex-wrap items-center gap-2 mb-4">
            <span v-if="ev.eventType" class="text-eyebrow font-black uppercase tracking-widest px-2 py-1 rounded bg-secondary/[9.4%] text-secondary">{{ ev.eventType }}</span>
            <span v-for="s in (ev.styles || [])" :key="s" class="text-eyebrow font-bold uppercase tracking-wider px-2 py-1 rounded-full" :style="{ background: accent + '14', color: chipInk(accent) }">{{ s }}</span>
          </div>
          <ul class="space-y-1.5 text-sm mb-4 text-foreground">
            <li v-if="ev.price" class="flex items-start gap-2"><Euro class="w-4 h-4 mt-0.5 shrink-0 text-secondary" /> <span class="whitespace-pre-line">{{ ev.price }}</span></li>
            <li v-if="ev.organizerName" class="flex items-start gap-2">
              <User class="w-4 h-4 mt-0.5 shrink-0 text-secondary" />
              <NuxtLink v-if="ev.organizerHandle" :to="`/@${ev.organizerHandle}`" class="font-bold hover:underline">{{ ev.organizerName }}</NuxtLink>
              <span v-else class="font-bold">{{ ev.organizerName }}</span>
            </li>
            <li v-if="ev.link" class="flex items-start gap-2">
              <Globe class="w-4 h-4 mt-0.5 shrink-0 text-secondary" />
              <a :href="ev.link" target="_blank" rel="noopener noreferrer" class="font-bold underline break-all" :style="{ color: ink(accent) }">Event website</a>
            </li>
          </ul>
          <div v-if="ev.agenda?.length" class="mb-4">
            <h3 class="text-eyebrow font-black uppercase tracking-widest text-secondary mb-1.5">Programme</h3>
            <ul class="space-y-1 text-sm text-foreground">
              <li v-for="(a, i) in ev.agenda" :key="i"><span class="font-bold tabular-nums">{{ a.time }}</span> {{ a.what }}</li>
            </ul>
          </div>
          <p v-if="ev.message" class="text-sm leading-relaxed whitespace-pre-line break-words text-muted-foreground">{{ ev.message }}</p>
        </section>

        <!-- Shall we dance? — the same swipe deck as festivals -->
        <section id="discover" class="scroll-mt-16">
          <h2 class="text-2xl font-black leading-tight mb-1 font-display text-foreground">Shall we <em class="italic" :style="{ color: accent }">dance?</em></h2>
          <p class="text-sm mb-4 text-muted-foreground">Swipe to discover the dancers you'd like to dance with.</p>
          <DiscoverDancers
            :festival-slug="ev.id"
            item-type="event"
            :extra-cards="swipeCards"
            :workshops="[]"
            :plan-ids="noPlan"
            :is-signed-in="isSignedIn"
            @sign-in="onSignIn"
            @onboarding-complete="onOnboardingComplete"
          />
        </section>

        <!-- Lineup -->
        <section v-if="ev.artists?.length" id="lineup" class="scroll-mt-16">
          <h2 class="text-2xl font-black leading-tight mb-3 font-display text-foreground">Lineup</h2>
          <div class="flex flex-wrap gap-2">
            <template v-for="(a, i) in ev.artists" :key="i">
              <NuxtLink v-if="String(a).startsWith('@')" :to="`/${a}`" class="rounded-full px-4 py-2 text-sm font-bold" :style="{ background: accent + '14', color: chipInk(accent) }">{{ a }}</NuxtLink>
              <span v-else class="rounded-full px-4 py-2 text-sm font-bold" :style="{ background: accent + '14', color: chipInk(accent) }">{{ a }}</span>
            </template>
          </div>
        </section>

        <!-- Venue (Pick lives in the hero now) -->
        <section id="venue" class="scroll-mt-16">
          <h2 class="text-2xl font-black leading-tight mb-2 font-display text-foreground">Venue</h2>
          <NuxtLink v-if="ev.venueHandle" :to="`/@${ev.venueHandle}`" class="inline-flex items-center gap-2 text-sm font-bold hover:underline text-foreground">
            <MapPin class="w-4 h-4 text-secondary" /> <span>{{ ev.venueName }}<template v-if="ev.venueCity">, {{ ev.venueCity }}</template></span>
          </NuxtLink>
          <span v-else-if="ev.venueName" class="inline-flex items-center gap-2 text-sm font-bold text-foreground">
            <MapPin class="w-4 h-4 text-secondary" /> <span>{{ ev.venueName }}<template v-if="ev.venueCity">, {{ ev.venueCity }}</template></span>
          </span>
          <p v-if="ev.venueAddress" class="mt-1 text-xs text-secondary">{{ ev.venueAddress }}</p>
          <a v-if="ev.mapUrl" :href="ev.mapUrl" target="_blank" rel="noopener noreferrer" class="inline-block mt-2 text-xs font-bold underline" :style="{ color: ink(accent) }">Open in Google Maps</a>
          <p v-if="ev.citySlug" class="mt-3 text-xs"><NuxtLink :to="`/cities/${ev.citySlug}`" class="font-bold hover:underline text-secondary">More dancing in {{ ev.venueCity }} →</NuxtLink></p>
        </section>

        <!-- Reviews (same component as venues/festivals) -->
        <section id="reviews" class="scroll-mt-16">
          <ReviewsSection target-type="event" :target-slug="ev.id" :target-name="ev.title || 'Event'" />
        </section>
      </div>
    </template>

    </main>


    <SiteFooter />

    <SignUpModal v-model:open="showSignUp" :action="signUpAction" :prefill="signUpPrefill" />
  </div>
</template>
