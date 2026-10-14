<script setup lang="ts">
/**
 * ArtistCard — the face-forward artist card used on /artists and the
 * festival lineup. Shows photo, name, residence (pin) + origin (globe),
 * styles, and an optional bio snippet.
 *
 * Two modes:
 * - default (link): the whole card is a link to the artist profile.
 * - selectable (festival lineup): the name is a button that emits
 *   `select` (to filter the schedule) and is stretched over the card
 *   (after:absolute inset-0), so the whole card still toggles; the
 *   "Full profile →" link sits above it (relative z-10). A link inside a
 *   <button> root was invalid HTML.
 */
import { Plane, ArrowRight } from 'lucide-vue-next'
import type { Teacher } from '~/types/festival'
import { placeFlag, type Language } from '~/data/artists'
import { accentText } from '~/lib/accent'

const props = withDefaults(defineProps<{
  artist: Teacher
  accent: string
  origin?: string | null
  residence?: string | null
  languages?: Language[]
  festivalCount?: number | null
  showBio?: boolean
  selectable?: boolean
  selected?: boolean
}>(), {
  origin: null,
  residence: null,
  languages: () => [],
  festivalCount: null,
  showBio: true,
  selectable: false,
  selected: false,
})

const emit = defineEmits<{ select: [] }>()
// Line-up ids are profile handles: the profile lives at /@handle.
const profileHref = computed(() => `/@${props.artist.id}`)

const imgError = ref(false)
const initials = computed(() =>
  props.artist.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)

// Root is a link (whole card → profile) unless selectable (festival
// lineup), where it's a plain box holding a stretched button + a link.
const NuxtLinkComponent = resolveComponent('NuxtLink')
const rootTag = computed(() => (props.selectable ? 'div' : NuxtLinkComponent))

// Accent text on its own tint, darkened only when the accent is too light for 4.5:1.
const chipText = computed(() => accentText(props.accent))
const langText = computed(() => accentText(props.accent, 0.078))
</script>

<template>
  <component
    :is="rootTag"
    :to="selectable ? undefined : profileHref"
    class="group relative w-full text-left rounded-2xl bg-card border overflow-hidden flex flex-col transition-all hover:-translate-y-1 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring"
    :style="{
      borderColor: selected ? accent : accent + '55',
      borderWidth: selected ? '2px' : '1px',
      boxShadow: selected
        ? '0 0 0 3px ' + accent + '22, 0 8px 22px rgba(59,31,18,0.06)'
        : '0 1px 0 ' + accent + '22, 0 8px 22px rgba(59,31,18,0.05)',
    }"
  >
    <!-- Face first -->
    <div class="relative aspect-square overflow-hidden" :style="{ background: accent + '12' }">
      <img
        v-if="artist.photo && !imgError"
        :src="artist.photo"
        :alt="artist.name"
        class="w-full h-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.04]"
        @error="imgError = true"
      >
      <div
        v-else
        class="w-full h-full flex items-center justify-center text-4xl font-black"
        :style="{ background: accent + '18', color: accent }"
      >
        {{ initials }}
      </div>
      <div v-if="festivalCount != null" class="absolute top-3 left-3">
        <span
          class="inline-flex items-center gap-1 text-eyebrow font-bold px-2 py-0.5 rounded-full text-white"
          style="background:rgba(59,31,18,0.55); backdrop-filter: blur(4px);"
          :title="`${festivalCount} festival${festivalCount === 1 ? '' : 's'}`"
        >
          <Plane class="w-3 h-3" aria-hidden="true" /> {{ festivalCount }}
        </span>
      </div>
      <div
        v-if="selected"
        class="absolute top-3 right-3 text-eyebrow font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
        :style="{ background: accent }"
      >
        Filtering
      </div>
    </div>

    <div class="p-4 flex flex-col flex-1">
      <div class="font-bold text-lg leading-tight font-display text-foreground">
        <button
          v-if="selectable"
          type="button"
          class="text-left outline-none after:absolute after:inset-0 cursor-pointer"
          :aria-pressed="selected"
          @click="emit('select')"
        >
          {{ artist.name }}
        </button>
        <template v-else>{{ artist.name }}</template>
      </div>

      <!-- Place flags + languages (2-letter codes) -->
      <div
        v-if="residence || origin || languages.length"
        class="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1"
      >
        <span class="inline-flex items-center gap-1 text-lg leading-none">
          <span v-if="residence" :title="'Based in ' + residence">{{ placeFlag(residence) }}</span>
          <span v-if="origin && origin !== residence" :title="'From ' + origin">{{ placeFlag(origin) }}</span>
        </span>
        <span
          v-if="languages.length"
          class="inline-flex items-center gap-1"
          :title="'Speaks ' + languages.map((l) => l.label).join(', ')"
        >
          <span
            v-for="l in languages"
            :key="l.code"
            class="text-tag font-bold tracking-wide px-1.5 py-0.5 rounded"
            :style="{ background: accent + '14', color: langText }"
          >{{ l.code }}</span>
        </span>
      </div>

      <div v-if="artist.styles.length" class="mt-2 flex flex-wrap gap-1">
        <span
          v-for="s in artist.styles.slice(0, 3)"
          :key="s"
          class="text-tag font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
          :style="{ background: accent + '18', color: chipText }"
        >{{ s }}</span>
      </div>

      <p
        v-if="showBio && artist.bio"
        class="mt-2.5 text-xs leading-relaxed line-clamp-2 font-sans text-muted-foreground"
      >
        {{ artist.bio }}
      </p>

      <!-- Footer -->
      <div class="mt-auto pt-3 flex items-center justify-between">
        <NuxtLink
          v-if="selectable"
          :to="profileHref"
          class="relative z-10 text-xs italic hover:underline font-display text-secondary"
        >
          Full profile →
        </NuxtLink>
        <span
          v-else
          class="text-xs italic font-display text-secondary"
        >
          View profile →
        </span>
        <span
          v-if="selectable"
          class="inline-flex items-center gap-1 text-xs font-bold"
          :style="{ color: accent }"
        >
          {{ selected ? '✓ sessions' : 'See sessions' }} <ArrowRight class="w-3.5 h-3.5" aria-hidden="true" />
        </span>
      </div>
    </div>
  </component>
</template>
