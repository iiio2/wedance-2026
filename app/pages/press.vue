<script setup lang="ts">
/**
 * /press — Lightweight press / about page for journalists.
 * Clones for-events.vue conventions: layout:false, Playfair Display + Caveat,
 * lucide icons, Cuban-warm editorial palette.
 *
 * Content discipline (content-publishing rule): NO fabricated stats. Key facts
 * are sourced-only — where we don't have a defensible cited number, a
 * <!-- TODO: sourced stat --> placeholder stands in. Nothing invented ships.
 */
import { ArrowRight, Download, Newspaper, Mail, Users } from 'lucide-vue-next'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — Press',
  meta: [
    { name: 'description', content: 'Press and media resources for WeDance — the platform for dancers, organizers, and festivals. Run in the open.' },
  ],
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />
    <main>

    <!-- HERO -->
    <section class="max-w-5xl mx-auto px-4 pt-14 pb-10">
      <div class="text-sm tracking-widest uppercase mb-3 text-secondary">Press</div>
      <h1 class="text-5xl sm:text-6xl leading-[0.95] text-foreground">
        The story of <em class="italic text-primary">WeDance.</em>
      </h1>
      <p class="mt-6 text-base sm:text-lg leading-relaxed max-w-xl text-muted-foreground font-sans">
        WeDance is a platform for the social dance world — dancers plan their year, organizers publish and ticket their events, and festivals get an interactive schedule the community actually uses. Writing about us? Everything you need is here.
      </p>
    </section>

    <!-- BOILERPLATE / ABOUT -->
    <section class="max-w-5xl mx-auto px-4 pb-10">
      <div class="rounded-2xl bg-white p-6 border" style="border-color:color-mix(in srgb, var(--wd-red-600) 33.3%, transparent);">
        <div class="text-sm tracking-widest uppercase mb-3 text-secondary">About</div>
        <p class="text-base leading-relaxed text-muted-foreground font-sans">
          WeDance connects the people who make social dance happen. Dancers discover events, build a plan for the night and the year, and find partners. Organizers, venues, and schools publish their events where the dancers are, sell tickets, and get real audience data back. Festivals get an interactive schedule that gets the community excited weeks before the doors open. It's built by dancers, for the scene they love.
        </p>
      </div>
    </section>

    <!-- FOUNDER BIO -->
    <section class="max-w-5xl mx-auto px-4 pb-10">
      <div class="rounded-2xl bg-white p-6 border" style="border-color:color-mix(in srgb, var(--wd-cyan-600) 33.3%, transparent);">
        <div class="flex items-center gap-2 mb-3">
          <Users class="w-5 h-5 text-wd-cyan-600" style="stroke-width:1.5;" />
          <div class="text-sm tracking-widest uppercase text-secondary">Founder</div>
        </div>
        <div class="text-lg font-bold text-foreground">Alösha</div>
        <p class="mt-2 text-base leading-relaxed text-muted-foreground font-sans">
          Alösha is the founder of WeDance — a dancer, teacher, and builder based in Munich. He started WeDance to solve a problem he lived: the social dance world is warm and thriving, but scattered across group chats, flyers, and half-dead event pages. WeDance brings it into one place the community can trust.
        </p>
        <a
          href="https://razbakov.com"
          target="_blank" rel="noopener"
          class="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-wd-cyan-600 font-sans"
         
        >
          More about Alösha <ArrowRight class="w-3.5 h-3.5" />
        </a>
      </div>
    </section>

    <!-- KEY FACTS (sourced-only) -->
    <section class="max-w-5xl mx-auto px-4 pb-10">
      <h2 class="text-3xl sm:text-4xl leading-tight mb-6">
        Key <em class="italic text-primary">facts.</em>
      </h2>
      <div class="rounded-2xl bg-white p-6 border border-border">
        <dl class="grid sm:grid-cols-2 gap-x-8 gap-y-4 font-sans">
          <div>
            <dt class="text-xs uppercase tracking-wider text-secondary">Founded</dt>
            <dd class="text-sm text-muted-foreground">
              <!-- TODO: sourced fact — founding year. Fill with the verified year, do not guess. -->
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wider text-secondary">Headquarters</dt>
            <dd class="text-sm text-muted-foreground">Munich, Germany</dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wider text-secondary">Cities &amp; community</dt>
            <dd class="text-sm text-muted-foreground">
              <!-- TODO: sourced stat — cities / community size. Use a cited, defensible number or omit. Do not invent. -->
            </dd>
          </div>
          <div>
            <dt class="text-xs uppercase tracking-wider text-secondary">Website</dt>
            <dd class="text-sm">
              <a class="text-wd-cyan-600" href="https://wedance.vip">wedance.vip</a>
            </dd>
          </div>
        </dl>
        <p class="mt-4 text-xs italic text-secondary font-sans">
          Journalists: need a specific figure that isn't listed here? Email us and we'll get you a sourced number.
        </p>
        <p class="mt-2 text-sm font-sans text-muted-foreground">
          Live usage numbers:
          <NuxtLink to="/open" class="font-bold text-wd-cyan-600 hover:underline">Open metrics</NuxtLink>
        </p>
      </div>
    </section>

    <!-- BRAND ASSETS -->
    <section class="max-w-5xl mx-auto px-4 pb-10">
      <div class="rounded-2xl bg-white p-6 border flex items-center justify-between gap-4" style="border-color:color-mix(in srgb, var(--wd-amber-500) 33.3%, transparent);">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <Download class="w-5 h-5 text-wd-amber-500" style="stroke-width:1.5;" />
            <div class="text-lg font-bold text-foreground">Logos &amp; brand assets</div>
          </div>
          <div class="text-sm leading-relaxed text-muted-foreground font-sans">
            Logo files, colours, and usage guidelines for print and web.
          </div>
        </div>
        <!-- TODO: replace # with the real brand-assets download link once the kit is hosted. -->
        <Button as-child variant="outline-pill" size="pill-sm" accent="var(--wd-amber-600)" class="font-sans">
          <a href="#">
            Download <ArrowRight aria-hidden="true" />
          </a>
        </Button>
      </div>
    </section>

    <!-- COVERAGE -->
    <section class="max-w-5xl mx-auto px-4 pb-10">
      <div class="flex items-center gap-2 mb-4">
        <Newspaper class="w-5 h-5 text-wd-purple-500" style="stroke-width:1.5;" />
        <h2 class="text-3xl sm:text-4xl leading-tight">
          In the <em class="italic text-primary">press.</em>
        </h2>
      </div>
      <div class="rounded-2xl bg-white p-6 border" style="border-color:color-mix(in srgb, var(--wd-purple-500) 33.3%, transparent);">
        <!-- TODO: add coverage items as they land — { outlet, headline, date, url }. Placeholder until first piece. -->
        <p class="text-sm leading-relaxed text-muted-foreground font-sans">
          Coverage will be listed here. Writing a piece on WeDance or the social dance scene? We'd love to help — reach out below.
        </p>
      </div>
    </section>

    <!-- HOW WE OPERATE -->
    <section class="max-w-5xl mx-auto px-4 pb-10">
      <div class="rounded-2xl bg-white p-6 border" style="border-color:color-mix(in srgb, var(--wd-green-600) 33.3%, transparent);">
        <div class="text-sm tracking-widest uppercase mb-3 text-secondary">How we operate</div>
        <p class="text-base leading-relaxed text-muted-foreground font-sans">
          WeDance is run in the open, governed by Sociocracy 3.0 — decisions, roles, and how the organisation works are documented publicly rather than kept behind closed doors.
        </p>
        <a
          href="https://org.wedance.vip"
          target="_blank" rel="noopener"
          class="mt-4 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-wd-green-600 font-sans"
         
        >
          See how we're governed <ArrowRight class="w-3.5 h-3.5" />
        </a>
      </div>
    </section>

    <!-- CONTACT / CTA -->
    <section class="max-w-3xl mx-auto px-4 py-16 text-center">
      <Mail class="w-8 h-8 mx-auto mb-4 text-primary" style="stroke-width:1.5;" />
      <h2 class="text-3xl sm:text-4xl leading-tight">
        Press <em class="italic text-primary">enquiries.</em>
      </h2>
      <p class="mt-4 text-sm sm:text-base text-muted-foreground font-sans">
        Interviews, quotes, a sourced figure, or assets — we usually respond same day.
      </p>
      <Button as-child variant="cta" size="lg" class="mt-8 h-auto min-h-11 whitespace-normal px-7 py-3">
        <a
          href="mailto:hello@wedance.vip?subject=Press%20enquiry%20%E2%80%94%20WeDance&body=Outlet%3A%0AName%3A%0ADeadline%3A%0AWhat%20you%20need%3A%20"
          @click="useTrack().track('press_cta_click', { surface: 'press' })"
        >
          Contact us <ArrowRight aria-hidden="true" />
        </a>
      </Button>
      <div class="mt-3 text-sm font-hand text-secondary">
        hello@wedance.vip
      </div>
    </section>

    </main>

    <SiteFooter />
  </div>
</template>
