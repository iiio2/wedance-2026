<script setup lang="ts">
import { WD } from '~/lib/brand'
import { mockFestival } from '~/data/mock-meneate'
import cityImages from '~~/server/data/city-images.json'

definePageMeta({ layout: 'docs' })

// Real data: the Munich landmark the city page uses (Wikimedia, CC licensed).
const munich = (cityImages as Record<string, { image: string, credit?: string, license?: string, source?: string }>).munich!

const photoCode = `<section class="relative">
  <div class="relative w-full h-64 sm:h-96 overflow-hidden">
    <img :src="hero.image" :alt="\`\${city.name} — landmark\`" class="absolute inset-0 w-full h-full object-cover" fetchpriority="high">
    <!-- Scrim: light at the top, dark where the title sits -->
    <div class="absolute inset-0" style="background:linear-gradient(180deg, rgba(59,31,18,0.15) 0%, rgba(59,31,18,0.05) 40%, rgba(59,31,18,0.75) 100%);" />
    <div class="relative h-full max-w-4xl mx-auto px-4 flex flex-col justify-end pb-6">
      <div class="font-display italic text-lg text-wd-amber-100">— {{ city.eventCount }} weekly events</div>
      <h1 class="font-display text-5xl sm:text-7xl leading-[0.98] tracking-tight text-white">{{ city.name }}</h1>
    </div>
    <!-- Attribution is required by the CC licence -->
    <a :href="hero.source" class="absolute bottom-1.5 right-2 text-[10px] …">📷 {{ hero.credit }} · {{ hero.license }}</a>
  </div>
</section>`

const textCode = `<div class="text-sm tracking-widest uppercase text-secondary">The festival year</div>
<h1 class="font-display text-5xl sm:text-6xl leading-[0.98] text-foreground">
  Pick your <em class="italic text-primary">next one.</em>
</h1>
<p class="mt-5 font-sans text-lg text-muted-foreground max-w-xl">Every festival mapped. See who is going before you book.</p>`

const waveCode = `<svg class="block w-full h-10 -mb-px" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
  <path d="M0,40 Q360,0 720,30 T1440,20 V60 H0 Z" :fill="WD.brown900" opacity="0.08" />
</svg>`

const festivalCode = `<FestivalHero :festival="festival" :picked="inPlan" @pick="togglePlan" />
<!-- events reuse it: entity-label="event" review-target-type="event" cta-anchor="#going" -->`

const imageRules = [
  { rule: 'Real photos only.', why: 'Every person shown is a real dancer, teacher or host at a real night. No stock, no AI-generated people, no avatar generators — “Every face — real” is on the homepage.' },
  { rule: 'Cities: landmark, not dancers.', why: 'City heroes use a Wikipedia landmark photo (scripts/fetch-city-images.mjs → server/data/city-images.json). We don’t have dancers from every city yet, and a generic “people dancing” photo would lie.' },
  { rule: 'No photo? Use the text hero.', why: 'When there is no landmark, the city falls back to the cream text hero with sun rays in the city accent. Never fill the gap with a placeholder image.' },
  { rule: 'Credit the photographer.', why: 'Wikimedia images are CC-licensed: the credit + licence pill in the bottom-right corner is required, not decoration.' },
  { rule: 'Faces above the fold, not cropped.', why: 'Use object-position (e.g. center 30%) so heads survive the 4:5 and wide crops.' },
]

const a11y = [
  '<strong>One <code>&lt;h1&gt;</code> per page — it lives in the hero.</strong> The eyebrow is a <code>&lt;div&gt;</code>, not a heading.',
  '<strong>Scrim before shadow.</strong> White title text over a photo needs the gradient scrim (75% brown at the bottom). The text-shadow alone is not enough on bright skies.',
  '<strong>Alt text</strong> describes the image (“Munich — landmark”, “Alösha on stage at the end of the Charanga Habanera Munich concert he hosted”). Decorative SVGs (sun rays, wave) get <code>aria-hidden="true"</code>.',
  '<strong>Hero image is the LCP.</strong> Load it eager with <code>fetchpriority="high"</code>; never lazy-load the hero.',
  '<strong>Italic highlights are emphasis</strong> — use <code>&lt;em&gt;</code> so they are announced, and keep them short (one to three words).',
]
</script>

<template>
  <DesignPage
    eyebrow="Patterns"
    title="Heroes"
    status="beta"
    lead="The first screen of a page: a big Playfair title, a small italic aside, one clear action — on cream, or over a real photo. Every hero ends in the same soft wave."
  >
    <DesignSection id="types" title="Three hero types" lead="Pick by what you have, in this order: a real photo of the place → the festival’s own identity → words.">
      <div class="grid sm:grid-cols-3 gap-4 text-sm">
        <div class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">Photo hero</h3>
          <p class="text-muted-foreground mt-1">City pages with a landmark image. Title sits bottom-left on a scrim.</p>
        </div>
        <div class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">Identity hero</h3>
          <p class="text-muted-foreground mt-1">Festivals and events (FestivalHero). Logo with sticker shadow, countdown, name, CTAs — tinted by the festival accent.</p>
        </div>
        <div class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">Text hero</h3>
          <p class="text-muted-foreground mt-1">Homepage, listings, cities without a photo. Eyebrow + title with an italic highlight.</p>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="photo" title="Photo hero with scrim" lead="From /cities/[city], with the real Munich image and credit.">
      <DesignExample :code="photoCode" :padded="false">
        <section class="relative w-full bg-background">
          <div class="relative w-full h-64 sm:h-80 overflow-hidden">
            <img :src="munich.image" alt="Munich — landmark" class="absolute inset-0 w-full h-full object-cover" loading="lazy">
            <div class="absolute inset-0 bg-[linear-gradient(180deg,rgba(59,31,18,0.15)_0%,rgba(59,31,18,0.05)_40%,rgba(59,31,18,0.75)_100%)]" />
            <div class="relative h-full px-6 flex flex-col justify-end pb-6">
              <div class="font-display italic text-lg leading-none mb-1 text-wd-amber-100">— 42 weekly events</div>
              <div class="font-display text-5xl sm:text-6xl leading-[0.98] tracking-tight text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.35)]">Munich</div>
            </div>
            <a
              :href="munich.source"
              target="_blank"
              rel="noopener nofollow"
              class="absolute bottom-1.5 right-2 text-[10px] px-1.5 py-0.5 rounded font-sans text-white/75 bg-black/25"
            >📷 {{ munich.credit }} · {{ munich.license }}</a>
          </div>
          <svg class="block w-full h-10 -mb-px" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,40 Q360,0 720,30 T1440,20 V60 H0 Z" :fill="WD.brown900" opacity="0.08" />
          </svg>
        </section>
      </DesignExample>
      <div class="grid sm:grid-cols-2 gap-4 mt-4 text-sm">
        <div class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">Scrim recipe</h3>
          <p class="text-muted-foreground mt-1">Warm brown (brown-900 as rgba 59,31,18), three stops: <code>15% → 5% at 40% → 75%</code>. Light at the top so the photo breathes, dark at the bottom where the text is. Plus a soft <code>text-shadow: 0 2px 24px rgba(0,0,0,.35)</code> on the title.</p>
        </div>
        <div class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">Sizes</h3>
          <p class="text-muted-foreground mt-1">Height <code>h-64 sm:h-96</code>. Title <code>text-5xl sm:text-7xl</code>, <code>leading-[0.98]</code>, <code>tracking-tight</code>. Content constrained to <code>max-w-4xl</code> so it lines up with the page below.</p>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="identity" title="Identity hero (festival & event)" lead="Live FestivalHero with ¡Menéate Viena! data. The accent tints the sun rays, the countdown, the planning chip and both CTAs.">
      <DesignExample :code="festivalCode" :padded="false">
        <div class="w-full">
          <FestivalHero :festival="mockFestival" />
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="text" title="Text hero with eyebrow + italic highlight" lead="The default. Eyebrow in caps amber, then a title where one short phrase turns italic and red. A second, green italic aside is allowed once per page (homepage: “year.”).">
      <DesignExample :code="textCode">
        <div class="w-full text-center py-4">
          <div class="text-sm tracking-widest uppercase mb-3 text-secondary font-display">The festival year</div>
          <div class="font-display text-4xl sm:text-6xl leading-[0.98] text-foreground">
            Pick your <em class="italic text-primary">next one.</em>
            <span class="italic text-success text-[0.9em]"> Plan the year.</span>
          </div>
          <p class="mt-5 font-sans text-base sm:text-lg leading-relaxed max-w-xl mx-auto text-muted-foreground">
            Every festival mapped. See who is going before you book.
          </p>
        </div>
      </DesignExample>
      <ul class="mt-4 text-sm text-muted-foreground list-disc pl-5 space-y-1">
        <li>Highlight the <em>feeling</em> word (“night”, “next one”, “dancing”), not the noun the page is about.</li>
        <li>Italic in <code>text-primary</code> (red) is the default highlight; <code>text-success</code> (green) is the second voice — never both in one phrase.</li>
        <li>Homepage only: the hand-drawn underline SVG under “best”. Don’t reuse it elsewhere; it’s the signature.</li>
        <li>One CTA in the hero (<code>.wd-cta</code> gradient pill) plus an italic aside — “— see who’s going before you book”.</li>
      </ul>
    </DesignSection>

    <DesignSection id="wave" title="Wavy divider" lead="Every hero closes with the same wave: a 40px brown-900 path at 8% opacity (10% on the homepage). It turns a hard edge into a shoreline.">
      <DesignExample :code="waveCode" :padded="false">
        <div class="w-full">
          <div class="h-16 bg-background" />
          <svg class="block w-full h-10 -mb-px" viewBox="0 0 1440 60" preserveAspectRatio="none" aria-hidden="true">
            <path d="M0,40 Q360,0 720,30 T1440,20 V60 H0 Z" :fill="WD.brown900" opacity="0.08" />
          </svg>
          <div class="h-10 bg-[color-mix(in_srgb,var(--wd-brown-900)_8%,var(--wd-cream))]" />
        </div>
      </DesignExample>
      <p class="text-xs text-muted-foreground mt-2">Use <code>-mb-px</code> to avoid a hairline gap. Same path everywhere — don’t redraw it per page.</p>
    </DesignSection>

    <DesignSection id="images" title="Image rules">
      <div class="space-y-3">
        <div v-for="r in imageRules" :key="r.rule" class="rounded-2xl border border-border bg-card p-4 text-sm">
          <strong class="text-foreground">{{ r.rule }}</strong>
          <span class="text-muted-foreground">{{ " " + r.why }}</span>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="guidance" title="Do and don't">
      <div class="space-y-4">
        <DesignDoDont do-text="white title on a photo only with the scrim behind it." dont-text="text straight on a bright photo — the sky eats the title.">
          <template #do>
            <div class="relative w-48 h-24 rounded-xl overflow-hidden">
              <img :src="munich.image" alt="" class="absolute inset-0 w-full h-full object-cover">
              <div class="absolute inset-0 bg-[linear-gradient(180deg,rgba(59,31,18,0.15)_0%,rgba(59,31,18,0.05)_40%,rgba(59,31,18,0.75)_100%)]" />
              <span class="absolute bottom-2 left-3 font-display text-2xl text-white">Munich</span>
            </div>
          </template>
          <template #dont>
            <div class="relative w-48 h-24 rounded-xl overflow-hidden">
              <img :src="munich.image" alt="" class="absolute inset-0 w-full h-full object-cover object-top">
              <span class="absolute top-2 left-3 font-display text-2xl text-white">Munich</span>
            </div>
          </template>
        </DesignDoDont>
        <DesignDoDont do-text="one short italic highlight that carries the feeling." dont-text="italicise half the title, or stack several colours — the emphasis disappears.">
          <template #do>
            <span class="font-display text-2xl">Where you’re <em class="italic text-primary">dancing.</em></span>
          </template>
          <template #dont>
            <span class="font-display text-2xl"><em class="italic text-primary">Where</em> <em class="italic text-success">you’re</em> <em class="italic text-info">dancing.</em></span>
          </template>
        </DesignDoDont>
      </div>
    </DesignSection>

    <DesignSection id="accessibility" title="Accessibility">
      <DesignA11y :notes="a11y" />
    </DesignSection>
  </DesignPage>
</template>
