<script setup lang="ts">
/**
 * /cities — the directory, backed by real migrated data (entity.listCities).
 * Each city card shows its real community size (venues · artists · organizers)
 * and links to /cities/[slug]. No mock data.
 * Intent from /find-your-dance (?style=Salsa, ?taster=1) is carried through to
 * the city page so its style filter / taster-class section pick it up.
 */
import { Search, MapPin, ArrowRight, Users, Swords } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { Field } from '~/components/ui/field'
import { CityCombobox, type CityOption } from '~/components/ui/city-combobox'
import { usefulAlts } from '#shared/utils/citySearch'
import { WD } from '~/lib/brand'
import { mixHex, readableOn } from '~/lib/contrast'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — Cities',
  meta: [
    { name: 'description', content: 'Every dance scene — the venues, artists and organizers in your city.' },
  ],
})

const route = useRoute()

// Intent handed over by /find-your-dance — forwarded on every city link.
const taster = computed(() => route.query.taster === '1')
const style = computed(() => (typeof route.query.style === 'string' ? route.query.style.trim() : ''))
const intentQuery = computed(() => ({
  ...(taster.value ? { taster: '1' } : {}),
  ...(style.value ? { style: style.value } : {}),
}))

type CityRow = { city: string; citySlug: string; venues: number; artists: number; organizers: number; total: number; image: string | null; credit: string | null; license: string | null; country: string | null; altNames: string[] }

// SSR-rendered so the list ships in the HTML — no on-mount spinner (see
// server/api/cities.get.ts). The tRPC client is client-only, hence useFetch.
const { data, pending } = await useFetch<CityRow[]>('/api/cities', {
  key: 'cities-directory',
  default: () => [],
})
const cities = computed(() => data.value ?? [])
const loading = computed(() => pending.value)

const searchQuery = ref('')
// The search box doubles as a typeahead: typing filters the grid below, picking a
// suggestion jumps straight to that city (intent carried through). Only cities
// with a directory page are suggested, so every pick lands somewhere real.
const cityOptions = computed<CityOption[]>(() => cities.value.map(c => ({
  name: c.city, slug: c.citySlug, country: c.country, altNames: usefulAlts(c.altNames ?? [], c.citySlug), communities: c.total,
})))
function goToCity(c: CityOption) {
  navigateTo({ path: `/cities/${c.slug}`, query: intentQuery.value })
}
const filteredCities = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return cities.value
  return cities.value.filter(c =>
    c.city.toLowerCase().includes(q)
    || (c.country?.toLowerCase().includes(q) ?? false)
    || (c.altNames?.some(n => n.toLowerCase().includes(q)) ?? false),
  )
})

// Show only the first 9 cities by default for faster load; searching spans all cities.
const displayedCities = computed(() =>
  searchQuery.value.trim() ? filteredCities.value : filteredCities.value.slice(0, 9),
)

const accents = [WD.red600, WD.cyan600, WD.green600, WD.purple500, WD.amber500, WD.pink500, WD.violet600]
// Accent text on its own '18' tint, darkened just enough for 4.5:1.
const chipInk = (c: string) => readableOn(c, mixHex(c, '#fff', 0.094))
const accentFor = (slug: string) => accents[[...slug].reduce((a, c) => a + c.charCodeAt(0), 0) % accents.length]!
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />

    <main>

    <!-- HERO -->
    <section class="relative">
      <div class="max-w-4xl mx-auto px-4 pt-12 pb-8 text-center">
        <div class="text-sm tracking-widest uppercase mb-3 text-secondary">Your local floor</div>
        <h1 class="text-5xl sm:text-6xl leading-[0.98] text-foreground">
          Every scene <em class="italic text-primary">every city.</em>
        </h1>
        <p class="mt-5 text-base sm:text-lg leading-relaxed max-w-xl mx-auto text-muted-foreground">
          The venues, artists and organizers behind every dance scene — find your city's community.
        </p>

        <div
          v-if="taster || style"
          data-testid="city-intent-banner"
          class="mt-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm"
          :style="{ background: taster ? (WD.green600 + '14') : (WD.red600 + '14'), color: taster ? WD.green600 : WD.red600, fontFamily: 'var(--wd-font-sans)' }"
        >
          <MapPin class="w-4 h-4" />
          <template v-if="taster">Pick your city — we'll show {{ style ? `${style} ` : '' }}taster classes coming up.</template>
          <template v-else>Pick your city to find {{ style }} classes.</template>
        </div>

        <div class="mt-8 max-w-lg mx-auto">
          <Field id="city-search" label="Search cities" hide-label class="relative">
            <Search class="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-4 h-4 text-secondary pointer-events-none" aria-hidden="true" />
            <CityCombobox
              v-model="searchQuery"
              :options="cityOptions"
              :show-popular="false"
              free-text
              :limit="6"
              placeholder="Search by city or country"
              @select="goToCity"
              class="h-12 rounded-full pl-11 pr-4 bg-white shadow-[0_1px_0_color-mix(in_srgb,var(--wd-brown-900)_3.9%,transparent),0_6px_16px_rgba(59,31,18,0.04)] focus:shadow-wd-focus"
            />
          </Field>
        </div>
      </div>

      <WaveDivider />
    </section>

    <!-- City Battle CTA — links to the full-screen /battle feed -->
    <section v-if="!searchQuery.trim() && !taster && !style" class="max-w-4xl mx-auto px-4 py-6">
      <NuxtLink
        to="/battle"
        class="group relative flex items-center justify-between gap-4 rounded-2xl p-5 sm:p-6 text-white transition-all hover:scale-[1.01] overflow-hidden"
        style="background: linear-gradient(135deg, var(--wd-brown-900) 0%, color-mix(in srgb, var(--wd-brown-900) 85%, var(--wd-red-600)) 100%); box-shadow: 0 8px 22px rgba(59,31,18,0.18);"
      >
        <div class="flex items-center gap-3.5">
          <div class="w-12 h-12 rounded-full flex items-center justify-center shrink-0" style="background: rgba(255,255,255,0.1); box-shadow: 0 0 0 1px rgba(255,255,255,0.06);">
            <Swords class="w-5 h-5 text-primary" />
          </div>
          <div>
            <div class="font-bold text-lg font-display">City Battle</div>
            <div class="text-sm font-hand" style="font-size: 15px; color: rgba(255,255,255,0.6);">— which city dances best? watch &amp; vote</div>
          </div>
        </div>
        <ArrowRight class="w-5 h-5 text-white/40 group-hover:text-white group-hover:translate-x-1 transition-all shrink-0" />
      </NuxtLink>
    </section>

    <!-- City grid -->
    <section class="max-w-4xl mx-auto px-4 pb-12">
      <div class="flex items-baseline justify-between mb-6">
        <h2 class="text-2xl leading-tight font-display text-foreground">
          {{ searchQuery ? 'Results' : 'Biggest communities' }}
        </h2>
        <span v-if="!loading" class="text-xs text-secondary font-hand" style="font-size:18px;">
          <template v-if="searchQuery">— {{ displayedCities.length }} cit{{ displayedCities.length === 1 ? 'y' : 'ies' }}</template>
          <template v-else>— top {{ displayedCities.length }} of {{ cities.length }}</template>
        </span>
      </div>

      <div v-if="loading" class="text-center py-14 text-secondary font-sans">
        Loading cities…
      </div>

      <div
        v-else-if="!filteredCities.length"
        class="text-center py-14 rounded-2xl border-2 border-dashed border-input bg-white/50"
      >
        <Search class="w-8 h-8 mx-auto mb-3 text-secondary" />
        <p class="text-sm text-muted-foreground font-sans">Nothing matches "{{ searchQuery }}"</p>
        <Button type="button" variant="link" class="mt-2 h-auto p-0 text-xs font-bold underline font-sans" @click="searchQuery = ''">Clear search</Button>
      </div>

      <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="c in displayedCities"
          :key="c.citySlug"
          :to="{ path: `/cities/${c.citySlug}`, query: intentQuery }"
          class="group block rounded-2xl overflow-hidden bg-white border transition-all hover:-translate-y-1"
          :style="{ borderColor: accentFor(c.citySlug) + '55', boxShadow: '0 1px 0 ' + accentFor(c.citySlug) + '22, 0 8px 22px rgba(59,31,18,0.05)' }"
        >
          <!-- Landmark photo (Wikimedia) with the city name overlaid; accent bar when no photo -->
          <div v-if="c.image" class="relative h-32 overflow-hidden">
            <img
              :src="c.image"
              :alt="`${c.city} — landmark`"
              class="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            >
            <div class="absolute inset-0" style="background:linear-gradient(180deg, rgba(59,31,18,0) 35%, rgba(59,31,18,0.7) 100%);" />
            <div class="absolute bottom-2 left-3 right-3">
              <h3 class="font-bold text-xl leading-tight text-white font-display" style="text-shadow:0 1px 12px rgba(0,0,0,0.4);">{{ c.city }}</h3>
              <div v-if="c.country" class="text-meta font-medium text-white/85 font-sans" style="text-shadow:0 1px 8px rgba(0,0,0,0.5);">{{ c.country }}</div>
            </div>
            <span
              v-if="c.credit"
              class="absolute top-1 right-1.5 text-tag px-1 py-px rounded text-white/70 font-sans"
              style="background:rgba(0,0,0,0.25);"
              :title="`${c.credit}${c.license ? ' · ' + c.license : ''} · Wikimedia Commons`"
            >📷</span>
          </div>
          <div v-else class="h-1.5" :style="{ background: accentFor(c.citySlug) }" />
          <div class="p-5">
            <div class="flex items-start justify-between gap-3">
              <div v-if="!c.image">
                <h3 class="font-bold text-xl leading-tight text-foreground">{{ c.city }}</h3>
                <div v-if="c.country" class="text-meta font-medium mt-0.5 text-secondary font-sans">{{ c.country }}</div>
              </div>
              <span v-else class="text-xs font-bold uppercase tracking-wider" :style="{ color: readableOn(accentFor(c.citySlug)) }">Explore</span>
              <ArrowRight class="w-4 h-4 mt-0.5 shrink-0 transition-transform group-hover:translate-x-1" :style="{ color: accentFor(c.citySlug) }" />
            </div>
            <div class="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground font-sans">
              <Users class="w-3 h-3 text-secondary" />
              <span>{{ c.total }} in the community</span>
            </div>
            <div class="flex flex-wrap gap-1.5 mt-3">
              <span v-if="c.venues" class="px-2 py-0.5 rounded-full text-eyebrow font-bold uppercase tracking-wider" :style="{ background: accentFor(c.citySlug) + '18', color: chipInk(accentFor(c.citySlug)) }">{{ c.venues }} venue{{ c.venues === 1 ? '' : 's' }}</span>
              <span v-if="c.artists" class="px-2 py-0.5 rounded-full text-eyebrow font-bold uppercase tracking-wider" :style="{ background: accentFor(c.citySlug) + '18', color: chipInk(accentFor(c.citySlug)) }">{{ c.artists }} artist{{ c.artists === 1 ? '' : 's' }}</span>
              <span v-if="c.organizers" class="px-2 py-0.5 rounded-full text-eyebrow font-bold uppercase tracking-wider" :style="{ background: accentFor(c.citySlug) + '18', color: chipInk(accentFor(c.citySlug)) }">{{ c.organizers }} organizer{{ c.organizers === 1 ? '' : 's' }}</span>
            </div>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- Organizer CTA -->
    <section class="max-w-4xl mx-auto px-4 py-10">
      <div class="rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white border border-wd-cyan-600/[33.3%]" style="box-shadow: 0 1px 0 color-mix(in srgb, var(--wd-cyan-600) 13.3%, transparent), 0 8px 22px rgba(59,31,18,0.05);">
        <div>
          <div class="text-eyebrow uppercase tracking-[0.3em] font-bold mb-1 text-wd-cyan-700">For organizers</div>
          <h3 class="text-lg font-bold text-foreground">Run a class or a weekly social?</h3>
          <p class="text-sm mt-1 text-muted-foreground font-sans">List your event for free. Local dancers find you.</p>
        </div>
        <Button as-child variant="pill" accent="var(--wd-cyan-700)" class="px-5 shrink-0">
          <NuxtLink to="/business/events/new?type=Festival">Create listing <ArrowRight aria-hidden="true" /></NuxtLink>
        </Button>
      </div>
    </section>
    </main>

    <SiteFooter />
  </div>
</template>
