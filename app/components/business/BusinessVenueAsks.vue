<script setup lang="ts">
/**
 * Asking venues to host an event, in the editor's "Where": the venues asked
 * and their answers side by side (can host · another date · can't, with their
 * terms), Book one, and the Ask popup (what you need → their link and a
 * message to paste). The venue answers on /confirm/<token>.
 *
 *   <BusinessVenueAsks ref="asks" v-model:asked="asked" :event-id="eventId" @booked="v => …" />
 *   asks.value.open({ username, name })
 */
import type { PropType } from 'vue'
import { Check, Copy, Link2, MessageCircle, Send, Undo2, CalendarClock, X } from 'lucide-vue-next'
import { VENUE_NEEDS, VENUE_ANSWER_LABEL, type VenueAnswer } from '#shared/types/venueAsk'

// Two roots (the list and the popup): the class goes on the list.
defineOptions({ inheritAttrs: false })
const props = defineProps({
  eventId: { type: String, default: undefined },
  /** Dancers expected, to prefill the ask. */
  guests: { type: Number as PropType<number | null>, default: null },
})
/** username → answer, for the venue cards. */
const asked = defineModel<Record<string, VenueAnswer | 'booked' | 'elsewhere'>>('asked', { default: () => ({}) })
const emit = defineEmits<{ booked: [venue: { username: string; name: string }] }>()

const { $trpc } = useNuxtApp()
type Row = Awaited<ReturnType<typeof $trpc.venueAsks.list.query>>[number]
const rows = ref<Row[]>([])
const error = ref<string | null>(null)
async function refresh() {
  if (!props.eventId) return
  try {
    rows.value = await $trpc.venueAsks.list.query({ eventId: props.eventId })
    asked.value = Object.fromEntries(rows.value.map(r => [r.username, r.outcome ?? r.status]))
  } catch { /* the list stays as it was */ }
}
watch(() => props.eventId, refresh, { immediate: true })

// --- the Ask popup
const dialog = ref(false)
const venue = ref<{ username: string; name: string } | null>(null)
const request = reactive({ guests: null as number | null, needs: [] as string[], note: '' })
const link = ref<Awaited<ReturnType<typeof $trpc.venueAsks.ask.mutate>> | null>(null)
const asking = ref(false)
function open(v: { username: string; name: string }) {
  venue.value = v
  link.value = null
  error.value = null
  const r = rows.value.find(x => x.username === v.username)?.request
  request.guests = r?.guests ?? props.guests ?? null
  request.needs = [...(r?.needs ?? ['Sound system', 'Bar'])]
  request.note = r?.note ?? ''
  dialog.value = true
}
defineExpose({ open, refresh })
function toggleNeed(n: string) {
  request.needs = request.needs.includes(n) ? request.needs.filter(x => x !== n) : [...request.needs, n]
}
async function makeLink() {
  if (!props.eventId || !venue.value) return
  asking.value = true
  error.value = null
  try {
    link.value = await $trpc.venueAsks.ask.mutate({ eventId: props.eventId, venue: venue.value.username, request: { guests: request.guests || null, needs: request.needs, note: request.note } })
    await refresh()
  } catch (e: any) {
    error.value = e?.message || 'Couldn’t make the link.'
  } finally {
    asking.value = false
  }
}
const message = computed(() => link.value
  ? `Hi ${link.value.venueName}! ${link.value.host ? `This is ${link.value.host}. ` : ''}We'd love to hold ${link.value.eventName} at your place${request.guests ? ` (about ${request.guests} dancers)` : ''}. Could you tell us if you can host it, and on what terms? It takes a minute: ${link.value.url}`
  : '')
const copied = ref<'link' | 'message' | null>(null)
async function copy(what: 'link' | 'message') {
  try {
    await navigator.clipboard.writeText(what === 'link' ? link.value!.url : message.value)
    copied.value = what
    setTimeout(() => (copied.value = null), 2000)
  } catch {
    error.value = 'Copy didn’t work: select the text and copy it.'
  }
}

// --- booking
const busy = ref<string | null>(null)
async function book(r: Row) {
  if (!props.eventId) return
  busy.value = r.username
  try {
    const v = await $trpc.venueAsks.book.mutate({ eventId: props.eventId, venue: r.username })
    emit('booked', v)
    await refresh()
  } catch (e: any) { error.value = e?.message || 'Couldn’t book it.' } finally { busy.value = null }
}
async function unbook() {
  if (!props.eventId) return
  busy.value = 'unbook'
  try { await $trpc.venueAsks.unbook.mutate({ eventId: props.eventId }); await refresh() } finally { busy.value = null }
}
const bookedOne = computed(() => rows.value.find(r => r.outcome === 'booked'))

const terms = (r: Row) => {
  const t = r.terms
  if (!t) return [] as string[]
  return [
    t.rent && `Rent: ${t.rent}`,
    t.minSpend && `Minimum bar spend: ${t.minSpend}`,
    t.doorSplit && `Door: ${t.doorSplit}`,
    t.deposit && `Deposit: ${t.deposit}`,
    t.capacity && `Up to ${t.capacity} people`,
    t.includes?.length && `Includes ${t.includes.join(', ')}`,
  ].filter(Boolean) as string[]
}
const tone = (s: string) => s === 'confirmed' ? 'text-wd-green-700' : s === 'declined' ? 'text-destructive' : s === 'proposed' ? 'text-wd-amber-600' : 'text-muted-foreground'
</script>

<template>
  <div v-if="rows.length" v-bind="$attrs" class="min-w-0 rounded-xl border p-3">
    <p class="flex items-center gap-1.5 text-sm font-bold"><Send class="size-4 text-muted-foreground" aria-hidden="true" /> Venues you asked</p>
    <p class="text-xs text-muted-foreground">Their answers, side by side. Book the one you want: the others are told it went elsewhere.</p>
    <ul class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
      <li v-for="r in rows" :key="r.username" class="flex min-w-0 flex-col rounded-xl border bg-card p-3 text-sm" :class="r.outcome === 'booked' ? 'border-primary' : r.outcome === 'elsewhere' ? 'opacity-60' : ''">
        <p class="font-bold leading-snug">{{ r.name }}</p>
        <p class="text-xs font-bold" :class="tone(r.status)">
          {{ r.outcome === 'booked' ? 'Booked' : r.outcome === 'elsewhere' ? 'Told it went elsewhere' : VENUE_ANSWER_LABEL[r.status] }}
        </p>
        <p v-if="r.status === 'proposed' && r.alternative" class="mt-1 flex items-start gap-1 text-xs"><CalendarClock class="mt-0.5 size-3.5 shrink-0" aria-hidden="true" /> {{ r.alternative }}</p>
        <ul v-if="terms(r).length" class="mt-1 grid gap-0.5 text-xs">
          <li v-for="t in terms(r)" :key="t">{{ t }}</li>
        </ul>
        <p v-if="r.terms?.notes" class="mt-1 text-xs text-muted-foreground">{{ r.terms.notes }}</p>
        <p v-if="r.message" class="mt-1 text-xs italic text-muted-foreground">“{{ r.message }}”</p>
        <div class="mt-auto flex flex-wrap gap-2 pt-2">
          <Button v-if="r.outcome === 'booked'" type="button" size="sm" variant="ghost" :loading="busy === 'unbook'" @click="unbook"><Undo2 /> Undo</Button>
          <Button v-else-if="r.status === 'confirmed' || r.status === 'proposed'" type="button" size="sm" variant="outline" :disabled="!!bookedOne" :loading="busy === r.username" @click="book(r)"><Check /> Book</Button>
          <Button type="button" size="sm" variant="ghost" @click="open(r)"><Link2 /> Their link</Button>
        </div>
      </li>
    </ul>
    <p v-if="error && !dialog" class="mt-2 text-xs text-destructive" role="alert">{{ error }}</p>
  </div>

  <Dialog v-model:open="dialog">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Ask {{ venue?.name }} to host it</DialogTitle>
        <DialogDescription>They get a personal link: your event in a few lines, then they say yes, suggest another date, or no, with their terms. You see the answer here.</DialogDescription>
      </DialogHeader>
      <template v-if="!link">
        <Field id="ask-guests" label="Dancers you expect" optional>
          <Input v-model.number="request.guests" type="number" min="1" class="w-32" />
        </Field>
        <div>
          <p class="text-sm font-bold">What you need</p>
          <div class="mt-1.5 flex flex-wrap gap-1.5">
            <Button v-for="n in VENUE_NEEDS" :key="n" type="button" size="sm" :variant="request.needs.includes(n) ? 'soft' : 'outline'" :aria-pressed="request.needs.includes(n)" @click="toggleNeed(n)">{{ n }}</Button>
          </div>
        </div>
        <Field id="ask-note" label="Anything else?" optional hint="E.g. “we’d like to start with a workshop at 19:00”, “flexible on the date”.">
          <Textarea v-model="request.note" :rows="2" />
        </Field>
        <AdminState v-if="error" kind="error" :message="error" />
        <div><Button type="button" variant="pill" :loading="asking" @click="makeLink"><Link2 /> Make their link</Button></div>
      </template>
      <template v-else>
        <ol class="grid gap-1.5 text-sm">
          <li class="flex gap-2"><span class="font-bold text-secondary">1.</span> Copy the message and send it to them (below: how to reach them).</li>
          <li class="flex gap-2"><span class="font-bold text-secondary">2.</span> They answer on the link: can host · another date · no, and their terms.</li>
          <li v-if="!link.managed" class="flex gap-2"><span class="font-bold text-secondary">3.</span> Nobody runs their page yet: they can make it theirs after answering.</li>
        </ol>
        <Field id="ask-link" label="Their link">
          <div class="flex gap-2">
            <Input :model-value="link.url" readonly class="min-w-0 flex-1 font-mono text-xs" @focus="(e: FocusEvent) => (e.target as HTMLInputElement).select()" />
            <Button type="button" variant="outline-pill" size="pill-sm" @click="copy('link')"><Check v-if="copied === 'link'" /><Copy v-else /> {{ copied === 'link' ? 'Copied' : 'Copy link' }}</Button>
          </div>
        </Field>
        <Field id="ask-msg" label="A message to send">
          <Textarea :model-value="message" readonly :rows="4" class="text-sm" />
        </Field>
        <div class="flex flex-wrap gap-2">
          <Button type="button" variant="pill" @click="copy('message')"><Check v-if="copied === 'message'" /><MessageCircle v-else /> {{ copied === 'message' ? 'Copied' : 'Copy message' }}</Button>
          <Button type="button" variant="ghost" @click="link = null"><X /> Change what you asked</Button>
        </div>
        <BusinessContactLinks :contacts="link.contacts" :managed="link.managed" :answered="link.answered" :event-id="eventId" :handle="link.handle" :notified-at="link.notifiedAt" />
      </template>
    </DialogContent>
  </Dialog>
</template>
