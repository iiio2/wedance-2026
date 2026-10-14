<script setup lang="ts">
/**
 * /@handle/book — book an artist or venue. Its own page so it can be linked
 * from their website, Instagram bio or email signature. Anyone can send one,
 * no account needed (BookingInquiryForm → inquiries.send).
 *
 * Signed in with business pages: the form is filled in and sent as one of
 * them, and for an artist two shortcuts come first: put them in one of your
 * upcoming events (the editor then sends them the line-up link), or draft a
 * new event with them in it.
 */
import { CalendarPlus, Plus, Check } from 'lucide-vue-next'

definePageMeta({ layout: false, path: '/@:handle/book' })

const route = useRoute()
const { $trpc } = useNuxtApp()
const { isSignedIn } = useAuth()
type Me = Awaited<ReturnType<typeof $trpc.inquiries.me.query>>
const me = ref<Me | null>(null)
const adding = ref<string | null>(null)
const showSignIn = ref(false)
async function loadMe() {
  if (isSignedIn.value && profile.value) me.value = await $trpc.inquiries.me.query({ handle: profile.value.username }).catch(() => null)
}
// Signed in from here: fill the form and show the shortcuts without a reload.
watch(isSignedIn, (v) => { if (v) loadMe() })
const addErr = ref('')
const handle = computed(() => String(route.params.handle))
const profile = ref<any>(null)
const spaces = ref<any[]>([])
const pending = ref(true)

onMounted(async () => {
  try {
    const pro = await $trpc.entity.getByHandle.query({ handle: handle.value })
    if (pro) {
      profile.value = pro.profile; spaces.value = pro.spaces ?? []
      await loadMe()
    }
    else {
      const moved = await $trpc.entity.movedTo.query({ handle: handle.value }).catch(() => null)
      if (moved) return navigateTo(`/@${moved.handle}/book`, { replace: true })
    }
  } catch {}
  pending.value = false
})

// Venues with bookable spaces take requests on their page's calendar.
const bookable = computed(() => !!profile.value && (profile.value.type === 'artist' || (profile.value.type === 'venue' && !spaces.value.length)))
const firstName = computed(() => profile.value?.type === 'artist' ? profile.value.name.split(/\s+/)[0] : profile.value?.name)
// The shortcuts: only for an artist, only for someone who runs an event page.
const canPlan = computed(() => profile.value?.type === 'artist' && !!me.value?.profiles.length)
const draftLink = computed(() => profile.value ? `/business/events/new?artist=${encodeURIComponent(profile.value.username)}` : '')
const day = (d: string | Date, tz?: string | null) => new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz || 'Europe/Berlin' })
async function addTo(eventId: string) {
  addErr.value = ''
  adding.value = eventId
  try {
    await $trpc.inquiries.addToEvent.mutate({ eventId, handle: profile.value.username })
    useTrack().track('booking_added_to_event', { profile: profile.value.username })
    await navigateTo(`/business/events/${eventId}?added=${encodeURIComponent(profile.value.username)}#lineup`)
  } catch (e: any) { addErr.value = e?.message || 'Couldn’t add them.'; adding.value = null }
}

useHead(() => ({
  title: profile.value ? `Book ${profile.value.name} | WeDance` : 'Book | WeDance',
  meta: profile.value ? [{ name: 'description', content: `Ask ${profile.value.name} about your event: a workshop, a show, a party. They answer you by email.` }] : [],
}))
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-display">
    <SiteHeader />
    <main class="max-w-xl mx-auto px-4 pt-10 pb-16">
      <div v-if="pending" class="py-24 text-center"><div class="inline-block w-8 h-8 rounded-full border-2 animate-spin" style="border-color:color-mix(in srgb, var(--wd-red-600) 20%, transparent); border-top-color:var(--wd-red-600);" /></div>

      <div v-else-if="!profile" class="py-16 text-center">
        <h1 class="text-3xl">Not on WeDance yet</h1>
        <p class="mt-3 text-sm text-muted-foreground font-sans"><span class="font-bold">@{{ handle }}</span> doesn’t have a page here.</p>
      </div>

      <div v-else-if="!bookable" class="py-16 text-center">
        <h1 class="text-3xl">Book {{ profile.name }}</h1>
        <p class="mt-3 text-sm text-muted-foreground font-sans">Pick a free slot on their calendar.</p>
        <Button variant="cta" class="mt-5" as-child><NuxtLink :to="`/@${profile.username}`">Open the calendar</NuxtLink></Button>
      </div>

      <template v-else>
        <NuxtLink :to="`/@${profile.username}`" class="flex items-center gap-4">
          <img v-if="profile.photo" :src="profile.photo" :alt="profile.name" class="size-16 shrink-0 rounded-full object-cover border">
          <div class="min-w-0">
            <p class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary font-sans">{{ profile.type === 'venue' ? 'Venue' : 'Artist' }}<template v-if="profile.city"> · {{ profile.city }}</template></p>
            <h1 class="text-3xl leading-tight">Book {{ profile.name }}</h1>
            <div v-if="profile.styles?.length" class="mt-1 flex flex-wrap gap-1.5">
              <span v-for="st in profile.styles.slice(0, 5)" :key="st" class="px-2 py-0.5 rounded-full text-eyebrow font-bold uppercase tracking-wider text-primary font-sans" style="background:color-mix(in srgb, var(--wd-red-600) 7.8%, transparent);">{{ st }}</span>
            </div>
          </div>
        </NuxtLink>
        <p class="mt-5 text-sm text-muted-foreground font-sans">Tell {{ firstName }} what you have in mind. They get it by email and answer you directly.<template v-if="!isSignedIn"> No account needed.</template></p>
        <!-- Signed in and running events: book them straight into one -->
        <section v-if="canPlan" class="mt-6 rounded-2xl border bg-card p-5 sm:p-6 font-sans" aria-labelledby="plan-title">
          <h2 id="plan-title" class="font-display text-xl">Put {{ firstName }} in your event</h2>
          <p class="mt-1 text-sm text-muted-foreground">Add them to the line-up, then send them the link from your event: they confirm, check their programme and the posts about them.</p>
          <ul v-if="me!.events.length" class="mt-4 grid gap-2">
            <li v-for="e in me!.events" :key="e.id" class="flex items-center gap-3 rounded-xl border bg-background p-3">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-bold">{{ e.name }}</p>
                <p class="text-xs text-muted-foreground">{{ day(e.startDate, e.timezone) }} · {{ e.host }}</p>
              </div>
              <span v-if="e.inLineup" class="inline-flex items-center gap-1 text-xs font-bold text-wd-green-700"><Check class="size-3.5" aria-hidden="true" /> In the line-up</span>
              <Button v-else type="button" variant="outline-pill" size="pill-sm" :disabled="!!adding" @click="addTo(e.id)"><Plus aria-hidden="true" /> {{ adding === e.id ? 'Adding…' : 'Add' }}</Button>
            </li>
          </ul>
          <p v-if="addErr" class="mt-2 text-sm text-destructive" role="alert">{{ addErr }}</p>
          <Button variant="pill" class="mt-4" as-child><NuxtLink :to="draftLink"><CalendarPlus aria-hidden="true" /> Draft a new event with {{ firstName }}</NuxtLink></Button>
        </section>

        <!-- Has an account? Signing in fills the form, sends it as their page,
             and lets them add the artist to their event instead. -->
        <p v-if="!isSignedIn" class="mt-5 rounded-xl border border-dashed bg-card/60 px-4 py-3 text-sm font-sans">
          Have a WeDance account?
          <button type="button" class="font-bold text-primary underline" @click="showSignIn = true">Sign in</button>
          to send it as your school or event{{ profile.type === 'artist' ? `, or add ${firstName} to one of your events` : '' }}.
        </p>

        <h2 v-if="canPlan" class="mt-8 font-display text-xl">Or send {{ firstName }} a request</h2>
        <div :class="canPlan ? 'mt-3' : 'mt-6'" class="rounded-2xl border bg-card p-5 sm:p-6 shadow-wd-card">
          <BookingInquiryForm :profile="profile" :me="me" />
        </div>
        <p class="mt-4 text-center text-xs text-muted-foreground font-sans">Through <NuxtLink to="/" class="font-bold hover:underline">WeDance</NuxtLink>, where dancers, artists and venues meet.</p>
      </template>
    </main>
    <SiteFooter />
    <SignUpModal v-model:open="showSignIn" action="signin" />
  </div>
</template>
