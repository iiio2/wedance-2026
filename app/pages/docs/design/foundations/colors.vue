<script setup lang="ts">
import { WD } from '~/lib/brand'
import { contrastRatio, wcagLevel } from '~/lib/contrast'

definePageMeta({ layout: 'docs' })

const kebab = (k: string) => k.replace(/([A-Z]|\d+)/g, '-$1').toLowerCase()

// Core brand palette — the colours that define WeDance.
const core = [
  { key: 'cream', role: 'Page background' },
  { key: 'brown900', role: 'Headings, default text' },
  { key: 'brown700', role: 'Body text, descriptions' },
  { key: 'amber600', role: 'Eyebrows, labels, captions' },
  { key: 'red600', role: 'Primary actions, links' },
  { key: 'red800', role: 'CTA shadow, pressed red' },
  { key: 'orange500', role: 'CTA gradient end' },
  { key: 'green600', role: 'Success' },
  { key: 'cyan600', role: 'Info' },
  { key: 'amber500', role: 'Warning' },
] as const

const coreSwatches = core.map(c => {
  const hex = WD[c.key]
  const onCream = contrastRatio(hex, WD.cream)
  const onWhite = contrastRatio(hex, '#ffffff')
  return { ...c, hex, token: `--wd-${kebab(c.key)}`, onCream, onWhite }
})

const coreKeys = new Set<string>(core.map(c => c.key))
const extended = Object.entries(WD)
  .filter(([k]) => !coreKeys.has(k))
  .map(([k, hex]) => ({ key: k, hex, token: `--wd-${kebab(k)}` }))

const semantic = [
  { name: 'background', bg: 'bg-background', fg: 'text-foreground', use: 'Page canvas' },
  { name: 'card', bg: 'bg-card', fg: 'text-card-foreground', use: 'Raised surfaces' },
  { name: 'primary', bg: 'bg-primary', fg: 'text-primary-foreground', use: 'Main action' },
  { name: 'secondary', bg: 'bg-secondary', fg: 'text-secondary-foreground', use: 'Secondary action, labels' },
  { name: 'muted', bg: 'bg-muted', fg: 'text-muted-foreground', use: 'Quiet backgrounds, body text' },
  { name: 'accent', bg: 'bg-accent', fg: 'text-accent-foreground', use: 'Hover and selected states' },
  { name: 'destructive', bg: 'bg-destructive', fg: 'text-destructive-foreground', use: 'Delete, errors' },
]

const status = [
  { name: 'success', bg: 'bg-success', fg: 'text-success-foreground', use: 'Saved, confirmed, available' },
  { name: 'info', bg: 'bg-info', fg: 'text-info-foreground', use: 'Neutral highlights, tips' },
  { name: 'warning', bg: 'bg-warning', fg: 'text-warning-foreground', use: 'Few spots left, check this' },
  { name: 'destructive', bg: 'bg-destructive', fg: 'text-destructive-foreground', use: 'Errors, irreversible actions' },
]

const pairs = [
  { fg: 'brown900', bg: 'cream', label: 'Heading on cream' },
  { fg: 'brown700', bg: 'cream', label: 'Body on cream' },
  { fg: 'amber600', bg: 'cream', label: 'Eyebrow on cream' },
  { fg: 'red600', bg: 'cream', label: 'Link on cream' },
  { fg: 'cream', bg: 'red600', label: 'Cream on red' },
  { fg: 'cream', bg: 'brown900', label: 'Cream on brown' },
  { fg: 'green600', bg: 'cream', label: 'Success text on cream' },
  { fg: 'amber500', bg: 'cream', label: 'Warning text on cream' },
] as const

const pairRows = pairs.map(p => {
  const ratio = contrastRatio(WD[p.fg], WD[p.bg])
  return { ...p, fgHex: WD[p.fg], bgHex: WD[p.bg], ratio, level: wcagLevel(ratio) }
})

const levelClass = (l: string) => l === 'fail'
  ? 'bg-destructive/10 text-destructive border-destructive/30'
  : l === 'AA large'
    ? 'bg-warning/15 text-wd-amber-800 border-warning/40'
    : 'bg-success/12 text-wd-green-700 border-success/30'

const usage = `<!-- Tailwind class — preferred -->
<p class="text-muted-foreground">Body text</p>
<div class="bg-wd-cream text-wd-brown-900">…</div>

<!-- Inline CSS -->
<span style="color: var(--wd-amber-600)">Eyebrow</span>

<!-- Transparent tint -->
<div style="background: color-mix(in srgb, var(--wd-red-600) 10%, transparent)">…</div>
<div class="bg-wd-red-600/10">…</div>

<!-- JS (alpha suffix, rotations) -->
import { WD } from '~/lib/brand'
const border = WD.red600 + '55'`
</script>

<template>
  <DesignPage
    eyebrow="Foundations"
    title="Colors"
    status="stable"
    lead="Warm cream and browns carry the page; red is reserved for action. Every colour is a token — the same name in Tailwind, CSS and JS."
  >
    <DesignSection id="core" title="Core palette" lead="The colours that make a screen look like WeDance. Contrast is measured against cream (the page) and white (cards).">
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div v-for="c in coreSwatches" :key="c.key" class="rounded-2xl border border-border overflow-hidden bg-card">
          <!-- var(), not a built class name: Tailwind only generates classes it finds literally in source -->
          <div class="h-24" :style="{ background: `var(${c.token})` }" />
          <div class="p-3 space-y-0.5">
            <div class="text-sm font-bold">{{ c.role }}</div>
            <div class="font-mono text-[11px] text-secondary">{{ c.token }}</div>
            <div class="font-mono text-[11px] text-muted-foreground">{{ c.hex }}</div>
            <div class="flex gap-1.5 pt-1.5 font-mono text-[10px]">
              <span class="rounded border px-1" :class="levelClass(wcagLevel(c.onCream))" :title="`Contrast on cream: ${c.onCream.toFixed(2)}:1`">cream {{ c.onCream.toFixed(1) }}</span>
              <span class="rounded border px-1" :class="levelClass(wcagLevel(c.onWhite))" :title="`Contrast on white: ${c.onWhite.toFixed(2)}:1`">white {{ c.onWhite.toFixed(1) }}</span>
            </div>
          </div>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="semantic" title="Semantic tokens" lead="Name the job, not the colour. Components use these, so a theme change is one edit. Prefer them over the raw palette.">
      <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div v-for="s in semantic" :key="s.name" class="rounded-2xl border border-border overflow-hidden">
          <div class="h-16 flex items-center px-4 font-bold" :class="[s.bg, s.fg]">Aa {{ s.name }}</div>
          <div class="p-3 bg-card">
            <div class="font-mono text-[11px] text-secondary">{{ s.bg }} · {{ s.fg }}</div>
            <div class="text-sm text-muted-foreground mt-0.5">{{ s.use }}</div>
          </div>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="status" title="Status colours" lead="Feedback only. Never use status colours for decoration or brand accents.">
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div v-for="s in status" :key="s.name" class="rounded-2xl overflow-hidden border border-border">
          <div class="h-14 flex items-center px-4 font-bold capitalize" :class="[s.bg, s.fg]">{{ s.name }}</div>
          <div class="p-3 bg-card text-sm text-muted-foreground">{{ s.use }}</div>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="contrast" title="Text contrast" lead="Common pairings checked against WCAG 2.2. Body text needs AA (4.5:1); large or bold text needs 3:1.">
      <div tabindex="0" role="region" aria-label="Scrollable table" class="overflow-x-auto rounded-xl border border-border">
        <table class="w-full text-sm">
          <thead class="bg-muted text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th scope="col" class="px-4 py-2.5 text-left font-bold">Sample</th>
              <th scope="col" class="px-4 py-2.5 text-left font-bold">Pairing</th>
              <th scope="col" class="px-4 py-2.5 text-left font-bold">Ratio</th>
              <th scope="col" class="px-4 py-2.5 text-left font-bold">WCAG</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in pairRows" :key="p.label" class="border-t border-border">
              <td class="px-4 py-2.5">
                <span class="inline-block rounded-md px-3 py-1 font-bold" :style="{ color: p.fgHex, background: p.bgHex }">Dance tonight</span>
              </td>
              <td class="px-4 py-2.5 text-muted-foreground">{{ p.label }}</td>
              <td class="px-4 py-2.5 font-mono">{{ p.ratio.toFixed(2) }}:1</td>
              <td class="px-4 py-2.5">
                <span class="rounded border px-1.5 py-0.5 text-[11px] font-bold" :class="levelClass(p.level)">{{ p.level }}</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="text-sm text-muted-foreground mt-3">
        Amber 500 (warning) and green 600 fail as small text on cream — use them for fills and icons, and pair status text with brown.
      </p>
    </DesignSection>

    <DesignSection id="extended" title="Extended palette" lead="Accents and tints that pages already use. Fine for category colours and illustrations; reach for the core palette first.">
      <div class="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-8 gap-3">
        <div v-for="c in extended" :key="c.key">
          <div class="aspect-square rounded-xl border border-border" :style="{ background: `var(${c.token})` }" />
          <div class="font-mono text-[10px] mt-1 truncate" :title="c.token">{{ c.token.replace('--wd-', '') }}</div>
          <div class="font-mono text-[10px] text-muted-foreground">{{ c.hex }}</div>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="usage" title="Usage">
      <DesignCode :code="usage" />
      <div class="mt-6">
        <DesignDoDont do-text="use a token so the colour stays consistent and themeable." dont-text="paste a hex value — it drifts the moment the palette changes.">
          <template #do>
            <code class="font-mono text-sm rounded-md bg-muted px-2 py-1">color: var(--wd-red-600)</code>
          </template>
          <template #dont>
            <code class="font-mono text-sm rounded-md bg-muted px-2 py-1 line-through decoration-destructive">color: #dc2626</code>
          </template>
        </DesignDoDont>
      </div>
    </DesignSection>
  </DesignPage>
</template>
