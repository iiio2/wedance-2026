<script setup lang="ts">
/**
 * Sketch: new homepage following the Airbnb pattern.
 *
 * - One demand-side hero (Solo Traveler / Festival Tourist — highest-conversion
 *   action: claim a spot at a festival).
 * - Broad positioning subhead that signals the funnel + breadth.
 * - Persona shelf below fold so every demand-stage sees its door.
 * - Live proof: the real Charanga roster (not a mock card).
 * - 5-step loop diagram replacing the abstract checklist mock.
 * - Founder note (high-trust signal for a community product).
 * - Supply strip — quiet, dark, three CTAs for the supply side.
 *
 * Lives at /sketches/landing so it doesn't replace the live homepage until
 * we've measured conversion. The current /index stays untouched.
 */
import { festivalPath } from '#shared/utils/eventSlug'
import {
  ArrowRight,
  Sparkles,
  Calendar,
  Users,
  MapPin,
  Star,
  GraduationCap,
  Plane,
  Ticket,
  Heart,
  Building2,
  Music2,
} from 'lucide-vue-next'
definePageMeta({ layout: false })

// Preview roster for the landing — illustrative, not from prod data.
// The real <AttendeeRoster> lives on /festivals/[slug] and pulls actual rows.
// Flagged "Sample" on the page so visitors know this isn't real signup data.
const previewRoster = [
  { name: 'Maxine', city: 'Vienna', color: '#ec4899' },
  { name: 'Dayron', city: 'Madrid', color: '#3b82f6' },
  { name: 'Sofia', city: 'Munich', color: '#10b981' },
  { name: 'Mark', city: 'Berlin', color: '#f59e0b' },
]

useHead({
  title: 'WeDance — Every dance event, every dancer, every city.',
  meta: [
    {
      name: 'description',
      content:
        'From your first salsa class to your tenth festival — we map the dance world. See who is going, find honest reviews, plan your year.',
    },
  ],
})

const router = useRouter()

// Stage shelf — every demand-stage sees its door. Numbers are real where
// the data exists; honest "coming soon" elsewhere.
const stages = [
  {
    label: 'Just curious',
    title: 'Find a dance you would love',
    detail: 'Salsa · Bachata · Kizomba · Timba · 60 more',
    icon: Sparkles,
    href: '/cities',
    color: 'pink',
  },
  {
    label: 'Beginner',
    title: 'Find a teacher and a community',
    detail: '12 teachers in Munich · 8 in Berlin',
    icon: GraduationCap,
    href: '/cities/munich',
    color: 'blue',
  },
  {
    label: 'Going weekly',
    title: 'See what is on this week',
    detail: 'Practicas, socials, taster classes',
    icon: Calendar,
    href: '/cities/munich',
    color: 'emerald',
  },
  {
    label: 'Traveling',
    title: 'Plan your festival year',
    detail: '7 events · 5 cities · 2026',
    icon: Plane,
    href: '/festivals',
    color: 'orange',
  },
  {
    label: 'Reviewer',
    title: 'Honest reviews of the scene',
    detail: 'Coming soon — be the first',
    icon: Star,
    href: '/festivals',
    color: 'amber',
    comingSoon: true,
  },
] as const

// Festival pick for the live-proof embed. We use Charanga because the
// webhook + roster + claim flow are real for that slug.
// Proof card — illustrative event for the landing. Swap to the next real
// upcoming WeDance-ticketed event when one exists.
const proofFestival = {
  slug: 'bachata-stars-barcelona-2026',
  name: 'Bachata Stars Barcelona',
  city: 'Barcelona',
  venue: 'Sala Apolo',
  date: 'Fri–Sun, Jul 3–6, 2026',
  badge: 'In 3 days',
  badgeKind: 'upcoming',
}

const loopSteps = [
  { n: 1, title: 'Pick your festival', detail: 'From every dance event we map across Europe.' },
  { n: 2, title: 'Buy your ticket in one tap', detail: 'Secure checkout, instant confirmation, transferable if your plans change.' },
  { n: 3, title: 'See who else is going', detail: 'Opt-in only. No strangers showing up uninvited, no fake friends padding the list.' },
  { n: 4, title: 'Plan the trip together', detail: 'Group dinners, ride shares, first-night practica partners — surfaced before you arrive.' },
  { n: 5, title: 'Arrive with friends', detail: 'You already know the people, the venue, and the floor. Skip the wall.' },
]

const supplyCtas = [
  { label: 'Organize a festival', detail: 'Sell tickets, reach the audience, see who is coming.', href: '/organizers', icon: Calendar },
  { label: 'Teach or DJ', detail: 'Get on the city map, get bookings.', href: '/organizers', icon: Music2, comingSoon: true },
  { label: 'Own a venue', detail: 'List your floor, fill quiet nights.', href: '/organizers', icon: Building2, comingSoon: true },
]

function go(href: string) {
  router.push(href)
}
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <!-- Nav -->
    <header class="border-b">
      <div class="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <NuxtLink to="/" class="font-bold tracking-tight">WeDance</NuxtLink>
        <nav class="flex items-center gap-5 text-sm">
          <NuxtLink to="/festivals" class="text-muted-foreground hover:text-foreground">Festivals</NuxtLink>
          <NuxtLink to="/cities" class="text-muted-foreground hover:text-foreground">Cities</NuxtLink>
          <NuxtLink to="/organizers" class="text-muted-foreground hover:text-foreground hidden sm:inline">For organizers</NuxtLink>
          <NuxtLink to="/auth/verify" class="text-muted-foreground hover:text-foreground">Sign in</NuxtLink>
        </nav>
      </div>
    </header>

    <!-- HERO -->
    <section
      class="relative border-b overflow-hidden"
      style="background:
        radial-gradient(circle at 18% 12%, rgba(244, 114, 182, 0.18), transparent 55%),
        radial-gradient(circle at 88% 18%, rgba(251, 191, 36, 0.16), transparent 50%),
        radial-gradient(circle at 50% 95%, rgba(244, 114, 182, 0.08), transparent 60%);"
    >
      <div class="relative max-w-3xl mx-auto px-4 pt-16 pb-12 sm:pt-24 sm:pb-16 text-center">
        <p class="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          For everyone in dance
        </p>
        <h1 class="mt-4 text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
          From your first salsa class<br>
          to your <em class="font-serif italic font-medium text-primary">tenth festival.</em>
        </h1>
        <p class="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          We map every dance event, every teacher, every venue, every city —
          and tell you who is going before you book.
        </p>

        <div class="mt-8 flex justify-center">
          <Button size="lg" class="gap-2" @click="go('/festivals')">
            Find your next festival <ArrowRight class="w-4 h-4" />
          </Button>
        </div>
      </div>
    </section>

    <!-- STAGE SHELF -->
    <section class="border-b">
      <div class="max-w-6xl mx-auto px-4 py-12 sm:py-16">
        <p class="text-xs uppercase tracking-wider text-muted-foreground font-semibold text-center">
          Wherever you are in dance
        </p>
        <h2 class="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-center">
          Pick your door.
        </h2>

        <div class="mt-8 grid grid-cols-2 md:grid-cols-5 gap-3">
          <button
            v-for="stage in stages"
            :key="stage.label"
            class="text-left rounded-xl border bg-background p-4 hover:shadow-md hover:border-foreground/20 transition-all flex flex-col gap-2 min-h-[140px]"
            @click="go(stage.href)"
          >
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center"
              :class="{
                'bg-pink-100 text-pink-600': stage.color === 'pink',
                'bg-blue-100 text-blue-600': stage.color === 'blue',
                'bg-emerald-100 text-emerald-600': stage.color === 'emerald',
                'bg-orange-100 text-orange-600': stage.color === 'orange',
                'bg-amber-100 text-amber-700': stage.color === 'amber',
              }"
            >
              <component :is="stage.icon" class="w-4 h-4" />
            </div>
            <div class="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
              {{ stage.label }}
            </div>
            <div class="text-sm font-semibold leading-snug">{{ stage.title }}</div>
            <div class="mt-auto text-[11px] text-muted-foreground flex items-center gap-1">
              <span>{{ stage.detail }}</span>
              <span v-if="stage.comingSoon" class="ml-1 text-[9px] uppercase tracking-wider text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">Soon</span>
            </div>
          </button>
        </div>
      </div>
    </section>

    <!-- LIVE PROOF — real festival, real roster -->
    <section class="border-b bg-muted/20">
      <div class="max-w-3xl mx-auto px-4 py-12 sm:py-16">
        <p class="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          This is the product
        </p>
        <h2 class="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">
          See who else is going.
          <span class="text-muted-foreground font-normal">No fake friends.</span>
        </h2>
        <p class="mt-3 text-sm text-muted-foreground max-w-xl">
          Every ticket sold on WeDance turns into a face on the event page.
          Opt-in only — the dancers who want to be seen show up here, so the
          others heading to the same night know who they'll meet.
        </p>

        <!-- Real festival preview card with purple accent ribbon -->
        <div class="mt-6 rounded-xl border bg-background overflow-hidden">
          <!-- Per-festival accent bar (matches /festivals catalog style) -->
          <div class="h-1.5" style="background: linear-gradient(90deg, #7c3aed 0%, #a855f7 100%);" />
          <div class="p-4 sm:p-6">
            <div class="flex items-start justify-between flex-wrap gap-3">
              <div class="min-w-0">
                <div class="text-xs uppercase tracking-wider text-purple-600 font-semibold flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" /> {{ proofFestival.badge }} · {{ proofFestival.city }}
                </div>
                <h3 class="mt-1 text-lg sm:text-xl font-bold tracking-tight">{{ proofFestival.name }}</h3>
                <div class="mt-1 text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                  <span class="inline-flex items-center gap-1"><Calendar class="w-3.5 h-3.5" />{{ proofFestival.date }}</span>
                  <span class="inline-flex items-center gap-1"><MapPin class="w-3.5 h-3.5" />{{ proofFestival.venue }}</span>
                </div>
              </div>
              <Button
                size="sm"
                class="gap-1.5 shrink-0"
                @click="go(`${festivalPath(proofFestival.slug)}`)"
              >
                <Ticket class="w-4 h-4" /> Get tickets
              </Button>
            </div>

            <div class="mt-6">
              <div class="flex items-center justify-between mb-3">
                <div class="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Who's going
                </div>
                <div class="text-[10px] uppercase tracking-wider text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                  Sample
                </div>
              </div>
              <!-- Preview roster — illustrative, not from prod data. The real
                   live <AttendeeRoster> on /festivals/[slug] pulls actual rows. -->
              <div class="flex flex-col sm:flex-row sm:flex-wrap gap-3">
                <div
                  v-for="attendee in previewRoster"
                  :key="attendee.name"
                  class="flex items-center gap-2.5 rounded-lg border bg-background px-3 py-2"
                >
                  <div
                    class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 text-white"
                    :style="{ background: attendee.color }"
                  >
                    {{ attendee.name.charAt(0) }}
                  </div>
                  <div class="min-w-0">
                    <div class="text-sm font-semibold truncate">{{ attendee.name }}</div>
                    <div class="text-[11px] text-muted-foreground flex items-center gap-1">
                      <MapPin class="w-3 h-3" /> {{ attendee.city }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- THE LOOP -->
    <section class="border-b">
      <div class="max-w-3xl mx-auto px-4 py-12 sm:py-16">
        <p class="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          How it works
        </p>
        <h2 class="mt-2 text-2xl sm:text-3xl font-bold tracking-tight">
          Five steps. No surprises.
        </h2>

        <ol class="mt-8 flex flex-col gap-3 sm:gap-4">
          <li
            v-for="step in loopSteps"
            :key="step.n"
            class="flex gap-4 items-start rounded-lg border bg-background p-4"
          >
            <div class="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-sm font-bold shrink-0">
              {{ step.n }}
            </div>
            <div class="min-w-0">
              <div class="text-sm font-semibold">{{ step.title }}</div>
              <div class="text-xs text-muted-foreground mt-0.5">{{ step.detail }}</div>
            </div>
          </li>
        </ol>
      </div>
    </section>

    <!-- FOUNDER NOTE -->
    <section class="border-b bg-muted/20">
      <div class="max-w-2xl mx-auto px-4 py-12 sm:py-16">
        <div class="flex items-start gap-4 sm:gap-5">
          <!-- Real founder photo via GitHub avatar (Alex's @razbakov handle).
               Swap to a polished headshot when you have one. -->
          <img
            src="https://github.com/razbakov.png?size=160"
            alt="Alösha"
            class="w-14 h-14 sm:w-16 sm:h-16 rounded-full shrink-0 object-cover"
          >
          <div class="min-w-0">
            <p class="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              From the founder
            </p>
            <p class="mt-2 text-base sm:text-lg leading-relaxed">
              "The first time I flew to a festival alone, I spent half the
              first night by the wall. I built WeDance so the next dancer does
              not have to."
            </p>
            <p class="mt-3 text-xs text-muted-foreground">
              — Alösha, Munich
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- SUPPLY STRIP — deep aubergine (Cuban dancefloor under blacklight), not flat black -->
    <section class="text-background" style="background: linear-gradient(180deg, #2d1b3d 0%, #1f1230 100%); color: #f5f3ff;">
      <div class="max-w-6xl mx-auto px-4 py-10 sm:py-12">
        <div class="text-center mb-6">
          <p class="text-xs uppercase tracking-wider font-semibold" style="color: rgba(245, 243, 255, 0.6);">
            On the other side of the floor
          </p>
          <h2 class="mt-2 text-xl sm:text-2xl font-bold tracking-tight">
            Run a festival, teach, or own a venue?
          </h2>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            v-for="cta in supplyCtas"
            :key="cta.label"
            class="text-left rounded-lg transition-colors p-4 flex flex-col gap-1.5 border"
            style="border-color: rgba(245, 243, 255, 0.15); background: rgba(245, 243, 255, 0.04);"
            @click="go(cta.href)"
          >
            <component :is="cta.icon" class="w-4 h-4" style="color: rgba(245, 243, 255, 0.7);" />
            <div class="text-sm font-semibold flex items-center gap-2">
              {{ cta.label }}
              <span v-if="cta.comingSoon" class="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded" style="color: #fcd34d; background: rgba(252, 211, 77, 0.12);">Soon</span>
            </div>
            <div class="text-xs" style="color: rgba(245, 243, 255, 0.6);">{{ cta.detail }}</div>
          </button>
        </div>
      </div>
    </section>

    <!-- FINAL CTA -->
    <section class="border-b">
      <div class="max-w-2xl mx-auto px-4 py-12 sm:py-16 text-center">
        <h2 class="text-2xl sm:text-3xl font-bold tracking-tight">
          Your next festival is closer than you think.
        </h2>
        <p class="mt-3 text-sm text-muted-foreground">
          See who else is going. Before you book.
        </p>
        <div class="mt-8">
          <Button size="lg" class="gap-2" @click="go('/festivals')">
            Find your festival <ArrowRight class="w-4 h-4" />
          </Button>
        </div>
      </div>
    </section>

    <!-- Variant switcher -->
    <div class="fixed bottom-3 left-1/2 -translate-x-1/2 z-50">
      <div class="bg-white/95 backdrop-blur border border-stone-200 rounded-full shadow-lg px-3 py-1.5 flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold">
        <span class="text-stone-500 pr-1">Compare</span>
        <NuxtLink to="/sketches/landing/v1" class="px-2 py-0.5 rounded-full text-stone-600 hover:text-stone-900">V1 · Editorial</NuxtLink>
        <NuxtLink to="/sketches/landing/v2" class="px-2 py-0.5 rounded-full text-stone-600 hover:text-stone-900">V2 · Manifesto</NuxtLink>
        <NuxtLink to="/" class="px-2 py-0.5 rounded-full text-stone-600 hover:text-stone-900">V3 · Tropical</NuxtLink>
        <NuxtLink to="/sketches/landing/v4" class="px-2 py-0.5 rounded-full text-stone-600 hover:text-stone-900">V4 · After Dark</NuxtLink>
        <NuxtLink to="/sketches/landing" class="px-2 py-0.5 rounded-full bg-stone-900 text-white">Current</NuxtLink>
      </div>
    </div>

    <!-- FOOTER -->
    <footer class="border-t bg-background">
      <div class="max-w-6xl mx-auto px-4 py-8 text-xs text-muted-foreground">
        <div class="flex flex-wrap items-center gap-x-6 gap-y-3 justify-between">
          <div class="flex items-center gap-2 font-medium text-foreground">
            <Heart class="w-3.5 h-3.5 text-rose-500" /> WeDance
          </div>
          <div class="flex flex-wrap gap-x-5 gap-y-2">
            <NuxtLink to="/festivals" class="hover:text-foreground">Festivals</NuxtLink>
            <NuxtLink to="/cities" class="hover:text-foreground">Cities</NuxtLink>
            <NuxtLink to="/organizers" class="hover:text-foreground">For organizers</NuxtLink>
            <NuxtLink to="/sketches/year" class="hover:text-foreground">Year planner</NuxtLink>
          </div>
        </div>
        <div class="mt-4 text-[11px] text-muted-foreground/70">
          Sketch · /sketches/landing — comparison surface for the live homepage at /
        </div>
      </div>
    </footer>
  </div>
</template>
