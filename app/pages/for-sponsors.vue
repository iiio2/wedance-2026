<script setup lang="ts">
/**
 * /for-sponsors — For brands & companies who want to sponsor dance events.
 * Clones the for-events.vue conventions: layout:false standalone marketing
 * page, Playfair Display + Caveat, lucide icons, Cuban-warm editorial palette.
 * No fabricated audience numbers — content-publishing rule. Qualitative
 * phrasing or a TODO placeholder until a sourced stat exists.
 */
import { ArrowRight, Users, MapPin, Share2, Heart, Crown, Music, UtensilsCrossed, Megaphone } from 'lucide-vue-next'
import { WD } from '~/lib/brand'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — For sponsors',
  meta: [
    { name: 'description', content: 'Sponsor a moment the city actually shows up for. Reach a warm, engaged dance community across the event calendar.' },
  ],
})

const props_ = [
  { icon: Users,   title: 'An engaged niche',      detail: 'Dancers are a loyal, high-intent community — they show up week after week, and they tell each other everything.' },
  { icon: MapPin,  title: 'On-site activation',    detail: 'A booth, a bar, a branded stage, a sampling moment. Real presence in a room full of people who came to enjoy themselves.' },
  { icon: Share2,  title: 'Digital reach',         detail: 'Association across the event calendar — event pages, schedules, and the socials dancers check before every night out.' },
  { icon: Heart,   title: 'A warm association',    detail: 'Music, movement, culture. Your brand next to a genuinely good time, not an interruption to it.' },
]

const formats = [
  { icon: Crown,           label: 'Festival title sponsor', detail: 'Name on the festival, top billing across the schedule, the marquee moment of the year.' },
  { icon: MapPin,          label: 'Stage / area sponsor',   detail: 'Own a room, a stage, or a lounge — your brand is the backdrop to the floor.' },
  { icon: UtensilsCrossed, label: 'Catering / bar sponsor', detail: 'Power the mojito bar or the food. Everyone remembers who kept the night going.' },
  { icon: Share2,          label: 'Digital / social package', detail: 'Placement across event pages, interactive schedules, and pre-event socials.' },
]
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />
    <main>

    <!-- HERO -->
    <section class="max-w-5xl mx-auto px-4 pt-14 pb-10">
      <div class="text-sm tracking-widest uppercase mb-3 text-secondary">For sponsors</div>
      <h1 class="text-5xl sm:text-6xl leading-[0.95] text-foreground">
        Sponsor a moment<br>
        the city <em class="italic text-primary">actually shows up for.</em>
      </h1>
      <p class="mt-6 text-base sm:text-lg leading-relaxed max-w-xl text-muted-foreground font-sans">
        Dance nights and festivals are where a warm, loyal community gathers on purpose. Put your brand in the room — not in the way of it.
      </p>
      <!-- TODO: sourced stat — reach / attendance figures once we have defensible, cited numbers. Do not invent. -->
    </section>

    <!-- VALUE PROPS -->
    <section class="max-w-5xl mx-auto px-4 pb-10">
      <div class="grid md:grid-cols-2 gap-5">
        <div
          v-for="(p, i) in props_" :key="p.title"
          class="rounded-2xl bg-white p-6 border block"
          :style="{ borderColor: [WD.red600, WD.amber500, WD.cyan600, WD.green600, WD.purple500][i % 5] + '55' }"
        >
          <component :is="p.icon" class="w-6 h-6 mb-3" :style="{ color: [WD.red600, WD.amber500, WD.cyan600, WD.green600, WD.purple500][i % 5], 'stroke-width': 1.5 }" />
          <div class="text-lg font-bold text-foreground">{{ p.title }}</div>
          <div class="mt-2 text-sm leading-relaxed text-muted-foreground font-sans">{{ p.detail }}</div>
        </div>
      </div>
    </section>

    <!-- FORMATS -->
    <section class="max-w-5xl mx-auto px-4 pb-10">
      <h2 class="text-3xl sm:text-4xl leading-tight mb-6">
        Ways to <em class="italic text-primary">show up.</em>
      </h2>
      <div class="grid md:grid-cols-2 gap-5">
        <div
          v-for="(f, i) in formats" :key="f.label"
          class="rounded-2xl bg-white p-6 border block"
          :style="{ borderColor: [WD.amber500, WD.red600, WD.cyan600, WD.purple500, WD.green600][i % 5] + '55' }"
        >
          <component :is="f.icon" class="w-6 h-6 mb-3" :style="{ color: [WD.amber500, WD.red600, WD.cyan600, WD.purple500, WD.green600][i % 5], 'stroke-width': 1.5 }" />
          <div class="text-lg font-bold text-foreground">{{ f.label }}</div>
          <div class="mt-2 text-sm leading-relaxed text-muted-foreground font-sans">{{ f.detail }}</div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="max-w-3xl mx-auto px-4 py-16 text-center">
      <Megaphone class="w-8 h-8 mx-auto mb-4 text-primary" style="stroke-width:1.5;" />
      <h2 class="text-3xl sm:text-4xl leading-tight">
        Let's find <em class="italic text-primary">your moment.</em>
      </h2>
      <p class="mt-4 text-sm sm:text-base text-muted-foreground font-sans">
        Tell us what you sell and who you want to reach. We come back with the events that fit and what a package looks like.
      </p>
      <Button as-child variant="cta" size="lg" class="mt-8 h-auto min-h-11 whitespace-normal px-7 py-3">
        <a
          href="mailto:hello@wedance.vip?subject=Sponsoring%20with%20WeDance&body=Brand%3A%0AWhat%20you%20sell%3A%0AWho%20you%20want%20to%20reach%3A%0ABudget%20range%3A%0AAnything%20else%3A%20"
          @click="useTrack().track('sponsor_cta_click', { surface: 'for-sponsors' })"
        >
          Talk to us about sponsoring <ArrowRight aria-hidden="true" />
        </a>
      </Button>
      <div class="mt-3 text-sm font-hand text-secondary">
        — we usually respond same day
      </div>
    </section>

    </main>

    <SiteFooter />
  </div>
</template>
