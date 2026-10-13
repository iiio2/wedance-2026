<script setup lang="ts">
/**
 * Prototype — the line-up picker for a flyer. Same search + "add from Instagram"
 * as BusinessProfilePicker, but on a local mock catalogue (no tRPC). Under each
 * artist: pick which of their photos goes on the flyer, upload another, or
 * "name only" (no picture).
 */
import type { PropType } from 'vue'
import { X, Instagram, ImagePlus, Check, Type } from 'lucide-vue-next'

type SketchArtist = { username: string; name: string; role: string; photos: string[] }
type LineupEntry = { username: string; name: string; role: string; photo: number | null; own: string | null }

const props = defineProps({
  catalogue: { type: Array as PropType<SketchArtist[]>, required: true },
  img: { type: Function as PropType<(path: string, w?: number) => string>, required: true },
})
const model = defineModel<LineupEntry[]>({ required: true })

const extra = ref<SketchArtist[]>([])
const all = computed(() => [...props.catalogue, ...extra.value])
const byName = (u: string) => all.value.find(a => a.username === u)

const q = ref('')
const open = ref(false)
const results = computed(() => {
  const t = q.value.trim().toLowerCase().replace(/^@/, '')
  if (t.length < 2 || /instagram\.com\//.test(t)) return []
  return all.value.filter(a => !model.value.some(e => e.username === a.username)
    && (a.name.toLowerCase().includes(t) || a.username.includes(t)))
})
const looksLikeInstagram = computed(() => /instagram\.com\/|^@[a-z0-9._]{2,30}$/i.test(q.value.trim()))
const igHandle = computed(() => q.value.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').replace(/^@/, '').replace(/\/.*$/, ''))

function add(a: SketchArtist) {
  model.value = [...model.value, { username: a.username, name: a.name, role: a.role, photo: a.photos.length ? 0 : null, own: null }]
  q.value = ''
  open.value = false
}
function addFromInstagram() {
  const h = igHandle.value.toLowerCase()
  if (!byName(h)) extra.value.push({ username: h, name: h.replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), role: 'Artist', photos: [] })
  add(byName(h)!)
}
function remove(u: string) { model.value = model.value.filter(e => e.username !== u) }
function upload(e: LineupEntry, ev: Event) {
  const f = (ev.target as HTMLInputElement).files?.[0]
  if (f) { e.own = URL.createObjectURL(f); e.photo = -1 }
}
const avatar = (e: LineupEntry) => {
  const a = byName(e.username)
  return e.photo === -1 ? e.own : a?.photos.length ? props.img(a.photos[e.photo ?? 0]!, 80) : null
}
</script>

<template>
  <div>
    <div class="relative">
      <Input v-model="q" placeholder="Search artists, or paste their Instagram" autocomplete="off" @focus="open = true" @input="open = true" @keydown.esc="open = false" />
      <div v-if="open && q.trim().length >= 2 && !looksLikeInstagram" class="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border bg-card shadow-wd-card">
        <button v-for="r in results" :key="r.username" type="button" class="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/50" @click="add(r)">
          <img v-if="r.photos.length" :src="img(r.photos[0]!, 80)" alt="" class="size-8 rounded-lg object-cover">
          <span v-else class="size-8 rounded-lg bg-muted" />
          <span class="min-w-0">
            <span class="block truncate text-sm font-bold">{{ r.name }}</span>
            <span class="block truncate text-xs text-muted-foreground">@{{ r.username }} · {{ r.role }}</span>
          </span>
        </button>
        <p v-if="!results.length" class="px-3 py-2 text-xs text-muted-foreground">Not on WeDance? Paste their Instagram link or @handle.</p>
      </div>
    </div>
    <Button v-if="looksLikeInstagram && igHandle" type="button" variant="soft" size="sm" class="mt-2" @click="addFromInstagram">
      <Instagram /> Add @{{ igHandle }} from Instagram
    </Button>

    <ul class="mt-3 grid gap-3">
      <li v-for="e in model" :key="e.username" class="rounded-2xl border bg-card p-3">
        <div class="flex items-center gap-3">
          <img v-if="avatar(e) && e.photo !== null" :src="avatar(e)!" alt="" class="size-9 rounded-full object-cover">
          <span v-else class="flex size-9 items-center justify-center rounded-full bg-muted"><Type class="size-4 text-muted-foreground" aria-hidden="true" /></span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-bold">{{ byName(e.username)?.name }}</p>
            <p class="truncate text-xs text-muted-foreground">@{{ e.username }}</p>
          </div>
          <Input v-model="e.role" class="h-9 w-32 text-sm" :aria-label="`Role of ${byName(e.username)?.name}`" />
          <Button variant="ghost" size="icon-sm" :aria-label="`Remove ${byName(e.username)?.name}`" @click="remove(e.username)"><X /></Button>
        </div>

        <div class="mt-3 flex flex-wrap gap-2" role="group" :aria-label="`Picture of ${byName(e.username)?.name} on the flyer`">
          <button
            v-for="(p, i) in byName(e.username)?.photos ?? []"
            :key="p"
            type="button"
            class="relative overflow-hidden rounded-xl border-2"
            :class="e.photo === i ? 'border-primary' : 'border-transparent'"
            :aria-pressed="e.photo === i"
            @click="e.photo = i"
          >
            <img :src="img(p, 200)" :alt="`${byName(e.username)?.name}, photo ${i + 1}`" class="h-24 w-[4.5rem] object-cover">
            <Check v-if="e.photo === i" class="absolute right-1 top-1 size-4 rounded-full bg-primary p-0.5 text-primary-foreground" aria-hidden="true" />
          </button>
          <button
            v-if="e.own"
            type="button"
            class="relative overflow-hidden rounded-xl border-2"
            :class="e.photo === -1 ? 'border-primary' : 'border-transparent'"
            :aria-pressed="e.photo === -1"
            @click="e.photo = -1"
          >
            <img :src="e.own" alt="Your uploaded photo" class="h-24 w-[4.5rem] object-cover">
          </button>
          <label class="flex h-24 w-[4.5rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input text-center text-[11px] text-muted-foreground hover:border-primary/50 has-[:focus-visible]:shadow-wd-focus">
            <ImagePlus class="size-4" aria-hidden="true" /> Upload
            <input type="file" accept="image/*" class="sr-only" @change="upload(e, $event)">
          </label>
          <button
            type="button"
            class="flex h-24 w-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border-2 text-center text-[11px]"
            :class="e.photo === null ? 'border-primary bg-primary/5 font-bold text-wd-red-800' : 'border-input text-muted-foreground'"
            :aria-pressed="e.photo === null"
            @click="e.photo = null"
          >
            <Type class="size-4" aria-hidden="true" /> Name only
          </button>
        </div>
        <p v-if="!byName(e.username)?.photos.length && !e.own" class="mt-1.5 text-xs text-muted-foreground">No photos on their WeDance page yet. Upload one, or keep the name only.</p>
      </li>
    </ul>
  </div>
</template>
