<script setup lang="ts">
/**
 * /organizers/insights — the organizer's dashboard for their festival(s).
 * Today it shows the style & level mix of the attendees (P726); the other
 * promised insights (workshop demand, geography, post-festival signal) slot in
 * here as they are built. Access: the organizer whose festival submission the
 * team onboarded, or an admin (see server/trpc/routers/festivalInsights.ts).
 */
import { BarChart3, Loader2 } from 'lucide-vue-next'
import type { StyleLevelMix as Mix } from '#shared/utils/styleLevelMix'

definePageMeta({ layout: false })

useHead({
  title: 'WeDance — Organizer insights',
  meta: [{ name: 'robots', content: 'noindex' }],
})

const { $trpc } = useNuxtApp()
const { isSignedIn, isLoading } = useAuth()
const route = useRoute()
const router = useRouter()

type MyFestival = { slug: string; name: string; startDate: string | null }

const festivals = ref<MyFestival[]>([])
const selected = ref<string>('')
const mix = ref<(Mix & { festival: { slug: string; name: string } }) | null>(null)
const loadingList = ref(true)
const loadingMix = ref(false)
const error = ref('')

async function loadFestivals() {
  loadingList.value = true
  error.value = ''
  try {
    festivals.value = await $trpc.festivalInsights.myFestivals.query()
    const wanted = route.query.festival as string | undefined
    selected.value = festivals.value.find(f => f.slug === wanted)?.slug ?? festivals.value[0]?.slug ?? ''
  } catch (e: unknown) {
    error.value = (e as { message?: string })?.message || 'Could not load your festivals.'
  } finally {
    loadingList.value = false
  }
}

async function loadMix(slug: string) {
  if (!slug) return
  loadingMix.value = true
  error.value = ''
  mix.value = null
  try {
    mix.value = await $trpc.festivalInsights.styleLevelMix.query({ festivalSlug: slug })
  } catch (e: unknown) {
    error.value = (e as { message?: string })?.message || 'Could not load insights.'
  } finally {
    loadingMix.value = false
  }
}

watch(selected, (slug) => {
  router.replace({ query: slug ? { festival: slug } : {} })
  loadMix(slug)
})

watch([isLoading, isSignedIn], ([loadingNow, signedIn]) => {
  if (loadingNow) return
  if (signedIn) loadFestivals()
  else loadingList.value = false
}, { immediate: true })
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />

    <main class="max-w-3xl mx-auto px-4 py-12">
      <div class="text-xs uppercase tracking-[0.3em] text-secondary">The dashboard</div>
      <h1 class="mt-2 text-4xl leading-tight">
        Your <em class="italic text-primary">insights.</em>
      </h1>
      <p class="mt-2 text-sm text-muted-foreground font-sans">
        Who is actually coming — so you can plan a program that fits them.
      </p>

      <div v-if="isLoading || loadingList" class="mt-10 flex items-center gap-2 text-sm font-sans">
        <Loader2 class="size-4 animate-spin" aria-hidden="true" /> Loading…
      </div>

      <div v-else-if="!isSignedIn" class="mt-10 rounded-2xl border bg-card p-6 font-sans">
        <p class="text-sm">Sign in with the account you used to list your festival to see its insights.</p>
      </div>

      <div v-else-if="!festivals.length && !error" class="mt-10 rounded-2xl border bg-card p-6 font-sans">
        <BarChart3 class="size-6 text-warning" aria-hidden="true" />
        <p class="mt-2 text-sm">
          No festivals on your account yet. Insights open once the team has onboarded the festival you listed.
        </p>
        <NuxtLink to="/business/events/new?type=Festival" class="mt-4 inline-block text-sm font-bold underline text-primary">
          List your festival →
        </NuxtLink>
      </div>

      <template v-else>
        <Field v-if="festivals.length > 1" id="insights-festival" label="Festival" class="mt-8 sm:max-w-xs">
          <Select v-model="selected" :options="festivals.map(f => ({ label: f.name, value: f.slug }))" />
        </Field>

        <p v-if="error" role="alert" class="mt-8 text-sm rounded-xl p-3 bg-primary/8 text-wd-red-800 font-sans">
          {{ error }}
        </p>

        <section v-if="mix || loadingMix" class="mt-8">
          <h2 class="text-2xl">
            Style &amp; level mix<span v-if="mix" class="text-muted-foreground"> · {{ mix.festival.name }}</span>
          </h2>
          <div v-if="loadingMix" class="mt-4 flex items-center gap-2 text-sm font-sans">
            <Loader2 class="size-4 animate-spin" aria-hidden="true" /> Loading…
          </div>
          <StyleLevelMix v-else-if="mix" :mix="mix" class="mt-4" />
        </section>
      </template>
    </main>

    <SiteFooter />
  </div>
</template>
