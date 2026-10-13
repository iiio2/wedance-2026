<script setup lang="ts">
/**
 * /business/events/<id>/flyer — make the event's flyer. Starts from the event
 * editor, where the details (the words on the flyer) are checked.
 *
 * First time: "Have you made flyers before?" → your flyers become the look (or
 * start fresh → four directions) → make it → fix → keep it and name the look.
 * With a saved look: make it in that look. ?batch=… opens a sitting (painting
 * or done); &refresh=1 is the editor's "Refresh the flyer"; &flyer=… picks a
 * version. Gemini paints for real; every version is read back and checked.
 */
import { Upload, Sparkles, Check, ArrowLeft, ArrowRight, Loader2, Wand2, Download, ImagePlus, X, PartyPopper, CalendarDays, Pencil, AlertTriangle, RotateCcw, Palette } from 'lucide-vue-next'

definePageMeta({ layout: 'business' })

const route = useRoute()
const { $trpc } = useNuxtApp()
const id = computed(() => String(route.params.id))
const editor = computed(() => `/business/events/${id.value}`)

type Ev = Awaited<ReturnType<typeof $trpc.businessEvents.get.query>>
type State = Awaited<ReturnType<typeof $trpc.businessFlyers.state.query>>
type Row = Awaited<ReturnType<typeof $trpc.businessFlyers.batch.query>>[number]
const ev = ref<Ev | null>(null)
const st = ref<State | null>(null)
const loadError = ref<string | null>(null)
useHead(() => ({ title: `Flyer · ${ev.value?.name || 'Event'} | Business | WeDance` }))

// ---------------------------------------------------------------- flow
type Step = 'ask' | 'upload' | 'reading' | 'look' | 'brief' | 'painting' | 'directions' | 'result' | 'save' | 'done'
const step = ref<Step>('ask')
const path = ref<'yes' | 'fresh' | 'saved' | null>(null)
const history: Step[] = []
function go(s: Step) { history.push(step.value); step.value = s; if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' }) }
function back() { const prev = history.pop(); if (prev) step.value = prev }
const error = ref<string | null>(null)

const stages = computed(() => [
  { key: 'style', label: path.value === 'fresh' ? 'Your vibe' : 'Your style', on: ['ask', 'upload', 'reading', 'look', 'brief'].includes(step.value) },
  { key: 'make', label: 'Make it', on: ['painting', 'directions', 'result'].includes(step.value) },
  { key: 'keep', label: 'Keep it', on: ['save', 'done'].includes(step.value) },
])
const stageIndex = computed(() => stages.value.findIndex(s => s.on))

// ---------------------------------------------------------------- the sitting
const batchId = ref<string | null>(null)
const rows = ref<Row[]>([])
const refreshing = computed(() => route.query.refresh === '1')
let timer: ReturnType<typeof setInterval> | undefined
let onSettled: (() => void) | null = null
async function pollOnce() {
  if (!batchId.value) return
  try {
    rows.value = await $trpc.businessFlyers.batch.query({ batchId: batchId.value })
  } catch (e: any) {
    error.value = e?.message || 'Lost track of the flyer. Reload the page.'
  }
  if (!rows.value.some(r => r.status === 'painting')) {
    clearInterval(timer)
    timer = undefined
    const cb = onSettled
    onSettled = null
    cb?.()
  }
}
function watchBatch(b: string, then: () => void) {
  batchId.value = b
  onSettled = then
  clearInterval(timer)
  timer = setInterval(pollOnce, 3000)
  void pollOnce()
}
onBeforeUnmount(() => clearInterval(timer))

// Honest progress words while Gemini works (paint ~30 s, read back, maybe again).
const paintMsg = ref('Painting your story…')
let msgTimer: ReturnType<typeof setTimeout>[] = []
function painting(what = 'Painting your story…') {
  msgTimer.forEach(clearTimeout)
  paintMsg.value = what
  msgTimer = [
    setTimeout(() => (paintMsg.value = 'Reading every word back…'), 35_000),
    setTimeout(() => (paintMsg.value = 'A word was off: painting it again…'), 60_000),
  ]
  go('painting')
}
onBeforeUnmount(() => msgTimer.forEach(clearTimeout))

// ---------------------------------------------------------------- 1a · your flyers
const uploads = ref<{ url: string; name: string }[]>([])
const uploading = ref(0)
const uploadError = ref<string | null>(null)
async function uploadFile(file: File) {
  const body = new FormData()
  body.append('file', file)
  const res = await fetch('/api/media/image?folder=flyers', { method: 'POST', body })
  if (!res.ok) throw new Error('upload')
  return (await res.json()).url as string
}
async function addFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? []).filter(f => f.type.startsWith('image/')).slice(0, 5 - uploads.value.length)
  input.value = ''
  uploadError.value = null
  uploading.value += files.length
  await Promise.all(files.map(async (f) => {
    try { uploads.value.push({ url: await uploadFile(f), name: f.name }) } catch { uploadError.value = `${f.name} didn’t upload. Try again.` } finally { uploading.value-- }
  }))
}
const look = reactive({ name: 'Main look', description: '', palette: [] as { name: string; hex: string }[] })
async function readStyle() {
  if (!uploads.value.length) { uploadError.value = 'Add at least one flyer you’ve made.'; return }
  go('reading')
  try {
    Object.assign(look, await $trpc.businessFlyers.readLook.mutate({ eventId: id.value, urls: uploads.value.map(u => u.url) }))
    step.value = 'look'
  } catch (e: any) {
    step.value = 'upload'
    uploadError.value = e?.message || 'Couldn’t read your flyers. Try again.'
  }
}
const lookError = ref<string | null>(null)
async function makeFromLook() {
  if (look.description.trim().length < 10) { lookError.value = 'Describe the look in a sentence or two.'; return }
  lookError.value = null
  try {
    const { batchId: b } = await $trpc.businessFlyers.make.mutate({
      eventId: id.value, look: { name: look.name, description: look.description, palette: look.palette }, references: uploads.value.map(u => u.url),
    })
    painting()
    watchBatch(b, toResult)
  } catch (e: any) {
    lookError.value = e?.message || 'Couldn’t start the flyer.'
  }
}

// ---------------------------------------------------------------- saved look
const savedLookId = ref<string | null>(null)
async function makeInSavedLook(lookId: string) {
  error.value = null
  path.value = 'saved'
  savedLookId.value = lookId
  try {
    const { batchId: b } = await $trpc.businessFlyers.make.mutate({ eventId: id.value, lookId })
    painting()
    watchBatch(b, toResult)
  } catch (e: any) {
    error.value = e?.message || 'Couldn’t start the flyer.'
  }
}

// ---------------------------------------------------------------- 1b · start fresh
const FEELING = ['Warm', 'Bold', 'Street', 'Vintage', 'Tropical', 'Elegant', 'Club']
const feeling = ref<string[]>([])
const briefError = ref<string | null>(null)
function toggle(list: string[], v: string) { const i = list.indexOf(v); i > -1 ? list.splice(i, 1) : list.push(v) }
const liked = ref<string | null>(null)
const likedUploading = ref(false)
async function addLiked(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  likedUploading.value = true
  try { liked.value = await uploadFile(f) } catch { briefError.value = 'That flyer didn’t upload. Try again.' } finally { likedUploading.value = false }
}
async function showDirections() {
  if (!feeling.value.length) { briefError.value = 'Pick at least one feeling.'; return }
  briefError.value = null
  try {
    const { batchId: b } = await $trpc.businessFlyers.directions.mutate({ eventId: id.value, feelings: feeling.value, inspiration: liked.value })
    picked.value = []
    painting('Painting four directions…')
    watchBatch(b, () => { step.value = 'directions' })
  } catch (e: any) {
    briefError.value = e?.message || 'Couldn’t start the directions.'
  }
}

// ---------------------------------------------------------------- directions
const directions = computed(() => rows.value.filter(r => r.mode === 'direction'))
const picked = ref<string[]>([])
const pickError = ref<string | null>(null)
function pick(rid: string) {
  const k = picked.value.indexOf(rid)
  if (k > -1) picked.value.splice(k, 1)
  else if (picked.value.length < 2) picked.value.push(rid)
  pickError.value = null
}
function useDirections() {
  if (!picked.value.length) { pickError.value = 'Pick at least one direction.'; return }
  toResult()
}

// ---------------------------------------------------------------- result
// Versions you compare: everything painted in this sitting, except directions you didn't pick.
const versions = computed(() => rows.value.filter(r => r.status === 'ready' && (r.mode !== 'direction' || picked.value.includes(r.id))))
const failed = computed(() => rows.value.filter(r => r.status === 'failed' && r.mode !== 'direction'))
const currentId = ref<string | null>(null)
const current = computed(() => versions.value.find(v => v.id === currentId.value) ?? versions.value[versions.value.length - 1] ?? null)
function toResult() {
  currentId.value = (route.query.flyer as string) && versions.value.some(v => v.id === route.query.flyer)
    ? String(route.query.flyer)
    : versions.value[versions.value.length - 1]?.id ?? null
  step.value = 'result'
}
const FIXES = ['Person lower', 'Bigger date', 'Bigger names', 'Less busy', 'Brighter']
const chosenFixes = ref<string[]>([])
const fixNote = ref('')
const fixError = ref<string | null>(null)
async function paintAgain() {
  const notes = [...chosenFixes.value, fixNote.value.trim()].filter(Boolean).join('. ')
  if (!notes) { fixError.value = 'Pick a change or write what should be different.'; return }
  if (!current.value) return
  fixError.value = null
  try {
    const { id: fid } = await $trpc.businessFlyers.fix.mutate({ flyerId: current.value.id, notes })
    chosenFixes.value = []
    fixNote.value = ''
    painting('Changing it…')
    watchBatch(batchId.value!, () => { currentId.value = fid; step.value = 'result' })
  } catch (e: any) {
    fixError.value = e?.message || 'Couldn’t paint it again.'
  }
}
const download = (url: string) => url.replace('/upload/', '/upload/fl_attachment/')

// ---------------------------------------------------------------- keep
const keeping = ref(false)
// A look already saved (made in it, or refreshing a kept flyer) → keep and go back.
const hasLook = computed(() => !!savedLookId.value || refreshing.value || !!st.value?.kept?.lookId)
async function choose() {
  if (!current.value) return
  if (!hasLook.value) { look.name = current.value.lookName || look.name; go('save'); return }
  await keep()
}
async function keep(lookName?: string) {
  keeping.value = true
  error.value = null
  try {
    await $trpc.businessFlyers.keep.mutate({ flyerId: current.value!.id, lookName })
    if (lookName) go('done')
    else await navigateTo(editor.value)
  } catch (e: any) {
    error.value = e?.message || 'Couldn’t keep the flyer.'
  } finally {
    keeping.value = false
  }
}
const lookNameError = ref<string | null>(null)
function keepLook() {
  if (!look.name.trim()) { lookNameError.value = 'Give the look a name.'; return }
  void keep(look.name.trim())
}

// ---------------------------------------------------------------- load
onMounted(async () => {
  try {
    ;[ev.value, st.value] = await Promise.all([
      $trpc.businessEvents.get.query({ id: id.value }),
      $trpc.businessFlyers.state.query({ eventId: id.value }),
    ])
  } catch (e: any) {
    loadError.value = e?.message || 'Could not load this event.'
    return
  }
  const b = route.query.batch as string | undefined
  if (b) {
    batchId.value = b
    await pollOnce()
    const isDirections = rows.value.some(r => r.mode === 'direction')
    const busy = rows.value.some(r => r.status === 'painting')
    if (isDirections) {
      path.value = 'fresh'
      // Opening a version ("Change it") → straight to it; otherwise pick again.
      const f = route.query.flyer as string | undefined
      const base = rows.value.find(r => r.id === f)
      if (base) picked.value = [rows.value.find(r => r.mode === 'direction' && (r.id === f))?.id ?? f!]
      if (busy) { painting('Painting four directions…'); watchBatch(b, () => { step.value = picked.value.length ? 'result' : 'directions' }) }
      else if (picked.value.length) toResult()
      else step.value = 'directions'
    } else if (busy) {
      painting(refreshing.value ? 'Putting the new details on your flyer…' : 'Painting your story…')
      watchBatch(b, toResult)
    } else toResult()
  }
})
const faces = computed(() => st.value?.pictured.length ?? 0)
</script>

<template>
  <div>
    <AdminState v-if="loadError" kind="error" :message="loadError" />
    <AdminState v-else-if="!ev || !st" kind="loading" />

    <template v-else>
      <AdminPageHeader :eyebrow="ev.host?.name || 'Event'" :title="`Flyer · ${ev.name}`" :back="{ to: editor, label: 'Back to the event' }" />
      <p class="mt-1 text-sm text-muted-foreground"><CalendarDays class="inline size-4" aria-hidden="true" /> {{ ev.date.split('-').reverse().join('.') }} · {{ ev.startTime }}{{ ev.endTime ? `–${ev.endTime}` : '' }}</p>

      <details class="mt-3 max-w-xl rounded-xl border bg-card px-3 py-2 text-xs">
        <summary class="cursor-pointer"><span class="font-bold text-wd-green-700"><Check class="inline size-3.5" aria-hidden="true" /> Details checked</span> <span class="text-muted-foreground">· {{ st.lines.length }} lines go on the flyer · {{ faces ? `pictured: ${st.pictured.slice(0, 2).join(', ')}` : 'names only' }}</span></summary>
        <ul class="mt-2 grid gap-0.5"><li v-for="t in st.lines" :key="t">{{ t }}</li></ul>
        <NuxtLink :to="editor" class="mt-2 inline-flex items-center gap-1 font-bold text-secondary hover:underline"><Pencil class="size-3" aria-hidden="true" /> Change in the event</NuxtLink>
      </details>

      <ol v-if="!refreshing" class="mt-5 flex flex-wrap gap-2 text-xs" aria-label="Steps">
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
      <AdminState v-if="error" kind="error" :message="error" />

      <!-- Ask -->
      <section v-if="step === 'ask'" class="mt-6">
        <template v-if="st.looks.length">
          <h2 class="font-display text-2xl font-bold">Make it in your look?</h2>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <button
              v-for="l in st.looks"
              :key="l.id"
              type="button"
              class="rounded-2xl border-2 bg-card p-5 text-left transition-colors hover:border-primary/50 focus-visible:shadow-wd-focus"
              @click="makeInSavedLook(l.id)"
            >
              <Palette class="size-6 text-primary" aria-hidden="true" />
              <p class="mt-2 font-display text-lg font-bold">{{ l.name }}</p>
              <p class="mt-1 line-clamp-3 text-sm text-muted-foreground">{{ l.description }}</p>
            </button>
          </div>
          <p class="mt-6 text-sm font-bold">Or a new look</p>
        </template>
        <h2 v-else class="font-display text-2xl font-bold">Have you made flyers for {{ ev.host?.name || 'this event' }} before?</h2>
        <p v-if="!st.looks.length" class="mt-1 text-sm text-muted-foreground">In Canva, Photoshop, or anywhere else. They tell us how your flyers should look.</p>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <button type="button" class="rounded-2xl border-2 bg-card p-5 text-left transition-colors hover:border-primary/50 focus-visible:shadow-wd-focus" @click="path = 'yes'; go('upload')">
            <Upload class="size-6 text-primary" aria-hidden="true" />
            <p class="mt-2 font-display text-lg font-bold">{{ st.looks.length ? 'From flyers I’ve made' : 'Yes, I have some' }}</p>
            <p class="mt-1 text-sm text-muted-foreground">Add 2–5 flyers you’ve posted. We’ll keep your look.</p>
          </button>
          <button type="button" class="rounded-2xl border-2 bg-card p-5 text-left transition-colors hover:border-primary/50 focus-visible:shadow-wd-focus" @click="path = 'fresh'; go('brief')">
            <Sparkles class="size-6 text-primary" aria-hidden="true" />
            <p class="mt-2 font-display text-lg font-bold">{{ st.looks.length ? 'Something new' : 'No, start fresh' }}</p>
            <p class="mt-1 text-sm text-muted-foreground">Tell us the feeling. We’ll show you four directions.</p>
          </button>
        </div>
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
          <div v-for="n in uploading" :key="`up-${n}`" class="flex aspect-[4/5] items-center justify-center rounded-xl border bg-muted"><Loader2 class="size-5 animate-spin text-muted-foreground" aria-hidden="true" /></div>
          <label v-if="uploads.length + uploading < 5" class="flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input text-center text-xs text-muted-foreground hover:border-primary/50 has-[:focus-visible]:shadow-wd-focus">
            <ImagePlus class="size-5" aria-hidden="true" /> Add flyers
            <input type="file" accept="image/*" multiple class="sr-only" @change="addFiles">
          </label>
        </div>
        <p v-if="uploadError" class="mt-2 text-sm text-destructive" role="alert">{{ uploadError }}</p>
        <div class="mt-6 flex gap-2">
          <Button variant="outline-pill" @click="back"><ArrowLeft /> Back</Button>
          <Button variant="pill" :disabled="uploading > 0" @click="readStyle">Read my style <ArrowRight /></Button>
        </div>
      </section>

      <!-- 1a · Reading -->
      <section v-else-if="step === 'reading'" class="mt-10 flex flex-col items-center text-center" role="status">
        <Loader2 class="size-8 animate-spin text-primary" aria-hidden="true" />
        <p class="mt-3 font-display text-xl font-bold">Reading your flyers…</p>
        <p class="mt-1 text-sm text-muted-foreground">The scene, colours, lettering and layout. About 10 seconds.</p>
      </section>

      <!-- 1a · The look, read back -->
      <section v-else-if="step === 'look'" class="mt-6">
        <h2 class="font-display text-2xl font-bold">This is how your flyers look</h2>
        <p class="mt-1 text-sm text-muted-foreground">Change anything that’s wrong. Your flyer is painted from this.</p>
        <div class="mt-4 grid gap-4 sm:grid-cols-[1fr_200px]">
          <div class="rounded-2xl border bg-card p-4">
            <Field id="look-text" label="The look" :error="lookError ?? undefined">
              <Textarea v-model="look.description" :rows="6" />
            </Field>
            <p class="mt-4 text-sm font-bold">Colours</p>
            <div class="mt-2 flex flex-wrap gap-2">
              <span v-for="(c, i) in look.palette" :key="c.hex + i" class="inline-flex items-center gap-1.5 rounded-full border bg-card py-1 pl-1 pr-1.5 text-xs">
                <span class="size-5 rounded-full border" :style="{ background: c.hex }" /> {{ c.name }}
                <button type="button" class="rounded-full p-0.5 text-muted-foreground hover:text-foreground" :aria-label="`Remove ${c.name}`" @click="look.palette.splice(i, 1)"><X class="size-3" /></button>
              </span>
              <span v-if="!look.palette.length" class="text-xs text-muted-foreground">No fixed colours: they come from the look.</span>
            </div>
          </div>
          <div>
            <p class="text-xs font-bold text-muted-foreground">From your flyers</p>
            <div class="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-1">
              <img v-for="u in uploads.slice(0, 2)" :key="u.url" :src="u.url" alt="" class="w-full rounded-xl border">
            </div>
          </div>
        </div>
        <div class="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="outline-pill" @click="back"><ArrowLeft /> Back</Button>
          <Button variant="cta" @click="makeFromLook"><Wand2 /> That’s us · make the flyer</Button>
          <span class="text-xs text-muted-foreground">About a minute.</span>
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
              <Button v-for="f in FEELING" :key="f" size="sm" :variant="feeling.includes(f) ? 'soft' : 'outline'" :aria-pressed="feeling.includes(f)" :disabled="!feeling.includes(f) && feeling.length >= 3" @click="toggle(feeling, f); briefError = null">{{ f }}</Button>
            </div>
          </div>
          <div>
            <p class="text-sm font-bold">A flyer you like <span class="font-normal text-muted-foreground">(optional, anyone’s)</span></p>
            <p class="text-xs text-muted-foreground">For the mood only: its words and people aren’t copied.</p>
            <div class="mt-2 flex items-center gap-3">
              <img v-if="liked" :src="liked" alt="The flyer you like" class="h-24 rounded-lg border">
              <label class="flex h-24 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input text-center text-[11px] text-muted-foreground has-[:focus-visible]:shadow-wd-focus">
                <Loader2 v-if="likedUploading" class="size-4 animate-spin" aria-hidden="true" /><ImagePlus v-else class="size-4" aria-hidden="true" /> {{ liked ? 'Change' : 'Add' }}
                <input type="file" accept="image/*" class="sr-only" @change="addLiked">
              </label>
            </div>
          </div>
        </div>
        <p v-if="briefError" class="mt-2 text-sm text-destructive" role="alert">{{ briefError }}</p>
        <div class="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="outline-pill" @click="back"><ArrowLeft /> Back</Button>
          <Button variant="cta" :disabled="likedUploading" @click="showDirections"><Wand2 /> Show me 4 directions</Button>
          <span class="text-xs text-muted-foreground">About two minutes.</span>
        </div>
      </section>

      <!-- Painting -->
      <section v-else-if="step === 'painting'" class="mt-10 flex flex-col items-center text-center" role="status">
        <Loader2 class="size-8 animate-spin text-primary" aria-hidden="true" />
        <p class="mt-3 font-display text-xl font-bold">{{ paintMsg }}</p>
        <p class="mt-1 text-sm text-muted-foreground">{{ paintMsg.includes('four') ? 'Four at once: about two minutes.' : 'Usually under a minute.' }} You can leave this page: the event page shows it when it’s done.</p>
      </section>

      <!-- 1b · Four directions -->
      <section v-else-if="step === 'directions'" class="mt-6">
        <h2 class="font-display text-2xl font-bold">Four directions for {{ ev.name }}</h2>
        <p class="mt-1 text-sm text-muted-foreground">Pick one or two you like. You can change them next.</p>
        <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <template v-for="d in directions" :key="d.id">
            <button
              v-if="d.status === 'ready'"
              type="button"
              class="overflow-hidden rounded-2xl border-2 bg-card text-left focus-visible:shadow-wd-focus"
              :class="picked.includes(d.id) ? 'border-primary' : 'border-transparent'"
              :aria-pressed="picked.includes(d.id)"
              @click="pick(d.id)"
            >
              <img :src="d.url!" :alt="d.lookName || 'Direction'" class="aspect-[9/16] w-full object-cover">
              <span class="flex items-center gap-1 p-2 text-sm font-bold"><Check v-if="picked.includes(d.id)" class="size-4 text-primary" aria-hidden="true" /> {{ d.lookName }}</span>
            </button>
            <div v-else class="flex aspect-[9/16] flex-col items-center justify-center rounded-2xl border bg-muted p-3 text-center text-xs text-muted-foreground">
              <AlertTriangle class="size-5" aria-hidden="true" />
              <p class="mt-1 font-bold">{{ d.lookName }} didn’t work</p>
              <p class="mt-0.5">{{ d.error }}</p>
            </div>
          </template>
        </div>
        <p v-if="pickError" class="mt-2 text-sm text-destructive" role="alert">{{ pickError }}</p>
        <div class="mt-6 flex flex-wrap gap-2">
          <Button variant="outline-pill" @click="showDirections"><RotateCcw /> Show 4 more</Button>
          <Button variant="pill" @click="useDirections">Use {{ picked.length === 2 ? 'these' : 'this' }} <ArrowRight /></Button>
        </div>
      </section>

      <!-- Result -->
      <section v-else-if="step === 'result'" class="mt-6">
        <div v-if="!current" class="rounded-2xl border bg-card p-5">
          <p class="font-bold">This flyer didn’t work.</p>
          <p v-for="f in failed" :key="f.id" class="mt-1 text-sm text-muted-foreground">{{ f.error }}</p>
          <Button variant="pill" class="mt-3" as-child><NuxtLink :to="editor">Back to the event</NuxtLink></Button>
        </div>
        <template v-else>
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h2 class="font-display text-2xl font-bold">{{ refreshing ? 'Your flyer, with the new details' : 'Your flyer' }}</h2>
            <div v-if="versions.length > 1" class="flex flex-wrap gap-1" role="group" aria-label="Versions">
              <Button v-for="(v, i) in versions" :key="v.id" size="sm" :variant="current.id === v.id ? 'soft' : 'ghost'" :aria-pressed="current.id === v.id" @click="currentId = v.id">Version {{ i + 1 }}</Button>
            </div>
          </div>
          <div class="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]">
            <figure class="mx-auto w-full max-w-sm">
              <img :src="current.url!" alt="Instagram story flyer" class="w-full rounded-xl border">
              <figcaption class="mt-1.5 text-xs"><span class="font-bold">Instagram story</span> <span class="text-muted-foreground">1080×1920</span><template v-if="current.notes"> · <span class="text-muted-foreground">changed: {{ current.notes }}</span></template></figcaption>
            </figure>
            <div class="grid content-start gap-4">
              <div v-if="current.check?.ok" class="rounded-2xl bg-success/10 p-4">
                <p class="flex items-center gap-1.5 text-sm font-bold text-wd-green-700"><Check class="size-4" aria-hidden="true" /> Every word matches your event</p>
                <details class="mt-1">
                  <summary class="cursor-pointer text-xs text-muted-foreground">What we checked</summary>
                  <ul class="mt-1 grid gap-0.5 text-xs"><li v-for="c in st.lines" :key="c">✓ {{ c }}</li></ul>
                </details>
                <p v-if="current.check.extra.length" class="mt-2 text-xs text-muted-foreground">Also on it: {{ current.check.extra.join(' · ') }}</p>
              </div>
              <div v-else class="rounded-2xl bg-warning/10 p-4">
                <p class="flex items-center gap-1.5 text-sm font-bold"><AlertTriangle class="size-4" aria-hidden="true" /> We couldn’t read every line</p>
                <ul class="mt-1 grid gap-0.5 text-xs"><li v-for="m in current.check?.missing ?? []" :key="m">✗ {{ m }}</li></ul>
                <p class="mt-2 text-xs text-muted-foreground">It may be fine and just hard to read. Check it, or ask for a change below (e.g. “Bigger date”).</p>
              </div>
              <div class="rounded-2xl border bg-card p-4">
                <p class="text-sm font-bold">Want something different?</p>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  <Button v-for="f in FIXES" :key="f" size="sm" :variant="chosenFixes.includes(f) ? 'soft' : 'outline'" :aria-pressed="chosenFixes.includes(f)" @click="toggle(chosenFixes, f); fixError = null">{{ f }}</Button>
                </div>
                <Input v-model="fixNote" class="mt-2" placeholder="Or say it: less neon, warmer light" aria-label="What should be different" @input="fixError = null" />
                <p v-if="fixError" class="mt-1 text-xs text-destructive" role="alert">{{ fixError }}</p>
                <Button variant="outline-pill" size="pill-sm" class="mt-3" @click="paintAgain"><Wand2 /> Paint again</Button>
                <p class="mt-1 text-xs text-muted-foreground">Changes this version and keeps it, so you can compare. A different photo or wording? <NuxtLink :to="editor" class="font-bold text-secondary hover:underline">Change it in the event</NuxtLink>.</p>
              </div>
              <div class="flex flex-wrap gap-2">
                <Button variant="ghost" size="sm" as-child><a :href="download(current.url!)" download><Download /> Download</a></Button>
              </div>
              <Button variant="pill" :loading="keeping" @click="choose">{{ hasLook ? 'Use this flyer' : 'This is the one' }} <ArrowRight /></Button>
            </div>
          </div>
        </template>
      </section>

      <!-- Keep the look -->
      <section v-else-if="step === 'save'" class="mt-6 max-w-xl">
        <h2 class="font-display text-2xl font-bold">Use this look for {{ ev.host?.name || 'your events' }} from now on?</h2>
        <p class="mt-1 text-sm text-muted-foreground">Next time starts from it: you only change the details.</p>
        <div class="mt-4 flex items-center gap-4 rounded-2xl border bg-card p-4">
          <img :src="current!.url!" alt="" class="h-28 rounded-lg border">
          <Field id="look-name" label="Call this look" class="flex-1" :error="lookNameError ?? undefined">
            <Input v-model="look.name" @input="lookNameError = null" />
          </Field>
        </div>
        <div class="mt-6 flex gap-2">
          <Button variant="outline-pill" @click="back"><ArrowLeft /> Back</Button>
          <Button variant="pill" :loading="keeping" @click="keepLook">Yes, keep it</Button>
        </div>
      </section>

      <!-- Done -->
      <section v-else-if="step === 'done'" class="mt-8 max-w-xl">
        <PartyPopper class="size-8 text-primary" aria-hidden="true" />
        <h2 class="mt-2 font-display text-2xl font-bold">Your flyer is ready</h2>
        <p class="mt-1 text-sm text-muted-foreground">It’s on the event now, and “{{ look.name }}” is your look. Change the details later and the event tells you the flyer is out of date, then refreshes it in this look.</p>
        <BusinessCaption :event-id="id" class="mt-6" />
        <div class="mt-6 flex flex-wrap gap-2">
          <Button variant="pill" as-child><NuxtLink :to="editor">Back to the event <ArrowRight /></NuxtLink></Button>
          <Button variant="outline-pill" as-child><a :href="download(current!.url!)" download><Download /> Download</a></Button>
        </div>
      </section>
    </template>
  </div>
</template>
