<script setup lang="ts">
/**
 * /for-organizers — for organizers, venues and dance schools who run their own
 * events. Leads with what sells WeDance to them: every post for the event,
 * made for them (the content plan). Then the tools in the order an organizer
 * works: when, where, artists, posts. Self-serve: the button creates the event.
 *
 * Positioned distinct from /for-events (we run the whole night for you).
 * Also the festival pitch: /organizers (the old festival-only page, with
 * pricing tiers that had no billing behind them) redirects here.
 * Only claims the product backs (content-publishing rule): no ticketing or
 * door claims until those are live. Numbers come from events.stats, live.
 * Example flyers are real ones kept by organizers on WeDance.
 */
import { ArrowRight, CalendarSearch, MapPin, UserCheck, Sparkles, Palette, Check, Mail, Wand2, CalendarDays, Users, Share2, Map, Ticket, QrCode, Wallet, Crown, Infinity, BarChart3, Star, Headphones } from 'lucide-vue-next'
import { WD } from '~/lib/brand'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — For organizers',
  meta: [
    { name: 'description', content: 'Run dance events? Get every post for your event made for you: the flyer, one post per artist, the line-up, a countdown, painted in your look with every word checked. Plus the date, the venue and your artists, sorted.' },
  ],
})

const { $trpc } = useNuxtApp()
// Loaded in the browser, like the other pages' data (the line stays hidden until it arrives).
const stats = ref<{ upcomingEvents: number; cities: number } | null>(null)
onMounted(async () => { stats.value = await $trpc.events.stats.query().catch(() => null) })

// Real flyers made and kept on WeDance (prod, 2026-10-13).
const FLYERS = [
  { url: 'https://res.cloudinary.com/djumxevsm/image/upload/c_fill,w_540,h_960/v1791919371/wedance-2026/flyers/ritmo-jg/zmq8phzhxhynkwo6oabm.jpg', event: 'La Clave Thursday', by: 'Ritmo Jg' },
  { url: 'https://res.cloudinary.com/djumxevsm/image/upload/c_fill,w_540,h_960/v1791889791/wedance-2026/flyers/montunoclub/okewfsufmlviksoiklyw.jpg', event: 'Misterio en Blanco', by: 'Montuno Club' },
  { url: 'https://res.cloudinary.com/djumxevsm/image/upload/c_fill,w_540,h_960/v1791920160/wedance-2026/flyers/montunoclub/c13gdodju73tshkgxyj6.jpg', event: 'Salsa Cubana Party', by: 'Montuno Club' },
]

const POSTS = ['The flyer', 'One post per artist', 'The line-up', 'Programme', 'Passes', 'Countdown', 'Last tickets', 'Thank you']

const STEPS = [
  { icon: CalendarSearch, title: 'Pick the night', detail: 'See what else is on in your city that day, and the festivals around, filtered by your music. Choose the date knowing who you’re up against.' },
  { icon: MapPin, title: 'Find the venue', detail: 'Venues that host nights like yours, and whether they already have one that day. Ask a few through WeDance: they answer with their terms, you book one.' },
  { icon: UserCheck, title: 'Confirm your artists', detail: 'Send each artist one link. They check their name, photos and programme, approve the posts about them, and their page on WeDance becomes theirs.' },
  { icon: Sparkles, title: 'Promote it', detail: 'Draft your content plan in one click. Each post is painted when you ask for it, every word read back and checked, with the caption written.' },
]
const tones = [WD.red600, WD.cyan600, WD.amber500, WD.green600]

// A festival's own page: what dancers do on it (all live on festival pages).
const FESTIVAL = [
  { icon: CalendarDays, title: 'A programme they plan', detail: 'Workshops by day, filtered by style and level. Dancers pick theirs, and you see how many are going to each one.' },
  { icon: Users, title: 'Who’s going, and partners', detail: 'Dancers see who else is coming and ask each other for a dance before the doors open.' },
  { icon: Share2, title: 'Plans they share', detail: 'A dancer’s plan goes to friends with your festival front and centre.' },
  { icon: Map, title: 'On their festival year', detail: 'Dancers plan their year of festivals on WeDance. Yours is on that calendar.' },
]
const EXAMPLE = '/events/meneate-viena-2026'

// Ticketing on WeDance (RAZ-370): early access. Organizers apply; nothing here
// is claimed as live until Stripe Connect and live payments are on.
const TICKETING = [
  { icon: Ticket, title: 'Sold where dancers plan', detail: 'Dancers pick their workshops and see the pass that covers them, then buy it on your page.' },
  { icon: Wallet, title: 'The money goes to you', detail: 'Payments go straight to your own account, not through someone else’s.' },
  { icon: QrCode, title: 'Tickets and the door', detail: 'Every buyer gets a ticket with a QR code; you check them in at the door and see your orders in Business.' },
]
const ticketingMail = 'mailto:hello@wedance.vip?subject=' + encodeURIComponent('Ticketing on WeDance: early access') + '&body=' + encodeURIComponent('My event:\nDate:\nWhere I sell tickets now:\n')
const applyTicketing = () => useTrack().track('organizer_cta_click', { surface: 'for-organizers', kind: 'ticketing' })
const start = () => useTrack().track('organizer_cta_click', { surface: 'for-organizers' })
const startFestival = () => useTrack().track('organizer_cta_click', { surface: 'for-organizers', kind: 'festival' })

// Network plan (RAZ-106): €199/year for organizers running multiple events.
const NETWORK_BENEFITS = [
  { icon: Infinity, text: 'Unlimited events per year' },
  { icon: Sparkles, text: 'AI-painted flyers and content plan for every event' },
  { icon: BarChart3, text: 'Cross-event audience insights' },
  { icon: Star, text: 'Featured in the Year Planner' },
  { icon: Headphones, text: 'Dedicated account manager' },
]
const networkMail = 'mailto:hello@wedance.vip?subject=' + encodeURIComponent('WeDance Network plan') + '&body=' + encodeURIComponent('Organization:\nEvents per year:\nWhat you run:\n')
const networkCta = () => useTrack().track('organizer_cta_click', { surface: 'for-organizers', kind: 'network' })
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />
    <main>

    <!-- HERO: the content plan -->
    <section class="max-w-5xl mx-auto px-4 pt-14 pb-10 grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-center">
      <div>
        <div class="text-sm tracking-widest uppercase mb-3 text-secondary">For organizers, venues & schools</div>
        <h1 class="text-5xl sm:text-6xl leading-[0.95] text-foreground">
          Every post for your event,<br>
          <em class="italic text-primary">made for you.</em>
        </h1>
        <p class="mt-6 text-base sm:text-lg leading-relaxed max-w-xl text-muted-foreground font-sans">
          Put your event on WeDance and get the whole campaign: the flyer, a post for every artist, the line-up poster and a countdown. Painted in your look, every name and date checked, with the captions written.
        </p>
        <div class="mt-8 flex flex-wrap items-center gap-3">
          <Button as-child variant="cta" size="lg" class="h-auto min-h-11 whitespace-normal px-7 py-3">
            <NuxtLink to="/business/events/new" @click="start">Create your event <ArrowRight aria-hidden="true" /></NuxtLink>
          </Button>
          <a href="#how" class="text-sm font-bold text-secondary hover:underline font-sans">How it works</a>
        </div>
        <p v-if="stats?.upcomingEvents" class="mt-4 text-sm text-muted-foreground font-sans">
          {{ stats.upcomingEvents.toLocaleString('en-GB') }} upcoming events in {{ stats.cities }} cities on WeDance.
        </p>
      </div>
      <!-- Real flyers -->
      <figure>
        <div class="grid grid-cols-3 gap-2 sm:gap-3">
          <img v-for="(f, i) in FLYERS" :key="f.url" :src="f.url" :alt="`Flyer for ${f.event}`" class="aspect-[9/16] w-full rounded-xl border object-cover shadow-wd-card" :class="i === 1 ? 'md:-translate-y-4' : ''" loading="lazy">
        </div>
        <figcaption class="mt-3 text-center text-xs text-muted-foreground font-sans">
          Made on WeDance: {{ FLYERS.map(f => `${f.event} (${f.by})`).join(' · ') }}
        </figcaption>
      </figure>
    </section>

    <!-- What the plan holds -->
    <section class="max-w-5xl mx-auto px-4 pb-12">
      <div class="rounded-2xl border-2 bg-white p-6 sm:p-8" :style="{ borderColor: WD.red600 + '33' }">
        <div class="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary font-sans"><Wand2 class="w-4 h-4" aria-hidden="true" /> Your content plan</div>
        <h2 class="mt-2 text-3xl leading-tight">One click drafts the posts, with dates.</h2>
        <p class="mt-2 max-w-2xl text-sm sm:text-base text-muted-foreground font-sans">From the launch to the thank-you, built from your line-up, passes and programme. You paint each post when you want it, change anything, and decide what goes out. Nothing is posted for you.</p>
        <ul class="mt-5 flex flex-wrap gap-2">
          <li v-for="p in POSTS" :key="p" class="rounded-full border bg-background px-3 py-1 text-sm font-sans">{{ p }}</li>
        </ul>
        <ul class="mt-6 grid gap-2 sm:grid-cols-2 text-sm font-sans">
          <li class="flex items-start gap-2"><Check class="mt-0.5 w-4 h-4 shrink-0 text-primary" aria-hidden="true" /> Stories and 4:5 feed posts, in Instagram’s exact sizes</li>
          <li class="flex items-start gap-2"><Check class="mt-0.5 w-4 h-4 shrink-0 text-primary" aria-hidden="true" /> Every word read back off the poster: names, dates, umlauts</li>
          <li class="flex items-start gap-2"><Check class="mt-0.5 w-4 h-4 shrink-0 text-primary" aria-hidden="true" /> Captions with the details laid out and the right @tags</li>
          <li class="flex items-start gap-2"><Check class="mt-0.5 w-4 h-4 shrink-0 text-primary" aria-hidden="true" /> Artists give their OK before posts about them count as ready</li>
        </ul>
      </div>
    </section>

    <!-- Your look -->
    <section class="max-w-5xl mx-auto px-4 pb-12 grid gap-6 md:grid-cols-[auto_1fr] md:items-center">
      <Palette class="w-10 h-10 text-secondary" style="stroke-width:1.5;" aria-hidden="true" />
      <div>
        <h2 class="text-2xl sm:text-3xl leading-tight">Your look, not a template.</h2>
        <p class="mt-2 max-w-2xl text-sm sm:text-base text-muted-foreground font-sans">Add 2–5 flyers you’ve posted before. WeDance reads their scene, colours and lettering, and paints every new post with them as the reference, so your feed still looks like you. No flyers yet? Start from one of our proven styles.</p>
      </div>
    </section>

    <!-- How it works: the order you work in -->
    <section id="how" class="max-w-5xl mx-auto px-4 pb-12 scroll-mt-20">
      <h2 class="text-3xl sm:text-4xl leading-tight">From the date to the last post.</h2>
      <p class="mt-2 text-sm sm:text-base text-muted-foreground font-sans">In the order you plan an event.</p>
      <div class="mt-6 grid md:grid-cols-2 gap-5">
        <div v-for="(s, i) in STEPS" :key="s.title" class="rounded-2xl bg-white p-6 border" :style="{ borderColor: tones[i] + '55' }">
          <div class="flex items-center gap-3">
            <span class="grid w-8 h-8 place-items-center rounded-full text-sm font-bold text-white font-sans" :style="{ background: tones[i] }">{{ i + 1 }}</span>
            <component :is="s.icon" class="w-6 h-6" :style="{ color: tones[i], 'stroke-width': 1.5 }" aria-hidden="true" />
          </div>
          <div class="mt-3 text-lg font-bold text-foreground">{{ s.title }}</div>
          <div class="mt-2 text-sm leading-relaxed text-muted-foreground font-sans">{{ s.detail }}</div>
        </div>
      </div>
      <p class="mt-6 text-sm text-muted-foreground font-sans">And dancers find it: your event goes on its own page and on your city’s calendar, where dancers plan their week.</p>
    </section>

    <!-- Ticketing on WeDance: early access -->
    <section id="tickets" class="max-w-5xl mx-auto px-4 pb-12 scroll-mt-20">
      <div class="rounded-2xl border-2 bg-white p-6 sm:p-8" :style="{ borderColor: WD.amber500 + '55' }">
        <div class="flex flex-wrap items-center gap-2 text-sm font-bold uppercase tracking-widest text-secondary font-sans">
          <Ticket class="w-4 h-4" aria-hidden="true" /> Ticketing
          <span class="rounded-full px-2 py-0.5 text-eyebrow tracking-wider text-white" :style="{ background: WD.amber500 }">Early access</span>
        </div>
        <h2 class="mt-2 text-3xl leading-tight">Sell your tickets on WeDance.</h2>
        <p class="mt-2 max-w-2xl text-sm sm:text-base text-muted-foreground font-sans">Your passes, on the page dancers already plan from. We’re switching it on with a few organizers first.</p>
        <ul class="mt-6 grid gap-4 sm:grid-cols-3">
          <li v-for="t in TICKETING" :key="t.title" class="flex items-start gap-3">
            <component :is="t.icon" class="mt-0.5 w-5 h-5 shrink-0 text-primary" style="stroke-width:1.5;" aria-hidden="true" />
            <div>
              <p class="font-bold text-foreground">{{ t.title }}</p>
              <p class="mt-0.5 text-sm text-muted-foreground font-sans">{{ t.detail }}</p>
            </div>
          </li>
        </ul>
        <div class="mt-6 flex flex-wrap items-center gap-4 font-sans">
          <Button as-child variant="cta" class="h-auto min-h-11 whitespace-normal px-6 py-2.5">
            <a :href="ticketingMail" @click="applyTicketing">Get early access <ArrowRight aria-hidden="true" /></a>
          </Button>
          <p class="text-xs text-muted-foreground">Until it’s on for your event, “Get tickets” on your page links to where you sell now.</p>
        </div>
      </div>
    </section>

    <!-- Festivals: the page itself does the selling -->
    <section id="festivals" class="max-w-5xl mx-auto px-4 pb-12 scroll-mt-20">
      <div class="rounded-2xl border bg-white p-6 sm:p-8">
        <div class="text-sm font-bold uppercase tracking-widest text-secondary font-sans">Running a festival?</div>
        <h2 class="mt-2 text-3xl leading-tight">Your festival gets a page dancers plan on.</h2>
        <p class="mt-2 max-w-2xl text-sm sm:text-base text-muted-foreground font-sans">Add your passes, line-up and programme by day in the same editor. Dancers start planning weeks before the doors open.</p>
        <ul class="mt-6 grid gap-4 sm:grid-cols-2">
          <li v-for="f in FESTIVAL" :key="f.title" class="flex items-start gap-3">
            <component :is="f.icon" class="mt-0.5 w-5 h-5 shrink-0 text-primary" style="stroke-width:1.5;" aria-hidden="true" />
            <div>
              <p class="font-bold text-foreground">{{ f.title }}</p>
              <p class="mt-0.5 text-sm text-muted-foreground font-sans">{{ f.detail }}</p>
            </div>
          </li>
        </ul>
        <div class="mt-6 flex flex-wrap items-center gap-4 font-sans">
          <Button as-child variant="cta" class="h-auto min-h-11 whitespace-normal px-6 py-2.5">
            <NuxtLink to="/business/events/new?type=Festival" @click="startFestival">List your festival <ArrowRight aria-hidden="true" /></NuxtLink>
          </Button>
          <NuxtLink :to="EXAMPLE" class="text-sm font-bold text-secondary hover:underline">See one: ¡Menéate Viena! →</NuxtLink>
        </div>
      </div>
    </section>

    <!-- Network plan: annual subscription for multi-event organizers (RAZ-106) -->
    <section id="network" class="max-w-5xl mx-auto px-4 pb-12 scroll-mt-20">
      <div class="rounded-2xl border-2 bg-white p-6 sm:p-8" :style="{ borderColor: WD.green600 + '55' }">
        <div class="flex flex-wrap items-center gap-2 text-sm font-bold uppercase tracking-widest font-sans" :style="{ color: WD.green600 }">
          <Crown class="w-4 h-4" aria-hidden="true" /> Network
          <span class="rounded-full px-2 py-0.5 text-eyebrow tracking-wider text-white" :style="{ background: WD.green600 }">€199 / year</span>
        </div>
        <h2 class="mt-2 text-3xl leading-tight">One price for all your events.</h2>
        <p class="mt-2 max-w-2xl text-sm sm:text-base text-muted-foreground font-sans">
          Running more than one night? The Network plan covers every event you put on WeDance for a year, instead of paying per event.
        </p>
        <ul class="mt-6 space-y-3">
          <li v-for="b in NETWORK_BENEFITS" :key="b.text" class="flex items-start gap-3">
            <component :is="b.icon" class="mt-0.5 w-5 h-5 shrink-0" :style="{ color: WD.green600, strokeWidth: 1.5 }" aria-hidden="true" />
            <span class="text-sm font-sans text-foreground">{{ b.text }}</span>
          </li>
        </ul>
        <div class="mt-6 flex flex-wrap items-center gap-4 font-sans">
          <Button as-child variant="cta" class="h-auto min-h-11 whitespace-normal px-6 py-2.5">
            <a :href="networkMail" @click="networkCta">Talk to us <ArrowRight aria-hidden="true" /></a>
          </Button>
          <p class="text-xs text-muted-foreground">Or start with one event free and upgrade later.</p>
        </div>
      </div>
    </section>

    <!-- CTA -->
    <section class="max-w-3xl mx-auto px-4 pt-4 pb-10 text-center">
      <h2 class="text-3xl sm:text-4xl leading-tight">
        Put your next event <em class="italic text-primary">on WeDance.</em>
      </h2>
      <p class="mt-4 text-sm sm:text-base text-muted-foreground font-sans">
        Add the event, your artists and your venue. Your first flyer takes about a minute.
      </p>
      <Button as-child variant="cta" size="lg" class="mt-8 h-auto min-h-11 whitespace-normal px-7 py-3">
        <NuxtLink to="/business/events/new" @click="start">Create your event <ArrowRight aria-hidden="true" /></NuxtLink>
      </Button>
      <p class="mt-4 text-sm text-muted-foreground font-sans">
        Rather talk first? <a href="mailto:hello@wedance.vip?subject=My%20event%20on%20WeDance" class="inline-flex items-center gap-1 font-bold text-secondary hover:underline"><Mail class="w-3.5 h-3.5" aria-hidden="true" /> hello@wedance.vip</a>
      </p>
    </section>

    <!-- CROSS-LINKS -->
    <section class="max-w-3xl mx-auto px-4 pb-16 space-y-3">
      <NuxtLink to="/for-events" class="rounded-2xl bg-white p-6 border flex items-center justify-between gap-4 transition-all hover:-translate-y-0.5 border-border">
        <div>
          <div class="text-lg font-bold text-foreground">Want us to run the whole night instead?</div>
          <div class="mt-1 text-sm leading-relaxed text-muted-foreground font-sans">Venue, MC, DJ, show dancers, ticketing: done for you, end to end.</div>
        </div>
        <span class="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider whitespace-nowrap text-primary font-sans">For events <ArrowRight class="w-3.5 h-3.5" /></span>
      </NuxtLink>
      <NuxtLink to="/for-venues" class="rounded-2xl bg-white p-6 border flex items-center justify-between gap-4 transition-all hover:-translate-y-0.5 border-border">
        <div>
          <div class="text-lg font-bold text-foreground">Have a venue? List it on WeDance.</div>
          <div class="mt-1 text-sm leading-relaxed text-muted-foreground font-sans">Organizers looking for a space ask you through WeDance, with their date and what they need.</div>
        </div>
        <span class="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider whitespace-nowrap text-primary font-sans">For venues <ArrowRight class="w-3.5 h-3.5" /></span>
      </NuxtLink>
    </section>

    </main>

    <SiteFooter />
  </div>
</template>
