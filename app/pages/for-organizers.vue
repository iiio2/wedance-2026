<script setup lang="ts">
/**
 * /for-organizers — For organizers, venues, and dance schools who run their
 * OWN events and want to reach more dancers via WeDance.
 *
 * Positioned DISTINCT from /for-events:
 *   /for-events    = "we run the whole night FOR you" (done-for-you)
 *   /for-organizers = "run it yourself, reach more dancers" (self-serve reach)
 *
 * Clones for-events.vue conventions: layout:false, Playfair Display + Caveat,
 * lucide icons, Cuban-warm editorial palette.
 */
import { ArrowRight, CalendarDays, Users, Ticket, BarChart3, PartyPopper } from 'lucide-vue-next'
import { WD } from '~/lib/brand'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — For organizers',
  meta: [
    { name: 'description', content: 'Run your own events? Publish your schedule where the dancers are, sell tickets, and get real audience data back.' },
  ],
})

const props_ = [
  { icon: CalendarDays, title: 'Publish your event',       detail: 'Your night, your festival, your weekly social — on the calendar dancers already check. Build an interactive schedule dancers can plan against weeks ahead.' },
  { icon: Users,        title: 'Reach the city\'s dancers', detail: 'Get discovered by the people who actually go out dancing. Your event lands in front of a warm, high-intent audience — not a cold ad feed.' },
  { icon: Ticket,       title: 'Ticketing & door',         detail: 'Sell tickets, run guest lists, and check people in at the door. One flow from listing to entry.' },
  { icon: BarChart3,    title: 'Audience data back',       detail: 'See which styles and levels your crowd wants, where they travel from, and what filled the room — so the next event is sharper.' },
]
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />
    <main>

    <!-- HERO -->
    <section class="max-w-5xl mx-auto px-4 pt-14 pb-10">
      <div class="text-sm tracking-widest uppercase mb-3 text-secondary">For organizers, venues & schools</div>
      <h1 class="text-5xl sm:text-6xl leading-[0.95] text-foreground">
        Run it yourself.<br>
        Reach <em class="italic text-primary">more dancers.</em>
      </h1>
      <p class="mt-6 text-base sm:text-lg leading-relaxed max-w-xl text-muted-foreground font-sans">
        You already know how to throw the night. Publish it where the dancers are, sell the tickets, and get the audience data back — all in one place.
      </p>
    </section>

    <!-- VALUE PROPS -->
    <section class="max-w-5xl mx-auto px-4 pb-10">
      <div class="grid md:grid-cols-2 gap-5">
        <div
          v-for="(p, i) in props_" :key="p.title"
          class="rounded-2xl bg-white p-6 border block"
          :style="{ borderColor: [WD.red600, WD.cyan600, WD.amber500, WD.green600, WD.purple500][i % 5] + '55' }"
        >
          <component :is="p.icon" class="w-6 h-6 mb-3" :style="{ color: [WD.red600, WD.cyan600, WD.amber500, WD.green600, WD.purple500][i % 5], 'stroke-width': 1.5 }" />
          <div class="text-lg font-bold text-foreground">{{ p.title }}</div>
          <div class="mt-2 text-sm leading-relaxed text-muted-foreground font-sans">{{ p.detail }}</div>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="max-w-3xl mx-auto px-4 pt-6 pb-10 text-center">
      <PartyPopper class="w-8 h-8 mx-auto mb-4 text-primary" style="stroke-width:1.5;" />
      <h2 class="text-3xl sm:text-4xl leading-tight">
        Put your event <em class="italic text-primary">on the map.</em>
      </h2>
      <p class="mt-4 text-sm sm:text-base text-muted-foreground font-sans">
        Tell us about your event and we'll get you listed where the dancers are looking.
      </p>
      <Button as-child variant="cta" size="lg" class="mt-8 h-auto min-h-11 whitespace-normal px-7 py-3">
        <a
          href="mailto:hello@wedance.vip?subject=Publish%20my%20event%20on%20WeDance&body=Event%2Fvenue%2Fschool%3A%0ACity%3A%0AWhat%20you%20run%3A%0AHow%20often%3A%0AWhat%20you%20need%3A%20"
          @click="useTrack().track('organizer_cta_click', { surface: 'for-organizers' })"
        >
          Publish your event <ArrowRight aria-hidden="true" />
        </a>
      </Button>
      <div class="mt-3 text-sm font-display italic text-secondary">
        — we usually respond same day
      </div>
    </section>

    <!-- CROSS-LINKS -->
    <section class="max-w-3xl mx-auto px-4 pb-16 space-y-3">
      <NuxtLink
        to="/for-events"
        class="rounded-2xl bg-white p-6 border flex items-center justify-between gap-4 transition-all hover:-translate-y-0.5 border-border"
       
      >
        <div>
          <div class="text-lg font-bold text-foreground">Want us to run the whole night instead?</div>
          <div class="mt-1 text-sm leading-relaxed text-muted-foreground font-sans">
            Venue, MC, DJ, show dancers, ticketing — done for you, end to end.
          </div>
        </div>
        <span class="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider whitespace-nowrap text-primary font-sans">
          For events <ArrowRight class="w-3.5 h-3.5" />
        </span>
      </NuxtLink>
      <NuxtLink
        to="/for-venues"
        class="rounded-2xl bg-white p-6 border flex items-center justify-between gap-4 transition-all hover:-translate-y-0.5 border-border"
       
      >
        <div>
          <div class="text-lg font-bold text-foreground">Have a venue? List it on WeDance.</div>
          <div class="mt-1 text-sm leading-relaxed text-muted-foreground font-sans">
            Get booking requests from dance organizers looking for a space.
          </div>
        </div>
        <span class="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider whitespace-nowrap text-primary font-sans">
          For venues <ArrowRight class="w-3.5 h-3.5" />
        </span>
      </NuxtLink>
    </section>

    </main>

    <SiteFooter />
  </div>
</template>
