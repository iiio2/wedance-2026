<script setup lang="ts">
/**
 * The event's content plan (businessPosts): every post it's promoted with —
 * the flyer, one per artist, the line-up, passes, programme, countdown, last
 * tickets, thank you — with its date, its flyer and where it stands. Empty
 * plan → the pitch and "Make my content plan" (lists the posts, paints
 * nothing). Each post opens the flyer page for it; nothing paints until asked.
 *
 *   <BusinessContentPlan :event-id="ev.id" @go="t => …" />
 *
 * `go` asks the page to open a post's flyer (saving the details first).
 */
import { Sparkles, Wand2, Plus, X, Check, Clock, AlertTriangle, Loader2, CalendarDays, Image as ImageIcon, RefreshCw, Download } from 'lucide-vue-next'
import type { PropType } from 'vue'
import { POST_KINDS, type PostKind } from '#shared/utils/posts'
import { LANGUAGES } from '#shared/utils/caption'

const props = defineProps({
  eventId: { type: String, required: true },
  /** Line-up handles → names, for "Add a post · artist". */
  lineup: { type: Array as PropType<{ username: string; name: string }[]>, default: () => [] },
})
const emit = defineEmits<{ go: [target: { postId: string; action: 'make' | 'open' | 'refresh'; batchId?: string }]; changed: [] }>()

const { $trpc } = useNuxtApp()
type Post = Awaited<ReturnType<typeof $trpc.businessPosts.list.query>>[number]
const posts = ref<Post[] | null>(null)
const error = ref<string | null>(null)
async function load() {
  try {
    posts.value = await $trpc.businessPosts.list.query({ eventId: props.eventId })
    error.value = null
  } catch (e: any) {
    error.value = e?.message || 'Couldn’t load the content plan.'
  }
}
onMounted(load)
defineExpose({ reload: load })
// Poll while something paints.
let timer: ReturnType<typeof setInterval> | undefined
watch(posts, (p) => {
  clearInterval(timer)
  if (p?.some(x => x.painting)) timer = setInterval(load, 5000)
})
onBeforeUnmount(() => clearInterval(timer))

const live = computed(() => (posts.value ?? []).filter(p => p.status !== 'dropped'))
// Only the event's flyer, no date yet: the plan hasn't been made.
const empty = computed(() => live.value.length <= 1 && !live.value[0]?.dueOn)
const ready = computed(() => live.value.filter(p => p.flyer && !p.flyer.stale && !p.waitingFor).length)
const next = computed(() => live.value.find(p => p.status === 'planned'))

const proposing = ref(false)
const drafted = ref<string | null>(null)
async function propose() {
  proposing.value = true
  error.value = null
  drafted.value = null
  try {
    const r = await $trpc.businessPosts.propose.mutate({ eventId: props.eventId })
    drafted.value = r.added
      ? `Drafted ${r.added} ${r.added === 1 ? 'post' : 'posts'} with dates. Change, drop or add any.`
      : 'Your plan already has every post WeDance suggests for this event.'
    await load()
    emit('changed')
  } catch (e: any) {
    error.value = e?.message || 'Couldn’t make the plan.'
  } finally {
    proposing.value = false
  }
}

async function update(p: Post, set: { dueOn?: string | null; format?: 'post' | 'story'; status?: 'planned' | 'posted' | 'dropped' }) {
  try {
    await $trpc.businessPosts.update.mutate({ id: p.id, ...set })
    await load()
    emit('changed')
  } catch (e: any) { error.value = e?.message || 'Couldn’t save.' }
}
async function remove(p: Post) {
  try { await $trpc.businessPosts.remove.mutate({ id: p.id }); await load(); emit('changed') } catch (e: any) { error.value = e?.message || 'Couldn’t remove it.' }
}

// --- captions: one language for the plan, and "write the missing ones"
const language = ref('en+de')
watch(posts, (p) => { const l = p?.find(x => x.caption)?.caption?.language; if (l) language.value = l }, { once: true })
const missingCaptions = computed(() => live.value.filter(p => !p.caption).length)
const writingAll = ref(false)
async function writeAll() {
  writingAll.value = true
  error.value = null
  drafted.value = null
  try {
    const r = await $trpc.businessPosts.writeCaptions.mutate({ eventId: props.eventId, language: language.value })
    drafted.value = `Wrote ${r.written} ${r.written === 1 ? 'caption' : 'captions'}${r.failed ? `; ${r.failed} didn’t work, try those again` : ''}.`
    await load()
  } catch (e: any) {
    error.value = e?.message || 'Couldn’t write the captions.'
  } finally {
    writingAll.value = false
  }
}

// --- add a post
const adding = ref(false)
const add = reactive({ kind: 'artist' as PostKind, subject: '', dueOn: '' })
const kindOptions = (Object.keys(POST_KINDS) as PostKind[]).filter(k => k !== 'announcement').map(k => ({ label: POST_KINDS[k].label, value: k }))
async function addPost() {
  try {
    await $trpc.businessPosts.add.mutate({ eventId: props.eventId, kind: add.kind, subject: add.kind === 'artist' ? add.subject : null, dueOn: add.dueOn || null, format: 'post' })
    adding.value = false
    add.subject = ''
    await load()
    emit('changed')
  } catch (e: any) { error.value = e?.message || 'Couldn’t add it.' }
}

function open(p: Post) {
  if (p.painting) return emit('go', { postId: p.id, action: 'open', batchId: p.painting.batchId })
  if (p.flyer?.stale) return emit('go', { postId: p.id, action: 'refresh' })
  emit('go', { postId: p.id, action: p.flyer ? 'open' : 'make' })
}

const title = (p: Post) => p.kind === 'artist' ? (p.subjectName || p.subject || 'Artist') : p.kind === 'announcement' ? 'The flyer' : p.label
const fmtDay = (d: string | null) => d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }) : 'No date'
type Tone = 'done' | 'ready' | 'warn' | 'wait' | 'busy' | 'plain'
const state = (p: Post): { text: string; tone: Tone } => {
  if (p.status === 'posted') return { text: 'Posted', tone: 'done' }
  if (p.painting) return { text: 'Painting…', tone: 'busy' }
  if (p.flyer?.stale) return { text: 'Out of date', tone: 'warn' }
  if (p.waitingFor) return { text: p.flyer ? `Ready · waiting for ${p.waitingFor}’s OK` : `Waiting for ${p.waitingFor}’s OK`, tone: 'wait' }
  if (p.flyer) return { text: 'Ready to post', tone: 'ready' }
  return { text: 'Planned', tone: 'plain' }
}
const TONE: Record<Tone, string> = { done: 'text-muted-foreground', ready: 'text-wd-green-700', warn: 'text-wd-amber-600', wait: 'text-secondary', busy: 'text-secondary', plain: 'text-muted-foreground' }
const download = (url: string) => url.replace('/upload/', '/upload/fl_attachment/')
</script>

<template>
  <div class="grid gap-4">
    <AdminState v-if="error" kind="error" :message="error" />
    <AdminState v-if="!posts && !error" kind="loading" />

    <!-- The pitch: no plan yet -->
    <section v-else-if="posts && empty" class="overflow-hidden rounded-2xl border bg-card shadow-wd-card">
      <div class="bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-6 sm:p-8">
        <p class="flex items-center gap-1.5 text-eyebrow font-bold uppercase tracking-[0.3em] text-primary"><Sparkles class="size-4" aria-hidden="true" /> Content plan</p>
        <h2 class="mt-2 font-display text-3xl font-bold leading-tight">Every post for your event, made for you</h2>
        <p class="mt-2 max-w-xl text-sm text-muted-foreground">
          WeDance paints your whole campaign in your look: the flyer, one announcement per artist, the line-up poster, the programme, passes and a countdown. Every word on every poster is read back and checked, so names and dates are spelled right.
        </p>
        <ul class="mt-4 grid gap-1.5 text-sm sm:grid-cols-2">
          <li class="flex items-start gap-2"><Check class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> A plan with dates, from launch to the thank-you</li>
          <li class="flex items-start gap-2"><Check class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> Posts and stories in the same look</li>
          <li class="flex items-start gap-2"><Check class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> Artists approve their own post first</li>
          <li class="flex items-start gap-2"><Check class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" /> You decide each one: nothing is posted for you</li>
        </ul>
        <div class="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="cta" :loading="proposing" @click="propose"><Wand2 /> Draft my content plan</Button>
          <Button v-if="live[0]" variant="ghost" @click="open(live[0])">{{ live[0].flyer ? 'Open the flyer' : 'Just the flyer for now' }}</Button>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">Drafting lists the posts with dates, from the line-up, passes and programme. Each one is painted only when you click it.</p>
      </div>
    </section>

    <!-- The plan -->
    <template v-else-if="posts">
      <section class="rounded-2xl border bg-card p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p class="flex items-center gap-1.5 text-sm font-bold"><Sparkles class="size-4 text-primary" aria-hidden="true" /> {{ ready }} of {{ live.length }} posts ready</p>
            <p v-if="next" class="text-xs text-muted-foreground">Next: {{ title(next) }} · {{ fmtDay(next.dueOn) }}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button type="button" variant="soft" size="sm" :loading="proposing" title="Adds the posts WeDance suggests that aren’t in the plan yet: new artists, passes, programme…" @click="propose"><Wand2 /> Draft the content plan</Button>
            <Button type="button" variant="outline" size="sm" @click="adding = !adding"><Plus /> Add a post</Button>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap items-center gap-2 border-t pt-3 text-sm">
          <span class="text-muted-foreground">Captions in</span>
          <div class="w-48"><Select v-model="language" :options="LANGUAGES.map(l => ({ label: l.label, value: l.value }))" size="sm" aria-label="Caption language" /></div>
          <Button v-if="missingCaptions" type="button" variant="outline" size="sm" :loading="writingAll" @click="writeAll"><Wand2 /> Write the {{ missingCaptions }} missing {{ missingCaptions === 1 ? 'caption' : 'captions' }}</Button>
          <span v-else class="text-xs text-wd-green-700">Every post has its caption.</span>
        </div>
        <p v-if="drafted" class="mt-2 text-sm text-wd-green-700" role="status">{{ drafted }}</p>
        <div v-if="adding" class="mt-3 grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_10rem_auto] sm:items-end">
          <Field id="add-kind" label="Post"><Select v-model="add.kind" :options="kindOptions" /></Field>
          <Field v-if="add.kind === 'artist'" id="add-artist" label="Artist"><Select v-model="add.subject" :options="[{ label: 'Pick from the line-up', value: '' }, ...lineup.map(a => ({ label: a.name, value: a.username }))]" /></Field>
          <div v-else />
          <Field id="add-date" label="When" optional><Input v-model="add.dueOn" type="date" /></Field>
          <Button type="button" variant="pill" size="pill-sm" :disabled="add.kind === 'artist' && !add.subject" @click="addPost">Add</Button>
        </div>
      </section>

      <ul class="grid grid-cols-1 gap-2">
        <li v-for="p in posts" :key="p.id" class="flex min-w-0 gap-3 rounded-2xl border bg-card p-3" :class="p.status === 'dropped' ? 'opacity-50' : ''">
          <button type="button" class="relative shrink-0 overflow-hidden rounded-lg border bg-muted" :class="p.format === 'story' ? 'h-24 w-[3.4rem]' : 'h-24 w-[4.8rem]'" :aria-label="`Open ${title(p)}`" @click="open(p)">
            <img v-if="p.flyer?.url" :src="p.flyer.url" alt="" class="size-full object-cover">
            <img v-else-if="p.subjectPhoto" :src="p.subjectPhoto" alt="" class="size-full object-cover opacity-40 grayscale">
            <span v-else class="grid size-full place-items-center"><ImageIcon class="size-5 text-muted-foreground" aria-hidden="true" /></span>
            <span v-if="p.painting" class="absolute inset-0 grid place-items-center bg-card/60"><Loader2 class="size-5 animate-spin text-secondary" aria-hidden="true" /></span>
          </button>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold uppercase tracking-wider text-secondary">{{ p.kind === 'artist' ? 'Artist announcement' : p.label }}</p>
            <p class="font-bold leading-snug">{{ title(p) }}</p>
            <p class="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span class="inline-flex items-center gap-1 font-bold" :class="TONE[state(p).tone]">
                <AlertTriangle v-if="state(p).tone === 'warn'" class="size-3.5" aria-hidden="true" />
                <Clock v-else-if="state(p).tone === 'wait'" class="size-3.5" aria-hidden="true" />
                <Check v-else-if="state(p).tone === 'ready' || state(p).tone === 'done'" class="size-3.5" aria-hidden="true" />
                {{ state(p).text }}
              </span>
              <span v-if="!p.inLineup" class="text-destructive">Not in the line-up any more</span>
            </p>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <label class="inline-flex items-center gap-1 text-muted-foreground"><CalendarDays class="size-3.5" aria-hidden="true" />
                <input type="date" :value="p.dueOn ?? ''" class="rounded-md border bg-background px-1.5 py-0.5 text-foreground" :aria-label="`Date for ${title(p)}`" @change="update(p, { dueOn: ($event.target as HTMLInputElement).value || null })">
              </label>
              <div class="inline-flex overflow-hidden rounded-md border" role="group" :aria-label="`Shape of ${title(p)}`">
                <button v-for="f in (['post', 'story'] as const)" :key="f" type="button" class="px-2 py-0.5" :class="p.format === f ? 'bg-secondary/15 font-bold' : ''" :aria-pressed="p.format === f" @click="p.format !== f && update(p, { format: f })">{{ f === 'post' ? 'Post 4:5' : 'Story 9:16' }}</button>
              </div>
            </div>
            <BusinessPostCaption v-if="p.status !== 'dropped'" :post-id="p.id" :caption="p.caption" :language="language" @changed="load" />
          </div>
          <div class="flex shrink-0 flex-col items-end gap-1.5">
            <!-- The next post due leads; the rest wait their turn. -->
            <Button v-if="p.status !== 'dropped'" type="button" size="sm" :variant="(p.flyer && !p.flyer.stale) || p.id !== next?.id ? 'outline' : 'pill'" @click="open(p)">
              <template v-if="p.painting"><Loader2 class="animate-spin" /> See it</template>
              <template v-else-if="p.flyer?.stale"><RefreshCw /> Refresh</template>
              <template v-else-if="p.flyer">Open</template>
              <template v-else><Wand2 /> Make it</template>
            </Button>
            <a v-if="p.flyer?.url" :href="download(p.flyer.url)" class="inline-flex items-center gap-1 text-xs font-bold text-secondary hover:underline"><Download class="size-3.5" aria-hidden="true" /> Download</a>
            <button v-if="p.flyer && p.status !== 'posted' && p.status !== 'dropped'" type="button" class="text-xs text-muted-foreground hover:underline" @click="update(p, { status: 'posted' })">Mark posted</button>
            <button v-else-if="p.status === 'posted'" type="button" class="text-xs text-muted-foreground hover:underline" @click="update(p, { status: 'planned' })">Not posted yet</button>
            <button v-if="p.kind !== 'announcement'" type="button" class="inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-destructive" :aria-label="`Remove ${title(p)}`" @click="p.status === 'dropped' ? update(p, { status: 'planned' }) : (p.versions ? update(p, { status: 'dropped' }) : remove(p))">
              <X class="size-3.5" aria-hidden="true" /> {{ p.status === 'dropped' ? 'Bring back' : 'Drop' }}
            </button>
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>
