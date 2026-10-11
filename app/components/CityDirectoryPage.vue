<script setup lang="ts">
/**
 * A full, standalone, SEO-first listing of one role (artists / organisers /
 * venues) for a city — the "See all" target from /cities/[city]. SSR-rendered
 * with a data-driven <title>, canonical URL, and BreadcrumbList + ItemList
 * JSON-LD so each city×role page is independently indexable.
 */
import { ArrowLeft, MapPin } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { WD } from '~/lib/brand'
import { readableOn } from '~/lib/contrast'

const props = defineProps<{ role: 'artists' | 'organisers' | 'venues' }>()

const route = useRoute()
const slug = route.params.city as string
const { dir, cityName, accent, stylePhrase } = useCityDirectory(slug)

const people = computed(() => {
  const d = dir.value
  if (!d) return []
  return props.role === 'artists' ? d.artists : props.role === 'organisers' ? d.organizers : d.venues
})

const roleLabel = computed(() =>
  props.role === 'artists' ? 'Artists' : props.role === 'organisers' ? 'Organisers' : 'Venues',
)

const heading = computed(() => {
  if (props.role === 'artists') return { kicker: 'Every artist & teacher', accentWord: 'artists' }
  if (props.role === 'organisers') return { kicker: 'Who runs the floor', accentWord: 'organisers' }
  return { kicker: 'Where you dance', accentWord: 'venues' }
})

const title = computed(() => {
  if (props.role === 'artists') return `${stylePhrase.value} Artists & Teachers in ${cityName.value} — WeDance`
  if (props.role === 'organisers') return `Dance Organisers & Promoters in ${cityName.value} — WeDance`
  return `Dance Venues in ${cityName.value} — WeDance`
})
const description = computed(() => {
  if (props.role === 'artists') return `Every ${stylePhrase.value.toLowerCase()} artist, teacher and DJ in ${cityName.value} — browse the local dance scene on WeDance.`
  if (props.role === 'organisers') return `The organisers and promoters running social dance events in ${cityName.value}. Find who to dance with on WeDance.`
  return `Social dance venues and floors in ${cityName.value} — where to dance, on WeDance.`
})

const photo = (p: any) =>
  p.photo || `https://ui-avatars.com/api/?name=${encodeURIComponent(p.name || '?')}&size=160&background=ec4899&color=fff&bold=true&rounded=true`

// Absolute origin for canonical + JSON-LD (correct in SSR and any env).
const origin = useRequestURL().origin
const canonical = computed(() => `${origin}/cities/${slug}/${props.role}`)

const jsonld = computed(() => JSON.stringify([
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'WeDance', item: `${origin}/` },
      { '@type': 'ListItem', position: 2, name: 'Cities', item: `${origin}/cities` },
      { '@type': 'ListItem', position: 3, name: cityName.value, item: `${origin}/cities/${slug}` },
      { '@type': 'ListItem', position: 4, name: roleLabel.value, item: canonical.value },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${roleLabel.value} in ${cityName.value}`,
    numberOfItems: people.value.length,
    itemListElement: people.value.slice(0, 100).map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.name,
      url: `${origin}/@${p.username}`,
    })),
  },
]))

useHead(() => ({
  title: title.value,
  meta: [{ name: 'description', content: description.value }],
  link: [
    { rel: 'canonical', href: canonical.value },
  ],
  script: [{ type: 'application/ld+json', innerHTML: jsonld.value }],
}))
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />

    <main>

    <section class="max-w-4xl mx-auto px-4 pt-8 pb-4">
      <!-- Breadcrumb back to the city hub -->
      <nav class="text-xs mb-4 text-secondary font-sans" aria-label="Breadcrumb">
        <NuxtLink to="/cities" class="underline underline-offset-2 hover:no-underline">Cities</NuxtLink>
        <span class="mx-1.5">/</span>
        <NuxtLink :to="`/cities/${slug}`" class="underline underline-offset-2 hover:no-underline">{{ cityName }}</NuxtLink>
        <span class="mx-1.5">/</span>
        <span class="text-muted-foreground">{{ roleLabel }}</span>
      </nav>

      <div class="text-xs uppercase tracking-[0.3em] text-secondary">{{ heading.kicker }}</div>
      <h1 class="mt-2 text-4xl sm:text-5xl leading-[1.02] tracking-tight font-display text-foreground">
        {{ roleLabel }} in
        <em class="italic" :style="{ color: accent }">{{ cityName }}</em>
      </h1>
      <p class="mt-2 text-sm italic text-muted-foreground">
        {{ people.length }} {{ heading.accentWord }} in {{ cityName }}.
        <NuxtLink :to="`/cities/${slug}`" class="not-italic font-bold underline underline-offset-2 font-sans" :style="{ color: readableOn(accent, WD.cream) }">
          ← Back to this week
        </NuxtLink>
      </p>
    </section>

    <section class="max-w-4xl mx-auto px-4 pb-16">
      <div v-if="people.length" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        <NuxtLink
          v-for="p in people"
          :key="p.username || p.name || ''"
          :to="`/@${p.username}`"
          class="group relative aspect-square rounded-2xl overflow-hidden transition-all hover:-translate-y-1"
          :style="{ boxShadow: '0 2px 8px rgba(59,31,18,0.12)' }"
        >
          <img
            :src="photo(p)"
            :alt="p.name || ''"
            loading="lazy"
            class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          >

          <!-- Style labels at top -->
          <div v-if="p.styles?.length" class="absolute top-2.5 left-2.5 flex flex-wrap gap-1 z-10">
            <span
              v-for="st in p.styles.slice(0, 3)"
              :key="st"
              class="text-eyebrow font-bold uppercase tracking-wider px-2 py-0.5 rounded-full text-white"
              style="background:rgba(59,31,18,0.55); backdrop-filter: blur(4px);"
            >{{ st }}</span>
          </div>

          <!-- Name overlay at bottom -->
          <div
            class="absolute inset-x-0 bottom-0 p-3 pt-10 z-10"
            style="background: linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.3) 60%, transparent 100%);"
          >
            <div class="text-sm font-bold leading-tight truncate text-white">
              {{ p.name }}
            </div>
          </div>
        </NuxtLink>
      </div>

      <div
        v-else
        class="rounded-2xl border-2 border-dashed p-10 text-center border-input bg-white/50"
      >
        <MapPin class="w-6 h-6 mx-auto mb-2 text-secondary" aria-hidden="true" />
        <p class="text-sm font-bold text-foreground">No {{ roleLabel.toLowerCase() }} listed in {{ cityName }} yet.</p>
        <Button as-child variant="cta" size="sm" class="mt-4 px-5 text-xs">
          <NuxtLink to="/for-events">List yours</NuxtLink>
        </Button>
      </div>

      <!-- Local groups (WhatsApp / Telegram / …) live under Organisers — a
           community that runs a chat is an organiser without a profile yet. -->
      <ClientOnly v-if="role === 'organisers'">
        <CommunityGroupsSection :city-slug="slug" :city-name="cityName" />
      </ClientOnly>
    </section>

    </main>


    <SiteFooter />
  </div>
</template>
