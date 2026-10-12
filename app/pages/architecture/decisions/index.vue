<script setup lang="ts">
definePageMeta({ layout: 'architecture' })

const { decisions } = useArchitecture()
const tone = (s: string) => (s === 'accepted' ? 'good' : s === 'superseded' ? 'neutral' : 'warn') as 'good' | 'neutral' | 'warn'
</script>

<template>
  <DesignPage
    eyebrow="docs/architecture/adr"
    site="WeDance Architecture"
    title="Decisions"
    lead="Architecture decision records: why the system is shaped the way it is. Add one as docs/architecture/adr/NNN-title.md with title, status and date frontmatter."
  >
    <p v-if="!decisions.length" class="text-muted-foreground">No ADRs yet.</p>
    <ul v-else class="divide-y divide-border rounded-2xl border border-border bg-card">
      <li v-for="d in decisions" :key="d.slug">
        <NuxtLink :to="`/architecture/decisions/${d.slug}`" class="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-accent/40">
          <span class="font-mono text-xs font-bold text-secondary">{{ d.id }}</span>
          <span class="font-bold">{{ d.title }}</span>
          <ArchPill :tone="tone(d.status)" class="ml-auto">{{ d.status }}</ArchPill>
          <span v-if="d.date" class="text-xs text-muted-foreground">{{ d.date }}</span>
        </NuxtLink>
      </li>
    </ul>
  </DesignPage>
</template>
