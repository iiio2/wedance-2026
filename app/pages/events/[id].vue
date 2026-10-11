<script setup lang="ts">
/**
 * /events/<id> — a single event, rendered through the SAME rich view as a
 * festival (an event is just a smaller festival). It reuses FestivalHero and the
 * festival section language; sections appear only when the event has that
 * content, so an event can grow into a full festival-grade page over time.
 */
import { Check, Plus, ArrowLeft, MapPin, Globe, User, Euro } from 'lucide-vue-next'
import { findMockEvent } from '~/lib/mockEvents'
import { formatEventWhen, eventLocalDate } from '#shared/utils/eventTime'
import { WD } from '~/lib/brand'

definePageMeta({ layout: false })

const route = useRoute()
const { $trpc } = useNuxtApp()
const { weekPlanIds, toggleEvent } = useWeekPlan()

// Auth gate — "Going?" requires sign-in
const { isSignedIn } = useAuth()
const showSignUp = ref(false)

function onPick() {
  if (!isSignedIn.value) {
    showSignUp.value = true
    return
  }
  toggleEvent(ev.value.id)
}

const id = computed(() => String(route.params.id))
const ev = ref<any>(null)
const pending = ref(true)
const failed = ref(false)

async function load() {
  pending.value = true; failed.value = false
  try {
    ev.value = await $trpc.booking.getEvent.query({ id: id.value })
  } catch {
    try {
      // A dated public event (wedance.vip mirror) — adapt to the booking shape.
      ev.value = fromSyncedEvent(await $trpc.events.get.query({ id: id.value }))
    } catch {
      // Neither — fall back to a mock city event so it still has a page.
      const mock = findMockEvent(id.value)
      if (mock) ev.value = mock
      else failed.value = true
    }
  } finally { pending.value = false }
}
onMounted(load)

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
const picked = computed(() => !!ev.value && weekPlanIds?.value?.has(ev.value.id))
const parentFestival = computed(() => ev.value?.parentFestival ?? null)

// Adapt the event into the Festival shape FestivalHero expects.
const asFestival = computed(() => ({
  slug: ev.value.id,
  name: ev.value.title || 'Event',
  logo: '',
  accentColor: accent.value,
  startDate: ev.value.startDate || ev.value.eventDate,
  endDate: ev.value.endDate || ev.value.eventDate,
  venue: { name: [ev.value.spaceName, ev.value.venueName].filter(Boolean).join(' · ') },
  attendeeCount: ev.value.headcount || 0,
  socialLinks: [] as any[],
  ticketUrl: ev.value.ticketUrl || undefined,
  tickets: [] as any[],
})) as any

// Which sections have content (so nav + page grow with the event).
const sections = computed(() => {
  const s: { id: string; label: string }[] = []
  if (ev.value?.message || ev.value?.cover || ev.value?.link || ev.value?.price) s.push({ id: 'about', label: 'About' })
  s.push({ id: 'going', label: "Who's going" })
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
  <div class="min-h-screen" style="background:var(--wd-cream); color:var(--wd-brown-900); font-family:var(--wd-font-display);">
    <SiteHeader />

    <section v-if="pending" class="max-w-2xl mx-auto px-4 py-24 text-center">
      <div class="inline-block w-8 h-8 rounded-full border-2 animate-spin" style="border-color:color-mix(in srgb, var(--wd-red-600) 20%, transparent); border-top-color:var(--wd-red-600);" />
    </section>

    <section v-else-if="failed || !ev" class="max-w-xl mx-auto px-4 py-20 text-center">
      <h1 class="text-4xl" style="color:var(--wd-brown-900);">Event not found</h1>
      <NuxtLink to="/cities" class="inline-flex items-center gap-1 text-xs font-bold mt-6" style="color:var(--wd-red-600); font-family:var(--wd-font-sans);"><ArrowLeft class="w-3 h-3" /> Browse cities</NuxtLink>
    </section>

    <template v-else>
      <!-- Part-of-festival banner (workshops / festival schedule items) -->
      <NuxtLink v-if="parentFestival" :to="`/festivals/${parentFestival.slug}`" class="block border-b hover:brightness-95 transition-all" style="background:color-mix(in srgb, var(--wd-red-600) 6.3%, transparent); border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);">
        <div class="max-w-3xl mx-auto px-4 py-2.5 flex items-center gap-2 text-sm" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
          <span class="text-[10px] uppercase tracking-widest font-black shrink-0" style="color:var(--wd-red-600);">Festival</span>
          <span class="truncate">Part of <b style="color:var(--wd-brown-900);">{{ parentFestival.name }}</b></span>
          <span class="ml-auto font-bold whitespace-nowrap shrink-0" style="color:var(--wd-red-600);">View festival →</span>
        </div>
      </NuxtLink>

      <!-- Same hero as festivals -->
      <FestivalHero :festival="asFestival" review-target-type="event" :picked="picked" :date-label="ev.when" @pick="onPick" />

      <div v-if="ev.archived" class="max-w-3xl mx-auto px-4 pt-4" style="font-family:var(--wd-font-sans);">
        <p class="rounded-xl px-4 py-3 text-sm" style="background:color-mix(in srgb, var(--wd-amber-500) 12.2%, transparent); color:var(--wd-amber-800);">This event is no longer listed by its organiser — it may have been cancelled or moved.</p>
      </div>

      <!-- Section anchor nav (festival-style) -->
      <nav class="sticky top-0 z-20 border-b" style="background:rgba(251, 245, 234, 0.95); backdrop-filter: blur(8px); border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);">
        <div class="max-w-3xl mx-auto flex items-center gap-1 px-4 overflow-x-auto">
          <button v-for="s in sections" :key="s.id" type="button" class="px-3 py-3 text-sm italic whitespace-nowrap" style="color:var(--wd-brown-700); font-family:var(--wd-font-display);" @click="scrollTo(s.id)">{{ s.label }}</button>
        </div>
      </nav>

      <div class="max-w-3xl mx-auto px-4 space-y-14 pt-8 pb-20" style="font-family:var(--wd-font-sans);">
        <!-- About -->
        <section v-if="ev.message || ev.cover || ev.link || ev.price" id="about" class="scroll-mt-16">
          <h2 class="text-2xl font-black leading-tight mb-3" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">About</h2>
          <img v-if="ev.cover" :src="ev.cover" :alt="ev.title" class="w-full max-h-[28rem] object-contain rounded-2xl mb-4" style="background:color-mix(in srgb, var(--wd-brown-900) 3.9%, transparent);" loading="lazy">
          <div class="flex flex-wrap items-center gap-2 mb-4">
            <span v-if="ev.eventType" class="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded" style="background:color-mix(in srgb, var(--wd-amber-600) 9.4%, transparent); color:var(--wd-amber-600);">{{ ev.eventType }}</span>
            <span v-for="s in (ev.styles || [])" :key="s" class="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full" :style="{ background: accent + '14', color: accent }">{{ s }}</span>
          </div>
          <ul class="space-y-1.5 text-sm mb-4" style="color:var(--wd-brown-900);">
            <li v-if="ev.price" class="flex items-start gap-2"><Euro class="w-4 h-4 mt-0.5 shrink-0" style="color:var(--wd-amber-600);" /> {{ ev.price }}</li>
            <li v-if="ev.organizerName" class="flex items-start gap-2">
              <User class="w-4 h-4 mt-0.5 shrink-0" style="color:var(--wd-amber-600);" />
              <NuxtLink v-if="ev.organizerHandle" :to="`/@${ev.organizerHandle}`" class="font-bold hover:underline">{{ ev.organizerName }}</NuxtLink>
              <span v-else class="font-bold">{{ ev.organizerName }}</span>
            </li>
            <li v-if="ev.link" class="flex items-start gap-2">
              <Globe class="w-4 h-4 mt-0.5 shrink-0" style="color:var(--wd-amber-600);" />
              <a :href="ev.link" target="_blank" rel="noopener noreferrer" class="font-bold hover:underline break-all" :style="{ color: accent }">Event website</a>
            </li>
          </ul>
          <p v-if="ev.message" class="text-sm leading-relaxed whitespace-pre-line break-words" style="color:var(--wd-brown-700);">{{ ev.message }}</p>
        </section>

        <!-- Who's going -->
        <section id="going" class="scroll-mt-16">
          <h2 class="text-2xl font-black leading-tight mb-1" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">Who's <em class="italic" :style="{ color: accent }">going</em></h2>
          <p class="text-sm mb-4" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">See who else is planning to be there — mark yourself as going so others see you too.</p>
          <GoingSection item-type="event" :item-id="ev.id" :accent-color="accent" />
        </section>

        <!-- Lineup -->
        <section v-if="ev.artists?.length" id="lineup" class="scroll-mt-16">
          <h2 class="text-2xl font-black leading-tight mb-3" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">Lineup</h2>
          <div class="flex flex-wrap gap-2">
            <template v-for="(a, i) in ev.artists" :key="i">
              <NuxtLink v-if="String(a).startsWith('@')" :to="`/${a}`" class="rounded-full px-4 py-2 text-sm font-bold" :style="{ background: accent + '14', color: accent }">{{ a }}</NuxtLink>
              <span v-else class="rounded-full px-4 py-2 text-sm font-bold" :style="{ background: accent + '14', color: accent }">{{ a }}</span>
            </template>
          </div>
        </section>

        <!-- Venue (Pick lives in the hero now) -->
        <section id="venue" class="scroll-mt-16">
          <h2 class="text-2xl font-black leading-tight mb-2" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">Venue</h2>
          <NuxtLink v-if="ev.venueHandle" :to="`/@${ev.venueHandle}`" class="inline-flex items-center gap-2 text-sm font-bold hover:underline" style="color:var(--wd-brown-900);">
            <MapPin class="w-4 h-4" style="color:var(--wd-amber-600);" /> <span>{{ ev.venueName }}<template v-if="ev.venueCity">, {{ ev.venueCity }}</template></span>
          </NuxtLink>
          <span v-else-if="ev.venueName" class="inline-flex items-center gap-2 text-sm font-bold" style="color:var(--wd-brown-900);">
            <MapPin class="w-4 h-4" style="color:var(--wd-amber-600);" /> <span>{{ ev.venueName }}<template v-if="ev.venueCity">, {{ ev.venueCity }}</template></span>
          </span>
          <p v-if="ev.venueAddress" class="mt-1 text-xs" style="color:var(--wd-amber-600);">{{ ev.venueAddress }}</p>
          <a v-if="ev.mapUrl" :href="ev.mapUrl" target="_blank" rel="noopener noreferrer" class="inline-block mt-2 text-xs font-bold underline" :style="{ color: accent }">Open in Google Maps</a>
          <p v-if="ev.citySlug" class="mt-3 text-xs"><NuxtLink :to="`/cities/${ev.citySlug}`" class="font-bold hover:underline" style="color:var(--wd-amber-600);">More dancing in {{ ev.venueCity }} →</NuxtLink></p>
        </section>

        <!-- Reviews (same component as venues/festivals) -->
        <section id="reviews" class="scroll-mt-16">
          <ReviewsSection target-type="event" :target-slug="ev.id" :target-name="ev.title || 'Event'" />
        </section>
      </div>
    </template>

    <SiteFooter />

    <SignUpModal v-model:open="showSignUp" action="plan" />
  </div>
</template>
