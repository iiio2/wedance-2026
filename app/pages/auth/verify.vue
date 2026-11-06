<script setup lang="ts">
import { ResetPasswordSchema } from '#shared/validation'
import { isRsvpAnswer } from '#shared/utils/rsvp'

definePageMeta({ layout: false })

const route = useRoute()
const { verifyMagicLink, resetPassword } = useAuth()

const isResetMode = computed(() => route.query.mode === 'reset')

const status = ref<'loading' | 'reset-form' | 'success' | 'error'>('loading')
const errorMessage = ref('')
const dancerName = ref('')
const backToEvent = ref(false)

// Password reset form state
const newPassword = ref('')
const confirmPassword = ref('')
const showPassword = ref(false)
const resetLoading = ref(false)
const resetError = ref('')
const { errors, validate, fieldAttrs } = useFormValidation(ResetPasswordSchema, () => ({
  password: newPassword.value,
  confirmPassword: confirmPassword.value,
}))

onMounted(async () => {
  const token = route.query.token as string

  if (!token) {
    status.value = 'error'
    errorMessage.value = 'No verification token found.'
    return
  }

  if (isResetMode.value) {
    // Password reset: show the form instead of auto-logging in.
    status.value = 'reset-form'
    return
  }

  // Plain magic-link login: verify and redirect.
  try {
    const result = await verifyMagicLink(token)
    dancerName.value = result.name
    status.value = 'success'

    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
      ? route.query.redirect
      : '/my-plan'
    // The event poll answer this link was sent for (RAZ-718): answer it again,
    // signed in, which confirms it, then land back on the same event.
    const eventParam = /^\/events\/([^/?#]+)/.exec(redirect)?.[1]
    if (eventParam && isRsvpAnswer(route.query.do)) {
      backToEvent.value = true
      const guest = typeof route.query.guest === 'string' ? route.query.guest : undefined
      try {
        await useNuxtApp().$trpc.rsvp.answer.mutate({ event: decodeURIComponent(eventParam), answer: route.query.do, guestToken: guest })
      } catch (e) {
        console.warn('[verify] could not confirm the event answer', e)
      }
    }
    setTimeout(() => {
      navigateTo(redirect)
    }, 2000)
  } catch (e: any) {
    status.value = 'error'
    errorMessage.value = e.message || 'Invalid or expired link.'
  }
})

async function handleResetPassword() {
  resetError.value = ''

  const validation = validate()
  if (!validation.success) return

  const token = route.query.token as string
  resetLoading.value = true
  try {
    const result = await resetPassword(token, validation.data.password)
    dancerName.value = result.name
    status.value = 'success'

    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/')
      ? route.query.redirect
      : '/my-plan'
    setTimeout(() => {
      navigateTo(redirect)
    }, 2000)
  } catch (e: any) {
    resetError.value = e.message || 'Invalid or expired link. Please request a new one.'
  } finally {
    resetLoading.value = false
  }
}

</script>

<template>
  <main
    class="flex min-h-screen items-center justify-center px-4 bg-background"
  >
    <div class="w-full max-w-sm">
      <!-- Accent bar -->
      <div class="h-1.5 rounded-t-2xl bg-wd-red-600" />
      <div
        class="rounded-b-2xl px-6 pb-6 pt-5 space-y-4"
        style="background:white; box-shadow: 0 4px 24px rgba(59,31,13,0.08);"
      >
        <!-- Loading -->
        <template v-if="status === 'loading'">
          <div class="text-center space-y-3">
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">
              Verifying
            </div>
            <h1 class="text-2xl leading-tight text-foreground font-display">
              Checking your link…
            </h1>
            <p class="text-sm text-muted-foreground font-sans">
              Just a moment.
            </p>
          </div>
        </template>

        <!-- Password reset form -->
        <template v-else-if="status === 'reset-form'">
          <div class="space-y-1">
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">
              Account recovery
            </div>
            <h1 class="text-2xl leading-tight text-foreground font-display">
              Set a new password
            </h1>
            <p class="text-sm text-muted-foreground font-sans">
              Enter your new password below.
            </p>
          </div>

          <form class="space-y-4 pt-2" novalidate @submit.prevent="handleResetPassword">
            <Field id="new-password" label="New password" :error="errors.password">
              <div class="relative">
                <Input
                  v-model="newPassword"
                  :type="showPassword ? 'text' : 'password'"
                  placeholder="At least 8 characters"
                  autocomplete="new-password"
                  required
                  class="pr-20"
                  v-bind="fieldAttrs('password', 'new-password-error')"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  class="absolute right-1 top-1/2 -translate-y-1/2 text-xs font-bold uppercase tracking-wider text-secondary"
                  :aria-pressed="showPassword"
                  @click="showPassword = !showPassword"
                >
                  {{ showPassword ? 'Hide' : 'Show' }}
                </Button>
              </div>
            </Field>

            <Field id="confirm-password" label="Confirm password" :error="errors.confirmPassword">
              <Input
                v-model="confirmPassword"
                :type="showPassword ? 'text' : 'password'"
                placeholder="Repeat your password"
                autocomplete="new-password"
                required
                v-bind="fieldAttrs('confirmPassword', 'confirm-password-error')"
              />
            </Field>

            <p v-if="resetError" role="alert" class="text-sm font-bold text-primary font-sans">
              {{ resetError }}
            </p>

            <Button type="submit" variant="pill" size="lg" class="w-full" :loading="resetLoading">
              {{ resetLoading ? 'Saving…' : 'Save new password' }}
            </Button>
          </form>
        </template>

        <!-- Success -->
        <template v-else-if="status === 'success'">
          <div class="text-center space-y-3">
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">
              {{ isResetMode ? 'Password updated' : 'Welcome' }}
            </div>
            <h1 class="text-2xl leading-tight text-foreground font-display">
              {{ isResetMode ? 'You\'re all set!' : `Welcome, ${dancerName}!` }}
            </h1>
            <p class="text-sm text-muted-foreground font-sans">
              {{ isResetMode ? 'Your password has been changed. Taking you to your plan…' : backToEvent ? "You're signed in and your answer is confirmed. Taking you back to the event…" : "You're signed in. Taking you to your plan…" }}
            </p>
          </div>
        </template>

        <!-- Error -->
        <template v-else>
          <div class="text-center space-y-3">
            <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">
              Something went wrong
            </div>
            <h1 class="text-2xl leading-tight text-foreground font-display">
              Link expired or invalid
            </h1>
            <p class="text-sm text-muted-foreground font-sans">{{ errorMessage }}</p>
            <div class="pt-2">
              <NuxtLink
                to="/"
                class="text-sm font-bold underline text-primary font-sans"
              >
                Go to homepage
              </NuxtLink>
            </div>
          </div>
        </template>
      </div>

      <!-- Brand footer -->
      <div class="flex justify-center pt-4">
        <Brand />
      </div>
    </div>
  </main>
</template>
