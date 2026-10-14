<script setup lang="ts">
/**
 * The booking request form on /@handle/book: anyone asks to book an artist or
 * venue, no account needed (inquiries.send). The page's team is emailed and
 * answers by email; the asker's address is only shown to them.
 */
import { Check, Send, ArrowLeft } from 'lucide-vue-next'
import { INQUIRY_WHAT } from '#shared/utils/bookingInquiry'

const props = defineProps<{ profile: { username: string; name: string; type: string; city?: string | null } }>()

const { $trpc } = useNuxtApp()
const { dancerName } = useAuth()

const blank = () => ({ name: dancerName.value || '', email: '', organization: '', what: '', eventDate: '', city: '', guests: '' as string | number, budget: '', message: '', website: '' })
const form = reactive(blank())
const errors = ref<Record<string, string>>({})
const busy = ref(false)
const err = ref('')
const done = ref<null | 'team' | 'wedance'>(null)

function again() { Object.assign(form, blank()); done.value = null }

const options = computed(() => INQUIRY_WHAT[props.profile.type as 'artist' | 'venue' | 'organizer'] ?? INQUIRY_WHAT.artist)
const firstName = computed(() => props.profile.type === 'artist' ? props.profile.name.split(/\s+/)[0] : props.profile.name)
const today = new Date().toISOString().slice(0, 10)

function check() {
  const e: Record<string, string> = {}
  if (!form.name.trim()) e.name = 'Your name'
  if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) e.email = 'An email they can answer'
  if (!form.what) e.what = 'What it’s for'
  if (form.message.trim().length < 10) e.message = 'A few words about it'
  errors.value = e
  return !Object.keys(e).length
}

async function send() {
  err.value = ''
  if (!check()) return
  busy.value = true
  try {
    const r = await $trpc.inquiries.send.mutate({
      handle: props.profile.username,
      name: form.name, email: form.email, organization: form.organization, what: form.what,
      eventDate: form.eventDate, city: form.city, guests: form.guests ? Number(form.guests) : null,
      budget: form.budget, message: form.message, website: form.website,
    })
    done.value = (r as any).delivered ?? 'team'
    useTrack().track('booking_inquiry_sent', { profile: props.profile.username, type: props.profile.type, what: form.what })
  } catch (e: any) { err.value = e?.message || 'Couldn’t send it. Try again.' } finally { busy.value = false }
}
</script>

<template>
  <div class="font-sans">
    <form v-if="!done" class="grid gap-3" novalidate @submit.prevent="send">
      <Field id="inq-what" label="What for" :error="errors.what" required>
        <Select v-model="form.what" :options="options" placeholder="Choose one" />
      </Field>
      <div class="grid gap-3 sm:grid-cols-2">
        <Field id="inq-date" label="Date" optional><Input v-model="form.eventDate" type="date" :min="today" /></Field>
        <Field id="inq-city" label="City" optional><Input v-model="form.city" placeholder="Where the event is" /></Field>
        <Field id="inq-guests" label="How many people" optional><Input v-model="form.guests" type="number" min="1" inputmode="numeric" /></Field>
        <Field id="inq-budget" label="Budget" optional><Input v-model="form.budget" placeholder="e.g. €300 + travel" /></Field>
      </div>
      <Field id="inq-message" label="About it" :error="errors.message" required>
        <Textarea v-model="form.message" rows="5" :placeholder="profile.type === 'venue' ? 'The event, the times, what you need from the space.' : 'The event, what you’d like them to do, the times, travel and stay.'" />
      </Field>
      <div class="grid gap-3 sm:grid-cols-2">
        <Field id="inq-name" label="Your name" :error="errors.name" required><Input v-model="form.name" autocomplete="name" /></Field>
        <Field id="inq-email" label="Your email" :error="errors.email" hint="Only they see it." required><Input v-model="form.email" type="email" autocomplete="email" /></Field>
      </div>
      <Field id="inq-org" label="Your school, event or company" optional><Input v-model="form.organization" autocomplete="organization" /></Field>
      <!-- Honeypot: hidden from people, filled in by bots. -->
      <input v-model="form.website" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="absolute -left-[9999px] h-0 w-0 opacity-0">
      <p v-if="err" class="text-sm text-destructive" role="alert">{{ err }}</p>
      <Button type="submit" variant="cta" size="lg" class="mt-1" :disabled="busy"><Send aria-hidden="true" /> {{ busy ? 'Sending…' : `Send to ${firstName}` }}</Button>
    </form>
    <div v-else class="py-6 text-center" role="status">
      <div class="mx-auto grid size-12 place-items-center rounded-full bg-wd-green-600/10 text-wd-green-700"><Check class="size-6" aria-hidden="true" /></div>
      <h2 class="mt-3 font-display text-2xl">Sent</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        {{ done === 'team' ? `${firstName} got it by email and will answer you at ${form.email}.` : `${firstName} doesn’t run this page yet, so WeDance passes it on. They’ll answer you at ${form.email}.` }}
      </p>
      <div class="mt-5 flex flex-wrap justify-center gap-2">
        <Button variant="outline-pill" as-child><NuxtLink :to="`/@${profile.username}`"><ArrowLeft /> {{ profile.name }}’s page</NuxtLink></Button>
        <Button type="button" variant="ghost" @click="again">Send another</Button>
      </div>
    </div>
  </div>
</template>
