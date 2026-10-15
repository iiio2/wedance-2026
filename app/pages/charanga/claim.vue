<script setup lang="ts">
/**
 * Claim flow for TicketTailor verified attendees.
 *
 * Buyer journey:
 *   1. They buy on TicketTailor → webhook stubs a `festival_signups` row with
 *      their email and `dancer_id = NULL` (PR 1).
 *   2. Confirmation email contains a link to /charanga/claim?email=<their email>.
 *   3. If not signed in: show a magic-link sign-in form (email pre-filled from
 *      URL). The magic-link flow verifies email ownership (sets emailVerifiedAt).
 *   4. If signed in with verified email: auto-call claimMyTicketHolderRows →
 *      success view.
 *
 * Security (RAZ-323): ticket claiming requires verified email ownership.
 * The pre-auth public getClaimStatus endpoint was removed to prevent leaking
 * whether an email has pending tickets. Users now sign in first (which
 * verifies their email), then claim.
 */
import { ArrowRight, Ticket, Mail, AlertCircle } from 'lucide-vue-next'
import { ClaimTicketSchema } from '#shared/validation'
import { festivalPath } from '#shared/utils/eventSlug'

const { $trpc } = useNuxtApp()
const route = useRoute()
const { isSignedIn, isLoading: authLoading } = useAuth()
const { requestMagicLink } = useAuth()

useHead({
  title: 'Claim your spot — WeDance',
  meta: [
    { name: 'description', content: 'Connect your TicketTailor purchase to your WeDance profile.' },
    { name: 'robots', content: 'noindex' },
  ],
})

const emailFromUrl = computed(() => {
  const e = route.query.email
  return typeof e === 'string' && e.includes('@') ? e : ''
})

type Status =
  | { kind: 'loading' }
  | { kind: 'pending'; email: string }
  | { kind: 'needs-verification' }
  | { kind: 'claimed'; festivals: { slug: string; name: string }[] }
  | { kind: 'already-claimed' }
  | { kind: 'error'; message: string }

const status = ref<Status>({ kind: 'loading' })
const signInEmail = ref('')
const signInError = ref('')
const signInLoading = ref(false)
const signInSent = ref(false)
const { errors, validate, fieldAttrs } = useFormValidation(ClaimTicketSchema, () => ({ email: signInEmail.value }))

async function refreshStatus() {
  status.value = { kind: 'loading' }

  try {
    if (isSignedIn.value) {
      // Signed in — try to claim. The server checks emailVerifiedAt and
      // returns FORBIDDEN if the email isn't verified yet.
      try {
        const result = await $trpc.claim.claimMyTicketHolderRows.mutate()
        if (result.claimed > 0) {
          status.value = { kind: 'claimed', festivals: result.festivals }
        } else {
          status.value = { kind: 'already-claimed' }
        }
      } catch (e: any) {
        if (e?.data?.code === 'FORBIDDEN') {
          // Email not verified — prompt them to use magic link
          status.value = { kind: 'needs-verification' }
        } else {
          throw e
        }
      }
      return
    }

    // Not signed in — show sign-in form with pre-filled email from URL.
    signInEmail.value = emailFromUrl.value
    status.value = { kind: 'pending', email: emailFromUrl.value }
  } catch (e: any) {
    status.value = { kind: 'error', message: e?.message || 'Something went wrong. Please try again.' }
  }
}

// Wait for auth init to complete before deciding which path to take.
watch(authLoading, (loading) => {
  if (!loading) refreshStatus()
}, { immediate: true })

async function handleSignIn() {
  signInError.value = ''

  const result = validate()
  if (!result.success) return

  signInLoading.value = true
  try {
    await requestMagicLink(result.data)
    signInSent.value = true
  } catch (e: any) {
    signInError.value = e?.message || 'Failed to send magic link. Please try again.'
  } finally {
    signInLoading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-background px-4 py-12">
    <div class="mx-auto w-full max-w-md space-y-6">
      <!-- Loading -->
      <template v-if="status.kind === 'loading'">
        <div class="flex flex-col items-center gap-3 pt-8 text-center">
          <div class="text-3xl animate-pulse">🎫</div>
          <p class="text-sm text-muted-foreground">Looking up your ticket...</p>
        </div>
      </template>

      <!-- Signed in + claimed successfully -->
      <template v-else-if="status.kind === 'claimed'">
        <div class="space-y-5 text-center">
          <div class="text-4xl">🎉</div>
          <h1 class="text-2xl font-semibold">You're on the verified roster</h1>
          <p class="text-sm text-muted-foreground">
            Welcome — your TicketTailor purchase is now linked to your WeDance profile for
            <span v-for="(f, i) in status.festivals" :key="f.slug">
              <span class="font-medium text-foreground">{{ f.name }}</span><template v-if="i < status.festivals.length - 1">, </template>
            </span>.
          </p>
        </div>

        <div class="space-y-3 pt-4">
          <NuxtLink
            v-for="f in status.festivals"
            :key="f.slug"
            :to="`${festivalPath(f.slug)}`"
            class="flex w-full items-center justify-between rounded-md border bg-card px-4 py-3 text-sm font-medium hover:bg-muted"
          >
            <span>Continue to {{ f.name }}</span>
            <ArrowRight class="size-4" />
          </NuxtLink>
        </div>
      </template>

      <!-- Signed in but no stub found -->
      <template v-else-if="status.kind === 'already-claimed'">
        <div class="space-y-5 text-center">
          <div class="text-4xl">🤔</div>
          <h1 class="text-xl font-semibold">No pending ticket found</h1>
          <p class="text-sm text-muted-foreground">
            We couldn't find a TicketTailor purchase linked to your account email.
            If you bought your ticket under a different email, please contact support
            and we'll connect it manually.
          </p>
        </div>

        <div class="pt-2 text-center">
          <a
            href="https://buytickets.at/wedancevip/1796869"
            target="_blank"
            rel="noopener"
            class="inline-flex items-center gap-1.5 text-sm underline hover:text-foreground"
          >
            <Ticket class="size-4" />
            View the Charanga event on TicketTailor
          </a>
        </div>
      </template>

      <!-- Signed in but email not verified -->
      <template v-else-if="status.kind === 'needs-verification'">
        <div class="space-y-5 text-center">
          <div class="text-4xl">🔒</div>
          <h1 class="text-xl font-semibold">Verify your email to claim your ticket</h1>
          <p class="text-sm text-muted-foreground">
            For your security, we need to verify you own this email address before
            linking your TicketTailor purchase. Please sign in using the magic link
            below — this proves it's really you.
          </p>
        </div>

        <div class="rounded-lg border bg-card p-5 shadow-sm">
          <template v-if="!signInSent">
            <form class="space-y-4" novalidate @submit.prevent="handleSignIn">
              <div class="space-y-2">
                <label for="claim-email" class="text-sm font-medium">Email</label>
                <input
                  id="claim-email"
                  v-model="signInEmail"
                  type="email"
                  placeholder="you@example.com"
                  required
                  autofocus
                  class="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  v-bind="fieldAttrs('email', 'claim-email-error')"
                >
                <FieldError id="claim-email-error" :message="errors.email" />
              </div>
              <p v-if="signInError" class="text-sm text-destructive">{{ signInError }}</p>
              <Button type="submit" class="w-full" :disabled="signInLoading">
                {{ signInLoading ? 'Sending...' : 'Send verification link' }}
              </Button>
            </form>
          </template>

          <template v-else>
            <div class="space-y-4 py-2 text-center">
              <Mail class="mx-auto size-10 text-primary" />
              <h2 class="text-lg font-semibold">Check your email</h2>
              <p class="text-sm text-muted-foreground">
                We sent a verification link to<br>
                <span class="font-medium text-foreground">{{ signInEmail }}</span>
              </p>
              <div class="rounded-md bg-muted/50 p-3 text-left text-xs text-muted-foreground">
                <p class="font-medium text-foreground">Important</p>
                <p class="mt-1">
                  After you sign in via the magic link, please click the
                  <span class="font-medium">"Connect on WeDance"</span> link in your
                  TicketTailor confirmation email again to land back on this page —
                  we'll finish linking your ticket automatically.
                </p>
              </div>
            </div>
          </template>
        </div>
      </template>

      <!-- Error -->
      <template v-else-if="status.kind === 'error'">
        <div class="space-y-5 text-center">
          <AlertCircle class="mx-auto size-10 text-destructive" />
          <h1 class="text-xl font-semibold">Something went wrong</h1>
          <p class="text-sm text-muted-foreground">{{ status.message }}</p>
          <Button variant="outline" @click="refreshStatus">Try again</Button>
        </div>
      </template>

      <!-- Not signed in: sign-in flow -->
      <template v-else-if="status.kind === 'pending'">
        <div class="space-y-3 text-center">
          <div class="text-4xl">🎫</div>
          <h1 class="text-2xl font-semibold">Connect your ticket to WeDance</h1>
          <p class="text-sm text-muted-foreground">
            <template v-if="status.email">
              Sign in with <span class="font-medium text-foreground">{{ status.email }}</span>
              to verify your email and claim your spot on the attendee roster.
            </template>
            <template v-else>
              Sign in with the email you used at checkout to verify your email and
              claim your spot on the verified attendee roster.
            </template>
          </p>
        </div>

        <!-- Sign-in form -->
        <div class="rounded-lg border bg-card p-5 shadow-sm">
          <template v-if="!signInSent">
            <form class="space-y-4" novalidate @submit.prevent="handleSignIn">
              <div class="space-y-2">
                <label for="claim-email" class="text-sm font-medium">Email</label>
                <input
                  id="claim-email"
                  v-model="signInEmail"
                  type="email"
                  placeholder="you@example.com"
                  required
                  autofocus
                  class="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  v-bind="fieldAttrs('email', 'claim-email-error')"
                >
                <FieldError id="claim-email-error" :message="errors.email" />
              </div>
              <p v-if="signInError" class="text-sm text-destructive">{{ signInError }}</p>
              <Button type="submit" class="w-full" :disabled="signInLoading">
                {{ signInLoading ? 'Sending...' : 'Send magic link' }}
              </Button>
            </form>
          </template>

          <template v-else>
            <div class="space-y-4 py-2 text-center">
              <Mail class="mx-auto size-10 text-primary" />
              <h2 class="text-lg font-semibold">Check your email</h2>
              <p class="text-sm text-muted-foreground">
                We sent a sign-in link to<br>
                <span class="font-medium text-foreground">{{ signInEmail }}</span>
              </p>
              <div class="rounded-md bg-muted/50 p-3 text-left text-xs text-muted-foreground">
                <p class="font-medium text-foreground">Important</p>
                <p class="mt-1">
                  After you sign in, please click the
                  <span class="font-medium">"Connect on WeDance"</span> link in your
                  TicketTailor confirmation email a second time to land back on this page —
                  we'll finish linking your ticket automatically.
                </p>
              </div>
            </div>
          </template>
        </div>
      </template>
    </div>
  </div>
</template>
