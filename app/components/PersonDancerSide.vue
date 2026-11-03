<script setup lang="ts">
/**
 * The dancer side of a person's page (#474, one handle per person). Shown on
 * /@handle when its owner marked the page as "this is me": how they dance, the
 * festivals they're going to, and the other pages they run — so one link (the
 * one in their Instagram bio) shows all of them.
 */
import { Calendar, Briefcase } from 'lucide-vue-next'
import { festivalPath } from '#shared/utils/eventSlug'
import { initialsOf } from '#shared/utils/initials'

const props = defineProps<{
  person: {
    username: string | null
    role: string | null
    danceStyles: string[]
    runs: { username: string; name: string; type: string; photo: string | null }[]
  }
}>()

const { $trpc } = useNuxtApp()

const roleLabel: Record<string, string> = { lead: 'Leads', follow: 'Follows', both: 'Leads & follows' }
const typeLabel: Record<string, string> = { venue: 'Venue', artist: 'Artist', organizer: 'Organiser', promoter: 'Promoter' }

// Festivals from their year plan (public sharedPlan endpoint, same as /u/).
type SharedPlan = Awaited<ReturnType<typeof $trpc.plan.sharedPlan.query>>
const yearPlan = ref<SharedPlan>(null)
onMounted(() => {
  if (!props.person.username) return
  $trpc.plan.sharedPlan.query({ username: props.person.username })
    .then((r) => { yearPlan.value = r })
    .catch(() => {})
})
const upcomingFestivals = computed(() => {
  const now = new Date().toISOString()
  return (yearPlan.value?.festivals ?? []).filter(f => f.endDate >= now)
})

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sMonth = s.toLocaleString('en', { month: 'short' })
  const eMonth = e.toLocaleString('en', { month: 'short' })
  if (sMonth === eMonth) return `${sMonth} ${s.getDate()}–${e.getDate()}`
  return `${sMonth} ${s.getDate()} – ${eMonth} ${e.getDate()}`
}

const hasDancing = computed(() => !!props.person.role || props.person.danceStyles.length > 0)
</script>

<template>
  <section
    v-if="hasDancing || upcomingFestivals.length || person.runs.length"
    class="max-w-2xl mx-auto px-4 pb-6 font-sans"
    aria-label="Also on the dance floor"
  >
    <div class="rounded-2xl border bg-card p-5 space-y-5">
      <!-- How they dance -->
      <div v-if="hasDancing">
        <p class="text-eyebrow font-bold uppercase tracking-wider text-secondary">Dances</p>
        <div class="mt-2 flex flex-wrap items-center gap-1.5">
          <span v-if="person.role" class="text-xs text-muted-foreground mr-1">{{ roleLabel[person.role] || person.role }}</span>
          <span
            v-for="s in person.danceStyles"
            :key="s"
            class="px-2.5 py-1 rounded-full text-meta font-bold uppercase tracking-wider text-primary"
            style="background:color-mix(in srgb, var(--wd-red-600) 9.4%, transparent);"
          >{{ s }}</span>
        </div>
      </div>

      <!-- Going to -->
      <div v-if="upcomingFestivals.length">
        <p class="text-eyebrow font-bold uppercase tracking-wider text-secondary">Going to</p>
        <div class="mt-2 space-y-2">
          <NuxtLink
            v-for="f in upcomingFestivals"
            :key="f.slug"
            :to="festivalPath(f.slug)"
            class="flex items-center gap-3 rounded-xl border p-3 no-underline transition-colors hover:border-primary/40"
          >
            <img v-if="f.logo" :src="f.logo" :alt="f.name" class="w-10 h-10 rounded-lg object-cover shrink-0">
            <div
              v-else
              class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              :style="{ background: f.accentColor || 'var(--wd-red-600)' }"
            >
              <Calendar class="w-5 h-5 text-white" aria-hidden="true" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium truncate text-foreground">{{ f.name }}</p>
              <p class="text-xs truncate text-muted-foreground">{{ formatDateRange(f.startDate, f.endDate) }} · {{ f.location }}</p>
            </div>
          </NuxtLink>
        </div>
      </div>

      <!-- Other pages they run -->
      <div v-if="person.runs.length">
        <p class="text-eyebrow font-bold uppercase tracking-wider text-secondary">Also runs</p>
        <div class="mt-2 space-y-2">
          <NuxtLink
            v-for="r in person.runs"
            :key="r.username"
            :to="`/@${r.username}`"
            class="flex items-center gap-3 rounded-xl border p-3 no-underline transition-colors hover:border-primary/40"
          >
            <img v-if="r.photo" :src="r.photo" :alt="r.name" class="w-10 h-10 rounded-full object-cover shrink-0">
            <div
              v-else
              class="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold text-white"
              style="background:linear-gradient(135deg, var(--wd-red-600), var(--wd-orange-500));"
            >{{ initialsOf(r.name) }}</div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-medium truncate text-foreground">{{ r.name }}</p>
              <p class="text-xs text-muted-foreground inline-flex items-center gap-1"><Briefcase class="w-3 h-3" aria-hidden="true" /> {{ typeLabel[r.type] || r.type }} · @{{ r.username }}</p>
            </div>
          </NuxtLink>
        </div>
      </div>
    </div>
  </section>
</template>
