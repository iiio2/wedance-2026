<script setup lang="ts">
import type { Teacher } from '~/types/festival'

defineProps<{
  teachers: Teacher[]
  selectedId: string | null
  // When provided and it returns a URL, each artist becomes a link to
  // that URL (e.g. their /@handle profile). Otherwise the avatar
  // is a button that emits `select` (the inline-filter behaviour used
  // on the city page). Keeps both call sites working from one component.
  hrefFor?: (teacher: Teacher) => string | null | undefined
}>()

defineEmits<{
  select: [id: string | null]
}>()

const failedPhotos = ref(new Set<string>())
function onImgError(id: string) {
  failedPhotos.value.add(id)
}
function teacherInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}
</script>

<template>
  <div class="flex gap-4 overflow-x-auto py-2">
    <template v-for="teacher in teachers" :key="teacher.id">
      <!-- Link variant → artist profile -->
      <NuxtLink
        v-if="hrefFor && hrefFor(teacher)"
        :to="hrefFor(teacher)!"
        class="flex flex-col items-center gap-1.5 shrink-0 w-20 group"
        :title="teacher.name"
      >
        <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-transparent transition-all group-hover:-translate-y-0.5" style="box-shadow: 0 2px 8px rgba(59,31,18,0.08);">
          <img v-if="teacher.photo && !failedPhotos.has(teacher.id)" :src="teacher.photo" :alt="teacher.name" class="w-full h-full object-cover" @error="onImgError(teacher.id)">
          <div v-else class="w-full h-full flex items-center justify-center text-sm font-black" :style="{ background: WD.red600 + '18', color: WD.red600 }">{{ teacherInitials(teacher.name) }}</div>
        </div>
        <span class="w-full text-xs text-center leading-tight line-clamp-2 break-words wrap-anywhere font-sans text-muted-foreground">
          {{ teacher.name }}
        </span>
      </NuxtLink>

      <!-- Button variant → inline filter (emits select) -->
      <button
        v-else
        type="button"
        class="flex flex-col items-center gap-1.5 shrink-0 w-20 group"
        :title="teacher.name"
        :aria-pressed="selectedId === teacher.id"
        @click="$emit('select', selectedId === teacher.id ? null : teacher.id)"
      >
        <div
          class="w-16 h-16 rounded-full overflow-hidden border-2 transition-all"
          :style="selectedId === teacher.id
            ? { borderColor: 'var(--primary)', boxShadow: '0 2px 10px rgba(220,38,38,0.25)' }
            : { borderColor: 'transparent' }"
        >
          <img v-if="teacher.photo && !failedPhotos.has(teacher.id)" :src="teacher.photo" :alt="teacher.name" class="w-full h-full object-cover" @error="onImgError(teacher.id)">
          <div v-else class="w-full h-full flex items-center justify-center text-sm font-black" :style="{ background: WD.red600 + '18', color: WD.red600 }">{{ teacherInitials(teacher.name) }}</div>
        </div>
        <span
          class="w-full text-xs text-center leading-tight line-clamp-2 break-words wrap-anywhere font-sans"
          :class="selectedId === teacher.id ? 'text-foreground font-bold' : 'text-muted-foreground font-normal'"
        >
          {{ teacher.name }}
        </span>
      </button>
    </template>
  </div>
</template>
