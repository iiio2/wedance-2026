<script setup lang="ts">
/**
 * /oauth/authorize — an assistant (Claude, ChatGPT…) asks to connect to the
 * dancer's WeDance account (MCP, docs/proposals/2026-10-18-mcp-server.md).
 *
 * The server validates the request (oauth.authorizeInfo); this page only
 * shows it: sign in if needed, then the app, what it may do (each permission
 * can be unticked) and which business pages it may act for. "Allow" mints a
 * code and sends the browser back to the app; "Don't allow" sends it back
 * with access_denied. We never redirect anywhere the app didn't register.
 * Framing is blocked (frame-ancestors 'none', nuxt.config routeRules).
 */
import { ShieldCheck, ExternalLink, AlertTriangle, Check } from 'lucide-vue-next'

definePageMeta({ layout: false })
useHead({ title: 'Connect an app — WeDance', meta: [{ name: 'robots', content: 'noindex' }, { name: 'referrer', content: 'no-referrer' }] })

const route = useRoute()
const { $trpc } = useNuxtApp()
const { isSignedIn, isLoading, signOut } = useAuth()

const PARAMS = ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'scope', 'resource'] as const
const params = computed(() => Object.fromEntries(PARAMS.map(k => [k, typeof route.query[k] === 'string' ? route.query[k] as string : undefined])))

type Info = Awaited<ReturnType<typeof $trpc.oauth.authorizeInfo.query>>
const info = ref<Info | null>(null)
const loadError = ref('')
const showSignIn = ref(false)
const picked = ref<Record<string, boolean>>({})
const profilePicked = ref<Record<string, boolean>>({})
const busy = ref<'allow' | 'deny' | null>(null)
const actionError = ref('')

async function load() {
  loadError.value = ''
  try {
    const res = await $trpc.oauth.authorizeInfo.query(params.value)
    info.value = res
    if (res.status === 'redirect') {
      // The app made a mistake we may report back to it (its redirect_uri is registered).
      window.location.replace(res.redirect)
      return
    }
    if (res.status === 'consent') {
      picked.value = Object.fromEntries(res.scopes.map(s => [s.id, true]))
      // One page: ticked. Several: the dancer picks.
      profilePicked.value = Object.fromEntries(res.profiles.map(p => [p.id, res.profiles.length === 1]))
    }
  } catch (e: any) {
    loadError.value = e?.message || 'Couldn’t load this request.'
  }
}

watch([isLoading, isSignedIn], ([loading]) => { if (!loading) load() }, { immediate: true })
watch(isSignedIn, (now) => { if (now) showSignIn.value = false })

const consent = computed(() => info.value?.status === 'consent' ? info.value : null)
const businessPicked = computed(() => !!consent.value && ['business:read', 'business:write', 'business:publish'].some(s => picked.value[s]))
const selectedScopes = computed(() => Object.entries(picked.value).filter(([, v]) => v).map(([k]) => k))
const selectedProfiles = computed(() => Object.entries(profilePicked.value).filter(([, v]) => v).map(([k]) => k))
const profileTypeLabel: Record<string, string> = { organizer: 'Organizer', venue: 'Venue', artist: 'Artist', promoter: 'Promoter' }

async function allow() {
  if (!consent.value) return
  busy.value = 'allow'
  actionError.value = ''
  try {
    const { redirect } = await $trpc.oauth.approve.mutate({
      requestToken: consent.value.requestToken,
      scopes: selectedScopes.value,
      profileIds: businessPicked.value ? selectedProfiles.value : [],
    })
    window.location.replace(redirect)
  } catch (e: any) {
    actionError.value = e?.message || 'Couldn’t connect the app. Try again.'
    busy.value = null
  }
}

async function deny() {
  if (!consent.value) return
  busy.value = 'deny'
  try {
    const { redirect } = await $trpc.oauth.deny.mutate({ requestToken: consent.value.requestToken })
    window.location.replace(redirect)
  } catch (e: any) {
    actionError.value = e?.message || 'Something went wrong.'
    busy.value = null
  }
}

function switchAccount() {
  signOut()
  showSignIn.value = true
}
</script>

<template>
  <main class="flex min-h-screen items-start sm:items-center justify-center px-4 py-10 bg-background font-sans">
    <div class="w-full max-w-md">
      <div class="h-1.5 rounded-t-2xl bg-wd-red-600" />
      <div class="rounded-b-2xl bg-card px-6 pb-6 pt-5 shadow-wd-card space-y-5">
        <NuxtLink to="/" class="block text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">WeDance</NuxtLink>

        <!-- Loading -->
        <div v-if="!info && !loadError" class="space-y-2" aria-busy="true">
          <h1 class="text-2xl leading-tight text-foreground font-display">Checking the request…</h1>
          <p class="text-sm text-muted-foreground">Just a moment.</p>
        </div>

        <!-- Broken request: shown here, never redirected -->
        <div v-else-if="loadError || info?.status === 'error'" class="space-y-3" role="alert">
          <h1 class="inline-flex items-center gap-2 text-2xl leading-tight text-foreground font-display">
            <AlertTriangle class="w-5 h-5 text-primary" aria-hidden="true" /> Can’t connect this app
          </h1>
          <p class="text-sm text-muted-foreground">{{ loadError || (info as any)?.description }}</p>
          <p class="text-xs text-muted-foreground">Start the connection again from the app. If it keeps happening, the app’s setup is wrong.</p>
        </div>

        <!-- Sending the app its error -->
        <div v-else-if="info?.status === 'redirect'" class="space-y-2">
          <h1 class="text-2xl leading-tight text-foreground font-display">Returning to the app…</h1>
          <p class="text-sm text-muted-foreground">{{ info.description }}</p>
        </div>

        <!-- Sign in first -->
        <div v-else-if="info?.status === 'signin'" class="space-y-4">
          <h1 class="text-2xl leading-tight text-foreground font-display">
            Sign in to connect <span class="italic">{{ info.client.name }}</span>
          </h1>
          <p class="text-sm text-muted-foreground">
            {{ info.client.name }} wants to use your WeDance account. Sign in first, then you choose what it may do.
          </p>
          <Button variant="pill" size="lg" class="w-full" @click="showSignIn = true">Sign in</Button>
        </div>

        <!-- Consent -->
        <form v-else-if="consent" class="space-y-5" novalidate @submit.prevent="allow">
          <div class="space-y-2">
            <h1 class="text-2xl leading-tight text-foreground font-display">
              <span class="italic">{{ consent.client.name }}</span> wants to use your WeDance account
            </h1>
            <p class="text-sm text-muted-foreground">
              Signed in as <strong class="text-foreground">{{ consent.me.name }}</strong> ({{ consent.me.email }}).
              <Button type="button" variant="link" class="h-auto p-0 font-bold" @click="switchAccount">Not you?</Button>
            </p>
            <ul class="text-xs text-muted-foreground space-y-1">
              <li v-if="consent.client.verifiedDomain" class="inline-flex items-center gap-1.5">
                <ShieldCheck class="w-3.5 h-3.5 text-wd-green-600" aria-hidden="true" /> Published by {{ consent.client.verifiedDomain }}
              </li>
              <li v-else>The app named itself; WeDance hasn’t checked who made it. Only continue if you started this from the app.</li>
              <li>Sends you back to <strong class="text-foreground">{{ consent.client.redirectHost }}</strong></li>
              <li v-if="consent.client.uri">
                <a :href="consent.client.uri" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 font-bold text-wd-red-800">About the app <ExternalLink class="w-3 h-3" aria-hidden="true" /></a>
              </li>
            </ul>
          </div>

          <fieldset class="space-y-1">
            <legend class="text-sm font-bold text-foreground">It may</legend>
            <p class="text-xs text-muted-foreground">Untick anything you don’t want. You can change this later in Settings → Connected apps.</p>
            <div class="divide-y divide-border">
              <Checkbox v-for="s in consent.scopes" :key="s.id" v-model="picked[s.id]" class="w-full items-start py-2">
                <span class="block font-bold text-foreground">{{ s.title }}</span>
                <span class="block text-xs text-muted-foreground">{{ s.detail }}</span>
              </Checkbox>
            </div>
          </fieldset>

          <fieldset v-if="businessPicked" class="space-y-1">
            <legend class="text-sm font-bold text-foreground">For these pages</legend>
            <p v-if="consent.profiles.length" class="text-xs text-muted-foreground">The app can only work on the pages you tick.</p>
            <p v-else class="text-xs text-muted-foreground">You don’t run any business pages yet, so the business permissions won’t do anything.</p>
            <div class="divide-y divide-border">
              <Checkbox v-for="p in consent.profiles" :key="p.id" v-model="profilePicked[p.id]" class="w-full py-2">
                <span class="font-bold text-foreground">{{ p.name }}</span>
                <span class="text-xs text-muted-foreground"> · {{ profileTypeLabel[p.type] ?? p.type }} · @{{ p.username }} · {{ p.role }}</span>
              </Checkbox>
            </div>
          </fieldset>

          <p class="text-xs text-muted-foreground">
            The app never sees your password. Payments always open on Stripe for you to confirm, and anything that goes public is shown to you first.
          </p>

          <p v-if="actionError" role="alert" class="text-sm font-bold text-primary">{{ actionError }}</p>

          <div class="flex flex-col-reverse sm:flex-row gap-2">
            <Button type="button" variant="outline-pill" size="lg" class="sm:flex-1" :loading="busy === 'deny'" :disabled="!!busy" @click="deny">Don’t allow</Button>
            <Button type="submit" variant="pill" size="lg" class="sm:flex-1" :loading="busy === 'allow'" :disabled="!!busy || !selectedScopes.length">
              <Check class="w-4 h-4" aria-hidden="true" /> Allow
            </Button>
          </div>
        </form>
      </div>
    </div>
    <SignUpModal v-model:open="showSignIn" action="connect" />
  </main>
</template>
