<script setup lang="ts">
/**
 * FindRidePanel — inline ride-share listing + offer form for a festival.
 * Shown inside the my-plan expanded card when the user clicks "Find a ride".
 * Loads ride-shares from the backend, displays them (driver, city, date),
 * falls back to a flight-search link when none exist, and lets the user
 * offer their own ride.
 */
import { Car, Plane, ExternalLink, MessageCircle } from 'lucide-vue-next'
import { RidePostSchema } from '#shared/validation'
import { accentText } from '~/lib/accent'
import { WD } from '~/lib/brand'
import { Button } from '~/components/ui/button'
import { Field } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { CityCombobox } from '~/components/ui/city-combobox'

const props = defineProps<{
  festivalSlug: string
  festivalLocation: string
  festivalStartDate: string
  accentColor: string
  isSignedIn: boolean
}>()

const emit = defineEmits<{
  'sign-in': []
}>()

const { rideShares, loadRideShares, postRide, deleteRide } = useRideShares(props.festivalSlug)

const loading = ref(true)
onMounted(async () => {
  await loadRideShares()
  loading.value = false
})

// Ride form state
const rideMode = ref<'offering' | 'looking' | null>(null)
const rideOriginCity = ref('')
const rideDate = ref('')
const rideSeats = ref(2)
const rideContactLink = ref('')
const rideForm = reactive(useFormValidation(RidePostSchema, () => ({
  type: rideMode.value ?? 'offering',
  originCity: rideOriginCity.value,
  date: rideDate.value,
  seats: rideMode.value === 'offering' ? rideSeats.value : undefined,
  contactLink: rideContactLink.value,
})))
watch(rideMode, () => rideForm.reset())

const submitting = ref(false)
async function submitRide() {
  if (!rideMode.value) return
  const result = rideForm.validate()
  if (!result.success) return
  submitting.value = true
  try {
    await postRide(result.data)
    rideOriginCity.value = ''
    rideDate.value = ''
    rideSeats.value = 2
    rideContactLink.value = ''
    rideMode.value = null
  } finally {
    submitting.value = false
  }
}

async function onDeleteRide() {
  try {
    await deleteRide()
  } catch { /* composable handles rollback */ }
}

const flightsHref = computed(() =>
  `https://www.google.com/travel/flights?q=flights%20to%20${encodeURIComponent(props.festivalLocation)}%20${props.festivalStartDate}`,
)

// Status chip text on its own 9 % tint, darkened where the hue is too light for 4.5:1.
const CYAN_CHIP = accentText(WD.cyan600)
const GREEN_CHIP = accentText(WD.green600)
const AMBER_CHIP = accentText(WD.amber500)

const hasOwnRide = computed(() => rideShares.value.some(r => r.isOwn))
const othersRides = computed(() => rideShares.value.filter(r => !r.isOwn))

const failedPhotos = ref(new Set<string>())
function onPhotoError(rideId: string) {
  failedPhotos.value.add(rideId)
}
</script>

<template>
  <div class="rounded-xl border overflow-hidden bg-card" style="border-color:color-mix(in srgb, var(--wd-cyan-600) 33.3%, transparent);">
    <!-- Header -->
    <div class="flex items-center gap-2 px-3 py-2.5" style="background:color-mix(in srgb, var(--wd-cyan-600) 3.9%, transparent);">
      <Car class="w-4 h-4 shrink-0 text-wd-cyan-600" aria-hidden="true" />
      <span class="text-sm font-bold font-display text-foreground">
        Find a ride
      </span>
      <span v-if="rideShares.length && !loading" class="text-eyebrow font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ml-auto" :style="{ background: 'color-mix(in srgb, var(--wd-cyan-600) 9.4%, transparent)', color: CYAN_CHIP }">
        {{ rideShares.length }} sharing
      </span>
    </div>

    <div class="px-3 pb-3 grid gap-2.5">
      <!-- Loading -->
      <p v-if="loading" class="text-xs py-2 font-sans text-secondary">
        Loading rides...
      </p>

      <template v-else>
        <!-- Ride-share list -->
        <div v-if="rideShares.length" class="grid gap-1.5">
          <div
            v-for="ride in rideShares"
            :key="ride.id"
            class="flex items-center gap-2.5 py-2 px-2.5 rounded-lg"
            style="background:color-mix(in srgb, var(--wd-brown-900) 2%, transparent);"
          >
            <img
              v-if="ride.dancerPhoto && !failedPhotos.has(ride.id)"
              :src="ride.dancerPhoto"
              :alt="ride.dancerName"
              class="w-7 h-7 rounded-full shrink-0 object-cover"
              @error="onPhotoError(ride.id)"
            >
            <span v-else class="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-eyebrow font-bold" :style="{ background: 'color-mix(in srgb, var(--wd-cyan-600) 9.4%, transparent)', color: CYAN_CHIP }">
              {{ ride.dancerName.charAt(0) }}
            </span>
            <div class="min-w-0 flex-1 text-xs font-sans text-muted-foreground">
              <span class="font-bold text-foreground">{{ ride.dancerName }}</span>
              <span class="ml-1">
                {{ ride.type === 'offering' ? 'from' : 'looking from' }} {{ ride.originCity }}
              </span>
              <span v-if="ride.date" class="ml-1">&middot; {{ ride.date }}</span>
              <span v-if="ride.seatsAvailable" class="ml-1">&middot; {{ ride.seatsAvailable }} seats</span>
            </div>
            <a v-if="ride.contactLink && isSignedIn" :href="ride.contactLink" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-xs font-bold hover:underline font-sans text-wd-cyan-700 shrink-0">
              <MessageCircle class="w-3 h-3" aria-hidden="true" /> Contact
            </a>
            <span
              class="text-tag font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
              :style="ride.type === 'offering' ? { background: 'color-mix(in srgb, var(--wd-green-600) 9.4%, transparent)', color: GREEN_CHIP } : { background: 'color-mix(in srgb, var(--wd-amber-500) 9.4%, transparent)', color: AMBER_CHIP }"
            >{{ ride.type === 'offering' ? 'Offering' : 'Looking' }}</span>
            <Button
              v-if="ride.isOwn"
              type="button"
              variant="link"
              size="sm"
              class="h-auto p-0 text-eyebrow font-bold italic shrink-0"
              @click="onDeleteRide"
            >Remove</Button>
          </div>
        </div>

        <!-- No rides — flights fallback -->
        <div v-if="!rideShares.length" class="rounded-lg px-3 py-3 text-center" style="background:color-mix(in srgb, var(--wd-brown-900) 2%, transparent);">
          <p class="text-xs mb-2 font-sans text-muted-foreground">
            No ride-shares yet. Be the first to offer one, or search flights.
          </p>
          <a
            :href="flightsHref"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-xs font-bold hover:underline font-sans text-wd-cyan-700"
          >
            <Plane class="w-3.5 h-3.5" aria-hidden="true" /> Search flights <ExternalLink class="w-2.5 h-2.5" aria-hidden="true" />
          </a>
        </div>

        <!-- Has rides but also show flights link -->
        <div v-if="othersRides.length" class="flex items-center justify-end">
          <a
            :href="flightsHref"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-eyebrow italic hover:underline font-display text-secondary"
          >
            or flights <ExternalLink class="w-2.5 h-2.5" aria-hidden="true" />
          </a>
        </div>

        <!-- Offer form (signed in) -->
        <div v-if="isSignedIn && !hasOwnRide" class="rounded-xl border p-3 grid gap-2" style="border-color:color-mix(in srgb, var(--wd-brown-900) 8.2%, transparent); background:color-mix(in srgb, var(--wd-brown-900) 2%, transparent);">
          <p class="text-eyebrow font-bold uppercase tracking-widest font-sans text-secondary">Offer or find a ride</p>
          <div class="flex gap-2">
            <Button
              type="button"
              :variant="rideMode === 'offering' ? 'default' : 'outline'"
              size="sm"
              accent="var(--wd-cyan-700)"
              class="flex-1 text-xs font-bold rounded-lg"
              :aria-pressed="rideMode === 'offering'"
              @click="rideMode = rideMode === 'offering' ? null : 'offering'"
            >Offering a ride</Button>
            <Button
              type="button"
              :variant="rideMode === 'looking' ? 'default' : 'outline'"
              size="sm"
              accent="var(--wd-cyan-700)"
              class="flex-1 text-xs font-bold rounded-lg"
              :aria-pressed="rideMode === 'looking'"
              @click="rideMode = rideMode === 'looking' ? null : 'looking'"
            >Looking for a ride</Button>
          </div>

          <div v-if="rideMode" class="grid gap-3">
            <Field id="plan-ride-origin" label="From city" :error="rideForm.errors.originCity">
              <CityCombobox v-model="rideOriginCity" placeholder="e.g. Munich" v-bind="rideForm.fieldAttrs('originCity', 'plan-ride-origin-error')" />
            </Field>
            <Field id="plan-ride-date" :label="rideMode === 'offering' ? 'Departure date' : 'Preferred date'" :error="rideForm.errors.date">
              <Input v-model="rideDate" type="date" v-bind="rideForm.fieldAttrs('date', 'plan-ride-date-error')" />
            </Field>
            <Field v-if="rideMode === 'offering'" id="plan-ride-seats" label="Seats available" :error="rideForm.errors.seats">
              <Input v-model.number="rideSeats" type="number" min="1" max="6" v-bind="rideForm.fieldAttrs('seats', 'plan-ride-seats-error')" />
            </Field>
            <Field id="plan-ride-contact" label="WhatsApp or Telegram link (optional)" :error="rideForm.errors.contactLink">
              <Input v-model="rideContactLink" type="url" placeholder="https://wa.me/… or https://t.me/…" v-bind="rideForm.fieldAttrs('contactLink', 'plan-ride-contact-error')" />
            </Field>
            <Button type="button" variant="pill" size="pill-sm" accent="var(--wd-cyan-700)" class="w-full h-9" :loading="submitting" @click="submitRide">
              {{ submitting ? 'Posting...' : 'Post my ride' }}
            </Button>
          </div>
        </div>

        <!-- Not signed in -->
        <div v-if="!isSignedIn" class="rounded-xl border p-3 text-center" style="border-color:color-mix(in srgb, var(--wd-brown-900) 8.2%, transparent); background:color-mix(in srgb, var(--wd-brown-900) 2%, transparent);">
          <p class="text-xs mb-2 font-sans text-muted-foreground">Sign in to share or find a ride</p>
          <Button type="button" variant="pill" size="pill-sm" accent="var(--wd-cyan-700)" @click="emit('sign-in')">Sign in</Button>
        </div>
      </template>
    </div>
  </div>
</template>
