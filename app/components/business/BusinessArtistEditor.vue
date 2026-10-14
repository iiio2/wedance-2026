<script setup lang="ts">
/**
 * An artist's page, edited from an event's line-up: the same fields as the
 * profile editor (name, city, about, dance styles, photos, links) plus videos.
 * On a page I manage it saves directly; otherwise it goes to the artist as
 * suggestions they approve through their confirmation link.
 */
import { ImagePlus, Loader2, X, Plus, Clock, Instagram, Globe, Facebook, Send, Check } from 'lucide-vue-next'
import { videoEmbedUrl } from '#shared/utils/video'

const props = defineProps({
  eventId: { type: String, required: true },
  handle: { type: String, required: true },
})
const emit = defineEmits<{ saved: [r: { status: 'applied' | 'pending'; name: string; photos: string[]; videos: string[] }] }>()

const { $trpc } = useNuxtApp()
type P = Awaited<ReturnType<typeof $trpc.artistInvites.profile.query>>
const p = ref<P | null>(null)
const form = reactive({ name: '', city: '', bio: '', styles: [] as string[], instagram: '', website: '', facebook: '' })
const addPhotos = ref<string[]>([])
const addVideos = ref<string[]>([])
const error = ref<string | null>(null)
const saved = ref<string | null>(null)

async function load() {
  try {
    p.value = await $trpc.artistInvites.profile.query({ eventId: props.eventId, handle: props.handle })
    const v = p.value
    // A pending suggestion shows as the value (it's what was sent to them).
    const pend = (k: string) => v.pending.find(x => x.kind === k)?.value
    Object.assign(form, {
      name: pend('name') ?? v.name,
      city: pend('city') ?? v.city,
      bio: pend('bio') ?? v.bio,
      styles: pend('styles') ? JSON.parse(pend('styles')!) : [...v.styles],
      instagram: pend('instagram') ?? v.instagram,
      website: pend('website') ?? v.website,
      facebook: pend('facebook') ?? v.facebook,
    })
  } catch (e: any) {
    error.value = e?.message || 'Couldn’t load their page.'
  }
}
onMounted(load)
const pendingKinds = computed(() => new Set((p.value?.pending ?? []).map(x => x.kind)))
const waits = (k: string) => !p.value?.mine && pendingKinds.value.has(k as any)
const pendingPhotos = computed(() => (p.value?.pending ?? []).filter(x => x.kind === 'photo').map(x => x.value))
const pendingVideos = computed(() => (p.value?.pending ?? []).filter(x => x.kind === 'video').map(x => x.value))

const uploading = ref(false)
async function upload(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? []).filter(f => f.type.startsWith('image/'))
  input.value = ''
  uploading.value = true
  try {
    for (const f of files) {
      const body = new FormData()
      body.append('file', f)
      const res = await fetch('/api/media/image?folder=profiles', { method: 'POST', body })
      if (!res.ok) throw new Error()
      addPhotos.value.push((await res.json()).url)
    }
  } catch {
    error.value = 'A photo didn’t upload. Try again.'
  } finally {
    uploading.value = false
  }
}
const newVideo = ref('')
const videoError = ref<string | null>(null)
function addVideo() {
  const e = videoEmbedUrl(newVideo.value)
  if (!e) { videoError.value = 'Paste a YouTube or Vimeo link.'; return }
  videoError.value = null
  if (!addVideos.value.includes(e)) addVideos.value.push(e)
  newVideo.value = ''
}

const saving = ref(false)
async function save() {
  if (!form.name.trim()) { error.value = 'Add their name.'; return }
  saving.value = true
  error.value = null
  try {
    const r = await $trpc.artistInvites.saveProfile.mutate({
      eventId: props.eventId, handle: props.handle, ...form, name: form.name.trim(),
      addPhotos: addPhotos.value, addVideos: addVideos.value,
    })
    emit('saved', { status: r.status, name: form.name.trim(), photos: [...addPhotos.value], videos: [...addVideos.value] })
    saved.value = r.count === 0 ? 'Nothing changed.' : r.status === 'applied' ? 'Saved to their page.' : `Sent to ${form.name} to approve.`
    addPhotos.value = []
    addVideos.value = []
    await load()
  } catch (e: any) {
    error.value = e?.message || 'Couldn’t save.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="rounded-xl border bg-background/60 p-3">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <p class="text-sm font-bold">Their page <span class="font-normal text-muted-foreground">@{{ handle }}</span></p>
      <p class="text-xs text-muted-foreground">{{ !p ? '' : p.mine ? 'You manage this page: changes save directly.' : 'Changes go to them to approve.' }}</p>
    </div>
    <AdminState v-if="!p && !error" kind="loading" />
    <form v-else-if="p" class="mt-3 grid gap-3 sm:grid-cols-2" novalidate @submit.prevent="save">
      <Field :id="`ae-name-${handle}`" label="Name"><Input v-model="form.name" /></Field>
      <Field :id="`ae-city-${handle}`" label="City" optional><CityCombobox v-model="form.city" placeholder="e.g. Vienna" /></Field>
      <Field :id="`ae-bio-${handle}`" label="About" optional class="sm:col-span-2" :hint="waits('bio') ? 'Waiting for them to approve this text.' : undefined"><Textarea v-model="form.bio" :rows="3" /></Field>
      <Field label="Dance styles" class="sm:col-span-2"><DanceStylePicker v-model="form.styles" /></Field>

      <div class="sm:col-span-2">
        <p class="text-sm font-bold">Photos</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <img v-for="u in p.photos" :key="u" :src="u" alt="" class="h-20 w-16 rounded-lg border object-cover" :class="u === p.photo ? 'ring-2 ring-primary' : ''">
          <span v-for="u in pendingPhotos" :key="u" class="relative">
            <img :src="u" alt="Waiting for approval" class="h-20 w-16 rounded-lg border object-cover opacity-70">
            <Clock class="absolute bottom-1 left-1 size-4 rounded-full bg-card p-0.5 text-wd-amber-800" aria-hidden="true" />
          </span>
          <span v-for="(u, i) in addPhotos" :key="u" class="relative">
            <img :src="u" alt="New photo" class="h-20 w-16 rounded-lg border object-cover">
            <button type="button" class="absolute right-0.5 top-0.5 rounded-full bg-card/90 p-0.5" aria-label="Remove new photo" @click="addPhotos.splice(i, 1)"><X class="size-3" /></button>
          </span>
          <label class="flex h-20 w-16 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input text-center text-[10px] text-muted-foreground has-[:focus-visible]:shadow-wd-focus">
            <Loader2 v-if="uploading" class="size-4 animate-spin" aria-hidden="true" /><ImagePlus v-else class="size-4" aria-hidden="true" /> Add
            <input type="file" accept="image/*" multiple class="sr-only" @change="upload">
          </label>
        </div>
      </div>

      <div class="sm:col-span-2">
        <p class="text-sm font-bold">Videos</p>
        <ul class="mt-1 grid gap-0.5 text-xs">
          <li v-for="v in p.videos" :key="v" class="truncate text-muted-foreground">{{ v }}</li>
          <li v-for="v in pendingVideos" :key="v" class="flex items-center gap-1 truncate"><Clock class="size-3 shrink-0" aria-hidden="true" /> {{ v }}</li>
          <li v-for="(v, i) in addVideos" :key="v" class="flex items-center gap-1"><span class="truncate">{{ v }}</span><button type="button" aria-label="Remove video" @click="addVideos.splice(i, 1)"><X class="size-3" /></button></li>
        </ul>
        <div class="mt-1 flex gap-2">
          <Input v-model="newVideo" placeholder="YouTube or Vimeo link" aria-label="Add a video link" class="flex-1" @keydown.enter.prevent="addVideo" />
          <Button type="button" variant="ghost" size="sm" @click="addVideo"><Plus /> Add</Button>
        </div>
        <p v-if="videoError" class="mt-1 text-xs text-destructive" role="alert">{{ videoError }}</p>
      </div>

      <Field :id="`ae-ig-${handle}`" label="Instagram" optional>
        <div class="relative"><Instagram class="absolute left-3.5 top-3.5 size-4 text-muted-foreground" aria-hidden="true" /><Input v-model="form.instagram" class="pl-10" placeholder="instagram.com/…" /></div>
      </Field>
      <Field :id="`ae-web-${handle}`" label="Website" optional>
        <div class="relative"><Globe class="absolute left-3.5 top-3.5 size-4 text-muted-foreground" aria-hidden="true" /><Input v-model="form.website" class="pl-10" placeholder="https://…" /></div>
      </Field>
      <Field :id="`ae-fb-${handle}`" label="Facebook" optional class="sm:col-span-2">
        <div class="relative"><Facebook class="absolute left-3.5 top-3.5 size-4 text-muted-foreground" aria-hidden="true" /><Input v-model="form.facebook" class="pl-10" placeholder="facebook.com/…" /></div>
      </Field>

      <div class="flex flex-wrap items-center gap-3 sm:col-span-2">
        <Button type="submit" variant="outline-pill" size="pill-sm" :loading="saving">
          <Check v-if="p.mine" /><Send v-else /> {{ p.mine ? 'Save their page' : 'Send to them to approve' }}
        </Button>
        <span v-if="saved" class="text-xs text-wd-green-700" role="status">{{ saved }}</span>
        <span v-if="error" class="text-xs text-destructive" role="alert">{{ error }}</span>
      </div>
    </form>
    <p v-else class="mt-2 text-xs text-destructive" role="alert">{{ error }}</p>
  </div>
</template>
