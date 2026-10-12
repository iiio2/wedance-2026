<script setup lang="ts">
import type { ArchProcedure } from '~/composables/useArchitecture'
import { schemaSignature } from '~/lib/architecture-schema'
import { sourceUrl } from '~/lib/architecture-nav'

/** One tRPC procedure in the API catalog. */
const props = defineProps<{ proc: ArchProcedure }>()
const authTone = { public: 'neutral', protected: 'info', admin: 'bad' } as const
const signature = computed(() => schemaSignature(props.proc.input))
</script>

<template>
  <article :id="proc.path" class="scroll-mt-24 rounded-2xl border border-border bg-card p-4">
    <div class="flex flex-wrap items-center gap-2">
      <h3 class="font-mono font-bold text-[15px] break-all">{{ proc.path }}</h3>
      <ArchPill :tone="proc.kind === 'mutation' ? 'warn' : 'good'">{{ proc.kind }}</ArchPill>
      <ArchPill :tone="authTone[proc.auth]">{{ proc.auth }}</ArchPill>
      <a :href="sourceUrl(proc.file, proc.line)" class="ml-auto text-xs font-mono text-muted-foreground hover:text-foreground break-all">{{ proc.file }}:{{ proc.line }}</a>
    </div>
    <div class="mt-3 grid lg:grid-cols-[minmax(0,1fr)_14rem] gap-3">
      <div class="min-w-0">
        <div class="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Input</div>
        <pre class="overflow-x-auto rounded-xl bg-muted p-3 text-[12px] leading-relaxed font-mono">{{ signature }}</pre>
      </div>
      <div class="min-w-0">
        <div class="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Tables</div>
        <div v-if="proc.tables.length" class="flex flex-wrap gap-1">
          <NuxtLink v-for="t in proc.tables" :key="t" :to="`/architecture/data/${t}`" class="rounded-md border border-border px-1.5 py-0.5 font-mono text-[11px] hover:border-primary/40 hover:text-primary">{{ t }}</NuxtLink>
        </div>
        <p v-else class="text-sm text-muted-foreground">None (no database access).</p>
      </div>
    </div>
  </article>
</template>
