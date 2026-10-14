<script setup lang="ts">
/**
 * A venue's details in its Business editor: what kind of place it is, how
 * many people it holds, amenities, opening hours, the floor plan, and the
 * booking contacts only signed-in organizers see (shared/types/venueDetails).
 *
 *   <BusinessVenueDetails v-model="venue" />
 */
import { VENUE_TYPES, VENUE_AMENITIES, WEEKDAYS, type OpeningHours, type VenueContact } from '#shared/types/venueDetails'
import { Lock } from 'lucide-vue-next'

export type VenueDetailsValue = {
  address: string
  venueType: string
  floorType: string
  capacity: number | null
  amenities: string[]
  openingHours: OpeningHours
  floorPlan: string | null
  contact: VenueContact
}
const model = defineModel<VenueDetailsValue>({ required: true })

// A type saved before the fixed list (free text) still shows, so it isn't lost.
const typeOptions = computed(() => [
  { label: 'Not set', value: '' },
  ...VENUE_TYPES.map(t => ({ label: t.label, value: t.value })),
  ...(model.value.venueType && !VENUE_TYPES.some(t => t.value === model.value.venueType) ? [{ label: model.value.venueType, value: model.value.venueType }] : []),
])
function toggleAmenity(v: string) {
  const a = model.value.amenities
  model.value.amenities = a.includes(v) ? a.filter(x => x !== v) : [...a, v]
}
// One input per weekday; an empty one means not open (or not said).
const hoursOf = (day: string) => model.value.openingHours.find(h => h.day === day)?.hours ?? ''
function setHours(day: (typeof WEEKDAYS)[number], hours: string) {
  const rest = model.value.openingHours.filter(h => h.day !== day)
  model.value.openingHours = (hours.trim() ? [...rest, { day, hours }] : rest)
    .sort((a, b) => WEEKDAYS.indexOf(a.day) - WEEKDAYS.indexOf(b.day))
}
function sameAsMonday() {
  const h = hoursOf('Monday')
  if (h) model.value.openingHours = WEEKDAYS.map(day => ({ day, hours: hoursOf(day) || h }))
}
const contact = computed(() => model.value.contact)
</script>

<template>
  <div class="grid gap-4">
    <section class="rounded-2xl border bg-card p-5 shadow-wd-card">
      <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Venue</h2>
      <div class="mt-4 grid gap-4 sm:grid-cols-3">
        <Field id="edit-address" label="Address" class="sm:col-span-3">
          <Input v-model="model.address" />
        </Field>
        <Field id="edit-venue-type" label="Kind of place" optional>
          <Select v-model="model.venueType" :options="typeOptions" />
        </Field>
        <Field id="edit-capacity" label="People it holds" optional hint="Dancing, not seated.">
          <Input v-model.number="model.capacity" type="number" min="1" />
        </Field>
        <Field id="edit-floor" label="Floor" optional>
          <Input v-model="model.floorType" placeholder="Parquet, tiles…" />
        </Field>
      </div>
      <p class="mt-5 text-sm font-bold">Amenities</p>
      <div class="mt-1.5 flex flex-wrap gap-1.5" role="group" aria-label="Amenities">
        <Button v-for="a in VENUE_AMENITIES" :key="a.value" type="button" size="sm" :variant="model.amenities.includes(a.value) ? 'soft' : 'outline'" :aria-pressed="model.amenities.includes(a.value)" @click="toggleAmenity(a.value)">{{ a.label }}</Button>
      </div>
    </section>

    <section class="rounded-2xl border bg-card p-5 shadow-wd-card">
      <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Opening hours</h2>
      <p class="mt-1 text-sm text-muted-foreground">As you’d say it: “18:00–02:00”, “on request”. Leave a day empty if you’re closed.</p>
      <div class="mt-3 grid gap-2">
        <div v-for="d in WEEKDAYS" :key="d" class="grid grid-cols-[7rem_minmax(0,1fr)] items-center gap-3">
          <label :for="`hours-${d}`" class="text-sm">{{ d }}</label>
          <Input :id="`hours-${d}`" :model-value="hoursOf(d)" placeholder="Closed" @update:model-value="(v: string | number) => setHours(d, String(v))" />
        </div>
      </div>
      <Button v-if="hoursOf('Monday')" type="button" variant="ghost" size="sm" class="mt-2" @click="sameAsMonday">Same as Monday for the empty days</Button>
    </section>

    <section class="rounded-2xl border bg-card p-5 shadow-wd-card">
      <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Floor plan</h2>
      <p class="mt-1 text-sm text-muted-foreground">A drawing or photo of the rooms and where the floor, bar and DJ are. Shown on your page.</p>
      <div class="mt-3 max-w-xs"><ImageUpload v-model="model.floorPlan" folder="profiles" /></div>
    </section>

    <section class="rounded-2xl border bg-card p-5 shadow-wd-card">
      <h2 class="flex items-center gap-1.5 text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary"><Lock class="size-3.5" aria-hidden="true" /> Booking contacts</h2>
      <p class="mt-1 text-sm text-muted-foreground">Only organizers signed in to WeDance see these, when they plan an event and want to ask you. Never on your public page.</p>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <Field id="edit-phone" label="Phone" optional><Input v-model="contact.phone" type="tel" autocomplete="off" placeholder="+49 89 …" /></Field>
        <Field id="edit-whatsapp" label="WhatsApp" optional><Input v-model="contact.whatsapp" type="tel" autocomplete="off" placeholder="+49 170 …" /></Field>
        <Field id="edit-email" label="Email for bookings" optional><Input v-model="contact.email" type="email" autocomplete="off" placeholder="events@…" /></Field>
        <Field id="edit-telegram" label="Telegram" optional><Input v-model="contact.telegram" autocomplete="off" placeholder="@handle" /></Field>
      </div>
    </section>
  </div>
</template>
