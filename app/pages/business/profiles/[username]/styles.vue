<script setup lang="ts">
/**
 * /business/profiles/<handle>/styles — the profile's flyer styles (businessLooks):
 * its own (read off its flyers, kept from a painting, or written here) and
 * ideas WeDance wrote for it. Each style is the prompt its flyers are painted
 * from — edit it as text — plus its colours. "Generate more styles" writes new
 * ideas (text only: nothing is painted until one is picked on a flyer).
 */
import { Palette, Sparkles, Plus, Trash2, Copy, Check, X, Wand2, Pencil, Image as ImageIcon } from 'lucide-vue-next'

definePageMeta({ layout: 'business' })
const route = useRoute()
const { $trpc } = useNuxtApp()
const username = computed(() => String(route.params.username))

type Data = Awaited<ReturnType<typeof $trpc.businessLooks.list.query>>
type Look = Data['looks'][number]
const data = ref<Data | null>(null)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)
// Edits in progress, per style.
const drafts = reactive<Record<string, { name: string; description: string; palette: { name: string; hex: string }[] }>>({})
async function load() {
  try {
    data.value = await $trpc.businessLooks.list.query({ username: username.value })
    for (const l of data.value.looks) drafts[l.id] = { name: l.name, description: l.description, palette: l.palette.map(p => ({ ...p })) }
    error.value = null
  } catch (e: any) { error.value = e?.message || 'Couldn’t load the styles.' }
}
onMounted(load)
useHead(() => ({ title: `Styles · ${data.value?.profile.name ?? ''} | Business | WeDance` }))

const mine = computed(() => (data.value?.looks ?? []).filter(l => !l.idea))
const ideas = computed(() => (data.value?.looks ?? []).filter(l => l.idea))
const dirty = (l: Look) => { const d = drafts[l.id]; return !!d && (d.name !== l.name || d.description !== l.description || JSON.stringify(d.palette) !== JSON.stringify(l.palette)) }

// The style being edited (a dialog over the previews).
const editing = ref<string | null>(null)
const editLook = computed(() => data.value?.looks.find(l => l.id === editing.value) ?? null)
const summary = (t: string) => { const first = t.split(/(?<=\.)\s/)[0] ?? t; return first.length > 120 ? `${first.slice(0, 118).replace(/\s+\S*$/, '')}…` : first }
const swatch = (pal: { hex: string }[]) => pal.length ? `linear-gradient(135deg, ${pal.map((c, i) => `${c.hex} ${Math.round((i / Math.max(1, pal.length - 1)) * 100)}%`).join(', ')})` : undefined

const busy = ref<string | null>(null)
async function save(l: Look, keep = false) {
  const d = drafts[l.id]!
  busy.value = l.id
  error.value = null
  try {
    await $trpc.businessLooks.update.mutate({ id: l.id, name: d.name, description: d.description, palette: d.palette, keep })
    notice.value = keep ? `“${d.name}” is now one of your styles.` : `Saved “${d.name}”.`
    editing.value = null
    await load()
  } catch (e: any) { error.value = e?.message || 'Couldn’t save.' } finally { busy.value = null }
}
const confirmDelete = ref<string | null>(null)
async function remove(l: Look) {
  busy.value = l.id
  try { await $trpc.businessLooks.remove.mutate({ id: l.id }); confirmDelete.value = null; editing.value = null; notice.value = `Deleted “${l.name}”.`; await load() } catch (e: any) { error.value = e?.message || 'Couldn’t delete.' } finally { busy.value = null }
}
async function duplicate(src: { name: string; description: string; palette?: { name: string; hex: string }[] }) {
  try {
    await $trpc.businessLooks.create.mutate({ username: username.value, name: `${src.name} (copy)`.slice(0, 60), description: src.description, palette: src.palette ?? [] })
    notice.value = `Made a copy of “${src.name}”.`
    await load()
  } catch (e: any) { error.value = e?.message || 'Couldn’t copy it.' }
}
async function blank() {
  try {
    await $trpc.businessLooks.create.mutate({ username: username.value, name: 'New style', description: 'Describe the scene and background, the colours, the lettering of the title and the times, how people are shown, and the layout.', palette: [] })
    await load()
  } catch (e: any) { error.value = e?.message || 'Couldn’t add a style.' }
}

// --- from the organizer's own flyers (the house way)
const uploads = ref<string[]>([])
const uploading = ref(0)
const reading = ref(false)
async function addFlyers(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? []).filter(f => f.type.startsWith('image/')).slice(0, 5 - uploads.value.length)
  input.value = ''
  for (const f of files) {
    uploading.value++
    try {
      const body = new FormData()
      body.append('file', f)
      const res = await fetch('/api/media/image?folder=flyers', { method: 'POST', body })
      if (!res.ok) throw new Error()
      uploads.value.push((await res.json()).url)
    } catch { error.value = 'A flyer didn’t upload. Try again.' } finally { uploading.value-- }
  }
}
async function readStyle() {
  reading.value = true
  error.value = null
  try {
    const l = await $trpc.businessLooks.read.mutate({ username: username.value, urls: uploads.value })
    uploads.value = []
    notice.value = `Read “${l.name}” off your flyers. Check the prompt and save.`
    await load()
    editing.value = l.id
  } catch (e: any) { error.value = e?.message || 'Couldn’t read the flyers.' } finally { reading.value = false }
}

// --- generate
const FEELING = ['Warm', 'Bold', 'Street', 'Vintage', 'Tropical', 'Elegant', 'Club', 'Minimal']
const feeling = ref<string[]>([])
const generating = ref(false)
async function generate() {
  generating.value = true
  error.value = null
  try {
    const r = await $trpc.businessLooks.generate.mutate({ username: username.value, feelings: feeling.value, count: 4 })
    notice.value = `${r.length} new ${r.length === 1 ? 'style' : 'styles'} below. Paint one from a flyer’s “Something new”.`
    await load()
  } catch (e: any) { error.value = e?.message || 'Couldn’t come up with styles.' } finally { generating.value = false }
}

// --- colours
// The picked colour, read off the colour input (it starts on its own default).
function addColour(id: string) {
  const hex = (document.getElementById(`look-colour-${id}`) as HTMLInputElement | null)?.value
  if (hex) drafts[id]!.palette.push({ name: hex, hex })
}
</script>

<template>
  <div>
    <AdminState v-if="!data && !error" kind="loading" />
    <AdminState v-else-if="!data" kind="error" :message="error!" />
    <template v-else>
      <AdminPageHeader
        eyebrow="Styles"
        :title="data.profile.name"
        description="The looks your flyers are painted in. Each one is the prompt WeDance paints from: change the words, and the next flyers change."
        :back="{ to: `/business/profiles/${data.profile.username}`, label: 'The profile' }"
      />
      <AdminState v-if="error" kind="error" :message="error" />
      <p v-if="notice" role="status" class="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-success/10 px-3 py-2 text-sm font-bold text-wd-green-700"><Check class="size-4" aria-hidden="true" /> {{ notice }}</p>

      <!-- From your flyers: the house way to a style -->
      <section class="mt-6 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-card to-secondary/10 p-5">
        <p class="flex items-center gap-1.5 text-eyebrow font-bold uppercase tracking-[0.3em] text-primary"><ImageIcon class="size-4" aria-hidden="true" /> A style from your flyers</p>
        <p class="mt-1 font-display text-xl font-bold">Add 2–5 flyers you’ve posted</p>
        <p class="mt-1 text-sm text-muted-foreground">WeDance reads the scene, colours and lettering, and every new flyer in this style is painted with your flyers as its reference, so it looks like yours.</p>
        <div class="mt-3 flex flex-wrap items-center gap-2">
          <img v-for="u in uploads" :key="u" :src="u" alt="" class="h-24 rounded-lg border">
          <span v-for="n in uploading" :key="`u${n}`" class="grid h-24 w-16 place-items-center rounded-lg border bg-muted text-xs text-muted-foreground">…</span>
          <label v-if="uploads.length + uploading < 5" class="flex h-24 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input text-center text-[11px] text-muted-foreground has-[:focus-visible]:shadow-wd-focus">
            <Plus class="size-4" aria-hidden="true" /> Add flyers
            <input type="file" accept="image/*" multiple class="sr-only" @change="addFlyers">
          </label>
        </div>
        <Button variant="cta" class="mt-4" :disabled="!uploads.length || uploading > 0" :loading="reading" @click="readStyle"><Wand2 /> Read my style</Button>
      </section>

      <!-- Ideas: written, not read -->
      <section class="mt-4 rounded-2xl border bg-card p-5">
        <p class="flex items-center gap-1.5 text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary"><Sparkles class="size-4" aria-hidden="true" /> No flyers yet?</p>
        <p class="mt-1 font-display text-lg font-bold">Ideas to try</p>
        <p class="mt-1 text-sm text-muted-foreground">Written from your music and city. Paint one for a flyer: the one you keep becomes your style, with that flyer as its reference.</p>
        <div class="mt-3 flex flex-wrap gap-1.5">
          <Button v-for="f in FEELING" :key="f" type="button" size="sm" :variant="feeling.includes(f) ? 'soft' : 'outline'" :aria-pressed="feeling.includes(f)" @click="feeling = feeling.includes(f) ? feeling.filter(x => x !== f) : [...feeling, f]">{{ f }}</Button>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          <Button variant="outline-pill" :loading="generating" @click="generate"><Wand2 /> Write 4 ideas</Button>
          <Button variant="outline-pill" @click="blank"><Plus /> Write one yourself</Button>
        </div>
      </section>

      <!-- Styles: yours, then ideas -->
      <template v-for="group in [{ title: 'Your styles', hint: 'Read off your flyers, kept from a painting, or written here.', list: mine }, { title: 'Ideas', hint: 'Written for you. Paint one from a flyer, or keep it as your own.', list: ideas }]" :key="group.title">
        <section v-if="group.list.length" class="mt-8">
          <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">{{ group.title }}</h2>
          <p class="text-sm text-muted-foreground">{{ group.hint }}</p>
          <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <article v-for="l in group.list" :key="l.id" class="flex flex-col overflow-hidden rounded-2xl border bg-card">
              <button type="button" class="relative block aspect-[4/5] w-full overflow-hidden bg-muted" :aria-label="`Edit ${l.name}`" @click="editing = l.id">
                <img v-if="l.preview" :src="l.preview" :alt="`A flyer in ${l.name}`" class="size-full object-cover">
                <span v-else class="flex size-full flex-col items-center justify-center gap-2 p-4 text-center" :style="{ background: swatch(l.palette) }">
                  <span class="rounded-xl bg-card/85 px-3 py-2 font-display text-lg font-bold leading-tight">{{ l.name }}</span>
                  <span v-if="!l.palette.length" class="flex items-center gap-1 text-xs text-muted-foreground"><ImageIcon class="size-3.5" aria-hidden="true" /> Not painted yet</span>
                </span>
                <span v-if="l.idea" class="absolute left-2 top-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Idea</span>
              </button>
              <div class="flex flex-1 flex-col p-3">
                <p class="font-bold leading-snug">{{ l.name }}</p>
                <p class="mt-0.5 line-clamp-3 flex-1 text-xs text-muted-foreground">{{ summary(l.description) }}</p>
                <div v-if="l.palette.length" class="mt-2 flex gap-1" :aria-label="`Colours: ${l.palette.map(c => c.name).join(', ')}`">
                  <span v-for="c in l.palette" :key="c.hex" class="size-4 rounded-full border" :style="{ background: c.hex }" :title="c.name" />
                </div>
                <div class="mt-2 flex flex-wrap items-center gap-1">
                  <Button type="button" variant="outline" size="sm" @click="editing = l.id"><Pencil /> Edit</Button>
                  <Button v-if="l.idea" type="button" variant="ghost" size="sm" :loading="busy === l.id" @click="save(l, true)"><Check /> Keep</Button>
                </div>
                <p v-if="l.flyers" class="mt-1 text-[11px] text-muted-foreground">{{ l.flyers }} {{ l.flyers === 1 ? 'flyer' : 'flyers' }} painted in it</p>
              </div>
            </article>
          </div>
        </section>
      </template>

      <!-- Editing one style -->
      <Dialog :open="!!editLook" @update:open="v => { if (!v) { editing = null; confirmDelete = null } }">
        <DialogContent v-if="editLook && drafts[editLook.id]" class="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle class="flex items-center gap-2"><Palette class="size-5 text-primary" aria-hidden="true" /> {{ editLook.name }}</DialogTitle>
            <DialogDescription>The prompt is what WeDance tells the painter. The event’s words, people and shape are added for each flyer.</DialogDescription>
          </DialogHeader>
          <div class="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <div class="grid content-start gap-3">
              <Field :id="`look-name-${editLook.id}`" label="Name"><Input v-model="drafts[editLook.id]!.name" /></Field>
              <Field :id="`look-prompt-${editLook.id}`" label="The prompt">
                <Textarea v-model="drafts[editLook.id]!.description" :rows="10" class="font-mono text-xs leading-relaxed" />
              </Field>
            </div>
            <img v-if="editLook.preview" :src="editLook.preview" alt="" class="hidden w-full rounded-xl border sm:block">
          </div>
          <div>
            <p class="text-sm font-bold">Colours</p>
            <div class="mt-1.5 flex flex-wrap items-center gap-2">
              <span v-for="(c, i) in drafts[editLook.id]!.palette" :key="c.hex + i" class="inline-flex items-center gap-1.5 rounded-full border bg-card py-1 pl-1 pr-1.5 text-xs">
                <span class="size-5 rounded-full border" :style="{ background: c.hex }" />
                <input v-model="c.name" class="w-24 bg-transparent outline-none" :aria-label="`Colour ${i + 1} name`">
                <button type="button" class="rounded-full p-0.5 text-muted-foreground hover:text-foreground" :aria-label="`Remove ${c.name}`" @click="drafts[editLook.id]!.palette.splice(i, 1)"><X class="size-3" /></button>
              </span>
              <span class="inline-flex items-center gap-1">
                <input :id="`look-colour-${editLook.id}`" type="color" class="h-7 w-9 cursor-pointer rounded border" aria-label="Pick a colour">
                <Button type="button" variant="ghost" size="sm" @click="addColour(editLook.id)"><Plus /> Colour</Button>
              </span>
            </div>
          </div>
          <div v-if="editLook.references.length">
            <p class="text-sm font-bold">Read from</p>
            <div class="mt-1.5 flex gap-2"><img v-for="r in editLook.references.slice(0, 5)" :key="r.url" :src="r.url" alt="A flyer it was read from" class="h-20 rounded-md border"></div>
          </div>
          <div class="flex flex-wrap items-center gap-2 border-t pt-3">
            <Button type="button" variant="pill" size="pill-sm" :disabled="!dirty(editLook)" :loading="busy === editLook.id" @click="save(editLook)">Save</Button>
            <Button v-if="editLook.idea" type="button" variant="outline-pill" size="pill-sm" :loading="busy === editLook.id" @click="save(editLook, true)"><Check /> Keep as mine</Button>
            <Button type="button" variant="ghost" size="sm" @click="duplicate({ name: drafts[editLook.id]!.name, description: drafts[editLook.id]!.description, palette: drafts[editLook.id]!.palette })"><Copy /> Duplicate</Button>
            <span class="flex-1" />
            <template v-if="confirmDelete === editLook.id">
              <span class="text-sm">Delete it?</span>
              <Button type="button" variant="destructive" size="sm" :loading="busy === editLook.id" @click="remove(editLook)">Yes, delete</Button>
              <Button type="button" variant="ghost" size="sm" @click="confirmDelete = null">Keep it</Button>
            </template>
            <Button v-else type="button" variant="ghost" size="sm" class="text-destructive" @click="confirmDelete = editLook.id"><Trash2 /> Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      <!-- Built-in -->
      <section class="mt-8">
        <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Built in</h2>
        <p class="text-sm text-muted-foreground">WeDance’s four starting points. Copy one to make it yours and change it.</p>
        <div class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <article v-for="b in data.builtIn" :key="b.name" class="flex flex-col rounded-2xl border bg-card p-3">
            <p class="font-bold">{{ b.name }}</p>
            <p class="text-xs text-muted-foreground">{{ b.hint }}</p>
            <details class="mt-1 flex-1 text-xs text-muted-foreground"><summary class="cursor-pointer font-bold text-secondary">The prompt</summary><p class="mt-1">{{ b.description }}</p></details>
            <Button type="button" variant="outline" size="sm" class="mt-2 self-start" @click="duplicate(b)"><Copy /> Make it mine</Button>
          </article>
        </div>
      </section>
    </template>
  </div>
</template>
