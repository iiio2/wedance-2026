<script setup lang="ts">
import type { Workshop, Teacher } from '~/types/festival'
import { getStyleColors } from '~/lib/style-colors'
import { chilis } from '~/lib/levels'

defineProps<{
  workshop: Workshop
  teacher: Teacher
  inPlan: boolean
}>()

defineEmits<{
  toggle: []
}>()
</script>

<template>
  <Card
    class="border-l-4"
    :class="[
      getStyleColors(workshop.style).border,
      inPlan ? getStyleColors(workshop.style).bg : '',
    ]"
  >
    <CardContent class="p-3">
      <div>
        <h3 class="font-semibold text-sm leading-tight">{{ workshop.title }}</h3>
        <p class="text-xs text-muted-foreground mt-1">
          {{ teacher.name }} <span v-if="workshop.level" :title="workshop.level">{{ chilis(workshop.level) }}</span>
        </p>
        <div class="flex items-center justify-end gap-2 mt-1">
          <span class="text-xs text-muted-foreground">{{ workshop.goingCount }} going</span>
          <Button
            size="sm"
            :variant="inPlan ? 'secondary' : 'outline'"
            class="shrink-0 text-xs h-7"
            @click="$emit('toggle')"
          >
            {{ inPlan ? '✓ Going!' : 'Going?' }}
          </Button>
        </div>
      </div>
    </CardContent>
  </Card>
</template>
