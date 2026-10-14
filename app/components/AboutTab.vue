<script setup lang="ts">
import type { Festival } from '~/types/festival'

defineProps<{ festival: Festival }>()
</script>

<template>
  <div class="grid gap-5" :class="festival.flyer ? 'sm:grid-cols-[minmax(0,14rem)_1fr] sm:items-start' : ''">
    <a v-if="festival.flyer" :href="festival.flyer" target="_blank" rel="noopener" class="block max-w-[14rem]">
      <img :src="festival.flyer" :alt="`Flyer for ${festival.name}`" class="w-full rounded-xl border object-cover shadow-wd-card" loading="lazy">
    </a>
    <p class="text-sm leading-relaxed">{{ festival.description }}</p>
  </div>
</template>
