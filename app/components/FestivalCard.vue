<script setup lang="ts">
/**
 * Festival card — the /festivals listing row (anatomy: /docs/design/patterns/cards).
 *
 *   <FestivalCard :festival="f" :picked="yearPlanIds.has(f.slug)" @pick="onPick(f.slug)" />
 *
 * Stretched link: the title is the only <a>; its ::after covers the card so the
 * whole surface navigates, while the "Going?" button sits above it (relative z-10).
 * A <button> inside an <a> is invalid HTML and announced as one blob.
 */
import { Calendar, MapPin, Users } from 'lucide-vue-next'
import { daysUntil } from '#shared/utils/festivalDateFormatter'
import { Button } from '~/components/ui/button'
import { WD } from '~/lib/brand'
import { accentText, readableAccent } from '~/lib/accent'
import { festivalPath } from '#shared/utils/eventSlug'

export interface FestivalCardData {
  slug: string
  name: string
  startDate: string | null
  endDate: string | null
  city: string | null
  country: string | null
  styles: string[]
  logo: string | null
  accentColor: string | null
  signupCount: number
  /** Public attendees for the avatar stack (RAZ-84) */
  goingAvatars?: { name: string, photo: string | null }[]
  publicGoingCount?: number
}

const props = withDefaults(defineProps<{
  festival: FestivalCardData
  /** Already in the dancer's year plan → "Going!" */
  picked?: boolean
  /** Style chips shown before "+N". */
  maxStyles?: number
}>(), { picked: false, maxStyles: 4 })

defineEmits<{ pick: [] }>()

const accent = computed(() => props.festival.accentColor || WD.amber600)
// Chip text on its own 9 % tint, darkened only when the accent is too light for 4.5:1.
const chipText = computed(() => accentText(accent.value))
const buttonAccent = computed(() => readableAccent(accent.value))

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('')
}

const location = computed(() => [props.festival.city, props.festival.country].filter(Boolean).join(', ') || 'TBA')

const dateRange = computed(() => {
  const { startDate, endDate } = props.festival
  if (!startDate || !endDate) return ''
  const s = new Date(startDate)
  const e = new Date(endDate)
  const short = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  if (s.getMonth() === e.getMonth()) return `${short(s)}–${e.getDate()}, ${e.getFullYear()}`
  return `${short(s)} – ${short(e)}, ${e.getFullYear()}`
})
</script>

<template>
  <article
    class="group relative rounded-2xl overflow-hidden bg-card border transition-all hover:-translate-y-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
    :style="{ borderColor: accent + '55', boxShadow: '0 1px 0 ' + accent + '22, 0 8px 22px rgba(59,31,18,0.05)' }"
  >
    <!-- Colour accent bar -->
    <div class="h-1.5" :style="{ background: accent }" />

    <div class="p-5">
      <div class="flex items-start gap-4">
        <img
          v-if="festival.logo"
          :src="festival.logo"
          :alt="festival.name"
          class="w-14 h-14 rounded-full shrink-0 shadow-sm"
        >
        <div
          v-else
          class="w-14 h-14 rounded-full shrink-0 flex items-center justify-center text-xl font-bold text-white shadow-sm"
          :style="{ background: accent }"
          aria-hidden="true"
        >
          {{ festival.name.charAt(0) }}
        </div>

        <div class="flex-1 min-w-0">
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-bold text-lg leading-tight text-foreground">
              <NuxtLink :to="`${festivalPath(festival.slug)}`" class="outline-none after:absolute after:inset-0">
                {{ festival.name }}
              </NuxtLink>
            </h3>
            <span
              v-if="festival.startDate"
              data-visual-mask
              class="font-hand text-[15px] font-bold shrink-0 mt-1"
              :style="{ color: accent }"
            >
              {{ daysUntil(festival.startDate) }}
            </span>
          </div>

          <div class="flex items-center gap-4 mt-1 text-xs font-sans text-muted-foreground">
            <span v-if="dateRange" class="flex items-center gap-1">
              <Calendar class="w-3 h-3 text-secondary" aria-hidden="true" />
              {{ dateRange }}
            </span>
            <span class="flex items-center gap-1">
              <MapPin class="w-3 h-3 text-secondary" aria-hidden="true" />
              {{ location }}
            </span>
          </div>

          <!-- Styles -->
          <div class="flex flex-wrap gap-1.5 mt-3">
            <span
              v-for="style in festival.styles.slice(0, maxStyles)"
              :key="style"
              class="px-2 py-0.5 rounded-full text-eyebrow font-bold uppercase tracking-wider"
              :style="{ background: accent + '18', color: chipText }"
            >
              {{ style }}
            </span>
            <span v-if="festival.styles.length > maxStyles" class="px-2 py-0.5 rounded-full text-eyebrow text-secondary">
              +{{ festival.styles.length - maxStyles }}
            </span>
          </div>

          <!-- Stats row -->
          <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs font-sans text-muted-foreground">
            <div v-if="festival.goingAvatars?.length" class="flex items-center">
              <div class="flex -space-x-2" aria-hidden="true">
                <template v-for="(a, i) in festival.goingAvatars.slice(0, 5)" :key="i">
                  <img v-if="a.photo" :src="a.photo" alt="" class="w-6 h-6 rounded-full border-2 border-white object-cover">
                  <div
                    v-else
                    class="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-bold text-white"
                    :style="{ background: buttonAccent }"
                  >
                    {{ initials(a.name) }}
                  </div>
                </template>
                <div
                  v-if="(festival.publicGoingCount ?? 0) > 5"
                  class="w-6 h-6 rounded-full border-2 border-white bg-background text-muted-foreground flex items-center justify-center text-[8px] font-bold"
                >
                  +{{ festival.publicGoingCount! - 5 }}
                </div>
              </div>
              <span class="ml-2 flex items-center gap-1">
                <Users class="w-3 h-3 text-secondary" aria-hidden="true" />
                {{ festival.signupCount }} going
              </span>
            </div>
            <span v-else-if="festival.signupCount" class="flex items-center gap-1">
              <Users class="w-3 h-3 text-secondary" aria-hidden="true" />
              {{ festival.signupCount }} going
            </span>
            <Button
              type="button"
              :variant="picked ? 'pill' : 'outline-pill'"
              size="pill-sm"
              :accent="buttonAccent"
              class="relative z-10 ml-auto normal-case tracking-normal"
              :aria-pressed="picked"
              @click="$emit('pick')"
            >
              {{ picked ? 'Going!' : 'Going?' }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </article>
</template>
