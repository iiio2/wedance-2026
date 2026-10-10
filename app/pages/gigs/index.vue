<script setup lang="ts">
/**
 * /gigs — the dance scene's opportunity board.
 * Organizers/clients post open roles; artists post service offers.
 * V3 tropical style. Distinct from /artists (which is browse-a-directory):
 * gigs is post-driven — "I need X" or "I offer Y".
 */
import { ArrowRight, MapPin, Calendar, Wallet, Plus, Megaphone, Hand, X } from 'lucide-vue-next'
import { GigSchema } from '#shared/validation'
import { WD } from '~/lib/brand'

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
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <!-- V3 header -->
    <SiteHeader />

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
          <button
            v-if="isSignedIn"
            type="button"
            class="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-bold uppercase tracking-wider"
            style="background:linear-gradient(135deg, var(--wd-red-600), var(--wd-orange-500)); box-shadow: 0 4px 0 -1px var(--wd-red-800);"
            @click="showForm = !showForm"
          >
            <Plus class="w-4 h-4" /> {{ showForm ? 'Close' : 'Post a gig' }}
          </button>
          <a
            v-else
            href="/auth/signin"
            class="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-bold uppercase tracking-wider"
            style="background:linear-gradient(135deg, var(--wd-red-600), var(--wd-orange-500)); box-shadow: 0 4px 0 -1px var(--wd-red-800);"
          >
            <Plus class="w-4 h-4" /> Sign in to post
          </a>
        </div>

        <!-- Kind toggle -->
        <div class="mt-8 inline-flex rounded-full p-1 bg-white border border-border">
          <button
            v-for="opt in [{ v: '', label: 'All' }, { v: 'role', label: 'Open roles' }, { v: 'offer', label: 'Services offered' }]"
            :key="opt.v"
            type="button"
            class="px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
            :style="kindFilter === opt.v
              ? { background: 'var(--wd-brown-900)', color: 'var(--wd-cream)' }
              : { background: 'transparent', color: 'var(--wd-brown-700)' }"
            @click="kindFilter = opt.v as 'role' | 'offer' | ''"
          >
            {{ opt.label }}
          </button>
        </div>

        <!-- Category chips -->
        <div class="flex flex-wrap items-center justify-center gap-2 mt-4">
          <button
            v-for="cat in categories"
            :key="cat"
            type="button"
            class="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
            :style="categoryFilter === cat
              ? { background: 'var(--wd-red-600)', color: 'white', boxShadow: '0 2px 0 -1px var(--wd-red-600)' }
              : { background: 'white', color: 'var(--wd-amber-600)', border: '1px solid color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent)' }"
            @click="categoryFilter = categoryFilter === cat ? '' : cat"
          >
            {{ cat }}
          </button>
        </div>
      </div>

      <svg class="block w-full h-10" viewBox="0 0 1440 60" preserveAspectRatio="none">
        <path d="M0,40 Q360,0 720,30 T1440,20 V60 H0 Z" :fill="WD.brown900" opacity="0.08"/>
      </svg>
    </section>

    <!-- FORM (when user clicks Post a gig) -->
    <section v-if="showForm" class="max-w-2xl mx-auto px-4 mb-8 bg-white rounded-2xl p-6 border-2 border-primary/20">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-2xl font-bold text-foreground">{{ formData.kind === 'role' ? 'Post an open role' : 'Offer your services' }}</h2>
        <button
          type="button"
          class="p-2 rounded-full hover:bg-gray-100"
          @click="showForm = false"
        >
          <X class="w-5 h-5 text-foreground" />
        </button>
      </div>

      <form class="space-y-4" novalidate @submit.prevent="submitForm">
        <!-- Kind toggle -->
        <div>
          <label class="block text-sm font-bold mb-1 text-muted-foreground">What are you posting?</label>
          <div class="inline-flex rounded-full p-1 w-full bg-background border border-border">
            <button
              v-for="opt in [{ v: 'role' as const, label: 'I need someone', icon: Megaphone }, { v: 'offer' as const, label: 'I offer my services', icon: Hand }]"
              :key="opt.v"
              type="button"
              class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all"
              :style="formData.kind === opt.v
                ? { background: opt.v === 'role' ? WD.red600 : WD.green600, color: 'white' }
                : { background: 'transparent', color: 'var(--wd-brown-700)' }"
              @click="formData.kind = opt.v"
            >
              <component :is="opt.icon" class="w-3.5 h-3.5" />
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- Poster type (who is posting) -->
        <div>
          <label class="block text-sm font-bold mb-1 text-muted-foreground">{{ formData.kind === 'role' ? 'You are a…' : 'You are a…' }}</label>
          <select
            v-model="formData.posterType"
            v-bind="fieldAttrs('posterType', 'gig-posterType-error')"
            required
            class="w-full px-3 py-2 rounded-lg border border-border text-foreground"
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
          </select>
          <FieldError id="gig-posterType-error" :message="errors.posterType" />
        </div>

        <!-- Category -->
        <div>
          <label class="block text-sm font-bold mb-1 text-muted-foreground">{{ formData.kind === 'role' ? 'Role needed' : 'Service category' }}</label>
          <select
            v-model="formData.category"
            v-bind="fieldAttrs('category', 'gig-category-error')"
            required
            class="w-full px-3 py-2 rounded-lg border border-border text-foreground"
          >
            <option value="">Select a category</option>
            <option value="Teacher">Teacher</option>
            <option value="DJ">DJ</option>
            <option value="MC">MC</option>
            <option value="Performer">Performer</option>
            <option value="Show">Show</option>
            <option value="Photographer">Photographer</option>
            <option value="Organizer">Organizer</option>
          </select>
          <FieldError id="gig-category-error" :message="errors.category" />
        </div>

        <!-- Title -->
        <div>
          <label class="block text-sm font-bold mb-1 text-muted-foreground">{{ formData.kind === 'role' ? 'Role title' : 'Service title' }}</label>
          <input
            v-model="formData.title"
            v-bind="fieldAttrs('title', 'gig-title-error')"
            type="text"
            required
            :placeholder="formData.kind === 'role' ? 'e.g., Salsa teacher needed for weekend festival' : 'e.g., Timba workshops for European festivals'"
            class="w-full px-3 py-2 rounded-lg border border-border text-foreground"
          />
          <FieldError id="gig-title-error" :message="errors.title" />
        </div>

        <!-- Your name -->
        <div>
          <label class="block text-sm font-bold mb-1 text-muted-foreground">{{ formData.kind === 'role' ? 'Organisation / event name' : 'Your name' }}</label>
          <input
            v-model="formData.posterName"
            v-bind="fieldAttrs('posterName', 'gig-posterName-error')"
            type="text"
            required
            :placeholder="formData.kind === 'role' ? 'e.g., Munich Salsa Festival' : 'Your name or artist name'"
            class="w-full px-3 py-2 rounded-lg border border-border text-foreground"
          />
          <FieldError id="gig-posterName-error" :message="errors.posterName" />
        </div>

        <!-- Location -->
        <div>
          <label class="block text-sm font-bold mb-1 text-muted-foreground">Location or base</label>
          <input
            v-model="formData.location"
            v-bind="fieldAttrs('location', 'gig-location-error')"
            type="text"
            required
            placeholder="e.g., Munich, Germany"
            class="w-full px-3 py-2 rounded-lg border border-border text-foreground"
          />
          <FieldError id="gig-location-error" :message="errors.location" />
        </div>

        <!-- Styles -->
        <div>
          <label class="block text-sm font-bold mb-1 text-muted-foreground">Dance styles</label>
          <div class="flex gap-2 mb-2">
            <input
              v-model="styleInput"
              type="text"
              placeholder="Add style (e.g., Timba)"
              class="flex-1 px-3 py-2 rounded-lg border border-border text-foreground"
              @keyup.enter="addStyle"
            />
            <button
              type="button"
              class="px-4 py-2 rounded-lg font-bold text-white bg-primary"
              @click="addStyle"
            >
              Add
            </button>
          </div>
          <div class="flex flex-wrap gap-2">
            <span
              v-for="(style, idx) in formData.styles"
              :key="idx"
              class="px-3 py-1 rounded-full text-sm font-bold flex items-center gap-2 bg-primary/[9.4%] text-primary"
            >
              {{ style }}
              <button
                type="button"
                class="hover:opacity-70"
                @click="removeStyle(idx)"
              >
                <X class="w-3 h-3" />
              </button>
            </span>
          </div>
        </div>

        <!-- Availability / When -->
        <div>
          <label class="block text-sm font-bold mb-1 text-muted-foreground">{{ formData.kind === 'role' ? 'When is the event?' : 'When available' }}</label>
          <input
            v-model="formData.when"
            v-bind="fieldAttrs('when', 'gig-when-error')"
            type="text"
            required
            :placeholder="formData.kind === 'role' ? 'e.g., May 23–25, 2027' : 'e.g., Weekends, Booking 2026–27'"
            class="w-full px-3 py-2 rounded-lg border border-border text-foreground"
          />
          <FieldError id="gig-when-error" :message="errors.when" />
        </div>

        <!-- Compensation -->
        <div>
          <label class="block text-sm font-bold mb-1 text-muted-foreground">{{ formData.kind === 'role' ? 'Budget / compensation offered' : 'Compensation / rate' }}</label>
          <input
            v-model="formData.compensation"
            v-bind="fieldAttrs('compensation', 'gig-compensation-error')"
            type="text"
            required
            :placeholder="formData.kind === 'role' ? 'e.g., €500 + travel, Negotiable' : 'e.g., From €200/hour, On request'"
            class="w-full px-3 py-2 rounded-lg border border-border text-foreground"
          />
          <FieldError id="gig-compensation-error" :message="errors.compensation" />
        </div>

        <!-- Contact email -->
        <div>
          <label class="block text-sm font-bold mb-1 text-muted-foreground">Contact email</label>
          <input
            v-model="formData.contactEmail"
            v-bind="fieldAttrs('contactEmail', 'gig-contactEmail-error')"
            type="email"
            required
            class="w-full px-3 py-2 rounded-lg border border-border text-foreground"
          />
          <FieldError id="gig-contactEmail-error" :message="errors.contactEmail" />
        </div>

        <!-- Website (optional) -->
        <div>
          <label class="block text-sm font-bold mb-1 text-muted-foreground">Website or portfolio (optional)</label>
          <input
            v-model="formData.contactUrl"
            v-bind="fieldAttrs('contactUrl', 'gig-contactUrl-error')"
            type="url"
            placeholder="https://..."
            class="w-full px-3 py-2 rounded-lg border border-border text-foreground"
          />
          <FieldError id="gig-contactUrl-error" :message="errors.contactUrl" />
        </div>

        <!-- Error message -->
        <div v-if="formError" class="p-3 rounded-lg text-sm font-bold bg-primary/[9.4%] text-primary">
          {{ formError }}
        </div>

        <!-- Success message -->
        <div v-if="formSuccess" class="p-3 rounded-lg text-sm font-bold bg-success/[9.4%] text-success">
          ✓ Gig posted! It will appear on the board shortly.
        </div>

        <!-- Submit -->
        <button
          type="submit"
          :disabled="submittingForm"
          class="w-full px-6 py-3 rounded-full text-white font-bold uppercase tracking-wider"
          style="background:linear-gradient(135deg, var(--wd-red-600), var(--wd-orange-500)); box-shadow: 0 4px 0 -1px var(--wd-red-800);"
        >
          {{ submittingForm ? 'Posting...' : formData.kind === 'role' ? 'Post open role' : 'Post your offering' }}
        </button>
      </form>
    </section>

    <!-- BOARD -->
    <section class="max-w-4xl mx-auto px-4 pb-16">
      <div class="flex items-baseline justify-between mb-6">
        <h2 class="text-2xl leading-tight font-display text-foreground">
          {{ kindFilter === 'role' ? 'Open roles' : kindFilter === 'offer' ? 'Services offered' : 'All gigs' }}
        </h2>
        <span class="text-xs text-secondary font-display italic" style="font-size:18px;">
          — {{ allGigs.length }} gig{{ allGigs.length === 1 ? '' : 's' }}
        </span>
      </div>

      <div v-if="loadingGigs" class="text-center py-14">
        <p class="text-sm text-muted-foreground font-sans">Loading gigs...</p>
      </div>

      <div v-else-if="gigsFailed" class="text-center py-14">
        <p class="text-sm text-muted-foreground font-sans">Couldn't load gigs. <button type="button" class="underline" @click="refreshGigs()">Try again</button></p>
      </div>

      <div v-else-if="!allGigs.length" class="text-center py-14 rounded-2xl border-2 border-dashed border-input bg-white/50">
        <p class="text-sm text-muted-foreground font-sans">No gigs match your filters yet.</p>
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
                ? { background: 'color-mix(in srgb, var(--wd-red-600) 9.4%, transparent)', color: 'var(--wd-red-600)' }
                : { background: 'color-mix(in srgb, var(--wd-green-600) 9.4%, transparent)', color: 'var(--wd-green-600)' }"
            >
              <component :is="g.kind === 'role' ? Megaphone : Hand" class="w-3 h-3" />
              {{ g.kind === 'role' ? 'Wanted' : 'Offering' }}
            </span>
            <span class="text-eyebrow font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" :style="{ background: getAccent(g.category) + '18', color: getAccent(g.category) }">
              {{ g.category }}
            </span>
          </div>

          <h3 class="text-lg font-bold leading-tight text-foreground font-display">
            {{ g.title }}
          </h3>

          <!-- Poster -->
          <div class="mt-1 text-sm text-muted-foreground font-sans">
            <span class="font-bold" :style="{ color: getAccent(g.category) }">{{ g.posterName }}</span>
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
              :style="{ background: getAccent(g.category) + '14', color: getAccent(g.category) }"
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
              <a
                v-if="safeHref(g.contactUrl)"
                :href="safeHref(g.contactUrl)"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-bold uppercase tracking-wider border"
                :style="{ color: getAccent(g.category), borderColor: getAccent(g.category) + '55' }"
              >
                Profile
              </a>
              <a
                v-if="gigMailto(g)"
                :href="gigMailto(g)!"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-full text-white text-xs font-bold uppercase tracking-wider"
                :style="{ background: getAccent(g.category), boxShadow: '0 3px 0 -1px ' + getAccent(g.category) + 'cc' }"
                @click="handleApply(g)"
              >
                {{ g.kind === 'role' ? 'Apply' : 'Contact' }} <ArrowRight class="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>

    <SiteFooter />
  </div>
</template>
