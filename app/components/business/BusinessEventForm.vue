<script setup lang="ts">
/**
 * Create / edit an event in /business, as cards. Editing: each card reads like
 * the event and opens with Edit; creating: every card is open. What's here is
 * also what goes on the flyer, word for word (the flyer panel beside it shows
 * the exact lines). Times are the event's local wall-clock time (the server
 * converts with the city's timezone). Emits `submit` with the form values.
 */
import type { PropType } from 'vue'
import { MapPin, Pencil, Check, Plus, X, FileText, ListOrdered, Ticket, Users, Image as ImageIcon } from 'lucide-vue-next'
import { priceLines } from '#shared/utils/flyer'

export type BusinessEventValues = {
  hostUsername: string
  name: string
  type: string
  date: string
  startTime: string
  endTime: string
  endDate: string
  city: string
  venueUsername: string | null
  venueName: string
  venueAddress: string
  artists: string[]
  styles: string[]
  description: string
  cover: string
  ticketUrl: string
  price: string
  published: boolean
  agenda: { time: string; what: string }[]
  showAgenda: boolean
  photos: Record<string, string | null>
}

const props = defineProps({
  initial: { type: Object as PropType<Partial<BusinessEventValues>>, default: () => ({}) },
  /** Profiles the user manages; empty array hides the host picker (edit mode). */
  hosts: { type: Array as PropType<{ username: string; name: string }[]>, default: () => [] },
  saving: { type: Boolean, default: false },
  submitLabel: { type: String, default: 'Save' },
  /** 'create' opens every card; 'edit' shows them read-only with an Edit button. */
  mode: { type: String as PropType<'create' | 'edit'>, default: 'edit' },
  /** Display names for the read-only cards (the venue picker stores a handle). */
  labels: { type: Object as PropType<{ venue?: string; host?: string }>, default: () => ({}) },
})
const emit = defineEmits<{ submit: [values: BusinessEventValues] }>()

// Plain copy: the values are JSON (and reactive proxies can't be structuredClone'd).
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v))

const TYPES = ['Party', 'Workshop', 'Course', 'Festival', 'Weekender', 'Congress', 'Concert', 'Show']
const blank = (): BusinessEventValues => ({
  hostUsername: '', name: '', type: 'Party', date: '', startTime: '20:00', endTime: '', endDate: '',
  city: '', venueUsername: null, venueName: '', venueAddress: '', artists: [], styles: [],
  description: '', cover: '', ticketUrl: '', price: '', published: true,
  agenda: [], showAgenda: true, photos: {},
})
const form = reactive<BusinessEventValues>({ ...blank(), ...clone(props.initial) })
// Prices are edited one per line.
const prices = ref<string[]>(priceLines(form.price))
watch(prices, v => (form.price = v.map(p => p.trim()).filter(Boolean).join('\n')), { deep: true })

// Venue not on WeDance → type its name and address instead.
const venueManual = ref(!form.venueUsername && !!form.venueName)
const multiDay = ref(!!form.endDate)
const isMultiDayType = computed(() => ['Festival', 'Weekender', 'Congress'].includes(form.type))
watch(isMultiDayType, (v) => { if (v) multiDay.value = true })

// Honest Saved / Unsaved: the page resets `initial` after a save.
const snapshot = ref(JSON.stringify(form))
const dirty = computed(() => JSON.stringify(form) !== snapshot.value)
watch(() => props.initial, (v) => {
  Object.assign(form, blank(), clone(v))
  prices.value = priceLines(form.price)
  venueManual.value = !form.venueUsername && !!form.venueName
  multiDay.value = !!form.endDate
  snapshot.value = JSON.stringify(form)
}, { deep: true })

const open = ref(new Set<string>(props.mode === 'create' ? ['event', 'when', 'agenda', 'entry'] : []))
const isOpen = (k: string) => open.value.has(k)
function toggle(k: string) {
  const next = new Set(open.value)
  next.has(k) ? next.delete(k) : next.add(k)
  open.value = next
}

const errors = reactive<Record<string, string | undefined>>({})
function validate() {
  errors.host = props.hosts.length && !form.hostUsername ? 'Pick who runs this event.' : undefined
  errors.name = form.name.trim() ? undefined : 'Add a name.'
  errors.date = form.date ? undefined : 'Pick a date.'
  errors.startTime = form.startTime ? undefined : 'Pick a start time.'
  errors.endDate = multiDay.value && form.endDate && form.endDate < form.date ? 'The last day can’t be before the first.' : undefined
  errors.ticketUrl = form.ticketUrl && !/^https?:\/\//.test(form.ticketUrl) ? 'Paste the full link, starting with https://' : undefined
  // Open the card with the problem so it can be seen.
  const card: Record<string, string> = { host: 'event', name: 'event', date: 'when', startTime: 'when', endDate: 'when', ticketUrl: 'entry' }
  const next = new Set(open.value)
  for (const [k, v] of Object.entries(errors)) if (v && card[k]) next.add(card[k]!)
  open.value = next
  return !Object.values(errors).some(Boolean)
}
function submit() {
  if (!validate()) return false
  emit('submit', {
    ...clone(form),
    endDate: multiDay.value ? form.endDate : '',
    venueUsername: venueManual.value ? null : form.venueUsername,
    venueName: venueManual.value ? form.venueName : '',
    venueAddress: venueManual.value ? form.venueAddress : '',
    agenda: form.agenda.filter(a => a.what.trim()),
  })
  return true
}
defineExpose({ dirty, submit })

// Read-only summaries.
const fmtDate = (d: string) => d ? new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : ''
const whenText = computed(() => {
  const day = multiDay.value && form.endDate ? `${fmtDate(form.date)} – ${fmtDate(form.endDate)}` : fmtDate(form.date)
  return [day, [form.startTime, form.endTime].filter(Boolean).join('–')].filter(Boolean).join(' · ')
})
const venueText = computed(() => venueManual.value
  ? [form.venueName, form.venueAddress].filter(Boolean).join(' · ')
  : form.venueUsername ? (props.labels.venue || '@' + form.venueUsername) : '')
const hostText = computed(() => props.hosts.find(h => h.username === form.hostUsername)?.name || props.labels.host || '')
</script>

<template>
  <form novalidate class="grid content-start gap-3" @submit.prevent="submit">
    <!-- The event -->
    <section class="rounded-2xl border bg-card p-4">
      <div class="flex items-center justify-between gap-2">
        <h2 class="flex items-center gap-1.5 text-sm font-bold"><FileText class="size-4 text-muted-foreground" aria-hidden="true" /> The event</h2>
        <Button v-if="mode === 'edit'" type="button" variant="ghost" size="sm" :aria-expanded="isOpen('event')" @click="toggle('event')"><template v-if="isOpen('event')"><Check /> Done</template><template v-else><Pencil /> Edit</template></Button>
      </div>
      <div v-if="isOpen('event')" class="mt-3 grid gap-4 sm:grid-cols-2">
        <Field v-if="hosts.length" id="ev-host" label="Run by" :error="errors.host" class="sm:col-span-2">
          <Select v-model="form.hostUsername" :options="hosts.map(h => ({ label: h.name, value: h.username }))" placeholder="Pick one of your profiles" />
        </Field>
        <Field id="ev-name" label="Name" :error="errors.name" class="sm:col-span-2" hint="The title on the flyer.">
          <Input v-model="form.name" placeholder="e.g. La Clave Thursday" />
        </Field>
        <Field id="ev-type" label="Type">
          <Select v-model="form.type" :options="TYPES" />
        </Field>
        <Field id="ev-city" label="City">
          <CityCombobox v-model="form.city" placeholder="e.g. Munich" />
        </Field>
        <Field id="ev-description" label="Description" optional class="sm:col-span-2" hint="On the event page, not on the flyer.">
          <Textarea v-model="form.description" placeholder="What dancers should know: music, level, dress code, what’s included." />
        </Field>
      </div>
      <div v-else class="mt-1 text-sm">
        <p class="font-bold">{{ form.name || 'Untitled' }}</p>
        <p class="text-muted-foreground">{{ [form.type, form.city, hostText && `run by ${hostText}`].filter(Boolean).join(' · ') }}</p>
        <p v-if="form.description" class="mt-1 line-clamp-2 text-muted-foreground">{{ form.description }}</p>
      </div>
    </section>

    <!-- When and where -->
    <section class="rounded-2xl border bg-card p-4">
      <div class="flex items-center justify-between gap-2">
        <h2 class="flex items-center gap-1.5 text-sm font-bold"><MapPin class="size-4 text-muted-foreground" aria-hidden="true" /> When and where</h2>
        <Button v-if="mode === 'edit'" type="button" variant="ghost" size="sm" :aria-expanded="isOpen('when')" @click="toggle('when')"><template v-if="isOpen('when')"><Check /> Done</template><template v-else><Pencil /> Edit</template></Button>
      </div>
      <div v-if="isOpen('when')" class="mt-3">
        <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Field id="ev-date" :label="multiDay ? 'First day' : 'Date'" :error="errors.date" class="col-span-2">
            <Input v-model="form.date" type="date" />
          </Field>
          <Field id="ev-start" label="Starts" :error="errors.startTime">
            <Input v-model="form.startTime" type="time" />
          </Field>
          <Field id="ev-end" label="Ends" optional hint="Past midnight is fine.">
            <Input v-model="form.endTime" type="time" />
          </Field>
          <Field v-if="multiDay" id="ev-end-date" label="Last day" :error="errors.endDate" class="col-span-2">
            <Input v-model="form.endDate" type="date" :min="form.date" />
          </Field>
        </div>
        <label class="mt-3 inline-flex items-center gap-2 text-sm">
          <Checkbox v-model="multiDay" /> Runs over several days
        </label>
        <p class="mt-1 text-xs text-muted-foreground">Times are local to the event’s city.</p>
        <Field label="Venue" class="mt-4">
          <BusinessProfilePicker v-if="!venueManual" v-model="form.venueUsername" type="venue" placeholder="Search venues" />
          <div v-else class="grid gap-3 sm:grid-cols-2">
            <Input v-model="form.venueName" placeholder="Venue name" aria-label="Venue name" />
            <Input v-model="form.venueAddress" placeholder="Address" aria-label="Venue address" />
          </div>
          <button type="button" class="mt-2 inline-flex items-center gap-1 text-xs font-bold text-secondary hover:underline" @click="venueManual = !venueManual">
            <MapPin class="size-3.5" aria-hidden="true" /> {{ venueManual ? 'Pick a venue on WeDance instead' : 'Venue isn’t on WeDance? Type it in' }}
          </button>
        </Field>
      </div>
      <p v-else class="mt-1 text-sm">
        {{ whenText || 'No date yet' }}<br>
        <span class="text-muted-foreground">{{ venueText || 'No venue yet' }}</span>
      </p>
    </section>

    <!-- Agenda -->
    <section class="rounded-2xl border bg-card p-4">
      <div class="flex items-center justify-between gap-2">
        <h2 class="flex items-center gap-1.5 text-sm font-bold"><ListOrdered class="size-4 text-muted-foreground" aria-hidden="true" /> Agenda <span class="font-normal text-muted-foreground">(optional)</span></h2>
        <Button v-if="mode === 'edit'" type="button" variant="ghost" size="sm" :aria-expanded="isOpen('agenda')" @click="toggle('agenda')"><template v-if="isOpen('agenda')"><Check /> Done</template><template v-else><Pencil /> Edit</template></Button>
      </div>
      <div v-if="isOpen('agenda')" class="mt-3 grid gap-2">
        <div v-for="(a, i) in form.agenda" :key="i" class="flex gap-2">
          <Input v-model="a.time" class="w-24" placeholder="19:00" :aria-label="`Time, line ${i + 1}`" />
          <Input v-model="a.what" class="flex-1" placeholder="Bachata workshop · Alösha" :aria-label="`What happens, line ${i + 1}`" />
          <Button type="button" variant="ghost" size="icon-sm" :aria-label="`Remove line ${i + 1}`" @click="form.agenda.splice(i, 1)"><X /></Button>
        </div>
        <Button type="button" variant="ghost" size="sm" class="justify-self-start" @click="form.agenda.push({ time: '', what: '' })"><Plus /> Add a line</Button>
      </div>
      <ul v-else-if="form.agenda.length" class="mt-1 grid gap-0.5 text-sm">
        <li v-for="(a, i) in form.agenda" :key="i"><span class="font-bold tabular-nums">{{ a.time }}</span> {{ a.what }}</li>
      </ul>
      <p v-else class="mt-1 text-sm text-muted-foreground">Workshops, show, DJ sets: what happens when.</p>
      <label v-if="form.agenda.length" class="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><Checkbox v-model="form.showAgenda" /> Put the agenda on the flyer</label>
    </section>

    <!-- Entry and tickets -->
    <section class="rounded-2xl border bg-card p-4">
      <div class="flex items-center justify-between gap-2">
        <h2 class="flex items-center gap-1.5 text-sm font-bold"><Ticket class="size-4 text-muted-foreground" aria-hidden="true" /> Entry and tickets</h2>
        <Button v-if="mode === 'edit'" type="button" variant="ghost" size="sm" :aria-expanded="isOpen('entry')" @click="toggle('entry')"><template v-if="isOpen('entry')"><Check /> Done</template><template v-else><Pencil /> Edit</template></Button>
      </div>
      <div v-if="isOpen('entry')" class="mt-3 grid gap-2">
        <p class="text-xs text-muted-foreground">One price per line, e.g. “Free until 21:00”, “From 21:00 · 10€”.</p>
        <div v-for="(_, i) in prices" :key="i" class="flex gap-2">
          <Input v-model="prices[i]" class="flex-1" :aria-label="`Price, line ${i + 1}`" />
          <Button type="button" variant="ghost" size="icon-sm" :aria-label="`Remove price line ${i + 1}`" @click="prices.splice(i, 1)"><X /></Button>
        </div>
        <Button type="button" variant="ghost" size="sm" class="justify-self-start" @click="prices.push('')"><Plus /> Add a price</Button>
        <Field id="ev-ticket" label="Ticket link" optional :error="errors.ticketUrl" class="mt-2" hint="For Tickettailor, use the checkout link so people land on the ticket list.">
          <Input v-model="form.ticketUrl" type="url" placeholder="https://…" />
        </Field>
      </div>
      <div v-else class="mt-1 text-sm">
        <p>{{ prices.filter(Boolean).join(' · ') || 'No price yet' }}</p>
        <p class="truncate text-xs text-muted-foreground">{{ form.ticketUrl ? `Tickets: ${form.ticketUrl}` : 'No ticket link' }}</p>
      </div>
    </section>

    <!-- Music -->
    <section class="rounded-2xl border bg-card p-4">
      <Field id="ev-styles" label="The music">
        <DanceStylePicker v-model="form.styles" />
      </Field>
    </section>

    <!-- Line-up -->
    <section class="rounded-2xl border bg-card p-4">
      <h2 class="flex items-center gap-1.5 text-sm font-bold"><Users class="size-4 text-muted-foreground" aria-hidden="true" /> Line-up</h2>
      <p class="text-xs text-muted-foreground">DJs, teachers, performers. Everyone is named on the flyer. Pick the photo it uses, or “Name only”.</p>
      <BusinessLineupPicker v-model="form.artists" v-model:photos="form.photos" class="mt-3" />
    </section>

    <!-- Cover -->
    <section class="rounded-2xl border bg-card p-4">
      <h2 class="flex items-center gap-1.5 text-sm font-bold"><ImageIcon class="size-4 text-muted-foreground" aria-hidden="true" /> Cover photo <span class="font-normal text-muted-foreground">(optional)</span></h2>
      <p class="text-xs text-muted-foreground">The picture on the event page and in search. Leave it empty and your flyer becomes the cover.</p>
      <div class="mt-3 max-w-xs">
        <ImageUpload v-model="form.cover" folder="events" />
      </div>
    </section>

    <div class="mt-3 flex flex-wrap items-center gap-3">
      <label class="inline-flex items-center gap-2 text-sm font-bold">
        <Checkbox v-model="form.published" /> Published
      </label>
      <span class="text-xs text-muted-foreground">{{ form.published ? 'Dancers can see it.' : 'Only you can see it until you publish.' }}</span>
    </div>
    <div class="flex flex-wrap items-center gap-3">
      <Button type="submit" variant="pill" :loading="saving">{{ submitLabel }}</Button>
      <span v-if="dirty && !saving" class="text-sm text-muted-foreground">Unsaved changes</span>
      <slot name="after-submit" :dirty="dirty" />
    </div>
  </form>
</template>
