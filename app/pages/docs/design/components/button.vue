<script setup lang="ts">
import { ArrowRight, CalendarPlus, Heart, Search, Share2, Ticket, Trash2, X } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'

definePageMeta({ layout: 'docs' })

const brandVariants = [
  { name: 'cta', label: 'Find your next festival', use: 'The single hero action on a screen. Breathing gradient, shimmer, lift, press and ripple come from the global .wd-cta class.' },
  { name: 'pill', label: 'Book ticket', use: 'Primary action inside a card, form or modal. Solid red with the brand lip shadow.' },
  { name: 'soft', label: 'Add to my plan', use: 'Secondary action that should still feel warm — next to a pill, or on its own in a list row.' },
  { name: 'outline-pill', label: 'See the lineup', use: 'The quiet alternative beside a cta or pill. White surface, red border, red text.' },
] as const

const coreVariants = [
  { name: 'default', label: 'Save changes', use: 'Plain primary for admin and settings screens, where brand flourish is noise.' },
  { name: 'secondary', label: 'Duplicate', use: 'Neutral filled action in tools and admin.' },
  { name: 'outline', label: 'Cancel', use: 'Neutral alternative to default.' },
  { name: 'ghost', label: 'Skip for now', use: 'Tertiary actions, toolbar buttons, close buttons.' },
  { name: 'link', label: 'Read the refund policy', use: 'Inline text action inside a sentence or under a form.' },
  { name: 'destructive', label: 'Delete profile', use: 'Irreversible actions. Outlined so it never reads as a primary CTA; fills on hover.' },
] as const

const sizes = [
  { name: 'pill-sm', note: 'h-8 · text-xs · pill, uppercase' },
  { name: 'sm', note: 'h-9' },
  { name: 'default', note: 'h-10' },
  { name: 'lg', note: 'h-11 · hero CTAs' },
] as const

const decision = [
  { q: 'Is this the one thing the screen exists for?', a: 'cta', note: 'One per screen. Never two breathing buttons side by side.' },
  { q: 'Is it the main action inside a card, form or modal?', a: 'pill', note: 'Book ticket, Send request, Save profile.' },
  { q: 'Is it a secondary action that sits next to the primary?', a: 'soft or outline-pill', note: 'soft on cream and white; outline-pill when the background is busy.' },
  { q: 'Is it tertiary — skip, close, back, edit?', a: 'ghost or link', note: 'link inside text, ghost everywhere else.' },
  { q: 'Does it delete or cancel something for good?', a: 'destructive', note: 'Pair it with a confirm step that says what will be lost.' },
  { q: 'Admin, settings or a dense tool?', a: 'default / secondary / outline', note: 'The shadcn set. Square-ish, sentence case, no lip.' },
]

const loading = ref(false)
function fakeSubmit() {
  loading.value = true
  setTimeout(() => (loading.value = false), 1800)
}

const propRows = [
  { name: 'variant', type: `'cta' | 'pill' | 'soft' | 'outline-pill' | 'default' | 'secondary' | 'outline' | 'ghost' | 'link' | 'destructive'`, default: `'default'`, description: 'Visual style. Brand variants are pills: rounded, bold, uppercase, tracked.' },
  { name: 'size', type: `'default' | 'sm' | 'lg' | 'pill-sm' | 'icon' | 'icon-sm' | 'icon-lg' | 'icon-round'`, default: `'default'`, description: 'Height and padding. pill-sm is the small uppercase pill; icon-round is a 44px round icon-only button.' },
  { name: 'loading', type: 'boolean', default: 'false', description: 'Shows a spinner, sets aria-busy="true" and disables the button. Keep the label — change it to the running verb ("Booking…").' },
  { name: 'disabled', type: 'boolean', default: 'false', description: 'Native disabled. Dimmed, desaturated, cursor not-allowed; the cta stops animating.' },
  { name: 'as', type: 'string | Component', default: `'button'`, description: 'Element or component to render. Leave as button for actions.' },
  { name: 'asChild', type: 'boolean', default: 'false', description: 'Render the single child (e.g. NuxtLink) with the button styles instead of a wrapper. Use for navigation.' },
  { name: 'class', type: 'string | array | object', default: '—', description: 'Extra classes, merged with tailwind-merge — layout only (w-full, mt-4), not colours.' },
]

const a11y = [
  'Button renders a real <code>&lt;button&gt;</code> — keyboard focus, Enter/Space and <code>disabled</code> work for free. Never put <code>@click</code> on a div.',
  'Navigation is a link, not a button: use <code>as-child</code> with <code>NuxtLink</code> so it renders an <code>&lt;a href&gt;</code> people can open in a new tab.',
  'Icon-only buttons (<code>icon</code>, <code>icon-round</code>) need an <code>aria-label</code>, and the icon gets <code>aria-hidden="true"</code>.',
  'Don’t disable without saying why. If “Book ticket” is unavailable, tell people next to it (“Sold out”, “Pick a pass first”) — a dimmed button alone is a dead end.',
  'Every variant shows the amber focus ring on keyboard focus. Don’t remove it with <code>outline-none</code> overrides.',
  '<code>loading</code> sets <code>aria-busy</code> and keeps the label in the DOM, so screen readers still announce what is running.',
  'The cta’s breathing and shimmer stop under <code>prefers-reduced-motion</code> and when disabled.',
  'Uppercase is visual only (CSS) — write labels in sentence case in the source so screen readers don’t spell them out.',
]

const migrate = `<!-- Before: hand-rolled (≈28 copies across pages) -->
<button
  class="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-bold uppercase tracking-wider"
  style="background:linear-gradient(135deg, var(--wd-red-600), var(--wd-orange-500)); box-shadow: 0 4px 0 -1px var(--wd-red-800);"
  @click="openAuth">
  Join WeDance
</button>

<!-- After -->
<Button variant="cta" size="lg" @click="openAuth">Join WeDance</Button>`
</script>

<template>
  <DesignPage
    eyebrow="Components"
    title="Button"
    status="stable"
    lead="Buttons start things: booking a pass, adding a festival to your plan, sending a request. WeDance has a warm brand set for dancer-facing screens and the plain shadcn set for admin and tools."
  >
    <DesignSection id="overview" title="Overview">
      <DesignExample
        center
        code='<Button variant="cta" size="lg">Find your next festival <ArrowRight /></Button>
<Button variant="pill">Book ticket</Button>
<Button variant="soft">Add to my plan</Button>
<Button variant="outline-pill">See the lineup</Button>'
      >
        <Button variant="cta" size="lg">
          Find your next festival <ArrowRight aria-hidden="true" />
        </Button>
        <Button variant="pill">Book ticket</Button>
        <Button variant="soft">Add to my plan</Button>
        <Button variant="outline-pill">See the lineup</Button>
      </DesignExample>
      <p class="text-sm text-muted-foreground mt-4 max-w-2xl">
        Import from <code class="font-mono text-secondary">@/components/ui/button</code>. A survey of 255 hand-rolled
        <code class="font-mono">&lt;button&gt;</code>s in product pages found about 28 gradient CTAs, 10 solid pills with a lip shadow,
        12 soft tinted pills, 14 white outline pills and 39 small uppercase pills — each now one variant away.
      </p>
    </DesignSection>

    <DesignSection id="choosing" title="Which variant?" lead="Ask these in order and stop at the first yes.">
      <ol class="rounded-2xl border border-border bg-card divide-y divide-border">
        <li v-for="(d, i) in decision" :key="d.q" class="grid sm:grid-cols-[2rem_1fr_12rem] gap-x-4 gap-y-1 px-5 py-4 text-sm">
          <span class="font-display font-bold text-secondary">{{ i + 1 }}</span>
          <span>
            <span class="font-bold text-foreground">{{ d.q }}</span>
            <span class="block text-muted-foreground mt-0.5">{{ d.note }}</span>
          </span>
          <code class="font-mono text-primary font-bold self-center">{{ d.a }}</code>
        </li>
      </ol>
    </DesignSection>

    <DesignSection id="brand" title="Brand variants" lead="Dancer-facing screens. Pills: rounded, bold, uppercase, tracked.">
      <div class="grid gap-4">
        <DesignExample
          v-for="v in brandVariants"
          :key="v.name"
          :title="v.name"
          :code="`<Button variant=&quot;${v.name}&quot;>${v.label}</Button>`"
        >
          <Button :variant="v.name">{{ v.label }}</Button>
          <Button :variant="v.name" size="pill-sm">{{ v.label }}</Button>
          <Button :variant="v.name" disabled>{{ v.label }}</Button>
          <p class="basis-full text-sm text-muted-foreground">{{ v.use }}</p>
        </DesignExample>
      </div>
    </DesignSection>

    <DesignSection id="core" title="Core variants" lead="The shadcn set — admin, settings, dense tools, dialogs.">
      <div class="rounded-2xl border border-border bg-card divide-y divide-border">
        <div v-for="v in coreVariants" :key="v.name" class="grid sm:grid-cols-[9rem_14rem_1fr] items-center gap-x-4 gap-y-2 px-5 py-4">
          <code class="font-mono text-sm font-bold text-secondary">{{ v.name }}</code>
          <div class="flex gap-2">
            <Button :variant="v.name" size="sm">{{ v.label }}</Button>
          </div>
          <p class="text-sm text-muted-foreground">{{ v.use }}</p>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="accent" title="Accent colour" lead="Brand variants re-tint with accent — for a festival's own colour or a category. The accent must reach 4.5:1 against white.">
      <DesignExample code='<Button variant="pill" accent="var(--wd-violet-600)">Add to my plan</Button>
<Button variant="soft" accent="var(--wd-cyan-700)">Share ride</Button>
<Button variant="cta" :accent="festival.accentColor">Book ticket</Button>'>
        <Button variant="pill" accent="var(--wd-violet-600)">Add to my plan</Button>
        <Button variant="soft" accent="var(--wd-cyan-700)">Share ride</Button>
        <Button variant="outline-pill" accent="var(--wd-green-700)">I'm going</Button>
        <Button variant="cta" accent="var(--wd-cyan-700)">Book ticket</Button>
      </DesignExample>
    </DesignSection>

    <DesignSection id="sizes" title="Sizes">
      <DesignExample
        code='<Button variant="pill" size="pill-sm">Ask locals</Button>
<Button variant="pill" size="sm">Book ticket</Button>
<Button variant="pill">Book ticket</Button>
<Button variant="pill" size="lg">Book ticket</Button>'
      >
        <div v-for="s in sizes" :key="s.name" class="flex flex-col items-start gap-2">
          <Button variant="pill" :size="s.name">Book ticket</Button>
          <span class="text-[11px] font-mono text-muted-foreground">{{ s.name }} · {{ s.note }}</span>
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="states" title="States" lead="Hover a button to see its hover state; tab to see the focus ring.">
      <div tabindex="0" role="region" aria-label="Scrollable table" class="overflow-x-auto rounded-2xl border border-border bg-card">
        <table class="w-full text-sm">
          <thead class="bg-muted text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th scope="col" class="px-4 py-2.5 text-left font-bold">Variant</th>
              <th scope="col" class="px-4 py-2.5 text-left font-bold">Rest / hover</th>
              <th scope="col" class="px-4 py-2.5 text-left font-bold">Disabled</th>
              <th scope="col" class="px-4 py-2.5 text-left font-bold">Loading</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="v in [...brandVariants, ...coreVariants]" :key="v.name" class="border-t border-border">
              <td class="px-4 py-3 font-mono text-[13px] font-bold text-secondary whitespace-nowrap">{{ v.name }}</td>
              <td class="px-4 py-3"><Button :variant="v.name" size="sm">Book ticket</Button></td>
              <td class="px-4 py-3"><Button :variant="v.name" size="sm" disabled>Book ticket</Button></td>
              <td class="px-4 py-3"><Button :variant="v.name" size="sm" loading>Booking…</Button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </DesignSection>

    <DesignSection id="loading" title="Loading" lead="Use loading while a request runs — it disables the button, shows a spinner and sets aria-busy.">
      <DesignExample
        center
        code='<Button variant="pill" :loading="sending" @click="send">
  {{ sending ? "Sending request…" : "Send booking request" }}
</Button>'
      >
        <Button variant="pill" :loading="loading" @click="fakeSubmit">
          {{ loading ? 'Sending request…' : 'Send booking request' }}
        </Button>
      </DesignExample>
    </DesignSection>

    <DesignSection id="icons" title="With icons" lead="lucide-vue-next icons size themselves to 16px. Put the icon before the label for objects, after it for direction.">
      <DesignExample
        code='<Button variant="pill"><Ticket aria-hidden="true" /> Book ticket</Button>
<Button variant="soft"><CalendarPlus aria-hidden="true" /> Add to my plan</Button>
<Button variant="cta">Find your next festival <ArrowRight aria-hidden="true" /></Button>
<Button variant="outline-pill" size="icon-round" aria-label="Save to favourites"><Heart aria-hidden="true" /></Button>
<Button variant="ghost" size="icon" aria-label="Close"><X aria-hidden="true" /></Button>'
      >
        <Button variant="pill"><Ticket aria-hidden="true" /> Book ticket</Button>
        <Button variant="soft"><CalendarPlus aria-hidden="true" /> Add to my plan</Button>
        <Button variant="cta">Find your next festival <ArrowRight aria-hidden="true" /></Button>
        <Button variant="outline-pill" size="icon-round" aria-label="Save to favourites"><Heart aria-hidden="true" /></Button>
        <Button variant="soft" size="icon-round" aria-label="Share this festival"><Share2 aria-hidden="true" /></Button>
        <Button variant="ghost" size="icon" aria-label="Close"><X aria-hidden="true" /></Button>
        <Button variant="outline" size="icon-sm" aria-label="Search festivals"><Search aria-hidden="true" /></Button>
      </DesignExample>
    </DesignSection>

    <DesignSection id="links" title="As a link" lead="If it goes somewhere, it's a link. as-child passes the button styles to NuxtLink, which renders a real <a href>.">
      <DesignExample
        center
        code='<Button as-child variant="cta" size="lg">
  <NuxtLink to="/festivals">Find your next festival</NuxtLink>
</Button>
<Button as-child variant="link">
  <NuxtLink to="/docs/design">Back to the design system</NuxtLink>
</Button>'
      >
        <Button as-child variant="cta" size="lg">
          <NuxtLink to="/festivals">Find your next festival</NuxtLink>
        </Button>
        <Button as-child variant="link">
          <NuxtLink to="/docs/design">Back to the design system</NuxtLink>
        </Button>
      </DesignExample>
    </DesignSection>

    <DesignSection id="migrate" title="Replacing hand-rolled buttons" lead="Pages still carry inline gradients and lip shadows. When you touch one, swap it.">
      <DesignCode :code="migrate" />
    </DesignSection>

    <DesignSection id="props" title="Props">
      <DesignProps :rows="propRows" />
    </DesignSection>

    <DesignSection id="guidance" title="Do and don't">
      <div class="grid gap-4">
        <DesignDoDont
          do-text="One cta per screen — the action the page exists for. Everything else steps down to pill, soft or outline-pill."
          dont-text="Two breathing CTAs compete. Neither reads as the main action, and the motion turns into noise."
        >
          <template #do>
            <Button variant="cta">Book ticket</Button>
            <Button variant="outline-pill">See the lineup</Button>
          </template>
          <template #dont>
            <Button variant="cta">Book ticket</Button>
            <Button variant="cta">See the lineup</Button>
          </template>
        </DesignDoDont>
        <DesignDoDont
          do-text="Explain why an action is unavailable, right next to it."
          dont-text="A silently disabled button. People can't tell if it's broken or what to do next."
        >
          <template #do>
            <div class="flex flex-col items-center gap-2">
              <Button variant="pill" disabled>Book ticket</Button>
              <span class="text-xs text-muted-foreground">Pick a pass to continue</span>
            </div>
          </template>
          <template #dont>
            <Button variant="pill" disabled>Book ticket</Button>
          </template>
        </DesignDoDont>
        <DesignDoDont
          do-text="Destructive for irreversible actions, with a plain label that names what goes."
          dont-text="A bright filled red button for delete — it looks exactly like Book ticket."
        >
          <template #do>
            <Button variant="destructive"><Trash2 aria-hidden="true" /> Delete profile</Button>
          </template>
          <template #dont>
            <Button variant="pill"><Trash2 aria-hidden="true" /> Delete</Button>
          </template>
        </DesignDoDont>
      </div>
    </DesignSection>

    <DesignSection id="accessibility" title="Accessibility">
      <DesignA11y :notes="a11y" />
    </DesignSection>
  </DesignPage>
</template>
