<script setup lang="ts">
/**
 * Claim flow for TicketTailor verified attendees.
 *
 * Buyer journey:
 *   1. They buy on TicketTailor → webhook stubs a `festival_signups` row with
 *      their email and `dancer_id = NULL` (PR 1).
 *   2. Confirmation email contains a link to /charanga/claim?email=<their email>.
 *   3. If signed in: auto-call claim.claimMyTicketHolderRows → success view.
 *   4. If not signed in: show a magic-link sign-in form, then ask them to
 *      come back here after signing in.
 *
 * Note on the "come back here" step: the existing magic-link flow at
 * /auth/verify hardcodes a redirect to /festivals/meneate-viena-2026 (it does
 * not honour a `redirect` query param). Adding redirect support is out of
 * scope for this PR (see ../../../server/trpc/routers/auth.ts file ownership).
 * After sign-in we instruct the user to click the email link again — when
 * they do, this page will be loaded with an active session and the mutation
 * fires automatically.
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
  | { kind: 'pending'; festivalName: string; festivalSlug: string; email: string }
  | { kind: 'no-ticket' }
  | { kind: 'claimed'; festivals: { slug: string; name: string }[] }
  | { kind: 'already-claimed' } // signed in but no stubs found
  | { kind: 'error'; message: string }

const status = ref<Status>({ kind: 'loading' })
const showSignInForm = ref(false)
const signInEmail = ref('')
const signInError = ref('')
const signInLoading = ref(false)
const signInSent = ref(false)
const { errors, validate, fieldAttrs } = useFormValidation(ClaimTicketSchema, () => ({ email: signInEmail.value }))

async function refreshStatus() {
  status.value = { kind: 'loading' }

  try {
    if (isSignedIn.value) {
      // Signed in — claim whatever's pending and report back.
      const result = await $trpc.claim.claimMyTicketHolderRows.mutate()
      if (result.claimed > 0) {
        status.value = { kind: 'claimed', festivals: result.festivals }
      } else {
        status.value = { kind: 'already-claimed' }
      }
      return
    }

    // Not signed in — peek at status using the email from the URL.
    if (emailFromUrl.value) {
      const result = await $trpc.claim.getClaimStatus.query({ email: emailFromUrl.value })
      if (result.pending) {
        status.value = {
          kind: 'pending',
          festivalName: result.festivalName,
          festivalSlug: result.festivalSlug,
          email: emailFromUrl.value,
        }
        signInEmail.value = emailFromUrl.value
      } else {
        status.value = { kind: 'no-ticket' }
      }
    } else {
      // No email in URL, not signed in — render a generic sign-in prompt.
      status.value = { kind: 'pending', festivalName: '', festivalSlug: '', email: '' }
    }
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

      <!-- No ticket found for the URL email (not signed in) -->
      <template v-else-if="status.kind === 'no-ticket'">
        <div class="space-y-5 text-center">
          <AlertCircle class="mx-auto size-10 text-muted-foreground" />
          <h1 class="text-xl font-semibold">We couldn't find your ticket</h1>
          <p class="text-sm text-muted-foreground">
            No TicketTailor purchase is registered for this email yet.
            If you just bought, give it a minute and refresh — webhooks land within
            a few seconds. Otherwise, please check the email matches what you used at checkout.
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
            Get a Charanga ticket
          </a>
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

      <!-- Pending: sign-in flow -->
      <template v-else-if="status.kind === 'pending'">
        <div class="space-y-3 text-center">
          <div class="text-4xl">🎫</div>
          <h1 class="text-2xl font-semibold">
            <template v-if="status.festivalName">We found your ticket</template>
            <template v-else>Connect your ticket to WeDance</template>
          </h1>
          <p class="text-sm text-muted-foreground">
            <template v-if="status.festivalName">
              Sign in with <span class="font-medium text-foreground">{{ status.email }}</span>
              to confirm your spot for <span class="font-medium text-foreground">{{ status.festivalName }}</span>.
            </template>
            <template v-else>
              Sign in with the email you used at checkout to confirm your spot on the verified attendee roster.
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
