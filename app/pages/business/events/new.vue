<script setup lang="ts">
/**
 * /business/events/new — create an event for one of my profiles.
 * ?artist=<handle> starts it with that artist in the line-up (from their
 * booking page, /@handle/book).
 */
import type { BusinessEventValues } from '~/components/business/BusinessEventForm.vue'
import { toBusinessEventInput } from '~/lib/businessEvent'
import { Plus, Search } from 'lucide-vue-next'

definePageMeta({ layout: 'business' })
useHead({ title: 'New event | Business | WeDance' })

const { $trpc } = useNuxtApp()
const route = useRoute()
const artist = typeof route.query.artist === 'string' ? route.query.artist.replace(/^@/, '') : ''
// ?type=Festival (from /organizers and the "list your festival" links).
const TYPES = ['Party', 'Workshop', 'Course', 'Festival', 'Weekender', 'Congress', 'Concert', 'Show']
const type = typeof route.query.type === 'string' && TYPES.includes(route.query.type) ? route.query.type : ''
const businessProfile = useBusinessProfile()
const hosts = ref<{ username: string; name: string; type: string; city: string | null }[] | null>(null)
const error = ref<string | null>(null)
const saving = ref(false)

onMounted(async () => {
  try {
    hosts.value = (await $trpc.business.myProfiles.query()).managed
  } catch (e: any) {
    error.value = e?.message || 'Could not load your profiles.'
  }
})

// Default host: the switcher's profile, else the only one, else an organizer.
const initial = computed<Partial<BusinessEventValues>>(() => {
  const list = hosts.value ?? []
  const host = list.find(h => h.username === businessProfile.value) ?? (list.length === 1 ? list[0] : list.find(h => h.type === 'organizer'))
  return { hostUsername: host?.username ?? '', city: host?.city ?? '', ...(artist ? { artists: [artist] } : {}), ...(type ? { type } : {}) }
})

async function create(v: BusinessEventValues) {
  saving.value = true
  error.value = null
  try {
    const input = toBusinessEventInput(v)
    const { id } = await $trpc.businessEvents.create.mutate(input)
    const props = { event_id: id, is_festival: !!input.festival, city: input.city || null, style: input.styles?.[0] ?? null }
    useTrack().track('event_created', { ...props, published: !!input.published })
    if (input.published) useTrack().track('event_published', props)
    await navigateTo(`/business/events/${id}?created=1`)
  } catch (e: any) {
    error.value = e?.message || 'Could not create the event.'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <AdminPageHeader eyebrow="Business" title="New event" :back="{ to: '/business/events', label: 'Events' }" />
    <AdminState v-if="error" kind="error" :message="error" />
    <AdminState v-if="!hosts" kind="loading" />
    <div v-else-if="!hosts.length" class="mt-6 rounded-2xl border-2 border-dashed border-input bg-card/60 p-8 text-center">
      <p class="font-display text-lg font-bold">First, a profile</p>
      <p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Events are run by a profile: your festival, school, party series or venue. Make one in a minute, then you’re back here. Already on WeDance? Find yours.</p>
      <div class="mt-4 flex flex-wrap justify-center gap-2">
        <Button variant="pill" as-child><NuxtLink :to="{ path: '/business/new', query: { type: 'organizer', next: $route.fullPath } }"><Plus /> Create a profile</NuxtLink></Button>
        <Button variant="outline-pill" as-child><NuxtLink to="/business/claim"><Search /> Find my profile</NuxtLink></Button>
      </div>
    </div>
    <BusinessEventForm v-else class="mt-6" mode="create" :hosts="hosts" :initial="initial" :saving="saving" submit-label="Create event" @submit="create" />
  </div>
</template>
