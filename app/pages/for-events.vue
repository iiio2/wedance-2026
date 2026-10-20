<script setup lang="ts">
import { ArrowRight, MapPin, Music, Mic, Users, PartyPopper, UtensilsCrossed, Camera, Ticket, Check, Trees } from 'lucide-vue-next'
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
    useTrack().track('event_inquiry_submitted', { event_type: result.data.eventType || null, city: result.data.city || null })
    submitted.value = true
  } catch (e: any) {
    submitError.value = e?.message || 'Could not send your request. Please try again, or email hello@wedance.vip.'
  } finally {
    submitting.value = false
  }
}

</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <!-- Header -->
    <SiteHeader />
    <main>

    <!-- HERO -->
    <section class="max-w-5xl mx-auto px-4 pt-14 pb-10">
      <div class="text-sm tracking-widest uppercase mb-3 text-secondary">For your event</div>
      <h1 class="text-5xl sm:text-6xl leading-[0.95] text-foreground">
        Hosting the night,<br>
        not dancing <em class="italic text-primary">at it</em>?
      </h1>
      <p class="mt-6 text-base sm:text-lg leading-relaxed max-w-xl text-muted-foreground font-sans">
        One team builds the whole floor. Venue. MC. DJ. Show dancers. From one dance to five hours of party — no piecing it out to five vendors.
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        <span v-for="o in occasions" :key="o" class="text-xs px-3 py-1 rounded-full border border-border text-muted-foreground font-sans">{{ o }}</span>
      </div>
    </section>

    <!-- SERVICES -->
    <section class="max-w-5xl mx-auto px-4 pb-10">
      <p class="mb-6 text-sm tracking-widest uppercase text-secondary">Everything under one roof</p>
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
          <div class="text-lg font-bold text-foreground">{{ s.label }}</div>
          <div class="mt-2 text-sm leading-relaxed text-muted-foreground font-sans">{{ s.detail }}</div>
          <div v-if="s.label === 'Venue'" class="mt-3 inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-primary font-sans">
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
          <Check class="w-8 h-8 text-wd-green-600" />
        </div>
        <h2 class="text-3xl sm:text-4xl leading-tight">
          Request <em class="italic text-wd-green-600">received.</em>
        </h2>
        <p class="mt-4 text-sm sm:text-base text-muted-foreground font-sans">
          We got your event details and will come back with a plan — usually same day.
        </p>
        <Button type="button" variant="outline-pill" size="lg" class="mt-8 px-7 font-sans" @click="resetForm">
          Send another request
        </Button>
      </div>

      <!-- Form -->
      <div v-else-if="showForm" class="max-w-lg mx-auto">
        <h2 class="text-3xl sm:text-4xl leading-tight text-center">
          Tell us <em class="italic text-primary">about your night.</em>
        </h2>
        <p class="mt-4 text-sm sm:text-base text-center text-muted-foreground font-sans">
          Fill in what you know — we'll figure out the rest.
        </p>

        <form class="mt-8 space-y-4" novalidate @submit.prevent="submit">
          <div class="grid sm:grid-cols-2 gap-4">
            <Field id="inquiry-event-type" label="Type of event" optional :error="errors.eventType">
              <Input v-model="eventType" placeholder="e.g. Wedding, Birthday, Corporate" v-bind="fieldAttrs('eventType', 'inquiry-event-type-error')" />
            </Field>
            <Field id="inquiry-date" label="Date" optional :error="errors.date">
              <Input v-model="date" placeholder="e.g. March 2027, flexible" v-bind="fieldAttrs('date', 'inquiry-date-error')" />
            </Field>
          </div>

          <div class="grid sm:grid-cols-2 gap-4">
            <Field id="inquiry-city" label="City" optional :error="errors.city">
              <CityCombobox v-model="city" placeholder="e.g. Munich" v-bind="fieldAttrs('city', 'inquiry-city-error')" />
            </Field>
            <Field id="inquiry-guests" label="Guests" optional :error="errors.guests">
              <Input v-model="guests" placeholder="e.g. 50, 100–150" v-bind="fieldAttrs('guests', 'inquiry-guests-error')" />
            </Field>
          </div>

          <Field id="inquiry-needs" label="What do you need?" required :error="errors.needs">
            <Textarea
              v-model="needs"
              rows="4"
              placeholder="e.g. DJ + show dancers for a salsa wedding party, 3 hours, with a mojito bar…"
              required
              v-bind="fieldAttrs('needs', 'inquiry-needs-error')"
            />
          </Field>

          <div class="grid sm:grid-cols-2 gap-4">
            <Field id="inquiry-name" label="Your name" optional :error="errors.name">
              <Input v-model="name" placeholder="Name" autocomplete="name" v-bind="fieldAttrs('name', 'inquiry-name-error')" />
            </Field>
            <Field id="inquiry-email" label="Your email" required :error="errors.email">
              <Input
                v-model="email"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                required
                v-bind="fieldAttrs('email', 'inquiry-email-error')"
              />
            </Field>
          </div>

          <p v-if="submitError" class="text-sm font-bold text-destructive font-sans">
            {{ submitError }}
          </p>

          <Button type="submit" variant="cta" size="lg" class="w-full px-7 font-sans" :loading="submitting">
            {{ submitting ? 'Sending…' : 'Send request' }}
          </Button>
        </form>

        <div class="mt-3 text-sm text-center font-hand text-secondary">
          — we usually respond same day
        </div>
      </div>

      <!-- Initial CTA button -->
      <div v-else class="text-center">
        <h2 class="text-3xl sm:text-4xl leading-tight">
          Tell us <em class="italic text-primary">about your night.</em>
        </h2>
        <p class="mt-4 text-sm sm:text-base text-muted-foreground font-sans">
          One reply, no forms. We come back with a plan you can send to your partner or your CFO.
        </p>
        <Button type="button" variant="cta" size="lg" class="mt-8 h-auto min-h-11 whitespace-normal px-7 py-3" @click="openForm">
          Tell us about your event <ArrowRight aria-hidden="true" />
        </Button>
        <div class="mt-3 text-sm font-hand text-secondary">
          — we usually respond same day
        </div>
      </div>
    </section>

    <!-- CROSS-LINKS -->
    <section class="max-w-3xl mx-auto px-4 pb-16 space-y-3">
      <NuxtLink
        to="/for-venues"
        class="rounded-2xl bg-white p-6 border flex items-center justify-between gap-4 transition-all hover:-translate-y-0.5 border-border"
       
      >
        <div>
          <div class="text-lg font-bold text-foreground">Have a venue? List it on WeDance.</div>
          <div class="mt-1 text-sm leading-relaxed text-muted-foreground font-sans">
            Get booking requests from dance organizers looking for a space.
          </div>
        </div>
        <span class="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider whitespace-nowrap text-primary font-sans">
          For venues <ArrowRight class="w-3.5 h-3.5" />
        </span>
      </NuxtLink>
    </section>

    </main>

    <SiteFooter />
  </div>
</template>
