<script setup lang="ts">
/**
 * ArtistCard — the face-forward artist card used on /artists and the
 * festival lineup. Shows photo, name, residence (pin) + origin (globe),
 * styles, and an optional bio snippet.
 *
 * Two modes:
 * - default (link): the whole card is a link to the artist profile.
 * - selectable (festival lineup): the card is a button that emits
 *   `select` (to filter the schedule); a separate "Full profile →" link
 *   still reaches the profile.
 */
import { Plane, ArrowRight } from 'lucide-vue-next'
import type { Teacher } from '~/types/festival'
import { placeFlag, type Language } from '~/data/artists'

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
const profileHref = computed(() => `/artists/${props.artist.id}`)

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
// lineup), where it's a button that filters the schedule.
const NuxtLinkComponent = resolveComponent('NuxtLink')
const rootTag = computed(() => (props.selectable ? 'button' : NuxtLinkComponent))
</script>

<template>
  <component
    :is="rootTag"
    :to="selectable ? undefined : profileHref"
    :type="selectable ? 'button' : undefined"
    class="group w-full text-left rounded-2xl bg-white border overflow-hidden flex flex-col transition-all hover:-translate-y-1"
    :style="{
      borderColor: selected ? accent : accent + '55',
      borderWidth: selected ? '2px' : '1px',
      boxShadow: selected
        ? '0 0 0 3px ' + accent + '22, 0 8px 22px rgba(59,31,18,0.06)'
        : '0 1px 0 ' + accent + '22, 0 8px 22px rgba(59,31,18,0.05)',
    }"
    @click="selectable ? emit('select') : undefined"
  >
    <!-- Face first -->
    <div class="relative aspect-square overflow-hidden" :style="{ background: accent + '12' }">
      <img
        v-if="artist.photo && !imgError"
        :src="artist.photo"
        :alt="artist.name"
        class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
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
          class="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
          style="background:rgba(59,31,18,0.55); backdrop-filter: blur(4px);"
          :title="`${festivalCount} festival${festivalCount === 1 ? '' : 's'}`"
        >
          <Plane class="w-3 h-3" /> {{ festivalCount }}
        </span>
      </div>
      <div
        v-if="selected"
        class="absolute top-3 right-3 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full text-white"
        :style="{ background: accent }"
      >
        Filtering
      </div>
    </div>

    <div class="p-4 flex flex-col flex-1">
      <div class="font-bold text-lg leading-tight" style="color:var(--wd-brown-900); font-family:var(--wd-font-display);">
        {{ artist.name }}
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
            class="text-[9px] font-bold tracking-wide px-1.5 py-0.5 rounded"
            :style="{ background: accent + '14', color: accent }"
          >{{ l.code }}</span>
        </span>
      </div>

      <div v-if="artist.styles.length" class="mt-2 flex flex-wrap gap-1">
        <span
          v-for="s in artist.styles.slice(0, 3)"
          :key="s"
          class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full"
          :style="{ background: accent + '18', color: accent }"
        >{{ s }}</span>
      </div>

      <p
        v-if="showBio && artist.bio"
        class="mt-2.5 text-xs leading-relaxed line-clamp-2"
        style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);"
      >
        {{ artist.bio }}
      </p>

      <!-- Footer -->
      <div class="mt-auto pt-3 flex items-center justify-between">
        <NuxtLink
          v-if="selectable"
          :to="profileHref"
          class="text-xs italic hover:underline"
          style="color:var(--wd-amber-600); font-family:var(--wd-font-display);"
          @click.stop
        >
          Full profile →
        </NuxtLink>
        <span
          v-else
          class="text-xs italic"
          style="color:var(--wd-amber-600); font-family:var(--wd-font-display);"
        >
          View profile →
        </span>
        <span
          v-if="selectable"
          class="inline-flex items-center gap-1 text-xs font-bold"
          :style="{ color: accent }"
        >
          {{ selected ? '✓ sessions' : 'See sessions' }} <ArrowRight class="w-3.5 h-3.5" />
        </span>
      </div>
    </div>
  </component>
</template>
