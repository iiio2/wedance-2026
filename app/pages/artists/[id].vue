<script setup lang="ts">
/**
 * /artists/[id] — a dance artist's profile.
 * V3 tropical style. Aggregates the artist across every festival and
 * city they appear in (see ~/data/artists.ts).
 */
import { Instagram, Youtube, Globe, Calendar, MapPin, ArrowRight } from 'lucide-vue-next'
import { findArtist, festivalAppearances, cityAppearances, artistOrigin, artistResidence, artistLanguages, placeFlag } from '~/data/artists'
import { WD } from '~/lib/brand'

definePageMeta({ layout: false })

const route = useRoute()
const id = route.params.id as string

const artist = findArtist(id)
if (!artist) {
  throw createError({ statusCode: 404, message: 'Artist not found' })
}

const festivals = festivalAppearances(id)
const cities = cityAppearances(id)
const residence = artistResidence(artist, cities.map((c) => c.city.name))
const origin = artistOrigin(artist)
const languages = artistLanguages(origin, residence)

useHead({
  title: `WeDance — ${artist.name}`,
  meta: [
    { name: 'description', content: artist.bio?.slice(0, 155) || `${artist.name} on WeDance.` },
  ],
})

const platformIcon: Record<string, any> = {
  instagram: Instagram,
  youtube: Youtube,
  website: Globe,
}

function toEmbedUrl(url: string): string {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&/?]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : url
}

function formatDateRange(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()
  if (sameMonth) return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${e.getDate()}, ${e.getFullYear()}`
  return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${e.getFullYear()}`
}
</script>

<template>
  <div class="min-h-screen" style="background:var(--wd-cream); color:var(--wd-brown-900); font-family:var(--wd-font-display);">
    <!-- V3 header -->
    <SiteHeader />

    <!-- HERO -->
    <section class="relative overflow-hidden">
      <!-- Sun rays -->
      <svg class="absolute -top-16 -right-16 w-64 h-64 opacity-20 pointer-events-none" viewBox="0 0 100 100">
        <g :stroke="WD.red600" stroke-width="1.5" fill="none">
          <line v-for="i in 24" :key="i" x1="50" y1="50"
            :x2="50 + 48 * Math.cos(2 * Math.PI * i / 24)"
            :y2="50 + 48 * Math.sin(2 * Math.PI * i / 24)" />
        </g>
      </svg>

      <div class="relative max-w-4xl mx-auto px-4 pt-10 pb-8">
        <NuxtLink to="/artists" class="text-xs italic hover:underline" style="color:var(--wd-amber-600); font-family:var(--wd-font-display);">
          ← all artists
        </NuxtLink>
        <div class="mt-4 flex flex-col sm:flex-row items-start gap-5">
          <!-- Photo with V3 red drop-shadow border -->
          <img
            v-if="artist.photo && !imgError"
            :src="artist.photo"
            :alt="artist.name"
            class="w-28 h-28 sm:w-32 sm:h-32 rounded-full object-cover shrink-0 border-4"
            style="border-color:var(--wd-cream); box-shadow: 6px 7px 0 -2px var(--wd-red-600);"
            @error="imgError = true"
          >
          <div
            v-else
            class="w-28 h-28 sm:w-32 sm:h-32 rounded-full shrink-0 border-4 flex items-center justify-center text-3xl font-black"
            style="border-color:var(--wd-cream); box-shadow: 6px 7px 0 -2px var(--wd-red-600);"
            :style="{ background: WD.red600 + '18', color: WD.red600 }"
          >
            {{ initials }}
          </div>
          <div class="min-w-0 flex-1">
            <h1 class="text-4xl sm:text-6xl leading-[0.98] tracking-tight" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">
              {{ artist.name }}
            </h1>
            <div
              v-if="residence || origin"
              class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm italic"
              style="color:var(--wd-amber-600); font-family:var(--wd-font-display);"
            >
              <span v-if="residence" class="inline-flex items-center gap-1.5" :title="'Based in ' + residence">
                Based in <span class="text-2xl not-italic leading-none">{{ placeFlag(residence) }}</span>
              </span>
              <span v-if="origin && origin !== residence" class="inline-flex items-center gap-1.5" :title="'From ' + origin">
                From <span class="text-2xl not-italic leading-none">{{ placeFlag(origin) }}</span>
              </span>
              <span
                v-if="languages.length"
                class="inline-flex items-center gap-1 not-italic"
                :title="'Speaks ' + languages.map((l) => l.label).join(', ')"
              >
                <span
                  v-for="l in languages"
                  :key="l.code"
                  class="text-[10px] font-bold tracking-wide px-1.5 py-0.5 rounded"
                  style="background:color-mix(in srgb, var(--wd-red-600) 7.8%, transparent); color:var(--wd-red-600); font-family:var(--wd-font-sans);"
                >{{ l.code }}</span>
              </span>
            </div>
            <div v-if="artist.styles.length" class="mt-3 flex flex-wrap gap-1.5">
              <span
                v-for="(s, i) in artist.styles"
                :key="s"
                class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                :style="{
                  background: [WD.red600, WD.cyan600, WD.green600, WD.purple500, WD.amber500][i % 5] + '18',
                  color: [WD.red600, WD.cyan600, WD.green600, WD.purple500, WD.amber500][i % 5],
                }"
              >
                {{ s }}
              </span>
            </div>
            <div v-if="artist.socialLinks?.length" class="mt-4 flex items-center gap-3">
              <a
                v-for="link in artist.socialLinks"
                :key="link.platform"
                :href="link.url"
                target="_blank"
                rel="noopener noreferrer"
                class="transition-colors"
                style="color:var(--wd-amber-600);"
                :title="link.platform"
              >
                <component :is="platformIcon[link.platform]" v-if="platformIcon[link.platform]" class="w-5 h-5" />
                <span v-else class="text-xs italic capitalize">{{ link.platform }}</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <svg class="block w-full h-10 -mb-px" viewBox="0 0 1440 60" preserveAspectRatio="none">
        <path d="M0,40 Q360,0 720,30 T1440,20 V60 H0 Z" :fill="WD.brown900" opacity="0.08"/>
      </svg>
    </section>

    <div class="max-w-4xl mx-auto px-4 py-10 space-y-12">
      <!-- BIO -->
      <section v-if="artist.bio">
        <p class="text-base sm:text-lg leading-relaxed max-w-2xl" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
          {{ artist.bio }}
        </p>
      </section>

      <!-- VIDEO -->
      <section v-if="artist.videoUrl">
        <div class="text-xs uppercase tracking-[0.3em] mb-3" style="color:var(--wd-amber-600);">Watch</div>
        <div class="aspect-video rounded-2xl overflow-hidden bg-white border" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);">
          <iframe
            :src="toEmbedUrl(artist.videoUrl)"
            class="w-full h-full"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          />
        </div>
      </section>

      <!-- FESTIVAL APPEARANCES -->
      <section v-if="festivals.length">
        <div class="text-xs uppercase tracking-[0.3em]" style="color:var(--wd-amber-600);">Catch them at</div>
        <h2 class="mt-2 mb-5 text-2xl leading-tight" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">
          <em class="italic" style="color:var(--wd-red-600);">Festivals.</em>
        </h2>
        <div class="grid gap-4">
          <NuxtLink
            v-for="a in festivals"
            :key="a.festival.slug"
            :to="`/festivals/${a.festival.slug}`"
            class="group block rounded-2xl overflow-hidden bg-white border transition-all hover:-translate-y-1"
            :style="{ borderColor: a.festival.accentColor + '55', boxShadow: '0 1px 0 ' + a.festival.accentColor + '22, 0 8px 22px rgba(59,31,18,0.05)' }"
          >
            <div class="h-1.5" :style="{ background: a.festival.accentColor }" />
            <div class="p-5">
              <div class="flex items-start gap-4">
                <img
                  v-if="a.festival.logo"
                  :src="a.festival.logo"
                  :alt="a.festival.name"
                  class="w-12 h-12 rounded-full shrink-0 shadow-sm"
                >
                <div
                  v-else
                  class="w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-lg font-bold text-white shadow-sm"
                  :style="{ background: a.festival.accentColor }"
                >
                  {{ a.festival.name.charAt(0) }}
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-bold text-lg leading-tight" style="color:var(--wd-brown-900);">{{ a.festival.name }}</h3>
                  <div class="flex items-center gap-4 mt-1 text-xs" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
                    <span class="inline-flex items-center gap-1">
                      <Calendar class="w-3 h-3" style="color:var(--wd-amber-600);" />
                      {{ formatDateRange(a.festival.startDate, a.festival.endDate) }}
                    </span>
                    <span class="inline-flex items-center gap-1">
                      <MapPin class="w-3 h-3" style="color:var(--wd-amber-600);" />
                      {{ a.festival.venue.name }}
                    </span>
                  </div>
                  <!-- Their sessions at this festival -->
                  <div v-if="a.workshops.length" class="mt-3 flex flex-wrap gap-1.5">
                    <span
                      v-for="w in a.workshops"
                      :key="w.id"
                      class="text-[11px] px-2 py-0.5 rounded-full"
                      :style="{ background: a.festival.accentColor + '12', color: 'var(--wd-brown-700)', fontFamily: 'var(--wd-font-sans)' }"
                    >
                      {{ w.day }} {{ w.time }} · {{ w.title }}
                    </span>
                  </div>
                </div>
                <ArrowRight class="w-4 h-4 mt-1.5 shrink-0 transition-transform group-hover:translate-x-1" :style="{ color: a.festival.accentColor }" />
              </div>
            </div>
          </NuxtLink>
        </div>
      </section>

      <!-- CITY / WEEKLY APPEARANCES -->
      <section v-if="cities.length">
        <div class="text-xs uppercase tracking-[0.3em]" style="color:var(--wd-amber-600);">Every week in</div>
        <h2 class="mt-2 mb-5 text-2xl leading-tight" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">
          <em class="italic" style="color:var(--wd-red-600);">Your city.</em>
        </h2>
        <div class="grid gap-4">
          <div
            v-for="a in cities"
            :key="a.city.slug"
            class="rounded-2xl bg-white border p-5"
            style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);"
          >
            <NuxtLink :to="`/cities/${a.city.slug}`" class="inline-flex items-center gap-2 group">
              <h3 class="font-bold text-lg leading-tight" style="color:var(--wd-brown-900);">{{ a.city.name }}</h3>
              <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-1" style="color:var(--wd-red-600);" />
            </NuxtLink>
            <div v-if="a.events.length" class="mt-3 grid gap-1.5">
              <div
                v-for="e in a.events"
                :key="e.id"
                class="text-sm flex items-center gap-2"
                style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);"
              >
                <span class="text-[10px] font-black uppercase tracking-widest w-9 shrink-0" style="color:var(--wd-amber-600);">{{ e.day.slice(0, 3) }}</span>
                <span class="font-bold" style="color:var(--wd-brown-900);">{{ e.time }}</span>
                <span class="truncate">{{ e.name }} · {{ e.venue }}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Nothing scheduled -->
      <section v-if="!festivals.length && !cities.length">
        <div class="rounded-2xl p-6 text-center border-2 border-dashed" style="border-color:color-mix(in srgb, var(--wd-brown-900) 20%, transparent); background:rgba(255,255,255,0.5);">
          <p class="text-sm" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
            No upcoming appearances listed yet.
          </p>
        </div>
      </section>

      <ClientOnly>
        <section class="max-w-3xl mx-auto px-4 pb-10">
          <ReviewsSection target-type="artist" :target-slug="id" :target-name="artist.name" />
        </section>
      </ClientOnly>
    </div>

    <SiteFooter />
  </div>
</template>
