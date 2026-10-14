<script setup lang="ts">
/**
 * /business/events — events run by the profiles I manage (sidebar switcher filters).
 * Upcoming first; each row says what it still needs.
 */
import { Plus, ExternalLink } from 'lucide-vue-next'
import { eventLocalDate, eventLocalTime, eventLocalWeekday } from '#shared/utils/eventTime'
import { eventPath } from '#shared/utils/eventSlug'

definePageMeta({ layout: 'business' })
useHead({ title: 'Events | Business | WeDance' })

const { $trpc } = useNuxtApp()
const businessProfile = useBusinessProfile()
type Lists = Awaited<ReturnType<typeof $trpc.businessEvents.list.query>>
const data = ref<Lists | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const tab = ref<'upcoming' | 'past'>('upcoming')

async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = await $trpc.businessEvents.list.query(businessProfile.value ? { profile: businessProfile.value } : undefined)
  } catch (e: any) {
    error.value = e?.message || 'Could not load events.'
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(businessProfile, load)

const rows = computed(() => (tab.value === 'upcoming' ? data.value?.upcoming : data.value?.past) ?? [])
const tz = (e: { timezone: string | null }) => e.timezone || 'Europe/Berlin'
function when(e: any) {
  const d = eventLocalDate(e.startDate, tz(e))
  return `${eventLocalWeekday(e.startDate, tz(e)).slice(0, 3)} ${Number(d.slice(8))}.${Number(d.slice(5, 7))}.${d.slice(0, 4)}`
}
</script>

<template>
  <div>
    <AdminPageHeader eyebrow="Business" title="Events" description="Events your profiles run. Times are local to each event’s city.">
      <Button variant="pill" size="pill-sm" as-child>
        <NuxtLink to="/business/events/new"><Plus /> New event</NuxtLink>
      </Button>
    </AdminPageHeader>

    <div class="mt-6 flex gap-1" role="tablist" aria-label="Which events">
      <Button
        v-for="t in (['upcoming', 'past'] as const)"
        :key="t"
        type="button"
        role="tab"
        :aria-selected="tab === t"
        size="sm"
        :variant="tab === t ? 'soft' : 'ghost'"
        class="capitalize"
        @click="tab = t"
      >
        {{ t }}<span v-if="data" class="ml-1 text-muted-foreground">{{ (t === 'upcoming' ? data.upcoming : data.past).length }}</span>
      </Button>
    </div>

    <AdminState v-if="error" kind="error" :message="error" />
    <AdminState v-if="loading" kind="loading" />
    <AdminState
      v-else-if="!rows.length"
      kind="empty"
      :message="tab === 'upcoming' ? 'No upcoming events.' : 'No past events yet.'"
      :hint="tab === 'upcoming' ? 'Add your next party, class or festival with “New event”.' : undefined"
    />

    <div v-else class="mt-4 grid gap-2">
      <div v-for="e in rows" :key="e.id" class="flex items-center gap-4 rounded-2xl border bg-card p-4">
        <div class="w-24 shrink-0">
          <p class="text-xs font-bold uppercase tracking-wider text-secondary">{{ when(e) }}</p>
          <p class="text-sm font-bold">{{ eventLocalTime(e.startDate, tz(e)) }}</p>
        </div>
        <NuxtLink :to="`/business/events/${e.id}`" class="flex-1 min-w-0 group">
          <p class="truncate text-sm font-bold group-hover:underline">{{ e.name }}</p>
          <p class="truncate text-xs text-muted-foreground">
            {{ e.host?.name }}<template v-if="e.venueName"> · {{ e.venueName }}</template><template v-if="e.city"> · {{ e.city }}</template>
          </p>
          <div class="mt-1 flex flex-wrap gap-1.5">
            <AdminStatus v-if="!e.published" tone="warning">Draft</AdminStatus>
            <AdminStatus v-else-if="e.missing.length" tone="warning" :title="e.missing.join(', ')">{{ e.missing.length }} to add</AdminStatus>
            <AdminStatus v-else tone="success">Ready</AdminStatus>
            <AdminStatus v-if="e.seriesId">Weekly</AdminStatus>
          </div>
        </NuxtLink>
        <Button v-if="e.published" variant="ghost" size="icon-sm" as-child>
          <NuxtLink :to="eventPath(e)" target="_blank" :aria-label="`Open ${e.name} as dancers see it`"><ExternalLink /></NuxtLink>
        </Button>
      </div>
    </div>
  </div>
</template>
