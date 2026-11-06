<script setup lang="ts">
import { sizedImage, IMG } from '#shared/utils/image'
import type { Festival } from '~/types/festival'

defineProps<{ festival: Festival }>()
</script>

<template>
  <div class="grid gap-5" :class="festival.flyer ? 'sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-start' : ''">
    <a v-if="festival.flyer" :href="festival.flyer" target="_blank" rel="noopener" class="block max-w-[14rem]">
      <img :src="sizedImage(festival.flyer, IMG.large)" :alt="`Flyer for ${festival.name}`" class="w-full rounded-xl border object-cover shadow-wd-card" loading="lazy">
    </a>
    <div>
      <!-- Who runs it: the organiser, then its co-organisers (#456). -->
      <p v-if="festival.organizers?.length" class="mb-3 text-sm" data-testid="event-organizers">
        <span class="text-muted-foreground">Organised by </span>
        <template v-for="(o, i) in festival.organizers" :key="o.username">
          <template v-if="i">, </template>
          <NuxtLink :to="`/@${o.username}`" class="font-bold hover:underline">{{ o.name }}</NuxtLink>
          <span v-if="o.role !== 'Organiser'" class="text-muted-foreground"> ({{ o.role.toLowerCase() }})</span>
        </template>
      </p>
      <p class="text-sm leading-relaxed">{{ festival.description }}</p>
    </div>
  </div>
</template>
