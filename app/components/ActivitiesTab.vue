<script setup lang="ts">
/**
 * ActivitiesTab — rides, rooms, dinners & activities around a festival.
 * V3 tropical style. Collapsible sections; same props/emits as before.
 */
import type { RideShare, GroupDinner, ExtraActivity } from '~/types/festival'
import type { RoommateEntry } from '~/composables/useRoommates'
import { Car, BedDouble, UtensilsCrossed, Compass, ChevronDown, Check, MessageCircle, MapPin, ExternalLink } from 'lucide-vue-next'
import { RidePostSchema } from '#shared/validation'
import { WD } from '~/lib/brand'
import { accentText, readableAccent } from '~/lib/accent'
import { Button } from '~/components/ui/button'
import { Field } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { CityCombobox } from '~/components/ui/city-combobox'

const props = defineProps<{
  rideShares: RideShare[]
  groupDinners: GroupDinner[]
  extraActivities: ExtraActivity[]
  lookingForRoommate: boolean
  roommateOthers: RoommateEntry[]
  hotelSearchUrl?: string
  isSignedIn: boolean
}>()

const emit = defineEmits<{
  'join-dinner': [id: string]
  'join-activity': [id: string]
  'post-ride': [ride: { type: 'offering' | 'looking'; originCity: string; date: string; seats?: number; contactLink?: string }]
  'toggle-roommate': []
  'sign-in': []
}>()

const expandedSections = ref(new Set<string>())
const failedRidePhotos = ref(new Set<string>())
function toggleSection(section: string) {
  const next = new Set(expandedSections.value)
  next.has(section) ? next.delete(section) : next.add(section)
  expandedSections.value = next
}

// Ride form
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

function submitRide() {
  if (!rideMode.value) return
  const result = rideForm.validate()
  if (!result.success) return
  emit('post-ride', result.data)
  rideOriginCity.value = ''
  rideDate.value = ''
  rideSeats.value = 2
  rideContactLink.value = ''
  rideMode.value = null
}

const totalEvents = computed(() => props.groupDinners.length + props.extraActivities.length)

// Button accents that reach 4.5:1 with white (the raw purple/amber don't).
const PURPLE = readableAccent(WD.purple500)
const AMBER = readableAccent(WD.amber500)
// Status chip text on its own 9 % tint, darkened where the hue is too light.
const AMBER_CHIP = accentText(WD.amber500)
const GREEN_CHIP = accentText(WD.green600)

// Section definitions drive the accordion headers
const sections = [
  { key: 'rides',   icon: Car,             label: 'Share a ride',        accent: WD.cyan600 },
  { key: 'rooms',   icon: BedDouble,       label: 'Share a room',        accent: WD.green600 },
  { key: 'dinners', icon: UtensilsCrossed, label: 'Dinners & activities', accent: WD.amber500 },
] as const

function badgeFor(key: string): string | null {
  if (key === 'rides') return props.rideShares.length ? `${props.rideShares.length} sharing` : null
  if (key === 'rooms') {
    if (props.roommateOthers.length > 0) return `${props.roommateOthers.length} looking`
    if (props.lookingForRoommate) return 'Looking'
    return null
  }
  if (key === 'dinners') return totalEvents.value ? `${totalEvents.value} events` : null
  return null
}
</script>

<template>
  <div class="grid gap-3">
    <div
      v-for="sec in sections"
      :key="sec.key"
      class="rounded-2xl bg-card border overflow-hidden"
      :style="{ borderColor: sec.accent + '55', boxShadow: '0 1px 0 ' + sec.accent + '18, 0 4px 14px rgba(59,31,18,0.04)' }"
    >
      <!-- Header (disclosure) -->
      <button
        type="button"
        class="w-full flex items-center gap-3 px-4 py-3.5 text-left cursor-pointer"
        :aria-expanded="expandedSections.has(sec.key)"
        @click="toggleSection(sec.key)"
      >
        <span class="w-8 h-8 rounded-full flex items-center justify-center shrink-0" :style="{ background: sec.accent + '18' }">
          <component :is="sec.icon" class="w-4 h-4" :style="{ color: sec.accent }" aria-hidden="true" />
        </span>
        <span class="flex-1 text-base font-bold font-display text-foreground">
          {{ sec.label }}
        </span>
        <span
          v-if="badgeFor(sec.key) && !expandedSections.has(sec.key)"
          class="text-eyebrow font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
          :style="{ background: sec.accent + '18', color: accentText(sec.accent) }"
        >
          {{ badgeFor(sec.key) }}
        </span>
        <ChevronDown
          class="w-4 h-4 transition-transform text-secondary"
          :class="expandedSections.has(sec.key) ? 'rotate-180' : ''"
          aria-hidden="true"
        />
      </button>

      <!-- RIDES -->
      <div v-if="sec.key === 'rides' && expandedSections.has('rides')" class="px-4 pb-4 grid gap-3">
        <div v-if="isSignedIn" class="rounded-xl border p-3 grid gap-2" style="border-color:color-mix(in srgb, var(--wd-brown-900) 8.2%, transparent); background:color-mix(in srgb, var(--wd-brown-900) 2%, transparent);">
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
            <Field id="ride-origin" label="From city" :error="rideForm.errors.originCity">
              <CityCombobox v-model="rideOriginCity" placeholder="e.g. Munich" v-bind="rideForm.fieldAttrs('originCity', 'ride-origin-error')" />
            </Field>
            <Field id="ride-date" :label="rideMode === 'offering' ? 'Departure date' : 'Preferred date'" :error="rideForm.errors.date">
              <Input v-model="rideDate" type="date" v-bind="rideForm.fieldAttrs('date', 'ride-date-error')" />
            </Field>
            <Field v-if="rideMode === 'offering'" id="ride-seats" label="Seats available" :error="rideForm.errors.seats">
              <Input v-model.number="rideSeats" type="number" min="1" max="6" v-bind="rideForm.fieldAttrs('seats', 'ride-seats-error')" />
            </Field>
            <Field id="ride-contact" label="WhatsApp or Telegram link (optional)" :error="rideForm.errors.contactLink">
              <Input v-model="rideContactLink" type="url" placeholder="https://wa.me/… or https://t.me/…" v-bind="rideForm.fieldAttrs('contactLink', 'ride-contact-error')" />
            </Field>
            <Button type="button" variant="pill" size="pill-sm" accent="var(--wd-cyan-700)" class="w-full h-9" @click="submitRide">
              Post my ride
            </Button>
          </div>
        </div>
        <div v-else class="rounded-xl border p-3 text-center" style="border-color:color-mix(in srgb, var(--wd-brown-900) 8.2%, transparent); background:color-mix(in srgb, var(--wd-brown-900) 2%, transparent);">
          <p class="text-sm mb-2 font-sans text-muted-foreground">Sign in to share or find a ride</p>
          <Button type="button" variant="pill" size="pill-sm" accent="var(--wd-cyan-700)" @click="emit('sign-in')">Sign in</Button>
        </div>

        <div v-if="rideShares.length" class="grid gap-1.5">
          <p class="text-eyebrow font-bold uppercase tracking-widest font-sans text-secondary">Others sharing rides</p>
          <div v-for="ride in rideShares" :key="ride.id" class="flex items-center gap-2.5 py-1.5 px-2 rounded-lg" style="background:color-mix(in srgb, var(--wd-brown-900) 2%, transparent);">
            <img v-if="ride.dancerPhoto && !failedRidePhotos.has(ride.id)" :src="ride.dancerPhoto" :alt="ride.dancerName" class="w-8 h-8 rounded-full shrink-0 object-cover" @error="failedRidePhotos.add(ride.id)">
            <span v-else class="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold uppercase" style="background:color-mix(in srgb, var(--wd-cyan-600) 9.4%, transparent); color:var(--wd-cyan-600);">{{ ride.dancerName.charAt(0) }}</span>
            <div class="min-w-0 flex-1 text-xs font-sans text-muted-foreground">
              <span class="font-bold text-foreground">{{ ride.dancerName }}</span>
              <span class="ml-1">
                {{ ride.type === 'offering' ? 'from' : 'looking from' }} {{ ride.originCity }}<span v-if="ride.seatsAvailable"> · {{ ride.seatsAvailable }} seats</span>
              </span>
            </div>
            <a v-if="ride.contactLink && isSignedIn" :href="ride.contactLink" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 text-xs font-bold hover:underline font-sans text-wd-cyan-700 shrink-0">
              <MessageCircle class="w-3 h-3" aria-hidden="true" /> Contact
            </a>
            <span
              class="text-tag font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0"
              :style="ride.type === 'offering' ? { background: 'color-mix(in srgb, var(--wd-green-600) 9.4%, transparent)', color: GREEN_CHIP } : { background: 'color-mix(in srgb, var(--wd-amber-500) 9.4%, transparent)', color: AMBER_CHIP }"
            >{{ ride.type === 'offering' ? 'Offering' : 'Looking' }}</span>
          </div>
        </div>
      </div>

      <!-- ROOMS -->
      <div v-if="sec.key === 'rooms' && expandedSections.has('rooms')" class="px-4 pb-4 grid gap-3">
        <div v-if="!isSignedIn" class="rounded-xl border p-3 text-center" style="border-color:color-mix(in srgb, var(--wd-brown-900) 8.2%, transparent); background:color-mix(in srgb, var(--wd-brown-900) 2%, transparent);">
          <p class="text-sm mb-2 font-sans text-muted-foreground">Sign in to find a roommate</p>
          <Button type="button" variant="pill" size="pill-sm" accent="var(--wd-green-700)" @click="emit('sign-in')">Sign in</Button>
        </div>
        <div v-else class="rounded-xl border p-3 grid gap-2" style="border-color:color-mix(in srgb, var(--wd-brown-900) 8.2%, transparent); background:color-mix(in srgb, var(--wd-brown-900) 2%, transparent);">
          <button
            type="button"
            role="switch"
            :aria-checked="lookingForRoommate"
            class="w-full flex items-center justify-between cursor-pointer"
            @click="emit('toggle-roommate')"
          >
            <span class="flex items-center gap-2 text-sm font-bold font-sans text-foreground">
              <BedDouble class="w-4 h-4" :class="lookingForRoommate ? 'text-wd-green-600' : 'text-secondary'" aria-hidden="true" />
              Looking for a roommate?
            </span>
            <span
              class="w-9 h-5 rounded-full transition-colors flex items-center px-0.5"
              :style="{ background: lookingForRoommate ? WD.green600 : (WD.brown900 + '22') }"
            >
              <span
                class="w-4 h-4 rounded-full bg-white shadow-sm transition-transform"
                :class="lookingForRoommate ? 'translate-x-[14px]' : 'translate-x-0'"
              />
            </span>
          </button>
          <p v-if="lookingForRoommate" class="text-xs font-sans text-muted-foreground">
            Other attendees looking for roommates will see you. Share your plan to connect.
          </p>
        </div>

        <!-- Others looking for roommates -->
        <div v-if="roommateOthers.length" class="grid gap-1.5">
          <p class="text-eyebrow font-bold uppercase tracking-widest font-sans text-secondary">Others looking for roommates</p>
          <div v-for="person in roommateOthers" :key="person.username || person.name" class="flex items-center gap-2.5 py-1.5 px-2 rounded-lg" style="background:color-mix(in srgb, var(--wd-brown-900) 2%, transparent);">
            <img v-if="person.photo" :src="person.photo" :alt="person.name" class="w-8 h-8 rounded-full shrink-0 object-cover">
            <span v-else class="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-xs font-bold" :style="{ background: 'color-mix(in srgb, var(--wd-green-600) 9.4%, transparent)', color: GREEN_CHIP }">{{ person.name.charAt(0) }}</span>
            <div class="min-w-0 flex-1 text-xs font-sans text-muted-foreground">
              <component :is="person.username ? 'a' : 'span'" :href="person.username ? `/u/${person.username}` : undefined" class="font-bold text-foreground" :class="person.username ? 'underline underline-offset-2' : ''">{{ person.name }}</component>
              <span v-if="person.city" class="ml-1 inline-flex items-center gap-0.5"><MapPin class="w-3 h-3 inline text-secondary" aria-hidden="true" />{{ person.city }}</span>
            </div>
            <span class="text-tag font-bold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0" :style="{ background: 'color-mix(in srgb, var(--wd-green-600) 9.4%, transparent)', color: GREEN_CHIP }">Looking</span>
          </div>
        </div>

        <!-- Hotel fallback when no roommates found -->
        <div v-if="!roommateOthers.length && isSignedIn && hotelSearchUrl" class="rounded-xl border p-3 text-center" style="border-color:color-mix(in srgb, var(--wd-brown-900) 8.2%, transparent); background:color-mix(in srgb, var(--wd-brown-900) 2%, transparent);">
          <p class="text-xs mb-2 font-sans text-muted-foreground">No one is looking for a roommate yet. You can also check hotels nearby.</p>
          <Button as-child variant="outline-pill" size="pill-sm" accent="var(--wd-green-700)" class="gap-1.5">
            <a :href="hotelSearchUrl" target="_blank" rel="noopener"><ExternalLink class="w-3 h-3" aria-hidden="true" /> Search hotels</a>
          </Button>
        </div>
      </div>

      <!-- DINNERS & ACTIVITIES -->
      <div v-if="sec.key === 'dinners' && expandedSections.has('dinners')" class="px-4 pb-4 grid gap-4">
        <div v-if="groupDinners.length" class="grid gap-2.5">
          <p class="text-xs font-sans text-muted-foreground">
            Join a group dinner with fellow dancers — meet new friends over a meal.
          </p>
          <div
            v-for="dinner in groupDinners"
            :key="dinner.id"
            class="rounded-xl border p-3 grid gap-1.5"
            style="border-color:color-mix(in srgb, var(--wd-brown-900) 8.2%, transparent);"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-bold text-foreground">{{ dinner.day }} dinner</span>
              <div class="flex items-center gap-1.5">
                <span class="text-tag font-bold px-1.5 py-0.5 rounded-full text-muted-foreground" style="background:color-mix(in srgb, var(--wd-brown-900) 3.9%, transparent);">{{ dinner.joined }}/{{ dinner.maxSize }} joined</span>
                <span
                  v-if="dinner.joined < dinner.maxSize"
                  class="text-tag font-bold px-1.5 py-0.5 rounded-full"
                  :style="dinner.maxSize - dinner.joined <= 3 ? { background: 'color-mix(in srgb, var(--wd-amber-500) 9.4%, transparent)', color: AMBER_CHIP } : { background: 'color-mix(in srgb, var(--wd-green-600) 9.4%, transparent)', color: GREEN_CHIP }"
                >{{ dinner.maxSize - dinner.joined }} spots left</span>
                <span v-else class="text-tag font-bold px-1.5 py-0.5 rounded-full text-secondary" style="background:color-mix(in srgb, var(--wd-brown-900) 3.9%, transparent);">Full</span>
              </div>
            </div>
            <p class="text-xs font-sans text-muted-foreground">
              {{ dinner.timeSlot }}<span v-if="dinner.restaurant"> · {{ dinner.restaurant }}</span><span v-else-if="dinner.date" class="italic"> · Restaurant revealed on {{ dinner.day }}</span>
            </p>
            <div class="w-full rounded-full h-1.5" style="background:color-mix(in srgb, var(--wd-brown-900) 7.1%, transparent);">
              <div class="rounded-full h-1.5 transition-all bg-wd-amber-500" :style="{ width: `${(dinner.joined / dinner.maxSize) * 100}%` }" />
            </div>
            <Button
              v-if="!dinner.userJoined && dinner.joined < dinner.maxSize"
              type="button"
              variant="outline-pill"
              size="pill-sm"
              :accent="AMBER"
              class="w-full"
              @click="emit('join-dinner', dinner.id)"
            >Join this dinner</Button>
            <template v-else-if="dinner.userJoined">
              <p class="text-xs font-bold flex items-center gap-1 font-sans text-wd-green-700">
                <Check class="w-3 h-3" aria-hidden="true" /> You're in!
              </p>
              <div v-if="dinner.groupChatLink" class="flex items-center gap-2 mt-0.5">
                <a :href="dinner.groupChatLink" target="_blank" class="text-xs font-bold hover:underline flex items-center gap-1 font-sans text-wd-cyan-700">
                  <MessageCircle class="w-3 h-3" aria-hidden="true" /> Open group chat
                </a>
                <div v-if="dinner.groupMembers?.length" class="flex -space-x-1">
                  <img v-for="m in dinner.groupMembers" :key="m.name" :src="m.photo" :alt="m.name" class="w-5 h-5 rounded-full border-2 border-white">
                </div>
              </div>
            </template>
          </div>
        </div>

        <div v-if="extraActivities.length" class="grid gap-2.5">
          <div class="flex items-center gap-1.5">
            <Compass class="w-4 h-4 text-secondary" aria-hidden="true" />
            <p class="text-sm font-bold font-sans text-foreground">Extra activities</p>
          </div>
          <div
            v-for="activity in extraActivities"
            :key="activity.id"
            class="rounded-xl border p-3 grid gap-1.5"
            style="border-color:color-mix(in srgb, var(--wd-brown-900) 8.2%, transparent);"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-sm font-bold text-foreground">{{ activity.title }}</span>
              <span class="text-tag font-bold px-1.5 py-0.5 rounded-full text-muted-foreground" style="background:color-mix(in srgb, var(--wd-brown-900) 3.9%, transparent);">
                {{ activity.participantCount }}<span v-if="activity.maxParticipants">/{{ activity.maxParticipants }}</span> joined
              </span>
            </div>
            <p class="text-xs font-sans text-muted-foreground">{{ activity.date }} · {{ activity.time }}</p>
            <p v-if="activity.description" class="text-xs font-sans text-secondary">{{ activity.description }}</p>
            <Button
              v-if="!activity.userJoined"
              type="button"
              variant="outline-pill"
              size="pill-sm"
              :accent="PURPLE"
              class="w-full"
              @click="emit('join-activity', activity.id)"
            >Join</Button>
            <p v-else class="text-xs font-bold flex items-center gap-1 font-sans text-wd-green-700">
              <Check class="w-3 h-3" aria-hidden="true" /> You're in!
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
