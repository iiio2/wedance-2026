<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const basicCode = `<p>Salsa Weekender Munich</p>
<Separator class="my-4" />
<p>Fri 22 – Sun 24 May</p>`

const verticalCode = `<div class="flex h-5 items-center gap-3 text-sm">
  <span>Salsa</span>
  <Separator orientation="vertical" />
  <span>Bachata</span>
  <Separator orientation="vertical" />
  <span>Kizomba</span>
</div>`

const semanticCode = `<!-- Marks a real thematic break: screen readers announce it -->
<Separator :decorative="false" />`

const propRows = [
  { name: 'orientation', type: "'horizontal' | 'vertical'", default: "'horizontal'", description: 'Horizontal is a 1px full-width line; vertical is 1px wide and full height — the parent needs a height (e.g. h-5 on a flex row).' },
  { name: 'decorative', type: 'boolean', default: 'true', description: 'When true, role="none" — hidden from assistive tech. Set false for a meaningful break: role="separator" plus aria-orientation.' },
  { name: 'class', type: 'HTMLAttributes["class"]', description: 'Merged with cn(). Use for spacing (my-4, mx-2). Colour comes from bg-border — don’t override it.' },
  { name: 'as / asChild', type: 'string | Component / boolean', default: "'div'", description: 'From reka-ui Primitive. Rarely needed.' },
]

const a11y = [
  'Default is <code>decorative</code>: the line is <code>role="none"</code> and screen readers skip it. That’s right for almost every case — the visual gap is the only thing it adds.',
  'If the line marks a real change of topic that isn’t already a heading, pass <code>:decorative="false"</code> so it becomes <code>role="separator"</code>.',
  'The line uses <code>--border</code> (brown at 13%). It’s intentionally low-contrast — never rely on a separator alone to show that two pieces of content are different; use spacing or a heading too.',
]
</script>

<template>
  <DesignPage
    eyebrow="Components"
    title="Separator"
    status="beta"
    lead="A hairline that divides content. Use it when spacing alone doesn’t make the break clear."
  >
    <DesignSection id="demo" title="Demo">
      <DesignExample :code="basicCode">
        <div class="w-full max-w-sm rounded-2xl border border-border bg-card p-5">
          <div class="text-[10px] uppercase tracking-[0.3em] font-bold text-secondary">Festival</div>
          <p class="font-display font-bold text-xl mt-1">Salsa Weekender Munich</p>
          <Separator class="my-4" />
          <dl class="grid grid-cols-2 gap-y-1 text-sm">
            <dt class="text-muted-foreground">Dates</dt>
            <dd class="font-bold">Fri 22 – Sun 24 May</dd>
            <dt class="text-muted-foreground">Pass</dt>
            <dd class="font-bold">€149</dd>
          </dl>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="vertical" title="Vertical" lead="Between inline items in a row. The row needs a fixed height for the line to show.">
      <DesignExample :code="verticalCode" center>
        <div class="flex h-5 items-center gap-3 text-sm">
          <span>Salsa</span>
          <Separator orientation="vertical" />
          <span>Bachata</span>
          <Separator orientation="vertical" />
          <span>Kizomba</span>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="semantic" title="Semantic break" lead="Only when the break means something and there is no heading to say so.">
      <DesignExample :code="semanticCode">
        <div class="w-full max-w-sm text-sm space-y-3">
          <p>Your ticket for the Saturday party is confirmed.</p>
          <Separator :decorative="false" />
          <p class="text-muted-foreground">Other events this weekend you might like.</p>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="props" title="Props">
      <DesignProps :rows="propRows" />
    </DesignSection>

    <DesignSection id="guidance" title="Do & don't">
      <DesignDoDont
        do-text="Separate groups — event details from the price block. Let spacing do the rest."
        dont-text="A line between every list row. On a phone it turns a schedule into a ruled notebook."
      >
        <template #do>
          <div class="w-full max-w-56 text-sm">
            <p class="font-bold">Rumba workshop</p>
            <p class="text-muted-foreground">Sat 13:00 · Studio 2</p>
            <Separator class="my-3" />
            <p class="font-bold">€25</p>
          </div>
        </template>
        <template #dont>
          <div class="w-full max-w-56 text-sm">
            <p>Rumba workshop</p>
            <Separator class="my-1" />
            <p>Saturday</p>
            <Separator class="my-1" />
            <p>13:00</p>
            <Separator class="my-1" />
            <p>Studio 2</p>
            <Separator class="my-1" />
            <p>€25</p>
          </div>
        </template>
      </DesignDoDont>
    </DesignSection>

    <DesignSection id="accessibility" title="Accessibility">
      <DesignA11y :notes="a11y" />
    </DesignSection>
  </DesignPage>
</template>
