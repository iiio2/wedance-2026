<script setup lang="ts">
import { ArrowRight, MapPin, Music, Mic, Users, PartyPopper, UtensilsCrossed, Camera, Ticket, Loader2, Check, Trees } from 'lucide-vue-next'
import { EventInquirySchema } from '#shared/validation'
import { WD } from '~/lib/brand'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — For your event',
})

const { $trpc } = useNuxtApp()

const services = [
  { icon: MapPin,          label: 'Venue',         detail: 'Cuban bars, dance halls, private lofts, rooftops.' },
  { icon: UtensilsCrossed, label: 'Catering',      detail: 'Cuban bites, a mojito bar, or a full sit-down — flavors that match the floor.' },
  { icon: Mic,             label: 'MC / Host',     detail: 'Bilingual EN/DE/ES. Reads the room, keeps the energy.' },
  { icon: Music,           label: 'DJ',            detail: 'Salsa, bachata, kizomba, timba, urbano. Your BPM.' },
  { icon: Users,           label: 'Show dancers',  detail: 'Solo showcase, couples, choreo for your first dance.' },
  { icon: Camera,          label: 'Photo / Video', detail: 'Photographer and videographer — a highlight reel ready to post.' },
  { icon: Ticket,          label: 'Ticketing',     detail: 'Paid tickets, guest lists, and check-in — we run the door.' },
  { icon: PartyPopper,     label: 'Full night',    detail: 'One team, one contact, end-to-end — you enjoy it.' },
]

const occasions = ['Weddings', 'Birthdays', 'Corporate', 'Brand launches', 'Team offsites', 'Private parties']

// The "Venue" service links to the venues page.
const NuxtLinkC = resolveComponent('NuxtLink')

// ── Inquiry form state ─────────────────────────────────────────────────────
const showForm = ref(false)
const eventType = ref('')
const date = ref('')
const city = ref('')
const guests = ref('')
const needs = ref('')
const name = ref('')
const email = ref('')
const submitting = ref(false)
const submitted = ref(false)
const submitError = ref('')

const formData = () => ({
  eventType: eventType.value,
  date: date.value,
  city: city.value,
  guests: guests.value,
  needs: needs.value,
  name: name.value,
  email: email.value,
})

const { errors, validate, reset: resetValidation, fieldAttrs } = useFormValidation(EventInquirySchema, formData)

function openForm() {
  showForm.value = true
  nextTick(() => {
    document.getElementById('inquiry-event-type')?.focus()
  })
}

function resetForm() {
  eventType.value = ''
  date.value = ''
  city.value = ''
  guests.value = ''
  needs.value = ''
  name.value = ''
  email.value = ''
  submitError.value = ''
  submitting.value = false
  submitted.value = false
  showForm.value = false
  resetValidation()
}

async function submit() {
  submitError.value = ''
  const result = validate()
  if (!result.success) return
  submitting.value = true
  try {
    await $trpc.feedback.inquiry.mutate(result.data)
    submitted.value = true
  } catch (e: any) {
    submitError.value = e?.message || 'Could not send your request. Please try again, or email hello@wedance.vip.'
  } finally {
    submitting.value = false
  }
}

const inputClass = 'w-full rounded-2xl px-4 py-3 text-sm outline-none transition-all'
const inputStyle = 'background:white; border:1px solid #3b1f0d33; color:#3b1f0d; font-family: system-ui, sans-serif;'
</script>

<template>
  <div class="min-h-screen" style="background:var(--wd-cream); color:var(--wd-brown-900); font-family:var(--wd-font-display);">
    <!-- Header -->
    <SiteHeader />

    <!-- HERO -->
    <section class="max-w-5xl mx-auto px-4 pt-14 pb-10">
      <div class="text-sm tracking-widest uppercase mb-3" style="color:var(--wd-amber-600);">For your event</div>
      <h1 class="text-5xl sm:text-6xl leading-[0.95]" style="color:var(--wd-brown-900);">
        Hosting the night,<br>
        not dancing <em class="italic" style="color:var(--wd-red-600);">at it</em>?
      </h1>
      <p class="mt-6 text-base sm:text-lg leading-relaxed max-w-xl" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
        One team builds the whole floor. Venue. MC. DJ. Show dancers. From one dance to five hours of party — no piecing it out to five vendors.
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        <span v-for="o in occasions" :key="o" class="text-xs px-3 py-1 rounded-full border" style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); color:var(--wd-brown-700); font-family:var(--wd-font-sans);">{{ o }}</span>
      </div>
    </section>

    <!-- SERVICES -->
    <section class="max-w-5xl mx-auto px-4 pb-10">
      <p class="mb-6 text-sm tracking-widest uppercase" style="color:var(--wd-amber-600);">Everything under one roof</p>
      <div class="grid md:grid-cols-3 gap-5">
        <component
          :is="s.label === 'Venue' ? NuxtLinkC : 'div'"
          v-for="(s, i) in services" :key="s.label"
          :to="s.label === 'Venue' ? '/venues' : undefined"
          class="rounded-2xl bg-white p-6 border block transition-all"
          :class="s.label === 'Venue' ? 'hover:-translate-y-0.5 cursor-pointer' : ''"
          :style="{ borderColor: [WD.red600, WD.amber500, WD.cyan600, WD.green600, WD.purple500][i % 5] + '55' }"
        >
          <component :is="s.icon" class="w-6 h-6 mb-3" :style="{ color: [WD.red600, WD.amber500, WD.cyan600, WD.green600, WD.purple500][i % 5], 'stroke-width': 1.5 }" />
          <div class="text-lg font-bold" style="color:var(--wd-brown-900);">{{ s.label }}</div>
          <div class="mt-2 text-sm leading-relaxed" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">{{ s.detail }}</div>
          <div v-if="s.label === 'Venue'" class="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider" style="color:var(--wd-red-600); font-family:var(--wd-font-sans);">
            Browse venues <ArrowRight class="w-3.5 h-3.5" />
          </div>
        </component>
      </div>
    </section>

    <!-- SHOWCASE: Pinakothek Open Air -->
    <section class="max-w-5xl mx-auto px-4 pb-10">
      <p class="mb-4 text-sm tracking-widest uppercase" style="color:var(--wd-amber-600);">See it in action</p>
      <NuxtLink
        to="/@pinakothek-der-moderne"
        class="rounded-2xl bg-white border flex flex-col sm:flex-row items-stretch overflow-hidden transition-all hover:-translate-y-0.5"
        style="border-color:color-mix(in srgb, var(--wd-green-600) 33%, transparent);"
      >
        <div class="sm:w-1/3 min-h-[160px] bg-cover bg-center" style="background-image:url('https://firebasestorage.googleapis.com/v0/b/wedance-4abe3.appspot.com/o/media%2FtvR012ArEpQhCJdPHh6G7sLuqoO2%2Fdc862207-95df-4573-9e92-6884ce0e7b83?alt=media&token=eb5bb326-9da4-4e2b-8428-c07afe0a707d');" />
        <div class="p-6 flex-1">
          <div class="flex items-center gap-2 mb-2">
            <Trees class="w-4 h-4" style="color:var(--wd-green-600);" />
            <span class="text-[10px] uppercase tracking-[0.3em] font-bold" style="color:var(--wd-green-600); font-family:var(--wd-font-sans);">Open air · Free · Community-run</span>
          </div>
          <div class="text-xl font-bold" style="color:var(--wd-brown-900);">Pinakothek der Moderne</div>
          <div class="mt-2 text-sm leading-relaxed" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
            Munich's open-air dance commons — six mapped areas, community guidelines, and a free booking flow. Pick an area, propose your event, the moderator confirms it.
          </div>
          <div class="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider" style="color:var(--wd-red-600); font-family:var(--wd-font-sans);">
            See the venue <ArrowRight class="w-3.5 h-3.5" />
          </div>
        </div>
      </NuxtLink>
    </section>

    <!-- CTA -->
    <section id="inquiry" class="max-w-3xl mx-auto px-4 py-16">
      <!-- Confirmation -->
      <div v-if="submitted" class="text-center">
        <div class="inline-flex items-center justify-center w-16 h-16 rounded-full mb-6" style="background:color-mix(in srgb, var(--wd-green-600) 13.3%, transparent);">
          <Check class="w-8 h-8" style="color:var(--wd-green-600);" />
        </div>
        <h2 class="text-3xl sm:text-4xl leading-tight">
          Request <em class="italic" style="color:var(--wd-green-600);">received.</em>
        </h2>
        <p class="mt-4 text-sm sm:text-base" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
          We got your event details and will come back with a plan — usually same day.
        </p>
        <button
          type="button"
          class="mt-8 inline-flex items-center gap-2 px-7 py-3 rounded-full text-sm font-bold uppercase tracking-wider"
          style="background:white; color:var(--wd-brown-900); border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent); font-family:var(--wd-font-sans);"
          @click="resetForm"
        >
          Send another request
        </button>
      </div>

      <!-- Form -->
      <div v-else-if="showForm" class="max-w-lg mx-auto">
        <h2 class="text-3xl sm:text-4xl leading-tight text-center">
          Tell us <em class="italic" style="color:var(--wd-red-600);">about your night.</em>
        </h2>
        <p class="mt-4 text-sm sm:text-base text-center" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
          Fill in what you know — we'll figure out the rest.
        </p>

        <form class="mt-8 space-y-4" novalidate @submit.prevent="submit">
          <div class="grid sm:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label for="inquiry-event-type" class="text-sm font-bold" style="color:var(--wd-brown-900);">Type of event</label>
              <input
                id="inquiry-event-type"
                v-model="eventType"
                type="text"
                placeholder="e.g. Wedding, Birthday, Corporate"
                :class="inputClass"
                :style="inputStyle"
                v-bind="fieldAttrs('eventType', 'inquiry-event-type-error')"
              >
              <FieldError id="inquiry-event-type-error" :message="errors.eventType" />
            </div>
            <div class="space-y-1.5">
              <label for="inquiry-date" class="text-sm font-bold" style="color:var(--wd-brown-900);">Date</label>
              <input
                id="inquiry-date"
                v-model="date"
                type="text"
                placeholder="e.g. March 2027, flexible"
                :class="inputClass"
                :style="inputStyle"
                v-bind="fieldAttrs('date', 'inquiry-date-error')"
              >
              <FieldError id="inquiry-date-error" :message="errors.date" />
            </div>
          </div>

          <div class="grid sm:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label for="inquiry-city" class="text-sm font-bold" style="color:var(--wd-brown-900);">City</label>
              <input
                id="inquiry-city"
                v-model="city"
                type="text"
                placeholder="e.g. Munich"
                :class="inputClass"
                :style="inputStyle"
                v-bind="fieldAttrs('city', 'inquiry-city-error')"
              >
              <FieldError id="inquiry-city-error" :message="errors.city" />
            </div>
            <div class="space-y-1.5">
              <label for="inquiry-guests" class="text-sm font-bold" style="color:var(--wd-brown-900);">Guests</label>
              <input
                id="inquiry-guests"
                v-model="guests"
                type="text"
                placeholder="e.g. 50, 100–150"
                :class="inputClass"
                :style="inputStyle"
                v-bind="fieldAttrs('guests', 'inquiry-guests-error')"
              >
              <FieldError id="inquiry-guests-error" :message="errors.guests" />
            </div>
          </div>

          <div class="space-y-1.5">
            <label for="inquiry-needs" class="text-sm font-bold" style="color:var(--wd-brown-900);">What do you need? <span style="color:var(--wd-red-600);">*</span></label>
            <textarea
              id="inquiry-needs"
              v-model="needs"
              rows="4"
              placeholder="e.g. DJ + show dancers for a salsa wedding party, 3 hours, with a mojito bar…"
              required
              :class="inputClass"
              :style="inputStyle"
              v-bind="fieldAttrs('needs', 'inquiry-needs-error')"
            />
            <FieldError id="inquiry-needs-error" :message="errors.needs" />
          </div>

          <div class="grid sm:grid-cols-2 gap-4">
            <div class="space-y-1.5">
              <label for="inquiry-name" class="text-sm font-bold" style="color:var(--wd-brown-900);">Your name</label>
              <input
                id="inquiry-name"
                v-model="name"
                type="text"
                placeholder="Name"
                :class="inputClass"
                :style="inputStyle"
                v-bind="fieldAttrs('name', 'inquiry-name-error')"
              >
              <FieldError id="inquiry-name-error" :message="errors.name" />
            </div>
            <div class="space-y-1.5">
              <label for="inquiry-email" class="text-sm font-bold" style="color:var(--wd-brown-900);">Your email <span style="color:var(--wd-red-600);">*</span></label>
              <input
                id="inquiry-email"
                v-model="email"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                required
                :class="inputClass"
                :style="inputStyle"
                v-bind="fieldAttrs('email', 'inquiry-email-error')"
              >
              <FieldError id="inquiry-email-error" :message="errors.email" />
            </div>
          </div>

          <p v-if="submitError" class="text-sm font-bold" style="color:var(--wd-red-600); font-family:var(--wd-font-sans);">
            {{ submitError }}
          </p>

          <button
            type="submit"
            :disabled="submitting"
            class="w-full inline-flex items-center justify-center gap-2 px-7 py-3 rounded-full text-white text-sm font-bold uppercase tracking-wider disabled:opacity-60"
            style="background:linear-gradient(135deg, var(--wd-red-600), var(--wd-orange-500)); box-shadow: 0 4px 0 -1px var(--wd-red-800); font-family:var(--wd-font-sans);"
          >
            <Loader2 v-if="submitting" class="w-4 h-4 animate-spin" />
            {{ submitting ? 'Sending…' : 'Send request' }}
          </button>
        </form>

        <div class="mt-3 text-sm text-center" style="font-family:var(--wd-font-display);font-style:italic; color:var(--wd-amber-600);">
          — we usually respond same day
        </div>
      </div>

      <!-- Initial CTA button -->
      <div v-else class="text-center">
        <h2 class="text-3xl sm:text-4xl leading-tight">
          Tell us <em class="italic" style="color:var(--wd-red-600);">about your night.</em>
        </h2>
        <p class="mt-4 text-sm sm:text-base" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
          One reply, no forms. We come back with a plan you can send to your partner or your CFO.
        </p>
        <button
          type="button"
          class="mt-8 inline-flex items-center gap-2 px-7 py-3 rounded-full text-white text-sm font-bold uppercase tracking-wider"
          style="background:linear-gradient(135deg, var(--wd-red-600), var(--wd-orange-500)); box-shadow: 0 4px 0 -1px var(--wd-red-800);"
          @click="openForm"
        >
          Tell us about your event <ArrowRight class="w-4 h-4" />
        </button>
        <div class="mt-3 text-sm" style="font-family:var(--wd-font-display);font-style:italic; color:var(--wd-amber-600);">
          — we usually respond same day
        </div>
      </div>
    </section>

    <!-- CROSS-LINKS -->
    <section class="max-w-3xl mx-auto px-4 pb-16 space-y-3">
      <NuxtLink
        to="/for-venues"
        class="rounded-2xl bg-white p-6 border flex items-center justify-between gap-4 transition-all hover:-translate-y-0.5"
        style="border-color:color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent);"
      >
        <div>
          <div class="text-lg font-bold" style="color:var(--wd-brown-900);">Have a venue? List it on WeDance.</div>
          <div class="mt-1 text-sm leading-relaxed" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
            Get booking requests from dance organizers looking for a space.
          </div>
        </div>
        <span class="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider whitespace-nowrap" style="color:var(--wd-red-600); font-family:var(--wd-font-sans);">
          For venues <ArrowRight class="w-3.5 h-3.5" />
        </span>
      </NuxtLink>
    </section>

    <SiteFooter />
  </div>
</template>
