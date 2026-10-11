<script setup lang="ts">
import type { PropType } from 'vue'
/**
 * Title row for /admin/* (and other internal tool) pages: small eyebrow,
 * Playfair heading, optional one-line description, and an actions slot on the
 * right (Refresh / New …). Keeps every admin page on one header instead of
 * each page hand-rolling its own italic two-colour title.
 *
 *   <AdminPageHeader title="Giveaways" description="Sponsor giveaways per city.">
 *     <Button variant="outline" size="sm" @click="load"><RotateCcw /> Refresh</Button>
 *   </AdminPageHeader>
 *
 * `back` renders a "← label" link above the eyebrow (detail pages).
 */
import { ArrowLeft } from 'lucide-vue-next'

// Runtime props on purpose — see ui/button/Button.vue.
defineProps({
  title: { type: String, required: true },
  description: { type: String, default: undefined },
  eyebrow: { type: String, default: 'Admin' },
  back: { type: Object as PropType<{ to: string, label: string }>, default: undefined },
})
</script>

<template>
  <header class="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
    <div class="min-w-0">
      <NuxtLink
        v-if="back"
        :to="back.to"
        class="mb-3 inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground hover:underline"
      >
        <ArrowLeft class="size-3.5" aria-hidden="true" /> {{ back.label }}
      </NuxtLink>
      <div v-if="eyebrow" class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">{{ eyebrow }}</div>
      <h1 class="mt-1 font-display text-3xl sm:text-4xl font-bold leading-tight text-foreground">{{ title }}</h1>
      <p v-if="description" class="mt-1 max-w-2xl text-sm text-muted-foreground">{{ description }}</p>
    </div>
    <div v-if="$slots.default" class="flex flex-wrap items-center gap-2">
      <slot />
    </div>
  </header>
</template>
