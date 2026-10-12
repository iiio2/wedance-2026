<script setup lang="ts">
/**
 * Create / edit form for an event in /business. Times are the event's local
 * wall-clock time (the server converts with the city's timezone). Emits
 * `submit` with the form values; the page calls create or update.
 */
import type { PropType } from 'vue'
import { MapPin } from 'lucide-vue-next'

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
}

const props = defineProps({
  initial: { type: Object as PropType<Partial<BusinessEventValues>>, default: () => ({}) },
  /** Profiles the user manages; empty array hides the host picker (edit mode). */
  hosts: { type: Array as PropType<{ username: string; name: string }[]>, default: () => [] },
  saving: { type: Boolean, default: false },
  submitLabel: { type: String, default: 'Save' },
})
const emit = defineEmits<{ submit: [values: BusinessEventValues] }>()

const TYPES = ['Party', 'Workshop', 'Course', 'Festival', 'Weekender', 'Congress', 'Concert', 'Show']
const form = reactive<BusinessEventValues>({
  hostUsername: '', name: '', type: 'Party', date: '', startTime: '20:00', endTime: '', endDate: '',
  city: '', venueUsername: null, venueName: '', venueAddress: '', artists: [], styles: [],
  description: '', cover: '', ticketUrl: '', price: '', published: true,
  ...props.initial,
})
// Venue not on WeDance → type its name and address instead.
const venueManual = ref(!form.venueUsername && !!form.venueName)
const multiDay = ref(!!form.endDate)
const isMultiDayType = computed(() => ['Festival', 'Weekender', 'Congress'].includes(form.type))
watch(isMultiDayType, (v) => { if (v) multiDay.value = true })

// Honest Saved / Unsaved: the page resets `initial` after a save.
const snapshot = ref(JSON.stringify(form))
const dirty = computed(() => JSON.stringify(form) !== snapshot.value)
watch(() => props.initial, (v) => { Object.assign(form, v); snapshot.value = JSON.stringify(form) }, { deep: true })
defineExpose({ dirty })

const errors = reactive<Record<string, string | undefined>>({})
function validate() {
  errors.host = props.hosts.length && !form.hostUsername ? 'Pick who runs this event.' : undefined
  errors.name = form.name.trim() ? undefined : 'Add a name.'
  errors.date = form.date ? undefined : 'Pick a date.'
  errors.startTime = form.startTime ? undefined : 'Pick a start time.'
  errors.endDate = multiDay.value && form.endDate && form.endDate < form.date ? 'The last day can’t be before the first.' : undefined
  errors.ticketUrl = form.ticketUrl && !/^https?:\/\//.test(form.ticketUrl) ? 'Paste the full link, starting with https://' : undefined
  return !Object.values(errors).some(Boolean)
}
function onSubmit() {
  if (!validate()) return
  emit('submit', {
    ...form,
    endDate: multiDay.value ? form.endDate : '',
    venueUsername: venueManual.value ? null : form.venueUsername,
    venueName: venueManual.value ? form.venueName : '',
    venueAddress: venueManual.value ? form.venueAddress : '',
  })
}
</script>

<template>
  <form novalidate @submit.prevent="onSubmit">
    <section class="rounded-2xl border bg-card p-5 shadow-wd-card">
      <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">The event</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <Field v-if="hosts.length" id="ev-host" label="Run by" :error="errors.host" class="sm:col-span-2">
          <Select v-model="form.hostUsername" :options="hosts.map(h => ({ label: h.name, value: h.username }))" placeholder="Pick one of your profiles" />
        </Field>
        <Field id="ev-name" label="Name" :error="errors.name" class="sm:col-span-2">
          <Input v-model="form.name" placeholder="e.g. La Clave Thursday" />
        </Field>
        <Field id="ev-type" label="Type">
          <Select v-model="form.type" :options="TYPES" />
        </Field>
        <Field id="ev-city" label="City">
          <CityCombobox v-model="form.city" placeholder="e.g. Munich" />
        </Field>
      </div>
    </section>

    <section class="mt-4 rounded-2xl border bg-card p-5 shadow-wd-card">
      <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">When</h2>
      <div class="mt-4 grid gap-4 grid-cols-2 sm:grid-cols-4">
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
    </section>

    <section class="mt-4 rounded-2xl border bg-card p-5 shadow-wd-card">
      <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Where and who</h2>
      <div class="mt-4 grid gap-4">
        <Field label="Venue">
          <BusinessProfilePicker v-if="!venueManual" v-model="form.venueUsername" type="venue" placeholder="Search venues" />
          <div v-else class="grid gap-3 sm:grid-cols-2">
            <Input v-model="form.venueName" placeholder="Venue name" aria-label="Venue name" />
            <Input v-model="form.venueAddress" placeholder="Address" aria-label="Venue address" />
          </div>
          <button type="button" class="mt-2 inline-flex items-center gap-1 text-xs font-bold text-secondary hover:underline" @click="venueManual = !venueManual">
            <MapPin class="size-3.5" aria-hidden="true" /> {{ venueManual ? 'Pick a venue on WeDance instead' : 'Venue isn’t on WeDance? Type it in' }}
          </button>
        </Field>
        <Field label="Line-up" hint="DJs, teachers, performers. Their main photo and Instagram go on your flyers.">
          <BusinessProfilePicker v-model="form.artists" type="artist" multiple placeholder="Search artists, or paste their Instagram" />
        </Field>
        <Field label="Dance styles">
          <DanceStylePicker v-model="form.styles" />
        </Field>
      </div>
    </section>

    <section class="mt-4 rounded-2xl border bg-card p-5 shadow-wd-card">
      <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Details</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <Field id="ev-description" label="Description" optional class="sm:col-span-2">
          <Textarea v-model="form.description" placeholder="What dancers should know: music, level, dress code, what’s included." />
        </Field>
        <Field id="ev-ticket" label="Ticket link" optional :error="errors.ticketUrl" hint="For Tickettailor, use the checkout link so people land on the ticket list.">
          <Input v-model="form.ticketUrl" type="url" placeholder="https://…" />
        </Field>
        <Field id="ev-price" label="Price" optional hint="e.g. €12, €10 before 22:00, or Free.">
          <Input v-model="form.price" />
        </Field>
        <Field label="Cover photo" optional class="sm:col-span-2">
          <div class="max-w-xs">
            <ImageUpload v-model="form.cover" folder="events" />
          </div>
        </Field>
      </div>
    </section>

    <div class="mt-6 flex flex-wrap items-center gap-3">
      <label class="inline-flex items-center gap-2 text-sm font-bold">
        <Checkbox v-model="form.published" /> Published
      </label>
      <span class="text-xs text-muted-foreground">{{ form.published ? 'Dancers can see it.' : 'Only you can see it until you publish.' }}</span>
    </div>
    <div class="mt-4 flex flex-wrap items-center gap-3">
      <Button type="submit" variant="pill" :loading="saving">{{ submitLabel }}</Button>
      <span v-if="dirty && !saving" class="text-sm text-muted-foreground">Unsaved changes</span>
      <slot name="after-submit" :dirty="dirty" />
    </div>
  </form>
</template>
