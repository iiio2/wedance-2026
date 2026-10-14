<script setup lang="ts">
import { Button } from '~/components/ui/button'
import { WD } from '~/lib/brand'
import { readableOn } from '~/lib/contrast'
/**
 * /organizers — For festival organizers.
 * Restyled 2026-07-02 to match the V3 tropical direction on /.
 * Same warm cream + rose + palm-green palette, Playfair Display + Caveat.
 * Removed fake stats bar and pravatar testimonials — they contradicted
 * the "no fake friends" promise the homepage is built on. Real quotes
 * can go back in once we have them.
 */
import {
  ArrowRight,
  CalendarDays,
  Users,
  Heart,
  Ticket,
  Share2,
  TrendingUp,
  BarChart3,
  Eye,
  Globe,
  MessageCircle,
  CheckCircle,
  Zap,
  CalendarPlus,
  Map,
  UserPlus,
  Send,
} from 'lucide-vue-next'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — For festival organizers',
  meta: [
    { name: 'description', content: 'Ticket your festival where the dancers are. Planning tools, partner matching, real faces on every event page.' },
  ],
})

const alreadyPlanning = [
  { icon: CalendarPlus, title: 'Building their week', detail: 'Dancers browse classes and socials in their city and add them to a personal week plan.', color: WD.red600 },
  { icon: Map,          title: 'Planning their festival year', detail: 'They map out which festivals to attend months ahead — your event shows up on that calendar.', color: WD.cyan600 },
  { icon: UserPlus,     title: 'Finding partners', detail: 'Leads and follows match before the festival starts, so they arrive already connected.', color: WD.purple500 },
  { icon: Send,         title: 'Sharing plans with friends', detail: 'Every shared plan is a personal invitation — your event gets passed along with it.', color: WD.green600 },
]

const features = [
  { icon: CalendarDays, title: 'Interactive schedule', description: 'Dancers browse workshops, filter by style and level, and build a plan — excitement builds weeks before the doors open.', color: WD.red600, link: '/events/meneate-viena-2026#schedule' },
  { icon: Users,        title: 'Partner matching',    description: 'Leads and follows find each other before the festival. More matched partners = more workshop sign-ups.',              color: WD.cyan600, link: '/events/meneate-viena-2026#discover' },
  { icon: Heart,        title: 'Discover dancers',    description: 'Swipe to find dance partners. Mutual matches become a dance list — your attendees arrive already connected.',        color: WD.purple500, link: '/events/meneate-viena-2026#discover' },
  { icon: Ticket,       title: 'Smart ticket picks',  description: 'As dancers add workshops to their plan, we suggest the best-value ticket. Your pass tiers, their perfect fit.',       color: WD.amber500, link: '/events/meneate-viena-2026#tickets' },
  { icon: Zap,          title: 'One-tap checkout',    description: 'Signed-in dancers buy their pass in a single tap — no forms, no re-entering details. Fewer drop-offs, more sold tickets.', color: WD.pink500, link: '/events/meneate-viena-2026#tickets' },
  { icon: Share2,       title: 'Plan sharing',        description: 'Dancers share their festival plan with friends. Every share is a personalized invitation with your event front and centre.', color: WD.green600 },
  { icon: TrendingUp,   title: 'Year planning',       description: 'Dancers plan their whole festival year on WeDance. Your festival appears in their year plan and in discovery suggestions.',            color: WD.red600, link: '/festivals' },
]

const insights = [
  { icon: BarChart3,     title: 'Workshop demand',      description: 'See which workshops are trending before you finalize the schedule. Add capacity where demand is highest.' },
  { icon: Eye,           title: 'Style & level mix',    description: 'Understand the real skill distribution of your attendees. Balance beginner-friendly and advanced content.' },
  { icon: Globe,         title: 'Audience geography',   description: 'Know where your dancers are travelling from. Partner with local hotels and give targeted travel tips.' },
  { icon: MessageCircle, title: 'Post-festival signal', description: 'Mutual dance endorsements and ratings give you honest feedback on teacher quality and workshop satisfaction.' },
]

const pricing = [
  {
    name: 'Starter',
    plan: 'starter',
    price: 'Free',
    description: 'Get listed and let dancers find you.',
    features: [
      'Festival listing with schedule',
      'Lineup with teacher profiles',
      'Venue info & directions',
      'Basic attendee count',
      'Link to your ticket page',
    ],
    cta: 'Get started free',
    contact: false,
    highlighted: false,
    color: WD.cyan600,
  },
  {
    name: 'Pro',
    plan: 'pro',
    price: '€49',
    period: '/event',
    description: 'The full engagement toolkit.',
    features: [
      'Everything in Starter',
      'Interactive workshop planner',
      'Smart ticket recommendations',
      'Partner matching for attendees',
      'Plan sharing & referral tracking',
      'Workshop demand analytics',
      'Audience insights dashboard',
      'Priority support',
    ],
    cta: 'Start free trial',
    contact: false,
    highlighted: true,
    color: WD.red600,
  },
  {
    name: 'Network',
    plan: 'network',
    price: '€199',
    period: '/year',
    description: 'For organizers running multiple events.',
    features: [
      'Everything in Pro',
      'Unlimited events per year',
      'Cross-event audience insights',
      'Featured in Year Planner',
      'Early access to new features',
      'Dedicated account manager',
    ],
    cta: 'Talk to us',
    contact: true,
    highlighted: false,
    color: WD.green600,
  },
]

const salesMailto = 'mailto:hello@wedance.vip?subject=' + encodeURIComponent('WeDance for organizers — Network plan')
  + '&body=' + encodeURIComponent('Organization:\nEvents per year:\nWhat you need:\n')

const howItWorks = [
  { step: '1', title: 'List your event',       description: 'Add your festival, schedule, teachers, and venue in minutes.',                    color: WD.red600 },
  { step: '2', title: 'Dancers plan',          description: 'Dancers find your event, build workshop plans, and match with partners.',        color: WD.amber500, substeps: [
    { icon: Globe,        label: 'Discover your festival in the directory', link: '/festivals' },
    { icon: CalendarDays, label: 'Build a workshop plan from the schedule', link: '/events/meneate-viena-2026#schedule' },
    { icon: Users,        label: 'Match with dance partners before arriving', link: '/events/meneate-viena-2026#discover' },
  ] },
  { step: '3', title: 'Plans drive tickets',   description: 'Smart recommendations guide dancers to the right pass. Sharing spreads the word.', color: WD.green600 },
  { step: '4', title: 'You get insights',      description: 'Real demand data, audience geography, and post-event signal.',                   color: WD.cyan600 },
]


const editorLink = (plan?: string) => ({ path: '/organizers/create', query: plan ? { plan } : {} })
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <!-- Header — same as homepage -->
    <SiteHeader />

    <main>

    <!-- HERO -->
    <section class="relative">
      <div class="max-w-6xl mx-auto px-4 pt-14 pb-16 text-center md:text-left">
        <div class="text-sm tracking-widest uppercase mb-3 text-secondary">
          For festival organizers
        </div>
        <div class="grid md:grid-cols-12 gap-10 items-center">
          <div class="md:col-span-8">
            <h1 class="text-5xl sm:text-6xl leading-[0.98] text-foreground">
              Your dancers are<br>
              already <em class="italic text-primary">planning.</em><br>
              <span class="font-hand text-success" style="font-size:0.9em;">Give them the tools.</span>
            </h1>
            <p class="mt-6 text-base sm:text-lg leading-relaxed max-w-xl mx-auto md:mx-0 text-muted-foreground">
              Ticket your festival where the dancers are.
              <span class="text-foreground">Workshop planner, partner matching, real faces on every event page.</span>
            </p>
            <div class="mt-8 flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
              <Button as-child variant="cta" size="lg" class="px-6">
                <NuxtLink :to="editorLink('starter')">List your festival <ArrowRight aria-hidden="true" /></NuxtLink>
              </Button>
              <NuxtLink
                to="/events/meneate-viena-2026"
                class="inline-flex items-center gap-2 text-sm hover:underline text-wd-cyan-700 font-hand"
                style="font-style:italic; font-size:20px;"
              >
                — see a live example
              </NuxtLink>
            </div>
          </div>

          <!-- Poster card — hint of the platform -->
          <div class="md:col-span-4 relative">
            <div class="absolute -top-4 -left-3 w-16 h-4 rotate-[-6deg] bg-wd-amber-100" style="box-shadow:0 2px 6px rgba(0,0,0,0.15);"/>
            <div class="absolute -top-4 -right-3 w-16 h-4 rotate-[5deg] bg-wd-amber-100" style="box-shadow:0 2px 6px rgba(0,0,0,0.15);"/>
            <div class="rounded-2xl overflow-hidden shadow-2xl border-4 bg-white border-wd-cream"
                 style="box-shadow: 8px 10px 0 -2px var(--wd-cyan-600);">
              <div class="p-5" style="background:linear-gradient(135deg,var(--wd-violet-600) 0%, #c026d3 50%, var(--wd-rose-500) 100%);">
                <div class="text-eyebrow uppercase tracking-[0.3em] text-white/90 font-bold">Live festival page</div>
                <div class="mt-1 text-2xl leading-tight text-white font-display">
                  Your festival<br>on WeDance
                </div>
              </div>
              <div class="p-4">
                <div class="text-eyebrow uppercase tracking-[0.25em] font-bold mb-3 text-secondary">
                  What dancers see
                </div>
                <ul class="space-y-1.5 text-xs text-muted-foreground font-sans">
                  <li class="flex items-center gap-2"><CheckCircle class="w-3.5 h-3.5 text-success"/> Real attendee faces</li>
                  <li class="flex items-center gap-2"><CheckCircle class="w-3.5 h-3.5 text-success"/> Workshop planner</li>
                  <li class="flex items-center gap-2"><CheckCircle class="w-3.5 h-3.5 text-success"/> Partner matching</li>
                  <li class="flex items-center gap-2"><CheckCircle class="w-3.5 h-3.5 text-success"/> One-tap checkout</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Wave divider -->
      <WaveDivider class="h-12" />
    </section>

    <!-- ALREADY PLANNING — evidence section -->
    <section class="max-w-5xl mx-auto px-4 py-16">
      <div class="text-center mb-12">
        <div class="text-xs uppercase tracking-[0.3em]" style="color:var(--wd-amber-600);">Right now on WeDance</div>
        <h2 class="mt-3 text-3xl sm:text-4xl leading-tight">
          Dancers are already <em class="italic" style="color:var(--wd-red-600);">here.</em>
        </h2>
        <p class="mt-3 text-sm sm:text-base max-w-xl mx-auto" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
          They're not waiting for your Instagram ad. They're actively planning their dance life on WeDance — your event meets them where they're looking.
        </p>
      </div>

      <div class="grid md:grid-cols-2 gap-5">
        <div
          v-for="item in alreadyPlanning" :key="item.title"
          class="rounded-2xl bg-white p-6 border flex gap-4 items-start"
          :style="{ borderColor: item.color + '55', boxShadow: '0 1px 0 ' + item.color + '22, 0 8px 20px rgba(59,31,18,0.05)' }"
        >
          <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
               :style="{ background: item.color + '15' }">
            <component :is="item.icon" class="w-5 h-5" :style="{ color: item.color, 'stroke-width': 1.5 }" />
          </div>
          <div>
            <div class="text-lg font-bold leading-tight" style="color:var(--wd-brown-900);">{{ item.title }}</div>
            <div class="mt-2 text-sm leading-relaxed" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">{{ item.detail }}</div>
          </div>
        </div>
      </div>

      <p class="mt-8 text-center text-sm italic" style="font-family:var(--wd-font-display); color:var(--wd-amber-600);">
        — list your festival and show up where they're already looking
      </p>
    </section>

    <!-- HOW IT WORKS -->
    <section class="max-w-5xl mx-auto px-4 py-16">
      <div class="text-center mb-12">
        <div class="text-xs uppercase tracking-[0.3em] text-secondary">Four steps</div>
        <h2 class="mt-3 text-3xl sm:text-4xl leading-tight">
          From listing to <em class="italic text-primary">insights.</em>
        </h2>
      </div>

      <div class="grid md:grid-cols-4 gap-5">
        <div v-for="item in howItWorks" :key="item.step"
          class="relative rounded-2xl bg-white p-5 border"
          :style="{ borderColor: item.color + '55', boxShadow: '0 1px 0 ' + item.color + '22, 0 8px 20px rgba(59,31,18,0.05)' }">
          <div class="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold shadow-md mb-3"
               :style="{ background: item.color }">
            {{ item.step }}
          </div>
          <div class="text-base font-bold leading-tight text-foreground">{{ item.title }}</div>
          <div class="mt-2 text-sm leading-relaxed text-muted-foreground font-sans">{{ item.description }}</div>
          <div v-if="item.substeps" class="mt-4 space-y-2">
            <NuxtLink
              v-for="sub in item.substeps" :key="sub.label"
              :to="sub.link"
              class="flex items-center gap-2 text-xs group font-sans"
              :style="{ color: item.color }"
            >
              <component :is="sub.icon" class="w-3.5 h-3.5 shrink-0" />
              <span class="group-hover:underline">{{ sub.label }}</span>
            </NuxtLink>
          </div>
        </div>
      </div>
    </section>

    <!-- FEATURES -->
    <section class="border-y border-border bg-background/50">
      <div class="max-w-5xl mx-auto px-4 py-16">
        <div class="text-center mb-12">
          <div class="text-xs uppercase tracking-[0.3em] text-secondary">Your toolkit</div>
          <h2 class="mt-3 text-3xl sm:text-4xl leading-tight">
            Reach and <em class="italic text-primary">engage</em> those dancers.
          </h2>
          <p class="mt-3 text-sm sm:text-base max-w-xl mx-auto text-muted-foreground font-sans">
            Tools that put your event in front of dancers who are already planning — and turn that intent into ticket sales.
          </p>
        </div>

        <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          <component
            :is="feature.link ? 'NuxtLink' : 'div'"
            v-for="feature in features"
            :key="feature.title"
            :to="feature.link || undefined"
            class="rounded-2xl bg-white p-6 border transition-all hover:-translate-y-1"
            :style="{ borderColor: feature.color + '55', boxShadow: '0 1px 0 ' + feature.color + '22, 0 8px 20px rgba(59,31,18,0.05)' }">
            <component :is="feature.icon" class="w-7 h-7 mb-3" :style="{ color: feature.color, 'stroke-width': 1.5 }" />
            <div class="text-lg font-bold leading-tight text-foreground">{{ feature.title }}</div>
            <div class="mt-2 text-sm leading-relaxed text-muted-foreground font-sans">{{ feature.description }}</div>
            <div v-if="feature.link" class="mt-3 text-xs font-bold italic" :style="{ color: feature.color, fontFamily: 'var(--wd-font-hand)', fontSize: '16px' }">
              See it live →
            </div>
          </component>
        </div>
      </div>
    </section>

    <!-- INSIGHTS -->
    <section class="max-w-5xl mx-auto px-4 py-16">
      <div class="text-center mb-12">
        <div class="text-xs uppercase tracking-[0.3em] text-secondary">The dashboard</div>
        <h2 class="mt-3 text-3xl sm:text-4xl leading-tight">
          Insights that shape <em class="italic text-primary">your next event.</em>
        </h2>
        <p class="mt-3 text-sm sm:text-base max-w-xl mx-auto text-muted-foreground font-sans">
          Real data from real planning behaviour.
        </p>
      </div>

      <div class="grid md:grid-cols-2 gap-5">
        <div v-for="insight in insights" :key="insight.title"
          class="rounded-2xl bg-white p-6 border flex gap-4 items-start border-border">
          <div class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 bg-warning/[9.4%]">
            <component :is="insight.icon" class="w-5 h-5 text-warning" style="stroke-width:1.5;" />
          </div>
          <div>
            <div class="text-lg font-bold leading-tight text-foreground">{{ insight.title }}</div>
            <div class="mt-2 text-sm leading-relaxed text-muted-foreground font-sans">{{ insight.description }}</div>
          </div>
        </div>
      </div>

      <p class="mt-6 text-center text-sm font-sans text-muted-foreground">
        Already on WeDance?
        <NuxtLink to="/organizers/insights" class="font-bold underline text-primary">Open your insights →</NuxtLink>
      </p>
    </section>

    <!-- PRICING -->
    <section id="pricing" class="border-y border-border bg-background/50">
      <div class="max-w-5xl mx-auto px-4 py-16">
        <div class="text-center mb-12">
          <div class="text-xs uppercase tracking-[0.3em] text-secondary">Pricing</div>
          <h2 class="mt-3 text-3xl sm:text-4xl leading-tight">
            Start free.
            <span class="font-hand text-primary" style="font-size:0.95em;">Upgrade when it works.</span>
          </h2>
        </div>

        <div class="grid md:grid-cols-3 gap-6">
          <div v-for="plan in pricing" :key="plan.name"
            class="relative rounded-2xl bg-white p-6 border transition-all"
            :class="plan.highlighted ? 'md:-translate-y-2' : ''"
            :style="{ borderColor: plan.color + (plan.highlighted ? '' : '55'), borderWidth: plan.highlighted ? '2px' : '1px', boxShadow: plan.highlighted ? '8px 10px 0 -2px ' + plan.color + ', 0 12px 28px rgba(59,31,18,0.10)' : '0 1px 0 ' + plan.color + '22, 0 8px 20px rgba(59,31,18,0.05)' }">
            <div v-if="plan.highlighted"
              class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 text-white text-eyebrow font-bold uppercase tracking-widest rounded-full"
              :style="{ background: plan.color }">
              Most popular
            </div>
            <div class="text-lg font-bold text-foreground">{{ plan.name }}</div>
            <div class="mt-2 mb-1 flex items-baseline gap-1">
              <span class="text-4xl font-bold" :style="{ color: plan.color }">{{ plan.price }}</span>
              <span v-if="plan.period" class="text-sm text-secondary">{{ plan.period }}</span>
            </div>
            <p class="text-sm mb-5 text-muted-foreground font-sans">{{ plan.description }}</p>

            <ul class="space-y-2 mb-6">
              <li v-for="f in plan.features" :key="f" class="flex items-start gap-2 text-sm text-muted-foreground font-sans">
                <CheckCircle class="w-4 h-4 shrink-0 mt-0.5" :style="{ color: plan.color }" />
                <span>{{ f }}</span>
              </li>
            </ul>

            <Button as-child :variant="plan.highlighted ? 'cta' : 'outline-pill'" size="lg" class="w-full" :accent="readableOn(plan.color)">
              <a v-if="plan.contact" :href="salesMailto">{{ plan.cta }}</a>
              <NuxtLink v-else :to="editorLink(plan.plan)">{{ plan.cta }}</NuxtLink>
            </Button>
          </div>
        </div>
      </div>
    </section>

    <!-- FINAL CTA -->
    <section class="max-w-3xl mx-auto px-4 py-20 text-center">
      <h2 class="text-4xl sm:text-5xl leading-tight">
        Ready to fill
        <em class="italic text-primary">your dance floor?</em>
      </h2>
      <p class="mt-5 text-sm sm:text-base text-muted-foreground font-sans">
        List your festival in minutes. Your dancers will thank you.
      </p>
      <Button as-child variant="cta" size="lg" class="mt-8 px-7">
        <NuxtLink :to="editorLink('starter')">Get started free <ArrowRight aria-hidden="true" /></NuxtLink>
      </Button>
      <div class="mt-3 text-sm font-hand text-secondary">
        — free to list, free to browse
      </div>
    </section>

    </main>


    <SiteFooter />
  </div>
</template>
