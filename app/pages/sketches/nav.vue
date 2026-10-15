<script setup lang="ts">
/**
 * Sketch: main navigation — 4 candidate directions.
 *
 * Today's SiteHeader shows only Festivals + Cities; when signed in it adds
 * five inline text links (My plan, name, Business, Settings, Sign out) that
 * are ALL hidden on mobile, and Artists / Find your dance / My year are not
 * reachable from the header at all. Clickable local prototype only — links
 * don't navigate, nothing is wired to the DB.
 */
import {
  Search, Menu, X, ChevronDown, CalendarDays, Compass, MapPin, User,
  Briefcase, Settings, LogOut, Sparkles, Users, Music, Ticket, Plus, Command,
} from 'lucide-vue-next'

definePageMeta({ layout: false })
useHead({ title: 'WeDance — Navigation sketches' })

type Variant = 'A' | 'B' | 'C' | 'D' | 'E'
const VARIANTS: { id: Variant, name: string, idea: string, good: string, cost: string }[] = [
  {
    id: 'A',
    name: 'Clear top bar + account menu',
    idea: 'All public sections stay visible as links. Personal and business links move into one account menu.',
    good: 'Familiar. Fixes mobile with one menu button. Smallest change from today.',
    cost: 'Treats the business side as a menu item, so organizers may not notice it.',
  },
  {
    id: 'B',
    name: 'App-style tab bar',
    idea: 'On a phone the navigation is a bottom tab bar (Explore · Cities · My plan · Me). The desktop top bar shows the same four tabs.',
    good: 'Thumb-friendly. My plan is always one tap away, and that is the retention loop.',
    cost: 'Only 4 slots fit. Artists and Find your dance live inside Explore.',
  },
  {
    id: 'C',
    name: 'Dancers / Business split',
    idea: 'A switch at the top changes the whole menu between two audiences, like Airbnb’s guest and host modes.',
    good: 'Organizers, venues and artists get a real home. Dancers never see business clutter.',
    cost: 'One extra choice. Dancers who also organize have to switch modes.',
  },
  {
    id: 'D',
    name: 'Search-first',
    idea: 'One search box ("festival, city, artist…") sits at the centre. Section links become small chips.',
    good: 'Scales as the catalogue grows. ⌘K works for power users.',
    cost: 'Only works if search is good. It is new code, not a re-arrangement of what exists.',
  },
  {
    id: 'E',
    name: 'Recommended: A on desktop + B on phones',
    idea: 'Desktop: every public section is visible, My plan has a badge, and personal and business links sit in one account menu. Phone: a bottom tab bar (Explore · Cities · My plan · Me) with section chips inside Explore.',
    good: 'Nothing is hidden on mobile any more. My plan is always one tap away. Signed-out organizers get a "For organizers" link. Built from existing pages only.',
    cost: 'Two layouts to maintain (desktop bar and phone tab bar). The tab bar takes ~64px of screen height on phones.',
  },
]

const variant = ref<Variant>('E')
const signedIn = ref(true)
const device = ref<'desktop' | 'mobile'>('desktop')
const isMobile = computed(() => device.value === 'mobile')
const current = computed(() => VARIANTS.find(v => v.id === variant.value)!)

// Per-prototype UI state — reset when switching so each starts clean.
const active = ref('festivals')
const accountOpen = ref(false)
const sheetOpen = ref(false)
const mode = ref<'dance' | 'business'>('dance')
const paletteOpen = ref(false)
const query = ref('')
watch([variant, device, signedIn], () => {
  accountOpen.value = false
  sheetOpen.value = false
  paletteOpen.value = false
  mode.value = 'dance'
  active.value = variant.value === 'B' ? 'explore' : 'festivals'
})

// E: which bottom tab lights up for the current page.
const EXPLORE_IDS = ['explore', 'festivals', 'artists', 'find']
const ME_IDS = ['me', 'profile', 'year', 'business', 'settings']
function eTabActive(id: string) {
  if (id === 'explore') return EXPLORE_IDS.includes(active.value)
  if (id === 'me') return ME_IDS.includes(active.value) || sheetOpen.value
  return active.value === id
}
function eTab(id: string) {
  if (id === 'explore') return go('festivals')
  if (id === 'me') {
    if (!signedIn.value) return
    accountOpen.value = false
    sheetOpen.value = true
    return
  }
  go(id)
}

const planCount = 3
const user = { name: 'Alösha', initials: 'A' }

const discover = [
  { id: 'festivals', label: 'Festivals', icon: Sparkles },
  { id: 'cities', label: 'Cities', icon: MapPin },
  { id: 'artists', label: 'Artists', icon: Users },
  { id: 'find', label: 'Find your dance', icon: Music },
]
const accountLinks = [
  { id: 'profile', label: 'My profile', icon: User },
  { id: 'year', label: 'My year', icon: CalendarDays },
  { id: 'business', label: 'Business', icon: Briefcase },
  { id: 'settings', label: 'Settings', icon: Settings },
]
const businessLinks = [
  { id: 'dashboard', label: 'Dashboard', icon: Briefcase },
  { id: 'events', label: 'My events', icon: Ticket },
  { id: 'profiles', label: 'Profiles', icon: Users },
  { id: 'gigs', label: 'Gigs', icon: Music },
]
const tabs = [
  { id: 'explore', label: 'Explore', icon: Compass },
  { id: 'cities', label: 'Cities', icon: MapPin },
  { id: 'plan', label: 'My plan', icon: CalendarDays, badge: planCount },
  { id: 'me', label: 'Me', icon: User },
]

const SEARCH_POOL = [
  { group: 'Festivals', label: '¡Menéate Viena!', meta: 'Vienna · Mar 26–29' },
  { group: 'Festivals', label: 'Salsa Open Berlin', meta: 'Berlin · Sep 18–20' },
  { group: 'Festivals', label: 'Timba Fest London', meta: 'London · Oct 9–11' },
  { group: 'Cities', label: 'Munich', meta: '19 weekly socials' },
  { group: 'Cities', label: 'Vienna', meta: '11 weekly socials' },
  { group: 'Artists', label: 'Yunior Flow', meta: 'Cuban salsa · Munich' },
  { group: 'Artists', label: 'Alösha', meta: 'Rueda · Munich' },
]
const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  const list = q ? SEARCH_POOL.filter(r => (r.label + r.meta).toLowerCase().includes(q)) : SEARCH_POOL
  const groups: Record<string, typeof SEARCH_POOL> = {}
  for (const r of list) (groups[r.group] ||= []).push(r)
  return groups
})

function go(id: string) {
  active.value = id
  accountOpen.value = false
  sheetOpen.value = false
  paletteOpen.value = false
}

const pageTitle = computed(() => {
  const all = [...discover, ...accountLinks, ...businessLinks, ...tabs]
  return all.find(i => i.id === active.value)?.label ?? 'Festivals'
})

function onKey(e: KeyboardEvent) {
  if (variant.value === 'D' && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    paletteOpen.value = !paletteOpen.value
  }
  if (e.key === 'Escape') {
    paletteOpen.value = false
    accountOpen.value = false
    sheetOpen.value = false
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const link = (on: boolean) => on
  ? 'text-foreground font-semibold'
  : 'text-muted-foreground hover:text-foreground'
</script>

<template>
  <div class="min-h-screen bg-muted/40 text-foreground">
    <!-- Sketch controls (not part of any prototype) -->
    <div class="sticky top-0 z-[60] border-b border-border bg-card/95 backdrop-blur">
      <div class="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
        <span class="text-xs font-bold uppercase tracking-wider text-muted-foreground mr-1">Nav sketch</span>
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
          <input v-model="signedIn" type="checkbox" class="accent-[var(--color-primary)]">
          Signed in
        </label>
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
        class="relative bg-background overflow-hidden shadow-xl border border-border"
        :class="isMobile ? 'w-[390px] h-[min(760px,calc(100vh-11rem))] rounded-[2.25rem]' : 'w-full max-w-6xl min-h-[640px] rounded-xl'"
      >
        <div class="h-full overflow-y-auto" :class="isMobile && (variant === 'B' || variant === 'E') ? 'pb-20' : ''">
          <!-- ───────────── A · Clear top bar + account menu ───────────── -->
          <header v-if="variant === 'A'" class="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
            <div class="px-5 h-16 flex items-center gap-6">
              <Brand />
              <nav v-if="!isMobile" class="flex items-center gap-5 text-sm">
                <button v-for="l in discover" :key="l.id" :class="link(active === l.id)" class="relative py-5" @click="go(l.id)">
                  {{ l.label }}
                  <span v-if="active === l.id" class="absolute left-0 right-0 -bottom-px h-0.5 bg-primary rounded-full" />
                </button>
              </nav>
              <div class="ml-auto flex items-center gap-3">
                <button v-if="signedIn" class="relative flex items-center gap-1.5 text-sm font-semibold" :class="link(active === 'plan')" @click="go('plan')">
                  <CalendarDays class="w-5 h-5" />
                  <span v-if="!isMobile">My plan</span>
                  <span class="bg-primary text-primary-foreground text-[10px] font-bold min-w-4 h-4 rounded-full grid place-items-center px-1" :class="isMobile ? 'absolute -top-1.5 -right-2' : ''">{{ planCount }}</span>
                </button>
                <template v-if="!isMobile">
                  <div v-if="signedIn" class="relative">
                    <button class="flex items-center gap-1.5 rounded-full border border-border pl-1 pr-2 h-9 hover:bg-muted" @click="accountOpen = !accountOpen">
                      <span class="w-7 h-7 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-bold">{{ user.initials }}</span>
                      <span class="text-sm font-semibold">{{ user.name }}</span>
                      <ChevronDown class="w-4 h-4 text-muted-foreground" />
                    </button>
                    <div v-if="accountOpen" class="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card shadow-lg py-1.5 text-sm">
                      <button v-for="l in accountLinks" :key="l.id" class="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-muted text-left" @click="go(l.id)">
                        <component :is="l.icon" class="w-4 h-4 text-muted-foreground" />{{ l.label }}
                      </button>
                      <div class="my-1 border-t border-border" />
                      <button class="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-muted text-left text-muted-foreground" @click="signedIn = false">
                        <LogOut class="w-4 h-4" />Sign out
                      </button>
                    </div>
                  </div>
                  <Button v-else variant="pill" size="pill-sm">Sign in</Button>
                </template>
                <button v-else class="p-1.5 -mr-1.5" aria-label="Menu" @click="sheetOpen = true">
                  <Menu class="w-6 h-6" />
                </button>
              </div>
            </div>
          </header>
          <!-- A · mobile sheet -->
          <div v-if="variant === 'A' && isMobile && sheetOpen" class="absolute inset-0 z-40 bg-background flex flex-col">
            <div class="px-5 h-16 flex items-center justify-between border-b border-border">
              <Brand />
              <button class="p-1.5 -mr-1.5" aria-label="Close" @click="sheetOpen = false"><X class="w-6 h-6" /></button>
            </div>
            <div class="flex-1 overflow-y-auto px-5 py-4 space-y-6">
              <div v-if="signedIn" class="flex items-center gap-3">
                <span class="w-11 h-11 rounded-full bg-primary/15 text-primary grid place-items-center font-bold">{{ user.initials }}</span>
                <div><p class="font-display font-bold text-lg leading-tight">{{ user.name }}</p><p class="text-xs text-muted-foreground">View profile</p></div>
              </div>
              <Button v-else variant="pill" class="w-full">Sign in</Button>
              <section>
                <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">Discover</p>
                <button v-for="l in discover" :key="l.id" class="w-full flex items-center gap-3 py-3 text-lg font-display border-b border-border/60 text-left" @click="go(l.id)">
                  <component :is="l.icon" class="w-5 h-5 text-primary" />{{ l.label }}
                </button>
              </section>
              <section v-if="signedIn">
                <p class="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1">You</p>
                <button v-for="l in [{ id: 'plan', label: 'My plan', icon: CalendarDays }, ...accountLinks.slice(1)]" :key="l.id" class="w-full flex items-center gap-3 py-3 text-base border-b border-border/60 text-left" @click="go(l.id)">
                  <component :is="l.icon" class="w-5 h-5 text-muted-foreground" />{{ l.label }}
                </button>
                <button class="w-full flex items-center gap-3 py-3 text-base text-muted-foreground text-left" @click="signedIn = false">
                  <LogOut class="w-5 h-5" />Sign out
                </button>
              </section>
            </div>
          </div>

          <!-- ───────────── B · App-style tab bar ───────────── -->
          <header v-if="variant === 'B'" class="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
            <div class="px-5 h-16 flex items-center gap-4">
              <Brand />
              <nav v-if="!isMobile" class="mx-auto flex items-center gap-1 rounded-full bg-muted p-1">
                <button
                  v-for="t in tabs" :key="t.id"
                  class="flex items-center gap-1.5 h-9 px-4 rounded-full text-sm font-semibold transition-colors"
                  :class="active === t.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'"
                  @click="go(t.id)"
                >
                  <component :is="t.icon" class="w-4 h-4" />{{ t.label }}
                  <span v-if="t.badge && signedIn" class="bg-primary text-primary-foreground text-[10px] font-bold min-w-4 h-4 rounded-full grid place-items-center px-1">{{ t.badge }}</span>
                </button>
              </nav>
              <div class="ml-auto">
                <Button v-if="!signedIn" variant="pill" size="pill-sm">Sign in</Button>
                <button v-else-if="!isMobile" class="w-9 h-9 rounded-full bg-primary/15 text-primary grid place-items-center text-sm font-bold" @click="go('me')">{{ user.initials }}</button>
              </div>
            </div>
            <!-- Explore sub-nav: where Artists / Find your dance live -->
            <div v-if="active === 'explore'" class="px-5 pb-3 flex gap-2 overflow-x-auto text-xs">
              <span v-for="(l, i) in discover.filter(d => d.id !== 'cities')" :key="l.id" class="shrink-0 px-3 h-7 rounded-full border grid place-items-center font-semibold" :class="i === 0 ? 'border-primary bg-primary/10 text-wd-red-800' : 'border-border text-muted-foreground'">{{ l.label }}</span>
            </div>
          </header>
          <nav v-if="variant === 'B' && isMobile" class="absolute bottom-0 inset-x-0 z-30 border-t border-border bg-card/95 backdrop-blur pb-5 pt-2 grid grid-cols-4">
            <button v-for="t in tabs" :key="t.id" class="relative flex flex-col items-center gap-0.5 text-[11px] font-semibold" :class="active === t.id ? 'text-primary' : 'text-muted-foreground'" @click="go(t.id)">
              <component :is="t.icon" class="w-6 h-6" :stroke-width="active === t.id ? 2.4 : 1.8" />
              {{ t.id === 'me' && !signedIn ? 'Sign in' : t.label }}
              <span v-if="t.badge && signedIn" class="absolute top-0 left-1/2 ml-2 bg-primary text-primary-foreground text-[10px] font-bold min-w-4 h-4 rounded-full grid place-items-center px-1">{{ t.badge }}</span>
            </button>
          </nav>

          <!-- ───────────── C · Dancers / Business split ───────────── -->
          <header v-if="variant === 'C'" class="sticky top-0 z-30 border-b border-border" :class="mode === 'business' ? 'bg-foreground text-background' : 'bg-background/95 backdrop-blur'">
            <div class="px-5 h-16 flex items-center gap-5">
              <span :class="mode === 'business' ? 'bg-background rounded-full px-2.5 py-1.5' : ''"><Brand /></span>
              <div v-if="!isMobile" class="flex rounded-full p-0.5 text-xs font-bold" :class="mode === 'business' ? 'bg-background/10' : 'bg-muted'">
                <button class="px-3 h-7 rounded-full" :class="mode === 'dance' ? 'bg-card text-foreground shadow-sm' : 'opacity-70'" @click="mode = 'dance'; go('festivals')">For dancers</button>
                <button class="px-3 h-7 rounded-full" :class="mode === 'business' ? 'bg-primary text-primary-foreground' : 'opacity-70'" @click="mode = 'business'; go('dashboard')">For business</button>
              </div>
              <nav v-if="!isMobile" class="flex items-center gap-5 text-sm">
                <button
                  v-for="l in (mode === 'dance' ? discover.slice(0, 3) : businessLinks)" :key="l.id"
                  class="font-medium transition-opacity"
                  :class="active === l.id ? 'opacity-100 underline decoration-primary decoration-2 underline-offset-8' : 'opacity-65 hover:opacity-100'"
                  @click="go(l.id)"
                >{{ l.label }}</button>
              </nav>
              <div class="ml-auto flex items-center gap-3">
                <Button v-if="mode === 'business' && !isMobile" variant="pill" size="pill-sm"><Plus class="w-3.5 h-3.5" />List your event</Button>
                <button v-if="mode === 'dance' && signedIn && !isMobile" class="flex items-center gap-1.5 text-sm font-semibold" @click="go('plan')">
                  <CalendarDays class="w-5 h-5" />My plan
                  <span class="bg-primary text-primary-foreground text-[10px] font-bold min-w-4 h-4 rounded-full grid place-items-center px-1">{{ planCount }}</span>
                </button>
                <template v-if="!isMobile">
                  <button v-if="signedIn" class="w-9 h-9 rounded-full bg-primary/20 text-primary grid place-items-center text-sm font-bold" @click="go('profile')">{{ user.initials }}</button>
                  <Button v-else variant="outline-pill" size="pill-sm">Sign in</Button>
                </template>
                <button v-else class="p-1.5 -mr-1.5" aria-label="Menu" @click="sheetOpen = true"><Menu class="w-6 h-6" /></button>
              </div>
            </div>
          </header>
          <div v-if="variant === 'C' && isMobile && sheetOpen" class="absolute inset-0 z-40 flex flex-col" :class="mode === 'business' ? 'bg-foreground text-background' : 'bg-background'">
            <div class="px-5 h-16 flex items-center justify-between">
              <Brand />
              <button class="p-1.5 -mr-1.5" aria-label="Close" @click="sheetOpen = false"><X class="w-6 h-6" /></button>
            </div>
            <div class="px-5">
              <div class="grid grid-cols-2 rounded-full p-1 text-sm font-bold" :class="mode === 'business' ? 'bg-background/10' : 'bg-muted'">
                <button class="h-9 rounded-full" :class="mode === 'dance' ? 'bg-card text-foreground shadow-sm' : 'opacity-70'" @click="mode = 'dance'">For dancers</button>
                <button class="h-9 rounded-full" :class="mode === 'business' ? 'bg-primary text-primary-foreground' : 'opacity-70'" @click="mode = 'business'">For business</button>
              </div>
            </div>
            <div class="flex-1 overflow-y-auto px-5 py-4">
              <button
                v-for="l in (mode === 'dance' ? [...discover, ...(signedIn ? [{ id: 'plan', label: 'My plan', icon: CalendarDays }] : [])] : businessLinks)" :key="l.id"
                class="w-full flex items-center gap-3 py-3.5 text-xl font-display border-b text-left" :class="mode === 'business' ? 'border-background/15' : 'border-border/60'"
                @click="go(l.id)"
              ><component :is="l.icon" class="w-5 h-5 text-primary" />{{ l.label }}</button>
              <Button v-if="mode === 'business'" variant="pill" class="w-full mt-6"><Plus class="w-4 h-4" />List your event</Button>
              <div class="mt-6 text-sm opacity-70 flex items-center gap-2">
                <template v-if="signedIn"><User class="w-4 h-4" />{{ user.name }} · Settings · Sign out</template>
                <template v-else>Sign in</template>
              </div>
            </div>
          </div>

          <!-- ───────────── D · Search-first ───────────── -->
          <header v-if="variant === 'D'" class="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
            <div class="px-5 h-16 flex items-center gap-4">
              <Brand :variant="isMobile ? 'mark' : 'full'" class="shrink-0" />
              <button
                class="flex-1 flex items-center gap-2.5 h-10 rounded-full border border-border bg-card px-4 text-sm text-muted-foreground hover:border-primary/40 text-left"
                :class="isMobile ? '' : 'max-w-xl mx-auto'"
                @click="paletteOpen = true"
              >
                <Search class="w-4 h-4 shrink-0" />
                <span class="truncate">{{ isMobile ? 'Festival, city, artist…' : 'Search festivals, cities, artists…' }}</span>
                <kbd v-if="!isMobile" class="ml-auto flex items-center gap-0.5 text-[11px] font-semibold border border-border rounded px-1.5 py-0.5"><Command class="w-3 h-3" />K</kbd>
              </button>
              <div class="flex items-center gap-3">
                <button v-if="signedIn" class="relative" :class="link(active === 'plan')" aria-label="My plan" @click="go('plan')">
                  <CalendarDays class="w-5 h-5" />
                  <span class="absolute -top-1.5 -right-2 bg-primary text-primary-foreground text-[10px] font-bold min-w-4 h-4 rounded-full grid place-items-center px-1">{{ planCount }}</span>
                </button>
                <button v-if="signedIn" class="w-9 h-9 rounded-full bg-primary/15 text-primary grid place-items-center text-sm font-bold" @click="go('profile')">{{ user.initials }}</button>
                <Button v-else variant="pill" size="pill-sm">Sign in</Button>
              </div>
            </div>
            <div class="px-5 pb-3 flex gap-2 overflow-x-auto text-xs" :class="isMobile ? '' : 'justify-center'">
              <button
                v-for="l in discover" :key="l.id"
                class="shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-full border font-semibold"
                :class="active === l.id ? 'border-primary bg-primary/10 text-wd-red-800' : 'border-border text-muted-foreground hover:text-foreground'"
                @click="go(l.id)"
              ><component :is="l.icon" class="w-3.5 h-3.5" />{{ l.label }}</button>
            </div>
          </header>
          <div v-if="variant === 'D' && paletteOpen" class="absolute inset-0 z-40 bg-foreground/30 backdrop-blur-sm flex justify-center" :class="isMobile ? '' : 'pt-20'" @click.self="paletteOpen = false">
            <div class="bg-card shadow-2xl flex flex-col overflow-hidden" :class="isMobile ? 'w-full h-full' : 'w-full max-w-xl max-h-[460px] rounded-2xl border border-border'">
              <div class="flex items-center gap-2.5 px-4 h-14 border-b border-border">
                <Search class="w-5 h-5 text-muted-foreground" />
                <input v-model="query" autofocus placeholder="Search festivals, cities, artists…" class="flex-1 bg-transparent outline-none text-base">
                <button class="text-xs font-semibold text-muted-foreground" @click="paletteOpen = false">Esc</button>
              </div>
              <div class="overflow-y-auto py-2">
                <div v-for="(items, group) in results" :key="group" class="mb-1">
                  <p class="px-4 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{{ group }}</p>
                  <button v-for="r in items" :key="r.label" class="w-full flex items-center justify-between px-4 py-2 hover:bg-muted text-left text-sm" @click="go('festivals')">
                    <span class="font-semibold">{{ r.label }}</span><span class="text-xs text-muted-foreground">{{ r.meta }}</span>
                  </button>
                </div>
                <p v-if="!Object.keys(results).length" class="px-4 py-6 text-sm text-muted-foreground">No matches. Try “Munich”.</p>
              </div>
            </div>
          </div>

          <!-- ───────────── E · Recommended: A desktop + B phone ───────────── -->
          <header v-if="variant === 'E'" class="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
            <div class="px-5 flex items-center gap-6" :class="isMobile ? 'h-14' : 'h-16'">
              <Brand class="shrink-0" />
              <nav v-if="!isMobile" class="flex items-center gap-5 text-sm">
                <button v-for="l in discover" :key="l.id" :class="link(active === l.id)" class="relative py-5" @click="go(l.id)">
                  {{ l.label }}
                  <span v-if="active === l.id" class="absolute left-0 right-0 -bottom-px h-0.5 bg-primary rounded-full" />
                </button>
              </nav>
              <div class="ml-auto flex items-center gap-4">
                <template v-if="!isMobile">
                  <template v-if="signedIn">
                    <button class="flex items-center gap-1.5 text-sm font-semibold" :class="link(active === 'plan')" @click="go('plan')">
                      <CalendarDays class="w-5 h-5" />My plan
                      <span class="bg-primary text-primary-foreground text-[10px] font-bold min-w-4 h-4 rounded-full grid place-items-center px-1">{{ planCount }}</span>
                    </button>
                    <div class="relative">
                      <button class="flex items-center gap-1.5 rounded-full border border-border pl-1 pr-2 h-9 hover:bg-muted" @click="accountOpen = !accountOpen">
                        <span class="w-7 h-7 rounded-full bg-primary/15 text-primary grid place-items-center text-xs font-bold">{{ user.initials }}</span>
                        <span class="text-sm font-semibold">{{ user.name }}</span>
                        <ChevronDown class="w-4 h-4 text-muted-foreground" />
                      </button>
                      <div v-if="accountOpen" class="absolute right-0 mt-2 w-60 rounded-xl border border-border bg-card shadow-lg py-1.5 text-sm">
                        <button v-for="l in accountLinks.filter(a => a.id !== 'business')" :key="l.id" class="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-muted text-left" @click="go(l.id)">
                          <component :is="l.icon" class="w-4 h-4 text-muted-foreground" />{{ l.label }}
                        </button>
                        <div class="my-1 border-t border-border" />
                        <button class="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-muted text-left" @click="go('business')">
                          <Briefcase class="w-4 h-4 text-primary" />
                          <span>Business<span class="block text-[11px] text-muted-foreground">Your events, venues & profiles</span></span>
                        </button>
                        <div class="my-1 border-t border-border" />
                        <button class="w-full flex items-center gap-2.5 px-3.5 py-2 hover:bg-muted text-left text-muted-foreground" @click="signedIn = false">
                          <LogOut class="w-4 h-4" />Sign out
                        </button>
                      </div>
                    </div>
                  </template>
                  <template v-else>
                    <button class="text-sm text-muted-foreground hover:text-foreground" @click="go('business')">For organizers</button>
                    <Button variant="pill" size="pill-sm">Sign in</Button>
                  </template>
                </template>
                <Button v-else-if="!signedIn" variant="pill" size="pill-sm">Sign in</Button>
              </div>
            </div>
            <!-- Phone: section chips, only while on Explore -->
            <div v-if="isMobile && EXPLORE_IDS.includes(active)" class="px-5 pb-3 flex gap-2 overflow-x-auto text-xs">
              <button
                v-for="l in discover.filter(d => d.id !== 'cities')" :key="l.id"
                class="shrink-0 flex items-center gap-1.5 px-3 h-8 rounded-full border font-semibold"
                :class="active === l.id ? 'border-primary bg-primary/10 text-wd-red-800' : 'border-border text-muted-foreground'"
                @click="go(l.id)"
              ><component :is="l.icon" class="w-3.5 h-3.5" />{{ l.label }}</button>
            </div>
          </header>
          <!-- E · phone bottom tab bar -->
          <nav v-if="variant === 'E' && isMobile" class="absolute bottom-0 inset-x-0 z-50 border-t border-border bg-card/95 backdrop-blur pb-5 pt-2 grid grid-cols-4">
            <button
              v-for="t in tabs" :key="t.id"
              class="relative flex flex-col items-center gap-0.5 text-[11px] font-semibold"
              :class="eTabActive(t.id) ? 'text-primary' : 'text-muted-foreground'"
              @click="eTab(t.id)"
            >
              <component :is="t.icon" class="w-6 h-6" :stroke-width="eTabActive(t.id) ? 2.4 : 1.8" />
              {{ t.id === 'me' && !signedIn ? 'Sign in' : t.label }}
              <span v-if="t.badge && signedIn" class="absolute top-0 left-1/2 ml-2 bg-primary text-primary-foreground text-[10px] font-bold min-w-4 h-4 rounded-full grid place-items-center px-1">{{ t.badge }}</span>
            </button>
          </nav>
          <!-- E · phone "Me" sheet (slides up above the tab bar) -->
          <div v-if="variant === 'E' && isMobile && sheetOpen" class="absolute inset-0 z-40 bg-foreground/30 flex items-end" @click.self="sheetOpen = false">
            <div class="w-full bg-card rounded-t-3xl pb-24 pt-3 px-5 shadow-2xl">
              <div class="mx-auto w-10 h-1 rounded-full bg-border mb-4" />
              <div class="flex items-center gap-3 mb-3">
                <span class="w-11 h-11 rounded-full bg-primary/15 text-primary grid place-items-center font-bold">{{ user.initials }}</span>
                <div><p class="font-display font-bold text-lg leading-tight">{{ user.name }}</p><p class="text-xs text-muted-foreground">@alosha</p></div>
              </div>
              <button v-for="l in accountLinks" :key="l.id" class="w-full flex items-center gap-3 py-3 border-b border-border/60 text-left" @click="go(l.id)">
                <component :is="l.icon" class="w-5 h-5" :class="l.id === 'business' ? 'text-primary' : 'text-muted-foreground'" />{{ l.label }}
              </button>
              <button class="w-full flex items-center gap-3 py-3 text-muted-foreground text-left" @click="signedIn = false">
                <LogOut class="w-5 h-5" />Sign out
              </button>
            </div>
          </div>

          <!-- Mock page body — same for every prototype -->
          <main class="px-5 py-8">
            <p class="text-xs font-bold uppercase tracking-wider text-primary">{{ variant === 'C' && mode === 'business' ? 'Business' : 'Welcome to the dance' }}</p>
            <h1 class="font-display text-4xl leading-tight mt-1">{{ pageTitle }}</h1>
            <p class="text-sm text-muted-foreground mt-2 max-w-md">Placeholder page content, so you can judge the navigation in context.</p>
            <div class="mt-6 grid gap-4" :class="isMobile ? 'grid-cols-1' : 'grid-cols-3'">
              <div v-for="n in (isMobile ? 3 : 6)" :key="n" class="rounded-xl border border-border bg-card p-4">
                <div class="h-24 rounded-lg bg-gradient-to-br from-primary/25 to-orange-300/30 mb-3" />
                <p class="font-display font-bold">Festival {{ n }}</p>
                <p class="text-xs text-muted-foreground">City · Dates</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  </div>
</template>
