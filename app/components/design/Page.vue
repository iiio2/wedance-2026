<script setup lang="ts">
import type { DocStatus } from '~/lib/design-nav'

/** Page header for every /docs page: eyebrow, title, lead, status. */
const props = defineProps<{
  eyebrow: string
  title: string
  lead?: string
  status?: DocStatus
  /** Title suffix — the docs section this page belongs to. */
  site?: string
  /** Meta description; defaults to the lead. */
  description?: string
}>()

// Every /docs page is public and indexed: title + description for search and
// link previews. The lead doubles as the meta description.
const metaDescription = () => props.description ?? props.lead ?? `${props.title} — from the WeDance open-source docs.`
const fullTitle = () => `${props.title} — ${props.site ?? 'WeDance Design'}`
useSeoMeta({
  title: fullTitle,
  ogTitle: fullTitle,
  description: () => metaDescription(),
  ogDescription: () => metaDescription(),
})
</script>

<template>
  <article>
    <header class="pb-8 mb-10 border-b border-border">
      <div class="flex items-center gap-3">
        <span class="text-[10px] uppercase tracking-[0.3em] font-bold text-secondary">{{ eyebrow }}</span>
        <DesignStatus v-if="status" :status="status" />
      </div>
      <h1 class="text-4xl sm:text-5xl font-display font-bold mt-3 leading-tight">{{ title }}</h1>
      <p v-if="lead" class="text-lg text-muted-foreground mt-3 max-w-2xl">{{ lead }}</p>
    </header>
    <div class="space-y-14">
      <slot />
    </div>
  </article>
</template>
