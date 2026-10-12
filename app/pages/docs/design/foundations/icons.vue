<script setup lang="ts">
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Calendar, CalendarDays, Check, ChevronDown, ChevronRight,
  Compass, ExternalLink, Eye, Gift, Globe, Heart, Instagram, Loader2, MapPin, MessageCircle,
  Music, Play, Plus, RotateCcw, Save, Search, Share2, Sparkles, Star, Ticket, UserPlus, Users,
  UtensilsCrossed, Video, X, Youtube,
} from 'lucide-vue-next'

definePageMeta({ layout: 'docs' })

// Most-imported icons across app/ (sketches and /docs/design excluded), 2026-10-10.
// Count = number of files importing it. 106 distinct icons in 72 files.
const top = [
  { icon: ArrowRight, name: 'ArrowRight', n: 25, use: 'Forward CTA, “see all”' },
  { icon: Check, name: 'Check', n: 24, use: 'Done, selected, included' },
  { icon: MapPin, name: 'MapPin', n: 24, use: 'Venue, city' },
  { icon: Users, name: 'Users', n: 23, use: 'Who’s going, community' },
  { icon: X, name: 'X', n: 16, use: 'Close, remove' },
  { icon: Calendar, name: 'Calendar', n: 15, use: 'Date' },
  { icon: Plus, name: 'Plus', n: 14, use: 'Add to plan, create' },
  { icon: Ticket, name: 'Ticket', n: 12, use: 'Tickets, passes' },
  { icon: Sparkles, name: 'Sparkles', n: 10, use: 'New, recommended' },
  { icon: ExternalLink, name: 'ExternalLink', n: 10, use: 'Leaves WeDance' },
  { icon: ArrowLeft, name: 'ArrowLeft', n: 10, use: 'Back' },
  { icon: Loader2, name: 'Loader2', n: 10, use: 'Loading (with animate-spin)' },
  { icon: UtensilsCrossed, name: 'UtensilsCrossed', n: 9, use: 'Food, catering' },
  { icon: ChevronDown, name: 'ChevronDown', n: 8, use: 'Expand, dropdown' },
  { icon: Globe, name: 'Globe', n: 8, use: 'Website, language' },
  { icon: MessageCircle, name: 'MessageCircle', n: 7, use: 'Chat, ask locals' },
  { icon: Heart, name: 'Heart', n: 7, use: 'Save, favourite' },
  { icon: Instagram, name: 'Instagram', n: 6, use: 'Instagram link' },
  { icon: Gift, name: 'Gift', n: 6, use: 'Free, perks' },
  { icon: Search, name: 'Search', n: 5, use: 'Search' },
  { icon: RotateCcw, name: 'RotateCcw', n: 5, use: 'Retry, reset' },
  { icon: Share2, name: 'Share2', n: 5, use: 'Share' },
  { icon: Youtube, name: 'Youtube', n: 5, use: 'YouTube link' },
  { icon: CalendarDays, name: 'CalendarDays', n: 5, use: 'Date range, schedule' },
  { icon: Compass, name: 'Compass', n: 4, use: 'Explore' },
  { icon: ChevronRight, name: 'ChevronRight', n: 4, use: 'Row drill-in' },
  { icon: Save, name: 'Save', n: 4, use: 'Save form' },
  { icon: Play, name: 'Play', n: 4, use: 'Play video' },
  { icon: Star, name: 'Star', n: 4, use: 'Rating, featured' },
  { icon: UserPlus, name: 'UserPlus', n: 4, use: 'Invite, follow' },
  { icon: Music, name: 'Music', n: 4, use: 'Style, DJ' },
  { icon: Video, name: 'Video', n: 4, use: 'Video' },
  { icon: Eye, name: 'Eye', n: 4, use: 'Preview, views' },
  { icon: ArrowUpRight, name: 'ArrowUpRight', n: 3, use: 'Open detail' },
]

// Size classes on lucide components (w-* / size-*), counted across the same files.
const sizes = [
  { cls: 'w-3 h-3', px: 12, n: 119, use: 'Inside eyebrows, badges and 10–11px meta text' },
  { cls: 'w-3.5 h-3.5', px: 14, n: 80, use: 'With text-xs / text-sm — chips, small buttons, meta rows' },
  { cls: 'w-4 h-4', px: 16, n: 169, use: 'Default. Body text, buttons, inputs, list items' },
  { cls: 'w-5 h-5', px: 20, n: 43, use: 'Icon-only buttons, card headers, nav' },
  { cls: 'w-6 h-6', px: 24, n: 15, use: 'Feature tiles, section icons' },
  { cls: 'w-8 h-8', px: 32, n: 32, use: 'Empty states, big feature icons' },
]

const importCode = `<script setup lang="ts">
import { MapPin } from 'lucide-vue-next'
<\/script>

<span class="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
  <MapPin class="w-4 h-4 shrink-0" aria-hidden="true" />
  Munich
</span>`

const iconButton = `<button type="button" aria-label="Close" class="p-2 rounded-full hover:bg-accent">
  <X class="w-5 h-5" aria-hidden="true" />
</button>`

const doSnippet = '<button aria-label="Close">\n  <X aria-hidden="true" />\n</button>'
const dontSnippet = '<button>\n  <X />\n</button>'

const a11y = [
  'Decorative icons next to text get <code>aria-hidden="true"</code> — the text already says it.',
  'Icon-only buttons and links need an <code>aria-label</code> that names the action (“Close”, “Share festival”), not the icon (“X”).',
  'Give icon-only buttons at least a 40×40px hit area: <code>p-2</code> around a <code>w-5</code> icon, or <code>p-2.5</code> around <code>w-4</code>.',
  'Never rely on an icon alone to carry status — pair Check / X with a word or colour + text.',
  'Spinners (<code>Loader2 animate-spin</code>) sit next to a visible “Saving…” label or inside a button with <code>aria-busy="true"</code>.',
]
</script>

<template>
  <DesignPage
    eyebrow="Foundations"
    title="Icons"
    status="stable"
    lead="Lucide, outline, 2px stroke, coloured by the text around it. One library — never mix in emoji or another icon set for UI."
  >
    <DesignSection id="library" title="The set" lead="lucide-vue-next. Import each icon by name; tree-shaking keeps only what you use. 106 different icons are imported across 72 files — these are the most used, ordered by how many files import them.">
      <ul class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        <li v-for="i in top" :key="i.name" class="flex items-start gap-3 rounded-xl border border-border bg-card p-3">
          <span class="flex items-center justify-center w-10 h-10 shrink-0 rounded-lg bg-accent text-foreground">
            <component :is="i.icon" class="w-5 h-5" aria-hidden="true" />
          </span>
          <span class="min-w-0">
            <code class="block font-mono text-[12px] font-bold break-all">{{ i.name }}</code>
            <span class="block text-xs text-muted-foreground leading-snug">{{ i.use }}</span>
            <span class="block text-meta text-muted-foreground/80 font-mono">{{ i.n }} files</span>
          </span>
        </li>
      </ul>
      <p class="text-sm text-muted-foreground mt-3">Before adding a new icon, check this grid for one that already means the same thing. Browse the full set at <a href="https://lucide.dev/icons" target="_blank" rel="noopener" class="text-primary underline underline-offset-2">lucide.dev/icons</a>.</p>
    </DesignSection>

    <DesignSection id="sizes" title="Sizes" lead="Match the icon to the text it sits with. Always set width and height together (or size-*).">
      <div class="rounded-2xl border border-border bg-card divide-y divide-border">
        <div v-for="s in sizes" :key="s.cls" class="grid grid-cols-[3rem_1fr] sm:grid-cols-[3.5rem_8rem_5rem_1fr] gap-x-4 gap-y-1 items-center px-5 py-3">
          <span class="flex items-center justify-center h-8">
            <MapPin :class="s.cls" aria-hidden="true" />
          </span>
          <code class="font-mono text-[13px] font-bold">{{ s.cls }}</code>
          <span class="hidden sm:block font-mono text-xs text-muted-foreground">{{ s.px }}px · {{ s.n }}×</span>
          <span class="col-span-2 sm:col-span-1 text-sm text-muted-foreground">{{ s.use }}</span>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="stroke-colour" title="Stroke and colour">
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">Stroke: 2px, always</h3>
          <p class="text-sm text-muted-foreground mt-1">Lucide’s default. All 476 icon uses in the app keep it — don’t pass <code class="font-mono text-[13px]">stroke-width</code>. Thinner strokes disappear on cream at small sizes.</p>
          <div class="flex items-center gap-4 mt-4 text-foreground">
            <Heart class="w-6 h-6" aria-hidden="true" />
            <Ticket class="w-6 h-6" aria-hidden="true" />
            <Music class="w-6 h-6" aria-hidden="true" />
            <Globe class="w-6 h-6" aria-hidden="true" />
          </div>
        </div>
        <div class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">Colour: inherit the text</h3>
          <p class="text-sm text-muted-foreground mt-1">Icons draw in <code class="font-mono text-[13px]">currentColor</code>. Colour the parent, not the icon. Use a status colour only when the icon <em>is</em> the status.</p>
          <div class="flex flex-wrap items-center gap-x-5 gap-y-2 mt-4 text-sm">
            <span class="inline-flex items-center gap-1.5 text-muted-foreground"><MapPin class="w-4 h-4" aria-hidden="true" />Munich</span>
            <span class="inline-flex items-center gap-1.5 text-primary font-bold"><ArrowRight class="w-4 h-4" aria-hidden="true" />See all</span>
            <span class="inline-flex items-center gap-1.5 text-wd-green-700 font-bold"><Check class="w-4 h-4" aria-hidden="true" />Saved</span>
          </div>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="alignment" title="Icon + text" lead="inline-flex items-center with a gap — never a margin on the icon, never vertical-align hacks.">
      <DesignExample :code="importCode">
        <span class="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin class="w-4 h-4 shrink-0" aria-hidden="true" />
          Munich
        </span>
        <span class="inline-flex items-center gap-1 text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">
          <Sparkles class="w-3 h-3" aria-hidden="true" />
          New this week
        </span>
        <button type="button" class="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold">
          <Plus class="w-4 h-4" aria-hidden="true" />
          Add to plan
        </button>
      </DesignExample>
      <ul class="mt-4 space-y-2 text-sm text-muted-foreground list-disc pl-5">
        <li>Gap: <strong class="text-foreground">gap-1</strong> with 12px icons, <strong class="text-foreground">gap-1.5</strong> with 14–16px, <strong class="text-foreground">gap-2</strong> in buttons.</li>
        <li>Icon first for a label (pin + “Munich”), icon last for direction (“See all” + arrow).</li>
        <li>Add <strong class="text-foreground">shrink-0</strong> when the text can wrap, so the icon keeps its size.</li>
        <li>For multi-line text, align to the first line: <code class="font-mono text-[13px]">flex items-start</code> + <code class="font-mono text-[13px]">mt-0.5</code> on the icon.</li>
      </ul>
    </DesignSection>

    <DesignSection id="icon-only" title="Icon-only buttons" lead="Allowed for universal actions — close, share, menu, back. Everything else gets a label.">
      <DesignExample :code="iconButton" center>
        <button type="button" aria-label="Close" class="p-2 rounded-full hover:bg-accent transition-colors">
          <X class="w-5 h-5" aria-hidden="true" />
        </button>
        <button type="button" aria-label="Share festival" class="p-2 rounded-full hover:bg-accent transition-colors">
          <Share2 class="w-5 h-5" aria-hidden="true" />
        </button>
        <button type="button" aria-label="Save to favourites" class="p-2 rounded-full hover:bg-accent transition-colors">
          <Heart class="w-5 h-5" aria-hidden="true" />
        </button>
      </DesignExample>
      <div class="mt-4">
        <DesignDoDont do-text="label the action and hide the icon from screen readers." dont-text="ship an icon-only button with no aria-label — screen readers announce “button”.">
          <template #do>
            <pre class="font-mono text-[12px] text-left">{{ doSnippet }}</pre>
          </template>
          <template #dont>
            <pre class="font-mono text-[12px] text-left">{{ dontSnippet }}</pre>
          </template>
        </DesignDoDont>
      </div>
    </DesignSection>

    <DesignSection id="accessibility" title="Accessibility">
      <DesignA11y :notes="a11y" />
    </DesignSection>
  </DesignPage>
</template>
