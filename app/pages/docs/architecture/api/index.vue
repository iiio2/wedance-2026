<script setup lang="ts">
import { sourceUrl } from '~/lib/architecture-nav'

definePageMeta({ layout: 'docs' })

const { api } = useArchitecture()
const q = ref('')
const kind = ref<'all' | 'query' | 'mutation'>('all')
const auth = ref<'all' | 'public' | 'protected'>('all')

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase()
  return api.procedures.filter(p =>
    (kind.value === 'all' || p.kind === kind.value)
    && (auth.value === 'all' || p.auth === auth.value)
    && (!term || p.path.toLowerCase().includes(term) || p.tables.some(t => t.includes(term))))
})
const counts = computed(() => ({
  query: api.procedures.filter(p => p.kind === 'query').length,
  mutation: api.procedures.filter(p => p.kind === 'mutation').length,
  public: api.procedures.filter(p => p.auth === 'public').length,
  protected: api.procedures.filter(p => p.auth === 'protected').length,
}))
const authTone = { public: 'neutral', session: 'info', admin: 'bad', signature: 'good' } as const
</script>

<template>
  <DesignPage
    eyebrow="Generated from server/trpc and server/api"
    site="WeDance Architecture"
    title="API"
    :lead="`${api.procedures.length} tRPC procedures in ${api.routers.length} routers and ${api.rest.length} REST / webhook handlers, read from the live router and the handler files on every build.`"
  >
    <DesignSection id="auth" title="How auth works">
      <div class="grid sm:grid-cols-3 gap-3 text-sm">
        <div class="rounded-2xl border border-border bg-card p-4"><ArchPill>public</ArchPill><p class="mt-2 text-muted-foreground">Anyone. Built on <code class="font-mono text-[12px]">publicProcedure</code>.</p></div>
        <div class="rounded-2xl border border-border bg-card p-4"><ArchPill tone="info">protected</ArchPill><p class="mt-2 text-muted-foreground">Signed-in dancer (Bearer session token). <code class="font-mono text-[12px]">protectedProcedure</code>.</p></div>
        <div class="rounded-2xl border border-border bg-card p-4"><ArchPill tone="bad">admin</ArchPill><p class="mt-2 text-muted-foreground"><code class="font-mono text-[12px]">adminProcedure</code>. {{ api.adminProcedureCount }} exist; they are listed only on the <NuxtLink to="/docs/architecture/api/admin" class="font-bold text-primary hover:underline">admin catalog</NuxtLink>.</p></div>
      </div>
      <p class="text-xs text-muted-foreground mt-2">Auth level is read from the procedure's middleware at build time, not from naming.</p>
    </DesignSection>

    <DesignSection id="routers" title="Routers">
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <NuxtLink
          v-for="r in api.routers"
          :key="r.name"
          :to="`/docs/architecture/api/${r.name}`"
          class="group rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="font-mono font-bold">{{ r.name }}</span>
            <span class="text-xs text-muted-foreground">{{ r.procedures }}</span>
          </div>
          <p v-if="r.summary" class="text-sm text-muted-foreground mt-1 line-clamp-2">{{ r.summary }}</p>
        </NuxtLink>
      </div>
    </DesignSection>

    <DesignSection id="procedures" title="All procedures" :lead="`${counts.query} queries · ${counts.mutation} mutations · ${counts.public} public · ${counts.protected} signed-in`">
      <div class="flex flex-wrap items-center gap-2 mb-4">
        <input v-model="q" type="search" placeholder="Filter by name or table…" aria-label="Filter procedures" class="h-9 w-full sm:w-64 rounded-lg border border-border bg-background px-3 text-sm">
        <select v-model="kind" aria-label="Kind" class="h-9 rounded-lg border border-border bg-background px-2 text-sm">
          <option value="all">All kinds</option><option value="query">Queries</option><option value="mutation">Mutations</option>
        </select>
        <select v-model="auth" aria-label="Auth level" class="h-9 rounded-lg border border-border bg-background px-2 text-sm">
          <option value="all">Any auth</option><option value="public">Public</option><option value="protected">Signed-in</option>
        </select>
        <span class="text-sm text-muted-foreground">{{ filtered.length }} shown</span>
      </div>
      <div class="overflow-x-auto rounded-2xl border border-border bg-card">
        <table class="w-full text-sm">
          <thead class="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr><th class="px-4 py-2">Procedure</th><th class="px-4 py-2">Kind</th><th class="px-4 py-2">Auth</th><th class="px-4 py-2">Tables</th></tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="p in filtered" :key="p.path">
              <td class="px-4 py-2"><NuxtLink :to="`/docs/architecture/api/${p.router}#${p.path}`" class="font-mono text-[12px] font-bold text-primary hover:underline">{{ p.path }}</NuxtLink></td>
              <td class="px-4 py-2"><ArchPill :tone="p.kind === 'mutation' ? 'warn' : 'good'">{{ p.kind }}</ArchPill></td>
              <td class="px-4 py-2"><ArchPill :tone="p.auth === 'protected' ? 'info' : 'neutral'">{{ p.auth }}</ArchPill></td>
              <td class="px-4 py-2 font-mono text-[11px] text-muted-foreground">{{ p.tables.join(', ') || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </DesignSection>

    <DesignSection id="rest" title="REST & webhook handlers" lead="Nitro routes under server/api. Method and path come from the file name; purpose from the file's leading comment.">
      <div class="overflow-x-auto rounded-2xl border border-border bg-card">
        <table class="w-full text-sm">
          <thead class="text-left text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr><th class="px-4 py-2">Route</th><th class="px-4 py-2">Auth</th><th class="px-4 py-2">Purpose</th><th class="px-4 py-2">Tables</th></tr>
          </thead>
          <tbody class="divide-y divide-border">
            <tr v-for="r in api.rest" :key="r.method + r.path" class="align-top">
              <td class="px-4 py-2 whitespace-nowrap">
                <span class="font-mono text-[11px] font-bold text-secondary">{{ r.method }}</span>
                <a :href="sourceUrl(r.file)" class="ml-1.5 font-mono text-[12px] hover:text-primary">{{ r.path }}</a>
              </td>
              <td class="px-4 py-2"><ArchPill :tone="authTone[r.auth]">{{ r.auth }}</ArchPill></td>
              <td class="px-4 py-2 text-muted-foreground min-w-[16rem]">{{ r.purpose ?? '— (no leading comment in the file)' }}</td>
              <td class="px-4 py-2 font-mono text-[11px] text-muted-foreground">{{ r.tables.join(', ') || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-xs text-muted-foreground mt-2">REST auth is a static heuristic: <em>signature</em> = verifies a webhook signature, <em>session</em> = reads the Bearer session, <em>admin</em> = checks is_admin, <em>public</em> = none of those.</p>
    </DesignSection>
  </DesignPage>
</template>
