<script setup lang="ts">
/**
 * /business/events/new — create an event for one of my profiles.
 */
import type { BusinessEventValues } from '~/components/business/BusinessEventForm.vue'
import { toBusinessEventInput } from '~/lib/businessEvent'

definePageMeta({ layout: 'business' })
useHead({ title: 'New event | Business | WeDance' })

const { $trpc } = useNuxtApp()
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
  return { hostUsername: host?.username ?? '', city: host?.city ?? '' }
})

async function create(v: BusinessEventValues) {
  saving.value = true
  error.value = null
  try {
    const { id } = await $trpc.businessEvents.create.mutate(toBusinessEventInput(v))
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
      <p class="mt-1 text-sm text-muted-foreground">Events are run by an organizer, venue or artist profile you manage.</p>
      <Button variant="pill" class="mt-4" as-child><NuxtLink to="/business/claim">Find my profile</NuxtLink></Button>
    </div>
    <BusinessEventForm v-else class="mt-6" :hosts="hosts" :initial="initial" :saving="saving" submit-label="Create event" @submit="create" />
  </div>
</template>
