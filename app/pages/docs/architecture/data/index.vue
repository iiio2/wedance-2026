<script setup lang="ts">
import { erDiagram } from '~/lib/architecture-diagrams'
import { sourceUrl } from '~/lib/architecture-nav'

definePageMeta({ layout: 'docs' })

const { data } = useArchitecture()
const byName = new Map(data.tables.map(t => [t.name, t]))
const domains = data.domains.map(d => ({ ...d, rows: d.tables.map(n => byName.get(n)!).filter(Boolean) }))

const overview = erDiagram(data.tables, { withColumns: 'none' })
const domainDiagram = (names: string[]) => {
  const own = new Set(names)
  // Include the tables this context points at, so its FKs have something to land on.
  for (const n of names) for (const fk of byName.get(n)?.foreignKeys ?? []) own.add(fk.table)
  return erDiagram(data.tables.filter(t => own.has(t.name)), { withColumns: 'keys' })
}
const usedCount = (t: (typeof data.tables)[number]) => t.usedBy.procedures.length + t.usedBy.rest.length
</script>

<template>
  <DesignPage
    eyebrow="Generated from server/database/schema.ts"
    site="WeDance Architecture"
    title="Data model"
    :lead="`${data.tables.length} tables, introspected from the Drizzle schema on every build. Grouped by bounded context; each table links to its columns, keys, indexes and the code that uses it.`"
  >
    <DesignSection id="er" title="All tables" lead="Every table and foreign key. Open a context below for keys and columns.">
      <ArchMermaid :code="overview" label="Entity-relationship diagram of every table and foreign key" />
    </DesignSection>

    <DesignSection v-for="d in domains" :id="d.id" :key="d.id" :title="d.title" :lead="d.summary">
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <NuxtLink
          v-for="t in d.rows"
          :key="t.name"
          :to="`/docs/architecture/data/${t.name}`"
          class="group rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
        >
          <div class="font-mono font-bold text-sm">{{ t.name }}</div>
          <div class="text-xs text-muted-foreground mt-1">
            {{ t.columns.length }} columns · {{ t.foreignKeys.length }} FKs · used by {{ usedCount(t) }}
          </div>
          <p v-if="t.description" class="text-sm text-muted-foreground mt-2 line-clamp-3">{{ t.description }}</p>
        </NuxtLink>
      </div>
      <details class="mt-4">
        <summary class="cursor-pointer text-sm font-bold text-muted-foreground hover:text-foreground">ER diagram for {{ d.title }}</summary>
        <div class="mt-3">
          <ArchMermaid :code="domainDiagram(d.tables)" :label="`Entity-relationship diagram for ${d.title}`" />
        </div>
      </details>
    </DesignSection>

    <p class="text-sm text-muted-foreground">
      Source: <a :href="sourceUrl('server/database/schema.ts')" class="font-bold text-primary hover:underline">server/database/schema.ts</a>.
      Context grouping: <code class="font-mono text-[13px]">scripts/architecture/domains.ts</code> (a test fails when a table is not assigned).
    </p>
  </DesignPage>
</template>
