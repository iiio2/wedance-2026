<script setup lang="ts">
import { sourceUrl } from '~/lib/architecture-nav'

definePageMeta({ layout: 'docs' })

const route = useRoute()
const { decisions } = useArchitecture()
const adr = computed(() => decisions.find(d => d.slug === route.params.slug))
if (!adr.value) throw createError({ statusCode: 404, statusMessage: 'Unknown document', fatal: true })
const tone = (s: string) => (s === 'accepted' ? 'good' : s === 'superseded' ? 'neutral' : 'warn') as 'good' | 'neutral' | 'warn'
</script>

<template>
  <DesignPage v-if="adr" :eyebrow="adr.id" site="WeDance Architecture" :title="adr.title" :description="adr.summary ?? `${adr.id} (${adr.status}): ${adr.title}.`">
    <div class="flex flex-wrap items-center gap-3 -mt-6">
      <ArchPill :tone="tone(adr.status)">{{ adr.status }}</ArchPill>
      <span v-if="adr.date" class="text-sm text-muted-foreground">{{ adr.date }}</span>
      <a :href="sourceUrl(adr.file)" class="ml-auto text-xs font-mono text-muted-foreground hover:text-foreground">{{ adr.file }}</a>
    </div>
    <div class="arch-prose" :class="adr.kind === 'adr' ? 'max-w-3xl' : 'max-w-none'">
      <template v-for="(part, i) in adr.parts" :key="i">
        <!-- Doc html is rendered at build time from our own repo markdown, fully escaped (scripts/architecture/markdown.ts). -->
        <div v-if="part.type === 'html'" v-html="part.html" />
        <ArchMermaid v-else :code="part.code" :label="`Diagram ${i + 1} in ${adr.title}`" class="my-6" />
      </template>
    </div>
  </DesignPage>
</template>

<style scoped>
.arch-prose :deep(h2), .arch-prose :deep(h3) { font-family: var(--wd-font-display); font-weight: 700; font-size: 1.5rem; margin: 2rem 0 0.75rem; scroll-margin-top: 5rem; }
.arch-prose :deep(h4), .arch-prose :deep(h5) { font-weight: 700; font-size: 1.125rem; margin: 1.5rem 0 0.5rem; scroll-margin-top: 5rem; }
.arch-prose :deep(p) { margin: 0.75rem 0; line-height: 1.7; }
.arch-prose :deep(ul), .arch-prose :deep(ol) { margin: 0.75rem 0; padding-left: 1.25rem; line-height: 1.7; }
.arch-prose :deep(ul) { list-style: disc; }
.arch-prose :deep(ol) { list-style: decimal; }
.arch-prose :deep(code) { font-size: 0.85em; background: var(--muted); padding: 0.1em 0.3em; border-radius: 0.3em; }
.arch-prose :deep(pre) { background: var(--muted); padding: 0.75rem 1rem; border-radius: 0.75rem; overflow-x: auto; font-size: 13px; }
.arch-prose :deep(pre code) { background: none; padding: 0; }
.arch-prose :deep(a) { color: var(--primary); font-weight: 700; }
.arch-prose :deep(blockquote) { border-left: 3px solid var(--border); padding-left: 1rem; color: var(--muted-foreground); }
.arch-prose :deep(.arch-table) { overflow-x: auto; margin: 1rem 0; border: 1px solid var(--border); border-radius: 0.75rem; }
.arch-prose :deep(table) { width: 100%; border-collapse: collapse; font-size: 13px; line-height: 1.5; }
.arch-prose :deep(th) { text-align: left; font-weight: 700; background: var(--muted); padding: 0.5rem 0.75rem; white-space: nowrap; }
.arch-prose :deep(td) { padding: 0.5rem 0.75rem; border-top: 1px solid var(--border); vertical-align: top; min-width: 5rem; }
.arch-prose :deep(td code) { overflow-wrap: anywhere; }
.arch-prose :deep(td:first-child) { min-width: 0; }
</style>
