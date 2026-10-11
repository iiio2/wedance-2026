<script setup lang="ts">
/**
 * Homepage — promoted from /sketches/landing/v3 on 2026-06-30.
 *
 * Direction: V3 Tropical — Buena Vista Social Club album art, Havana
 * street murals, 1950s travel posters, hand-painted danzón flyers.
 * Mood: warm, sensual, communal — the page IS the venue.
 *
 * Type: serif display (Playfair Display) + handwritten script (Caveat).
 * Palette: cream paper bg, warm rose / gold / coral / palm green accents.
 * Language: English-first; i18n layer (DE/ES/RU/UK) will follow.
 * Decorative: curved SVG dividers, sun rays, washi tape, dashed-border
 * passport stamps, red drop-shadow border on the hero photo.
 *
 * Previous homepage archived at /sketches/legacy (the kitchen-sink
 * version with swipe cards + checklist + features grid + fake friends).
 * Other visual directions explored at /sketches/landing/{v1, v2, v4,
 * v7, v9, v12} + the early baseline at /sketches/landing.
 */
import { ArrowRight, MapPin, Calendar, Compass, GraduationCap, Users, Plane, Mic, PartyPopper, Ticket } from 'lucide-vue-next'
import { WD } from '~/lib/brand'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — Welcome to the dance',
})

// The 5-stage dancer journey — each card maps to a real product surface
// and a real time horizon. Stage 5 (Business) absorbs the old supply-side
// pitch (organize / teach / DJ / venue) by treating it as the natural
// endpoint of the demand journey, not a separate audience.
const stages = [
  {
    label: 'Seeker',
    title: 'Find your dance',
    detail: 'Free taster classes. Pick by feeling, not guessing.',
    icon: Compass,
    horizon: 'first night',
    href: '/find-your-dance',
    isStartingPoint: true,
  },
  {
    label: 'Student',
    title: 'Find your teacher',
    detail: 'Real profiles. Styles, languages, schools.',
    icon: GraduationCap,
    horizon: 'plan your month',
    href: '/artists',
  },
  {
    label: 'Regular',
    title: 'Find your floor',
    detail: 'Weekly socials and practicas. Go with friends.',
    icon: Users,
    horizon: 'plan your week',
    href: '/cities/munich',
  },
  {
    label: 'Traveler',
    title: 'Find your festival',
    detail: 'Every festival mapped. See who is going.',
    icon: Plane,
    horizon: 'plan your year',
    href: '/festivals',
  },
  {
    label: 'Business',
    title: 'Take the stage',
    detail: 'Teach, DJ, host events, or open a venue. Tools for running the scene, not just dancing in it.',
    icon: Mic,
    horizon: 'the rest of your life',
    href: '/organizers',
  },
]

// Proof section: real attendees from the DB (fallback to static samples).
const { $trpc } = useNuxtApp()
const proofData = ref<{
  title: string; city: string; venue: string; startDate: string; endDate: string
  styles: string[]; link: string; itemType: 'festival' | 'event'; attendeeCount: number
  attendees: { name: string; photo: string | null; city: string | null }[]
} | null>(null)

const FALLBACK_ATTENDEES = [
  { n: 'Maxine', c: 'Vienna', col: WD.red600 },
  { n: 'Dayron', c: 'Madrid', col: WD.cyan600 },
  { n: 'Sofia',  c: 'Munich', col: WD.green600 },
  { n: 'Mark',   c: 'Berlin', col: WD.amber500 },
]
const AVATAR_COLORS = [WD.red600, WD.cyan600, WD.green600, WD.amber500, WD.purple500, WD.pink500, WD.violet600, WD.orange500]

onMounted(async () => {
  try {
    proofData.value = await $trpc.plan.proofShowcase.query()
  } catch { /* keep fallback */ }
})

const hasRealProof = computed(() => !!proofData.value && proofData.value.attendees.length > 0)

const proofEvent = computed(() => {
  if (!proofData.value) return null
  const s = new Date(proofData.value.startDate)
  const e = proofData.value.endDate ? new Date(proofData.value.endDate) : s
  const dateStr = s.toDateString() === e.toDateString()
    ? s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  return { ...proofData.value, dateStr }
})

function avatarInitial(name: string) { return name.charAt(0).toUpperCase() }
function avatarColor(i: number) { return AVATAR_COLORS[i % AVATAR_COLORS.length] }
</script>

<template>
  <div
    class="min-h-screen relative overflow-x-hidden"
    style="
      background:
        radial-gradient(ellipse at 20% 0%, rgba(251, 146, 60, 0.18), transparent 50%),
        radial-gradient(ellipse at 90% 30%, rgba(220, 38, 38, 0.10), transparent 50%),
        radial-gradient(ellipse at 50% 100%, rgba(22, 163, 74, 0.08), transparent 50%),
        var(--wd-cream);
      color:var(--wd-brown-900);
      font-family:var(--wd-font-sans);
    "
  >
    <!-- Subtle paper texture overlay -->
    <div
      class="pointer-events-none fixed inset-0 opacity-[0.18]"
      style="background-image: url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22120%22 height=%22120%22><filter id=%22n%22><feTurbulence type=%22fractalNoise%22 baseFrequency=%220.8%22 numOctaves=%222%22/></filter><rect width=%22120%22 height=%22120%22 filter=%22url(%23n)%22 opacity=%220.6%22/></svg>'); mix-blend-mode: multiply; z-index: 1;"
    />

    <div class="relative z-10">
      <!-- Header — old-fashioned travel poster strip -->
      <SiteHeader />

      <!-- HERO -->
      <section class="relative">
        <div class="max-w-6xl mx-auto px-4 pt-14 pb-20 grid md:grid-cols-12 gap-10 items-center">
          <div class="md:col-span-7 text-center md:text-left">
            <div class="text-sm tracking-widest uppercase mb-3" style="color:var(--wd-amber-600);">
              Welcome to the dance
            </div>
            <h1 class="text-5xl sm:text-7xl leading-[0.95]" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">
              From your<br>
              first <em class="italic" style="color:var(--wd-red-600);">night</em><br>
              to your
              <span class="inline-block relative">
                <span style="color:var(--wd-red-600);">best</span>
                <svg class="absolute left-0 right-0 -bottom-2 w-full h-3" viewBox="0 0 100 10" preserveAspectRatio="none">
                  <path d="M0,8 Q25,2 50,7 T100,4" fill="none" :stroke="WD.red600" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </span>
              <span class="italic" style="font-family:var(--wd-font-display);font-style:italic; color:var(--wd-green-600);"> year.</span>
            </h1>
            <p class="mt-6 text-base sm:text-lg leading-relaxed max-w-md mx-auto md:mx-0" style="color:var(--wd-brown-700);">
              Every dance. Every teacher. Every city.
              Every face — <strong style="color:var(--wd-red-600);">real</strong>.
            </p>
            <div class="mt-8 text-center md:text-left">
              <NuxtLink
                to="/festivals"
                class="wd-cta group inline-flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-bold uppercase tracking-wider"
              >
                <span class="relative z-10">Find your next festival</span>
                <ArrowRight class="w-4 h-4 relative z-10 transition-transform duration-200 ease-out group-hover:translate-x-1 group-active:translate-x-0" />
              </NuxtLink>
              <p class="mt-3 text-sm sm:text-base italic" style="color:var(--wd-amber-600); font-family:var(--wd-font-display);font-style:italic;">
                — see who's going before you book
              </p>
            </div>
          </div>
          <!-- Photo with decorative frame -->
          <div class="md:col-span-5 relative">
            <!-- Sun rays behind photo -->
            <svg class="absolute -top-8 -right-8 w-40 h-40 opacity-30" viewBox="0 0 100 100">
              <g :stroke="WD.orange500" stroke-width="1.5" fill="none">
                <line v-for="i in 24" :key="i" x1="50" y1="50"
                  :x2="50 + 48 * Math.cos(2 * Math.PI * i / 24)"
                  :y2="50 + 48 * Math.sin(2 * Math.PI * i / 24)" />
              </g>
            </svg>
            <div class="relative rounded-2xl overflow-hidden shadow-2xl border-4" style="border-color:var(--wd-cream); box-shadow: 12px 14px 0 -2px var(--wd-red-600);">
              <img src="/alosha-charanga.jpg" alt="Alösha on stage at the end of the Charanga Habanera Munich concert he hosted" class="w-full aspect-[4/5] object-cover" style="object-position: center 30%;">
              <div class="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white">
                <div class="text-[10px] uppercase tracking-[0.3em] opacity-90">Your host · the night he brought the band</div>
                <div class="text-xl mt-1" style="font-family:var(--wd-font-display);font-style:italic;">— Alösha · Charanga Habanera, München</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Wave divider -->
        <svg class="block w-full h-12" viewBox="0 0 1440 60" preserveAspectRatio="none">
          <path d="M0,40 Q360,0 720,30 T1440,20 V60 H0 Z" :fill="WD.brown900" opacity="0.1"/>
        </svg>
      </section>

      <!-- JOURNEY — a hand-drawn travel map with 5 stops along a winding path -->
      <section class="border-y overflow-hidden" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); background:rgba(251, 245, 234, 0.5);">
        <div class="max-w-6xl mx-auto px-4 py-16">
          <div class="text-center mb-12">
            <div class="text-xs uppercase tracking-[0.3em]" style="color:var(--wd-amber-600);">The journey · 5 stops</div>
            <h2 class="mt-3 text-3xl sm:text-5xl leading-tight" style="font-family:var(--wd-font-display);">
              From your first move to <em class="italic" style="color:var(--wd-red-600);">your own stage.</em>
            </h2>
            <p class="mt-4 text-sm sm:text-base max-w-xl mx-auto leading-relaxed" style="color:var(--wd-brown-700);">
              Whatever the dance.
              <span style="font-family:var(--wd-font-display);font-style:italic; color:var(--wd-green-600); font-size:20px;">Whichever step you're on.</span>
            </p>
          </div>

          <!-- Desktop: clean horizontal timeline with numbered stages -->
          <div class="hidden lg:block">
            <div class="relative grid grid-cols-5 gap-6 items-stretch">
              <NuxtLink
                v-for="(s, i) in stages"
                :key="s.label"
                :to="s.href"
                class="group relative rounded-2xl bg-white/95 px-5 py-6 flex flex-col hover:-translate-y-1 transition-all"
                :style="{
                  border: '1px solid ' + [WD.red600, WD.cyan600, WD.green600, WD.amber500, WD.purple500][i] + '55',
                  boxShadow: '0 1px 0 ' + [WD.red600, WD.cyan600, WD.green600, WD.amber500, WD.purple500][i] + '22, 0 12px 28px rgba(59, 31, 18, 0.06)',
                }"
              >
                <!-- Starting point badge (for Seeker stage) -->
                <div v-if="s.isStartingPoint" class="absolute -top-3 left-4 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest" style="background:var(--wd-red-600); color:#fff;">
                  <span>You are here</span>
                </div>
                <!-- Step number + monochrome line icon at top -->
                <div class="flex items-center justify-between mb-4">
                  <span class="text-2xl leading-none" style="font-family:var(--wd-font-display); color:var(--wd-amber-600);">{{ String(i + 1).padStart(2, '0') }}</span>
                  <component :is="s.icon" class="w-6 h-6" :style="{color: [WD.red600, WD.cyan600, WD.green600, WD.amber500, WD.purple500][i], 'stroke-width': 1.5}" />
                </div>
                <div
                  class="h-[3px] w-10 rounded-full mb-3"
                  :style="{ background: [WD.red600, WD.cyan600, WD.green600, WD.amber500, WD.purple500][i] }"
                />
                <div class="text-[10px] uppercase tracking-[0.2em] font-bold" :style="{color: [WD.red600, WD.cyan600, WD.green600, WD.amber500, WD.purple500][i]}">
                  {{ s.label }}
                </div>
                <div class="mt-1 text-lg font-bold leading-tight" style="font-family:var(--wd-font-display);">{{ s.title }}</div>
                <div class="mt-2 text-xs leading-relaxed" style="color:var(--wd-brown-700);">{{ s.detail }}</div>
                <div class="mt-auto pt-4 text-lg leading-none" style="font-family:var(--wd-font-display);font-style:italic; color:var(--wd-amber-600);">
                  {{ s.horizon }}
                </div>
              </NuxtLink>
            </div>

            <!-- Timeline arrow underneath: continuous, directional, honest -->
            <div class="relative mt-8 max-w-[calc(100%-2rem)] mx-auto">
              <div class="relative h-[2px]" style="background: linear-gradient(to right, var(--wd-red-600), var(--wd-cyan-600), var(--wd-green-600), var(--wd-amber-500), var(--wd-purple-500)); opacity: 0.5;">
                <!-- 5 tick marks aligned with the 5 columns -->
                <div
                  v-for="i in 5"
                  :key="'tick-' + i"
                  class="absolute top-1/2 w-2 h-2 rounded-full"
                  :style="{
                    left: `${(i - 1) * 25}%`,
                    transform: 'translate(-50%, -50%)',
                    background: [WD.red600, WD.cyan600, WD.green600, WD.amber500, WD.purple500][i - 1],
                  }"
                />
                <!-- Arrow tip -->
                <div class="absolute top-1/2 right-0 w-0 h-0" style="transform: translate(4px, -50%); border-left: 8px solid var(--wd-purple-500); border-top: 5px solid transparent; border-bottom: 5px solid transparent; opacity: 0.7;"/>
              </div>
              <div class="flex justify-between mt-3 text-[10px] uppercase tracking-[0.2em]" style="color:var(--wd-amber-600);">
                <span>Night one</span>
                <span class="hidden xl:inline">The whole life ahead</span>
                <span class="xl:hidden">The rest of your life →</span>
              </div>
            </div>
          </div>

          <!-- Mobile/tablet: vertical stack with vertical dashed line -->
          <div class="lg:hidden relative">
            <!-- Vertical dashed line -->
            <div class="absolute left-6 top-6 bottom-6 w-px" style="background-image: linear-gradient(to bottom, var(--wd-amber-600) 0, var(--wd-amber-600) 4px, transparent 4px, transparent 10px); background-size: 100% 10px; opacity: 0.5;"/>
            <div class="text-[10px] uppercase tracking-widest ml-12 mb-4" style="font-family:var(--wd-font-display);font-style:italic; font-size: 15px; color:var(--wd-amber-600);">
              you are here ↓
            </div>
            <div class="space-y-4">
              <NuxtLink
                v-for="(s, i) in stages"
                :key="s.label"
                :to="s.href"
                class="relative flex gap-4 items-start rounded-xl px-4 py-4 ml-12 hover:-translate-y-0.5 transition-transform"
                :style="{
                  background: 'rgba(255,255,255,0.85)',
                  border: '2px dashed ' + [WD.red600, WD.cyan600, WD.green600, WD.amber500, WD.purple500][i],
                  boxShadow: '3px 4px 0 -1px ' + [WD.red600, WD.cyan600, WD.green600, WD.amber500, WD.purple500][i] + '2e',
                }"
              >
                <!-- pin connecting to the vertical line -->
                <div
                  class="absolute w-3 h-3 rounded-full"
                  :style="{
                    left: '-2rem',
                    top: '50%',
                    transform: 'translate(-50%, -50%)',
                    background: [WD.red600, WD.cyan600, WD.green600, WD.amber500, WD.purple500][i],
                    boxShadow: '0 0 0 3px rgba(251, 245, 234, 0.9)',
                  }"
                />
                <component :is="s.icon" class="w-6 h-6 shrink-0" :style="{color: [WD.red600, WD.cyan600, WD.green600, WD.amber500, WD.purple500][i], 'stroke-width': 1.5}" />
                <div class="flex-1 min-w-0">
                  <div class="text-[10px] uppercase tracking-widest font-bold" :style="{color: [WD.red600, WD.cyan600, WD.green600, WD.amber500, WD.purple500][i]}">
                    {{ s.label }} · <span style="font-family:var(--wd-font-display);font-style:italic; font-size:14px; color:var(--wd-amber-600); text-transform:none; letter-spacing:normal;">{{ s.horizon }}</span>
                  </div>
                  <div class="mt-0.5 text-base font-bold leading-tight" style="font-family:var(--wd-font-display);">{{ s.title }}</div>
                  <div class="mt-1 text-xs leading-snug" style="color:var(--wd-brown-700);">{{ s.detail }}</div>
                </div>
              </NuxtLink>
            </div>
            <div class="text-[10px] uppercase tracking-widest ml-12 mt-4" style="font-family:var(--wd-font-display);font-style:italic; font-size: 15px; color:var(--wd-amber-600);">
              → the rest of your life
            </div>
          </div>
        </div>
      </section>

      <!-- PROOF -->
      <section class="py-16">
        <div class="max-w-3xl mx-auto px-4 text-center">
          <div class="text-xs uppercase tracking-[0.3em]" style="color:var(--wd-amber-600);">This is the product</div>
          <h2 class="mt-3 text-4xl sm:text-5xl" style="font-family:var(--wd-font-display);">
            <em class="italic">See who else is</em> <span style="color:var(--wd-red-600);">going</span>.
          </h2>
          <p class="mt-4 text-sm sm:text-base leading-relaxed max-w-xl mx-auto" style="color:var(--wd-brown-700);">
            Every ticket sold turns into a face on the event page. <span class="italic" style="font-family:var(--wd-font-display);font-style:italic; font-size:20px;">No fake friends.</span>
          </p>

          <!-- Event card as concert poster — real data when available, sample fallback -->
          <div class="mt-10 mx-auto max-w-md text-left relative">
            <!-- Tape strips -->
            <div class="absolute -top-3 left-6 w-20 h-4 bg-yellow-200/80 rotate-[-4deg] shadow"/>
            <div class="absolute -top-3 right-6 w-20 h-4 bg-yellow-200/80 rotate-[3deg] shadow"/>

            <div class="rounded-lg overflow-hidden shadow-2xl bg-white border" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);">
              <div class="p-6" style="background:linear-gradient(135deg,var(--wd-violet-600) 0%, #c026d3 50%, var(--wd-rose-500) 100%);">
                <template v-if="hasRealProof">
                  <div class="text-[10px] uppercase tracking-[0.3em] text-white/90 font-bold">{{ proofEvent!.city }}</div>
                  <h3 class="mt-2 text-3xl text-white leading-tight" style="font-family:var(--wd-font-display);">
                    {{ proofEvent!.title }}
                  </h3>
                  <div class="mt-2 text-xs text-white/80 flex flex-wrap gap-3">
                    <span class="inline-flex items-center gap-1"><Calendar class="w-3 h-3" /> {{ proofEvent!.dateStr }}</span>
                    <span v-if="proofEvent!.venue" class="inline-flex items-center gap-1"><MapPin class="w-3 h-3" /> {{ proofEvent!.venue }}</span>
                  </div>
                </template>
                <template v-else>
                  <div class="text-[10px] uppercase tracking-[0.3em] text-white/90 font-bold">In 3 days · Barcelona</div>
                  <h3 class="mt-2 text-3xl text-white leading-tight" style="font-family:var(--wd-font-display);">
                    Bachata Stars<br>Barcelona
                  </h3>
                  <div class="mt-2 text-xs text-white/80 flex flex-wrap gap-3">
                    <span class="inline-flex items-center gap-1"><Calendar class="w-3 h-3" /> Jul 3–6, 2026</span>
                    <span class="inline-flex items-center gap-1"><MapPin class="w-3 h-3" /> Sala Apolo</span>
                  </div>
                </template>
              </div>
              <div class="p-5">
                <div class="text-[10px] uppercase tracking-[0.25em] font-bold mb-3 flex items-center justify-between" style="color:var(--wd-amber-600);">
                  <span>Who's coming</span>
                  <span v-if="!hasRealProof" class="px-1.5 py-0.5 rounded text-[9px]" style="background:var(--wd-amber-100); color:var(--wd-amber-800);">Sample</span>
                </div>
                <ul class="grid grid-cols-2 gap-2">
                  <template v-if="hasRealProof">
                    <li v-for="(a, i) in proofData!.attendees" :key="a.name" class="flex items-center gap-2 p-1">
                      <img v-if="a.photo" :src="a.photo" :alt="a.name" class="w-9 h-9 rounded-full object-cover shadow" />
                      <div v-else class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow" :style="{background: avatarColor(i)}">{{ avatarInitial(a.name) }}</div>
                      <div class="min-w-0">
                        <div class="text-sm font-bold truncate">{{ a.name }}</div>
                        <div v-if="a.city" class="text-[10px]" style="color:var(--wd-amber-600);">{{ a.city }}</div>
                      </div>
                    </li>
                  </template>
                  <template v-else>
                    <li v-for="a in FALLBACK_ATTENDEES" :key="a.n" class="flex items-center gap-2 p-1">
                      <div class="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shadow" :style="{background: a.col}">{{ a.n.charAt(0) }}</div>
                      <div class="min-w-0">
                        <div class="text-sm font-bold truncate">{{ a.n }}</div>
                        <div class="text-[10px]" style="color:var(--wd-amber-600);">{{ a.c }}</div>
                      </div>
                    </li>
                  </template>
                </ul>
                <NuxtLink
                  :to="hasRealProof ? proofData!.link : '/festivals/bachata-stars-barcelona-2026'"
                  class="mt-4 block text-center w-full py-3 rounded-full text-white text-xs font-bold uppercase tracking-widest"
                  style="background:linear-gradient(135deg,var(--wd-red-600),var(--wd-orange-500)); box-shadow: 0 4px 0 -1px var(--wd-red-800);"
                >
                  {{ hasRealProof ? 'See all attendees' : 'Get tickets ✨' }}
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- B2B ROUTING — private events + festival organizers.
           Mid-page routing signal for the wrong-audience visitor
           (bride, corporate planner, festival org) who scrolled this far.
           NOT hero-level — dancer funnel stays primary. -->
      <section class="py-16 border-y" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); background:color-mix(in srgb, var(--wd-brown-900) 3.1%, transparent);">
        <div class="max-w-5xl mx-auto px-4">
          <div class="text-center mb-10">
            <div class="text-xs uppercase tracking-[0.3em]" style="color:var(--wd-amber-600);">Hosting the night, not dancing at it?</div>
            <h2 class="mt-3 text-3xl sm:text-4xl leading-tight" style="font-family:var(--wd-font-display);">
              We help you <em class="italic" style="color:var(--wd-red-600);">throw it</em> too.
            </h2>
          </div>

          <div class="grid md:grid-cols-2 gap-6">
            <!-- Private events -->
            <NuxtLink to="/for-events" class="group rounded-2xl bg-white p-6 sm:p-7 border transition-all hover:-translate-y-1"
              :style="{ borderColor: 'color-mix(in srgb, var(--wd-amber-500) 33.3%, transparent)', boxShadow: '0 1px 0 color-mix(in srgb, var(--wd-amber-500) 13.3%, transparent), 0 12px 28px rgba(59, 31, 18, 0.06)' }">
              <div class="flex items-center justify-between mb-3">
                <div class="text-[10px] uppercase tracking-[0.3em] font-bold" style="color:var(--wd-amber-500);">Private events</div>
                <PartyPopper class="w-5 h-5" style="color:var(--wd-amber-500); stroke-width:1.5;" />
              </div>
              <div class="text-xl sm:text-2xl font-bold leading-tight" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">
                Weddings, birthdays, corporate.
              </div>
              <div class="mt-3 text-sm leading-relaxed" style="color:var(--wd-brown-700);">
                We supply the whole night — venue, MC, DJ, dancers, show.
              </div>
              <div class="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-bold uppercase tracking-wider" style="background:linear-gradient(135deg,var(--wd-amber-500),var(--wd-orange-500)); box-shadow: 0 4px 0 -1px #d97706;">
                Book us for your event <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </NuxtLink>

            <!-- Festival organizers -->
            <NuxtLink to="/organizers/create" class="group rounded-2xl bg-white p-6 sm:p-7 border transition-all hover:-translate-y-1"
              :style="{ borderColor: 'color-mix(in srgb, var(--wd-cyan-600) 33.3%, transparent)', boxShadow: '0 1px 0 color-mix(in srgb, var(--wd-cyan-600) 13.3%, transparent), 0 12px 28px rgba(59, 31, 18, 0.06)' }">
              <div class="flex items-center justify-between mb-3">
                <div class="text-[10px] uppercase tracking-[0.3em] font-bold" style="color:var(--wd-cyan-600);">Festival organizers</div>
                <Ticket class="w-5 h-5" style="color:var(--wd-cyan-600); stroke-width:1.5;" />
              </div>
              <div class="text-xl sm:text-2xl font-bold leading-tight" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">
                Ticket your festival on us.
              </div>
              <div class="mt-3 text-sm leading-relaxed" style="color:var(--wd-brown-700);">
                Ticketing + promo + real faces on your event page.
              </div>
              <div class="mt-5 inline-flex items-center gap-2 text-sm font-bold" style="color:var(--wd-cyan-600);">
                Ticket with us <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </div>
            </NuxtLink>
          </div>
        </div>
      </section>

      <!-- LOOP — 5 steps as numbered banderitas -->
      <section class="py-16" style="background:rgba(251, 245, 234, 0.5);">
        <div class="max-w-3xl mx-auto px-4">
          <div class="text-center mb-12">
            <div class="text-xs uppercase tracking-[0.3em]" style="color:var(--wd-amber-600);">How it works</div>
            <h2 class="mt-3 text-3xl sm:text-4xl" style="font-family:var(--wd-font-display);">
              <em class="italic">Five steps.</em> No surprises.
            </h2>
          </div>
          <ol class="space-y-4">
            <li v-for="(s, i) in [
              { t: 'Pick your festival',         b: 'From every dance event we map across Europe.' },
              { t: 'Buy your ticket in one tap', b: 'Secure checkout, instant confirmation.' },
              { t: 'See who else is going',      b: 'Opt-in only. No strangers, no fake friends.' },
              { t: 'Plan the trip together',     b: 'Dinners, ride-shares, first-night partner.' },
              { t: 'Arrive with friends',        b: 'Skip the wall. The floor is waiting.' },
            ]" :key="s.t" class="flex items-start gap-4 bg-white/70 rounded-xl p-4 border" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);">
              <div
                class="w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0 shadow"
                :style="{ background: [WD.red600, WD.orange500, WD.green600, WD.cyan600, WD.purple500][i] }"
              >{{ i + 1 }}</div>
              <div>
                <div class="text-base font-bold" style="font-family:var(--wd-font-display);">{{ s.t }}</div>
                <div class="text-sm mt-0.5" style="color:var(--wd-brown-700);">{{ s.b }}</div>
              </div>
            </li>
          </ol>
        </div>
      </section>

      <!-- FOUNDER — handwritten letter -->
      <section class="py-16">
        <div class="max-w-2xl mx-auto px-4">
          <div class="bg-white/80 rounded-2xl p-8 shadow-xl border-2 border-dashed" style="border-color:color-mix(in srgb, var(--wd-red-600) 26.7%, transparent);">
            <div class="text-[10px] uppercase tracking-[0.3em] mb-4" style="color:var(--wd-amber-600);">A letter from the founder</div>
            <p class="text-2xl leading-relaxed" style="font-family:var(--wd-font-display);font-style:italic; color:var(--wd-brown-900);">
              Dear dancer —<br><br>
              The first time I flew to a festival alone, I spent half the first night by the wall. I built WeDance so the next dancer does not have to.<br><br>
              See you on the floor.
            </p>
            <div class="mt-6 flex items-center gap-3 border-t pt-4" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);">
              <img src="/alosha-dj.jpg" alt="Alösha" class="w-12 h-12 rounded-full object-cover">
              <div>
                <div class="text-lg" style="font-family:var(--wd-font-display);font-style:italic;">— Alösha</div>
                <div class="text-[11px]" style="color:var(--wd-amber-600);">Munich · 2026</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- (Supply strip removed — stage 5 "Take the stage" in the
           journey section above absorbs the organize/teach/DJ/venue
           pitch as the natural endpoint of the dancer's arc.) -->

      <!-- FINAL -->
      <section class="py-20">
        <div class="max-w-2xl mx-auto px-4 text-center">
          <h2 class="text-4xl sm:text-5xl" style="font-family:var(--wd-font-display);">
            <em class="italic">Your next dance</em><br>
            is closer than you <span style="color:var(--wd-red-600);">think.</span>
          </h2>
          <NuxtLink
            to="/festivals"
            class="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-full text-white text-base font-bold uppercase tracking-wider shadow-lg"
            style="background:linear-gradient(135deg,var(--wd-red-600),var(--wd-orange-500)); box-shadow: 0 6px 0 -2px var(--wd-red-800), 0 10px 22px rgba(220, 38, 38, 0.35);"
          >
            Find your festival <ArrowRight class="w-4 h-4" />
          </NuxtLink>
        </div>
      </section>

      <SiteFooter />
    </div>

  </div>
</template>
