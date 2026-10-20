<script setup lang="ts">
/**
 * /confirm/<token> — the page an artist opens from an organizer's link (or a
 * venue asked to host the event: then it answers can host · another date ·
 * no, with its terms, instead of the line-up questions). First:
 * check and approve what the organizer needs (name, photos, video, bio,
 * Instagram), change it, or add more. Then, when nobody owns the page yet:
 * create an account with email and password and the page is theirs.
 *
 * /confirm/@<handle> is the same page for someone who already manages it
 * (from "Needs you" on the Business home): it needs them signed in.
 */
import { VENUE_INCLUDES } from '#shared/types/venueAsk'
import { Check, X, ImagePlus, Loader2, Star, Plus, Clock, PartyPopper, Instagram, MapPin, CalendarDays, Users, ExternalLink, ThumbsUp, MessageSquare } from 'lucide-vue-next'
import { videoEmbedUrl } from '#shared/utils/video'

definePageMeta({ layout: false })
useHead({ title: 'Your answer | WeDance', meta: [{ name: 'robots', content: 'noindex' }] })

const route = useRoute()
const { $trpc } = useNuxtApp()
const { isSignedIn, register } = useAuth()
const param = computed(() => String(route.params.token))
const key = computed(() => (param.value.startsWith('@') ? { username: param.value.slice(1) } : { token: param.value }))

type Data = Awaited<ReturnType<typeof $trpc.artistInvites.get.query>>
const data = ref<Data | null>(null)
const error = ref<string | null>(null)
const step = ref<'check' | 'account' | 'done'>('check')

// The answer, built up on the page.
const form = reactive({ name: '', bio: '', city: '', styles: [] as string[], instagram: '', website: '', facebook: '', mainPhoto: null as string | null, address: '', floorType: '' })
// Fields the organizer may have suggested a new value for (shown as "Use theirs / Keep mine").
const FIELDS = [
  { kind: 'name', label: 'Name' }, { kind: 'bio', label: 'About' }, { kind: 'city', label: 'City' }, { kind: 'styles', label: 'Dance styles' },
  { kind: 'instagram', label: 'Instagram' }, { kind: 'website', label: 'Website' }, { kind: 'facebook', label: 'Facebook' },
] as const
type FieldKind = (typeof FIELDS)[number]['kind']
const show = (k: FieldKind, v: string) => (k === 'styles' ? (JSON.parse(v) as string[]).join(', ') : v) || '(empty)'
function setField(k: FieldKind, v: string) {
  if (k === 'styles') form.styles = JSON.parse(v || '[]')
  else (form as any)[k] = v
}
const currentValue = (k: FieldKind) => {
  const p = data.value!.profile as any
  return k === 'styles' ? JSON.stringify(p.styles ?? []) : (p[k] ?? '')
}
const decisions = ref<Record<string, boolean>>({})
const removePhotos = ref<string[]>([])
const addPhotos = ref<string[]>([])
const addVideos = ref<string[]>([])

async function load() {
  error.value = null
  try {
    data.value = await $trpc.artistInvites.get.query(key.value)
    const p = data.value.profile
    Object.assign(form, { name: p.name, bio: p.bio, city: p.city, styles: [...p.styles], instagram: p.instagram, website: p.website, facebook: p.facebook, mainPhoto: p.photo, address: p.address, floorType: p.floorType })
    // Approve what the organizer sent by default (the field shows it); the artist turns off what's wrong.
    decisions.value = Object.fromEntries(data.value.pending.map(s => [s.id, true]))
    for (const s of data.value.pending) if (FIELDS.some(f => f.kind === s.kind)) setField(s.kind as FieldKind, s.value)
  } catch (e: any) {
    error.value = e?.message || 'This link doesn’t work.'
  }
}
onMounted(load)
watch(isSignedIn, () => load())

const pendingFields = computed(() => (data.value?.pending ?? [])
  .filter(s => FIELDS.some(f => f.kind === s.kind) && s.value !== currentValue(s.kind as FieldKind))
  .map(s => ({ ...s, label: FIELDS.find(f => f.kind === s.kind)!.label })))
function useTheirs(id: string, theirs: boolean) {
  const s = data.value?.pending.find(x => x.id === id)
  if (!s) return
  decisions.value[id] = theirs
  setField(s.kind as FieldKind, theirs ? s.value : currentValue(s.kind as FieldKind))
}
const pendingPhotos = computed(() => data.value?.pending.filter(s => s.kind === 'photo') ?? [])
const pendingVideos = computed(() => data.value?.pending.filter(s => s.kind === 'video') ?? [])
const currentPhotos = computed(() => (data.value?.profile.photos ?? []).map(p => p.url).filter(u => !removePhotos.value.includes(u)))
const toggleRemove = (url: string) => {
  const i = removePhotos.value.indexOf(url)
  i > -1 ? removePhotos.value.splice(i, 1) : removePhotos.value.push(url)
  if (form.mainPhoto === url) form.mainPhoto = null
}

const uploading = ref(false)
async function upload(e: Event) {
  const input = e.target as HTMLInputElement
  const files = Array.from(input.files ?? []).filter(f => f.type.startsWith('image/'))
  input.value = ''
  uploading.value = true
  try {
    for (const f of files) {
      const body = new FormData()
      body.append('file', f)
      const res = await fetch('/api/media/image?folder=profiles', { method: 'POST', body })
      if (!res.ok) throw new Error()
      addPhotos.value.push((await res.json()).url)
    }
  } catch {
    error.value = 'A photo didn’t upload. Try again.'
  } finally {
    uploading.value = false
  }
}
const newVideo = ref('')
const videoError = ref<string | null>(null)
function addVideo() {
  const e = videoEmbedUrl(newVideo.value)
  if (!e) { videoError.value = 'Paste a YouTube or Vimeo link.'; return }
  videoError.value = null
  if (!addVideos.value.includes(e)) addVideos.value.push(e)
  newVideo.value = ''
}

// The line-up answers.
const answer = reactive({ participation: null as 'confirmed' | 'declined' | null, programmeOk: null as boolean | null, programmeNote: '', postsOk: false, message: '' })
watch(data, (d) => {
  const a = d?.answer
  if (!a) return
  answer.participation = a.status === 'invited' ? null : a.status
  answer.programmeOk = a.programmeOk
  answer.programmeNote = a.programmeNote ?? ''
  answer.postsOk = a.postsOk
  answer.message = a.message ?? ''
})
const declined = computed(() => answer.participation === 'declined')

// A venue's answer.
const isVenue = computed(() => data.value?.kind === 'venue')
const venue = reactive({ answer: null as 'confirmed' | 'proposed' | 'declined' | null, alternative: '', rent: '', minSpend: '', doorSplit: '', deposit: '', capacity: null as number | null, includes: [] as string[], notes: '' })
watch(data, (d) => {
  if (d?.kind !== 'venue' || !d.ask) return
  const st = d.answer?.status
  venue.answer = st && st !== 'invited' ? st : null
  venue.alternative = d.ask.alternative ?? ''
  const t = d.ask.terms ?? {}
  Object.assign(venue, { rent: t.rent ?? '', minSpend: t.minSpend ?? '', doorSplit: t.doorSplit ?? '', deposit: t.deposit ?? '', capacity: t.capacity ?? null, includes: [...(t.includes ?? [])], notes: t.notes ?? '' })
})
const toggleInclude = (x: string) => { venue.includes = venue.includes.includes(x) ? venue.includes.filter(y => y !== x) : [...venue.includes, x] }
const FLOORS = ['Wood', 'Parquet', 'Dance floor (vinyl)', 'Tiles', 'Concrete', 'Stone']
const fmtDays = (e: NonNullable<Data['event']>) => {
  const f = (d: string, o: Intl.DateTimeFormatOptions) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { ...o, timeZone: 'UTC' })
  return e.endDay && e.endDay !== e.startDay
    ? `${f(e.startDay, { weekday: 'short', day: 'numeric', month: 'short' })} – ${f(e.endDay, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`
    : `${f(e.startDay, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${e.startTime}`
}
const fmtSession = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })

const saving = ref(false)
async function save() {
  if (isVenue.value && !venue.answer) { error.value = 'Tell them whether you can host it.'; return }
  if (isVenue.value && venue.answer === 'proposed' && !venue.alternative.trim()) { error.value = 'Say which dates would work.'; return }
  if (!isVenue.value && data.value?.event && !answer.participation) { error.value = 'Tell them whether you’re in.'; return }
  if (data.value?.event && !declined.value && answer.programmeOk === false && !answer.programmeNote.trim()) { error.value = 'Say what’s wrong with the programme.'; return }
  if (!form.name.trim()) { error.value = 'Add your name.'; return }
  saving.value = true
  error.value = null
  try {
    await $trpc.artistInvites.respond.mutate({
      ...key.value,
      decisions: Object.entries(decisions.value).map(([id, approve]) => ({ id, approve })),
      name: form.name.trim(),
      bio: form.bio,
      city: form.city,
      styles: form.styles,
      instagram: form.instagram,
      website: form.website,
      facebook: form.facebook,
      addPhotos: addPhotos.value,
      addVideos: addVideos.value,
      removePhotos: removePhotos.value,
      mainPhoto: form.mainPhoto,
      ...(isVenue.value ? {
        venueAnswer: venue.answer!,
        alternative: venue.alternative,
        ...(venue.answer !== 'declined' ? { terms: { rent: venue.rent, minSpend: venue.minSpend, doorSplit: venue.doorSplit, deposit: venue.deposit, capacity: venue.capacity || null, includes: venue.includes, notes: venue.notes } } : {}),
        address: form.address,
        floorType: form.floorType,
        message: answer.message,
      } : data.value?.event ? {
        participation: answer.participation!,
        ...(declined.value ? {} : { programmeOk: answer.programmeOk ?? true, programmeNote: answer.programmeNote, postsOk: answer.postsOk }),
        message: answer.message,
      } : {}),
    })
    // Nobody owns the page yet → offer it to them; else done.
    step.value = data.value && !data.value.managed && 'token' in key.value && !(isVenue.value ? venue.answer === 'declined' : declined.value) ? 'account' : 'done'
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (e: any) {
    error.value = e?.message || 'Couldn’t save. Try again.'
  } finally {
    saving.value = false
  }
}

// Step two: own the page (sign up, or with the account they're signed in with).
const account = reactive({ email: '', password: '' })
const accountError = ref<string | null>(null)
const claiming = ref(false)
async function claim() {
  if (!('token' in key.value)) return
  claiming.value = true
  accountError.value = null
  const isSignedInBefore = isSignedIn.value
  try {
    if (!isSignedIn.value) {
      if (!/^\S+@\S+\.\S+$/.test(account.email)) throw new Error('Add your email.')
      if (account.password.length < 8) throw new Error('The password needs at least 8 characters.')
      await register({ name: form.name.trim(), email: account.email, password: account.password })
    }
    await $trpc.artistInvites.claim.mutate({ token: param.value })
    useTrack().track('profile_claimed', { via: 'invite', new_account: !isSignedInBefore })
    step.value = 'done'
  } catch (e: any) {
    accountError.value = e?.message || 'Couldn’t create the account.'
  } finally {
    claiming.value = false
  }
}
const showSignIn = ref(false)
const fmtDate = (d: string | Date | null, tz?: string | null) => d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz || 'Europe/Berlin' }) : ''
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <SiteHeader />
    <main class="mx-auto max-w-2xl px-4 py-10 font-sans">
      <AdminState v-if="!data && !error" kind="loading" />
      <AdminState v-else-if="!data" kind="error" :message="error!" />

      <template v-else>
        <!-- Done -->
        <section v-if="step === 'done'" class="rounded-2xl border bg-card p-6 text-center shadow-wd-card">
          <PartyPopper class="mx-auto size-8 text-primary" aria-hidden="true" />
          <h1 class="mt-2 font-display text-2xl font-bold">Thank you, {{ form.name }}</h1>
          <p v-if="isVenue" class="mt-1 text-sm text-muted-foreground">{{ data.event?.host?.name || 'The organizer' }} sees your answer{{ data.event ? ` for ${data.event.name}` : '' }} and will get back to you.</p>
          <p v-else class="mt-1 text-sm text-muted-foreground">Your page is up to date{{ data.event ? ` and ${data.event.host?.name || 'the organizer'} can use it for ${data.event.name}` : '' }}.</p>
          <div class="mt-5 flex flex-wrap justify-center gap-2">
            <Button variant="pill" as-child><NuxtLink :to="`/@${data.profile.username}`">See your page</NuxtLink></Button>
            <Button v-if="isSignedIn" variant="outline-pill" as-child><NuxtLink :to="`/business/network/${data.profile.username}`">Manage it in Business</NuxtLink></Button>
          </div>
        </section>

        <!-- Make it yours -->
        <section v-else-if="step === 'account'" class="rounded-2xl border bg-card p-6 shadow-wd-card">
          <p class="flex items-center gap-1.5 text-sm font-bold text-wd-green-700"><Check class="size-4" aria-hidden="true" /> Saved. Thank you!</p>
          <h1 class="mt-2 font-display text-2xl font-bold">Make this page yours</h1>
          <p class="mt-1 text-sm text-muted-foreground">{{ isVenue ? 'Nobody manages your venue’s page on WeDance yet. Take it over to answer organizers in one place, keep your photos and details right, and show your events.' : 'Nobody manages your WeDance page yet. Take it over to keep it up to date, get booked, and see where you’re playing and teaching.' }}</p>
          <form class="mt-5 grid gap-3" novalidate @submit.prevent="claim">
            <template v-if="!isSignedIn">
              <Field id="acc-email" label="Email"><Input v-model="account.email" type="email" autocomplete="email" /></Field>
              <Field id="acc-password" label="Password" hint="At least 8 characters."><Input v-model="account.password" type="password" autocomplete="new-password" /></Field>
            </template>
            <p v-else class="text-sm">You’re signed in: it becomes part of your account.</p>
            <p v-if="accountError" class="text-sm text-destructive" role="alert">{{ accountError }}</p>
            <div class="flex flex-wrap items-center gap-3">
              <Button type="submit" variant="pill" :loading="claiming">{{ isSignedIn ? 'Make it mine' : 'Create my account' }}</Button>
              <button v-if="!isSignedIn" type="button" class="text-xs font-bold text-secondary hover:underline" @click="showSignIn = true">I already have an account</button>
              <button type="button" class="text-xs text-muted-foreground hover:underline" @click="step = 'done'">Not now</button>
            </div>
          </form>
          <SignUpModal v-model:open="showSignIn" action="signin" />
        </section>

        <!-- Check the details -->
        <template v-else>
          <p class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">WeDance</p>
          <h1 class="mt-1 font-display text-3xl font-bold">
            <template v-if="isVenue">{{ data.event?.host?.name || 'An organizer' }} would like to hold {{ data.event?.name || 'their event' }} at {{ data.profile.name }}</template>
            <template v-else>{{ data.event ? `${data.event.host?.name || 'An organizer'} added you to ${data.event.name}` : 'Your page on WeDance' }}</template>
          </h1>
          <p v-if="isVenue" class="mt-1 text-sm text-muted-foreground">Can you host it? Say yes, suggest another date, or no, and your terms. It takes a minute.</p>
          <p v-else-if="data.event" class="mt-1 text-sm text-muted-foreground">You’re in their line-up. A few quick checks, then they can promote you right.</p>
          <div v-if="data.ask?.outcome" class="mt-4 rounded-2xl p-4 text-sm" :class="data.ask.outcome === 'booked' ? 'bg-wd-green-700/10' : 'bg-muted'">
            <p class="font-bold">{{ data.ask.outcome === 'booked' ? 'You’re booked 🎉' : 'They booked another venue for this one' }}</p>
            <p class="text-muted-foreground">{{ data.ask.outcome === 'booked' ? `${data.event?.host?.name || 'The organizer'} picked ${data.profile.name}. Sort out the details with them directly.` : 'Thanks for answering. Your page stays up to date for the next organizer who asks.' }}</p>
          </div>

          <!-- 1 · About the event -->
          <section v-if="data.event" class="mt-6 rounded-2xl border bg-card p-4">
            <p class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">About the event</p>
            <h2 class="mt-1 font-display text-xl font-bold">{{ data.event.name }} <span v-if="data.event.type" class="text-sm font-normal text-muted-foreground">· {{ data.event.type }}</span></h2>
            <p class="mt-2 flex items-start gap-1.5 text-sm"><CalendarDays class="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> {{ fmtDays(data.event) }}</p>
            <p v-if="data.event.venue && !isVenue" class="mt-1 flex items-start gap-1.5 text-sm"><MapPin class="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>{{ data.event.venue }}<template v-if="data.event.address">, {{ data.event.address }}</template><template v-if="data.event.otherVenues.length"><br><span class="text-muted-foreground">Also at: {{ data.event.otherVenues.join(' · ') }}</span></template></span>
            </p>
            <p v-if="data.event.host" class="mt-1 flex items-start gap-1.5 text-sm"><Users class="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span>Organized by <NuxtLink v-if="data.event.host.username" :to="`/@${data.event.host.username}`" target="_blank" class="font-bold hover:underline">{{ data.event.host.name }}</NuxtLink><span v-else class="font-bold">{{ data.event.host.name }}</span><template v-if="data.event.host.instagram"> · <a :href="data.event.host.instagram" target="_blank" rel="noopener" class="hover:underline">Instagram</a></template></span>
            </p>
            <DanceStyleChips :styles="data.event.styles" class="mt-2" />
            <p v-if="data.event.description" class="mt-3 line-clamp-4 text-sm text-muted-foreground">{{ data.event.description }}</p>
            <p v-if="data.event.stats.workshops || data.event.stats.parties || data.event.stats.planning" class="mt-2 text-xs text-muted-foreground">
              {{ [data.event.stats.workshops && `${data.event.stats.workshops} workshops`, data.event.stats.parties && `${data.event.stats.parties} parties`, data.event.stats.planning && `${data.event.stats.planning} dancers planning to come`].filter(Boolean).join(' · ') }}
            </p>
            <div v-if="isVenue && data.ask" class="mt-3 rounded-xl bg-muted/60 p-3 text-sm">
              <p class="font-bold">What they need</p>
              <p v-if="data.ask.request.guests">About {{ data.ask.request.guests }} dancers</p>
              <p v-if="data.ask.request.needs?.length">{{ data.ask.request.needs.join(' · ') }}</p>
              <p v-if="data.ask.request.note" class="text-muted-foreground">“{{ data.ask.request.note }}”</p>
            </div>
            <template v-if="data.event.lineup.length">
              <p class="mt-3 text-xs font-bold">{{ isVenue ? 'Line-up' : 'Also in the line-up' }}</p>
              <div class="mt-1.5 flex flex-wrap gap-2">
                <span v-for="a in data.event.lineup" :key="a.username" class="inline-flex items-center gap-1.5 rounded-full border bg-background py-0.5 pl-0.5 pr-2 text-xs">
                  <img v-if="a.photo" :src="a.photo" alt="" class="size-5 rounded-full object-cover"><span v-else class="size-5 rounded-full bg-muted" /> {{ a.name }}
                </span>
              </div>
            </template>
            <NuxtLink :to="data.event.path" target="_blank" class="mt-3 inline-flex items-center gap-1 text-xs font-bold text-secondary hover:underline">See the event page <ExternalLink class="size-3" aria-hidden="true" /></NuxtLink>
          </section>

          <div v-if="!data.canAnswer" class="mt-6 rounded-2xl bg-secondary/10 p-4 text-sm">
            <p class="font-bold">This page has an owner.</p>
            <p class="text-muted-foreground">Sign in with the account that manages @{{ data.profile.username }} to approve the changes.</p>
            <Button variant="pill" size="pill-sm" class="mt-3" @click="showSignIn = true">Sign in</Button>
            <SignUpModal v-model:open="showSignIn" action="signin" />
          </div>

          <form v-else class="mt-4 grid gap-4" novalidate @submit.prevent="save">
            <template v-if="isVenue">
              <!-- Can you host it? -->
              <section class="rounded-2xl border bg-card p-4">
                <p class="text-sm font-bold">Can you host it?</p>
                <div class="mt-2 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Can you host it?">
                  <button v-for="o in [{ v: 'confirmed', t: 'Yes, we can', d: 'On that date and time.' }, { v: 'proposed', t: 'Another date', d: 'Suggest when it works.' }, { v: 'declined', t: 'No, sorry', d: 'Not this time.' }]" :key="o.v" type="button" role="radio" :aria-checked="venue.answer === o.v" class="rounded-xl border-2 p-3 text-left text-sm focus-visible:shadow-wd-focus" :class="venue.answer === o.v ? 'border-primary bg-primary/5' : 'border-input'" @click="venue.answer = o.v as any">
                    <span class="font-bold">{{ o.t }}</span><span class="block text-xs text-muted-foreground">{{ o.d }}</span>
                  </button>
                </div>
                <Field v-if="venue.answer === 'proposed'" id="v-alt" label="Which dates work instead?" class="mt-3" hint="E.g. “Friday 16 October”, “any Wednesday in November”.">
                  <Input v-model="venue.alternative" />
                </Field>
              </section>

              <!-- Your terms -->
              <section v-if="venue.answer && venue.answer !== 'declined'" class="rounded-2xl border bg-card p-4">
                <p class="text-sm font-bold">Your terms</p>
                <p class="text-xs text-muted-foreground">Only {{ data.event?.host?.name || 'the organizer' }} sees these. Leave empty what doesn’t apply.</p>
                <div class="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field id="v-rent" label="Rent" optional><Input v-model="venue.rent" placeholder="e.g. €300, or free" /></Field>
                  <Field id="v-min" label="Minimum bar spend" optional><Input v-model="venue.minSpend" placeholder="e.g. €1,500" /></Field>
                  <Field id="v-door" label="Door split" optional><Input v-model="venue.doorSplit" placeholder="e.g. 70/30 for the organizer" /></Field>
                  <Field id="v-dep" label="Deposit" optional><Input v-model="venue.deposit" placeholder="e.g. €200, back after" /></Field>
                  <Field id="v-cap" label="People it holds" optional><Input v-model.number="venue.capacity" type="number" min="1" class="w-32" /></Field>
                </div>
                <p class="mt-3 text-sm font-bold">Included</p>
                <div class="mt-1.5 flex flex-wrap gap-1.5">
                  <Button v-for="x in VENUE_INCLUDES" :key="x" type="button" size="sm" :variant="venue.includes.includes(x) ? 'soft' : 'outline'" :aria-pressed="venue.includes.includes(x)" @click="toggleInclude(x)">{{ x }}</Button>
                </div>
                <Field id="v-notes" label="Anything else about the terms" optional class="mt-3"><Textarea v-model="venue.notes" :rows="2" /></Field>
              </section>
              <p class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Your venue’s page</p>
            </template>
            <template v-else-if="data.event">
              <!-- 2 · I'm in -->
              <section class="rounded-2xl border bg-card p-4">
                <p class="text-sm font-bold">Are you in?</p>
                <div class="mt-2 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Are you in?">
                  <button type="button" role="radio" :aria-checked="answer.participation === 'confirmed'" class="rounded-xl border-2 p-3 text-left text-sm focus-visible:shadow-wd-focus" :class="answer.participation === 'confirmed' ? 'border-primary bg-primary/5' : 'border-input'" @click="answer.participation = 'confirmed'">
                    <span class="font-bold">Yes, I’m in</span><span class="block text-xs text-muted-foreground">You’ll show as confirmed on the event.</span>
                  </button>
                  <button type="button" role="radio" :aria-checked="answer.participation === 'declined'" class="rounded-xl border-2 p-3 text-left text-sm focus-visible:shadow-wd-focus" :class="answer.participation === 'declined' ? 'border-primary bg-primary/5' : 'border-input'" @click="answer.participation = 'declined'">
                    <span class="font-bold">I can’t make it</span><span class="block text-xs text-muted-foreground">They’ll take you off the line-up.</span>
                  </button>
                </div>
              </section>

              <template v-if="!declined">
                <!-- 3 · Your programme -->
                <section class="rounded-2xl border bg-card p-4">
                  <p class="text-sm font-bold">Your programme</p>
                  <ul v-if="data.event.programme.length" class="mt-2 grid gap-1.5">
                    <li v-for="(x, i) in data.event.programme" :key="i" class="rounded-xl bg-background px-3 py-2 text-sm">
                      <span class="font-bold tabular-nums">{{ fmtSession(x.date) }} · {{ x.time }}</span><span v-if="x.duration" class="text-muted-foreground"> · {{ x.duration }} min</span>
                      <span class="block">{{ x.title }}<span v-if="x.with.length" class="text-muted-foreground"> · with {{ x.with.join(' & ') }}</span></span>
                      <span class="block text-xs text-muted-foreground">{{ [x.type === 'party' ? 'Party' : x.style, x.type !== 'party' && x.level, x.room && `Room ${x.room}`, x.venue].filter(Boolean).join(' · ') }}</span>
                    </li>
                  </ul>
                  <p v-else class="mt-1 text-sm text-muted-foreground">No sessions with your name in the programme yet.</p>
                  <div class="mt-3 flex flex-wrap gap-2">
                    <Button type="button" size="sm" :variant="answer.programmeOk === true ? 'soft' : 'outline'" @click="answer.programmeOk = true"><ThumbsUp /> {{ data.event.programme.length ? 'That’s right' : 'OK' }}</Button>
                    <Button type="button" size="sm" :variant="answer.programmeOk === false ? 'soft' : 'outline'" @click="answer.programmeOk = false"><MessageSquare /> Something’s wrong</Button>
                  </div>
                  <Field v-if="answer.programmeOk === false" id="c-prog" label="What should change?" class="mt-2" hint="E.g. “I can only teach Saturday”, “that’s Intermediate”, “I teach it with Ana”.">
                    <Textarea v-model="answer.programmeNote" :rows="3" />
                  </Field>
                </section>

                <!-- 4 · Your posts -->
                <section class="rounded-2xl border bg-card p-4">
                  <p class="text-sm font-bold">Posts about you</p>
                  <div v-if="data.event.flyer" class="mt-2 flex items-start gap-3">
                    <img :src="data.event.flyer.url" alt="The event’s flyer" class="w-28 rounded-lg border">
                    <p class="text-sm text-muted-foreground">The event’s flyer {{ data.event.flyer.pictured ? 'uses your photo' : 'names you' }}. More posts, like your own announcement, will show here before they go out.</p>
                  </div>
                  <p v-else class="mt-1 text-sm text-muted-foreground">Nothing posted yet. Posts about you, like your announcement, will show here before they go out.</p>
                  <label class="mt-3 flex items-start gap-2 text-sm"><Checkbox v-model="answer.postsOk" class="mt-0.5" /> OK to use my name and photos to promote this event</label>
                </section>
              </template>
              <p class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Your page</p>
            </template>
            <!-- Name -->
            <section class="rounded-2xl border bg-card p-4">
              <Field id="c-name" :label="isVenue ? 'The venue’s name' : 'Your name as it should appear'">
                <Input v-model="form.name" />
              </Field>
              <Field id="c-city" label="City" optional class="mt-3"><CityCombobox v-model="form.city" placeholder="e.g. Vienna" /></Field>
              <template v-if="isVenue">
                <Field id="c-address" label="Address" optional class="mt-3"><Input v-model="form.address" placeholder="Street and number, postcode" /></Field>
                <Field id="c-floor" label="Floor" optional class="mt-3"><Select v-model="form.floorType" :options="[{ label: 'Not set', value: '' }, ...[...new Set([...FLOORS, form.floorType].filter(Boolean))].map(f => ({ label: f, value: f }))]" /></Field>
              </template>
              <Field :label="isVenue ? 'Music you host' : 'Dance styles'" :optional="isVenue" class="mt-3"><DanceStylePicker v-model="form.styles" /></Field>
            </section>

            <!-- What the organizer changed, field by field -->
            <section v-if="pendingFields.length" class="rounded-2xl border-2 border-secondary/30 bg-card p-4">
              <p class="flex items-center gap-1.5 text-sm font-bold"><Clock class="size-4 text-muted-foreground" aria-hidden="true" /> Changes from {{ data.event?.host?.name || 'the organizer' }}</p>
              <ul class="mt-2 grid gap-3">
                <li v-for="s in pendingFields" :key="s.id" class="text-sm">
                  <p class="font-bold">{{ s.label }}</p>
                  <p class="text-xs"><span class="text-muted-foreground">Theirs:</span> {{ show(s.kind as any, s.value) }}</p>
                  <p class="text-xs"><span class="text-muted-foreground">Yours now:</span> {{ show(s.kind as any, currentValue(s.kind as any)) }}</p>
                  <div class="mt-1 flex gap-2">
                    <Button type="button" size="sm" :variant="decisions[s.id] ? 'soft' : 'ghost'" @click="useTheirs(s.id, true)">Use theirs</Button>
                    <Button type="button" size="sm" :variant="decisions[s.id] ? 'ghost' : 'soft'" @click="useTheirs(s.id, false)">Keep mine</Button>
                  </div>
                </li>
              </ul>
            </section>

            <!-- Photos -->
            <section class="rounded-2xl border bg-card p-4">
              <p class="text-sm font-bold">Photos</p>
              <p class="text-xs text-muted-foreground">{{ isVenue ? 'The room, the floor, the bar: organizers and dancers look at these. Tap the star for the main one.' : 'Organizers pick from these for flyers. Tap the star for your main photo.' }}</p>
              <div class="mt-3 flex flex-wrap gap-3">
                <div v-for="url in [...currentPhotos, ...addPhotos]" :key="url" class="relative">
                  <img :src="url" alt="Your photo" class="h-32 w-24 rounded-xl border object-cover">
                  <button type="button" class="absolute left-1 top-1 rounded-full bg-card/90 p-1" :aria-label="form.mainPhoto === url ? 'Main photo' : 'Make this the main photo'" :aria-pressed="form.mainPhoto === url" @click="form.mainPhoto = url">
                    <Star class="size-3.5" :class="form.mainPhoto === url ? 'fill-current text-wd-amber-600' : ''" />
                  </button>
                  <button type="button" class="absolute right-1 top-1 rounded-full bg-card/90 p-1" aria-label="Remove this photo" @click="addPhotos.includes(url) ? addPhotos.splice(addPhotos.indexOf(url), 1) : toggleRemove(url)"><X class="size-3.5" /></button>
                </div>
                <label class="flex h-32 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-input text-center text-xs text-muted-foreground has-[:focus-visible]:shadow-wd-focus">
                  <Loader2 v-if="uploading" class="size-5 animate-spin" aria-hidden="true" /><ImagePlus v-else class="size-5" aria-hidden="true" /> Add photos
                  <input type="file" accept="image/*" multiple class="sr-only" @change="upload">
                </label>
              </div>
              <template v-if="pendingPhotos.length">
                <p class="mt-4 flex items-center gap-1.5 text-sm font-bold"><Clock class="size-4 text-muted-foreground" aria-hidden="true" /> Added by {{ data.event?.host?.name || 'an organizer' }}</p>
                <div class="mt-2 flex flex-wrap gap-3">
                  <label v-for="s in pendingPhotos" :key="s.id" class="relative cursor-pointer">
                    <img :src="s.value" alt="Photo the organizer added" class="h-32 w-24 rounded-xl border-2 object-cover" :class="decisions[s.id] ? 'border-primary' : 'border-transparent opacity-50'">
                    <span class="absolute inset-x-1 bottom-1 flex items-center justify-center gap-1 rounded-lg bg-card/90 py-0.5 text-[11px] font-bold">
                      <Checkbox v-model="decisions[s.id]" /> {{ decisions[s.id] ? 'Keep' : 'Don’t use' }}
                    </span>
                  </label>
                </div>
              </template>
            </section>

            <!-- Videos -->
            <section v-if="!isVenue" class="rounded-2xl border bg-card p-4">
              <p class="text-sm font-bold">Videos <span class="font-normal text-muted-foreground">(optional)</span></p>
              <ul class="mt-2 grid gap-1 text-sm">
                <li v-for="v in data.profile.videos" :key="v.url" class="truncate text-muted-foreground">{{ v.url }}</li>
                <li v-for="v in addVideos" :key="v" class="flex items-center gap-2"><span class="truncate">{{ v }}</span><button type="button" aria-label="Remove video" @click="addVideos.splice(addVideos.indexOf(v), 1)"><X class="size-3.5" /></button></li>
                <li v-for="s in pendingVideos" :key="s.id">
                  <label class="flex items-center gap-2"><Checkbox v-model="decisions[s.id]" /> <span class="truncate">{{ s.value }}</span> <span class="shrink-0 text-xs text-muted-foreground">· added by the organizer</span></label>
                </li>
              </ul>
              <div class="mt-2 flex gap-2">
                <Input v-model="newVideo" placeholder="YouTube or Vimeo link" aria-label="Add a video link" class="flex-1" @keydown.enter.prevent="addVideo" />
                <Button type="button" variant="ghost" size="sm" @click="addVideo"><Plus /> Add</Button>
              </div>
              <p v-if="videoError" class="mt-1 text-xs text-destructive" role="alert">{{ videoError }}</p>
            </section>

            <!-- About -->
            <section class="rounded-2xl border bg-card p-4">
              <Field id="c-bio" :label="isVenue ? 'About the venue' : 'About you'" optional :hint="isVenue ? 'Rooms, sound, bar, what kind of nights you host.' : 'A few lines: what you teach or play, where you’re from.'">
                <Textarea v-model="form.bio" :rows="4" />
              </Field>
              <Field id="c-ig" label="Instagram" optional class="mt-3">
                <div class="relative">
                  <Instagram class="absolute left-3.5 top-3.5 size-4 text-muted-foreground" aria-hidden="true" />
                  <Input v-model="form.instagram" class="pl-10" placeholder="instagram.com/yourname" />
                </div>
              </Field>
              <Field id="c-web" label="Website" optional class="mt-3"><Input v-model="form.website" placeholder="https://…" /></Field>
              <Field id="c-fb" label="Facebook" optional class="mt-3"><Input v-model="form.facebook" placeholder="facebook.com/…" /></Field>
            </section>

            <Field v-if="data.event" id="c-msg" label="Anything else for the organizer?" optional>
              <Textarea v-model="answer.message" :rows="2" />
            </Field>
            <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
            <div>
              <Button type="submit" variant="pill" :loading="saving"><Check /> {{ data.event || isVenue ? 'Send my answer' : 'Looks good, save' }}</Button>
            </div>
          </form>
        </template>
      </template>
    </main>
  </div>
</template>
