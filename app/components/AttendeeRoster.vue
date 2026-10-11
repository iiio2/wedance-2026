<script setup lang="ts">
import { Users } from 'lucide-vue-next'
// Public verified-attendee roster for a festival.
//
// Calls `festivalSignup.publicRoster` and renders the response in two parts:
//
//   1. A grid of attendees (name + city, photo when the buyer opted into
//      `public_full`).
//   2. A "+ N more arriving soon" line for verified ticket holders who
//      haven't signed in / claimed their row yet (webhook stubs with
//      `dancer_id IS NULL`).
//
// Mobile-first. Wired up by PR 3 — this component is intentionally not
// imported from any page yet.

const props = defineProps<{
  festivalSlug: string
}>()

const { $trpc } = useNuxtApp()

interface Attendee {
  id: string
  dancerId: string | null
  displayName: string | null
  city: string | null
  photoUrl: string | null
  verifiedTicketHolder: true
}

const attendees = ref<Attendee[]>([])
const unclaimed = ref(0)
// SSR renders the loading state. The tRPC client uses a relative URL
// (`/api/trpc`) which throws during Nitro SSR (no host to resolve against —
// see PR 3 hotfix #28). We fetch on the client only; hydration swaps the
// loading skeleton for the real roster transparently.
const loading = ref(true)
const error = ref<string | null>(null)

async function load() {
  loading.value = true
  error.value = null
  try {
    const res = await $trpc.festivalSignup.publicRoster.query({
      festivalSlug: props.festivalSlug,
    })
    attendees.value = res.attendees
    unclaimed.value = res.unclaimed
  } catch (e: any) {
    error.value = e?.message ?? 'Could not load attendee roster.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
// Re-fetch if the slug changes after mount (component reused across festivals).
watch(() => props.festivalSlug, (next, prev) => {
  if (next !== prev) load()
})

defineExpose({ refresh: load })

function initials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="loading" class="text-sm text-muted-foreground">
      Loading attendees…
    </div>

    <div v-else-if="error" class="text-sm text-destructive">
      {{ error }}
    </div>

    <template v-else>
      <div
        v-if="attendees.length === 0 && unclaimed === 0"
        class="text-center py-8 px-4 rounded-2xl border-2 border-dashed border-input bg-white/50"
      >
        <Users class="w-8 h-8 mx-auto mb-3 text-secondary" aria-hidden="true" />
        <p class="font-sans text-sm text-muted-foreground">
          No verified ticket holders here yet.
        </p>
        <NuxtLink
          to="/charanga/claim"
          class="mt-2 inline-block font-sans text-xs font-bold underline text-primary"
        >
          Be the first to claim your spot
        </NuxtLink>
      </div>

      <div
        v-else-if="attendees.length > 0"
        class="grid grid-cols-2 gap-3 sm:grid-cols-3"
        data-testid="attendee-roster-grid"
      >
        <div
          v-for="a in attendees"
          :key="a.id"
          class="flex items-center gap-3 rounded-lg border bg-background p-2.5"
        >
          <img
            v-if="a.photoUrl"
            :src="a.photoUrl"
            :alt="a.displayName ?? 'Attendee'"
            class="w-10 h-10 rounded-full object-cover shrink-0"
          />
          <div
            v-else
            class="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xs font-medium text-muted-foreground shrink-0"
            aria-hidden="true"
          >
            {{ initials(a.displayName) }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium truncate">
              {{ a.displayName ?? 'Anonymous' }}
            </p>
            <p v-if="a.city" class="text-xs text-muted-foreground truncate">
              {{ a.city }}
            </p>
          </div>
        </div>
      </div>

      <p
        v-if="unclaimed > 0"
        class="text-xs text-muted-foreground"
        data-testid="attendee-roster-unclaimed"
      >
        + {{ unclaimed }} more {{ unclaimed === 1 ? 'attendee' : 'attendees' }} arriving soon
      </p>
    </template>
  </div>
</template>
