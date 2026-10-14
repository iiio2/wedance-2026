<script setup lang="ts">
import type { Venue } from '~/types/festival'

defineProps<{ venue: Venue }>()
</script>

<template>
  <div class="space-y-6">
    <Card>
      <CardContent class="p-4 space-y-2">
        <h2 class="text-lg font-semibold">{{ venue.name }}</h2>
        <p class="text-sm text-muted-foreground">{{ venue.address }}</p>
        <iframe
          class="w-full h-[300px] rounded-md mt-4"
          :src="`https://www.openstreetmap.org/export/embed.html?bbox=${venue.coordinates.lng - 0.01},${venue.coordinates.lat - 0.01},${venue.coordinates.lng + 0.01},${venue.coordinates.lat + 0.01}&layer=mapnik&marker=${venue.coordinates.lat},${venue.coordinates.lng}`"
          loading="lazy"
        />
      </CardContent>
    </Card>
    <Card v-if="venue.practicalInfo?.length">
      <CardContent class="p-4">
        <h3 class="font-semibold mb-2">Practical info</h3>
        <ul class="space-y-1">
          <li v-for="info in venue.practicalInfo" :key="info" class="text-sm text-muted-foreground">
            {{ info }}
          </li>
        </ul>
      </CardContent>
    </Card>
  </div>
</template>
