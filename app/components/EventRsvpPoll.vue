<script setup lang="ts">
/**
 * The event RSVP as the organiser's own poll (RAZ-718), and the page's only
 * "Going?" (RAZ-731 — it sits in the hero, in place of the Going button):
 *   With my partner · I follow, need a leader · I lead, need a follower
 * (non-partner styles: I'm going · With a friend). Counts show before you
 * answer. There is no "Next time" row: tapping your answer again takes it back
 * (stored as `next`, which also follows the organiser). A tap counts at once — signed out it's saved unconfirmed against
 * this browser, and a sheet asks for an email only: the magic link carries the
 * event and the answer (/auth/verify?redirect=/events/<id>&do=<answer>&guest=…)
 * and lands back here confirmed, no /onboarding detour. Signed in: one tap, no
 * sheet. A confirmed "I need a leader" sees who needs a follower, with a wave.
 */
import { Check, Hand, Mail } from 'lucide-vue-next'
import { Button } from '~/components/ui/button'
import { RsvpEmailSchema } from '#shared/validation'
import { rsvpOptions, type RsvpAnswer } from '#shared/utils/rsvp'
import { eventLocalDate } from '#shared/utils/eventTime'
import { initialsOf } from '#shared/utils/initials'

const props = defineProps<{
  /** Event id (or its /events/<param>). */
  eventId: string
  /** The event page path the magic link returns to. */
  path: string
  startDate: string
  endDate?: string | null
  timezone?: string | null
  organizerName?: string | null
  surface: string
}>()

type Poll = Awaited<ReturnType<ReturnType<typeof useNuxtApp>['$trpc']['rsvp']['poll']['query']>>
const emit = defineEmits<{ poll: [Poll] }>()

const { $trpc } = useNuxtApp()
const { isSignedIn, requestMagicLink } = useAuth()

const poll = ref<Poll | null>(null)
const allOptions = computed(() => rsvpOptions(poll.value?.partner ?? true))
const options = computed(() => allOptions.value.filter(o => o.id !== 'next'))
const mine = computed(() => poll.value?.mine ?? null)
const myOption = computed(() => allOptions.value.find(o => o.id === mine.value?.answer))
const going = computed(() => !!mine.value && mine.value.answer !== 'next')
const maxVotes = computed(() => Math.max(1, ...options.value.map(o => poll.value?.counts[o.id] ?? 0)))

// "Going today?" / "Going? · Thu 29 Oct" in the event's zone. No time: the
// event's start can be the party while classes start earlier (RAZ-731).
const tz = computed(() => props.timezone || 'Europe/Berlin')
const question = computed(() => {
  const day = eventLocalDate(props.startDate, tz.value)
  const now = Date.now()
  const label = day === eventLocalDate(new Date(now), tz.value)
    ? 'today'
    : day === eventLocalDate(new Date(now + 86400_000), tz.value)
      ? 'tomorrow'
      : new Date(props.startDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz.value })
  return label === 'today' || label === 'tomorrow' ? `Going ${label}?` : `Going? · ${label}`
})
const ended = computed(() => {
  const end = props.endDate ? new Date(props.endDate) : new Date(new Date(props.startDate).getTime() + 3 * 3600_000)
  return end.getTime() < Date.now()
})

// The anonymous browser's key for its unconfirmed answer.
const GUEST_KEY = 'wd-rsvp-guest'
function guestToken(): string | undefined {
  if (!import.meta.client) return undefined
  let t = localStorage.getItem(GUEST_KEY)
  if (!t) { t = crypto.randomUUID(); localStorage.setItem(GUEST_KEY, t) }
  return t
}

function setPoll(p: Poll) {
  poll.value = p
  emit('poll', p)
}

async function load() {
  try { setPoll(await $trpc.rsvp.poll.query({ event: props.eventId, guestToken: guestToken() })) }
  catch { /* the page still works without the poll */ }
}
onMounted(load)
watch(isSignedIn, load)

const busy = ref(false)
const error = ref('')
async function pick(picked: RsvpAnswer) {
  if (busy.value) return
  // Your answer again = not going after all.
  const answer: RsvpAnswer = mine.value?.answer === picked ? 'next' : picked
  busy.value = true; error.value = ''
  const signedIn = isSignedIn.value
  try {
    setPoll(await $trpc.rsvp.answer.mutate({ event: props.eventId, answer, guestToken: guestToken() }))
    useTrack().track('rsvp_answered', { answer, signed_in: signedIn, surface: props.surface, event_id: poll.value?.eventId })
    if (!signedIn) openSheet()
  } catch {
    error.value = 'Couldn’t save your answer. Please try again.'
  } finally { busy.value = false }
}

// The follow-up sheet: an email only — the answer already says the rest.
const sheetOpen = ref(false)
const sent = ref(false)
const sending = ref(false)
const form = reactive({ email: '' })
const { errors, validate, fieldAttrs, reset } = useFormValidation(RsvpEmailSchema, form)
function openSheet() {
  sent.value = false; reset()
  sheetOpen.value = true
}
async function sendLink() {
  const result = validate()
  if (!result.success || !mine.value) return
  sending.value = true; error.value = ''
  try {
    await requestMagicLink({ email: result.data.email, redirect: props.path, do: mine.value.answer, guest: guestToken() })
    sent.value = true
  } catch {
    error.value = 'Couldn’t send the link. Please try again.'
  } finally { sending.value = false }
}

const org = computed(() => props.organizerName || 'The organiser')
const sheetTitle = computed(() => mine.value?.answer === 'next' ? 'Next time it is' : 'You’re on the list')
const sheetBody = computed(() => mine.value?.answer === 'next'
  ? `Confirm with your email and you’ll follow ${props.organizerName || 'the organiser'} for the next date.`
  : `${org.value} sees your answer now. Confirm it with your email: we’ll send you a link, no password.`)

// Pairing: wave at someone whose need fits yours.
const pairTitle = computed(() => mine.value?.answer === 'needLeader' ? 'Leaders looking for a follower' : 'Followers looking for a leader')
const waving = ref<string | null>(null)
async function wave(dancerId: string) {
  if (!poll.value) return
  waving.value = dancerId
  try {
    await $trpc.wave.send.mutate({ festivalSlug: poll.value.eventId, targetDancerId: dancerId })
    useTrack().track('wave_sent', { festival: poll.value.eventId, surface: 'rsvp_pairing' })
    const m = poll.value.matches.find(x => x.dancerId === dancerId)
    if (m) m.waved = true
  } catch { /* stays un-waved */ } finally { waving.value = null }
}
</script>

<template>
  <div v-if="poll && !ended" class="rounded-2xl border border-border bg-card p-4 shadow-wd-card font-sans">
    <div class="flex items-baseline gap-2 mb-3">
      <p class="font-display text-lg leading-tight text-foreground">{{ question }}</p>
      <!-- The going count lives in the hero, once. -->
      <p v-if="poll.unconfirmed" class="ml-auto text-xs text-muted-foreground whitespace-nowrap">
        {{ poll.unconfirmed }} unconfirmed
      </p>
    </div>
    <div class="space-y-1.5" role="group" :aria-label="question">
      <button
        v-for="o in options" :key="o.id" type="button"
        class="relative w-full overflow-hidden rounded-xl border text-left text-sm px-3 py-2.5 flex items-center gap-2 transition-colors disabled:opacity-60"
        :class="mine?.answer === o.id ? 'border-primary' : 'border-border hover:border-foreground/30'"
        :aria-pressed="mine?.answer === o.id"
        :disabled="busy"
        :data-rsvp="o.id"
        @click="pick(o.id)"
      >
        <span class="absolute inset-y-0 left-0 bg-primary/10 transition-all" :style="{ width: `${((poll?.counts[o.id] ?? 0) / maxVotes) * 100}%` }" />
        <span class="relative w-4 h-4 rounded-full border-2 grid place-items-center shrink-0" :class="mine?.answer === o.id ? 'border-primary bg-primary' : 'border-muted-foreground/40'">
          <Check v-if="mine?.answer === o.id" class="w-3 h-3 text-primary-foreground" aria-hidden="true" />
        </span>
        <span class="relative font-semibold text-foreground">{{ o.label }}</span>
        <span class="relative ml-auto text-xs font-bold tabular-nums text-muted-foreground">{{ poll?.counts[o.id] ?? 0 }}</span>
      </button>
    </div>

    <p v-if="error" role="alert" class="mt-2 text-sm font-bold text-primary">{{ error }}</p>
    <p v-else-if="mine && myOption" class="mt-3 text-sm flex flex-wrap items-center gap-x-2 gap-y-1" role="status" data-rsvp-status>
      <template v-if="!going">
        <span class="font-bold text-muted-foreground">Not going this time</span>
        <span v-if="mine.confirmed && organizerName" class="text-muted-foreground">· you follow {{ organizerName }} for the next date</span>
      </template>
      <template v-else-if="mine.confirmed">
        <span class="inline-flex items-center gap-1 font-bold text-wd-green-700"><Check class="size-4" aria-hidden="true" /> You’re going · {{ myOption.short }}</span>
        <span class="text-muted-foreground">· tap again to undo</span>
      </template>
      <template v-else>
        <span class="font-bold text-foreground">You’re going · {{ myOption.short }}</span>
        <span class="text-muted-foreground">· unconfirmed</span>
        <Button type="button" variant="link" size="sm" class="h-auto p-0" @click="openSheet">Confirm with your email</Button>
      </template>
    </p>

    <!-- Pairing: a confirmed "I need a leader" ↔ "I need a follower" -->
    <div v-if="mine?.confirmed && (mine.answer === 'needLeader' || mine.answer === 'needFollower')" class="mt-4 border-t border-border pt-3">
      <p class="text-eyebrow font-black uppercase tracking-widest text-secondary mb-2">{{ pairTitle }}</p>
      <ul v-if="poll?.matches.length" class="space-y-2">
        <li v-for="m in poll.matches" :key="m.dancerId" class="flex items-center gap-3">
          <Avatar class="size-9">
            <AvatarImage v-if="m.photo" :src="m.photo" :alt="m.name" />
            <AvatarFallback>{{ initialsOf(m.name) }}</AvatarFallback>
          </Avatar>
          <span class="text-sm font-bold text-foreground">{{ m.name }}</span>
          <Button type="button" :variant="m.waved ? 'pill' : 'outline-pill'" size="pill-sm" class="ml-auto" :disabled="m.waved" :loading="waving === m.dancerId" @click="wave(m.dancerId)">
            <Hand aria-hidden="true" /> {{ m.waved ? 'Waved' : 'Wave' }}
          </Button>
        </li>
      </ul>
      <p v-else class="text-sm text-muted-foreground">Nobody to pair with yet. They show up here when they answer.</p>
    </div>

    <Dialog v-model:open="sheetOpen">
      <DialogContent class="sm:max-w-md border-0 p-0 overflow-hidden bg-background text-foreground font-display">
        <div class="h-1.5 bg-primary" />
        <div class="px-6 pb-6 pt-4">
          <DialogHeader class="text-left space-y-1">
            <DialogTitle class="text-2xl leading-tight text-foreground font-display">{{ sent ? 'Check your email' : sheetTitle }}</DialogTitle>
            <DialogDescription class="text-muted-foreground font-sans">
              <template v-if="sent">Open the link to confirm “{{ myOption?.short }}”. It brings you straight back to this event.</template>
              <template v-else>{{ sheetBody }}</template>
            </DialogDescription>
          </DialogHeader>
          <form v-if="!sent" class="space-y-4 pt-4 font-sans" novalidate @submit.prevent="sendLink">
            <Field id="rsvp-email" label="Email" :error="errors.email">
              <Input v-model="form.email" type="email" placeholder="you@example.com" autocomplete="email" required v-bind="fieldAttrs('email', 'rsvp-email-error')" />
            </Field>
            <Button type="submit" variant="pill" size="lg" class="w-full" :loading="sending"><Mail /> Send me the link</Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>
