<script setup lang="ts">
/**
 * "Who's going" section for festival and event detail pages.
 *
 * Fetches the public list of dancers who marked "Going" (plan_items)
 * via `plan.goingList` and renders a grid of tappable profile cards.
 * Each face links to the dancer's profile at /u/{username}.
 *
 * RAZ-115: when the signed-in dancer has this item in their plan, a
 * share toggle appears — opt-in to appear in the public going list.
 */
import { Users, Eye, EyeOff } from 'lucide-vue-next'

const props = withDefaults(defineProps<{
  /** Legacy shorthand — sets itemType='festival', itemId=festivalSlug */
  festivalSlug?: string
  itemType?: 'festival' | 'event'
  itemId?: string
  accentColor: string
}>(), { itemType: 'festival' })

const resolvedType = computed(() => props.itemType ?? 'festival')
const resolvedId = computed(() => props.itemId ?? props.festivalSlug ?? '')

const { $trpc } = useNuxtApp()
const { isSignedIn } = useAuth()
const { yearPlanIds } = useYearPlan()
const { weekPlanIds } = useWeekPlan()

const isInPlan = computed(() => {
  if (resolvedType.value === 'festival') return yearPlanIds.value.has(resolvedId.value)
  return weekPlanIds.value.has(resolvedId.value)
})

interface GoingDancer {
  dancerId: string
  name: string
  photo: string | null
  city: string | null
  username: string | null
}

const going = ref<GoingDancer[]>([])
const loading = ref(true)

// Share toggle state
const shareGoing = ref(false)
const shareLoading = ref(false)

async function load() {
  if (!resolvedId.value) return
  loading.value = true
  try {
    const res = await $trpc.plan.goingList.query({
      itemType: resolvedType.value,
      itemId: resolvedId.value,
    })
    going.value = res
  } catch {
    // non-critical — keep empty
  } finally {
    loading.value = false
  }
}

async function loadShareState() {
  if (!isSignedIn.value || !isInPlan.value || !resolvedId.value) return
  try {
    const res = await $trpc.plan.getShareGoing.query({
      itemType: resolvedType.value as 'festival' | 'event',
      itemId: resolvedId.value,
    })
    shareGoing.value = res.share
  } catch {
    // non-critical
  }
}

async function toggleShare() {
  if (shareLoading.value) return
  const next = !shareGoing.value
  shareGoing.value = next
  shareLoading.value = true
  try {
    await $trpc.plan.setShareGoing.mutate({
      itemType: resolvedType.value as 'festival' | 'event',
      itemId: resolvedId.value,
      share: next,
    })
    // Reload the public list to reflect the change
    await load()
  } catch {
    // Roll back on failure
    shareGoing.value = !next
  } finally {
    shareLoading.value = false
  }
}

onMounted(() => {
  load()
  loadShareState()
})
watch(resolvedId, (next, prev) => {
  if (next !== prev) {
    load()
    loadShareState()
  }
})
watch([isSignedIn, isInPlan], () => {
  loadShareState()
})

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
}
</script>

<template>
  <div>
    <!-- Opt-in share toggle (only visible when signed in + item is in plan) -->
    <div
      v-if="isSignedIn && isInPlan"
      class="mb-4 flex items-center gap-3 rounded-xl p-3"
      style="background:color-mix(in srgb, var(--wd-amber-600) 6%, transparent); border:1px solid color-mix(in srgb, var(--wd-amber-600) 20%, transparent);"
    >
      <button
        type="button"
        :disabled="shareLoading"
        class="relative w-11 h-6 rounded-full transition-colors shrink-0"
        :style="{ background: shareGoing ? accentColor : 'color-mix(in srgb, var(--wd-brown-900) 20%, transparent)' }"
        role="switch"
        :aria-checked="shareGoing"
        aria-label="Show me in the going list"
        @click="toggleShare"
      >
        <span
          class="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
          :class="shareGoing ? 'translate-x-5' : 'translate-x-0'"
        />
      </button>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5">
          <component :is="shareGoing ? Eye : EyeOff" class="w-4 h-4 shrink-0" style="color:var(--wd-brown-700);" />
          <span class="text-sm font-bold" style="color:var(--wd-brown-900);">
            {{ shareGoing ? 'Visible in the going list' : 'Hidden from the going list' }}
          </span>
        </div>
        <p class="text-xs mt-0.5" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
          {{ shareGoing ? 'Others can see you\'re going. Toggle off to hide.' : 'Toggle on to let others know you\'re going.' }}
        </p>
      </div>
    </div>

    <div v-if="loading" class="text-sm" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
      Loading…
    </div>

    <template v-else-if="going.length > 0">
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <NuxtLink
          v-for="d in going"
          :key="d.dancerId"
          :to="d.username ? `/u/${d.username}` : ''"
          :class="d.username ? 'hover:brightness-[0.97] cursor-pointer' : 'pointer-events-none'"
          class="flex items-center gap-3 rounded-xl p-2.5 no-underline transition-colors"
          style="background:white; border:1px solid color-mix(in srgb, var(--wd-brown-900) 10%, transparent);"
        >
          <img
            v-if="d.photo"
            :src="d.photo"
            :alt="d.name"
            class="w-10 h-10 rounded-full object-cover shrink-0"
          />
          <div
            v-else
            class="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
            :style="{ background: accentColor }"
          >
            {{ initials(d.name) }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium truncate" style="color:var(--wd-brown-900);">
              {{ d.name }}
            </p>
            <p v-if="d.city" class="text-xs truncate" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
              {{ d.city }}
            </p>
          </div>
        </NuxtLink>
      </div>
    </template>

    <div
      v-else
      class="rounded-xl border-2 border-dashed p-5 text-center"
      style="border-color:color-mix(in srgb, var(--wd-brown-900) 15%, transparent); background:rgba(255,255,255,0.5);"
    >
      <Users class="w-6 h-6 mx-auto mb-2" style="color:var(--wd-amber-600);" />
      <p class="text-sm" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
        No one has shared they're going yet — be the first!
      </p>
    </div>
  </div>
</template>
