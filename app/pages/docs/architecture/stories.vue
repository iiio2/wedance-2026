<script setup lang="ts">
definePageMeta({ layout: 'docs' })

/**
 * The story map: docs/architecture/stories.json (produced by the story-mapping
 * pass), validated at build time against the live code — procedures, tables
 * and routes a story names that don't exist are flagged, and procedures no
 * story references are listed as unmapped.
 */
const { stories: doc } = useArchitecture()
const all = doc.stories

const journey = ref('all')
const actor = ref('all')
const status = ref('all')
const q = ref('')

const uniq = (xs: (string | null)[]) => [...new Set(xs.filter((x): x is string => !!x))].sort()
const journeys = uniq(all.map(s => s.journey))
const actors = uniq(all.map(s => s.actor))
const statuses = ['built', 'partial', 'missing', 'unknown'] as const

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  return all.filter(s =>
    (journey.value === 'all' || (journey.value === 'none' ? !s.journey : s.journey === journey.value))
    && (actor.value === 'all' || s.actor === actor.value)
    && (status.value === 'all' || s.status === status.value)
    && (!term || `${s.id} ${s.title} ${s.story ?? ''}`.toLowerCase().includes(term)))
})
const countBy = (st: string) => filtered.value.filter(s => s.status === st).length
const tone = { built: 'good', partial: 'warn', missing: 'bad', unknown: 'neutral' } as const
const flagged = computed(() => all.filter(s => s.unknownProcedures.length || s.unknownTables.length || s.unknownRoutes.length))
const procRouter = (p: string) => p.split('.')[0]
</script>

<template>
  <DesignPage
    eyebrow="Generated from docs/architecture/stories.json"
    site="WeDance Architecture"
    title="User stories"
    lead="Every user story mapped to the tables, procedures and routes that implement it — checked against the code on every build."
  >
    <div v-if="doc.state !== 'ok'" class="rounded-2xl border border-dashed border-border bg-card p-6">
      <p class="font-bold">{{ doc.state === 'missing' ? 'No story map yet.' : 'The story map could not be read.' }}</p>
      <p class="text-sm text-muted-foreground mt-1">
        <template v-if="doc.state === 'missing'">This page renders <code class="font-mono text-[13px]">{{ doc.source }}</code> once it exists.</template>
        <template v-else><code class="font-mono text-[13px]">{{ doc.source }}</code>: {{ doc.error }}</template>
      </p>
      <p class="text-sm text-muted-foreground mt-3">{{ doc.unmappedProcedures.length }} public and signed-in procedures are currently unmapped.</p>
    </div>

    <template v-else>
      <DesignSection id="summary" class="[overflow-wrap:anywhere]" title="Summary" :lead="`${all.length} stories${doc.generatedAt ? ` · mapped ${doc.generatedAt.slice(0, 10)}` : ''}`">
        <details v-if="doc.sources.length" class="-mt-2 mb-4 text-sm">
          <summary class="cursor-pointer text-muted-foreground hover:text-foreground">Sources ({{ doc.sources.length }})</summary>
          <ul class="mt-2 list-disc pl-5 space-y-1 text-muted-foreground">
            <li v-for="src in doc.sources" :key="src">{{ src }}</li>
          </ul>
        </details>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            v-for="st in statuses"
            :key="st"
            type="button"
            class="rounded-2xl border bg-card p-4 text-left transition-colors hover:border-primary/40"
            :class="status === st ? 'border-primary' : 'border-border'"
            :aria-pressed="status === st"
            @click="status = status === st ? 'all' : st"
          >
            <div class="text-3xl font-display font-bold">{{ countBy(st) }}</div>
            <ArchPill :tone="tone[st]" class="mt-1">{{ st }}</ArchPill>
          </button>
        </div>
      </DesignSection>

      <DesignSection id="stories" class="[overflow-wrap:anywhere]" title="Stories">
        <div class="flex flex-wrap items-center gap-2 mb-4">
          <input v-model="q" type="search" placeholder="Search stories…" aria-label="Search stories" class="h-9 w-full sm:w-56 rounded-lg border border-border bg-background px-3 text-sm">
          <select v-model="journey" aria-label="Journey" class="h-9 rounded-lg border border-border bg-background px-2 text-sm">
            <option value="all">All journeys</option>
            <option v-for="j in journeys" :key="j" :value="j">{{ j }}</option>
            <option value="none">No journey</option>
          </select>
          <select v-model="actor" aria-label="Actor" class="h-9 rounded-lg border border-border bg-background px-2 text-sm">
            <option value="all">All actors</option>
            <option v-for="a in actors" :key="a" :value="a">{{ a }}</option>
          </select>
          <select v-model="status" aria-label="Status" class="h-9 rounded-lg border border-border bg-background px-2 text-sm">
            <option value="all">Any status</option>
            <option v-for="st in statuses" :key="st" :value="st">{{ st }}</option>
          </select>
          <span class="text-sm text-muted-foreground">{{ filtered.length }} shown</span>
        </div>
        <div class="space-y-3">
          <article v-for="s in filtered" :id="s.id" :key="s.id" class="scroll-mt-24 rounded-2xl border border-border bg-card p-4">
            <div class="flex flex-wrap items-center gap-2">
              <a v-if="s.url" :href="s.url" class="font-mono text-xs font-bold text-secondary hover:underline">{{ s.id }}</a>
              <span v-else class="font-mono text-xs font-bold text-secondary">{{ s.id }}</span>
              <ArchPill :tone="tone[s.status]">{{ s.status }}</ArchPill>
              <ArchPill v-if="s.journey" tone="info">{{ s.journey }}</ArchPill>
              <ArchPill v-if="s.actor">{{ s.actor }}</ArchPill>
            </div>
            <h3 class="font-bold mt-1.5">{{ s.title }}</h3>
            <p v-if="s.story" class="text-sm text-muted-foreground mt-1">{{ s.story }}</p>
            <dl class="mt-3 grid sm:grid-cols-3 gap-3 text-sm">
              <div>
                <dt class="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Procedures</dt>
                <dd class="mt-1 flex flex-wrap gap-1">
                  <NuxtLink v-for="p in s.procedures.filter(x => !s.unknownProcedures.includes(x))" :key="p" :to="`/docs/architecture/api/${procRouter(p)}#${p}`" class="rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] hover:text-primary">{{ p }}</NuxtLink>
                  <span v-for="p in s.unknownProcedures" :key="p" class="rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[11px]" title="Not found in the code">{{ p }} ✕</span>
                  <span v-if="s.adminProcedures" class="text-xs text-muted-foreground">+{{ s.adminProcedures }} admin</span>
                  <span v-if="!s.procedures.length && !s.adminProcedures" class="text-muted-foreground">—</span>
                </dd>
              </div>
              <div>
                <dt class="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Tables</dt>
                <dd class="mt-1 flex flex-wrap gap-1">
                  <template v-for="t in s.tables" :key="t">
                    <span v-if="s.unknownTables.includes(t)" class="rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[11px]" title="Not a table in the schema">{{ t }} ✕</span>
                    <NuxtLink v-else :to="`/docs/architecture/data/${t}`" class="rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] hover:text-primary">{{ t }}</NuxtLink>
                  </template>
                  <span v-if="!s.tables.length" class="text-muted-foreground">—</span>
                </dd>
              </div>
              <div>
                <dt class="text-[11px] uppercase tracking-wider font-bold text-muted-foreground">Routes</dt>
                <dd class="mt-1 flex flex-wrap gap-1">
                  <span
                    v-for="r in s.routes"
                    :key="r"
                    class="rounded-md border px-1.5 py-0.5 font-mono text-[11px]"
                    :class="s.unknownRoutes.includes(r) ? 'border-destructive/40 bg-destructive/10' : 'border-border'"
                    :title="s.unknownRoutes.includes(r) ? 'No page matches this route' : undefined"
                  >{{ r }}<template v-if="s.unknownRoutes.includes(r)"> ✕</template></span>
                  <span v-if="!s.routes.length" class="text-muted-foreground">—</span>
                </dd>
              </div>
            </dl>
            <p v-if="s.evidence" class="text-xs text-muted-foreground mt-3"><span class="font-bold">Evidence:</span> <code class="font-mono">{{ s.evidence }}</code></p>
            <p v-if="s.notes" class="text-xs text-muted-foreground mt-1">{{ s.notes }}</p>
          </article>
        </div>
      </DesignSection>

      <DesignSection id="cross-check" class="[overflow-wrap:anywhere]" title="Cross-check against the code">
        <div class="grid lg:grid-cols-2 gap-3">
          <div class="rounded-2xl border border-border bg-card p-4">
            <h3 class="font-bold">Referenced but not in the code</h3>
            <p class="text-sm text-muted-foreground mt-1">Procedures named by a story that the router does not have — a typo, a rename, or a story marked further along than the code.</p>
            <ul v-if="doc.unknownProcedures.length" class="mt-3 flex flex-wrap gap-1.5">
              <li v-for="p in doc.unknownProcedures" :key="p" class="rounded-md border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 font-mono text-[12px]">{{ p }}</li>
            </ul>
            <p v-else class="mt-3 text-sm text-wd-green-700 font-bold">None.</p>
            <p v-if="flagged.length" class="text-sm text-muted-foreground mt-3">{{ flagged.length }} stories name a procedure, table or route that does not exist (marked ✕ above).</p>
          </div>
          <div class="rounded-2xl border border-border bg-card p-4">
            <h3 class="font-bold">Unmapped procedures ({{ doc.unmappedProcedures.length }})</h3>
            <p class="text-sm text-muted-foreground mt-1">Public and signed-in procedures no story references — dead code, or a story missing from the map.</p>
            <ul class="mt-3 flex flex-wrap gap-1.5">
              <li v-for="p in doc.unmappedProcedures" :key="p">
                <NuxtLink :to="`/docs/architecture/api/${procRouter(p)}#${p}`" class="rounded-md border border-border px-1.5 py-0.5 font-mono text-[12px] hover:text-primary">{{ p }}</NuxtLink>
              </li>
            </ul>
          </div>
        </div>
      </DesignSection>
    </template>
  </DesignPage>
</template>
