<script setup lang="ts">
/**
 * Sketch: City Battle — UX and placement, 4 directions + a recommended hybrid (RAZ-416).
 *
 * Today CityFight sits on /cities: one vote → next pair, no result, a leaderboard
 * ranked on 1–5 votes, mixed styles per matchup (Casino vs Timba), two taps to
 * play, labels colliding with the play/VS buttons on phones, and every approved
 * clip dates from 2026-07. Clickable local prototype only — no navigation, no
 * tRPC, no DB. Clip frames and titles are real approved entries; votes are mock.
 */
import { Swords, Trophy, Video, CheckCircle2, Sparkles, Users, Music, Compass, MapPin, CalendarDays, User, Search, Share2, Check, Play } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { WD } from '~/lib/brand'
import type { SketchClip } from '~/components/sketch/battle/Fight.vue'

definePageMeta({ layout: false })
useHead({ title: 'WeDance — City Battle sketches' })

type Variant = 'A' | 'B' | 'C' | 'D' | 'E'
const VARIANTS: { id: Variant, name: string, idea: string, good: string, cost: string }[] = [
  {
    id: 'A',
    name: 'Fix it in place',
    idea: 'Keep the battle on /cities and fix the widget: one tap plays, vote after watching both, show the result, honest standings.',
    good: 'Smallest change. Every fix ships inside the existing CityFight component.',
    cost: 'Still a widget on a directory page. No season, no reason to come back, no path to filming.',
  },
  {
    id: 'B',
    name: 'Monthly season under Explore',
    idea: 'A Battle chip next to Festivals and Artists opens a season page: one dance per month, a timeline, the battle, standings and next month\'s theme.',
    good: 'Gives a reason to vote now (countdown) and a reason to film (next theme). Same-style matchups.',
    cost: 'A new page, and someone has to pick a theme and seed clips every month.',
  },
  {
    id: 'C',
    name: 'Vertical swipe feed',
    idea: 'Full-screen clips like Reels: clip A, clip B, pick, see the crowd, next. The feed is the whole experience.',
    good: 'Fastest voting. Matches how dancers film and watch (every entry checked is a vertical Short).',
    cost: 'A new interaction pattern unlike the rest of WeDance. Weakest link to events, venues and people.',
  },
  {
    id: 'D',
    name: 'Home team on the city page',
    idea: 'The battle lives on each city page: your city\'s live matchup, its champion clip and where to dance with them. No global page.',
    good: 'Local pride is the strongest reason to vote and share. Clips lead straight to real events.',
    cost: 'Only people already on a city page see it. Cross-city discovery is weak.',
  },
  {
    id: 'E',
    name: 'Recommended: B + D, with A\'s fixes',
    idea: 'Season page under Explore (B), a home-team block on each city page (D), and /cities shrinks to one strip. Voting stays in CityFight with A\'s fixes and a full-screen player.',
    good: 'One place to play, one place to feel local pride, a monthly reason to film. Built mostly from existing components.',
    cost: 'Two surfaces to keep in sync, plus the monthly theme and seeding work from B.',
  },
]

const variant = ref<Variant>('E')
const device = ref<'desktop' | 'mobile'>('mobile')
const fresh = ref(true)
const isMobile = computed(() => device.value === 'mobile')
const current = computed(() => VARIANTS.find(v => v.id === variant.value)!)

/* ── mock data: real approved entries (city_videos, 2026-07), mock votes ── */
const CLIPS: Record<string, Omit<SketchClip, 'stale'>> = {
  munich: { key: 'munich', city: 'Munich', title: 'Casino night at Cohiba', style: 'Casino', img: '/sketches/battle/munich.jpg' },
  havana: { key: 'havana', city: 'Havana', title: 'Rueda de casino, Habana Vieja', style: 'Casino', img: '/sketches/battle/havana.jpg' },
  madrid: { key: 'madrid', city: 'Madrid', title: 'Rueda madrileña', style: 'Casino', img: '/sketches/battle/madrid.jpg' },
}
const clip = (k: string): SketchClip => ({ ...CLIPS[k]!, stale: !fresh.value })
const BASE = [
  { id: 'munich-vs-havana', a: 'munich', b: 'havana', va: 61, vb: 72 },
  { id: 'madrid-vs-munich', a: 'madrid', b: 'munich', va: 24, vb: 29 },
  { id: 'havana-vs-madrid', a: 'havana', b: 'madrid', va: 38, vb: 21 },
]
const MIN_BATTLES = 10
const HERO_MUNICH = 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/Stadtbild_M%C3%BCnchen.jpg/1920px-Stadtbild_M%C3%BCnchen.jpg'

/* ── per-prototype state, reset on every toggle ── */
const matches = ref(structuredClone(BASE))
const mi = ref(0)
const watched = ref<Record<string, string[]>>({})
const voted = ref<Record<string, string>>({})
const viewer = ref<{ queue: SketchClip[], sides: string[], title: string } | null>(null)
const shareOpen = ref(false)
const submitStep = ref<'cta' | 'form' | 'done'>('cta')
const page = ref<'battle' | 'city' | 'cities'>('battle')
const added = ref(false)
const feed = ref<'play' | 'choose' | 'reveal'>('play')
const feedKey = ref(0)
const scroller = ref<HTMLElement | null>(null)

function reset() {
  matches.value = structuredClone(BASE)
  mi.value = 0
  watched.value = {}
  voted.value = {}
  viewer.value = null
  shareOpen.value = false
  submitStep.value = 'cta'
  page.value = 'battle'
  added.value = false
  feed.value = 'play'
  feedKey.value++
  scroller.value?.scrollTo({ top: 0 })
}
watch([variant, device, fresh], reset)

const m = computed(() => matches.value[mi.value]!)
const pct = (x: { va: number, vb: number }) => { const a = Math.round(x.va / (x.va + x.vb) * 100); return [a, 100 - a] as const }
const left = computed(() => matches.value.filter(x => !voted.value[x.id]).length)
const totalVotes = computed(() => 142 + Object.keys(voted.value).length)

function play(matchIdx: number, keys: string[]) {
  const x = matches.value[matchIdx]!
  mi.value = matchIdx
  viewer.value = { queue: keys.map(clip), sides: [x.a, x.b], title: `${CLIPS[x.a]!.city} vs ${CLIPS[x.b]!.city} · Casino` }
}
function markWatched(key: string) {
  const id = m.value.id
  const list = watched.value[id] ?? []
  if (!list.includes(key)) watched.value[id] = [...list, key]
}
function vote(matchIdx: number, key: string) {
  const x = matches.value[matchIdx]!
  if (key === x.a) x.va++
  else x.vb++
  voted.value[x.id] = key
}
function next() {
  const n = matches.value.findIndex(x => !voted.value[x.id])
  if (n >= 0) mi.value = n
}

/* A: no gate needed for "fix in place"? It still gates, but plays one clip per tap. */
const standings = computed(() => {
  const st: Record<string, { w: number, l: number }> = { munich: { w: 7, l: 4 }, havana: { w: 9, l: 3 }, madrid: { w: 3, l: 6 } }
  for (const x of matches.value) {
    const v = voted.value[x.id]
    if (!v) continue
    st[v]!.w++
    st[v === x.a ? x.b : x.a]!.l++
  }
  const rows = Object.entries(st).map(([k, s]) => ({ k, city: CLIPS[k]!.city, ...s, n: s.w + s.l, rate: s.w / (s.w + s.l) }))
  return {
    ranked: rows.filter(r => r.n >= MIN_BATTLES).sort((p, q) => q.rate - p.rate),
    waiting: rows.filter(r => r.n < MIN_BATTLES),
  }
})
const rankColor = (i: number) => [WD.amber500, '#9ca3af', WD.amber700][i] ?? WD.amber600

/* C: feed */
function feedDone() { feed.value = 'choose' }
function feedPick(key: string) { vote(mi.value, key); feed.value = 'reveal' }
function feedNext() { next(); feed.value = 'play'; feedKey.value++ }

const exploreChips = [
  { id: 'festivals', label: 'Festivals', icon: Sparkles },
  { id: 'artists', label: 'Artists', icon: Users },
  { id: 'battle', label: 'Battle', icon: Swords },
  { id: 'find', label: 'Find your dance', icon: Music },
]
const desktopLinks = computed(() => (variant.value === 'B' || variant.value === 'E')
  ? ['Festivals', 'Cities', 'Artists', 'Battle', 'Find your dance']
  : ['Festivals', 'Cities', 'Artists', 'Find your dance'])
const activeLink = computed(() => {
  if (variant.value === 'A') return 'Cities'
  if (variant.value === 'D') return 'Cities'
  if (variant.value === 'E') return page.value === 'battle' ? 'Battle' : 'Cities'
  return variant.value === 'B' ? 'Battle' : ''
})
const tabs = [
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'cities', label: 'Cities', icon: MapPin },
  { id: 'plan', label: 'My plan', icon: CalendarDays },
  { id: 'me', label: 'Sign in', icon: User },
]
const activeTab = computed(() => activeLink.value === 'Battle' || variant.value === 'C' ? 'explore' : 'cities')
function onTab(id: string) {
  if (variant.value !== 'E') return
  if (id === 'explore') page.value = 'battle'
  if (id === 'cities') page.value = 'cities'
}
function onLink(l: string) {
  if (variant.value !== 'E') return
  if (l === 'Battle') page.value = 'battle'
  if (l === 'Cities') page.value = 'cities'
}
const showChips = computed(() => isMobile.value && (variant.value === 'B' || (variant.value === 'E' && page.value === 'battle')))
const wrap = computed(() => isMobile.value ? 'px-4' : 'max-w-3xl mx-auto px-6')
</script>

<template>
  <div class="min-h-screen bg-muted/40 text-foreground">
    <!-- Sketch controls (not part of any prototype) -->
    <div class="sticky top-0 z-[60] border-b border-border bg-card/95 backdrop-blur">
      <div class="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
        <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">Battle sketch</span>
        <div class="flex rounded-full border border-border p-0.5 bg-background">
          <button
            v-for="v in VARIANTS" :key="v.id"
            class="px-3 h-8 rounded-full text-sm font-bold transition-colors"
            :class="variant === v.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'"
            @click="variant = v.id"
          >{{ v.id }}</button>
        </div>
        <div class="flex rounded-full border border-border p-0.5 bg-background text-xs">
          <button
            v-for="d in (['desktop', 'mobile'] as const)" :key="d"
            class="px-3 h-7 rounded-full font-semibold capitalize"
            :class="device === d ? 'bg-foreground text-background' : 'text-muted-foreground'"
            @click="device = d"
          >{{ d }}</button>
        </div>
        <label class="flex items-center gap-2 text-xs font-semibold text-muted-foreground cursor-pointer">
          <input v-model="fresh" type="checkbox" class="accent-[var(--color-primary)]">
          October clips exist
        </label>
        <div v-if="variant === 'E'" class="flex rounded-full border border-border p-0.5 bg-background text-xs sm:ml-auto">
          <button
            v-for="p in ([['battle', 'Explore → Battle'], ['city', 'Munich page'], ['cities', '/cities']] as const)" :key="p[0]"
            class="px-3 h-7 rounded-full font-semibold"
            :class="page === p[0] ? 'bg-primary/10 text-wd-red-800' : 'text-muted-foreground'"
            @click="page = p[0]; scroller?.scrollTo({ top: 0 })"
          >{{ p[1] }}</button>
        </div>
      </div>
      <div class="max-w-6xl mx-auto px-4 pb-3 grid sm:grid-cols-[1.2fr_1fr_1fr] gap-3 text-xs">
        <p><span class="font-display text-base font-bold block">{{ current.id }} · {{ current.name }}</span>{{ current.idea }}</p>
        <p><span class="font-bold text-green-700 block uppercase tracking-wider">Good</span>{{ current.good }}</p>
        <p><span class="font-bold text-primary block uppercase tracking-wider">Cost</span>{{ current.cost }}</p>
      </div>
    </div>

    <!-- Device frame -->
    <div class="py-6 px-4 flex justify-center">
      <div
        class="relative bg-background overflow-hidden shadow-xl border border-border flex flex-col"
        :class="isMobile ? 'w-[390px] h-[min(760px,calc(100vh-12rem))] rounded-[2.25rem]' : 'w-full max-w-6xl h-[min(820px,calc(100vh-12rem))] rounded-xl'"
      >
        <!-- Header (SiteHeader look) -->
        <header v-if="variant !== 'C' || !isMobile" class="shrink-0 border-b border-border bg-background/95 z-20">
          <div class="flex items-center gap-6" :class="isMobile ? 'px-4 h-14' : 'px-6 h-16'">
            <Brand class="shrink-0" />
            <nav v-if="!isMobile" class="flex items-center gap-5 text-sm">
              <button
                v-for="l in desktopLinks" :key="l" class="relative py-5 whitespace-nowrap"
                :class="activeLink === l ? 'text-foreground font-semibold' : 'text-muted-foreground hover:text-foreground'"
                @click="onLink(l)"
              >
                {{ l }}
                <span v-if="activeLink === l" class="absolute left-0 right-0 -bottom-px h-0.5 bg-primary rounded-full" />
                <span v-if="l === 'Battle'" class="absolute -top-0 -right-3 w-1.5 h-1.5 rounded-full bg-primary" />
              </button>
            </nav>
            <div class="ml-auto flex items-center gap-4">
              <span v-if="!isMobile" class="text-sm text-muted-foreground whitespace-nowrap">For organizers</span>
              <Button variant="pill" size="pill-sm">Sign in</Button>
            </div>
          </div>
          <nav v-if="showChips" class="px-4 pb-3 flex gap-2 overflow-x-auto text-xs" aria-label="Explore">
            <span
              v-for="c in exploreChips" :key="c.id"
              class="shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-full border font-semibold"
              :class="c.id === 'battle' ? 'border-primary bg-primary/10 text-wd-red-800' : 'border-border text-muted-foreground'"
            ><component :is="c.icon" class="w-3.5 h-3.5" />{{ c.label }}</span>
          </nav>
        </header>

        <div ref="scroller" class="relative flex-1 overflow-y-auto">
          <!-- ═════════ A · Fix it in place (/cities) ═════════ -->
          <template v-if="variant === 'A'">
            <div class="text-center" :class="isMobile ? 'px-4 pt-8 pb-6' : 'pt-12 pb-8'">
              <div class="text-xs uppercase tracking-[0.3em] text-secondary font-display">Your local floor</div>
              <h1 class="font-display text-foreground mt-2" :class="isMobile ? 'text-3xl' : 'text-5xl'">Every scene <em class="italic text-primary">every city.</em></h1>
              <div class="mt-5 mx-auto max-w-md h-11 rounded-full border border-input bg-card flex items-center gap-2 px-4 text-sm text-muted-foreground shadow-wd-card"><Search class="w-4 h-4" />Search by city or country</div>
            </div>
            <WaveDivider />
            <section :class="[wrap, 'py-8']">
              <div class="text-center mb-5">
                <div class="inline-flex items-center gap-2 text-meta uppercase tracking-[0.3em] font-bold text-primary"><Swords class="w-4 h-4" /> City battle</div>
                <h2 class="text-2xl sm:text-3xl mt-1 font-display">Which city <em class="italic text-primary">wins?</em></h2>
                <p class="font-hand text-secondary" style="font-size:16px">— Casino this round · watch both, then vote</p>
              </div>
              <SketchBattleFight
                :a="clip(m.a)" :b="clip(m.b)" :va="m.va" :vb="m.vb" :watched="watched[m.id] ?? []" :vote="voted[m.id] ?? null"
                shape="video" :is-mobile="isMobile" :left="left"
                @play="k => play(mi, [k])" @play-both="play(mi, [m.a, m.b])" @vote="k => vote(mi, k)" @next="next" @share="shareOpen = true"
              />
              <div class="mt-8">
                <div class="flex items-center gap-2 mb-3"><Trophy class="w-4 h-4 text-warning" /><h3 class="text-lg font-hand">Top dance cities <span class="text-secondary font-display" style="font-size:15px">— this month</span></h3></div>
                <ol class="space-y-1.5">
                  <li v-for="(c, i) in standings.ranked" :key="c.k" class="flex items-center gap-3 rounded-xl bg-white border border-wd-brown-900/[10%] px-3 py-2 tabular-nums">
                    <span class="w-6 text-center font-black text-sm" :style="{ color: rankColor(i) }">{{ i + 1 }}</span>
                    <span class="flex-1 font-display font-bold text-sm">{{ c.city }}</span>
                    <span class="text-xs font-bold text-success">{{ c.w }}–{{ c.l }}</span>
                    <span class="text-meta text-secondary w-9 text-right">{{ Math.round(c.rate * 100) }}%</span>
                  </li>
                </ol>
                <p class="mt-2 text-meta text-muted-foreground">{{ totalVotes }} votes. <template v-if="standings.waiting.length">{{ standings.waiting.map(r => r.city).join(', ') }}: ranked after {{ MIN_BATTLES }} battles.</template></p>
              </div>
            </section>
            <section :class="[wrap, 'pb-10']">
              <h2 class="text-2xl font-display">Biggest communities</h2>
              <div class="mt-3 h-28 rounded-2xl border border-dashed border-input bg-white/50 grid place-items-center text-xs text-muted-foreground">city cards (unchanged)</div>
            </section>
          </template>

          <!-- ═════════ B / E(battle) · Season page under Explore ═════════ -->
          <template v-else-if="variant === 'B' || (variant === 'E' && page === 'battle')">
            <section class="text-center" :class="isMobile ? 'px-4 pt-7' : 'pt-12'">
              <div class="inline-flex items-center gap-2 text-meta uppercase tracking-[0.3em] font-bold text-primary"><Swords class="w-4 h-4" /> October battle</div>
              <h1 class="font-display mt-1" :class="isMobile ? 'text-3xl' : 'text-5xl'">Rueda de <em class="italic text-primary">Casino.</em></h1>
              <p class="font-hand text-secondary text-lg">— one dance, every city, you pick</p>
              <div class="mt-4 flex flex-wrap justify-center gap-1.5">
                <Badge variant="outline" class="border-success/40 text-success">✓ Submit · Oct 1–10</Badge>
                <Badge variant="outline" class="border-success/40 text-success">✓ City round</Badge>
                <Badge>Final · ends Oct 31</Badge>
                <Badge variant="outline" class="text-muted-foreground">Champion · Nov 1</Badge>
              </div>
              <p v-if="!fresh" class="mt-3 mx-auto max-w-sm rounded-xl bg-wd-amber-100 px-3 py-2 text-xs text-wd-amber-800">No October entries yet, so this round uses each city's best clip from July. Submit one below.</p>
            </section>
            <section :class="[wrap, 'pt-6']">
              <SketchBattleFight
                :a="clip(m.a)" :b="clip(m.b)" :va="m.va" :vb="m.vb" :watched="watched[m.id] ?? []" :vote="voted[m.id] ?? null"
                :is-mobile="isMobile" :left="left"
                @play="k => play(mi, [k])" @play-both="play(mi, [m.a, m.b])" @vote="k => vote(mi, k)" @next="next" @share="shareOpen = true"
              />
              <div v-if="Object.keys(voted).length" class="mt-3 flex justify-center gap-1.5 items-center text-xs text-muted-foreground">
                <span v-for="x in matches" :key="x.id" class="w-2 h-2 rounded-full" :class="voted[x.id] ? 'bg-wd-amber-500' : 'bg-wd-brown-900/15'" />
                <span class="ml-1">{{ Object.keys(voted).length }} of {{ matches.length }} battles voted</span>
              </div>
            </section>
            <section :class="[wrap, 'pt-8']">
              <div class="flex items-center gap-2 mb-3"><Trophy class="w-4 h-4 text-warning" /><h3 class="text-lg font-hand">Casino standings <span class="text-secondary font-display" style="font-size:15px">— October</span></h3></div>
              <ol class="space-y-1.5">
                <li v-for="(c, i) in standings.ranked" :key="c.k" class="flex items-center gap-3 rounded-xl bg-white border px-3 py-2 tabular-nums" :class="c.k === 'munich' ? 'border-primary/40' : 'border-wd-brown-900/[10%]'">
                  <span class="w-6 text-center font-black text-sm" :style="{ color: rankColor(i) }">{{ i + 1 }}</span>
                  <span class="flex-1 font-display font-bold text-sm">{{ c.city }}</span>
                  <span class="text-xs font-bold text-success">{{ c.w }}–{{ c.l }}</span>
                  <span class="text-meta text-secondary w-9 text-right">{{ Math.round(c.rate * 100) }}%</span>
                </li>
              </ol>
              <p class="mt-2 text-meta text-muted-foreground">{{ totalVotes }} votes this month. <template v-if="standings.waiting.length">{{ standings.waiting.map(r => r.city).join(', ') }}: ranked after {{ MIN_BATTLES }} battles.</template></p>
            </section>
            <section :class="[wrap, 'pt-10 pb-10']">
              <div class="text-xs uppercase tracking-[0.3em] text-secondary font-display">Next month's battle</div>
              <h2 class="text-2xl font-display mt-1">Salsa <em class="italic text-primary">On1.</em></h2>
              <p class="text-sm text-muted-foreground mt-1 mb-4">Film your social, class or shine. The best clip from each city goes to the November final.</p>
              <div class="rounded-2xl border bg-white p-5 border-primary/25" style="box-shadow:0 1px 0 rgba(220,38,38,.09), 0 8px 22px rgba(59,31,18,.05)">
                <div v-if="submitStep === 'cta'" class="flex flex-col items-center gap-3 text-center">
                  <p class="text-sm font-bold font-display">Get your dancing seen.</p>
                  <p class="max-w-xs text-xs leading-relaxed text-muted-foreground">Post a Salsa On1 clip, the community votes, and the top clip in each city goes to the final. Any dancer.</p>
                  <Button variant="pill" class="px-6" @click="submitStep = 'form'"><Video /> Submit your video</Button>
                  <p class="text-meta text-secondary">Free · we review every entry before it joins the vote</p>
                </div>
                <form v-else-if="submitStep === 'form'" class="space-y-3" @submit.prevent="submitStep = 'done'">
                  <div>
                    <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-primary">Enter the November battle</div>
                    <h3 class="mt-1 text-lg font-bold font-display">Submit your video</h3>
                  </div>
                  <Field id="sb-title" label="Video title"><Input id="sb-title" size="sm" model-value="Thursday social at Luma" /></Field>
                  <Field id="sb-url" label="Video link">
                    <Input id="sb-url" size="sm" model-value="https://www.instagram.com/reel/example" />
                    <p class="text-meta text-primary">Instagram link detected ✓</p>
                  </Field>
                  <div class="flex items-center justify-between rounded-lg bg-primary/5 px-3 py-2 text-sm"><span>Dance style</span><span class="font-display font-bold text-wd-red-800">Salsa On1 · this month's theme</span></div>
                  <Field id="sb-who" label="Who's dancing?" optional><Input id="sb-who" size="sm" placeholder="Tag dancers" /></Field>
                  <Field id="sb-ev" label="Where can people dance with you?" optional><Input id="sb-ev" size="sm" model-value="La Clave · Thursdays · Luma" /></Field>
                  <Field id="sb-mail" label="Your email"><Input id="sb-mail" size="sm" type="email" model-value="you@example.com" /></Field>
                  <Button type="submit" variant="pill" class="w-full">Submit my video</Button>
                </form>
                <div v-else class="flex flex-col items-center gap-2 py-4 text-center">
                  <CheckCircle2 class="h-8 w-8 text-primary" />
                  <p class="text-base font-bold font-display">Submitted — pending review</p>
                  <p class="max-w-xs text-xs text-muted-foreground">The Munich city round runs Nov 11–15. Tell your crew so they vote for you.</p>
                  <Button variant="outline-pill" size="pill-sm" class="mt-1" @click="shareOpen = true"><Share2 /> Tell your crew</Button>
                </div>
              </div>
            </section>
          </template>

          <!-- ═════════ C · Vertical swipe feed ═════════ -->
          <template v-else-if="variant === 'C'">
            <div class="h-full flex justify-center bg-wd-brown-950" :class="isMobile ? '' : 'py-6'">
              <div class="relative w-full overflow-hidden bg-black" :class="isMobile ? 'h-full' : 'max-w-[400px] h-full rounded-2xl'">
                <SketchBattleViewer
                  v-if="feed === 'play'" :key="feedKey" :queue="[clip(m.a), clip(m.b)]" :sides="[m.a, m.b]"
                  :title="`Battle ${matches.length - left + 1} of ${matches.length} · Casino`"
                  @watched="markWatched" @done="feedDone" @close="feedDone"
                />
                <div v-else-if="feed === 'choose'" class="absolute inset-0 grid grid-rows-2">
                  <button v-for="(k, i) in [m.a, m.b]" :key="k" type="button" class="relative overflow-hidden text-left text-white" @click="feedPick(k)">
                    <img :src="CLIPS[k]!.img" alt="" class="absolute inset-0 h-full w-full object-cover">
                    <span class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <span class="absolute left-4 right-4 bottom-4 flex items-end justify-between gap-3">
                      <span><span class="block font-display font-bold text-3xl leading-none">{{ CLIPS[k]!.city }}</span><span class="text-xs text-white/85">{{ CLIPS[k]!.title }}</span></span>
                      <span class="shrink-0 rounded-full px-4 h-10 inline-flex items-center font-display font-bold uppercase tracking-wider text-sm text-white" :style="{ background: i === 0 ? WD.red600 : WD.cyan700, boxShadow: '0 3px 0 -1px rgba(0,0,0,.3)' }">Pick</span>
                    </span>
                  </button>
                  <div class="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full grid place-items-center bg-wd-brown-900 text-white font-display font-black border-2 border-white/80">VS</div>
                  <p class="absolute top-4 inset-x-0 text-center font-hand text-xl text-white">which rueda moved you?</p>
                </div>
                <div v-else class="absolute inset-0 bg-background flex flex-col">
                  <div class="bg-wd-brown-900 text-white px-5 pt-8 pb-6 flex flex-col gap-3">
                    <span class="text-eyebrow uppercase tracking-[0.2em] font-bold text-wd-amber-400">Your vote: {{ CLIPS[voted[m.id]!]!.city }}</span>
                    <h2 class="font-display text-3xl leading-tight">{{ pct(m)[voted[m.id] === m.a ? 0 : 1] >= 50 ? 'You\'re with the crowd.' : 'You backed the underdog.' }}</h2>
                    <div class="flex justify-between font-display font-bold text-3xl tabular-nums"><span class="text-red-300">{{ pct(m)[0] }}%</span><span class="text-cyan-300">{{ pct(m)[1] }}%</span></div>
                    <div class="h-3 rounded-full overflow-hidden flex bg-wd-cyan-600"><div class="bg-wd-red-600" :style="{ width: pct(m)[0] + '%' }" /></div>
                    <div class="flex justify-between text-xs text-white/80"><span>{{ CLIPS[m.a]!.city }}</span><span>{{ CLIPS[m.b]!.city }}</span></div>
                  </div>
                  <div class="px-5 pt-5 flex flex-col gap-2">
                    <div class="text-eyebrow uppercase tracking-[0.2em] font-bold text-secondary">In this battle</div>
                    <div v-for="k in [m.a, m.b]" :key="k" class="flex items-center gap-3 rounded-xl border border-border bg-white p-2">
                      <img :src="CLIPS[k]!.img" alt="" class="w-10 h-12 rounded-lg object-cover">
                      <span class="min-w-0"><span class="block font-display font-bold text-sm">{{ CLIPS[k]!.city }}</span><span class="block truncate text-xs text-muted-foreground">{{ CLIPS[k]!.title }}</span></span>
                    </div>
                  </div>
                  <div class="p-5 flex flex-col gap-3 mt-auto">
                    <Button variant="cta" class="w-full h-12" :disabled="!left" @click="feedNext">{{ left ? 'Next battle' : 'All voted today' }}</Button>
                    <Button variant="outline-pill" class="w-full" @click="shareOpen = true"><Share2 /> Share this battle</Button>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- ═════════ D / E(city) · Home team on the city page ═════════ -->
          <template v-else-if="variant === 'D' || (variant === 'E' && page === 'city')">
            <div class="relative overflow-hidden bg-wd-brown-900" :class="isMobile ? 'h-56' : 'h-72'">
              <img :src="HERO_MUNICH" alt="Munich old town from above" class="absolute inset-0 h-full w-full object-cover">
              <div class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/55" />
              <div class="absolute left-4 bottom-4 text-white" :class="isMobile ? '' : 'left-8 bottom-6'">
                <div class="font-hand text-lg text-wd-amber-100">— 51 weekly events</div>
                <h1 class="font-display leading-none" :class="isMobile ? 'text-5xl' : 'text-6xl'">Munich</h1>
              </div>
              <span class="absolute right-2 bottom-1 text-[9px] text-white/75">Thomas Wolf, www.foto-tw.de · CC BY-SA 3.0 de</span>
            </div>
            <WaveDivider class="h-10 -mb-px" />
            <section :class="[wrap, 'pt-2']">
              <div class="text-xs uppercase tracking-[0.3em] text-secondary font-display">October battle · live</div>
              <h2 class="text-2xl font-display mt-1">Munich vs <em class="italic text-primary">Havana.</em></h2>
              <p class="text-sm text-muted-foreground mt-1 mb-4">
                {{ pct(matches[0]!)[0] >= 50 ? `Munich leads ${pct(matches[0]!)[0]}% with 15 days to go.` : `Munich is behind at ${pct(matches[0]!)[0]}% with 15 days to go. Watch both and back your city.` }}
              </p>
              <SketchBattleFight
                :a="clip(matches[0]!.a)" :b="clip(matches[0]!.b)" :va="matches[0]!.va" :vb="matches[0]!.vb"
                :watched="watched[matches[0]!.id] ?? []" :vote="voted[matches[0]!.id] ?? null"
                compact :is-mobile="isMobile"
                @play="k => play(0, [k])" @play-both="play(0, [matches[0]!.a, matches[0]!.b])" @vote="k => vote(0, k)"
              />
              <div v-if="voted[matches[0]!.id]" class="mt-3 flex gap-3">
                <Button variant="outline-pill" size="pill-sm" @click="shareOpen = true"><Share2 /> Rally Munich</Button>
                <Button v-if="variant === 'E'" variant="soft" size="pill-sm" @click="page = 'battle'; scroller?.scrollTo({ top: 0 })">More battles →</Button>
              </div>
            </section>
            <section :class="[wrap, 'pt-10']">
              <div class="text-xs uppercase tracking-[0.3em] text-secondary font-display">Munich's champion</div>
              <h2 class="text-2xl font-display mt-1">Dance <em class="italic text-primary">with them.</em></h2>
              <div class="mt-4 grid gap-3" :class="isMobile ? '' : 'grid-cols-2'">
                <button type="button" class="group relative block aspect-video w-full overflow-hidden rounded-xl text-left bg-wd-brown-900" @click="play(0, ['munich'])">
                  <img :src="CLIPS.munich!.img" alt="Casino night at Cohiba" class="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105">
                  <span class="absolute inset-0" style="background:linear-gradient(to top, rgba(0,0,0,0.6), rgba(0,0,0,0.05));" />
                  <span class="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-eyebrow font-bold uppercase tracking-wider text-white bg-primary"><Trophy class="h-3 w-3" /> City champion</span>
                  <span class="absolute inset-0 flex items-center justify-center"><span class="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-lg"><Play class="h-5 w-5 translate-x-0.5 text-primary" fill="currentColor" /></span></span>
                  <span class="absolute inset-x-0 bottom-0 p-2.5"><span class="block truncate text-sm font-bold text-white font-display">Casino night at Cohiba</span><span class="text-meta text-white/80">Casino · won the Munich round</span></span>
                </button>
                <div class="flex items-center gap-3 rounded-2xl border border-border bg-white px-3 py-3 shadow-wd-card self-start">
                  <div class="w-12 shrink-0 text-center font-display font-black text-primary tabular-nums">14:00<span class="block font-sans text-eyebrow font-bold uppercase text-secondary">Sat</span></div>
                  <div class="flex-1 min-w-0"><span class="text-eyebrow font-bold uppercase text-secondary">Social</span><span class="block font-display font-bold text-sm">Rueda Flashmob</span><span class="text-xs text-muted-foreground">Diana Tempel, Hofgarten</span></div>
                  <Button :variant="added ? 'soft' : 'pill'" size="pill-sm" @click="added = !added"><Check v-if="added" />{{ added ? 'Added' : 'Add' }}</Button>
                </div>
              </div>
            </section>
            <section :class="[wrap, 'pt-8 pb-10']">
              <div class="rounded-2xl border bg-white p-5 border-primary/25 flex flex-col items-center gap-3 text-center">
                <p class="text-sm font-bold font-display">Put Munich in the November battle.</p>
                <p class="max-w-xs text-xs leading-relaxed text-muted-foreground">Salsa On1 this time. The best Munich clip goes to the final against other cities.</p>
                <Button variant="pill" class="px-6"><Video /> Submit your video</Button>
                <p class="text-meta text-secondary">Free · we review every entry before it joins the vote</p>
              </div>
              <div class="mt-8 h-24 rounded-2xl border border-dashed border-input bg-white/50 grid place-items-center text-xs text-muted-foreground">venues · organisers · artists · schedule (unchanged)</div>
            </section>
          </template>

          <!-- ═════════ E(cities) · /cities with one strip ═════════ -->
          <template v-else>
            <div class="text-center" :class="isMobile ? 'px-4 pt-8 pb-6' : 'pt-12 pb-8'">
              <div class="text-xs uppercase tracking-[0.3em] text-secondary font-display">Your local floor</div>
              <h1 class="font-display mt-2" :class="isMobile ? 'text-3xl' : 'text-5xl'">Every scene <em class="italic text-primary">every city.</em></h1>
              <div class="mt-5 mx-auto max-w-md h-11 rounded-full border border-input bg-card flex items-center gap-2 px-4 text-sm text-muted-foreground shadow-wd-card"><Search class="w-4 h-4" />Search by city or country</div>
            </div>
            <WaveDivider />
            <section :class="[wrap, 'pt-6']">
              <button type="button" class="w-full flex items-center gap-3 rounded-2xl bg-white border border-primary/25 p-2 text-left" style="box-shadow:0 8px 22px rgba(59,31,18,.06)" @click="page = 'battle'; scroller?.scrollTo({ top: 0 })">
                <span class="relative grid grid-cols-2 gap-0.5 w-24 h-16 shrink-0 rounded-xl overflow-hidden">
                  <img :src="CLIPS.munich!.img" alt="" class="w-full h-full object-cover"><img :src="CLIPS.havana!.img" alt="" class="w-full h-full object-cover">
                  <span class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full grid place-items-center bg-wd-brown-900 text-white font-display font-black text-[9px]">VS</span>
                </span>
                <span class="flex-1 min-w-0">
                  <span class="block text-eyebrow uppercase tracking-[0.2em] font-bold text-primary">October battle · Casino</span>
                  <span class="block font-display font-bold">Munich vs Havana</span>
                  <span class="text-meta text-muted-foreground">Munich {{ pct(matches[0]!)[0] }}% · ends Oct 31</span>
                </span>
                <Button as="span" variant="pill" size="pill-sm">Vote</Button>
              </button>
            </section>
            <section :class="[wrap, 'pt-8 pb-10']">
              <div class="flex items-baseline justify-between"><h2 class="text-2xl font-display">Biggest communities</h2><span class="font-hand text-secondary">— top 9 of 471</span></div>
              <button type="button" class="mt-3 w-full text-left rounded-2xl overflow-hidden bg-white border border-primary/25" :class="isMobile ? '' : 'max-w-xs'" @click="page = 'city'; scroller?.scrollTo({ top: 0 })">
                <span class="relative block h-28"><img :src="HERO_MUNICH" alt="Munich" class="w-full h-full object-cover"><span class="absolute left-3 bottom-2 text-white"><span class="block font-display font-bold text-xl">Munich</span><span class="text-xs">Germany</span></span></span>
                <span class="block p-3"><span class="flex justify-between font-display font-bold text-primary tracking-widest text-sm">EXPLORE <span>→</span></span><span class="text-xs text-muted-foreground">920 in the community</span></span>
              </button>
            </section>
          </template>

        </div>
          <!-- Full-screen player (B, D, E open it from the cards; A too, one clip per tap) -->
          <SketchBattleViewer
            v-if="viewer" :queue="viewer.queue" :sides="viewer.sides" :title="viewer.title"
            @watched="markWatched" @done="viewer = null" @close="viewer = null"
          />

          <!-- Share sheet (SiteTabBar "Me" sheet pattern) -->
          <div v-if="shareOpen" class="absolute inset-0 z-[55] bg-black/30 flex items-end" @click.self="shareOpen = false">
            <div class="w-full bg-card rounded-t-3xl pt-3 px-5 pb-6 shadow-2xl" :class="isMobile ? '' : 'max-w-md mx-auto'">
              <div class="mx-auto w-10 h-1 rounded-full bg-border mb-4" />
              <h3 class="font-display text-xl">Share this <em class="italic text-primary">battle.</em></h3>
              <div class="relative mt-3 grid grid-cols-2 gap-0.5 h-36 rounded-xl overflow-hidden">
                <img :src="CLIPS[m.a]!.img" alt="" class="w-full h-full object-cover"><img :src="CLIPS[m.b]!.img" alt="" class="w-full h-full object-cover">
                <span class="absolute inset-0 flex flex-col justify-end p-3 text-white" style="background:linear-gradient(180deg,transparent 35%,rgba(59,31,18,.85))">
                  <span class="font-display font-bold text-xl">{{ CLIPS[m.a]!.city }} vs {{ CLIPS[m.b]!.city }}</span>
                  <span class="text-xs">Rueda de Casino · {{ pct(m)[0] }}% – {{ pct(m)[1] }}% · vote on WeDance</span>
                </span>
              </div>
              <p class="mt-2 text-xs text-muted-foreground">The preview people see in WhatsApp and Instagram. The link opens this battle.</p>
              <div class="mt-3 flex items-center gap-2 rounded-lg border border-input pl-3 pr-1 py-1">
                <code class="flex-1 truncate text-xs">2026.wedance.vip/battle/{{ m.id }}</code>
                <Button variant="pill" size="pill-sm" @click="shareOpen = false">Copy</Button>
              </div>
            </div>
          </div>

        <!-- Phone tab bar (SiteTabBar look, unchanged 4 tabs) -->
        <nav v-if="isMobile" class="shrink-0 border-t border-border bg-card/95 grid grid-cols-4 pt-2 pb-3 z-20" aria-label="Tabs">
          <button v-for="t in tabs" :key="t.id" type="button" class="flex flex-col items-center gap-0.5 text-[11px] font-semibold" :class="activeTab === t.id ? 'text-primary' : 'text-muted-foreground'" @click="onTab(t.id)">
            <component :is="t.icon" class="w-6 h-6" :stroke-width="activeTab === t.id ? 2.4 : 1.8" />{{ t.label }}
          </button>
        </nav>
      </div>
    </div>
  </div>
</template>
