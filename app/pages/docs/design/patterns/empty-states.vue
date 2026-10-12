<script setup lang="ts">
import { Search, CalendarDays, MessageCircle, ArrowUpRight, Trophy, Target, Users } from 'lucide-vue-next'

definePageMeta({ layout: 'docs' })

const principles = [
  { title: 'Say what’s missing', body: 'Name the thing, plainly: “No classes listed here yet”, not “Nothing to see”. The dancer should know exactly which list is empty.' },
  { title: 'Say why — if it helps', body: '“yet” does most of the work: the scene is young here, not dead. For filters and search, the why is the filter — repeat the query back.' },
  { title: 'Offer one next action', body: 'One link or button that moves them forward: clear the search, ask the locals, tap “Going?”, enter the competition. Never two competing CTAs.' },
  { title: 'Never fake it', body: 'No placeholder events, no invented winners, no “12k dancers” counters. An honest empty state beats fake fullness (the “no fake friends” rule).' },
]

const copy = [
  { situation: 'Search returns nothing', pattern: 'Nothing matches “{query}” · Clear search', source: '/festivals, /cities, /artists' },
  { situation: 'Filters exclude everything', pattern: 'No {style} classes listed here yet — ask the locals where beginners start.', source: 'City taster' },
  { situation: 'User hasn’t picked anything', pattern: 'Build your week · Tap “Going?” on classes and socials to plan your dance week in {city}.', source: 'WeekDrawer' },
  { situation: 'Nobody has acted yet', pattern: 'No reviews yet. Be the first. · No Video of the Month yet · Be the first to enter', source: 'Reviews, VideoOfMonthCard' },
  { situation: 'Personal list, empty', pattern: 'No goals yet. One year, one arc, one reason to keep showing up.', source: '/my-plan' },
  { situation: 'City with no events', pattern: 'Local groups — community chats where the {city} scene organises. Join the locals.', source: 'CommunityGroupsSection' },
]

const containerCode = `<div class="text-center py-14 px-6 rounded-2xl border-2 border-dashed border-input bg-white/50">
  <Search class="w-8 h-8 mx-auto mb-3 text-secondary" aria-hidden="true" />
  <p class="font-sans text-sm text-muted-foreground">Nothing matches “{{ query }}”</p>
  <button type="button" class="mt-2 font-sans text-xs font-bold underline text-primary" @click="query = ''">
    Clear search
  </button>
</div>`

const a11y = [
  '<strong>Announce changes.</strong> When a filter or search empties a list, wrap the result area in <code>aria-live="polite"</code> so screen-reader users hear “Nothing matches …” instead of silence.',
  '<strong>Icons are decorative</strong> (<code>aria-hidden="true"</code>) — the sentence carries the meaning.',
  '<strong>The action is a real control:</strong> <code>&lt;button&gt;</code> for in-page actions (clear search), <code>&lt;a&gt;</code> for navigation (ask the locals). Underlined text alone is not a button.',
  '<strong>Don’t hide the section entirely</strong> when it is the only thing that could help — a missing section gives no clue that anything is wrong.',
]
</script>

<template>
  <DesignPage
    eyebrow="Patterns"
    title="Empty states"
    status="beta"
    lead="An empty list is a moment to be a good host: say what isn’t here yet, why, and point to the one thing worth doing next. Warm, short, honest."
  >
    <DesignSection id="principles" title="Principles">
      <div class="grid sm:grid-cols-2 gap-4">
        <div v-for="(p, i) in principles" :key="p.title" class="rounded-2xl border border-border bg-card p-5">
          <div class="font-display italic text-secondary">— {{ i + 1 }}</div>
          <h3 class="font-display font-bold text-lg mt-1">{{ p.title }}</h3>
          <p class="text-sm text-muted-foreground mt-1">{{ p.body }}</p>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="anatomy" title="The container" lead="Dashed 2px border in brown at 20% (border-input), translucent white, rounded-2xl, centred. One amber icon, one line of brown-700 sans copy, one red action.">
      <DesignExample :code="containerCode">
        <div class="w-full max-w-lg mx-auto text-center py-14 px-6 rounded-2xl border-2 border-dashed border-input bg-white/50" aria-live="polite">
          <Search class="w-8 h-8 mx-auto mb-3 text-secondary" aria-hidden="true" />
          <p class="font-sans text-sm text-muted-foreground">Nothing matches “kizomba vienna”</p>
          <button type="button" class="mt-2 font-sans text-xs font-bold underline text-primary">Clear search</button>
        </div>
      </DesignExample>
      <p class="text-xs text-muted-foreground mt-2">Inline variant (inside a card or section): drop the box, keep the sentence and the link — see the taster example below.</p>
    </DesignSection>

    <DesignSection id="examples" title="Examples" lead="Faithful recreations of what the product shows today, with the copy that ships.">
      <div class="space-y-6">
        <DesignExample title="No events this week → local groups">
          <div class="w-full space-y-4">
            <div class="rounded-2xl p-5 bg-card border border-success/35 font-sans">
              <div class="text-xs uppercase tracking-[0.3em] text-success">Try it, no pressure</div>
              <div class="mt-2 text-2xl leading-tight font-display text-foreground">Your first <em class="italic text-success">class.</em></div>
              <p class="mt-4 text-sm text-muted-foreground">
                No Bachata classes listed here yet —
                <a href="#examples" class="font-bold underline text-success">ask the locals where beginners start</a>.
              </p>
            </div>
            <div class="rounded-2xl bg-background/60 border border-border p-5 font-sans">
              <div class="flex items-center gap-2">
                <MessageCircle class="w-5 h-5 text-success" aria-hidden="true" />
                <div class="text-2xl font-display text-foreground">Local groups</div>
              </div>
              <p class="mt-1 text-sm text-muted-foreground">Community chats where the Munich scene organises — WhatsApp, Telegram &amp; more. Join the locals.</p>
              <ul class="mt-4 grid gap-2 sm:grid-cols-2">
                <li v-for="g in [{ n: 'Salsa and Timba chat', p: 'WhatsApp · Salsa, Timba' }, { n: 'Bachata socials', p: 'Telegram · Bachata' }]" :key="g.n">
                  <a href="#examples" class="flex items-center justify-between gap-3 rounded-xl border border-success/20 p-3 bg-white">
                    <div class="min-w-0">
                      <div class="font-bold text-sm truncate text-foreground">{{ g.n }}</div>
                      <div class="text-[11px] mt-0.5 text-secondary">{{ g.p }}</div>
                    </div>
                    <ArrowUpRight class="w-4 h-4 shrink-0 text-success" aria-hidden="true" />
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </DesignExample>
        <p class="text-xs text-muted-foreground -mt-3">Cold start: a city with no WeDance events still gets the human layer — where the scene already talks. (Group names above are illustrative.)</p>

        <div class="grid sm:grid-cols-2 gap-6">
          <DesignExample title="Empty plan">
            <div class="w-full text-center py-8 px-4 rounded-2xl border-2 border-dashed border-input bg-white/50">
              <CalendarDays class="w-8 h-8 mx-auto mb-3 text-secondary" aria-hidden="true" />
              <p class="text-sm font-bold font-display text-foreground">Build your week</p>
              <p class="text-xs text-muted-foreground mt-1 font-sans">Tap “Going?” on classes and socials to plan your dance week in Munich.</p>
            </div>
          </DesignExample>
          <DesignExample title="No search results">
            <div class="w-full text-center py-8 px-4 rounded-2xl border-2 border-dashed border-input bg-white/50">
              <Search class="w-8 h-8 mx-auto mb-3 text-secondary" aria-hidden="true" />
              <p class="text-sm text-muted-foreground font-sans">Nothing matches “timba lisbon”</p>
              <button type="button" class="text-xs font-bold mt-2 underline text-primary font-sans">Clear search</button>
            </div>
          </DesignExample>
          <DesignExample title="Nobody yet — invite to be first">
            <div class="w-full flex aspect-video flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input bg-white/50 text-center font-sans">
              <Trophy class="h-5 w-5 text-secondary" aria-hidden="true" />
              <p class="text-xs font-bold text-primary">Be the first to enter</p>
              <p class="text-[11px] text-muted-foreground">No Video of the Month yet</p>
            </div>
          </DesignExample>
          <DesignExample title="Personal list, with a reason">
            <div class="w-full text-center py-8 px-4 rounded-2xl border-2 border-dashed border-input bg-white/50">
              <Target class="w-8 h-8 mx-auto mb-3 text-secondary" aria-hidden="true" />
              <p class="text-sm text-muted-foreground font-sans">No goals yet. One year, one arc, one reason to keep showing up.</p>
              <button type="button" class="text-xs font-bold mt-2 underline text-primary font-sans">Set a goal</button>
            </div>
          </DesignExample>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="copy" title="Copy patterns" lead="Second person, present tense, a dash instead of a semicolon. “yet” over “no”. The action is a verb the dancer would say.">
      <ul class="rounded-2xl border border-border bg-card divide-y divide-border">
        <li v-for="c in copy" :key="c.situation" class="grid sm:grid-cols-[12rem_minmax(0,1fr)] gap-x-6 gap-y-1 px-5 py-3 text-sm">
          <strong class="text-foreground">{{ c.situation }}</strong>
          <div>
            <p class="font-display text-base text-foreground">{{ c.pattern }}</p>
            <p class="text-xs text-muted-foreground mt-0.5">{{ c.source }}</p>
          </div>
        </li>
      </ul>
    </DesignSection>

    <DesignSection id="guidance" title="Do and don't">
      <div class="space-y-4">
        <DesignDoDont do-text="name what’s missing and give one next step." dont-text="a bare “No data” or “No events match your filters.” with nowhere to go.">
          <template #do>
            <div class="text-center font-sans">
              <p class="text-sm text-muted-foreground">No Salsa classes listed here yet —</p>
              <a href="#guidance" class="text-sm font-bold underline text-success">ask the locals</a>
            </div>
          </template>
          <template #dont>
            <p class="text-sm text-muted-foreground font-sans">No data.</p>
          </template>
        </DesignDoDont>
        <DesignDoDont do-text="show the honest zero and invite people to be first." dont-text="fill the gap with sample events, a fake winner or inflated counts.">
          <template #do>
            <span class="inline-flex items-center gap-1.5 text-sm font-sans text-secondary italic"><Users class="w-4 h-4" aria-hidden="true" /> Be the first to go</span>
          </template>
          <template #dont>
            <span class="inline-flex items-center gap-1.5 text-sm font-sans text-muted-foreground"><Users class="w-4 h-4" aria-hidden="true" /> 12k+ dancers</span>
          </template>
        </DesignDoDont>
      </div>
    </DesignSection>

    <DesignSection id="accessibility" title="Accessibility">
      <DesignA11y :notes="a11y" />
    </DesignSection>
  </DesignPage>
</template>
