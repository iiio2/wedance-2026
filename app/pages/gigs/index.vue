<script setup lang="ts">
/**
 * /gigs — the dance scene's opportunity board.
 * Organizers/clients post open roles; artists post service offers.
 * V3 tropical style. Distinct from /artists (which is browse-a-directory):
 * gigs is post-driven — "I need X" or "I offer Y".
 */
import { ArrowRight, MapPin, Calendar, Wallet, Plus, Megaphone, Hand, X } from 'lucide-vue-next'
import { GigSchema } from '#shared/validation'
import { Button } from '~/components/ui/button'
import { Field } from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { CityCombobox } from '~/components/ui/city-combobox'
import { Select } from '~/components/ui/select'
import { Textarea } from '~/components/ui/textarea'
import { WD } from '~/lib/brand'
import { mixHex, readableOn } from '~/lib/contrast'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — Gigs',
  meta: [
    { name: 'description', content: 'The dance scene\'s opportunity board — open roles at festivals and events, and artists offering their services.' },
  ],
})

// tRPC client is provided by app/plugins/01.trpc.ts as `$trpc` (there is no
// `useTRPC` composable — calling it threw "useTRPC is not defined" on load).
const { $trpc } = useNuxtApp()
const { isSignedIn } = useAuth()

const route = useRoute()
const kindParam = (Array.isArray(route.query.kind) ? route.query.kind[0] : route.query.kind) || ''
const kindFilter = ref<'role' | 'offer' | ''>(kindParam === 'role' || kindParam === 'offer' ? kindParam : '')
const categoryFilter = ref('')

// Fetch gigs via the tRPC client (queries are GET; a raw POST to a query 405s).
// The tRPC client is client-only (relative '/api/trpc' URL, no SSR base — see
// app/pages/u/[username].vue), so this must never run during SSR: an SSR fetch
// fails with "Failed to parse URL", the error is hydrated, and the board stays
// empty until a filter changes. `server: false` runs it after hydration on the
// client, and `watch` refetches on every filter change.
const { data: gigs, status: gigsStatus, refresh: refreshGigs } = useAsyncData(
  'gigs-list',
  () => $trpc.gigs.list.query({
    kind: kindFilter.value || undefined,
    category: categoryFilter.value || undefined,
  }),
  { server: false, watch: [kindFilter, categoryFilter] },
)
// With server:false the SSR/hydration status is 'idle' — treat it as loading so
// the page never flashes "No gigs match" before the client fetch starts.
const loadingGigs = computed(() => gigsStatus.value === 'idle' || gigsStatus.value === 'pending')
const gigsFailed = computed(() => gigsStatus.value === 'error')

const allGigs = computed(() => gigs.value || [])
const categories = computed(() => Array.from(new Set(allGigs.value.map((g: any) => g.category))))

function safeHref(url: string | null | undefined): string | undefined {
  if (!url) return undefined
  return /^https?:\/\//i.test(url) ? url : undefined
}

function daysUntil(dateStr?: string | Date): { text: string; urgent: boolean } | null {
  if (!dateStr) return null
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
  const diff = Math.ceil((date.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return { text: 'Closed', urgent: false }
  if (diff === 0) return { text: 'Closes today', urgent: true }
  if (diff <= 14) return { text: `Closes in ${diff}d`, urgent: true }
  return { text: `Closes in ${Math.ceil(diff / 7)}w`, urgent: false }
}

// Form state for creating offerings
const showForm = ref(false)
const formData = reactive({
  kind: 'offer' as 'role' | 'offer',
  category: '',
  title: '',
  posterName: '',
  posterType: 'Artist',
  location: '',
  styles: [] as string[],
  when: '',
  compensation: '',
  deadline: '',
  contactEmail: '',
  contactUrl: '',
  entityUrl: '',
})

// Reset posterType when kind changes so the default matches the available options
watch(() => formData.kind, (newKind) => {
  formData.posterType = newKind === 'role' ? 'Festival' : 'Artist'
})

const styleInput = ref('')
const submittingForm = ref(false)
const formError = ref('')
const formSuccess = ref(false)
const { errors, validate, fieldAttrs } = useFormValidation(GigSchema, formData)

function addStyle() {
  if (styleInput.value.trim()) {
    formData.styles.push(styleInput.value.trim())
    styleInput.value = ''
  }
}

function removeStyle(index: number) {
  formData.styles.splice(index, 1)
}

async function submitForm() {
  if (!isSignedIn.value) {
    formError.value = 'Please sign in to post a gig'
    return
  }

  formError.value = ''
  // The schema trims text and turns blank optional fields into undefined.
  const result = validate()
  if (!result.success) return
  submittingForm.value = true

  try {
    // Mutation through the tRPC client so the session Bearer token is sent.
    await $trpc.gigs.create.mutate(result.data)

    formSuccess.value = true
    formData.kind = 'offer'
    formData.category = ''
    formData.title = ''
    formData.posterName = ''
    formData.posterType = 'Artist'
    formData.location = ''
    formData.styles = []
    formData.when = ''
    formData.compensation = ''
    formData.deadline = ''
    formData.contactUrl = ''
    formData.entityUrl = ''
    styleInput.value = ''

    setTimeout(() => {
      formSuccess.value = false
      showForm.value = false
      refreshGigs()
    }, 2000)
  }
  catch (error: any) {
    formError.value = error?.message || 'Failed to create gig. Please try again.'
  }
  finally {
    submittingForm.value = false
  }
}

function gigMailto(g: any): string | null {
  if (!g.contactEmail) return null
  const applying = g.kind === 'role'
  const subject = applying
    ? `Applying: ${g.title} — ${g.posterName}`
    : `Booking enquiry: ${g.title} — ${g.posterName}`
  const body = applying
    ? `Hi ${g.posterName},\n\nI'd like to apply for "${g.title}" (${g.location}, ${g.when}).\n\nAbout me:\nExperience:\nLinks:\n`
    : `Hi ${g.posterName},\n\nI'd like to enquire about "${g.title}" (${g.location}, ${g.when}).\n\nMy event:\nDate:\nWhat I need:\n`
  return 'mailto:' + g.contactEmail + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body)
}

// Track which gigs the user has clicked Apply/Contact on
const appliedGigs = ref(new Set<string>())

// Applying on WeDance (signed in): my applications, and the applications to the
// gigs I posted. Both client-only, like the board.
const { data: myApplications, refresh: refreshMyApplications } = useAsyncData(
  'gigs-my-applications',
  () => isSignedIn.value ? $trpc.gigs.myApplications.query() : Promise.resolve([]),
  { server: false, watch: [isSignedIn] },
)
const { data: myGigs, refresh: refreshMyGigs } = useAsyncData(
  'gigs-mine',
  () => isSignedIn.value ? $trpc.gigs.applications.query() : Promise.resolve([]),
  { server: false, watch: [isSignedIn] },
)
const myApplicationFor = computed(() => new Map((myApplications.value ?? []).map((a: any) => [a.gig.id, a])))
const myGigIds = computed(() => new Set((myGigs.value ?? []).map((g: any) => g.id)))
const gigsWithApplications = computed(() => (myGigs.value ?? []).filter((g: any) => g.kind === 'role'))

const applyOpen = ref<string | null>(null)
const applyMessage = ref('')
const applyError = ref('')
const applying = ref(false)
function openApply(id: string) {
  applyOpen.value = applyOpen.value === id ? null : id
  applyMessage.value = ''
  applyError.value = ''
}
async function sendApplication(g: any) {
  applyError.value = applyMessage.value.trim().length < 10 ? 'Say a few words about yourself (10 characters or more).' : ''
  if (applyError.value) return
  applying.value = true
  try {
    await $trpc.gigs.applyTo.mutate({ gigId: g.id, message: applyMessage.value.trim() })
    useTrack().track('gig_cta_click', { action: 'apply_on_wedance', gig_id: g.id })
    applyOpen.value = null
    await refreshMyApplications()
  }
  catch (e: any) {
    applyError.value = e?.message || 'Couldn’t send your application. Try again.'
  }
  finally {
    applying.value = false
  }
}

const deciding = ref<string | null>(null)
async function decide(applicationId: string, decision: 'accepted' | 'declined') {
  deciding.value = applicationId
  try {
    await $trpc.gigs.decideApplication.mutate({ applicationId, decision })
    await refreshMyGigs()
  }
  finally {
    deciding.value = null
  }
}
const statusLabel: Record<string, string> = { pending: 'Waiting for an answer', accepted: 'Accepted', declined: 'Declined' }

function handleApply(g: any) {
  useTrack().track('gig_cta_click', { action: g.kind === 'role' ? 'apply' : 'contact', gig_id: g.id })
  appliedGigs.value.add(g.id)
}

const accentColors: { [key: string]: string } = {
  'Teacher': WD.red600,
  'DJ': WD.cyan600,
  'MC': WD.amber500,
  'Performer': WD.purple500,
  'Show': WD.purple500,
  'Photographer': WD.pink500,
  'Organizer': WD.green600,
}

function getAccent(category: string): string {
  return accentColors[category] || WD.brown900
}
// Accent text darkened just enough for 4.5:1 — on white, or on its own tint (chips).
const ink = (c: string) => readableOn(c)
const chipInk = (c: string, alpha = 0.094) => readableOn(c, mixHex(c, '#fff', alpha))
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <!-- V3 header -->
    <SiteHeader />

    <main>

    <!-- HERO -->
    <section class="relative">
      <div class="max-w-4xl mx-auto px-4 pt-12 pb-8 text-center">
        <div class="text-sm tracking-widest uppercase mb-3 text-secondary">The two-way opportunity board</div>
        <h1 class="text-5xl sm:text-6xl leading-[0.98] text-foreground">
          Get booked. <em class="italic text-primary">Hire talent.</em>
        </h1>
        <p class="mt-5 text-base sm:text-lg leading-relaxed max-w-xl mx-auto text-muted-foreground">
          Find open roles at festivals and events. Post your services and book gigs. Organizers and artists — it all happens here.
        </p>

        <div class="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            v-if="isSignedIn"
            type="button"
            variant="cta"
            size="lg"
            class="px-6"
            :aria-expanded="showForm ? 'true' : 'false'"
            @click="showForm = !showForm"
          >
            <Plus aria-hidden="true" /> {{ showForm ? 'Close' : 'Post a gig' }}
          </Button>
          <Button v-else as-child variant="cta" size="lg" class="px-6">
            <a href="/auth/signin"><Plus aria-hidden="true" /> Sign in to post</a>
          </Button>
        </div>

        <!-- Kind toggle -->
        <div class="mt-8 inline-flex rounded-full p-1 bg-white border border-border">
          <Button
            v-for="opt in [{ v: '', label: 'All' }, { v: 'role', label: 'Open roles' }, { v: 'offer', label: 'Services offered' }]"
            :key="opt.v"
            type="button"
            variant="ghost"
            class="h-auto px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
            :class="kindFilter === opt.v ? 'bg-foreground text-background hover:bg-foreground hover:text-background' : 'bg-transparent text-muted-foreground'"
            :aria-pressed="kindFilter === opt.v ? 'true' : 'false'"
            @click="kindFilter = opt.v as 'role' | 'offer' | ''"
          >
            {{ opt.label }}
          </Button>
        </div>

        <!-- Category chips -->
        <div class="flex flex-wrap items-center justify-center gap-2 mt-4">
          <Button
            v-for="cat in categories"
            :key="cat"
            type="button"
            variant="ghost"
            class="h-auto px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
            :class="categoryFilter === cat
              ? 'bg-primary text-white shadow-[0_2px_0_-1px_var(--wd-red-600)] hover:bg-primary hover:text-white'
              : 'bg-white text-secondary border border-border'"
            :aria-pressed="categoryFilter === cat ? 'true' : 'false'"
            @click="categoryFilter = categoryFilter === cat ? '' : cat"
          >
            {{ cat }}
          </Button>
        </div>
      </div>

      <WaveDivider />
    </section>

    <!-- FORM (when user clicks Post a gig) -->
    <section v-if="showForm" class="max-w-2xl mx-auto px-4 mb-8 bg-white rounded-2xl p-6 border-2 border-primary/20">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold text-foreground">{{ formData.kind === 'role' ? 'Post an open role' : 'Offer your services' }}</h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          class="rounded-full [&_svg]:size-5"
          aria-label="Close the form"
          @click="showForm = false"
        >
          <X class="text-foreground" aria-hidden="true" />
        </Button>
      </div>

      <form class="space-y-4" novalidate @submit.prevent="submitForm">
        <!-- Kind toggle -->
        <div role="group" aria-labelledby="gig-kind-label">
          <div id="gig-kind-label" class="text-sm font-bold mb-1.5 text-foreground font-sans">What are you posting?</div>
          <div class="inline-flex rounded-full p-1 w-full bg-background border border-border">
            <Button
              v-for="opt in [{ v: 'role' as const, label: 'I need someone', icon: Megaphone }, { v: 'offer' as const, label: 'I offer my services', icon: Hand }]"
              :key="opt.v"
              type="button"
              variant="ghost"
              class="flex-1 h-auto gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider whitespace-normal transition-all [&_svg]:size-3.5"
              :class="formData.kind === opt.v
                ? (opt.v === 'role' ? 'bg-primary text-white hover:bg-primary hover:text-white' : 'bg-wd-green-700 text-white hover:bg-wd-green-700 hover:text-white')
                : 'bg-transparent text-muted-foreground'"
              :aria-pressed="formData.kind === opt.v ? 'true' : 'false'"
              @click="formData.kind = opt.v"
            >
              <component :is="opt.icon" aria-hidden="true" />
              {{ opt.label }}
            </Button>
          </div>
        </div>

        <!-- Poster type (who is posting) -->
        <Field id="gig-posterType" label="You are a…" :error="errors.posterType">
          <Select
            v-model="formData.posterType"
            v-bind="fieldAttrs('posterType', 'gig-posterType-error')"
            required
          >
            <template v-if="formData.kind === 'role'">
              <option value="Festival">Festival</option>
              <option value="Organizer">Organizer</option>
              <option value="School">School</option>
              <option value="Private event">Private event</option>
            </template>
            <template v-else>
              <option value="Artist">Artist</option>
              <option value="Teacher">Teacher</option>
              <option value="DJ">DJ</option>
              <option value="Photographer">Photographer</option>
              <option value="MC">MC</option>
            </template>
          </Select>
        </Field>

        <!-- Category -->
        <Field id="gig-category" :label="formData.kind === 'role' ? 'Role needed' : 'Service category'" :error="errors.category">
          <Select
            v-model="formData.category"
            v-bind="fieldAttrs('category', 'gig-category-error')"
            required
          >
            <option value="">Select a category</option>
            <option value="Teacher">Teacher</option>
            <option value="DJ">DJ</option>
            <option value="MC">MC</option>
            <option value="Performer">Performer</option>
            <option value="Show">Show</option>
            <option value="Photographer">Photographer</option>
            <option value="Organizer">Organizer</option>
          </Select>
        </Field>

        <!-- Title -->
        <Field id="gig-title" :label="formData.kind === 'role' ? 'Role title' : 'Service title'" :error="errors.title">
          <Input
            v-model="formData.title"
            v-bind="fieldAttrs('title', 'gig-title-error')"
            type="text"
            required
            :placeholder="formData.kind === 'role' ? 'e.g., Salsa teacher needed for weekend festival' : 'e.g., Timba workshops for European festivals'"
          />
        </Field>

        <!-- Your name -->
        <Field id="gig-posterName" :label="formData.kind === 'role' ? 'Organisation / event name' : 'Your name'" :error="errors.posterName">
          <Input
            v-model="formData.posterName"
            v-bind="fieldAttrs('posterName', 'gig-posterName-error')"
            type="text"
            required
            :placeholder="formData.kind === 'role' ? 'e.g., Munich Salsa Festival' : 'Your name or artist name'"
          />
        </Field>

        <!-- Location -->
        <Field id="gig-location" label="Location or base" :error="errors.location">
          <CityCombobox
            v-model="formData.location"
            v-bind="fieldAttrs('location', 'gig-location-error')"
            required
            placeholder="e.g., Munich"
          />
        </Field>

        <!-- Styles -->
        <div>
          <Field id="gig-style-input" label="Dance styles" optional>
            <div class="flex gap-2 mb-2">
              <Input
                v-model="styleInput"
                placeholder="Add style (e.g., Timba)"
                class="flex-1"
                @keydown.enter.prevent="addStyle"
              />
              <Button type="button" variant="pill" class="h-11" @click="addStyle">
                Add
              </Button>
            </div>
          </Field>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="(style, idx) in formData.styles"
              :key="idx"
              class="px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 bg-primary/[9.4%] text-primary"
            >
              {{ style }}
              <Button
                type="button"
                variant="ghost"
                class="h-auto w-auto p-0 hover:bg-transparent hover:opacity-70 [&_svg]:size-3"
                :aria-label="`Remove ${style}`"
                @click="removeStyle(idx)"
              >
                <X aria-hidden="true" />
              </Button>
            </span>
          </div>
        </div>

        <!-- Availability / When -->
        <Field id="gig-when" :label="formData.kind === 'role' ? 'When is the event?' : 'When available'" :error="errors.when">
          <Input
            v-model="formData.when"
            v-bind="fieldAttrs('when', 'gig-when-error')"
            type="text"
            required
            :placeholder="formData.kind === 'role' ? 'e.g., May 23–25, 2027' : 'e.g., Weekends, Booking 2026–27'"
          />
        </Field>

        <!-- Compensation -->
        <Field id="gig-compensation" :label="formData.kind === 'role' ? 'Budget / compensation offered' : 'Compensation / rate'" :error="errors.compensation">
          <Input
            v-model="formData.compensation"
            v-bind="fieldAttrs('compensation', 'gig-compensation-error')"
            type="text"
            required
            :placeholder="formData.kind === 'role' ? 'e.g., €500 + travel, Negotiable' : 'e.g., From €200/hour, On request'"
          />
        </Field>

        <!-- Contact email -->
        <Field id="gig-contactEmail" label="Contact email" :error="errors.contactEmail">
          <Input
            v-model="formData.contactEmail"
            v-bind="fieldAttrs('contactEmail', 'gig-contactEmail-error')"
            type="email"
            required
          />
        </Field>

        <!-- Website (optional) -->
        <Field id="gig-contactUrl" label="Website or portfolio" optional :error="errors.contactUrl">
          <Input
            v-model="formData.contactUrl"
            v-bind="fieldAttrs('contactUrl', 'gig-contactUrl-error')"
            type="url"
            placeholder="https://..."
          />
        </Field>

        <!-- Error message -->
        <div v-if="formError" class="p-3 rounded-lg text-sm font-bold bg-primary/[9.4%] text-primary">
          {{ formError }}
        </div>

        <!-- Success message -->
        <div v-if="formSuccess" class="p-3 rounded-lg text-sm font-bold bg-success/[9.4%] text-success">
          ✓ Gig posted! It will appear on the board shortly.
        </div>

        <!-- Submit -->
        <Button
          type="submit"
          variant="cta"
          size="lg"
          class="w-full px-6"
          :loading="submittingForm"
        >
          {{ submittingForm ? 'Posting...' : formData.kind === 'role' ? 'Post open role' : 'Post your offering' }}
        </Button>
      </form>
    </section>

    <!-- YOUR GIGS: applications to the roles you posted -->
    <section v-if="gigsWithApplications.length" id="your-gigs" class="max-w-4xl mx-auto px-4 pb-10">
      <h2 class="text-2xl leading-tight font-display text-foreground mb-4">Applications to your gigs</h2>
      <div class="grid gap-4">
        <div v-for="g in gigsWithApplications" :key="g.id" class="rounded-2xl bg-white border border-border p-5">
          <div class="flex items-baseline justify-between gap-3">
            <h3 class="text-lg font-bold leading-tight text-foreground font-display">{{ g.title }}</h3>
            <span class="text-xs text-muted-foreground font-sans">{{ g.applications.length }} application{{ g.applications.length === 1 ? '' : 's' }}</span>
          </div>
          <p v-if="!g.applications.length" class="mt-2 text-sm text-muted-foreground font-sans">Nobody applied yet.</p>
          <ul v-else class="mt-3 divide-y divide-border">
            <li v-for="a in g.applications" :key="a.id" class="py-3 flex flex-col sm:flex-row sm:items-start gap-3">
              <div class="flex-1 min-w-0 font-sans">
                <div class="text-sm font-bold text-foreground">
                  {{ a.page?.name ?? a.applicant.name }}
                  <NuxtLink v-if="a.page" :to="`/@${a.page.username}`" class="ml-1 text-xs font-normal underline text-secondary">page</NuxtLink>
                  <NuxtLink v-else-if="a.applicant.handle" :to="`/@${a.applicant.handle}`" class="ml-1 text-xs font-normal underline text-secondary">profile</NuxtLink>
                </div>
                <p class="mt-1 text-sm text-muted-foreground whitespace-pre-line break-words">{{ a.message }}</p>
                <a :href="`mailto:${a.applicant.email}`" class="mt-1 inline-block text-xs underline text-secondary break-all">{{ a.applicant.email }}</a>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <template v-if="a.status === 'pending'">
                  <Button type="button" variant="outline-pill" size="pill-sm" :disabled="deciding === a.id" @click="decide(a.id, 'declined')">Decline</Button>
                  <Button type="button" variant="pill" size="pill-sm" :disabled="deciding === a.id" @click="decide(a.id, 'accepted')">Accept</Button>
                </template>
                <span v-else class="text-xs font-bold font-sans" :class="a.status === 'accepted' ? 'text-success' : 'text-muted-foreground'">{{ statusLabel[a.status] }}</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <!-- BOARD -->
    <section class="max-w-4xl mx-auto px-4 pb-16">
      <div class="flex items-baseline justify-between mb-6">
        <h2 class="text-2xl leading-tight font-display text-foreground">
          {{ kindFilter === 'role' ? 'Open roles' : kindFilter === 'offer' ? 'Services offered' : 'All gigs' }}
        </h2>
        <span class="text-xs text-secondary font-hand" style="font-size:18px;">
          — {{ allGigs.length }} gig{{ allGigs.length === 1 ? '' : 's' }}
        </span>
      </div>

      <div v-if="loadingGigs" class="text-center py-14">
        <p class="text-sm text-muted-foreground font-sans">Loading gigs...</p>
      </div>

      <div v-else-if="gigsFailed" class="text-center py-14">
        <p class="text-sm text-muted-foreground font-sans">Couldn't load gigs. <Button type="button" variant="link" class="h-auto p-0 align-baseline underline" @click="refreshGigs()">Try again</Button></p>
      </div>

      <div v-else-if="!allGigs.length" class="text-center py-14 rounded-2xl border-2 border-dashed border-input bg-white/50">
        <p class="text-sm text-muted-foreground font-sans">No gigs match your filters yet.</p>
        <Button v-if="kindFilter || categoryFilter" type="button" variant="link" class="mt-2 h-auto p-0 text-xs font-bold underline font-sans" @click="kindFilter = ''; categoryFilter = ''">
          Clear filters
        </Button>
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2">
        <div
          v-for="g in allGigs"
          :key="g.id"
          class="rounded-2xl bg-white border p-5 flex flex-col transition-all hover:-translate-y-1"
          :style="{ borderColor: getAccent(g.category) + '55', boxShadow: '0 1px 0 ' + getAccent(g.category) + '22, 0 8px 22px rgba(59,31,18,0.05)' }"
        >
          <!-- Kind + category -->
          <div class="flex items-center justify-between gap-2 mb-2">
            <span
              class="inline-flex items-center gap-1.5 text-eyebrow font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
              :style="g.kind === 'role'
                ? { background: 'color-mix(in srgb, var(--wd-red-600) 9.4%, transparent)', color: 'var(--wd-red-800)' }
                : { background: 'color-mix(in srgb, var(--wd-green-600) 9.4%, transparent)', color: 'var(--wd-green-700)' }"
            >
              <component :is="g.kind === 'role' ? Megaphone : Hand" class="w-3 h-3" />
              {{ g.kind === 'role' ? 'Wanted' : 'Offering' }}
            </span>
            <span class="text-eyebrow font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" :style="{ background: getAccent(g.category) + '18', color: chipInk(getAccent(g.category)) }">
              {{ g.category }}
            </span>
          </div>

          <h3 class="text-lg font-bold leading-tight text-foreground font-display">
            {{ g.title }}
          </h3>

          <!-- Poster -->
          <div class="mt-1 text-sm text-muted-foreground font-sans">
            <span class="font-bold" :style="{ color: ink(getAccent(g.category)) }">{{ g.posterName }}</span>
            <span class="text-secondary"> · {{ g.posterType }}</span>
          </div>

          <!-- Meta -->
          <div class="mt-3 grid gap-1 text-xs text-muted-foreground font-sans">
            <span class="inline-flex items-center gap-1.5"><MapPin class="w-3 h-3 text-secondary" /> {{ g.location }}</span>
            <span class="inline-flex items-center gap-1.5"><Calendar class="w-3 h-3 text-secondary" /> {{ g.when }}</span>
            <span class="inline-flex items-center gap-1.5"><Wallet class="w-3 h-3 text-secondary" /> {{ g.compensation }}</span>
          </div>

          <!-- Styles -->
          <div class="mt-3 flex flex-wrap gap-1.5">
            <span
              v-for="s in g.styles"
              :key="s"
              class="text-eyebrow font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
              :style="{ background: getAccent(g.category) + '14', color: chipInk(getAccent(g.category), 0.078) }"
            >{{ s }}</span>
          </div>

          <!-- Confirmation banner -->
          <div
            v-if="appliedGigs.has(g.id)"
            class="mt-3 p-3 rounded-lg text-xs font-bold bg-success/[7.8%] text-success font-sans border border-wd-green-600/20"
          >
            ✓ Email draft opened — send it to reach {{ g.posterName }} directly.
            <template v-if="safeHref(g.contactUrl)">
              You can also visit <a :href="safeHref(g.contactUrl)" target="_blank" rel="noopener" class="underline">their profile</a>.
            </template>
          </div>

          <!-- Applied on WeDance -->
          <div
            v-if="myApplicationFor.get(g.id)"
            class="mt-3 p-3 rounded-lg text-xs font-bold font-sans border"
            :class="myApplicationFor.get(g.id).status === 'accepted' ? 'bg-success/[7.8%] text-success border-wd-green-600/20' : 'bg-muted text-muted-foreground border-border'"
          >
            You applied · {{ statusLabel[myApplicationFor.get(g.id).status] ?? myApplicationFor.get(g.id).status }}
          </div>

          <!-- Apply on WeDance -->
          <form v-if="applyOpen === g.id" class="mt-3 grid gap-2" novalidate @submit.prevent="sendApplication(g)">
            <Field :id="`apply-${g.id}`" label="Your message to the organizer" :error="applyError">
              <Textarea v-model="applyMessage" rows="4" placeholder="Your experience, styles, links to videos…" />
            </Field>
            <p class="text-xs text-muted-foreground font-sans">They get your message and your account email to reply to.</p>
            <div class="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="pill-sm" @click="applyOpen = null">Cancel</Button>
              <Button type="submit" variant="pill" size="pill-sm" :loading="applying">Send application</Button>
            </div>
          </form>

          <!-- Footer -->
          <div class="mt-auto pt-4 flex items-center justify-between gap-3">
            <span
              v-if="g.deadline && daysUntil(g.deadline)"
              class="text-xs font-bold"
              :style="{ color: daysUntil(g.deadline)!.urgent ? WD.red600 : WD.amber600, fontFamily: 'var(--wd-font-sans)' }"
            >
              {{ daysUntil(g.deadline)!.text }}
            </span>
            <span v-else />
            <div class="flex items-center gap-2">
              <Button v-if="safeHref(g.contactUrl)" as-child variant="outline-pill" size="pill-sm" class="px-3" :accent="ink(getAccent(g.category))">
                <a :href="safeHref(g.contactUrl)" target="_blank" rel="noopener">Profile</a>
              </Button>
              <span v-if="myGigIds.has(g.id)" class="text-xs font-bold text-secondary font-sans">Your gig</span>
              <Button
                v-else-if="g.kind === 'role' && isSignedIn && !myApplicationFor.get(g.id) && applyOpen !== g.id"
                type="button" variant="pill" size="pill-sm" class="[&_svg]:size-3.5" :accent="ink(getAccent(g.category))"
                :aria-expanded="applyOpen === g.id ? 'true' : 'false'"
                @click="openApply(g.id)"
              >
                Apply <ArrowRight aria-hidden="true" />
              </Button>
              <Button v-else-if="gigMailto(g) && !(g.kind === 'role' && isSignedIn)" as-child variant="pill" size="pill-sm" class="[&_svg]:size-3.5" :accent="ink(getAccent(g.category))">
                <a :href="gigMailto(g)!" @click="handleApply(g)">
                  {{ g.kind === 'role' ? 'Apply' : 'Contact' }} <ArrowRight aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>

    </main>


    <SiteFooter />
  </div>
</template>
