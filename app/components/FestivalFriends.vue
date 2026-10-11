<script setup lang="ts">
/**
 * Festival Friends section (RAZ-82) — shows mutual waves and incoming
 * waves for a festival. Mutual waves ("festival friends") are people
 * you've both expressed interest in meeting — your pre-made connections.
 * Incoming waves are "X wants to dance with you" — wave back to connect.
 */
import { Heart, Hand, Instagram } from 'lucide-vue-next'

const props = defineProps<{
  festivalSlug: string
  accentColor: string
}>()

const { $trpc } = useNuxtApp()
const { isSignedIn } = useAuth()

interface WaveDancer {
  dancerId: string
  name: string
  photo: string | null
  city: string | null
  username: string | null
  danceStyles: string[]
  role?: string | null
  instagram?: string | null
}

const friends = ref<WaveDancer[]>([])
const incoming = ref<WaveDancer[]>([])
const friendIds = ref<Set<string>>(new Set())
const loading = ref(true)
const wavingBackId = ref<string | null>(null)

async function load() {
  if (!isSignedIn.value || !props.festivalSlug) return
  loading.value = true
  try {
    const [f, w] = await Promise.all([
      $trpc.wave.friends.query({ festivalSlug: props.festivalSlug }),
      $trpc.wave.wavesForMe.query({ festivalSlug: props.festivalSlug }),
    ])
    friends.value = f
    friendIds.value = new Set(f.map(d => d.dancerId))
    // Incoming = people who waved at me but aren't yet mutual friends
    incoming.value = w.filter(d => !friendIds.value.has(d.dancerId))
  } catch {
    // non-critical
  } finally {
    loading.value = false
  }
}

async function waveBack(dancerId: string) {
  if (wavingBackId.value) return
  wavingBackId.value = dancerId
  try {
    await $trpc.wave.send.mutate({ festivalSlug: props.festivalSlug, targetDancerId: dancerId })
    // Move from incoming to friends
    await load()
  } catch {
    // non-critical
  } finally {
    wavingBackId.value = null
  }
}

onMounted(load)
watch(() => props.festivalSlug, load)
watch(isSignedIn, load)

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() ?? '')
    .join('')
}

const hasFriends = computed(() => friends.value.length > 0)
const hasIncoming = computed(() => incoming.value.length > 0)
const hasContent = computed(() => hasFriends.value || hasIncoming.value)
</script>

<template>
  <div v-if="isSignedIn && !loading && hasContent">
    <!-- Festival Friends (mutual waves) -->
    <div v-if="hasFriends" class="mb-6">
      <div class="flex items-center gap-2 mb-3">
        <Heart class="w-5 h-5" :style="{ color: accentColor }" />
        <h3 class="text-lg font-bold" style="color:var(--wd-brown-900);">
          Your festival friends
        </h3>
        <span class="text-xs font-bold px-2 py-0.5 rounded-full" :style="{ background: `color-mix(in srgb, ${accentColor} 12%, transparent)`, color: accentColor }">
          {{ friends.length }}
        </span>
      </div>
      <p class="text-xs mb-3" style="color:var(--wd-brown-600); font-family:var(--wd-font-sans);">
        You waved at each other — find them on the floor!
      </p>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NuxtLink
          v-for="d in friends"
          :key="d.dancerId"
          :to="d.username ? `/u/${d.username}` : ''"
          :class="d.username ? 'hover:brightness-[0.97] cursor-pointer' : 'pointer-events-none'"
          class="flex items-center gap-3 rounded-xl p-3 no-underline transition-colors"
          :style="{ background: `color-mix(in srgb, ${accentColor} 5%, white)`, border: `1px solid color-mix(in srgb, ${accentColor} 20%, transparent)` }"
        >
          <img
            v-if="d.photo"
            :src="d.photo"
            :alt="d.name"
            class="w-12 h-12 rounded-full object-cover shrink-0 ring-2"
            :style="{ '--tw-ring-color': accentColor }"
          />
          <div
            v-else
            class="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
            :style="{ background: accentColor }"
          >
            {{ initials(d.name) }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold truncate" style="color:var(--wd-brown-900);">
              {{ d.name }}
            </p>
            <p v-if="d.city" class="text-xs truncate" style="color:var(--wd-brown-700); font-family:var(--wd-font-sans);">
              {{ d.city }}
            </p>
            <p v-if="d.danceStyles && d.danceStyles.length > 0" class="text-[10px] truncate mt-0.5" style="color:var(--wd-brown-500); font-family:var(--wd-font-sans);">
              {{ d.danceStyles.slice(0, 3).join(' · ') }}
            </p>
          </div>
          <div v-if="d.instagram" class="shrink-0" @click.prevent>
            <a
              :href="`https://instagram.com/${d.instagram}`"
              target="_blank"
              rel="noopener"
              class="w-8 h-8 rounded-full flex items-center justify-center no-underline"
              style="background:color-mix(in srgb, var(--wd-brown-900) 6%, transparent); color:var(--wd-brown-600);"
              :title="`@${d.instagram} on Instagram`"
            >
              <Instagram class="w-4 h-4" />
            </a>
          </div>
        </NuxtLink>
      </div>
    </div>

    <!-- Incoming waves (not yet mutual) -->
    <div v-if="hasIncoming">
      <div class="flex items-center gap-2 mb-3">
        <Hand class="w-5 h-5" style="color:var(--wd-amber-600);" />
        <h3 class="text-base font-bold" style="color:var(--wd-brown-900);">
          {{ incoming.length === 1 ? 'Someone wants to dance with you' : `${incoming.length} dancers want to meet you` }}
        </h3>
      </div>
      <div class="space-y-2">
        <div
          v-for="d in incoming"
          :key="d.dancerId"
          class="flex items-center gap-3 rounded-xl p-3 bg-white"
          style="border:1px solid color-mix(in srgb, var(--wd-amber-600) 20%, transparent);"
        >
          <NuxtLink
            :to="d.username ? `/u/${d.username}` : ''"
            class="shrink-0 no-underline"
          >
            <img
              v-if="d.photo"
              :src="d.photo"
              :alt="d.name"
              class="w-10 h-10 rounded-full object-cover"
            />
            <div
              v-else
              class="w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white"
              style="background:var(--wd-amber-600);"
            >
              {{ initials(d.name) }}
            </div>
          </NuxtLink>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium truncate" style="color:var(--wd-brown-900);">
              {{ d.name }}
            </p>
            <p v-if="d.danceStyles && d.danceStyles.length > 0" class="text-[10px] truncate" style="color:var(--wd-brown-500); font-family:var(--wd-font-sans);">
              {{ d.danceStyles.slice(0, 3).join(' · ') }}
            </p>
          </div>
          <button
            type="button"
            :disabled="wavingBackId === d.dancerId"
            class="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold text-white transition-colors"
            :style="{ background: accentColor }"
            @click="waveBack(d.dancerId)"
          >
            <Hand class="w-3.5 h-3.5" />
            Wave back
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
