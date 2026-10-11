<script setup lang="ts">
import { WD } from '~/lib/brand'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  Plus,
  Trash2,
  Calendar,
  MapPin,
  Users,
  Music,
  Ticket,
  Eye,
  GripVertical,
  Instagram,
  Globe,
  Facebook,
  Youtube,
  Image,
  Sparkles,
} from 'lucide-vue-next'
import type { GenericSchema, InferInput } from 'valibot'
import {
  FestivalArtistSchema,
  FestivalBasicsSchema,
  FestivalTicketSchema,
  FestivalVenueSchema,
  FestivalWorkshopSchema,
  validateForm,
} from '#shared/validation'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — Create festival',
})

const router = useRouter()
const route = useRoute()

// Capture the pricing plan from the URL query parameter
const selectedPlan = computed(() => (route.query.plan as string) || 'starter')

const planDetails: Record<string, { name: string; price: string; period?: string; description: string; color: string; features: string[] }> = {
  starter: {
    name: 'Starter',
    price: 'Free',
    description: 'Get listed and let dancers find you.',
    color: WD.cyan600,
    features: [
      'Festival listing with schedule',
      'Lineup with teacher profiles',
      'Venue info & directions',
      'Basic attendee count',
      'Link to your ticket page',
    ],
  },
  pro: {
    name: 'Pro',
    price: '€49',
    period: '/event',
    description: 'The full engagement toolkit.',
    color: WD.red600,
    features: [
      'Everything in Starter',
      'Interactive workshop planner',
      'Smart ticket recommendations',
      'Partner matching for attendees',
      'Plan sharing & referral tracking',
      'Workshop demand analytics',
      'Audience insights dashboard',
      'Priority support',
    ],
  },
  network: {
    name: 'Network',
    price: '€199',
    period: '/year',
    description: 'For organizers running multiple events.',
    color: WD.green600,
    features: [
      'Everything in Pro',
      'Unlimited events per year',
      'Cross-event audience insights',
      'Featured in Year Planner',
      'Early access to new features',
      'Dedicated account manager',
    ],
  },
}

const currentPlan = computed(() => planDetails[selectedPlan.value] || planDetails.starter)

// Step management
const steps = [
  { id: 'basics', label: 'Basics', icon: Calendar },
  { id: 'venue', label: 'Venue', icon: MapPin },
  { id: 'lineup', label: 'Lineup', icon: Users },
  { id: 'schedule', label: 'Schedule', icon: Music },
  { id: 'tickets', label: 'Tickets', icon: Ticket },
  { id: 'preview', label: 'Preview', icon: Eye },
] as const

type StepId = typeof steps[number]['id']
const currentStep = ref<StepId>('basics')
const currentStepIndex = computed(() => steps.findIndex(s => s.id === currentStep.value))

// Per-step validation
const stepErrors = ref<string[]>([])

function formErrors<S extends GenericSchema>(schema: S, input: InferInput<S>): string[] {
  const result = validateForm(schema, input)
  return result.success ? [] : result.errors
}

// "Artist 2: name is required."
function rowErrors<S extends GenericSchema>(label: string, schema: S, rows: InferInput<S>[]): string[] {
  return rows.flatMap((row, i) => formErrors(schema, row).map(message => `${label} ${i + 1}: ${message}`))
}

function validateStep(stepId: StepId): string[] {
  switch (stepId) {
    case 'basics': return formErrors(FestivalBasicsSchema, festival)
    case 'venue': return formErrors(FestivalVenueSchema, venue)
    case 'lineup': return rowErrors('Artist', FestivalArtistSchema, teachers.value)
    case 'schedule': return rowErrors('Workshop', FestivalWorkshopSchema, workshops.value)
    case 'tickets': return rowErrors('Ticket', FestivalTicketSchema, tickets.value)
    default: return []
  }
}

function goToStep(stepId: StepId) {
  const targetIndex = steps.findIndex(s => s.id === stepId)
  // Going backwards is always allowed
  if (targetIndex <= currentStepIndex.value) {
    stepErrors.value = []
    currentStep.value = stepId
    return
  }
  // Going forward: validate every step between current and target
  for (let i = currentStepIndex.value; i < targetIndex; i++) {
    const step = steps[i]!
    const errors = validateStep(step.id)
    if (errors.length) {
      stepErrors.value = errors
      currentStep.value = step.id
      window.scrollTo(0, 0)
      return
    }
  }
  stepErrors.value = []
  currentStep.value = stepId
}
function nextStep() {
  const errors = validateStep(currentStep.value)
  if (errors.length) {
    stepErrors.value = errors
    window.scrollTo(0, 0)
    return
  }
  stepErrors.value = []
  if (currentStepIndex.value < steps.length - 1) {
    currentStep.value = steps[currentStepIndex.value + 1].id
    window.scrollTo(0, 0)
  }
}
function prevStep() {
  stepErrors.value = []
  if (currentStepIndex.value > 0) {
    currentStep.value = steps[currentStepIndex.value - 1].id
    window.scrollTo(0, 0)
  }
}

// ---- Form Data ----

// Step 1: Basics
const festival = reactive({
  name: '',
  slug: '',
  startDate: '',
  endDate: '',
  description: '',
  logo: '',
  accentColor: WD.rose600,
  socialLinks: [] as { platform: string; url: string }[],
})

// Auto-generate slug from name
watch(() => festival.name, (name) => {
  festival.slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
})

function addSocialLink() {
  const last = festival.socialLinks[festival.socialLinks.length - 1]
  if (last && !last.url.trim()) return
  festival.socialLinks.push({ platform: 'instagram', url: '' })
}
function removeSocialLink(index: number) {
  festival.socialLinks.splice(index, 1)
}

const socialPlatforms = [
  { value: 'instagram', label: 'Instagram', icon: Instagram },
  { value: 'facebook', label: 'Facebook', icon: Facebook },
  { value: 'youtube', label: 'YouTube', icon: Youtube },
  { value: 'website', label: 'Website', icon: Globe },
]

// Step 2: Venue
const venue = reactive({
  name: '',
  address: '',
  rooms: [''],
  practicalInfo: [''],
})

function addRoom() {
  const last = venue.rooms[venue.rooms.length - 1]
  if (last !== undefined && !last.trim()) return
  venue.rooms.push('')
}
function removeRoom(index: number) {
  venue.rooms.splice(index, 1)
}

function addPracticalInfo() {
  const last = venue.practicalInfo[venue.practicalInfo.length - 1]
  if (last !== undefined && !last.trim()) return
  venue.practicalInfo.push('')
}
function removePracticalInfo(index: number) {
  venue.practicalInfo.splice(index, 1)
}

// Step 3: Lineup (Teachers)
interface EditorTeacher {
  id: string
  name: string
  photo: string
  bio: string
  styles: string
  videoUrl: string
  instagram: string
}

const teachers = ref<EditorTeacher[]>([])

function addTeacher() {
  const last = teachers.value[teachers.value.length - 1]
  if (last && !last.name.trim()) return
  teachers.value.push({
    id: crypto.randomUUID(),
    name: '',
    photo: '',
    bio: '',
    styles: '',
    videoUrl: '',
    instagram: '',
  })
}
function removeTeacher(index: number) {
  teachers.value.splice(index, 1)
}

// Step 4: Schedule (Workshops)
interface EditorWorkshop {
  id: string
  title: string
  day: string
  time: string
  duration: number
  room: string
  style: string
  level: 'Beginner' | 'Intermediate' | 'Advanced'
  teacherId: string
  type: 'workshop' | 'party'
  description: string
  venue: string
}

const workshops = ref<EditorWorkshop[]>([])

const days = computed(() => {
  if (!festival.startDate || !festival.endDate) return []
  const result: string[] = []
  const start = new Date(festival.startDate)
  const end = new Date(festival.endDate)
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    result.push(dayNames[d.getDay()])
  }
  return result
})

const rooms = computed(() => venue.rooms.filter(Boolean))

const styles = computed(() => {
  const allStyles = teachers.value.flatMap(t => t.styles.split(',').map(s => s.trim()).filter(Boolean))
  return [...new Set(allStyles)]
})

function addWorkshop() {
  const last = workshops.value[workshops.value.length - 1]
  if (last && !last.title.trim()) return
  workshops.value.push({
    id: crypto.randomUUID(),
    title: '',
    day: days.value[0] || '',
    time: '10:00',
    duration: 60,
    room: rooms.value[0] || '',
    style: styles.value[0] || '',
    level: 'Intermediate',
    teacherId: teachers.value[0]?.id || '',
    type: 'workshop',
    description: '',
    venue: '',
  })
}
function removeWorkshop(index: number) {
  workshops.value.splice(index, 1)
}

// Step 5: Tickets
interface EditorTicket {
  id: string
  name: string
  price: number
  description: string
  workshopCount: number | null
  includesParty: boolean
  soldOut: boolean
}

const tickets = ref<EditorTicket[]>([])
const ticketUrl = ref('')

function addTicket() {
  const last = tickets.value[tickets.value.length - 1]
  if (last && !last.name.trim()) return
  tickets.value.push({
    id: crypto.randomUUID(),
    name: '',
    price: 0,
    description: '',
    workshopCount: null,
    includesParty: false,
    soldOut: false,
  })
}
function removeTicket(index: number) {
  tickets.value.splice(index, 1)
}

// Summary counts for preview
const workshopCount = computed(() => workshops.value.filter(w => w.type === 'workshop').length)
const partyCount = computed(() => workshops.value.filter(w => w.type === 'party').length)

// Publish
const isPublishing = ref(false)
const isPublished = ref(false)
const submitError = ref('')

const { $trpc } = useNuxtApp()

async function publish() {
  isPublishing.value = true
  submitError.value = ''
  try {
    // No live self-serve publish yet — persist the full draft for the team to
    // review and onboard, instead of faking "your festival is live".
    await $trpc.festival.submitDraft.mutate({
      slug: festival.slug || undefined,
      name: festival.name || undefined,
      payload: {
        plan: selectedPlan.value,
        festival: { ...festival },
        venue: { ...venue },
        teachers: teachers.value,
        workshops: workshops.value,
        tickets: tickets.value,
        ticketUrl: ticketUrl.value,
      },
    })
    isPublished.value = true
    // CUJ: "List a festival" — draft submitted for review.
    useTrack().track('festival_draft_submitted', { slug: festival.slug, plan: selectedPlan.value })
  } catch (e: any) {
    submitError.value = e?.message || 'Could not submit right now. Please try again.'
  } finally {
    isPublishing.value = false
  }
}


// Trash / remove buttons on repeatable rows.
const removeBtnClass = 'shrink-0 text-secondary hover:bg-transparent hover:text-primary'
// "Edit" links on the preview cards and "+ Add …" links above lists.
const inlineLinkClass = 'h-auto p-0 text-xs italic font-display font-normal'
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <!-- V3 site header — same as / , /festivals, /organizers, etc. -->
    <SiteHeader />

    <!-- Create-flow action bar (sticky) -->
    <div class="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm">
      <div class="max-w-4xl mx-auto px-4 flex items-center justify-between h-14 gap-3">
        <Button
          variant="link"
          class="h-auto p-0 text-sm italic font-display font-normal text-muted-foreground"
          @click="router.push('/organizers')"
        >
          <ArrowLeft />
          Back
        </Button>
        <div class="text-xs uppercase tracking-[0.3em] font-bold text-secondary">
          Create festival
        </div>
        <Button
          v-if="currentStep === 'preview'"
          variant="cta"
          size="pill-sm"
          :disabled="isPublishing || isPublished"
          @click="publish"
        >
          {{ isPublished ? 'Submitted' : isPublishing ? 'Submitting…' : 'Submit for review' }}
        </Button>
        <div v-else class="w-14" />
      </div>

      <!-- Step indicator -->
      <nav class="overflow-x-auto border-t border-foreground/5" aria-label="Steps">
        <div class="max-w-4xl mx-auto px-4 flex">
          <Button
            v-for="(step, i) in steps"
            :key="step.id"
            variant="ghost"
            class="h-auto gap-2 rounded-none px-4 py-3 text-xs italic font-display font-normal whitespace-nowrap transition-all border-b-2 hover:bg-transparent [&_svg]:size-3"
            :class="step.id === currentStep
              ? 'border-primary text-primary font-bold hover:text-primary'
              : i < currentStepIndex
                ? 'border-transparent text-foreground hover:text-foreground'
                : 'border-transparent text-secondary hover:text-secondary'"
            :aria-current="step.id === currentStep ? 'step' : undefined"
            @click="goToStep(step.id)"
          >
            <div
              class="size-6 rounded-full flex items-center justify-center text-meta not-italic font-black shrink-0"
              :class="i < currentStepIndex
                ? 'bg-wd-green-600 text-white'
                : step.id === currentStep
                  ? 'bg-primary text-white'
                  : 'bg-white text-secondary border-[1.5px] border-border'"
            >
              <Check v-if="i < currentStepIndex" class="stroke-[2.5]" />
              <span v-else class="font-sans">{{ i + 1 }}</span>
            </div>
            {{ step.label }}
          </Button>
        </div>
      </nav>
    </div>

    <!-- Form content -->
    <div class="max-w-3xl mx-auto px-4 py-8 pb-32">

      <!-- Selected plan banner -->
      <div
        class="rounded-2xl border-2 p-5 mb-6 flex flex-col sm:flex-row gap-5"
        :style="{ borderColor: currentPlan.color + '55', background: currentPlan.color + '08' }"
      >
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <Sparkles v-if="selectedPlan === 'pro'" class="size-4" :style="{ color: currentPlan.color }" />
            <span class="text-eyebrow uppercase tracking-[0.3em] font-bold" :style="{ color: currentPlan.color }">
              {{ currentPlan.name }} plan
            </span>
            <span class="text-sm font-bold text-foreground">
              {{ currentPlan.price }}<span v-if="currentPlan.period" class="font-normal text-xs text-secondary">{{ currentPlan.period }}</span>
            </span>
          </div>
          <p class="text-sm mb-3 text-muted-foreground font-sans">
            {{ currentPlan.description }}
          </p>
          <ul class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            <li v-for="f in currentPlan.features" :key="f" class="flex items-start gap-1.5 text-xs text-muted-foreground font-sans">
              <CheckCircle class="size-3.5 shrink-0 mt-0.5" :style="{ color: currentPlan.color }" aria-hidden="true" />
              <span>{{ f }}</span>
            </li>
          </ul>
        </div>
        <div class="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-2 shrink-0">
          <NuxtLink
            to="/organizers#pricing"
            class="text-xs italic hover:underline whitespace-nowrap text-wd-cyan-600 font-display"
          >
            Change plan
          </NuxtLink>
        </div>
      </div>

      <!-- Validation errors -->
      <div v-if="stepErrors.length" role="alert" class="rounded-xl border border-destructive/30 bg-wd-red-50 px-4 py-3 mb-6 font-sans">
        <p class="text-sm font-semibold text-wd-red-900 mb-1">Please fix the following before continuing:</p>
        <ul class="list-disc list-inside text-sm text-wd-red-800 space-y-0.5">
          <li v-for="(err, i) in stepErrors" :key="i">{{ err }}</li>
        </ul>
      </div>

      <!-- Step 1: Basics -->
      <div v-if="currentStep === 'basics'" class="space-y-6">
        <div>
          <h2 class="text-2xl leading-tight font-black mb-1 font-display text-foreground">Festival Details</h2>
          <p class="text-sm text-muted-foreground font-sans">Start with the essentials — name, dates, and description.</p>
        </div>

        <div class="space-y-4">
          <Field id="festival-name" label="Festival name" required>
            <Input v-model="festival.name" placeholder="e.g. Salsa Open Berlin 2026" />
          </Field>

          <Field id="festival-slug" label="URL slug">
            <div class="flex items-center gap-0">
              <span class="text-xs px-3 h-11 flex items-center rounded-l-xl border border-r-0 border-input bg-foreground/4 text-muted-foreground font-sans">wedance.vip/festivals/</span>
              <Input v-model="festival.slug" class="rounded-l-none" placeholder="salsa-open-berlin-2026" />
            </div>
          </Field>

          <div class="grid grid-cols-2 gap-4">
            <Field id="festival-start" label="Start date" required>
              <Input v-model="festival.startDate" type="date" />
            </Field>
            <Field id="festival-end" label="End date" required>
              <Input v-model="festival.endDate" type="date" />
            </Field>
          </div>

          <Field id="festival-description" label="Description" optional>
            <Textarea v-model="festival.description" placeholder="Tell dancers what makes your festival special..." :rows="4" />
          </Field>

          <Field id="festival-logo" label="Logo URL" optional hint="Square image recommended (200x200px or larger)">
            <Input v-model="festival.logo" type="url" placeholder="https://..." />
          </Field>

          <Field id="festival-accent" label="Accent color">
            <div class="flex items-center gap-3">
              <input v-model="festival.accentColor" type="color" aria-label="Pick accent color" class="size-9 rounded cursor-pointer border-0 p-0">
              <Input v-model="festival.accentColor" class="max-w-32" :placeholder="WD.rose600" />
            </div>
          </Field>
        </div>

        <!-- Social links -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <Label optional>Social links</Label>
            <Button variant="link" :class="inlineLinkClass" @click="addSocialLink">
              <Plus /> Add link
            </Button>
          </div>
          <div class="space-y-2">
            <div v-for="(link, i) in festival.socialLinks" :key="i" class="flex items-center gap-2">
              <div class="w-32 shrink-0">
                <Select v-model="link.platform" :options="socialPlatforms" :aria-label="`Link ${i + 1} platform`" />
              </div>
              <Input v-model="link.url" type="url" placeholder="https://..." :aria-label="`Link ${i + 1} URL`" />
              <Button variant="ghost" size="icon-sm" :class="removeBtnClass" :aria-label="`Remove link ${i + 1}`" @click="removeSocialLink(i)">
                <Trash2 />
              </Button>
            </div>
            <p v-if="!festival.socialLinks.length" class="text-xs text-secondary font-sans">No social links yet.</p>
          </div>
        </div>
      </div>

      <!-- Step 2: Venue -->
      <div v-if="currentStep === 'venue'" class="space-y-6">
        <div>
          <h2 class="text-2xl leading-tight font-black mb-1 font-display text-foreground">Venue</h2>
          <p class="text-sm text-muted-foreground font-sans">Where is the festival happening?</p>
        </div>

        <div class="space-y-4">
          <Field id="venue-name" label="Venue name" required>
            <Input v-model="venue.name" placeholder="e.g. Alte Munze" />
          </Field>

          <Field id="venue-address" label="Address" required>
            <Input v-model="venue.address" placeholder="e.g. Molkenmarkt 2, 10179 Berlin, Germany" />
          </Field>
        </div>

        <!-- Rooms -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <Label optional>Rooms</Label>
            <Button variant="link" :class="inlineLinkClass" @click="addRoom">
              <Plus /> Add room
            </Button>
          </div>
          <p class="text-xs mb-2 text-secondary font-sans">List the rooms/halls where workshops take place. These will appear as options in the schedule.</p>
          <div class="space-y-2">
            <div v-for="(_, i) in venue.rooms" :key="i" class="flex items-center gap-2">
              <Input v-model="venue.rooms[i]" placeholder="e.g. Main Hall" :aria-label="`Room ${i + 1}`" />
              <Button variant="ghost" size="icon-sm" :class="removeBtnClass" :aria-label="`Remove room ${i + 1}`" @click="removeRoom(i)">
                <Trash2 />
              </Button>
            </div>
          </div>
        </div>

        <!-- Practical info -->
        <div>
          <div class="flex items-center justify-between mb-3">
            <Label optional>Practical info</Label>
            <Button variant="link" :class="inlineLinkClass" @click="addPracticalInfo">
              <Plus /> Add item
            </Button>
          </div>
          <div class="space-y-2">
            <div v-for="(_, i) in venue.practicalInfo" :key="i" class="flex items-center gap-2">
              <Input v-model="venue.practicalInfo[i]" placeholder="e.g. Nearest metro: U2 Klosterstrasse" :aria-label="`Practical info ${i + 1}`" />
              <Button variant="ghost" size="icon-sm" :class="removeBtnClass" :aria-label="`Remove practical info ${i + 1}`" @click="removePracticalInfo(i)">
                <Trash2 />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 3: Lineup -->
      <div v-if="currentStep === 'lineup'" class="space-y-6">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-2xl leading-tight font-black mb-1 font-display text-foreground">Lineup</h2>
            <p class="text-sm text-muted-foreground font-sans">Add the teachers and DJs performing at your festival.</p>
          </div>
          <Button size="sm" variant="outline" class="gap-1 shrink-0" @click="addTeacher">
            <Plus class="size-3.5" /> Add Artist
          </Button>
        </div>

        <div v-if="!teachers.length" class="text-center py-12 border rounded-lg border-dashed">
          <Users class="size-8 mx-auto mb-2 text-secondary" aria-hidden="true" />
          <p class="text-sm mb-3 text-muted-foreground font-sans">No artists added yet</p>
          <Button size="sm" variant="outline" @click="addTeacher">Add your first artist</Button>
        </div>

        <div v-for="(teacher, i) in teachers" :key="teacher.id" class="border rounded-lg p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold">{{ teacher.name || `Artist ${i + 1}` }}</h3>
            <Button variant="ghost" size="icon-sm" :class="removeBtnClass" :aria-label="`Remove ${teacher.name || `artist ${i + 1}`}`" @click="removeTeacher(i)">
              <Trash2 />
            </Button>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <Field :id="`teacher-${teacher.id}-name`" label="Name" required>
              <Input v-model="teacher.name" placeholder="e.g. Carlos Rivera" />
            </Field>
            <Field :id="`teacher-${teacher.id}-styles`" label="Styles" optional>
              <Input v-model="teacher.styles" placeholder="e.g. Salsa, Timba" />
            </Field>
          </div>

          <Field :id="`teacher-${teacher.id}-bio`" label="Bio" optional>
            <Textarea v-model="teacher.bio" placeholder="Short bio..." :rows="2" />
          </Field>

          <div class="grid grid-cols-2 gap-3">
            <Field :id="`teacher-${teacher.id}-photo`" label="Photo URL" optional>
              <Input v-model="teacher.photo" type="url" placeholder="https://..." />
            </Field>
            <Field :id="`teacher-${teacher.id}-video`" label="Video URL" optional>
              <Input v-model="teacher.videoUrl" type="url" placeholder="https://youtube.com/..." />
            </Field>
          </div>

          <Field :id="`teacher-${teacher.id}-instagram`" label="Instagram" optional>
            <Input v-model="teacher.instagram" type="url" placeholder="https://instagram.com/..." />
          </Field>
        </div>
      </div>

      <!-- Step 4: Schedule -->
      <div v-if="currentStep === 'schedule'" class="space-y-6">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-2xl leading-tight font-black mb-1 font-display text-foreground">Schedule</h2>
            <p class="text-sm text-muted-foreground font-sans">
              Add workshops and parties.
              <span v-if="!days.length" class="text-destructive">Set dates in Basics first.</span>
            </p>
          </div>
          <Button size="sm" variant="outline" class="gap-1 shrink-0" :disabled="!days.length" @click="addWorkshop">
            <Plus class="size-3.5" /> Add Workshop
          </Button>
        </div>

        <div v-if="!workshops.length" class="text-center py-12 border rounded-lg border-dashed">
          <Music class="size-8 mx-auto mb-2 text-secondary" aria-hidden="true" />
          <p class="text-sm mb-3 text-muted-foreground font-sans">No workshops added yet</p>
          <Button size="sm" variant="outline" :disabled="!days.length" @click="addWorkshop">Add your first workshop</Button>
        </div>

        <div v-for="(ws, i) in workshops" :key="ws.id" class="border rounded-lg p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold">{{ ws.title || `Workshop ${i + 1}` }}</h3>
            <div class="flex items-center gap-2">
              <Badge :variant="ws.type === 'party' ? 'secondary' : 'default'" class="text-[10px]">
                {{ ws.type }}
              </Badge>
              <Button variant="ghost" size="icon-sm" :class="removeBtnClass" :aria-label="`Remove ${ws.title || `workshop ${i + 1}`}`" @click="removeWorkshop(i)">
                <Trash2 />
              </Button>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <Field :id="`ws-${ws.id}-title`" label="Title" required>
              <Input v-model="ws.title" placeholder="e.g. Salsa Fundamentals" />
            </Field>
            <Field :id="`ws-${ws.id}-type`" label="Type">
              <Select v-model="ws.type" :options="[{ label: 'Workshop', value: 'workshop' }, { label: 'Party', value: 'party' }]" />
            </Field>
          </div>

          <div class="grid grid-cols-4 gap-3">
            <Field :id="`ws-${ws.id}-day`" label="Day">
              <Select v-model="ws.day" :options="days" />
            </Field>
            <Field :id="`ws-${ws.id}-time`" label="Time">
              <Input v-model="ws.time" type="time" />
            </Field>
            <Field :id="`ws-${ws.id}-duration`" label="Duration (min)">
              <Input v-model.number="ws.duration" type="number" min="15" step="15" />
            </Field>
            <Field :id="`ws-${ws.id}-room`" label="Room" optional>
              <Select v-if="rooms.length" v-model="ws.room">
                <option value="">— Select —</option>
                <option v-for="r in rooms" :key="r" :value="r">{{ r }}</option>
              </Select>
              <Input v-else v-model="ws.room" placeholder="Add rooms in Venue step" />
            </Field>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <Field :id="`ws-${ws.id}-style`" label="Style" optional>
              <Input v-model="ws.style" placeholder="Salsa" list="style-options" />
              <datalist id="style-options">
                <option v-for="s in styles" :key="s" :value="s" />
              </datalist>
            </Field>
            <Field :id="`ws-${ws.id}-level`" label="Level">
              <Select v-model="ws.level" :options="['Beginner', 'Intermediate', 'Advanced']" />
            </Field>
            <Field :id="`ws-${ws.id}-teacher`" label="Teacher" optional>
              <Select v-model="ws.teacherId">
                <option value="">— None —</option>
                <option v-for="t in teachers" :key="t.id" :value="t.id">{{ t.name || 'Unnamed' }}</option>
              </Select>
            </Field>
          </div>

          <Field :id="`ws-${ws.id}-description`" label="Description" optional>
            <Textarea v-model="ws.description" placeholder="Optional workshop description..." :rows="2" />
          </Field>

          <Field :id="`ws-${ws.id}-venue`" label="Alternative venue" optional>
            <Input v-model="ws.venue" placeholder="Leave empty if same as main venue" />
          </Field>
        </div>
      </div>

      <!-- Step 5: Tickets -->
      <div v-if="currentStep === 'tickets'" class="space-y-6">
        <div class="flex items-start justify-between">
          <div>
            <h2 class="text-2xl leading-tight font-black mb-1 font-display text-foreground">Tickets</h2>
            <p class="text-sm text-muted-foreground font-sans">Define your ticket options. We'll recommend the best fit to dancers.</p>
          </div>
          <Button size="sm" variant="outline" class="gap-1 shrink-0" @click="addTicket">
            <Plus class="size-3.5" /> Add Ticket
          </Button>
        </div>

        <Field id="ticket-url" label="Ticket purchase URL" optional hint="Where dancers go to buy tickets (your website or ticket platform)">
          <Input v-model="ticketUrl" type="url" placeholder="https://your-ticket-page.com" />
        </Field>

        <div v-if="!tickets.length" class="text-center py-12 border rounded-lg border-dashed">
          <Ticket class="size-8 mx-auto mb-2 text-secondary" aria-hidden="true" />
          <p class="text-sm mb-3 text-muted-foreground font-sans">No ticket options added yet</p>
          <Button size="sm" variant="outline" @click="addTicket">Add your first ticket</Button>
        </div>

        <div v-for="(ticket, i) in tickets" :key="ticket.id" class="border rounded-lg p-4 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold">{{ ticket.name || `Ticket ${i + 1}` }}</h3>
            <Button variant="ghost" size="icon-sm" :class="removeBtnClass" :aria-label="`Remove ${ticket.name || `ticket ${i + 1}`}`" @click="removeTicket(i)">
              <Trash2 />
            </Button>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <Field :id="`ticket-${ticket.id}-name`" label="Name" required>
              <Input v-model="ticket.name" placeholder="e.g. Full Pass + Party" />
            </Field>
            <Field :id="`ticket-${ticket.id}-price`" label="Price (EUR)" required>
              <Input v-model.number="ticket.price" type="number" min="0" step="1" placeholder="100" />
            </Field>
          </div>

          <Field :id="`ticket-${ticket.id}-description`" label="Description" optional>
            <Input v-model="ticket.description" placeholder="e.g. All 5 workshops + Saturday Party" />
          </Field>

          <div class="grid grid-cols-3 gap-3">
            <Field :id="`ticket-${ticket.id}-workshops`" label="Max workshops" hint="Leave empty for unlimited">
              <Input v-model.number="ticket.workshopCount" type="number" min="0" placeholder="Unlimited" />
            </Field>
            <div class="flex items-end">
              <Checkbox v-model="ticket.includesParty">Includes party</Checkbox>
            </div>
            <div class="flex items-end">
              <Checkbox v-model="ticket.soldOut">Sold out</Checkbox>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 6: Preview -->
      <div v-if="currentStep === 'preview'" class="space-y-6">
        <div>
          <h2 class="text-2xl leading-tight font-black mb-1 font-display text-foreground">Preview & Submit</h2>
          <p class="text-sm text-muted-foreground font-sans">Review your festival, then send it to our team to onboard.</p>
        </div>

        <!-- Submitted success -->
        <div v-if="isPublished" class="text-center py-12 border rounded-lg bg-success/6 border-success/20">
          <Check class="size-12 text-success mx-auto mb-3" aria-hidden="true" />
          <h3 class="text-lg font-semibold mb-1">Submitted for review</h3>
          <p class="text-sm mb-4 text-muted-foreground font-sans">
            Thanks — we've got <strong>{{ festival.name }}</strong>. Our team will review it and reach out to get it live on WeDance.
          </p>
          <div class="flex items-center justify-center gap-3">
            <Button variant="outline" @click="router.push('/organizers')">
              Back to Dashboard
            </Button>
          </div>
        </div>

        <!-- Preview summary -->
        <div v-else class="space-y-4">
          <p v-if="submitError" role="alert" class="rounded-lg border border-destructive/30 bg-wd-red-50 px-4 py-3 text-sm text-wd-red-900 font-sans">
            {{ submitError }}
          </p>
          <!-- Basics summary -->
          <div class="rounded-2xl border bg-card p-5 shadow-wd-card">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold">Basics</h3>
              <Button variant="link" :class="inlineLinkClass" @click="goToStep('basics')">Edit</Button>
            </div>
            <div class="grid grid-cols-2 gap-y-1 text-sm">
              <span class="text-secondary font-sans">Name</span>
              <span>{{ festival.name || '—' }}</span>
              <span class="text-secondary font-sans">Dates</span>
              <span>{{ festival.startDate && festival.endDate ? `${festival.startDate} to ${festival.endDate}` : '—' }}</span>
              <span class="text-secondary font-sans">Social links</span>
              <span>{{ festival.socialLinks.length || 0 }} links</span>
            </div>
          </div>

          <!-- Venue summary -->
          <div class="rounded-2xl border bg-card p-5 shadow-wd-card">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold">Venue</h3>
              <Button variant="link" :class="inlineLinkClass" @click="goToStep('venue')">Edit</Button>
            </div>
            <div class="grid grid-cols-2 gap-y-1 text-sm">
              <span class="text-secondary font-sans">Name</span>
              <span>{{ venue.name || '—' }}</span>
              <span class="text-secondary font-sans">Address</span>
              <span>{{ venue.address || '—' }}</span>
            </div>
          </div>

          <!-- Lineup summary -->
          <div class="rounded-2xl border bg-card p-5 shadow-wd-card">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold">Lineup</h3>
              <Button variant="link" :class="inlineLinkClass" @click="goToStep('lineup')">Edit</Button>
            </div>
            <p class="text-sm">
              <strong>{{ teachers.length }}</strong> {{ teachers.length === 1 ? 'artist' : 'artists' }}
              <span v-if="teachers.length" class="text-secondary font-sans">
                — {{ teachers.map(t => t.name).filter(Boolean).join(', ') }}
              </span>
            </p>
          </div>

          <!-- Schedule summary -->
          <div class="rounded-2xl border bg-card p-5 shadow-wd-card">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold">Schedule</h3>
              <Button variant="link" :class="inlineLinkClass" @click="goToStep('schedule')">Edit</Button>
            </div>
            <p class="text-sm">
              <strong>{{ workshopCount }}</strong> {{ workshopCount === 1 ? 'workshop' : 'workshops' }},
              <strong>{{ partyCount }}</strong> {{ partyCount === 1 ? 'party' : 'parties' }}
              <span v-if="days.length" class="text-secondary font-sans">across {{ days.length }} days</span>
            </p>
          </div>

          <!-- Tickets summary -->
          <div class="rounded-2xl border bg-card p-5 shadow-wd-card">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-sm font-semibold">Tickets</h3>
              <Button variant="link" :class="inlineLinkClass" @click="goToStep('tickets')">Edit</Button>
            </div>
            <p class="text-sm">
              <strong>{{ tickets.length }}</strong> {{ tickets.length === 1 ? 'option' : 'options' }}
              <span v-if="tickets.length" class="text-secondary font-sans">
                — {{ tickets.filter(t => !t.soldOut).map(t => `${t.name} €${t.price}`).join(', ') }}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom navigation -->
    <div v-if="!isPublished" class="fixed bottom-0 left-0 right-0 border-t border-border z-20 bg-background/96 backdrop-blur-sm">
      <div class="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Button
          v-if="currentStepIndex > 0"
          variant="outline"
          class="rounded-full font-bold text-muted-foreground font-sans hover:-translate-y-0.5 transition-all"
          @click="prevStep"
        >
          <ArrowLeft /> Back
        </Button>
        <div v-else class="w-16" />

        <div class="text-xs italic text-secondary font-display">
          Step <strong class="text-foreground">{{ currentStepIndex + 1 }}</strong> of {{ steps.length }}
        </div>

        <Button v-if="currentStep !== 'preview'" variant="cta" class="font-sans" @click="nextStep">
          Next <ArrowRight />
        </Button>
        <Button
          v-else
          variant="cta"
          accent="var(--wd-green-700)"
          class="font-sans"
          :loading="isPublishing"
          @click="publish"
        >
          {{ isPublishing ? 'Submitting…' : 'Submit for review' }}
        </Button>
      </div>
    </div>
  </div>
</template>
