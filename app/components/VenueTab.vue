<script setup lang="ts">
import { ExternalLink } from 'lucide-vue-next'
import type { Venue } from '~/types/festival'

defineProps<{ venue: Venue }>()

function mapsUrl(venue: Venue) {
  const parts = [venue.name, venue.address].filter(Boolean).join(', ')
  if (parts) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`
  if (venue.coordinates?.lat && venue.coordinates?.lng)
    return `https://www.google.com/maps/search/?api=1&query=${venue.coordinates.lat},${venue.coordinates.lng}`
  return ''
}
</script>

<template>
  <div class="space-y-6">
    <Card>
      <CardContent class="p-4 space-y-2">
        <h2 class="text-lg font-semibold">{{ venue.name }}</h2>
        <a v-if="venue.address && mapsUrl(venue)" :href="mapsUrl(venue)" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
          {{ venue.address }} <ExternalLink class="w-3.5 h-3.5 shrink-0" />
        </a>
        <p v-else-if="venue.address" class="text-sm text-muted-foreground">{{ venue.address }}</p>
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
