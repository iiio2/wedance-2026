<script setup lang="ts">
/**
 * TeacherProfile — inline artist preview shown on the festival page when
 * an artist is tapped in the Lineup. Filters the schedule (via the page's
 * selectedTeacherId) and previews bio + video + socials here, with a link
 * out to the artist's full /artists/[id] profile. V3 tropical style.
 */
import type { Teacher } from '~/types/festival'
import { Instagram, Youtube, Globe, ArrowRight, X } from 'lucide-vue-next'
import { WD } from '~/lib/brand'

const props = defineProps<{
  teacher: Teacher
}>()

defineEmits<{
  close: []
}>()

const platformIcon: Record<string, any> = {
  instagram: Instagram,
  youtube: Youtube,
  website: Globe,
}

// Link to the real unified profile at /@<handle>. The city directory passes the
// profile's actual username as `id` (see toPerson in /cities/[city]), so use it
// directly — slugifying the display name produced dead handles like
// "pinakothek-der-moderne-open-air" that never matched the real "pinakothek-der-moderne".
const profileHref = computed(() => (props.teacher.id ? `/@${props.teacher.id}` : null))

const imgError = ref(false)
const initials = computed(() =>
  props.teacher.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase(),
)

function toEmbedUrl(url: string): string {
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([^&/?]+)/)
  return match ? `https://www.youtube.com/embed/${match[1]}` : url
}
</script>

<template>
  <div class="rounded-2xl bg-white p-5 border" style="border-color:color-mix(in srgb, var(--wd-red-600) 20%, transparent); box-shadow: 0 1px 0 color-mix(in srgb, var(--wd-red-600) 13.3%, transparent), 0 8px 22px rgba(59,31,18,0.05);">
    <div class="flex items-start gap-4">
      <img
        v-if="teacher.photo && !imgError"
        :src="teacher.photo"
        :alt="teacher.name"
        class="w-20 h-20 rounded-full object-cover shrink-0 shadow-sm"
        @error="imgError = true"
      >
      <div
        v-else
        class="w-20 h-20 rounded-full shrink-0 shadow-sm flex items-center justify-center text-lg font-black"
        :style="{ background: 'color-mix(in srgb, var(--wd-red-600) 10%, transparent)', color: 'var(--wd-red-600)' }"
      >
        {{ initials }}
      </div>
      <div class="flex-1 min-w-0">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <h3 class="text-xl font-black leading-tight" style="font-family:var(--wd-font-display); color:var(--wd-brown-900);">
              {{ teacher.name }}
            </h3>
            <p v-if="teacher.styles.length" class="mt-1 flex flex-wrap gap-1.5">
              <span
                v-for="(s, i) in teacher.styles"
                :key="s"
                class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                :style="{
                  background: [WD.red600, WD.cyan600, WD.green600, WD.purple500, WD.amber500][i % 5] + '18',
                  color: [WD.red600, WD.cyan600, WD.green600, WD.purple500, WD.amber500][i % 5],
                }"
              >{{ s }}</span>
            </p>
          </div>
          <button
            type="button"
            class="shrink-0 p-1 -m-1 rounded-full hover:bg-black/[0.04] transition-colors"
            style="color:var(--wd-amber-600);"
            aria-label="Close preview"
            @click="$emit('close')"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <p v-if="teacher.bio" class="mt-2 text-sm leading-relaxed" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
          {{ teacher.bio }}
        </p>

        <div class="mt-3 flex items-center gap-4">
          <div v-if="teacher.socialLinks?.length" class="flex items-center gap-3">
            <a
              v-for="link in teacher.socialLinks"
              :key="link.platform"
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              class="transition-colors"
              style="color:var(--wd-amber-600);"
              :title="link.platform"
            >
              <component :is="platformIcon[link.platform]" v-if="platformIcon[link.platform]" class="w-4 h-4" />
              <span v-else class="text-xs italic capitalize">{{ link.platform }}</span>
            </a>
          </div>
          <NuxtLink
            v-if="profileHref"
            :to="profileHref"
            class="ml-auto inline-flex items-center gap-1 text-xs font-bold italic hover:underline"
            style="color:var(--wd-red-600); font-family:var(--wd-font-display);"
          >
            Full profile <ArrowRight class="w-3.5 h-3.5" />
          </NuxtLink>
        </div>
      </div>
    </div>

    <div v-if="teacher.videoUrl" class="mt-4 aspect-video rounded-xl overflow-hidden" style="background:color-mix(in srgb, var(--wd-brown-900) 3.9%, transparent);">
      <iframe
        :src="toEmbedUrl(teacher.videoUrl)"
        class="w-full h-full"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
      />
    </div>
  </div>
</template>
