<script setup lang="ts">
/**
 * /business/events — events run by the profiles I manage (sidebar switcher filters).
 * Tabs: Upcoming and Past (published), Drafts (not published yet, any date),
 * Archived (Restore brings one back as a draft). Each row says what it still needs.
 * Upcoming and Past also list events run by others that my pages take part in
 * (at my venue, my organizer page, my artist in the line-up), with my role.
 */
import { Plus, ExternalLink, ArchiveRestore } from 'lucide-vue-next'
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
type Tab = 'upcoming' | 'drafts' | 'past' | 'archived'
const TABS: { key: Tab; label: string }[] = [{ key: 'upcoming', label: 'Upcoming' }, { key: 'drafts', label: 'Drafts' }, { key: 'past', label: 'Past' }, { key: 'archived', label: 'Archived' }]
const tab = ref<Tab>('upcoming')
const restoring = ref<string | null>(null)
async function restore(e: { id: string; name: string | null }) {
  restoring.value = e.id
  try {
    await $trpc.businessEvents.restore.mutate({ id: e.id })
    await load()
    tab.value = 'drafts'
  } catch (err: any) { error.value = err?.message || 'Could not restore it.' } finally { restoring.value = null }
}

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

const rows = computed(() => data.value?.[tab.value] ?? [])
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

    <div class="mt-6 flex flex-wrap gap-1" role="tablist" aria-label="Which events">
      <Button
        v-for="t in TABS"
        :key="t.key"
        type="button"
        role="tab"
        :aria-selected="tab === t.key"
        size="sm"
        :variant="tab === t.key ? 'soft' : 'ghost'"
        @click="tab = t.key"
      >
        {{ t.label }}<span v-if="data" class="ml-1 text-muted-foreground">{{ data[t.key].length }}</span>
      </Button>
    </div>

    <AdminState v-if="error" kind="error" :message="error" />
    <AdminState v-if="loading" kind="loading" />
    <AdminState
      v-else-if="!rows.length"
      kind="empty"
      :message="{ upcoming: 'No upcoming events.', drafts: 'No drafts.', past: 'No past events yet.', archived: 'Nothing archived.' }[tab]"
      :hint="tab === 'upcoming' ? 'Add your next party, class or festival with “New event”.' : tab === 'drafts' ? 'Events you haven’t published yet show here.' : undefined"
    />

    <div v-else class="mt-4 grid grid-cols-[minmax(0,1fr)] gap-2">
      <div v-for="e in rows" :key="e.id" class="flex items-center gap-4 rounded-2xl border bg-card p-4">
        <div class="w-24 shrink-0">
          <p class="text-xs font-bold uppercase tracking-wider text-secondary">{{ when(e) }}</p>
          <p class="text-sm font-bold">{{ eventLocalTime(e.startDate, tz(e)) }}</p>
        </div>
        <NuxtLink :to="e.to" class="flex-1 min-w-0 group">
          <p class="truncate text-sm font-bold group-hover:underline">{{ e.name }}</p>
          <p class="truncate text-xs text-muted-foreground">
            {{ e.host?.name || e.by }}<template v-if="e.venueName && e.venueName !== e.by"> · {{ e.venueName }}</template><template v-if="e.city"> · {{ e.city }}</template>
          </p>
          <div class="mt-1 flex flex-wrap gap-1.5">
            <AdminStatus v-if="e.role === 'lineup'" tone="info">You’re in the line-up</AdminStatus>
            <AdminStatus v-else-if="e.role === 'venue'" tone="info">At your venue</AdminStatus>
            <AdminStatus v-else-if="e.role === 'organizer'" tone="info">You organize it</AdminStatus>
            <AdminStatus v-if="e.role !== 'host'" tone="neutral">{{ e.canEdit ? 'From wedance.vip · you can edit it' : 'Run by someone else' }}</AdminStatus>
            <AdminStatus v-else-if="tab === 'archived'" tone="neutral">Archived</AdminStatus>
            <AdminStatus v-else-if="!e.published" tone="warning">Draft</AdminStatus>
            <AdminStatus v-else-if="e.missing.length" tone="warning" :title="e.missing.join(', ')">{{ e.missing.length }} to add</AdminStatus>
            <AdminStatus v-else tone="success">Ready</AdminStatus>
            <AdminStatus v-if="e.seriesId">Weekly</AdminStatus>
          </div>
        </NuxtLink>
        <Button v-if="tab === 'archived'" type="button" variant="outline-pill" size="pill-sm" :loading="restoring === e.id" @click="restore(e)"><ArchiveRestore /> Restore</Button>
        <Button v-else-if="e.published" variant="ghost" size="icon-sm" as-child>
          <NuxtLink :to="eventPath(e)" target="_blank" :aria-label="`Open ${e.name} as dancers see it`"><ExternalLink /></NuxtLink>
        </Button>
      </div>
    </div>
  </div>
</template>
