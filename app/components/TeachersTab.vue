<script setup lang="ts">
import type { Teacher, Workshop } from '~/types/festival'

const props = defineProps<{
  teachers: Teacher[]
  workshops: Workshop[]
}>()

const expandedId = ref<string | null>(null)

function workshopsFor(teacher: Teacher): Workshop[] {
  return props.workshops.filter((w) => w.teacherId === teacher.id || w.withIds?.includes(teacher.id))
}
</script>

<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <Card
      v-for="teacher in teachers"
      :key="teacher.id"
      class="cursor-pointer"
      @click="expandedId = expandedId === teacher.id ? null : teacher.id"
    >
      <CardContent class="p-4">
        <div class="flex gap-4 items-center">
          <Avatar class="h-14 w-14">
            <AvatarImage :src="teacher.photo" :alt="teacher.name" />
            <AvatarFallback>{{ teacher.name.slice(0, 2) }}</AvatarFallback>
          </Avatar>
          <div>
            <h3 class="font-semibold">{{ teacher.name }}</h3>
            <div class="flex gap-1 mt-1">
              <Badge v-for="style in teacher.styles" :key="style" variant="secondary" class="text-xs">
                {{ style }}
              </Badge>
            </div>
            <p class="text-xs text-muted-foreground mt-1">{{ workshopsFor(teacher).length }} workshops</p>
          </div>
        </div>
        <div v-if="expandedId === teacher.id" class="mt-4 pt-4 border-t space-y-2">
          <p class="text-sm">{{ teacher.bio }}</p>
          <div v-for="w in workshopsFor(teacher)" :key="w.id" class="text-sm text-muted-foreground">
            {{ w.day }} {{ w.time }} — {{ w.title }}
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
