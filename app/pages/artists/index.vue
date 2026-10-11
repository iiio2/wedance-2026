<script setup lang="ts">
/**
 * /artists — the artist directory, backed by real migrated profiles
 * (entity.listArtists). The tRPC client is client-only, so we fetch on mount.
 * Each card links to the unified /@<handle> profile.
 */
import { ChevronDown, Heart, MapPin, Search } from 'lucide-vue-next'
import { WD } from '~/lib/brand'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — Artists',
  meta: [
    { name: 'description', content: 'The teachers, DJs, and performers of the Cuban dance scene — every festival, every city.' },
  ],
})

type Artist = { username: string; name: string; photo: string | null; city: string | null; styles: string[]; languages: string[]; bio: string | null }

const langLabel: Record<string, string> = { en: 'EN', es: 'ES', de: 'DE', fr: 'FR', pt: 'PT', it: 'IT', ru: 'RU', hu: 'HU', sl: 'SL' }

const { $trpc } = useNuxtApp()
const { isSignedIn } = useAuth()
const artists = ref<Artist[]>([])
const loading = ref(true)
const followedUsernames = ref(new Set<string>())

onMounted(async () => {
  try {
    artists.value = (await $trpc.entity.listArtists.query()) as Artist[]
  }
  catch { /* leave empty */ }
  finally { loading.value = false }

  if (isSignedIn.value) {
    try {
      const usernames = await $trpc.follow.myFollows.query()
      followedUsernames.value = new Set(usernames)
    } catch {}
  }
})

const searchQuery = ref('')
const selectedStyle = ref('')

const allStyles = computed(() => {
  const s = new Set<string>()
  artists.value.forEach(a => (a.styles || []).forEach(st => s.add(st)))
  return Array.from(s)
})

const allCities = computed(() => {
  const s = new Set<string>()
  artists.value.forEach((a) => { if (a.city) s.add(a.city) })
  return Array.from(s).sort()
})

const route = useRoute()
const cityParam = (Array.isArray(route.query.city) ? route.query.city[0] : route.query.city) || ''
const selectedCity = ref(String(cityParam))

const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return artists.value.filter((a) => {
    const matchesText = !q
      || a.name.toLowerCase().includes(q)
    const matchesCity = !selectedCity.value
      || (a.city && a.city.toLowerCase() === selectedCity.value.toLowerCase())
    const matchesStyle = !selectedStyle.value
      || (a.styles || []).some(s => s.toLowerCase() === selectedStyle.value.toLowerCase())
    return matchesText && matchesCity && matchesStyle
  })
})

const accents = [WD.red600, WD.cyan600, WD.green600, WD.purple500, WD.amber500, WD.pink500, WD.violet600]
const NuxtLinkC = resolveComponent('NuxtLink')
</script>

<template>
  <div class="min-h-screen" style="background:var(--wd-cream); color:var(--wd-brown-900); font-family:var(--wd-font-display);">
    <SiteHeader />

    <!-- HERO -->
    <section class="max-w-4xl mx-auto px-4 pt-10 pb-6 text-center">
      <h1 class="text-4xl sm:text-5xl leading-[0.98]" style="color:var(--wd-brown-900);">
        Who moves <em class="italic" style="color:var(--wd-red-600);">the floor.</em>
      </h1>
      <p class="mt-3 text-base leading-relaxed max-w-xl mx-auto" style="color:var(--wd-brown-700);">
        Teachers, DJs, and performers — follow them across festivals and cities.
      </p>
    </section>

    <!-- TOOLBAR -->
    <section class="sticky top-0 z-30" style="background:var(--wd-cream); border-bottom:1px solid color-mix(in srgb, var(--wd-brown-900) 8.2%, transparent);">
      <div class="max-w-5xl mx-auto px-4 py-2.5">
        <div class="flex flex-wrap items-center gap-3">
          <div class="relative flex-1 min-w-[180px] max-w-xs">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style="color:var(--wd-amber-600);" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search by name"
              class="w-full h-9 rounded-full pl-9 pr-3 text-sm outline-none transition-all"
              style="background:white; border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent); color:var(--wd-brown-900); font-family:var(--wd-font-sans);"
            >
          </div>

          <div v-if="allCities.length" class="relative">
            <select
              v-model="selectedCity"
              class="h-9 pl-3 pr-8 rounded-full text-xs font-bold appearance-none cursor-pointer outline-none"
              :style="selectedCity
                ? { background: 'var(--wd-brown-900)', color: 'var(--wd-cream)' }
                : { background: 'white', color: 'var(--wd-brown-700)', border: '1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent)' }"
              style="font-family:var(--wd-font-sans);"
            >
              <option value="">
                All cities
              </option>
              <option v-for="city in allCities" :key="city" :value="city">
                {{ city }}
              </option>
            </select>
            <ChevronDown class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" :style="{ color: selectedCity ? WD.cream : WD.brown700 }" />
          </div>

          <div v-if="allStyles.length" class="relative">
            <select
              v-model="selectedStyle"
              class="h-9 pl-3 pr-8 rounded-full text-xs font-bold appearance-none cursor-pointer outline-none"
              :style="selectedStyle
                ? { background: accents[allStyles.indexOf(selectedStyle) % accents.length], color: 'white' }
                : { background: 'white', color: 'var(--wd-brown-700)', border: '1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent)' }"
              style="font-family:var(--wd-font-sans);"
            >
              <option value="">
                All styles
              </option>
              <option v-for="style in allStyles" :key="style" :value="style">
                {{ style }}
              </option>
            </select>
            <ChevronDown class="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" :style="{ color: selectedStyle ? 'white' : WD.brown700 }" />
          </div>

          <span class="text-xs ml-auto whitespace-nowrap" style="color:var(--wd-amber-600); font-family:var(--wd-font-display);font-style:italic; font-size:16px;">
            {{ filtered.length }} artist{{ filtered.length === 1 ? '' : 's' }}
          </span>
        </div>
      </div>
    </section>

    <!-- GRID -->
    <section class="max-w-5xl mx-auto px-4 pt-4 pb-16">
      <div v-if="loading" class="text-center py-14" style="color:var(--wd-amber-600); font-family:var(--wd-font-sans);">
        Loading artists…
      </div>

      <div
        v-else-if="!filtered.length"
        class="text-center py-14 rounded-2xl border-2 border-dashed"
        style="border-color:color-mix(in srgb, var(--wd-brown-900) 20%, transparent); background:rgba(255,255,255,0.5);"
      >
        <Search class="w-8 h-8 mx-auto mb-3" style="color:var(--wd-amber-600);" />
        <p class="text-sm" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
          <template v-if="selectedCity && searchQuery">No artists in {{ selectedCity }} match "{{ searchQuery }}"</template>
          <template v-else-if="selectedCity">No artists listed in {{ selectedCity }} yet</template>
          <template v-else-if="searchQuery">Nothing matches "{{ searchQuery }}"</template>
          <template v-else>No artists yet.</template>
        </p>
        <button v-if="searchQuery || selectedCity || selectedStyle" type="button" class="text-xs font-bold mt-2 underline" style="color:var(--wd-red-600); font-family:var(--wd-font-sans);" @click="searchQuery = ''; selectedCity = ''; selectedStyle = ''">
          Clear filters
        </button>
      </div>

      <div v-else class="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        <component
          :is="NuxtLinkC"
          v-for="(a, i) in filtered"
          :key="a.username"
          :to="`/@${a.username}`"
          class="group relative aspect-square rounded-2xl overflow-hidden transition-all hover:-translate-y-1"
          :style="{ boxShadow: '0 2px 8px rgba(59,31,18,0.12)' }"
        >
          <img
            v-if="a.photo"
            :src="a.photo"
            :alt="a.name"
            class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          >
          <div
            v-else
            class="absolute inset-0 flex items-center justify-center text-5xl font-bold text-white"
            :style="{ background: accents[i % accents.length] }"
          >
            {{ a.name.charAt(0) }}
          </div>

          <!-- Following indicator -->
          <div v-if="followedUsernames.has(a.username)" class="absolute top-2.5 right-2.5 z-10">
            <Heart class="w-4 h-4 text-white drop-shadow" style="fill:var(--wd-red-600); color:var(--wd-red-600);" />
          </div>

          <!-- Style labels at top -->
          <div v-if="a.styles?.length" class="absolute top-2.5 left-2.5 flex flex-wrap gap-1 z-10">
            <span
              v-for="st in a.styles.slice(0, 3)"
              :key="st"
              class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
              style="background:rgba(59,31,18,0.55); backdrop-filter: blur(4px);"
            >{{ st }}</span>
          </div>

          <!-- Name + city overlay at bottom -->
          <div
            class="absolute inset-x-0 bottom-0 p-3 pt-10 z-10"
            style="background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.3) 60%, transparent 100%);"
          >
            <h3 class="text-base font-bold leading-tight truncate text-white" style="font-family:var(--wd-font-display);">
              {{ a.name }}
            </h3>
            <p v-if="a.city" class="text-xs inline-flex items-center gap-1 mt-0.5 text-white/80" style="font-family:var(--wd-font-sans);">
              <MapPin class="w-3 h-3" /> {{ a.city }}
            </p>
            <div v-if="a.languages?.length" class="flex gap-1 mt-1">
              <span v-for="l in a.languages.slice(0, 3)" :key="l" class="text-[9px] font-bold tracking-wide px-1 py-px rounded text-white/90" style="background:rgba(255,255,255,0.2); backdrop-filter: blur(4px);">{{ langLabel[l] || l.toUpperCase() }}</span>
            </div>
          </div>
        </component>
      </div>
    </section>

    <SiteFooter />
  </div>
</template>
