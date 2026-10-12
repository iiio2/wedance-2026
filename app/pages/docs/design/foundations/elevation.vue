<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const radii = [
  { cls: 'rounded-md', px: '8px', use: 'Inputs in dense admin UI, code chips' },
  { cls: 'rounded-lg', px: '10px', use: 'Small buttons, menu items' },
  { cls: 'rounded-xl', px: '14px', use: 'Tiles, small cards, swatches' },
  { cls: 'rounded-2xl', px: '16px', use: 'Cards, panels, dialogs' },
  { cls: 'rounded-3xl', px: '24px', use: 'Hero images, feature panels' },
  { cls: 'rounded-full', px: 'pill', use: 'CTAs, chips, avatars, filters — the most used shape' },
]

// The shadow recipes pages actually use (counted 2026-10-10), now tokens in tailwind.css.
const usage = `<!-- Tailwind utility (preferred) -->
<button class="rounded-full bg-primary text-primary-foreground shadow-wd-lip">Book</button>

<!-- Recolour lip or sticker: set --wd-shadow-color on the same element -->
<button class="rounded-full bg-info text-white shadow-wd-lip"
        style="--wd-shadow-color: var(--wd-cyan-700)">Join</button>
<article class="rounded-2xl border shadow-wd-sticker"
         :style="{ '--wd-shadow-color': accent }">…</article>

<!-- Inline CSS (default colour only) -->
<div style="box-shadow: var(--wd-shadow-card)">…</div>`

const shadows = [
  {
    name: 'Lip',
    css: '0 3px 0 -1px var(--wd-shadow-color, var(--wd-red-800))',
    token: '--wd-shadow-lip',
    cls: 'shadow-wd-lip',
    use: 'The hard, offset under-edge on pill buttons — makes them feel pressable. Defaults to red-800; on other buttons set --wd-shadow-color to the button’s darker step (cyan-700 on cyan, green-700 on green).',
    demo: 'lip',
  },
  {
    name: 'Card',
    css: '0 1px 0 color-mix(in srgb, var(--wd-brown-900) 4%, transparent), 0 6px 18px rgba(59,31,18,0.04)',
    token: '--wd-shadow-card',
    cls: 'shadow-wd-card',
    use: 'Hairline plus a warm, barely-there blur. Default for cards on cream.',
    demo: 'card',
  },
  {
    name: 'Sticker',
    css: '3px 4px 0 -1px var(--wd-shadow-color, currentColor)',
    token: '--wd-shadow-sticker',
    cls: 'shadow-wd-sticker',
    use: 'Offset solid shadow in the item’s accent colour — the playful “stuck on” look for festival and plan cards. Set --wd-shadow-color to the accent (defaults to the text colour).',
    demo: 'sticker',
  },
  {
    name: 'Float',
    css: '0 6px 20px rgba(0,0,0,0.18), 0 3px 0 -1px rgba(0,0,0,0.15)',
    token: '--wd-shadow-float',
    cls: 'shadow-wd-float',
    use: 'Things above the page: floating buttons, popovers, the report-a-problem pill.',
    demo: 'float',
  },
  {
    name: 'Focus halo',
    css: '0 0 0 3px color-mix(in srgb, var(--wd-red-600) 15%, transparent)',
    token: '--wd-shadow-focus',
    cls: 'shadow-wd-focus',
    use: 'Soft ring around focused inputs. Keyboard focus on buttons uses the ring token instead.',
    demo: 'focus',
  },
]
</script>

<template>
  <DesignPage
    eyebrow="Foundations"
    title="Elevation"
    status="stable"
    lead="Soft, rounded and a little tactile. Pills for anything you tap, generous radii for surfaces, and shadows that feel printed rather than floating."
  >
    <DesignSection id="radius" title="Corner radius" lead="Tailwind radius classes, driven by --radius (0.625rem). Pick by size of the element, not by taste.">
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div v-for="r in radii" :key="r.cls" class="rounded-2xl border border-border bg-card p-4">
          <div class="h-16 bg-accent border-2 border-secondary/40" :class="r.cls" />
          <div class="mt-3 flex items-baseline justify-between gap-2">
            <code class="font-mono text-[13px] font-bold">{{ r.cls }}</code>
            <span class="font-mono text-[11px] text-muted-foreground">{{ r.px }}</span>
          </div>
          <p class="text-xs text-muted-foreground mt-1">{{ r.use }}</p>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="shadows" title="Shadows" lead="Five recipes cover almost every surface. Each is a CSS variable (--wd-shadow-*) and a Tailwind utility (shadow-wd-*). 85 inline shadows in pages still repeat them by hand; they move over when a page is next touched.">
      <div class="space-y-4">
        <div v-for="s in shadows" :key="s.name" class="grid md:grid-cols-[14rem_1fr] rounded-2xl border border-border bg-card overflow-hidden">
          <div class="flex items-center justify-center p-8 bg-background/60">
            <span v-if="s.demo === 'lip'" class="inline-flex px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider shadow-wd-lip">Book</span>
            <span v-else-if="s.demo === 'card'" class="block w-36 h-20 rounded-2xl bg-card border border-border shadow-wd-card" />
            <span v-else-if="s.demo === 'sticker'" class="block w-36 h-20 rounded-2xl bg-card border border-wd-purple-500/40 shadow-wd-sticker" style="--wd-shadow-color: var(--wd-purple-500)" />
            <span v-else-if="s.demo === 'float'" class="inline-flex px-4 py-2 rounded-full bg-wd-brown-900 text-wd-cream text-xs font-bold shadow-wd-float">Report a problem</span>
            <span v-else class="block w-40 h-10 rounded-full bg-white border border-primary shadow-wd-focus" />
          </div>
          <div class="p-5">
            <div class="flex flex-wrap items-baseline gap-x-3">
              <h3 class="font-display font-bold text-xl">{{ s.name }}</h3>
              <code class="font-mono text-[12px] text-secondary">{{ s.cls }}</code>
              <code class="font-mono text-[12px] text-muted-foreground">var({{ s.token }})</code>
            </div>
            <p class="text-sm text-muted-foreground mt-1">{{ s.use }}</p>
            <code class="block mt-3 font-mono text-[12px] rounded-lg bg-muted px-3 py-2 break-all">{{ s.cls }} → box-shadow: {{ s.css }};</code>
          </div>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="usage" title="Using the tokens" lead="Reach for the utility class. Lip and sticker take their colour from --wd-shadow-color on the element; the utility resolves it there, so per-card accents work.">
      <DesignCode :code="usage" lang="html" />
      <ul class="mt-4 space-y-2 text-sm text-muted-foreground list-disc pl-5">
        <li><code class="font-mono text-[13px] text-foreground">var(--wd-shadow-lip)</code> and <code class="font-mono text-[13px] text-foreground">var(--wd-shadow-sticker)</code> in inline CSS resolve at the root, so they always use the default colour (red-800 / currentColor). Use the utility when you need another colour.</li>
        <li>Pressed state: drop the lip (<code class="font-mono text-[13px] text-foreground">active:shadow-none active:translate-y-px</code>) so the button looks pushed in.</li>
        <li>Keyboard focus on buttons and links uses the ring token (<code class="font-mono text-[13px] text-foreground">focus-visible:ring-2 ring-ring</code>), not the focus halo.</li>
        <li>Variants seen in pages — a deeper 4px lip on large CTAs and bigger sticker offsets on hero art — are not tokens yet. Keep them inline; promote one when it repeats.</li>
      </ul>
    </DesignSection>
  </DesignPage>
</template>
