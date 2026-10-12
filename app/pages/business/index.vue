<script setup lang="ts">
/**
 * /business — business home. "What needs me" across every profile I manage, then
 * the next 14 days (events I run + line-ups I'm in). Data: businessEvents.inbox.
 */
import { ArrowRight, Plus, Search, CalendarDays } from 'lucide-vue-next'
import { eventLocalTime, eventLocalWeekday, eventLocalDate } from '#shared/utils/eventTime'

definePageMeta({ layout: 'business' })
useHead({ title: 'Business | WeDance' })

const { $trpc } = useNuxtApp()
type Inbox = Awaited<ReturnType<typeof $trpc.businessEvents.inbox.query>>
const data = ref<Inbox | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    data.value = await $trpc.businessEvents.inbox.query()
  } catch (e: any) {
    error.value = e?.message || 'Could not load your inbox.'
  } finally {
    loading.value = false
  }
}
onMounted(load)

const toneOf: Record<string, 'warning' | 'info' | 'danger' | 'neutral'> = { draft: 'warning', missing: 'warning', claim: 'neutral' }
const kindLabel: Record<string, string> = { draft: 'Draft', missing: 'Missing details', claim: 'Claim' }

function dayLabel(iso: string | Date, tz: string | null) {
  const zone = tz || 'Europe/Berlin'
  const d = eventLocalDate(iso, zone)
  const today = eventLocalDate(new Date(), zone)
  const tomorrow = eventLocalDate(new Date(Date.now() + 86400_000), zone)
  if (d === today) return 'Today'
  if (d === tomorrow) return 'Tomorrow'
  return `${eventLocalWeekday(iso, zone).slice(0, 3)} ${Number(d.slice(8))}.${Number(d.slice(5, 7))}.`
}
</script>

<template>
  <div>
    <AdminPageHeader eyebrow="Business" title="Home" description="What needs you, and what’s coming up in the next two weeks.">
      <Button v-if="data?.profiles.length" variant="pill" size="pill-sm" as-child>
        <NuxtLink to="/business/events/new"><Plus /> New event</NuxtLink>
      </Button>
    </AdminPageHeader>

    <AdminState v-if="error" kind="error" :message="error" />
    <AdminState v-if="loading" kind="loading" />

    <template v-else-if="data">
      <!-- No profiles yet: the only thing to do is get one. -->
      <div v-if="!data.profiles.length" class="mt-6 rounded-2xl border-2 border-dashed border-input bg-card/60 p-8 text-center">
        <p class="font-display text-lg font-bold">Start with your profile</p>
        <p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
          WeDance already lists thousands of artists, venues and organizers. Find yours and claim it, or create a new one. Then you can add events.
        </p>
        <div class="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="pill" as-child><NuxtLink to="/business/claim"><Search /> Find my profile</NuxtLink></Button>
          <Button variant="outline-pill" as-child><NuxtLink to="/business/new"><Plus /> Create a profile</NuxtLink></Button>
        </div>
        <ul v-if="data.needs.length" class="mt-6 grid gap-2 text-left">
          <li v-for="n in data.needs" :key="n.title" class="rounded-xl border bg-card p-3 text-sm">
            <p class="font-bold">{{ n.title }}</p>
            <p v-if="n.detail" class="text-xs text-muted-foreground">{{ n.detail }}</p>
          </li>
        </ul>
      </div>

      <template v-else>
        <section class="mt-6">
          <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Needs you</h2>
          <p v-if="!data.needs.length" class="mt-3 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
            Nothing waiting. Your events have everything they need.
          </p>
          <div v-else class="mt-3 grid gap-2">
            <NuxtLink
              v-for="n in data.needs"
              :key="n.title + n.to"
              :to="n.to"
              class="group flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-3 rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/40"
            >
              <AdminStatus :tone="toneOf[n.kind] || 'neutral'" class="self-start sm:mt-0.5 shrink-0">{{ kindLabel[n.kind] || n.kind }}</AdminStatus>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-bold">{{ n.title }}</p>
                <p v-if="n.detail" class="mt-0.5 text-xs text-muted-foreground">{{ n.detail }}</p>
              </div>
              <ArrowRight class="hidden sm:block mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </NuxtLink>
          </div>
        </section>

        <section class="mt-8">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-eyebrow font-bold uppercase tracking-[0.3em] text-secondary">Next 14 days</h2>
            <NuxtLink to="/business/events" class="text-xs font-bold text-secondary hover:underline">All events →</NuxtLink>
          </div>
          <div v-if="!data.comingUp.length" class="mt-3 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
            Nothing in the next two weeks.
            <NuxtLink to="/business/events/new" class="font-bold text-wd-red-800 hover:underline">Add an event</NuxtLink>
          </div>
          <div v-else class="mt-3 grid gap-2">
            <NuxtLink
              v-for="e in data.comingUp"
              :key="e.role + e.id"
              :to="e.to"
              class="group flex items-center gap-4 rounded-2xl border bg-card p-4 transition-colors hover:bg-accent/40"
            >
              <div class="w-16 shrink-0 text-center">
                <p class="text-xs font-bold uppercase tracking-wider text-secondary">{{ dayLabel(e.startDate, e.timezone) }}</p>
                <p class="text-sm font-bold">{{ eventLocalTime(e.startDate, e.timezone || 'Europe/Berlin') }}</p>
              </div>
              <div class="flex-1 min-w-0">
                <p class="truncate text-sm font-bold">{{ e.name }}</p>
                <div class="mt-1 flex flex-wrap gap-1.5">
                  <AdminStatus v-if="e.role === 'lineup'" tone="info">You’re in the line-up</AdminStatus>
                  <AdminStatus v-else-if="!e.published" tone="warning">Draft</AdminStatus>
                  <AdminStatus v-else-if="e.missing.length" tone="warning">{{ e.missing.length }} to add</AdminStatus>
                  <AdminStatus v-else tone="success">Ready</AdminStatus>
                </div>
              </div>
              <CalendarDays class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </NuxtLink>
          </div>
        </section>
      </template>
    </template>
  </div>
</template>
