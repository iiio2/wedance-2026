<script setup lang="ts">
/**
 * The event's line-up, and for each artist the photo the flyer uses: one of
 * their WeDance photos, one uploaded for this event, or "Name only".
 *
 *   <BusinessLineupPicker v-model="form.artists" v-model:photos="form.photos" />
 *
 * `photos` maps a handle to a URL, or null for name only. A handle with no
 * entry uses their main photo (the default for a new artist).
 */
import type { PropType } from 'vue'
import { X, ImagePlus, Check, Type, Loader2 } from 'lucide-vue-next'

const artists = defineModel<string[]>({ default: () => [] })
const photos = defineModel<Record<string, string | null>>('photos', { default: () => ({}) })
defineProps({ placeholder: { type: String as PropType<string>, default: 'Search artists, or paste their Instagram' } })

const { $trpc } = useNuxtApp()
type Person = { username: string; name: string | null; photos: string[] }
const people = ref(new Map<string, Person>())
async function load(handles: string[]) {
  const missing = handles.filter(h => !people.value.has(h))
  if (!missing.length) return
  try {
    const rows = await $trpc.businessEvents.lineupPhotos.query({ handles: missing })
    const next = new Map(people.value)
    for (const r of rows) next.set(r.username, r)
    people.value = next
  } catch { /* rows fall back to @handle, no photos */ }
}
watch(artists, h => load(h), { immediate: true })

// Unset → main photo (first one), null → name only, URL → that photo.
const choice = (h: string) => (h in photos.value ? photos.value[h] : (people.value.get(h)?.photos[0] ?? null))
const options = (h: string) => {
  const own = photos.value[h]
  const list = people.value.get(h)?.photos ?? []
  return own && !list.includes(own) ? [...list, own] : list
}
const pick = (h: string, url: string | null) => (photos.value = { ...photos.value, [h]: url })
function remove(h: string) {
  artists.value = artists.value.filter(a => a !== h)
  const { [h]: _gone, ...rest } = photos.value
  photos.value = rest
}

const uploading = ref<string | null>(null)
const uploadError = ref<string | null>(null)
async function upload(h: string, e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploading.value = h
  uploadError.value = null
  try {
    const body = new FormData()
    body.append('file', file)
    const res = await fetch('/api/media/image?folder=flyers', { method: 'POST', body })
    if (!res.ok) throw new Error()
    pick(h, (await res.json()).url)
  } catch {
    uploadError.value = 'The photo didn’t upload. Try again.'
  } finally {
    uploading.value = null
  }
}
const nameOf = (h: string) => people.value.get(h)?.name || '@' + h
</script>

<template>
  <div>
    <BusinessProfilePicker v-model="artists" type="artist" multiple hide-selected :placeholder="placeholder" />
    <p v-if="uploadError" class="mt-1 text-xs font-bold text-destructive" role="alert">{{ uploadError }}</p>

    <ul v-if="artists.length" class="mt-3 grid gap-3">
      <li v-for="h in artists" :key="h" class="rounded-2xl border bg-card p-3">
        <div class="flex items-center gap-3">
          <img v-if="choice(h)" :src="choice(h)!" alt="" class="size-9 rounded-full object-cover">
          <span v-else class="flex size-9 items-center justify-center rounded-full bg-muted"><Type class="size-4 text-muted-foreground" aria-hidden="true" /></span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-bold">{{ nameOf(h) }}</p>
            <p class="truncate text-xs text-muted-foreground">@{{ h }}</p>
          </div>
          <Button type="button" variant="ghost" size="icon-sm" :aria-label="`Remove ${nameOf(h)}`" @click="remove(h)"><X /></Button>
        </div>

        <div class="mt-3 flex flex-wrap gap-2" role="group" :aria-label="`Picture of ${nameOf(h)} on the flyer`">
          <button
            v-for="(url, i) in options(h)"
            :key="url"
            type="button"
            class="relative overflow-hidden rounded-xl border-2 focus-visible:shadow-wd-focus"
            :class="choice(h) === url ? 'border-primary' : 'border-transparent'"
            :aria-pressed="choice(h) === url"
            @click="pick(h, url)"
          >
            <img :src="url" :alt="`${nameOf(h)}, photo ${i + 1}`" class="h-24 w-[4.5rem] object-cover">
            <Check v-if="choice(h) === url" class="absolute right-1 top-1 size-4 rounded-full bg-primary p-0.5 text-primary-foreground" aria-hidden="true" />
          </button>
          <label class="flex h-24 w-[4.5rem] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input text-center text-[11px] text-muted-foreground hover:border-primary/50 has-[:focus-visible]:shadow-wd-focus">
            <Loader2 v-if="uploading === h" class="size-4 animate-spin" aria-hidden="true" />
            <ImagePlus v-else class="size-4" aria-hidden="true" />
            {{ uploading === h ? 'Uploading' : 'Upload' }}
            <input type="file" accept="image/*" class="sr-only" :disabled="uploading === h" @change="upload(h, $event)">
          </label>
          <button
            type="button"
            class="flex h-24 w-[4.5rem] flex-col items-center justify-center gap-1 rounded-xl border-2 text-center text-[11px] focus-visible:shadow-wd-focus"
            :class="choice(h) === null ? 'border-primary bg-primary/5 font-bold text-wd-red-800' : 'border-input text-muted-foreground'"
            :aria-pressed="choice(h) === null"
            @click="pick(h, null)"
          >
            <Type class="size-4" aria-hidden="true" /> Name only
          </button>
        </div>
        <p v-if="!options(h).length && people.has(h)" class="mt-1.5 text-xs text-muted-foreground">No photos on their WeDance page yet. Upload one for this event, or keep the name only.</p>
      </li>
    </ul>
  </div>
</template>
