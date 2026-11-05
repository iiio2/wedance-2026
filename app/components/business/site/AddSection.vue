<script setup lang="ts">
/** Picking what kind of section to add to a profile's website (RAZ-412). */
import { SECTION_INFO, SECTION_KINDS, type SectionKind } from '#shared/types/profileSite'
import { KIND_ICONS } from '~/lib/site-kinds'

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ pick: [kind: SectionKind] }>()
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Add a section</DialogTitle>
        <DialogDescription>Pick what it shows. You can change the words, move it and hide it afterwards.</DialogDescription>
      </DialogHeader>
      <div class="grid gap-2 sm:grid-cols-2">
        <button
          v-for="k in SECTION_KINDS"
          :key="k"
          type="button"
          class="flex items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:shadow-wd-focus focus-visible:outline-none"
          :data-kind="k"
          @click="emit('pick', k); open = false"
        >
          <span class="grid size-9 shrink-0 place-items-center rounded-lg bg-secondary/10 text-secondary"><component :is="KIND_ICONS[k]" class="size-4" aria-hidden="true" /></span>
          <span>
            <span class="block font-bold">{{ SECTION_INFO[k].label }}</span>
            <span class="block text-xs text-muted-foreground">{{ SECTION_INFO[k].hint }}</span>
          </span>
        </button>
      </div>
    </DialogContent>
  </Dialog>
</template>
