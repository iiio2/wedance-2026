<script setup lang="ts">
/**
 * Prototype — the event's flyer screen, first time for this organizer
 * (journeys 1 + 2 in docs/proposals/2026-10-12-flyer-journeys.md).
 *
 * Starts from the event editor (/sketches/first-flyer/edit), where the details
 * — the words on the flyer and each artist's photo or name only — are checked.
 * First time: "Have you made flyers before?" → your flyers become the look (or:
 * start fresh → 4 directions) → make it → fix → keep the look → back to the event.
 * With a kept look (?step=quick): straight to painting, then back to the event.
 * No backend: painting and reading are timed fakes; images are earlier real work.
 */
import { Upload, Sparkles, Check, ArrowLeft, ArrowRight, Loader2, Wand2, Download, ImagePlus, X, PartyPopper, CalendarDays, MapPin, Music, RotateCcw, Pencil } from 'lucide-vue-next'

definePageMeta({ layout: false })
useHead({ title: 'Prototype · Make its flyer | WeDance', meta: [{ name: 'robots', content: 'noindex' }] })

// ---------------------------------------------------------------- mock data
const img = sketchImg
const route = useRoute()
const { ev, flyer, flyerText, keepFlyer } = useSketchEvent()
const EXAMPLE_FLYERS = [
  'v1791828192/wedance-2026/brand-import/laclave/2026-10-08-luma/luma-2026-10-08-story-1080x1920-etc1v.png',
  'v1791828204/wedance-2026/brand-import/laclave/2026-10-01-luma/luma-2026-10-01-story-1080x1920-lnus7.png',
  'v1791828198/wedance-2026/brand-import/laclave/2026-10-08-luma/luma-2026-10-08-feed-1080x1350-1sc1u.png',
]
// Start fresh: four directions painted for this event.
const DIRECTIONS = [
  { name: 'Neon street', hint: 'Red neon, night, gold title', url: 'v1791828192/wedance-2026/brand-import/laclave/2026-10-08-luma/luma-2026-10-08-story-1080x1920-etc1v.png' },
  { name: 'Revolution poster', hint: 'Cuban flag, halftone, cream paper', url: 'v1791828157/wedance-2026/brand-import/montuno/frida-mondays-launch/gemini-square-v7-flag-wedge-0eku9.jpg' },
  { name: 'Tropical', hint: 'Palms, warm sunset, vintage', url: 'v1791828174/wedance-2026/brand-import/montuno/frida-mondays-2026-05-18-felix-rumba/gemini-square-v2-tropical-poster-79s3r.jpg' },
  { name: 'Afro club', hint: 'Purple and gold, stage lights', url: 'v1791828120/wedance-2026/brand-import/laclave/2026-10-08-luma-afro/luma-2026-10-08-ellis-story-1080x1920-eyiua.png' },
]
// ---------------------------------------------------------------- flow
type Step = 'ask' | 'upload' | 'reading' | 'look' | 'brief' | 'painting' | 'directions' | 'result' | 'save' | 'done'
const step = ref<Step>('ask')
const path = ref<'yes' | 'fresh' | null>(null)
const history: Step[] = []
function go(s: Step) { history.push(step.value); step.value = s; if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' }) }
function back() { const prev = history.pop(); if (prev) step.value = prev }

const stages = computed(() => [
  { key: 'style', label: path.value === 'fresh' ? 'Your vibe' : 'Your style', on: ['ask', 'upload', 'reading', 'look', 'brief'].includes(step.value) },
  { key: 'make', label: 'Make it', on: ['painting', 'directions', 'result'].includes(step.value) },
  { key: 'keep', label: 'Keep the look', on: ['save', 'done'].includes(step.value) },
])
const stageIndex = computed(() => stages.value.findIndex(s => s.on))
// A kept look skips the style questions: refresh = paint, check, done.
const quick = ref(false)
onMounted(() => {
  const had = flyer.value.story ? SKETCH_VERSIONS.indexOf(flyer.value.story) : -1
  if (route.query.step === 'quick') { quick.value = true; version.value = had === 0 ? 1 : 0; versions.value = [version.value]; paint('result') }
  else if (route.query.step === 'result' && had > -1) { version.value = had; versions.value = [had]; step.value = 'result' }
})

// Your flyers (real file picker; previews stay in the browser)
const uploads = ref<{ url: string; name: string }[]>([])
const uploadError = ref<string | null>(null)
function addFiles(e: Event) {
  const files = Array.from((e.target as HTMLInputElement).files ?? [])
  for (const f of files.filter(f => f.type.startsWith('image/'))) uploads.value.push({ url: URL.createObjectURL(f), name: f.name })
  uploadError.value = null
}
function useExamples() { uploads.value = EXAMPLE_FLYERS.map((u, i) => ({ url: img(u, 400), name: `Earlier La Clave flyer ${i + 1}` })) }
const colours = ref([
  { name: 'Neon red', hex: '#d6263a' }, { name: 'Gold', hex: '#e8b33a' }, { name: 'Night', hex: '#1a0f12' }, { name: 'White', hex: '#ffffff' },
])
function readStyle() {
  if (!uploads.value.length) { uploadError.value = 'Add at least one flyer, or use the example flyers.'; return }
  go('reading')
  setTimeout(() => go('look'), 2600)
}

// The look, read back
const lookText = ref('A red-neon Havana street at night: old colonial balconies, red and gold neon light, red palm leaves in the corners, a golden spotlight on the street. Tall narrow capital letters, gold headline, white times. The DJ big in the middle.')
const facts = reactive([
  { text: 'Luma · Neuhauser Str. 47 · München', on: true },
  { text: 'Free entry until 21:00 · from 21:00 10€', on: true },
  { text: 'Workshops are free', on: true },
  { text: 'Always “Alösha” with ö', on: true },
  { text: 'Instagram @ritmo_jg on every flyer', on: false },
])

// Start fresh
const FEELING = ['Warm', 'Bold', 'Street', 'Vintage', 'Tropical', 'Elegant', 'Club']
const feeling = ref<string[]>([])
const briefError = ref<string | null>(null)
const toggle = (list: string[], v: string) => { const i = list.indexOf(v); i > -1 ? list.splice(i, 1) : list.push(v); briefError.value = null }
const likedFlyer = ref<string | null>(null)
function addLiked(e: Event) { const f = (e.target as HTMLInputElement).files?.[0]; if (f) likedFlyer.value = URL.createObjectURL(f) }

// Painting (timed fake)
const paintMsg = ref('')
const PAINT_STEPS = ['Painting your story…', 'Reading every word back…', 'Comparing with your event…']
function paint(next: Step, fast = false) {
  go('painting')
  const steps = fast ? PAINT_STEPS.slice(0, 2) : PAINT_STEPS
  steps.forEach((m, i) => setTimeout(() => (paintMsg.value = m), i * 1300))
  setTimeout(() => go(next), steps.length * 1300 + 400)
}
function make() {
  if (path.value === 'fresh') paint('directions')
  else paint('result')
}

// Directions (fresh)
const picked = ref<number[]>([])
const pickError = ref<string | null>(null)
function pick(i: number) { const k = picked.value.indexOf(i); k > -1 ? picked.value.splice(k, 1) : picked.value.length < 2 && picked.value.push(i); pickError.value = null }
function useDirections() {
  if (!picked.value.length) { pickError.value = 'Pick at least one direction.'; return }
  paint('result', true)
}

// Result + fixes
const version = ref(0)
const versions = ref([0])
const fixes = ['Person lower', 'Bigger date', 'Other photo', 'More gold', 'Less busy']
const fixNote = ref('')
const chosenFixes = ref<string[]>([])
const fixError = ref<string | null>(null)
function paintAgain() {
  if (!chosenFixes.value.length && !fixNote.value.trim()) { fixError.value = 'Pick a change or write what should be different.'; return }
  fixError.value = null
  paint('result', true)
  setTimeout(() => { if (!versions.value.includes(1)) versions.value.push(1); version.value = 1; chosenFixes.value = []; fixNote.value = '' }, 2 * 1300 + 450)
}
const current = computed(() => SKETCH_VERSIONS[version.value]!)
const lookName = ref(flyer.value.look ?? 'Main party')
// "This is the one": the first time, name the look; with a kept look, back to the event.
function choose() {
  if (flyer.value.look) { keepFlyer(current.value, flyer.value.look); return navigateTo('/sketches/first-flyer/edit') }
  go('save')
}
function keepLook() { keepFlyer(current.value, lookName.value); go('done') }
</script>

<template>
  <SketchBusinessShell active="events">
    <!-- Event, always visible -->
    <NuxtLink to="/sketches/first-flyer/edit" class="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground hover:underline">
      <ArrowLeft class="size-3.5" aria-hidden="true" /> Back to the event
    </NuxtLink>
    <div class="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h1 class="font-display text-3xl font-bold">Flyer · {{ ev.name }}</h1>
      <p class="text-sm text-muted-foreground"><CalendarDays class="inline size-4" aria-hidden="true" /> {{ ev.date }} · {{ ev.start }}–{{ ev.end }}</p>
    </div>
    <details class="mt-2 max-w-xl rounded-xl border bg-card px-3 py-2 text-xs">
      <summary class="cursor-pointer"><span class="font-bold text-wd-green-700"><Check class="inline size-3.5" aria-hidden="true" /> Details checked</span> <span class="text-muted-foreground">· {{ flyerText.length }} lines go on the flyer</span></summary>
      <ul class="mt-2 grid gap-0.5"><li v-for="t in flyerText" :key="t">{{ t }}</li></ul>
      <NuxtLink to="/sketches/first-flyer/edit" class="mt-2 inline-flex items-center gap-1 font-bold text-secondary hover:underline"><Pencil class="size-3" aria-hidden="true" /> Change in the event</NuxtLink>
    </details>

    <!-- Progress -->
    <ol v-if="!quick" class="mt-5 flex flex-wrap gap-2 text-xs" aria-label="Steps">
      <li
        v-for="(s, i) in stages"
        :key="s.key"
        class="flex items-center gap-1.5 rounded-full border px-3 py-1"
        :class="i === stageIndex ? 'border-primary bg-primary/5 font-bold text-wd-red-800' : i < stageIndex ? 'text-wd-green-700' : 'text-muted-foreground'"
        :aria-current="i === stageIndex ? 'step' : undefined"
      >
        <Check v-if="i < stageIndex" class="size-3.5" aria-hidden="true" /><span v-else>{{ i + 1 }}</span> {{ s.label }}
      </li>
    </ol>

    <!-- 1 · Ask -->
    <section v-if="step === 'ask'" class="mt-6">
      <h2 class="font-display text-2xl font-bold">Have you made flyers for La Clave before?</h2>
      <p class="mt-1 text-sm text-muted-foreground">In Canva, Photoshop, or anywhere else. They tell us how your flyers should look.</p>
      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <button type="button" class="rounded-2xl border-2 bg-card p-5 text-left transition-colors hover:border-primary/50 focus-visible:shadow-wd-focus" @click="path = 'yes'; go('upload')">
          <Upload class="size-6 text-primary" aria-hidden="true" />
          <p class="mt-2 font-display text-lg font-bold">Yes, I have some</p>
          <p class="mt-1 text-sm text-muted-foreground">Add 2–5 flyers you’ve posted. We’ll keep your look.</p>
        </button>
        <button type="button" class="rounded-2xl border-2 bg-card p-5 text-left transition-colors hover:border-primary/50 focus-visible:shadow-wd-focus" @click="path = 'fresh'; go('brief')">
          <Sparkles class="size-6 text-primary" aria-hidden="true" />
          <p class="mt-2 font-display text-lg font-bold">No, start fresh</p>
          <p class="mt-1 text-sm text-muted-foreground">Tell us the feeling. We’ll show you four directions.</p>
        </button>
      </div>
      <div class="mt-6"><Button variant="outline-pill" as-child><NuxtLink to="/sketches/first-flyer/edit"><ArrowLeft /> Back to the event</NuxtLink></Button></div>
    </section>

    <!-- 1a · Upload -->
    <section v-else-if="step === 'upload'" class="mt-6">
      <h2 class="font-display text-2xl font-bold">Add flyers you’ve made</h2>
      <p class="mt-1 text-sm text-muted-foreground">2–5 is best, any size, from your phone or computer.</p>
      <div class="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
        <div v-for="(u, i) in uploads" :key="u.url" class="relative">
          <img :src="u.url" :alt="u.name" class="aspect-[4/5] w-full rounded-xl border object-cover">
          <button type="button" class="absolute right-1 top-1 rounded-full bg-card/90 p-1" :aria-label="`Remove ${u.name}`" @click="uploads.splice(i, 1)"><X class="size-3.5" /></button>
        </div>
        <label class="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input text-center text-xs text-muted-foreground hover:border-primary/50 has-[:focus-visible]:shadow-wd-focus">
          <ImagePlus class="size-5" aria-hidden="true" /> Add flyers
          <input type="file" accept="image/*" multiple class="sr-only" @change="addFiles">
        </label>
      </div>
      <button v-if="!uploads.length" type="button" class="mt-2 text-xs font-bold text-secondary hover:underline" @click="useExamples">Try it with example La Clave flyers</button>
      <p v-if="uploadError" class="mt-2 text-sm text-destructive" role="alert">{{ uploadError }}</p>

      <details class="mt-5 rounded-2xl border bg-card p-4">
        <summary class="cursor-pointer text-sm font-bold">Have a logo or brand colours? <span class="font-normal text-muted-foreground">(optional)</span></summary>
        <div class="mt-3 flex flex-wrap items-center gap-3">
          <label class="flex size-16 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-input text-center text-[11px] text-muted-foreground">Logo<input type="file" accept="image/*" class="sr-only"></label>
          <span class="text-xs text-muted-foreground">Colours are picked up from your flyers. You can change them on the next step.</span>
        </div>
      </details>

      <div class="mt-6 flex gap-2">
        <Button variant="outline-pill" @click="back"><ArrowLeft /> Back</Button>
        <Button variant="pill" @click="readStyle">Read my style <ArrowRight /></Button>
      </div>
    </section>

    <!-- 1a · Reading -->
    <section v-else-if="step === 'reading'" class="mt-10 flex flex-col items-center text-center" role="status">
      <Loader2 class="size-8 animate-spin text-primary" aria-hidden="true" />
      <p class="mt-3 font-display text-xl font-bold">Reading your flyers…</p>
      <p class="mt-1 text-sm text-muted-foreground">The scene, colours, lettering, and the facts that repeat.</p>
    </section>

    <!-- 1a · The look, read back -->
    <section v-else-if="step === 'look'" class="mt-6">
      <h2 class="font-display text-2xl font-bold">This is how your flyers look</h2>
      <p class="mt-1 text-sm text-muted-foreground">Change anything that’s wrong. Every new flyer is painted from this.</p>
      <div class="mt-4 grid gap-4 sm:grid-cols-[1fr_200px]">
        <div class="rounded-2xl border bg-card p-4">
          <Field id="look-text" label="The look">
            <Textarea v-model="lookText" :rows="5" />
          </Field>
          <p class="mt-4 text-sm font-bold">Colours</p>
          <div class="mt-2 flex flex-wrap gap-2">
            <span v-for="c in colours" :key="c.name" class="inline-flex items-center gap-1.5 rounded-full border bg-card py-1 pl-1 pr-2.5 text-xs">
              <span class="size-5 rounded-full border" :style="{ background: c.hex }" /> {{ c.name }}
            </span>
          </div>
          <p class="mt-4 text-sm font-bold">True on every flyer</p>
          <p class="text-xs text-muted-foreground">We found these on your flyers. Untick what’s not always true.</p>
          <ul class="mt-2 grid gap-1.5">
            <li v-for="f in facts" :key="f.text">
              <label class="flex items-center gap-2 text-sm"><Checkbox v-model="f.on" /> {{ f.text }}</label>
            </li>
          </ul>
        </div>
        <div>
          <p class="text-xs font-bold text-muted-foreground">From your flyers</p>
          <div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-1">
            <img v-for="u in uploads.slice(0, 2)" :key="u.url" :src="u.url" alt="" class="w-full rounded-xl border">
          </div>
        </div>
      </div>
      <div class="mt-6 flex gap-2">
        <Button variant="outline-pill" @click="back"><ArrowLeft /> Back</Button>
        <Button variant="cta" @click="make"><Wand2 /> That’s us · make the flyer</Button>
      </div>
    </section>

    <!-- 1b · Start fresh -->
    <section v-else-if="step === 'brief'" class="mt-6">
      <h2 class="font-display text-2xl font-bold">How should it feel?</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        The music comes from your event: <span class="font-bold text-foreground">{{ ev.styles.join(', ') || 'none set' }}</span>.
        You’ll see four directions next, painted for this event.
      </p>
      <div class="mt-4 grid gap-5 rounded-2xl border bg-card p-5">
        <div>
          <p class="text-sm font-bold">The feeling <span class="font-normal text-muted-foreground">(pick up to 3)</span></p>
          <div class="mt-2 flex flex-wrap gap-2">
            <Button v-for="f in FEELING" :key="f" size="sm" :variant="feeling.includes(f) ? 'soft' : 'outline'" :aria-pressed="feeling.includes(f)" :disabled="!feeling.includes(f) && feeling.length >= 3" @click="toggle(feeling, f)">{{ f }}</Button>
          </div>
        </div>
        <div>
          <p class="text-sm font-bold">A flyer you like <span class="font-normal text-muted-foreground">(optional, anyone’s)</span></p>
          <div class="mt-2 flex items-center gap-3">
            <img v-if="likedFlyer" :src="likedFlyer" alt="" class="h-24 rounded-lg border">
            <label class="flex h-24 w-20 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-input text-center text-[11px] text-muted-foreground">
              <ImagePlus class="size-4" aria-hidden="true" /> Add
              <input type="file" accept="image/*" class="sr-only" @change="addLiked">
            </label>
          </div>
        </div>
      </div>
      <p v-if="briefError" class="mt-2 text-sm text-destructive" role="alert">{{ briefError }}</p>
      <div class="mt-6 flex gap-2">
        <Button variant="outline-pill" @click="back"><ArrowLeft /> Back</Button>
        <Button variant="cta" @click="!feeling.length ? (briefError = 'Pick at least one feeling.') : make()"><Wand2 /> Show me 4 directions</Button>
      </div>
    </section>

    <!-- Painting -->
    <section v-else-if="step === 'painting'" class="mt-10 flex flex-col items-center text-center" role="status">
      <Loader2 class="size-8 animate-spin text-primary" aria-hidden="true" />
      <p class="mt-3 font-display text-xl font-bold">{{ paintMsg || 'Starting…' }}</p>
      <p class="mt-1 text-sm text-muted-foreground">You can leave this page. We’ll keep going.</p>
    </section>

    <!-- 1b · Four directions -->
    <section v-else-if="step === 'directions'" class="mt-6">
      <h2 class="font-display text-2xl font-bold">Four directions for La Clave</h2>
      <p class="mt-1 text-sm text-muted-foreground">Pick one or two you like. We’ll finish them as stories.</p>
      <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <button
          v-for="(d, i) in DIRECTIONS"
          :key="d.name"
          type="button"
          class="overflow-hidden rounded-2xl border-2 bg-card text-left"
          :class="picked.includes(i) ? 'border-primary' : 'border-transparent'"
          :aria-pressed="picked.includes(i)"
          @click="pick(i)"
        >
          <img :src="img(d.url, 400)" :alt="d.name" class="aspect-[4/5] w-full object-cover">
          <span class="block p-2">
            <span class="flex items-center gap-1 text-sm font-bold"><Check v-if="picked.includes(i)" class="size-4 text-primary" aria-hidden="true" /> {{ d.name }}</span>
            <span class="block text-xs text-muted-foreground">{{ d.hint }}</span>
          </span>
        </button>
      </div>
      <p v-if="pickError" class="mt-2 text-sm text-destructive" role="alert">{{ pickError }}</p>
      <div class="mt-6 flex flex-wrap gap-2">
        <Button variant="outline-pill" @click="paint('directions')"><RotateCcw /> Show 4 more</Button>
        <Button variant="pill" @click="useDirections">Use {{ picked.length === 2 ? 'these' : 'this' }} <ArrowRight /></Button>
      </div>
    </section>

    <!-- 3 · Result -->
    <section v-else-if="step === 'result'" class="mt-6">
      <div class="flex flex-wrap items-baseline justify-between gap-2">
        <h2 class="font-display text-2xl font-bold">Your flyer</h2>
        <div v-if="versions.length > 1" class="flex gap-1" role="group" aria-label="Versions">
          <Button v-for="v in versions" :key="v" size="sm" :variant="version === v ? 'soft' : 'ghost'" @click="version = v">Version {{ v + 1 }}</Button>
        </div>
      </div>
      <div class="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
        <figure class="mx-auto w-full max-w-sm">
          <img :src="img(current)" alt="Instagram story flyer" class="w-full rounded-xl border">
          <figcaption class="mt-1.5 text-xs"><span class="font-bold">Instagram story</span> <span class="text-muted-foreground">1080×1920</span></figcaption>
        </figure>
        <div class="grid content-start gap-4">
          <div class="rounded-2xl bg-success/10 p-4">
            <p class="flex items-center gap-1.5 text-sm font-bold text-wd-green-700"><Check class="size-4" aria-hidden="true" /> Every word matches your event</p>
            <details class="mt-1">
              <summary class="cursor-pointer text-xs text-muted-foreground">What we checked</summary>
              <ul class="mt-1 grid gap-0.5 text-xs">
                <li v-for="c in flyerText" :key="c">✓ {{ c }}</li>
              </ul>
            </details>
          </div>
          <div class="rounded-2xl border bg-card p-4">
            <p class="text-sm font-bold">Want something different?</p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <Button v-for="f in fixes" :key="f" size="sm" :variant="chosenFixes.includes(f) ? 'soft' : 'outline'" :aria-pressed="chosenFixes.includes(f)" @click="toggle(chosenFixes, f); fixError = null">{{ f }}</Button>
            </div>
            <Input v-model="fixNote" class="mt-2" placeholder="Or say it: less neon, warmer light" @input="fixError = null" />
            <p v-if="fixError" class="mt-1 text-xs text-destructive" role="alert">{{ fixError }}</p>
            <Button variant="outline-pill" size="pill-sm" class="mt-3" @click="paintAgain"><Wand2 /> Paint again</Button>
            <p class="mt-1 text-xs text-muted-foreground">Keeps this version, so you can compare.</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button variant="ghost" size="sm"><Download /> Download</Button>
          </div>
          <Button variant="pill" @click="choose">{{ flyer.look ? 'Use this flyer' : 'This is the one' }} <ArrowRight /></Button>
        </div>
      </div>
    </section>

    <!-- 4 · Keep the look -->
    <section v-else-if="step === 'save'" class="mt-6 max-w-xl">
      <h2 class="font-display text-2xl font-bold">Use this look for La Clave from now on?</h2>
      <p class="mt-1 text-sm text-muted-foreground">Next Thursday starts from it. You’ll only change the DJ and the details.</p>
      <div class="mt-4 flex items-center gap-4 rounded-2xl border bg-card p-4">
        <img :src="img(current, 200)" alt="" class="h-28 rounded-lg border">
        <Field id="look-name" label="Call this look" class="flex-1">
          <Input v-model="lookName" />
        </Field>
      </div>
      <div class="mt-6 flex gap-2">
        <Button variant="outline-pill" @click="back"><ArrowLeft /> Back</Button>
        <Button variant="pill" @click="keepLook">Yes, keep it</Button>
      </div>
    </section>

    <!-- Done -->
    <section v-else-if="step === 'done'" class="mt-8 max-w-xl">
      <PartyPopper class="size-8 text-primary" aria-hidden="true" />
      <h2 class="mt-2 font-display text-2xl font-bold">Your first flyer is ready</h2>
      <p class="mt-1 text-sm text-muted-foreground">It’s on the event now, and “{{ lookName }}” is La Clave’s look. If you change the details, the event tells you the flyer is out of date and refreshes it in this look.</p>
      <div class="mt-4 flex items-center gap-4 rounded-2xl border bg-card p-4">
        <img :src="img(current, 160)" alt="" class="h-20 rounded-md border opacity-60">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold">{{ ev.name }} · Thu 22 Oct</p>
          <p class="text-xs text-muted-foreground">Next week starts from this look: change the DJ, refresh, done.</p>
        </div>
      </div>
      <div class="mt-6 flex flex-wrap gap-2">
        <Button variant="pill" as-child><NuxtLink to="/sketches/first-flyer/edit">Back to the event <ArrowRight /></NuxtLink></Button>
        <Button variant="outline-pill"><Download /> Download</Button>
      </div>
    </section>
  </SketchBusinessShell>
</template>
