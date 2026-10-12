<script setup lang="ts">
definePageMeta({ layout: 'architecture' })

const { decisions } = useArchitecture()
const tone = (s: string) => (s === 'accepted' ? 'good' : s === 'superseded' ? 'neutral' : 'warn') as 'good' | 'neutral' | 'warn'

const groups = computed(() => ([
  { kind: 'review', title: 'Architecture review', lead: 'Where the system stands today, ranked findings with evidence.' },
  { kind: 'target', title: 'Target design', lead: 'Where it should go: data model, API plan and the migration that gets there.' },
  { kind: 'adr', title: 'Decision records', lead: 'Why the system is shaped the way it is — one decision per record.' },
] as const).map(g => ({ ...g, docs: decisions.filter(d => d.kind === g.kind) })).filter(g => g.docs.length))
</script>

<template>
  <DesignPage
    eyebrow="docs/architecture"
    site="WeDance Architecture"
    title="Decisions"
    lead="Architecture reviews, target design and decision records. Add an ADR as docs/architecture/adr/NNN-title.md with title, status and date frontmatter; reviews live in docs/architecture/review/ and target-design docs in docs/architecture/target/."
  >
    <p v-if="!decisions.length" class="text-muted-foreground">No ADRs yet.</p>
    <section v-for="g in groups" :key="g.kind" class="space-y-3">
      <div>
        <h2 class="font-display text-xl font-bold">{{ g.title }}</h2>
        <p class="text-sm text-muted-foreground">{{ g.lead }}</p>
      </div>
      <ul class="divide-y divide-border rounded-2xl border border-border bg-card">
        <li v-for="d in g.docs" :key="d.slug">
          <NuxtLink :to="`/architecture/decisions/${d.slug}`" class="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-accent/40">
            <span class="font-mono text-xs font-bold text-secondary">{{ d.id }}</span>
            <span class="font-bold">{{ d.title }}</span>
            <ArchPill :tone="tone(d.status)" class="ml-auto">{{ d.status }}</ArchPill>
            <span v-if="d.date" class="text-xs text-muted-foreground">{{ d.date }}</span>
            <span v-if="d.summary" class="basis-full text-sm text-muted-foreground">{{ d.summary }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>
  </DesignPage>
</template>
