<script setup lang="ts">
definePageMeta({ layout: 'docs' })

// Survey of app/ (sketches and /docs/design excluded), 2026-10-10.
// Tailwind's default 4px spacing scale — no custom spacing tokens.
const steps = [
  { step: '0.5', px: 2, use: 'Badge and chip vertical padding (py-0.5 ×101)' },
  { step: '1', px: 4, use: 'Icon-to-text in tight labels (gap-1 ×149)' },
  { step: '1.5', px: 6, use: 'Icon + text in chips and meta rows (gap-1.5 ×110)' },
  { step: '2', px: 8, use: 'The default gap — inline groups, button contents (gap-2 ×324)' },
  { step: '3', px: 12, use: 'Card internals, list rows, form stacks (gap-3 ×197)' },
  { step: '4', px: 16, use: 'Page gutter (px-4 ×256), grids of cards (gap-4)' },
  { step: '6', px: 24, use: 'Card padding on larger surfaces, between blocks in a section' },
  { step: '8', px: 32, use: 'Between groups inside a section' },
  { step: '12', px: 48, use: 'Section padding on content pages (py-12 ×31)' },
  { step: '16', px: 64, use: 'Section padding on landing pages (py-16 ×43)' },
  { step: '20', px: 80, use: 'Hero and big feature sections (py-20)' },
]

const containers = [
  { cls: 'max-w-xl', px: 576, count: 31, use: 'Forms, sign-in, single-column flows' },
  { cls: 'max-w-2xl', px: 672, count: 50, use: 'Reading pages, settings, narrow dashboards' },
  { cls: 'max-w-3xl', px: 768, count: 51, use: 'Articles, profile pages, long text' },
  { cls: 'max-w-4xl', px: 896, count: 41, use: 'Content pages with a grid of cards' },
  { cls: 'max-w-5xl', px: 1024, count: 34, use: 'Landing sections, festival and city pages — the default wide page' },
  { cls: 'max-w-6xl', px: 1152, count: 19, use: 'Wide discovery grids' },
  { cls: 'max-w-7xl', px: 1280, count: 19, use: 'Full-width headers and footers' },
]

const breakpoints = [
  { name: 'base', min: '0', count: '—', use: 'Design here first: a 375px phone. Single column.' },
  { name: 'sm:', min: '640px', count: '426', use: 'The workhorse. Two columns, bigger type, side-by-side buttons.' },
  { name: 'md:', min: '768px', count: '85', use: 'Three-column grids, table layouts.' },
  { name: 'lg:', min: '1024px', count: '35', use: 'Sidebars and persistent navigation.' },
  { name: 'xl: / 2xl:', min: '1280px / 1536px', count: '3', use: 'Almost never. Don’t design for them.' },
]

const container = `<section class="py-16">
  <div class="max-w-5xl mx-auto px-4">
    <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">The journey</div>
    <h2 class="text-3xl font-display font-bold mt-1">Section title</h2>
    <div class="mt-8 grid sm:grid-cols-2 md:grid-cols-3 gap-4">
      <!-- cards -->
    </div>
  </div>
</section>`
</script>

<template>
  <DesignPage
    eyebrow="Foundations"
    title="Spacing & layout"
    status="stable"
    lead="Tailwind’s 4px scale, a handful of container widths and one page gutter. Mobile first: most pages are read on a phone at a social."
  >
    <DesignSection id="scale" title="Spacing scale" lead="Tailwind’s default scale — one step is 4px. These are the steps pages actually use; stay on them and skip the in-betweens.">
      <div class="rounded-2xl border border-border bg-card divide-y divide-border">
        <div v-for="s in steps" :key="s.step" class="grid grid-cols-[3.5rem_3rem_1fr] sm:grid-cols-[4rem_3.5rem_10rem_1fr] gap-x-4 gap-y-1 items-center px-5 py-2.5">
          <code class="font-mono text-[13px] font-bold">{{ s.step }}</code>
          <span class="font-mono text-xs text-muted-foreground">{{ s.px }}px</span>
          <span class="hidden sm:block">
            <span class="block h-3 rounded-sm bg-primary/70" :style="{ width: `${s.px}px` }" />
          </span>
          <span class="col-span-3 sm:col-span-1 text-sm text-muted-foreground">{{ s.use }}</span>
        </div>
      </div>
      <p class="text-sm text-muted-foreground mt-3">Arbitrary values like <code class="font-mono text-[13px]">p-[18px]</code> mean the layout is fighting the scale. Round to the nearest step.</p>
    </DesignSection>

    <DesignSection id="containers" title="Containers" lead="Every page section is a centred max-width box. Pick the width by content, not by screen.">
      <div class="rounded-2xl border border-border bg-card p-5 space-y-3 overflow-hidden">
        <div v-for="c in containers" :key="c.cls">
          <div class="flex flex-wrap items-baseline gap-x-3 text-sm">
            <code class="font-mono text-[13px] font-bold">{{ c.cls }}</code>
            <span class="font-mono text-xs text-muted-foreground">{{ c.px }}px · used {{ c.count }}×</span>
            <span class="text-muted-foreground">{{ c.use }}</span>
          </div>
          <div class="mt-1.5 h-2 rounded-full bg-muted">
            <div class="h-2 rounded-full bg-secondary/70" :style="{ width: `${(c.px / 1280) * 100}%` }" />
          </div>
        </div>
      </div>
      <p class="text-sm text-muted-foreground mt-3">The most common page shell is <code class="font-mono text-[13px]">max-w-5xl mx-auto px-4</code>. Text-heavy pages use <code class="font-mono text-[13px]">max-w-3xl</code> or narrower so lines stay readable.</p>
    </DesignSection>

    <DesignSection id="gutter" title="Page gutter and section rhythm">
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">Gutter: <code class="font-mono text-base">px-4</code></h3>
          <p class="text-sm text-muted-foreground mt-1">16px on every screen size, on the container itself. Used 256 times — the most common padding in the app. Don’t widen it at sm:; the max-width already gives big screens room.</p>
        </div>
        <div class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">Sections: <code class="font-mono text-base">py-12</code> – <code class="font-mono text-base">py-20</code></h3>
          <p class="text-sm text-muted-foreground mt-1"><strong class="text-foreground">py-16</strong> for landing sections, <strong class="text-foreground">py-12</strong> on content pages, <strong class="text-foreground">py-20</strong> for heroes. Inside a section: title → content <strong class="text-foreground">mt-6</strong>–<strong class="text-foreground">mt-8</strong>, between cards <strong class="text-foreground">gap-4</strong>.</p>
        </div>
      </div>
      <div class="mt-4">
        <DesignExample title="A standard section" :code="container" :padded="false">
          <div class="w-full py-8 bg-wd-red-50/60">
            <div class="max-w-md mx-auto px-4 border-x-2 border-dashed border-primary/40">
              <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">The journey</div>
              <div class="text-2xl font-display font-bold mt-1">Section title</div>
              <div class="mt-6 grid grid-cols-2 gap-4">
                <div class="h-16 rounded-2xl bg-card border border-border" />
                <div class="h-16 rounded-2xl bg-card border border-border" />
              </div>
            </div>
            <p class="text-center text-[11px] text-muted-foreground mt-3">dashed lines = container edge · red band = section padding</p>
          </div>
        </DesignExample>
      </div>
    </DesignSection>

    <DesignSection id="breakpoints" title="Breakpoints" lead="Tailwind defaults. Counts are prefix uses across pages and components.">
      <div class="rounded-2xl border border-border bg-card divide-y divide-border">
        <div v-for="b in breakpoints" :key="b.name" class="grid grid-cols-[6rem_1fr] sm:grid-cols-[7rem_9rem_4rem_1fr] gap-x-4 gap-y-1 px-5 py-3 text-sm items-baseline">
          <code class="font-mono font-bold">{{ b.name }}</code>
          <span class="font-mono text-xs text-muted-foreground">≥ {{ b.min }}</span>
          <span class="hidden sm:block font-mono text-xs text-muted-foreground">{{ b.count }}</span>
          <span class="col-span-2 sm:col-span-1 text-muted-foreground">{{ b.use }}</span>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="guidelines" title="Guidelines">
      <DesignDoDont do-text="keep related things close and groups apart — gap-2 inside a group, gap-6 or more between groups." dont-text="space everything evenly; without rhythm nothing reads as a group.">
        <template #do>
          <div class="w-48">
            <div class="h-3 w-32 rounded bg-foreground/70" />
            <div class="h-2 w-40 rounded bg-foreground/30 mt-2" />
            <div class="h-3 w-28 rounded bg-foreground/70 mt-6" />
            <div class="h-2 w-40 rounded bg-foreground/30 mt-2" />
          </div>
        </template>
        <template #dont>
          <div class="w-48">
            <div class="h-3 w-32 rounded bg-foreground/70" />
            <div class="h-2 w-40 rounded bg-foreground/30 mt-4" />
            <div class="h-3 w-28 rounded bg-foreground/70 mt-4" />
            <div class="h-2 w-40 rounded bg-foreground/30 mt-4" />
          </div>
        </template>
      </DesignDoDont>
    </DesignSection>
  </DesignPage>
</template>
