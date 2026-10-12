<script setup lang="ts">
import { CalendarCheck, Flame, Ticket, X } from 'lucide-vue-next'

definePageMeta({ layout: 'docs' })

const variants = [
  { name: 'default', label: 'Sold out soon', use: 'The one thing on the card that needs attention. Red — use sparingly.' },
  { name: 'secondary', label: 'Workshop', use: 'Category or type labels: workshop, social, festival, concert.' },
  { name: 'outline', label: 'Cuban Salsa', use: 'Neutral tags — dance styles, levels, cities. Safe to show many at once.' },
  { name: 'destructive', label: 'Cancelled', use: 'Something went wrong or is no longer available.' },
] as const

const basicCode = `<Badge>Sold out soon</Badge>
<Badge variant="secondary">Workshop</Badge>
<Badge variant="outline">Cuban Salsa</Badge>
<Badge variant="destructive">Cancelled</Badge>`

const iconCode = `<script setup lang="ts">
import { Flame, Ticket } from 'lucide-vue-next'
<\/script>

<template>
  <Badge><Flame class="w-3 h-3" aria-hidden="true" /> 12 tickets left</Badge>
  <Badge variant="secondary"><Ticket class="w-3 h-3" aria-hidden="true" /> Early bird</Badge>
</template>`

const tagsCode = `<div class="flex flex-wrap gap-1.5">
  <Badge v-for="style in event.styles" :key="style" variant="outline">
    {{ style }}
  </Badge>
</div>`

const propRows = [
  { name: 'variant', type: "'default' | 'secondary' | 'destructive' | 'outline'", default: "'default'", description: 'Colour treatment. See Variants for when to use each.' },
  { name: 'class', type: 'HTMLAttributes["class"]', description: 'Extra classes, merged with cn() — later classes win, so you can override padding or colour.' },
  { name: 'default slot', type: 'slot', description: 'Label text, optionally with a leading 12px Lucide icon. Keep it to one to three words.' },
]

const a11y = [
  'Badge renders a plain <code>&lt;div&gt;</code> — it is not focusable and not interactive. Never put a click handler on it; if it filters or toggles, use a Button (a filter chip pattern is planned).',
  'Colour is never the only signal: the label must say what the colour means (“Cancelled”, not a red dot).',
  'Icons inside a badge are decorative — mark them <code>aria-hidden="true"</code> so screen readers read the label once.',
  'Text is 12px semibold, so it needs 4.5:1. <code>default</code> (white on red, ~4.8:1), <code>secondary</code> and <code>outline</code> pass. <code>destructive</code> — red text on a 10% red tint — measures ~4.1:1 and is <strong>below AA</strong>; keep its label short and redundant with surrounding text until the variant is fixed. Never place badges on photos without a solid backing.',
]
</script>

<template>
  <DesignPage
    eyebrow="Components"
    title="Badge"
    status="stable"
    lead="A small pill that labels something — a dance style, an event type, a status. Badges describe; they never act."
  >
    <DesignSection id="demo" title="Demo">
      <DesignExample :code="basicCode" center>
        <Badge>Sold out soon</Badge>
        <Badge variant="secondary">Workshop</Badge>
        <Badge variant="outline">Cuban Salsa</Badge>
        <Badge variant="destructive">Cancelled</Badge>
      </DesignExample>
    </DesignSection>

    <DesignSection id="variants" title="Variants" lead="Four variants. Pick by meaning, not by which colour looks nicest next to the photo.">
      <div class="grid sm:grid-cols-2 gap-3">
        <div v-for="v in variants" :key="v.name" class="rounded-2xl border border-border bg-card p-4">
          <div class="flex items-center justify-between gap-2">
            <code class="font-mono text-[13px] font-bold">{{ v.name }}</code>
            <Badge :variant="v.name">{{ v.label }}</Badge>
          </div>
          <p class="text-sm text-muted-foreground mt-2">{{ v.use }}</p>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="with-icon" title="With an icon" lead="A leading 12px icon adds scannability on busy event cards. The badge already sets the gap.">
      <DesignExample :code="iconCode" center>
        <Badge><Flame class="w-3 h-3" aria-hidden="true" /> 12 tickets left</Badge>
        <Badge variant="secondary"><Ticket class="w-3 h-3" aria-hidden="true" /> Early bird</Badge>
        <Badge variant="outline"><CalendarCheck class="w-3 h-3" aria-hidden="true" /> In your plan</Badge>
        <Badge variant="destructive"><X class="w-3 h-3" aria-hidden="true" /> Postponed</Badge>
      </DesignExample>
    </DesignSection>

    <DesignSection id="in-context" title="In context" lead="Dance-style tags on an event row: outline badges, wrapping freely at phone width.">
      <DesignExample :code="tagsCode">
        <div class="w-full max-w-md rounded-2xl border border-border bg-card p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <div class="text-[10px] uppercase tracking-[0.3em] font-bold text-secondary">Fri · 21:00</div>
              <div class="font-display font-bold text-xl mt-1">Salsa Night at La Rumba</div>
            </div>
            <Badge variant="secondary">Social</Badge>
          </div>
          <div class="flex flex-wrap gap-1.5 mt-3">
            <Badge variant="outline">Cuban Salsa</Badge>
            <Badge variant="outline">Bachata</Badge>
            <Badge variant="outline">Timba</Badge>
            <Badge variant="outline">Rueda de Casino</Badge>
          </div>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="props" title="Props">
      <DesignProps :rows="propRows" />
    </DesignSection>

    <DesignSection id="guidance" title="Do & don't">
      <div class="space-y-4">
        <DesignDoDont
          do-text="One red badge per card at most, for the thing that needs attention now."
          dont-text="Stack several red badges — when everything shouts, nothing is urgent."
        >
          <template #do>
            <Badge>Sold out soon</Badge>
            <Badge variant="outline">Bachata</Badge>
            <Badge variant="outline">Beginner</Badge>
          </template>
          <template #dont>
            <Badge>Hot</Badge>
            <Badge>New</Badge>
            <Badge>Popular</Badge>
            <Badge>Bachata</Badge>
          </template>
        </DesignDoDont>
        <DesignDoDont
          do-text="Short labels: one to three words a dancer can scan on the floor."
          dont-text="Sentences in a badge. Put explanations in body text instead."
        >
          <template #do>
            <Badge variant="secondary">Workshop</Badge>
            <Badge variant="destructive">Cancelled</Badge>
          </template>
          <template #dont>
            <Badge variant="destructive">This event was cancelled by the organiser yesterday</Badge>
          </template>
        </DesignDoDont>
      </div>
    </DesignSection>

    <DesignSection id="accessibility" title="Accessibility">
      <DesignA11y :notes="a11y" />
    </DesignSection>
  </DesignPage>
</template>
