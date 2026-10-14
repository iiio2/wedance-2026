<script setup lang="ts">
/**
 * Email + password auth modal, styled in the 2026 V3 tropical aesthetic
 * (design-system Field / Input / Button on the cream background). Modes: Login
 * (email + password), Register (name + email + password only), and Recovery
 * (magic-link "forgot password").
 *
 * Register is intentionally near-instant: it collects ONLY name, email, and
 * password. Dance styles / role / city are NOT asked here — they belong to a
 * later onboarding step. The register tRPC procedure keeps those params
 * optional, so callers that already collected them via their own onboarding
 * (e.g. the festival page) may still pass them through `prefill`; the modal
 * forwards prefilled values but never renders inputs for them.
 *
 * Recovery ("Forgot password?") reuses the existing magic-link plumbing: it
 * calls auth.requestMagicLink with purpose='recovery'; the emailed link points
 * to /auth/verify?token=…&mode=reset which shows a "set new password" form.
 * requestMagicLink shows the same "check your email" confirmation whether or
 * not the address is registered, so the recovery view never reveals which
 * emails exist.
 */
import { LoginSchema, RecoverySchema, RegisterSchema } from '#shared/validation'

const props = defineProps<{
  open: boolean
  action: string
  prefill?: { name?: string; email?: string; danceStyles?: string[]; role?: 'lead' | 'follow' | 'both'; city?: string }
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const { login, register, requestMagicLink } = useAuth()

const headlines: Record<string, string> = {
  signin: 'Sign in to WeDance',
  going: 'Join to save your workshop plan',
  profile: 'Join to view dancer profiles',
  share: 'Join to share your plan',
  save: 'Join to save your plan',
  dashboard: 'Join to build your dashboard',
  onboarding: 'Almost there! Join to start discovering',
  partner: 'Join to find a dance partner',
  social: 'Join the community',
  booking: 'Make your WeDance account',
}

type Mode = 'login' | 'register' | 'recovery'

// signin action → start in login mode; every other action is a "join" prompt →
// start in register mode. The user can flip to recovery via "Forgot password?".
const mode = ref<Mode>('login')
const isRegister = computed(() => mode.value === 'register')
const isRecovery = computed(() => mode.value === 'recovery')

const form = reactive({
  name: '',
  email: '',
  password: '',
})

const error = ref('')
const loading = ref(false)
const showPassword = ref(false)

// Recovery sub-state: after a successful requestMagicLink we show a
// "check your email" confirmation instead of the email input.
const recoverySent = ref(false)

// Track whether the name was pre-filled from onboarding — hide it in the form.
const hasPrefillName = ref(false)

// Focus management (accessibility): Input is a component, so focus by id.
function focusById(id: string) {
  nextTick(() => document.getElementById(id)?.focus())
}

// Login and register share the inputs above; `authForm` is whichever is showing.
// A prefilled name has no visible input, so register falls back to it.
const loginForm = reactive(useFormValidation(LoginSchema, form))
const registerForm = reactive(useFormValidation(RegisterSchema, () => ({
  ...form,
  name: form.name.trim() || props.prefill?.name || '',
})))
const authForm = computed(() => (isRegister.value ? registerForm : loginForm))
const recoveryForm = reactive(useFormValidation(RecoverySchema, form))

function resetValidation() {
  loginForm.reset()
  registerForm.reset()
  recoveryForm.reset()
}

function resetForm() {
  form.name = ''
  form.email = ''
  form.password = ''
  error.value = ''
  showPassword.value = false
  recoverySent.value = false
  hasPrefillName.value = false
  resetValidation()
}

function applyPrefill() {
  if (!props.prefill) return
  if (props.prefill.name) { form.name = props.prefill.name; hasPrefillName.value = true }
  if (props.prefill.email) form.email = props.prefill.email
}

watch(() => props.open, (open) => {
  if (!open) {
    resetForm()
  } else {
    // signin → login; any "join" action → register.
    mode.value = props.action === 'signin' ? 'login' : 'register'
    applyPrefill()
  }
})

function switchMode(next: Mode) {
  mode.value = next
  error.value = ''
  recoverySent.value = false
  resetValidation()
}

function openRecovery() {
  switchMode('recovery')
  // Move focus to the recovery email input once it renders.
  focusById('recovery-email')
}

function backToLogin() {
  switchMode('login')
  focusById('auth-email')
}

async function handleSubmit() {
  error.value = ''

  if (isRegister.value) {
    const result = registerForm.validate()
    if (!result.success) return
    await submitWith(async () => {
      // Fast register: name + email + password only. Dance styles / role /
      // city are forwarded ONLY when a caller pre-filled them from its own
      // onboarding — the modal never collects them itself.
      await register({
        ...result.data,
        danceStyles: props.prefill?.danceStyles ?? [],
        role: props.prefill?.role,
        city: props.prefill?.city,
      })
      emit('update:open', false)
      // New users go to onboarding (the intent picker). Existing users (login)
      // never do.
      await navigateTo('/onboarding')
    })
  } else {
    const result = loginForm.validate()
    if (!result.success) return
    await submitWith(async () => {
      await login(result.data)
      emit('update:open', false)
    })
  }
}

async function submitWith(action: () => Promise<void>) {
  loading.value = true
  try {
    await action()
  } catch (e: any) {
    error.value = e?.message || 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}

async function handleRecovery() {
  error.value = ''

  const result = recoveryForm.validate()
  if (!result.success) return

  loading.value = true
  try {
    // Send a password-reset magic link. requestMagicLink returns the same
    // result whether or not the email exists → no user enumeration.
    await requestMagicLink({ ...result.data, purpose: 'recovery' })
    recoverySent.value = true
  } catch (e: any) {
    error.value = e?.message || 'Something went wrong. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="sm:max-w-md border-0 p-0 overflow-hidden [&>button]:top-6 [&>button]:right-5 bg-background text-foreground font-display"
    >
      <!-- Accent bar -->
      <div class="h-1.5 bg-primary" />

      <div class="px-6 pb-6 pt-4">
        <!-- ============================ RECOVERY ============================ -->
        <template v-if="isRecovery">
          <DialogHeader class="text-left space-y-1">
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">
              Account recovery
            </div>
            <DialogTitle class="text-2xl leading-tight text-foreground font-display">
              {{ recoverySent ? 'Check your email' : 'Forgot your password?' }}
            </DialogTitle>
            <DialogDescription class="text-muted-foreground font-sans">
              {{ recoverySent
                ? 'We sent you a password reset link. Click it to set a new password.'
                : 'Enter your email and we\'ll send you a link to reset your password.' }}
            </DialogDescription>
          </DialogHeader>

          <!-- Recovery form -->
          <form v-if="!recoverySent" class="space-y-4 pt-4" novalidate @submit.prevent="handleRecovery">
            <Field id="recovery-email" label="Email" :error="recoveryForm.errors.email">
              <Input
                v-model="form.email"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                required
                v-bind="recoveryForm.fieldAttrs('email', 'recovery-email-error')"
              />
            </Field>

            <p v-if="error" class="text-sm font-bold text-destructive font-sans">
              {{ error }}
            </p>

            <Button type="submit" variant="pill" size="lg" class="w-full px-5 font-sans" :loading="loading">
              {{ loading ? 'Sending…' : 'Send me a reset link' }}
            </Button>

            <p class="text-center text-sm pt-1 text-muted-foreground font-sans">
              <Button type="button" variant="link" class="h-auto p-0 font-bold underline" @click="backToLogin">
                Back to login
              </Button>
            </p>
          </form>

          <!-- Recovery confirmation -->
          <div v-else class="space-y-4 pt-4">
            <div
              class="rounded-2xl px-4 py-4 text-sm bg-white border border-success/33 text-foreground font-sans"
            >
              If <span class="font-bold">{{ form.email.trim() }}</span> has an account, a password reset link is on its way.
              The link expires in 15 minutes.
            </div>
            <p class="text-center text-sm text-muted-foreground font-sans">
              <Button type="button" variant="link" class="h-auto p-0 font-bold underline" @click="backToLogin">
                Back to login
              </Button>
            </p>
          </div>
        </template>

        <!-- ======================= LOGIN / REGISTER ======================= -->
        <template v-else>
          <DialogHeader class="text-left space-y-1">
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">
              {{ isRegister ? 'Join the floor' : 'Welcome back' }}
            </div>
            <DialogTitle class="text-2xl leading-tight text-foreground font-display">
              {{ isRegister ? (headlines[action] || 'Join WeDance') : 'Sign in to WeDance' }}
            </DialogTitle>
            <DialogDescription class="text-muted-foreground font-sans">
              {{ isRegister ? 'Create your account with email and password.' : 'Enter your email and password.' }}
            </DialogDescription>
          </DialogHeader>

          <form class="space-y-4 pt-4" novalidate @submit.prevent="handleSubmit">
            <!-- Name (register only, unless prefilled) -->
            <Field v-if="isRegister && !hasPrefillName" id="auth-name" label="Name" :error="authForm.errors.name">
              <Input
                v-model="form.name"
                placeholder="Your name"
                autocomplete="name"
                v-bind="authForm.fieldAttrs('name', 'auth-name-error')"
              />
            </Field>

            <!-- Email -->
            <Field id="auth-email" label="Email" :error="authForm.errors.email">
              <Input
                v-model="form.email"
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                required
                v-bind="authForm.fieldAttrs('email', 'auth-email-error')"
              />
            </Field>

            <!-- Password -->
            <Field id="auth-password" :error="authForm.errors.password">
              <div class="flex items-center justify-between">
                <Label for="auth-password">Password</Label>
                <Button
                  v-if="!isRegister"
                  type="button"
                  variant="link"
                  class="h-auto p-0 text-xs font-bold underline font-sans"
                  @click="openRecovery"
                >
                  Forgot password?
                </Button>
              </div>
              <div class="relative">
                <Input
                  v-model="form.password"
                  :type="showPassword ? 'text' : 'password'"
                  :placeholder="isRegister ? 'At least 8 characters' : 'Your password'"
                  :autocomplete="isRegister ? 'new-password' : 'current-password'"
                  required
                  class="pr-16"
                  v-bind="authForm.fieldAttrs('password', 'auth-password-error')"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="absolute right-1 top-1/2 -translate-y-1/2 px-3 text-xs font-bold uppercase tracking-wider text-secondary font-sans"
                  :aria-pressed="showPassword"
                  aria-controls="auth-password"
                  @click="showPassword = !showPassword"
                >
                  {{ showPassword ? 'Hide' : 'Show' }}
                </Button>
              </div>
            </Field>

            <p v-if="error" class="text-sm font-bold text-destructive font-sans">
              {{ error }}
            </p>

            <Button type="submit" variant="pill" size="lg" class="w-full px-5 font-sans" :loading="loading">
              {{ loading
                ? (isRegister ? 'Creating account…' : 'Signing in…')
                : (isRegister ? 'Create account' : 'Sign in') }}
            </Button>

            <!-- Mode toggle -->
            <p class="text-center text-sm pt-1 text-muted-foreground font-sans">
              <template v-if="isRegister">
                Already have an account?
                <Button type="button" variant="link" class="h-auto p-0 font-bold underline" @click="switchMode('login')">
                  Sign in
                </Button>
              </template>
              <template v-else>
                New to WeDance?
                <Button type="button" variant="link" class="h-auto p-0 font-bold underline" @click="switchMode('register')">
                  Create an account
                </Button>
              </template>
            </p>
          </form>
        </template>
      </div>
    </DialogContent>
  </Dialog>
</template>
