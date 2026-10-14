<script setup lang="ts">
import type { Festival } from '~/types/festival'
import { Instagram, Globe, Facebook, Users, Star, Ticket, Check, Plus } from 'lucide-vue-next'
import { daysUntil as formatDaysUntil } from '#shared/utils/festivalDateFormatter'
import { accentText, readableAccent } from '~/lib/accent'
import { Button } from '~/components/ui/button'

// Shared hero for festivals AND events (an event is just a smaller festival).
// `reviewTargetType` + `entityLabel` let the same hero serve either.
const props = withDefaults(defineProps<{
  festival: Festival
  reviewTargetType?: 'festival' | 'event' | 'venue' | 'artist' | 'organizer'
  entityLabel?: string
  // Where the non-ticket CTA scrolls (festivals use the in-page #discover flow;
  // events point at their #discover section too). And an optional clearer label.
  ctaAnchor?: string
  ctaFallbackLabel?: string
  // Add-to-plan ("Pick") state — shown alongside tickets. Parent owns the store
  // (year-plan for festivals, week-plan for events) and toggles on `pick`.
  picked?: boolean
  // Pre-formatted date line (events pass wall-clock time in the event's zone).
  dateLabel?: string
}>(), { reviewTargetType: 'festival', entityLabel: 'festival', ctaAnchor: '#discover' })

defineEmits<{ pick: [] }>()

// Review rating (client-side — the tRPC client is client-only). Renders after
// mount; null until then so SSR + first client render match (no hydration jump).
const { $trpc } = useNuxtApp()
const rating = ref<{ average: number; count: number } | null>(null)
onMounted(async () => {
  try {
    const r = await $trpc.review.list.query({ targetType: props.reviewTargetType, targetSlug: props.festival.slug })
    rating.value = { average: r.average, count: r.count }
  } catch { /* leave null */ }
})

// Primary CTA: external tickets when we have a link, else scroll to the
// in-page join/discover flow.
const hasTickets = computed(() => !!props.festival.ticketUrl)
const ctaHref = computed(() => props.festival.ticketUrl || props.ctaAnchor)
const ctaLabel = computed(() => (props.festival.ticketUrl ? 'Get tickets' : (props.ctaFallbackLabel || `Join the ${props.entityLabel}`)))

const dateRange = computed(() => {
  if (props.dateLabel) return props.dateLabel
  const start = new Date(props.festival.startDate)
  const end = new Date(props.festival.endDate)
  // Single-day (events) → one date; multi-day (festivals) → a range.
  if (start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
  }
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
})

const platformIcon: Record<string, any> = {
  instagram: Instagram,
  facebook: Facebook,
  website: Globe,
}

const daysUntil = computed(() => formatDaysUntil(props.festival.startDate))

// Accent text on its own tint / white-on-accent buttons, darkened only when the
// festival colour is too light for 4.5:1.
const chipText = computed(() => accentText(props.festival.accentColor))
const buttonAccent = computed(() => readableAccent(props.festival.accentColor))

// Sun rays. Rounded so SSR and the client serialise identical coordinates
// (raw Math.cos output differed in the last digits → hydration mismatch).
const rays = Array.from({ length: 24 }, (_, i) => {
  const a = 2 * Math.PI * (i + 1) / 24
  return { x: Math.round((50 + 48 * Math.cos(a)) * 1000) / 1000, y: Math.round((50 + 48 * Math.sin(a)) * 1000) / 1000 }
})
</script>

<template>
  <section class="relative overflow-hidden bg-background">
    <!-- Sun rays behind the whole hero, tinted by festival accent -->
    <svg
      class="absolute -top-16 -right-16 w-72 h-72 opacity-20 pointer-events-none"
      viewBox="0 0 100 100"
      aria-hidden="true"
    >
      <g :stroke="festival.accentColor" stroke-width="1.5" fill="none">
        <line
          v-for="(r, i) in rays"
          :key="i"
          x1="50"
          y1="50"
          :x2="r.x"
          :y2="r.y"
        />
      </g>
    </svg>

    <div class="relative max-w-4xl mx-auto px-4 pt-10 pb-12">
      <div class="flex items-start gap-5">
        <!-- Logo with V3 red drop-shadow border -->
        <div class="shrink-0 relative">
          <img
            v-if="festival.logo"
            :src="festival.logo"
            :alt="festival.name"
            class="w-20 h-20 rounded-full border-4 border-background"
            :style="{ boxShadow: '4px 5px 0 -1px ' + festival.accentColor }"
          >
          <div
            v-else
            class="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white border-4 border-background"
            :style="{ background: festival.accentColor, boxShadow: '4px 5px 0 -1px ' + festival.accentColor }"
          >
            {{ festival.name.charAt(0) }}
          </div>
        </div>

        <div class="flex-1 min-w-0">
          <!-- Eyebrow: days-until in Caveat, colored -->
          <div
            data-visual-mask
            class="text-lg leading-none mb-2 font-hand"
            :style="{ color: festival.accentColor }"
          >
            — {{ daysUntil }}
          </div>

          <!-- Festival name in Playfair -->
          <h1
            class="text-3xl sm:text-5xl leading-[0.98] tracking-tight font-display text-foreground"
          >
            {{ festival.name }}
          </h1>

          <!-- Date + venue -->
          <p
            class="mt-2 text-sm sm:text-base italic font-display text-muted-foreground"
          >
            {{ dateRange }} <span class="text-secondary">·</span> {{ festival.venue.name }}
          </p>

          <!-- Meta: attendees + socials -->
          <div class="mt-3 flex flex-wrap items-center gap-3 text-xs">
            <span
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold font-sans"
              :style="{ background: festival.accentColor + '18', color: chipText }"
            >
              <Users class="w-3 h-3" aria-hidden="true" />
              {{ festival.attendeeCount }} planning
            </span>
            <!-- Review rating (appears once loaded), links to the reviews section -->
            <a
              v-if="rating && rating.count"
              href="#reviews"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full font-bold font-sans bg-wd-amber-500/12 text-wd-amber-700"
            >
              <Star class="w-3 h-3 fill-wd-amber-500 text-wd-amber-500" aria-hidden="true" />
              {{ rating.average.toFixed(1) }}
              <span class="opacity-65">· {{ rating.count }}</span>
            </a>
            <div v-if="festival.socialLinks.length" class="flex items-center gap-2">
              <a
                v-for="link in festival.socialLinks"
                :key="link.platform"
                :href="link.url"
                target="_blank"
                rel="noopener noreferrer"
                class="transition-colors text-secondary hover:text-primary"
                :title="link.platform"
                :aria-label="link.platform"
              >
                <component
                  :is="platformIcon[link.platform]"
                  v-if="platformIcon[link.platform]"
                  class="w-4 h-4"
                />
                <span v-else class="text-xs capitalize italic">{{ link.platform }}</span>
              </a>
            </div>
          </div>

          <!-- CTAs: Get tickets (external, if any) + Pick (add to plan). Both. -->
          <div class="mt-4 flex flex-wrap gap-2">
            <Button v-if="hasTickets" as-child variant="cta" :accent="buttonAccent" class="px-5">
              <a
                :href="festival.ticketUrl"
                target="_blank"
                rel="noopener noreferrer"
                @click="useTrack().track('ticket_cta_click', { entity: reviewTargetType, slug: festival.slug })"
              >
                <Ticket aria-hidden="true" /> Get tickets
              </a>
            </Button>
            <Button
              type="button"
              :variant="picked ? 'pill' : 'outline-pill'"
              :accent="buttonAccent"
              class="px-5"
              :aria-pressed="picked"
              @click="$emit('pick')"
            >
              <component :is="picked ? Check : Plus" aria-hidden="true" /> {{ picked ? 'Going!' : 'Going?' }}
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- Wave divider, matching the homepage -->
    <WaveDivider class="-mb-px" />
  </section>
</template>
