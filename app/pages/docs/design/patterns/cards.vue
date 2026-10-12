<script setup lang="ts">
import { Calendar, MapPin, Users, ChevronRight, Ticket } from 'lucide-vue-next'
import { WD } from '~/lib/brand'
import { mockFestival, mockTeachers } from '~/data/mock-meneate'
import { daysUntil } from '#shared/utils/festivalDateFormatter'

definePageMeta({ layout: 'docs' })

// Accent = content colour (the festival's own, or the event's first style).
// Everything around it is derived with the same alpha steps the product uses.
const accent = mockFestival.accentColor || WD.amber600

const festival = {
  name: mockFestival.name,
  logo: mockFestival.logo,
  startDate: mockFestival.startDate,
  dates: 'Nov 26–29, 2026',
  location: 'Vienna, Austria',
  styles: ['Timba', 'Salsa', 'Son', 'Rumba', 'Afro', 'Reggaeton'],
  planning: mockFestival.attendeeCount,
}

// Real component: EventSchedule. Dates relative to today so "Tonight" shows.
const today = new Date()
const iso = (d: Date) => d.toISOString().slice(0, 10)
const tomorrow = new Date(today.getTime() + 86400000)
const events = [
  { id: 'doc-ev-1', title: 'Timba Thursday', eventType: 'Social', styles: ['Timba'], eventDate: iso(today), startTime: '21:00', endTime: '01:00', location: 'Luma, Neuhauser Str. 47' },
  { id: 'doc-ev-2', title: 'Casino beginners', eventType: 'Class', styles: ['Casino', 'Rueda'], eventDate: iso(tomorrow), startTime: '19:00', endTime: '20:00', location: 'Altstadt', artists: ['Ivan', 'Ivana'] },
]

const artists = mockTeachers.filter(t => ['silvio', 'lisandra', 'ivana'].includes(t.id))

const styleColor: Record<string, string> = {
  salsa: WD.red600, bachata: WD.purple500, kizomba: WD.pink500, timba: WD.amber500,
  casino: WD.green600, rueda: WD.cyan600, afro: WD.violet600, son: WD.green600,
}

const anatomy = [
  { n: 1, part: 'Surface', spec: 'bg-white (bg-card), rounded-2xl (rounded-xl for list rows), 1px border in accent at 33% (accent + "55").' },
  { n: 2, part: 'Shadow', spec: 'Card shadow tinted by accent: 0 1px 0 accent·13%, 0 8px 22px warm 5%. Plan cards use the sticker shadow 3px 4px 0 -1px accent·18%.' },
  { n: 3, part: 'Accent', spec: 'A 6px top bar, a logo ring or the time column carries the colour. One accent per card.' },
  { n: 4, part: 'Eyebrow', spec: 'Countdown in Playfair italic, in accent ("In 3 months"). Or a 10px caps label for categories.' },
  { n: 5, part: 'Title', spec: 'font-display bold, text-lg, brown-900. One line on desktop, wraps on mobile — never truncate a name.' },
  { n: 6, part: 'Meta row', spec: 'font-sans text-xs, brown-700, Lucide icons w-3 h-3 in amber-600. Date · place · count.' },
  { n: 7, part: 'Chips', spec: 'Style chips: 10px caps, rounded-full, accent text on accent·9% (accent + "18"). Max 3–4, then "+N".' },
  { n: 8, part: 'Action', spec: 'One secondary pill (Going? → Going!) on the right. The card itself is the primary action (navigate).' },
]

const variants = [
  { name: 'Event row', where: 'City “What’s on”, venue schedules — EventSchedule.vue', when: 'Recurring classes and socials in a list grouped by day. Time first, because people scan by time.' },
  { name: 'Festival', where: '/festivals listing, homepage', when: 'Multi-day events you plan months ahead. Logo + countdown + dates + styles + “planning” count.' },
  { name: 'Artist', where: '/artists, festival lineup — ArtistCard.vue', when: 'People. Face first (square photo), name, flags, styles. Never without a real photo.' },
  { name: 'Plan', where: '/my-plan, shared plans — YearPlan.vue, SharedYearPlan.vue', when: 'Things the dancer already picked. Sticker shadow + tinted header say “this is yours”.' },
]

const recipe = `<div
  class="group relative rounded-2xl overflow-hidden bg-card border transition-all hover:-translate-y-1 focus-within:ring-2 focus-within:ring-ring"
  :style="{
    borderColor: accent + '55',
    boxShadow: '0 1px 0 ' + accent + '22, 0 8px 22px rgba(59,31,18,0.05)',
  }"
>
  <div class="h-1.5" :style="{ background: accent }" />
  <div class="p-5">
    <h3 class="font-display font-bold text-lg text-foreground">
      <!-- stretched link: the whole card is clickable, but only the title is the link -->
      <NuxtLink :to="\`/festivals/\${f.slug}\`" class="outline-none after:absolute after:inset-0">{{ f.name }}</NuxtLink>
    </h3>
    <p class="mt-1 font-sans text-xs text-muted-foreground">…meta…</p>
    <button type="button" class="relative z-10 …" @click="onPick(f.slug)">Going?</button>
  </div>
</div>

// accent comes from content, falling back to the brand amber:
const accent = f.accentColor || WD.amber600`

const artistCode = `<ArtistCard :artist="teacher" :accent="festival.accentColor" />

<!-- Lineup: the card filters the schedule, a separate link reaches the profile -->
<ArtistCard :artist="teacher" :accent="accent" selectable :selected="active" @select="filterBy(teacher)" />`

const eventCode = `<EventSchedule :events="events" />
// events: { id, title, eventType?, styles?, artists?, eventDate, startTime?, endTime?, location?, href? }[]`

const a11y = [
  '<strong>One link per card.</strong> A card with no inner controls can be the <code>&lt;a&gt;</code> (NuxtLink) itself — ArtistCard does this.',
  '<strong>Card with an inner button</strong> (Going?): a <code>&lt;button&gt;</code> inside an <code>&lt;a&gt;</code> is invalid HTML and screen readers announce it as one blob. Use the <em>stretched link</em> instead — root <code>relative</code>, the title is the link with <code>after:absolute after:inset-0</code>, the button sits above it with <code>relative z-10</code>. The anatomy example above is built this way.',
  '<strong>Selectable cards use the stretched pattern</strong> (ArtistCard <code>selectable</code>): the name is a <code>&lt;button&gt;</code> stretched over the card, and the profile link sits above it — never a link inside a button.',
  '<strong>Never make a <code>&lt;div @click&gt;</code> card.</strong> It can’t be reached by keyboard. Use a link or button root.',
  '<strong>Accent text on accent tint</strong> (chips) is decorative only for light accents (amber, yellow, sky): the chip text repeats information that is also in the title or filter, so it may sit below 4.5:1 — anything essential goes in brown.',
  '<strong>Images:</strong> artist photos use the person’s name as <code>alt</code>; festival logos use the festival name.',
]
</script>

<template>
  <DesignPage
    eyebrow="Patterns"
    title="Cards"
    status="beta"
    lead="One card language for everything you can go to: a white surface, a single accent colour taken from the content, a Playfair title and a quiet meta row. The card is the link; at most one small action sits inside."
  >
    <DesignSection id="anatomy" title="Anatomy" lead="Shown on a festival card — the most complete variant. Every other card drops parts, never adds new ones.">
      <div class="space-y-6">
        <DesignExample title="Festival card" center>
          <div class="w-full max-w-lg">
            <div
              class="group relative rounded-2xl overflow-hidden bg-card border transition-all hover:-translate-y-1 focus-within:ring-2 focus-within:ring-ring"
              :style="{ borderColor: accent + '55', boxShadow: '0 1px 0 ' + accent + '22, 0 8px 22px rgba(59,31,18,0.05)' }"
            >
              <div class="h-1.5" :style="{ background: accent }" />
              <span class="absolute top-2.5 left-2 size-5 rounded-full bg-foreground text-background text-[10px] font-bold flex items-center justify-center">3</span>
              <div class="p-5">
                <div class="flex items-start gap-4">
                  <img :src="festival.logo" :alt="festival.name" class="w-14 h-14 rounded-full shrink-0 shadow-sm object-cover bg-muted">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-start justify-between gap-2">
                      <h3 class="font-display font-bold text-lg leading-tight text-foreground">
                        <a href="#anatomy" class="outline-none after:absolute after:inset-0" @click.prevent>{{ festival.name }}</a> <sup class="font-sans text-[10px] text-muted-foreground">5</sup>
                      </h3>
                      <span class="font-display italic text-[15px] shrink-0 mt-0.5" :style="{ color: accent }">
                        {{ daysUntil(festival.startDate) }} <sup class="font-sans not-italic text-[10px] text-muted-foreground">4</sup>
                      </span>
                    </div>
                    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs font-sans text-muted-foreground">
                      <span class="flex items-center gap-1"><Calendar class="w-3 h-3 text-secondary" aria-hidden="true" /> {{ festival.dates }}</span>
                      <span class="flex items-center gap-1"><MapPin class="w-3 h-3 text-secondary" aria-hidden="true" /> {{ festival.location }}</span>
                      <sup class="text-[10px]">6</sup>
                    </div>
                    <div class="flex flex-wrap items-center gap-1.5 mt-3">
                      <span
                        v-for="s in festival.styles.slice(0, 4)"
                        :key="s"
                        class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-sans"
                        :style="{ background: accent + '18', color: accent }"
                      >{{ s }}</span>
                      <span class="px-1 text-[10px] font-sans text-secondary">+{{ festival.styles.length - 4 }}</span>
                      <sup class="font-sans text-[10px] text-muted-foreground">7</sup>
                    </div>
                    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs font-sans text-muted-foreground">
                      <span class="flex items-center gap-1"><Users class="w-3 h-3 text-secondary" aria-hidden="true" /> {{ festival.planning }} planning</span>
                      <button
                        type="button"
                        class="relative z-10 ml-auto text-xs font-bold px-3 py-1.5 rounded-full bg-white transition-all"
                        :style="{ color: accent, border: '1.5px solid ' + accent + '55' }"
                      >
                        Going?
                      </button>
                      <sup class="text-[10px]">8</sup>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DesignExample>

        <ol class="grid sm:grid-cols-2 gap-x-6 gap-y-3">
          <li v-for="a in anatomy" :key="a.n" class="flex gap-3">
            <span class="size-6 shrink-0 rounded-full bg-foreground text-background text-xs font-bold flex items-center justify-center">{{ a.n }}</span>
            <div class="text-sm">
              <strong class="text-foreground">{{ a.part }}</strong>
              <p class="text-muted-foreground">{{ a.spec }}</p>
            </div>
          </li>
        </ol>
      </div>
    </DesignSection>

    <DesignSection id="accent" title="Accent colour logic" lead="The accent is content, not decoration: it identifies the festival or the dance style across the card, the hero and the plan. Pick it once, derive the rest.">
      <div class="grid sm:grid-cols-2 gap-4">
        <div class="rounded-2xl border border-border bg-card p-5 text-sm space-y-2">
          <h3 class="font-display font-bold text-lg">Where it comes from</h3>
          <ul class="list-disc pl-5 text-muted-foreground space-y-1">
            <li><strong class="text-foreground">Festival / plan:</strong> <code>festival.accentColor</code>, fallback <code>WD.amber600</code>.</li>
            <li><strong class="text-foreground">Event:</strong> its first dance style (salsa red, bachata purple, timba amber, casino green, rueda cyan…), fallback amber-600.</li>
            <li><strong class="text-foreground">Artist:</strong> the context’s accent — the festival on a lineup, rotating brand colours on /artists.</li>
          </ul>
        </div>
        <div class="rounded-2xl border border-border bg-card p-5 text-sm">
          <h3 class="font-display font-bold text-lg">Derived steps</h3>
          <table class="w-full mt-2 text-left">
            <tbody>
              <tr v-for="row in [['accent', 'Bar, countdown, chip text, filled pill'], ['accent + 55 (33%)', 'Border, outline pill border'], ['accent + 22 (13%)', 'Hairline shadow'], ['accent + 18 (9%)', 'Chip background'], ['accent + 0d (5%)', 'Plan card header tint']]" :key="row[0]" class="border-t border-border">
                <td class="py-1.5 pr-3 font-mono text-[12px] whitespace-nowrap">{{ row[0] }}</td>
                <td class="py-1.5 text-muted-foreground">{{ row[1] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="mt-4 flex flex-wrap gap-2">
        <span
          v-for="(c, s) in styleColor"
          :key="s"
          class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-sans"
          :style="{ background: c + '18', color: c, border: '1px solid ' + c + '55' }"
        >{{ s }}</span>
      </div>
      <p class="text-xs text-muted-foreground mt-2">Style → accent map used by EventSchedule (CSS context: use <code>var(--wd-*)</code>; JS: <code>WD.*</code> so alpha suffixes work).</p>
    </DesignSection>

    <DesignSection id="variants" title="Variants" lead="Four variants cover the product. Choose by what the dancer is deciding, not by what data you have.">
      <div class="grid sm:grid-cols-2 gap-4">
        <div v-for="v in variants" :key="v.name" class="rounded-2xl border border-border bg-card p-5 text-sm">
          <h3 class="font-display font-bold text-lg">{{ v.name }}</h3>
          <p class="text-muted-foreground mt-1">{{ v.when }}</p>
          <p class="text-xs text-secondary mt-2 font-mono break-words">{{ v.where }}</p>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="event" title="Event row" lead="Live EventSchedule component with mock events. Time column in the style accent, type badge, style chips, place, then Going?. (Interaction is disabled here so the docs never write to your plan.)">
      <DesignExample :code="eventCode">
        <div class="w-full max-w-2xl" inert>
          <EventSchedule :events="events" />
        </div>
      </DesignExample>
    </DesignSection>

    <DesignSection id="festival" title="Festival card" lead="Use the FestivalCard component (app/components/FestivalCard.vue) — stretched-link title, Going? above it, accent-aware chips and an avatar row. Recipe:">
      <DesignCode :code="recipe" />
    </DesignSection>

    <DesignSection id="artist" title="Artist card" lead="Live ArtistCard with real lineup data from ¡Menéate Viena! Face first, whole card links to the profile.">
      <DesignExample :code="artistCode">
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-2xl">
          <ArtistCard
            v-for="(t, i) in artists"
            :key="t.id"
            :artist="t"
            :accent="accent"
            :residence="i === 2 ? 'Austria' : null"
            :origin="i < 2 ? 'Cuba' : null"
            :selectable="i === 1"
            :selected="i === 1"
          />
        </div>
      </DesignExample>
      <p class="text-xs text-muted-foreground mt-2">The middle card shows the <code>selectable</code> + <code>selected</code> state used on festival lineups.</p>
    </DesignSection>

    <DesignSection id="plan" title="Plan card" lead="Something the dancer already picked. Sticker shadow and a tinted header make it feel stuck onto their year. From YearPlan.vue (static recreation — YearPlan renders the whole dashboard).">
      <DesignExample>
        <a
          href="#plan"
          class="block w-full max-w-md rounded-xl border-2 overflow-hidden bg-white/85 hover:-translate-y-0.5 transition-all"
          :style="{ borderColor: accent + '55', boxShadow: '3px 4px 0 -1px ' + accent + '2e' }"
          @click.prevent
        >
          <div class="px-4 py-3 flex items-center gap-3" :style="{ background: accent + '0d' }">
            <img :src="festival.logo" :alt="festival.name" class="w-10 h-10 rounded-lg object-cover shrink-0 bg-muted">
            <div class="flex-1 min-w-0">
              <h3 class="text-sm font-bold leading-tight font-display text-foreground">{{ festival.name }}</h3>
              <div class="flex flex-wrap items-center gap-x-2 mt-0.5 text-xs text-secondary font-sans">
                <span class="flex items-center gap-1"><Calendar class="w-3 h-3" aria-hidden="true" /> Nov 26–29</span>
                <span class="flex items-center gap-1"><MapPin class="w-3 h-3" aria-hidden="true" /> Vienna</span>
              </div>
            </div>
            <ChevronRight class="w-4 h-4 shrink-0 text-secondary" aria-hidden="true" />
          </div>
          <div class="px-4 py-3 space-y-2.5 border-t font-sans" :style="{ borderColor: accent + '22' }">
            <div class="flex flex-wrap gap-2">
              <span class="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium">6 workshops</span>
              <span class="inline-flex items-center rounded-full border border-border bg-background px-2 py-0.5 text-xs font-medium">Follow</span>
              <span class="inline-flex items-center rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-wd-amber-800">2 need partner</span>
            </div>
            <span class="inline-flex items-center rounded-full border border-dashed border-border px-2 py-0.5 text-xs text-secondary">
              <Ticket class="w-3 h-3 mr-1" aria-hidden="true" /> No ticket yet
            </span>
          </div>
        </a>
      </DesignExample>
    </DesignSection>

    <DesignSection id="guidance" title="Do and don't">
      <div class="space-y-4">
        <DesignDoDont do-text="one accent per card, taken from the content (festival colour or dance style)." dont-text="mix two accents, or colour a card by taste. Colour must mean something the dancer can learn.">
          <template #do>
            <div class="w-40 h-20 rounded-2xl bg-white border overflow-hidden" :style="{ borderColor: accent + '55' }">
              <div class="h-1.5" :style="{ background: accent }" />
              <div class="p-2 flex gap-1"><span class="px-2 rounded-full text-[9px] font-bold" :style="{ background: accent + '18', color: accent }">TIMBA</span></div>
            </div>
          </template>
          <template #dont>
            <div class="w-40 h-20 rounded-2xl bg-white border overflow-hidden" :style="{ borderColor: WD.cyan600 + '55' }">
              <div class="h-1.5" :style="{ background: WD.purple500 }" />
              <div class="p-2 flex gap-1"><span class="px-2 rounded-full text-[9px] font-bold" :style="{ background: WD.green600 + '18', color: WD.green600 }">TIMBA</span></div>
            </div>
          </template>
        </DesignDoDont>
        <DesignDoDont do-text="real faces of real people. If there is no photo, show the initial on the accent — not a stand-in." dont-text="avatar generators, stock or AI faces. “Every face — real” is a product promise.">
          <template #do>
            <img src="/people/lisandra.jpg" alt="Lisandra Garcia" class="w-16 h-16 rounded-2xl object-cover">
            <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-white font-display" :style="{ background: accent }">M</div>
          </template>
          <template #dont>
            <div class="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center text-[10px] text-muted-foreground text-center p-1">random avatar</div>
          </template>
        </DesignDoDont>
        <DesignDoDont do-text="the card is the link; one small pill action inside (Going?)." dont-text="several buttons and links inside one card — the tap target becomes a guessing game on mobile.">
          <template #do>
            <div class="w-44 rounded-xl bg-white border border-border p-3 flex items-center justify-between text-xs font-sans"><span class="font-bold">Timba Thursday</span><span class="px-2 py-1 rounded-full border border-primary/40 text-primary font-bold">Going?</span></div>
          </template>
          <template #dont>
            <div class="w-44 rounded-xl bg-white border border-border p-3 flex flex-wrap gap-1 text-[10px] font-sans"><span class="font-bold w-full">Timba Thursday</span><span class="underline text-primary">Venue</span><span class="underline text-primary">DJ</span><span class="px-1.5 rounded-full bg-primary text-white">Book</span><span class="px-1.5 rounded-full border">Share</span></div>
          </template>
        </DesignDoDont>
      </div>
    </DesignSection>

    <DesignSection id="accessibility" title="Accessibility">
      <DesignA11y :notes="a11y" />
    </DesignSection>
  </DesignPage>
</template>
