<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
import type { DocStatus } from '~/lib/design-nav'
import { componentItems } from '~/lib/design-nav'

definePageMeta({ layout: 'docs' })

const groups: { status: DocStatus, title: string, lead: string }[] = [
  { status: 'stable', title: 'Stable', lead: 'Documented and settled. Use these freely.' },
  { status: 'beta', title: 'Beta', lead: 'Usable today, but the look or API may still change. Check the page before relying on details.' },
  { status: 'planned', title: 'Planned', lead: 'Not built yet — listed so the roadmap is visible. Until they land, follow the closest existing page pattern.' },
]

const byStatus = (s: DocStatus) => componentItems.filter(i => i.status === s)
</script>

<template>
  <DesignPage
    eyebrow="Components"
    title="All components"
    lead="Every shared component in app/components/ui, grouped by how ready it is. Reach for one of these before building anything by hand."
  >
    <DesignSection
      v-for="g in groups"
      :id="g.status"
      :key="g.status"
      :title="`${g.title} (${byStatus(g.status).length})`"
      :lead="g.lead"
    >
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <template v-for="item in byStatus(g.status)" :key="item.to">
          <div
            v-if="item.status === 'planned'"
            class="rounded-2xl border border-dashed border-border bg-card/60 p-4 opacity-70"
            aria-disabled="true"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold">{{ item.title }}</span>
              <DesignStatus :status="item.status" />
            </div>
            <p class="text-sm text-muted-foreground mt-1">{{ item.summary }}</p>
            <p class="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mt-2">Planned — no page yet</p>
          </div>
          <NuxtLink
            v-else
            :to="item.to"
            class="group rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="font-bold">{{ item.title }}</span>
              <DesignStatus :status="item.status" />
            </div>
            <p class="text-sm text-muted-foreground mt-1">{{ item.summary }}</p>
            <span class="inline-flex items-center gap-1 mt-2 text-sm font-bold text-primary">
              View docs <ArrowRight class="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </NuxtLink>
        </template>
      </div>
    </DesignSection>
  </DesignPage>
</template>
