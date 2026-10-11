<script setup lang="ts">
/**
 * "Who's going" section for festival and event detail pages.
 *
 * Fetches the public list of dancers who marked "Going" (plan_items)
 * via `plan.goingList` and renders a grid of tappable profile cards.
 * Each face links to the dancer's profile at /u/{username}.
 */
import { Users } from 'lucide-vue-next'

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

interface GoingDancer {
  dancerId: string
  name: string
  photo: string | null
  city: string | null
  username: string | null
}

const going = ref<GoingDancer[]>([])
const loading = ref(true)

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

onMounted(load)
watch(resolvedId, (next, prev) => {
  if (next !== prev) load()
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
        No one has marked "Going" yet — be the first!
      </p>
    </div>
  </div>
</template>
