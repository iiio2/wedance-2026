<script setup lang="ts">
/**
 * The event's line-up: a card per artist, collapsed. Edit opens "On this
 * event" (which photo the flyer uses, or "Name only") and their page — the
 * profile editor's fields (BusinessArtistEditor) — plus a personal link to send them.
 *
 *   <BusinessLineupPicker v-model="form.artists" v-model:photos="form.photos"
 *     v-model:names="form.names" :videos="form.festival?.videos" :event-id="id" />
 *
 * What the organizer adds here shows on this event straight away, and goes to
 * the artist's own page as a suggestion (artistInvites.suggest) until they
 * approve it through the link. `photos`: handle → URL, or null for name only;
 * no entry = their main photo.
 */
import type { PropType } from 'vue'
import { X, Check, Type, Send, Clock, Pencil, ChevronUp } from 'lucide-vue-next'

const artists = defineModel<string[]>({ default: () => [] })
const photos = defineModel<Record<string, string | null>>('photos', { default: () => ({}) })
const names = defineModel<Record<string, string>>('names', { default: () => ({}) })
const props = defineProps({
  placeholder: { type: String as PropType<string>, default: 'Search artists, or paste their Instagram' },
  /** A festival's videos (handle → embed URL), edited in place; absent for ordinary events. */
  videos: { type: Object as PropType<Record<string, string>>, default: undefined },
  /** The saved event: suggestions and links need it. */
  eventId: { type: String, default: undefined },
})

const { $trpc } = useNuxtApp()
type Person = { username: string; name: string | null; photos: string[]; styles: string[] }
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

// What's waiting for each artist to approve.
type Answer = { status: string; programmeOk: boolean | null; programmeNote: string | null; postsOk: boolean; message: string | null; respondedAt: string | Date | null } | null
type Pending = Record<string, { photos: string[]; videos: string[]; name: string | null; fields: string[]; answer: Answer }>
const pending = ref<Pending>({})
async function loadPending() {
  if (!props.eventId || !artists.value.length) return
  try { pending.value = await $trpc.artistInvites.pending.query({ eventId: props.eventId, handles: artists.value }) } catch { /* chips stay hidden */ }
}
const error = ref<string | null>(null)
// After `pending` exists: loading runs right away.
watch(artists, h => { load(h); loadPending() }, { immediate: true })

// Photos: theirs, then any uploaded here (pending on their page), then this event's own.
const choice = (h: string) => (h in photos.value ? photos.value[h] : (people.value.get(h)?.photos[0] ?? null))
const options = (h: string) => {
  const list = [...(people.value.get(h)?.photos ?? []), ...(pending.value[h]?.photos ?? [])]
  const own = photos.value[h]
  return [...new Set(own ? [...list, own] : list)]
}
const isPending = (h: string, url: string) => !!pending.value[h]?.photos.includes(url)
const pick = (h: string, url: string | null) => (photos.value = { ...photos.value, [h]: url })
function remove(h: string) {
  artists.value = artists.value.filter(a => a !== h)
  const { [h]: _p, ...restP } = photos.value
  photos.value = restP
  const { [h]: _n, ...restN } = names.value
  names.value = restN
  if (props.videos) delete props.videos[h]
}

// Name: this event uses theirs, or the one sent to them while they haven't approved it.
const nameOf = (h: string) => names.value[h] || people.value.get(h)?.name || '@' + h
const open = ref<string | null>(null)
async function onSaved(h: string, r: { status: 'applied' | 'pending'; name: string; photos: string[]; videos: string[] }) {
  const next = { ...names.value }
  if (r.status === 'pending' && r.name !== people.value.get(h)?.name) next[h] = r.name
  else delete next[h]
  names.value = next
  // A festival shows a new video right away; a single new photo becomes this event's.
  if (props.videos && r.videos[0]) props.videos[h] = r.videos[0]
  if (r.photos.length === 1) pick(h, r.photos[0]!)
  // Their page changed: reload names, photos and what's waiting.
  const m = new Map(people.value)
  m.delete(h)
  people.value = m
  await load([h])
  await loadPending()
}

// "Confirm": the popup with their personal link and a message to send.
const confirming = ref<string | null>(null)
// Their answer on the link: in or not, programme, posts.
function answerOf(h: string): { tone: 'success' | 'warning' | 'danger' | 'neutral'; text: string; detail?: string } {
  const a = pending.value[h]?.answer
  if (!a) return { tone: 'neutral', text: 'Not asked yet' }
  if (a.status === 'declined') return { tone: 'danger', text: 'Can’t make it', detail: a.message || undefined }
  if (a.status !== 'confirmed') return { tone: 'neutral', text: 'Asked, no answer yet' }
  const notes = [a.programmeOk === false && `Programme: ${a.programmeNote}`, a.message].filter(Boolean).join(' · ')
  return { tone: a.programmeOk === false ? 'warning' : 'success', text: a.programmeOk === false ? 'Confirmed · programme needs a change' : 'Confirmed', detail: notes || (a.postsOk ? undefined : 'Hasn’t OK’d posts with their photo yet') }
}

const FIELD: Record<string, string> = { bio: 'about', city: 'city', styles: 'styles', instagram: 'Instagram', website: 'website', facebook: 'Facebook' }
const waiting = (h: string) => {
  const p = pending.value[h]
  if (!p) return ''
  return [p.name && `name “${p.name}”`, p.photos.length && `${p.photos.length} photo${p.photos.length > 1 ? 's' : ''}`, p.videos.length && 'video', ...p.fields.map(f => FIELD[f] ?? f)]
    .filter(Boolean).join(', ')
}
</script>

<template>
  <div>
    <BusinessProfilePicker v-model="artists" type="artist" multiple hide-selected :placeholder="placeholder" />
    <p v-if="error" class="mt-1 text-xs font-bold text-destructive" role="alert">{{ error }}</p>

    <ul v-if="artists.length" class="mt-3 grid gap-2">
      <li v-for="h in artists" :key="h" class="rounded-2xl border bg-card">
        <!-- Collapsed: who, and what's waiting on them -->
        <div class="flex flex-wrap items-center gap-3 p-3">
          <img v-if="choice(h)" :src="choice(h)!" alt="" class="size-10 rounded-full object-cover">
          <span v-else class="flex size-10 items-center justify-center rounded-full bg-muted"><Type class="size-4 text-muted-foreground" aria-hidden="true" /></span>
          <div class="min-w-[10rem] flex-1">
            <p class="truncate text-sm font-bold">{{ nameOf(h) }}</p>
            <p class="truncate text-xs text-muted-foreground">@{{ h }}<template v-if="people.get(h)?.styles?.length"> · {{ people.get(h)!.styles.slice(0, 4).join(', ') }}</template><template v-if="choice(h) === null"> · name only</template></p>
            <p v-if="eventId" class="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <AdminStatus :tone="answerOf(h).tone">{{ answerOf(h).text }}</AdminStatus>
              <span v-if="answerOf(h).detail" class="text-muted-foreground">{{ answerOf(h).detail }}</span>
            </p>
            <p v-if="waiting(h)" class="mt-1 inline-flex items-center gap-1 text-xs text-wd-amber-800"><Clock class="size-3" aria-hidden="true" /> Waiting for them: {{ waiting(h) }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <Button type="button" variant="ghost" size="sm" :aria-expanded="open === h" @click="open = open === h ? null : h">
              <template v-if="open === h"><ChevronUp /> Close</template><template v-else><Pencil /> Edit</template>
            </Button>
            <Button v-if="eventId" type="button" variant="outline-pill" size="pill-sm" :title="`Ask ${nameOf(h)} to confirm their details`" @click="confirming = h">
              <Send /> Confirm
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" :aria-label="`Remove ${nameOf(h)}`" @click="remove(h)"><X /></Button>
          </div>
        </div>

        <!-- Expanded: this event's photo, and their page -->
        <div v-if="open === h" class="grid gap-3 border-t p-3">
          <div>
            <p class="text-sm font-bold">On this event</p>
            <p class="text-xs text-muted-foreground">The photo the flyer and the page use, or the name only.</p>
            <div class="mt-2 flex flex-wrap gap-2" role="group" :aria-label="`Picture of ${nameOf(h)} on this event`">
              <button
                v-for="(url, i) in options(h)"
                :key="url"
                type="button"
                class="relative overflow-hidden rounded-xl border-2 focus-visible:shadow-wd-focus"
                :class="choice(h) === url ? 'border-primary' : 'border-transparent'"
                :aria-pressed="choice(h) === url"
                @click="pick(h, url)"
              >
                <img :src="url" :alt="`${nameOf(h)}, photo ${i + 1}${isPending(h, url) ? ' (waiting for approval)' : ''}`" class="h-24 w-[4.5rem] object-cover">
                <Check v-if="choice(h) === url" class="absolute right-1 top-1 size-4 rounded-full bg-primary p-0.5 text-primary-foreground" aria-hidden="true" />
                <Clock v-if="isPending(h, url)" class="absolute bottom-1 left-1 size-4 rounded-full bg-card p-0.5 text-wd-amber-800" aria-hidden="true" />
              </button>
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
            <p v-if="!options(h).length" class="mt-1 text-xs text-muted-foreground">No photos yet: add some to their page below.</p>
          </div>
          <BusinessArtistEditor v-if="eventId" :event-id="eventId" :handle="h" @saved="(r) => onSaved(h, r)" />
          <p v-else class="text-xs text-muted-foreground">Save the event to edit their page and send them their link.</p>
        </div>
      </li>
    </ul>
    <BusinessConfirmDialog
      v-if="eventId && confirming"
      :open="!!confirming"
      :event-id="eventId"
      :handle="confirming"
      :name="nameOf(confirming)"
      @update:open="(v: boolean) => { if (!v) confirming = null }"
    />
    <p v-if="artists.length && !eventId" class="mt-2 text-xs text-muted-foreground">Save the event to send artists their confirmation links.</p>
  </div>
</template>
