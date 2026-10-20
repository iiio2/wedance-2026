<script setup lang="ts">
/**
 * /onboarding — the intent picker + per-persona field collection.
 *
 * Register is fast (name/email/password); this page does the meaningful
 * collection and routes each new user to their entry point in the my-plan
 * cascade. Design: ~/Orgs/WeDance/03_Coordination/2026-07-04-new-user-personas-onboarding.md
 *
 * Flow: Step 1 asks the one routing question ("What brings you to WeDance?").
 * Step 2 branches by persona and collects only that persona's fields, calls
 * completeOnboarding, and redirects to the persona's landing. Skip still stamps
 * onboardedAt (intent 'skipped') so the guard never nags, and lands on my-plan.
 *
 * 2026 tropical style — design-system tokens (cream / brown / red).
 */
import { ArrowRight, ArrowLeft } from 'lucide-vue-next'
import { onboardingDetailsSchema } from '#shared/validation'
import { WD } from '~/lib/brand'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — Welcome',
})

const { isSignedIn, isLoading, completeOnboarding, city: meCity, danceStyles: meStyles, role: meRole, onboardedAt } = useAuth()

// onboarding_step_completed — the step funnel before `onboarding_completed`.
// `repeat` = this account had onboarded before (re-onboarding, not a new sign-up).
function stepDone(stepName: 'intent' | 'details' | 'skip', props: Record<string, unknown> = {}) {
  useTrack().track('onboarding_step_completed', { step: stepName, repeat: !!onboardedAt.value, ...props })
}

// Persona definitions: the one choice that routes everything.
type IntentKey = 'social' | 'festivals' | 'learn' | 'perform' | 'organize'
interface Persona {
  key: IntentKey
  emoji: string
  label: string
  blurb: string
  landing: string
  // Which fields step 2 collects for this persona.
  collects: { city?: boolean; styles?: boolean; role?: boolean }
}
const PERSONAS: Persona[] = [
  { key: 'social', emoji: '💃', label: 'Dance socially', blurb: 'Find where to dance this week in your city.', landing: '/my-plan', collects: { city: true, styles: true, role: true } },
  { key: 'festivals', emoji: '✈️', label: 'Travel to festivals', blurb: 'Plan your festival year and see who\'s going.', landing: '/festivals', collects: { styles: true, role: true } },
  { key: 'learn', emoji: '🎓', label: 'Learn a dance', blurb: 'Start or level up — find your dance and classes.', landing: '/find-your-dance', collects: {} },
  { key: 'perform', emoji: '🎧', label: 'Perform / DJ', blurb: 'Get booked and find gigs.', landing: '/artists', collects: {} },
  { key: 'organize', emoji: '📣', label: 'Run events', blurb: 'Fill your floor — list socials and classes.', landing: '/for-organizers', collects: {} },
]


type Step = 'intent' | 'details'
const step = ref<Step>('intent')
const chosen = ref<Persona | null>(null)

const form = reactive({
  city: '',
  danceStyles: [] as string[],
  role: '' as '' | 'lead' | 'follow' | 'both',
})

const error = ref('')
const loading = ref(false)
// Validates only the fields the chosen persona collects; the rest come back undefined.
const details = useFormValidation(() => onboardingDetailsSchema(chosen.value?.collects ?? {}), form)
const { errors, fieldAttrs } = details

// Refs for focus management.
const firstIntentBtn = ref<HTMLButtonElement | null>(null)
const detailsHeading = ref<HTMLElement | null>(null)

// Redirect signed-out users to home — onboarding requires a session.
watch([isLoading, isSignedIn], ([loadingNow, signedIn]) => {
  if (!loadingNow && !signedIn) {
    navigateTo('/')
  }
}, { immediate: true })

onMounted(() => {
  // Prefill from any values a caller already captured (e.g. festival onboarding).
  if (meCity.value) form.city = meCity.value
  if (meStyles.value?.length) form.danceStyles = [...meStyles.value]
  if (meRole.value === 'lead' || meRole.value === 'follow' || meRole.value === 'both') form.role = meRole.value
  nextTick(() => firstIntentBtn.value?.focus())
})

const detailsNeeded = computed(() => {
  const c = chosen.value?.collects
  return !!(c && (c.city || c.styles || c.role))
})

function pickIntent(p: Persona) {
  chosen.value = p
  error.value = ''
  details.reset()
  stepDone('intent', { intent: p.key, has_details: detailsNeeded.value })
  if (detailsNeeded.value) {
    step.value = 'details'
    nextTick(() => {
      // focus() returns undefined, so `a?.focus() ?? b?.focus()` would focus both — pick one.
      const city = document.getElementById('onb-city')
      if (city) city.focus()
      else detailsHeading.value?.focus()
    })
  } else {
    // No fields to collect — finish immediately.
    finish()
  }
}

function back() {
  step.value = 'intent'
  error.value = ''
  nextTick(() => firstIntentBtn.value?.focus())
}

async function finish() {
  if (!chosen.value) return

  const result = details.validate()
  if (!result.success) return
  if (detailsNeeded.value) {
    stepDone('details', {
      intent: chosen.value.key,
      has_city: !!form.city,
      styles_count: form.danceStyles.length,
      has_role: !!form.role,
    })
  }

  loading.value = true
  error.value = ''
  try {
    await completeOnboarding({ intent: chosen.value.key, ...result.data })
    await navigateTo(chosen.value.landing)
  } catch (e: any) {
    error.value = e?.message || 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}

async function skip() {
  stepDone('skip', { intent: 'skipped' })
  loading.value = true
  error.value = ''
  try {
    // Skip still stamps onboardedAt so the guard doesn't nag again.
    await completeOnboarding({ intent: 'skipped' })
    await navigateTo('/my-plan')
  } catch (e: any) {
    error.value = e?.message || 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}

</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />

    <main class="max-w-2xl mx-auto px-4 pt-10 pb-16">
      <!-- Progress indicator -->
      <div class="flex items-center justify-center gap-2 mb-8" aria-hidden="true">
        <span class="h-1.5 rounded-full transition-all" :style="{ width: '40px', background: 'var(--wd-red-600)' }" />
        <span
          class="h-1.5 rounded-full transition-all"
          :style="{ width: '40px', background: step === 'details' ? WD.red600 : (WD.brown900 + '22') }"
        />
      </div>
      <p class="sr-only" role="status">
        Step {{ step === 'intent' ? 1 : 2 }} of 2
      </p>

      <!-- ============================ STEP 1: INTENT ============================ -->
      <template v-if="step === 'intent'">
        <div class="text-center mb-8">
          <div class="text-eyebrow uppercase tracking-[0.3em] font-bold mb-3 text-secondary">
            Welcome to the floor
          </div>
          <h1 class="text-4xl sm:text-5xl leading-[1.02] text-foreground">
            What brings you to <em class="italic text-primary">WeDance?</em>
          </h1>
          <p class="mt-4 text-base text-muted-foreground font-sans">
            Pick one — we'll set up the rest around it.
          </p>
        </div>

        <div class="grid gap-3">
          <button
            v-for="(p, i) in PERSONAS"
            :key="p.key"
            :ref="el => { if (i === 0) firstIntentBtn = el as HTMLButtonElement }"
            type="button"
            class="group flex items-center gap-4 text-left rounded-2xl px-5 py-4 bg-white transition-all hover:-translate-y-0.5"
            style="border:1px solid color-mix(in srgb, var(--wd-brown-900) 13.3%, transparent); box-shadow: 0 1px 0 color-mix(in srgb, var(--wd-brown-900) 3.9%, transparent), 0 6px 16px rgba(59,31,18,0.04);"
            @click="pickIntent(p)"
          >
            <span class="text-3xl shrink-0" aria-hidden="true">{{ p.emoji }}</span>
            <span class="min-w-0 flex-1">
              <span class="block font-bold text-lg leading-tight text-foreground">{{ p.label }}</span>
              <span class="block text-sm mt-0.5 text-muted-foreground font-sans">{{ p.blurb }}</span>
            </span>
            <ArrowRight class="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-1 text-primary" />
          </button>
        </div>

        <p v-if="error" class="text-sm font-bold text-center mt-4 text-primary font-sans">
          {{ error }}
        </p>

        <div class="text-center mt-8">
          <Button variant="link" class="text-secondary underline font-sans" :disabled="loading" @click="skip">
            Skip for now
          </Button>
        </div>
      </template>

      <!-- =========================== STEP 2: DETAILS =========================== -->
      <template v-else>
        <div class="text-center mb-8">
          <div class="text-eyebrow uppercase tracking-[0.3em] font-bold mb-3 text-secondary">
            {{ chosen?.emoji }} {{ chosen?.label }}
          </div>
          <h1
            ref="detailsHeading"
            tabindex="-1"
            class="text-3xl sm:text-4xl leading-[1.05] outline-none text-foreground"
          >
            A couple <em class="italic text-primary">details</em>
          </h1>
          <p class="mt-4 text-base text-muted-foreground font-sans">
            So we can fill your plan with the right things.
          </p>
        </div>

        <form class="space-y-6" novalidate @submit.prevent="finish">
          <!-- City -->
          <Field v-if="chosen?.collects.city" id="onb-city" label="Your city" :error="errors.city">
            <CityCombobox
              v-model="form.city"
              placeholder="Munich, Berlin…"
              v-bind="fieldAttrs('city', 'onb-city-error')"
            />
          </Field>

          <!-- Styles -->
          <div v-if="chosen?.collects.styles" class="space-y-2">
            <label for="onb-styles" class="block text-sm font-bold text-foreground">Which dances?</label>
            <DanceStylePicker
              id="onb-styles"
              v-model="form.danceStyles"
              label="Which dances?"
              v-bind="fieldAttrs('danceStyles', 'onb-styles-error')"
            />
            <FieldError id="onb-styles-error" :message="errors.danceStyles" />
            <NuxtLink
              to="/find-your-dance"
              class="inline-block text-xs italic hover:underline pt-1 text-secondary font-display"
            >
              Don't know which dance? →
            </NuxtLink>
          </div>

          <!-- Role -->
          <div v-if="chosen?.collects.role" class="space-y-2">
            <span id="onb-role-label" class="text-sm font-bold text-foreground">Do you lead or follow?</span>
            <div role="radiogroup" aria-labelledby="onb-role-label" class="flex gap-3" v-bind="fieldAttrs('role', 'onb-role-error')">
              <label
                v-for="r in [{ value: 'lead', label: 'Lead' }, { value: 'follow', label: 'Follow' }, { value: 'both', label: 'Both' }]"
                :key="r.value"
                class="flex-1 flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold cursor-pointer transition-colors"
                :style="form.role === r.value
                  ? 'background:var(--wd-red-600); color:white; border:1px solid var(--wd-red-600);'
                  : 'background:white; color:var(--wd-brown-700); border:1px solid color-mix(in srgb, var(--wd-brown-900) 20%, transparent);'"
              >
                <input v-model="form.role" type="radio" name="role" :value="r.value" class="sr-only">
                {{ r.label }}
              </label>
            </div>
            <FieldError id="onb-role-error" :message="errors.role" />
          </div>

          <p v-if="error" class="text-sm font-bold text-primary font-sans">
            {{ error }}
          </p>

          <div class="flex items-center gap-3 pt-2">
            <Button type="button" variant="outline-pill" size="lg" class="px-4" @click="back">
              <ArrowLeft aria-hidden="true" /> Back
            </Button>
            <Button type="submit" variant="pill" size="lg" class="flex-1 px-5" :loading="loading">
              {{ loading ? 'Setting up…' : 'Take me to my plan' }}
              <ArrowRight v-if="!loading" aria-hidden="true" />
            </Button>
          </div>

          <div class="text-center pt-1">
            <Button variant="link" class="text-secondary underline font-sans" :disabled="loading" @click="skip">
              Skip for now
            </Button>
          </div>
        </form>
      </template>
    </main>
  </div>
</template>
