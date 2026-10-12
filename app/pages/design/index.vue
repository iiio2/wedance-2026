<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'
import { componentItems, designNav } from '~/lib/design-nav'

definePageMeta({ layout: 'design' })

const principles = [
  { title: 'Warm, not loud', body: 'Cream, deep browns and one confident red. Colour carries meaning; it is never decoration for its own sake.' },
  { title: 'Phone first', body: 'Dancers open WeDance on the dance floor, one-handed. Every screen starts at 375px and grows.' },
  { title: 'One way to do it', body: 'Use the component or the token. If neither fits, propose a new one — never hand-roll a one-off.' },
  { title: 'Readable by everyone', body: 'Text meets WCAG AA, every control works by keyboard, motion respects reduced-motion.' },
]

const counts = computed(() => {
  const c = { stable: 0, beta: 0, planned: 0 }
  componentItems.forEach(i => c[i.status]++)
  return c
})

const sections = designNav.filter(s => s.title !== 'Getting started')

const usage = `<!-- 1. Prefer a component -->
<Button>Save plan</Button>

<!-- 2. Then a Tailwind token class (semantic first) -->
<p class="text-muted-foreground">…</p>
<div class="bg-wd-cream border-border">…</div>

<!-- 3. In inline CSS, a variable — never a hex -->
<span style="color: var(--wd-amber-600)">…</span>

<!-- 4. Colour computed in JS (rotations, alpha suffix) -->
<script setup lang="ts">
import { WD } from '~/lib/brand'
const accent = [WD.red600, WD.cyan600][i]   // accent + '55' still works
<\/script>`
</script>

<template>
  <DesignPage
    eyebrow="WeDance design system"
    title="Design that feels like a night out"
    lead="Tokens, components and patterns for every WeDance screen. One source of truth for designers, developers and the agents that build with them."
  >
    <DesignSection id="principles" title="Principles">
      <div class="grid sm:grid-cols-2 gap-4">
        <div v-for="p in principles" :key="p.title" class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-xl">{{ p.title }}</h3>
          <p class="text-sm text-muted-foreground mt-1.5">{{ p.body }}</p>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="how-to-use" title="How to use it" lead="Reach for these in order. Stop at the first one that fits.">
      <DesignCode :code="usage" />
      <p class="text-sm text-muted-foreground mt-4">
        Full rules and token tables live in <code class="font-mono text-[13px]">docs/design-system.md</code>.
        Tokens are defined in <code class="font-mono text-[13px]">app/assets/css/tailwind.css</code>;
        components in <code class="font-mono text-[13px]">app/components/ui</code>.
      </p>
    </DesignSection>

    <DesignSection id="status" title="Status" lead="What is ready to use and what is coming. Planned items are the roadmap.">
      <div class="grid grid-cols-3 gap-3 max-w-lg">
        <div class="rounded-2xl border border-border bg-card p-4">
          <div class="text-3xl font-display font-bold">{{ counts.stable }}</div>
          <DesignStatus status="stable" class="mt-1" />
        </div>
        <div class="rounded-2xl border border-border bg-card p-4">
          <div class="text-3xl font-display font-bold">{{ counts.beta }}</div>
          <DesignStatus status="beta" class="mt-1" />
        </div>
        <div class="rounded-2xl border border-border bg-card p-4">
          <div class="text-3xl font-display font-bold">{{ counts.planned }}</div>
          <DesignStatus status="planned" class="mt-1" />
        </div>
      </div>
      <p class="text-sm text-muted-foreground mt-3">Components only. <NuxtLink to="/design/components" class="font-bold text-primary hover:underline">See all components →</NuxtLink></p>
    </DesignSection>

    <DesignSection id="explore" title="Explore">
      <div class="space-y-8">
        <div v-for="s in sections" :key="s.title">
          <h3 class="text-[11px] uppercase tracking-wider font-bold text-muted-foreground mb-3">{{ s.title }}</h3>
          <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <template v-for="item in s.items" :key="item.to">
              <NuxtLink
                v-if="item.status !== 'planned'"
                :to="item.to"
                class="group rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <div class="flex items-center justify-between gap-2">
                  <span class="font-bold">{{ item.title }}</span>
                  <DesignStatus :status="item.status" />
                </div>
                <p class="text-sm text-muted-foreground mt-1">{{ item.summary }}</p>
                <ArrowRight class="w-4 h-4 mt-2 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
              </NuxtLink>
              <div v-else class="rounded-2xl border border-dashed border-border bg-card/60 p-4">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-bold text-muted-foreground">{{ item.title }}</span>
                  <DesignStatus :status="item.status" />
                </div>
                <p class="text-sm text-muted-foreground mt-1">{{ item.summary }}</p>
              </div>
            </template>
          </div>
        </div>
      </div>
      <p class="text-sm text-muted-foreground mt-8">
        Looking for how the app itself is built — data model, API, story map?
        <NuxtLink to="/architecture" class="font-bold text-primary hover:underline">See the architecture docs →</NuxtLink>
      </p>
    </DesignSection>
  </DesignPage>
</template>
