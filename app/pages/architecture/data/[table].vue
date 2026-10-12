<script setup lang="ts">
import { erDiagram, neighbourhood } from '~/lib/architecture-diagrams'
import { sourceUrl } from '~/lib/architecture-nav'

definePageMeta({ layout: 'architecture' })

const route = useRoute()
const { data } = useArchitecture()
const table = computed(() => data.tables.find(t => t.name === route.params.table))
if (!table.value) throw createError({ statusCode: 404, statusMessage: 'Unknown table', fatal: true })

const domain = computed(() => data.domains.find(d => d.id === table.value!.domain))
const diagram = computed(() => erDiagram(neighbourhood(data.tables, table.value!.name), { withColumns: 'keys' }))
const procRouter = (p: string) => p.split('.')[0]
</script>

<template>
  <DesignPage
    v-if="table"
    :eyebrow="domain?.title ?? 'Data model'"
    site="WeDance Architecture"
    :title="table.name"
    :lead="table.description ?? undefined"
  >
    <DesignSection id="columns" title="Columns">
      <div class="overflow-x-auto rounded-2xl border border-border bg-card">
        <table class="w-full text-sm">
          <thead class="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th class="px-4 py-2">Column</th><th class="px-4 py-2">Type</th><th class="px-4 py-2">Null</th>
              <th class="px-4 py-2">Default</th><th class="px-4 py-2">Keys</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="c in table.columns" :key="c.name">
              <td class="px-4 py-2 font-mono font-bold whitespace-nowrap">{{ c.name }}</td>
              <td class="px-4 py-2 font-mono text-[12px]">
                {{ c.type }}
                <div v-if="c.enum" class="mt-1 flex flex-wrap gap-1">
                  <ArchPill v-for="v in c.enum" :key="v" tone="info">{{ v }}</ArchPill>
                </div>
              </td>
              <td class="px-4 py-2">{{ c.nullable ? 'yes' : 'no' }}</td>
              <td class="px-4 py-2 font-mono text-[12px] text-muted-foreground">{{ c.default ?? '—' }}</td>
              <td class="px-4 py-2">
                <div class="flex flex-wrap gap-1">
                  <ArchPill v-if="c.primaryKey" tone="good">PK</ArchPill>
                  <ArchPill v-if="c.unique" tone="warn">unique</ArchPill>
                  <NuxtLink v-if="c.references" :to="`/architecture/data/${c.references.table}`" class="text-xs font-bold text-primary hover:underline whitespace-nowrap">
                    → {{ c.references.table }}.{{ c.references.column }}
                  </NuxtLink>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-xs text-muted-foreground mt-2">
        Value lists come from <code class="font-mono">.$type&lt;'a' | 'b'&gt;()</code> in the schema — enforced in TypeScript only, not by the database.
      </p>
    </DesignSection>

    <DesignSection id="constraints" title="Keys, constraints & indexes">
      <div class="grid lg:grid-cols-3 gap-3">
        <div class="rounded-2xl border border-border bg-card p-4">
          <h3 class="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2">Unique</h3>
          <ul v-if="table.uniques.length" class="space-y-1.5 text-sm">
            <li v-for="u in table.uniques" :key="u.name"><span class="font-mono text-[12px]">({{ u.columns.join(', ') }})</span> <span class="text-xs text-muted-foreground">{{ u.name }}</span></li>
          </ul>
          <p v-else class="text-sm text-muted-foreground">None besides the primary key.</p>
        </div>
        <div class="rounded-2xl border border-border bg-card p-4">
          <h3 class="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2">Indexes</h3>
          <ul v-if="table.indexes.length" class="space-y-1.5 text-sm">
            <li v-for="ix in table.indexes" :key="ix.name">
              <span class="font-mono text-[12px]">({{ ix.columns.join(', ') }})</span>
              <ArchPill v-if="ix.unique" tone="warn" class="ml-1">unique</ArchPill>
              <ArchPill v-if="ix.using" class="ml-1">{{ ix.using }}</ArchPill>
              <div class="text-xs text-muted-foreground">{{ ix.name }}<template v-if="ix.where"> · where {{ ix.where }}</template></div>
            </li>
          </ul>
          <p v-else class="text-sm text-muted-foreground">No secondary indexes.</p>
        </div>
        <div class="rounded-2xl border border-border bg-card p-4">
          <h3 class="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2">Foreign keys</h3>
          <ul v-if="table.foreignKeys.length" class="space-y-1.5 text-sm">
            <li v-for="fk in table.foreignKeys" :key="fk.name">
              <span class="font-mono text-[12px]">{{ fk.columns.join(', ') }}</span> →
              <NuxtLink :to="`/architecture/data/${fk.table}`" class="font-bold text-primary hover:underline">{{ fk.table }}</NuxtLink>.{{ fk.foreignColumns.join(', ') }}
              <div class="text-xs text-muted-foreground">on delete {{ fk.onDelete ?? 'no action' }}</div>
            </li>
          </ul>
          <p v-else class="text-sm text-muted-foreground">None.</p>
          <template v-if="table.referencedBy.length">
            <h3 class="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mt-4 mb-2">Referenced by</h3>
            <ul class="space-y-1 text-sm">
              <li v-for="r in table.referencedBy" :key="r.table">
                <NuxtLink :to="`/architecture/data/${r.table}`" class="font-bold text-primary hover:underline">{{ r.table }}</NuxtLink>
                <span class="font-mono text-[12px] text-muted-foreground"> ({{ r.columns.join(', ') }})</span>
              </li>
            </ul>
          </template>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="used-by" title="Used by" lead="Code that reads or writes this table, found by static analysis of the tRPC routers and API handlers (including helpers they call).">
      <div class="grid sm:grid-cols-2 gap-3">
        <div class="rounded-2xl border border-border bg-card p-4">
          <h3 class="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2">tRPC procedures</h3>
          <ul v-if="table.usedBy.procedures.length" class="space-y-1 text-sm">
            <li v-for="p in table.usedBy.procedures" :key="p">
              <NuxtLink :to="`/architecture/api/${procRouter(p)}#${p}`" class="font-mono text-[12px] text-primary hover:underline">{{ p }}</NuxtLink>
            </li>
          </ul>
          <p v-else class="text-sm text-muted-foreground">No public or signed-in procedure.</p>
        </div>
        <div class="rounded-2xl border border-border bg-card p-4">
          <h3 class="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-2">REST &amp; webhooks</h3>
          <ul v-if="table.usedBy.rest.length" class="space-y-1 text-sm font-mono text-[12px]">
            <li v-for="r in table.usedBy.rest" :key="r">{{ r }}</li>
          </ul>
          <p v-else class="text-sm text-muted-foreground">None.</p>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="relations" title="Relations">
      <ArchMermaid :code="diagram" :label="`Entity-relationship diagram for ${table.name} and its neighbours`" />
    </DesignSection>

    <p class="text-sm text-muted-foreground">
      Defined at <a :href="sourceUrl('server/database/schema.ts', table.line)" class="font-bold text-primary hover:underline">server/database/schema.ts:{{ table.line }}</a>
      as <code class="font-mono text-[13px]">{{ table.key }}</code>.
    </p>
  </DesignPage>
</template>
