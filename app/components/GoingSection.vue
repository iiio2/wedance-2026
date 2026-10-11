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
 *
 * RAZ-82: wave button on each card (festivals only) — tap to express
 * "I'd like to dance with you there." Mutual waves = festival friends.
 */
import { Users, Eye, EyeOff, Hand } from 'lucide-vue-next'

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
  danceStyles?: string[]
}

const going = ref<GoingDancer[]>([])
const loading = ref(true)
const loadError = ref(false)

// Share toggle state
const shareGoing = ref(false)
const shareLoading = ref(false)

// Wave state (festivals only, signed-in users)
const wavedIds = ref<Set<string>>(new Set())
const wavingId = ref<string | null>(null)

async function load() {
  if (!resolvedId.value) return
  loading.value = true
  loadError.value = false
  try {
    const res = await $trpc.plan.goingList.query({
      itemType: resolvedType.value,
      itemId: resolvedId.value,
    })
    going.value = res
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
  }
}

defineExpose({ reload: load })

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

async function loadWaveState() {
  if (!isSignedIn.value || resolvedType.value !== 'festival' || !resolvedId.value) return
  try {
    const ids = await $trpc.wave.myWaves.query({ festivalSlug: resolvedId.value })
    wavedIds.value = new Set(ids)
  } catch {
    // non-critical
  }
}

async function toggleWave(dancerId: string) {
  if (wavingId.value) return
  wavingId.value = dancerId
  const wasWaved = wavedIds.value.has(dancerId)
  try {
    if (wasWaved) {
      wavedIds.value.delete(dancerId)
      await $trpc.wave.retract.mutate({ festivalSlug: resolvedId.value, targetDancerId: dancerId })
    } else {
      wavedIds.value.add(dancerId)
      await $trpc.wave.send.mutate({ festivalSlug: resolvedId.value, targetDancerId: dancerId })
    }
  } catch {
    // Roll back
    if (wasWaved) wavedIds.value.add(dancerId)
    else wavedIds.value.delete(dancerId)
  } finally {
    wavingId.value = null
  }
}

onMounted(() => {
  load()
  loadShareState()
  loadWaveState()
})
watch(resolvedId, (next, prev) => {
  if (next !== prev) {
    load()
    loadShareState()
    loadWaveState()
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

    <div
      v-else-if="loadError"
      class="rounded-xl border-2 border-dashed p-5 text-center"
      style="border-color:color-mix(in srgb, var(--wd-red-600) 25%, transparent); background:rgba(255,255,255,0.5);"
    >
      <p class="text-sm" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
        Couldn't load the going list.
      </p>
      <button
        type="button"
        class="mt-2 text-xs font-bold underline"
        style="color:var(--wd-red-600); font-family:var(--wd-font-sans);"
        @click="load"
      >
        Try again
      </button>
    </div>

    <template v-else-if="going.length > 0">
      <p v-if="isSignedIn && resolvedType === 'festival'" class="text-xs mb-3" style="color:var(--wd-brown-500); font-family:var(--wd-font-sans);">
        Wave at dancers you'd like to meet — if they wave back, you become festival friends.
      </p>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div
          v-for="d in going"
          :key="d.dancerId"
          class="relative flex items-center gap-3 rounded-xl p-2.5 transition-colors"
          style="background:white; border:1px solid color-mix(in srgb, var(--wd-brown-900) 10%, transparent);"
        >
          <NuxtLink
            :to="d.username ? `/u/${d.username}` : ''"
            :class="d.username ? 'hover:brightness-[0.97] cursor-pointer' : 'pointer-events-none'"
            class="flex items-center gap-3 no-underline min-w-0 flex-1"
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
              <p v-if="d.danceStyles && d.danceStyles.length > 0" class="text-[10px] truncate mt-0.5" style="color:var(--wd-brown-500); font-family:var(--wd-font-sans);">
                {{ d.danceStyles.slice(0, 3).join(' · ') }}
              </p>
            </div>
          </NuxtLink>
          <button
            v-if="isSignedIn && resolvedType === 'festival'"
            type="button"
            :disabled="wavingId === d.dancerId"
            class="absolute top-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center transition-colors"
            :style="{ background: wavedIds.has(d.dancerId) ? accentColor : 'color-mix(in srgb, var(--wd-brown-900) 8%, transparent)', color: wavedIds.has(d.dancerId) ? 'white' : 'var(--wd-brown-500)' }"
            :title="wavedIds.has(d.dancerId) ? 'Undo wave' : 'Wave — I\'d like to dance with you'"
            @click="toggleWave(d.dancerId)"
          >
            <Hand class="w-3.5 h-3.5" />
          </button>
        </div>
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
