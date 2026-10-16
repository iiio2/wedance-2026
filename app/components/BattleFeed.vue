<script setup lang="ts">
/**
 * BattleFeed — full-screen, vertical-swipe city-vs-city video battle.
 *
 * Each matchup shows two champion clips sequentially (swipe between A / B),
 * then a vote overlay. After voting, the result flashes (which city leads),
 * then auto-advances to the next matchup. Leaderboard is a bottom-sheet overlay.
 *
 * Touch swipe (mobile) + scroll wheel (desktop) for navigation.
 * Videos auto-play muted with tap-to-unmute.
 */
import { X, Trophy, ChevronUp, Volume2, VolumeX, ArrowLeft } from 'lucide-vue-next'
import { youtubeId } from '~/lib/videoEmbed'
import { WD } from '~/lib/brand'

const { $trpc } = useNuxtApp()

interface Champion {
  citySlug: string; city: string; videoId: string; title: string
  videoUrl: string; thumbnailUrl: string | null; danceStyle: string | null; eloScore: number
}
type Matchup = { month: string; a: Champion; b: Champion }
type LeaderRow = { citySlug: string; city: string; wins: number; losses: number; battles: number; winRate: number }

// --- State ---
const matchup = ref<Matchup | null>(null)
const leaderboard = ref<LeaderRow[]>([])
const loading = ref(true)
const voting = ref(false)
const muted = ref(true)
const showLeaderboard = ref(false)
const end = ref<null | 'capped' | 'exhausted' | 'not_enough_cities'>(null)

// Which clip is showing: 0 = city A, 1 = city B
const activeClip = ref(0)
// After both clips seen, show vote overlay
const bothSeen = ref(false)
// After voting, show result
const showResult = ref(false)
const lastWinner = ref<Champion | null>(null)

// --- Data loading ---
async function loadMatchup() {
  try {
    const res = await $trpc.cityVideo.battleMatchup.query()
    if (res.matchup) {
      matchup.value = res.matchup
      end.value = null
      activeClip.value = 0
      bothSeen.value = false
      showResult.value = false
      lastWinner.value = null
    } else {
      matchup.value = null
      end.value = (res.reason ?? 'exhausted') as typeof end.value
    }
  } catch {
    matchup.value = null
    end.value = 'not_enough_cities'
  }
}

async function loadLeaderboard() {
  try {
    leaderboard.value = (await $trpc.cityVideo.cityLeaderboard.query({ limit: 10 })).cities
  } catch {
    leaderboard.value = []
  }
}

// --- Voting ---
async function vote(winner: Champion, loser: Champion) {
  if (voting.value) return
  voting.value = true
  try {
    await $trpc.cityVideo.battleVote.mutate({
      winnerCitySlug: winner.citySlug,
      loserCitySlug: loser.citySlug,
      winnerVideoId: winner.videoId,
      loserVideoId: loser.videoId,
    })
    useTrack().track('city_battle_vote', { winner: winner.citySlug, loser: loser.citySlug })
    lastWinner.value = winner
    showResult.value = true
    await loadLeaderboard()
    // Auto-advance after showing result
    setTimeout(async () => {
      showResult.value = false
      await loadMatchup()
      voting.value = false
    }, 1800)
  } catch {
    await loadMatchup()
    voting.value = false
  }
}

// --- Swipe / navigation ---
function showNextClip() {
  if (activeClip.value === 0) {
    activeClip.value = 1
    bothSeen.value = true
  }
}

function showPrevClip() {
  if (activeClip.value === 1) {
    activeClip.value = 0
  }
}

// Touch handling
const touchStartY = ref(0)
const touchStartX = ref(0)

function onTouchStart(e: TouchEvent) {
  touchStartY.value = e.touches[0].clientY
  touchStartX.value = e.touches[0].clientX
}

function onTouchEnd(e: TouchEvent) {
  if (showResult.value || voting.value) return
  const dy = touchStartY.value - e.changedTouches[0].clientY
  const dx = touchStartX.value - e.changedTouches[0].clientX
  // Only register vertical swipes (not horizontal)
  if (Math.abs(dy) < 50 || Math.abs(dx) > Math.abs(dy)) return
  if (dy > 0) showNextClip() // swipe up → next
  else showPrevClip() // swipe down → prev
}

// Scroll wheel (desktop)
function onWheel(e: WheelEvent) {
  if (showResult.value || voting.value) return
  if (Math.abs(e.deltaY) < 30) return
  if (e.deltaY > 0) showNextClip()
  else showPrevClip()
}

// --- YouTube embed helpers ---
function embedUrl(champion: Champion): string | null {
  const id = youtubeId(champion.videoUrl)
  if (!id) return null
  // Autoplay, loop, mute by default, no controls for immersive feel
  const params = new URLSearchParams({
    autoplay: '1',
    mute: muted.value ? '1' : '0',
    loop: '1',
    playlist: id,
    controls: '0',
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
    // Force 9:16 appearance by not specifying — the iframe fills the container
  })
  return `https://www.youtube.com/embed/${id}?${params}`
}

function thumbnailUrl(champion: Champion): string | null {
  const id = youtubeId(champion.videoUrl)
  // Use maxresdefault for best quality vertical thumbnail
  return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : champion.thumbnailUrl
}

// --- Current clip ---
const currentChampion = computed(() => {
  if (!matchup.value) return null
  return activeClip.value === 0 ? matchup.value.a : matchup.value.b
})
const otherChampion = computed(() => {
  if (!matchup.value) return null
  return activeClip.value === 0 ? matchup.value.b : matchup.value.a
})

// Mute toggle reloads the iframe (YouTube embed param)
const iframeKey = ref(0)
function toggleMute() {
  muted.value = !muted.value
  iframeKey.value++
}

// Leaderboard rank of the winner after voting
const winnerRank = computed(() => {
  if (!lastWinner.value) return null
  const idx = leaderboard.value.findIndex(c => c.citySlug === lastWinner.value!.citySlug)
  return idx >= 0 ? idx + 1 : null
})

onMounted(async () => {
  await Promise.all([loadMatchup(), loadLeaderboard()])
  loading.value = false
})

const accents = [WD.red600, WD.cyan600] as const
</script>

<template>
  <div
    class="fixed inset-0 bg-black text-white overflow-hidden select-none"
    @touchstart.passive="onTouchStart"
    @touchend="onTouchEnd"
    @wheel.passive="onWheel"
  >
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center h-full">
      <div class="text-center">
        <div class="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
        <p class="mt-4 text-sm text-white/60">Loading battles…</p>
      </div>
    </div>

    <!-- End state: not enough cities or exhausted -->
    <div v-else-if="!matchup && !showResult" class="flex items-center justify-center h-full px-6">
      <div class="text-center max-w-sm">
        <Trophy class="w-12 h-12 mx-auto mb-4 text-amber-400" />
        <h2 class="text-xl font-bold mb-2">
          {{ end === 'capped' ? 'You\'re a voting machine!' : end === 'not_enough_cities' ? 'Not enough cities yet' : 'All matchups voted!' }}
        </h2>
        <p class="text-sm text-white/60 mb-6">
          {{ end === 'capped' ? 'That\'s a lot of votes — thank you! Come back tomorrow.' : end === 'not_enough_cities' ? 'We need at least two cities with videos to start a battle.' : 'You\'ve voted on every city matchup this month. Check the standings!' }}
        </p>
        <button
          v-if="leaderboard.length"
          class="px-5 py-2.5 rounded-full bg-white text-black font-bold text-sm"
          @click="showLeaderboard = true"
        >
          <Trophy class="inline w-4 h-4 mr-1.5 -mt-0.5" />View Leaderboard
        </button>
        <NuxtLink to="/cities" class="block mt-4 text-sm text-white/50 underline">
          ← Back to cities
        </NuxtLink>
      </div>
    </div>

    <!-- Active matchup -->
    <template v-else-if="matchup">
      <!-- Video player area -->
      <div class="absolute inset-0">
        <!-- Result flash overlay -->
        <Transition
          enter-active-class="transition-opacity duration-300"
          enter-from-class="opacity-0"
          leave-active-class="transition-opacity duration-200"
          leave-from-class="opacity-100"
          leave-to-class="opacity-0"
        >
          <div
            v-if="showResult && lastWinner"
            class="absolute inset-0 z-40 flex items-center justify-center bg-black/80"
          >
            <div class="text-center animate-bounce-in">
              <div class="text-6xl mb-3">🏆</div>
              <h2 class="text-3xl font-bold mb-1">{{ lastWinner.city }}</h2>
              <p class="text-white/60 text-sm">
                <template v-if="winnerRank">Now #{{ winnerRank }} on the leaderboard</template>
                <template v-else>Climbing the ranks!</template>
              </p>
            </div>
          </div>
        </Transition>

        <!-- Current clip -->
        <div v-if="currentChampion" class="absolute inset-0">
          <!-- YouTube iframe for current clip -->
          <iframe
            v-if="embedUrl(currentChampion)"
            :key="`${currentChampion.videoId}-${iframeKey}`"
            :src="embedUrl(currentChampion)!"
            class="absolute inset-0 w-full h-full"
            style="pointer-events: none;"
            frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowfullscreen
          />
          <!-- Fallback: thumbnail if no embed -->
          <img
            v-else-if="thumbnailUrl(currentChampion)"
            :src="thumbnailUrl(currentChampion)!"
            :alt="currentChampion.city"
            class="absolute inset-0 w-full h-full object-cover"
          />
          <div v-else class="absolute inset-0 bg-neutral-900" />
        </div>

        <!-- Gradient overlays for readability -->
        <div class="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent z-10 pointer-events-none" />
        <div class="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 to-transparent z-10 pointer-events-none" />
      </div>

      <!-- Top bar: back button + matchup indicator -->
      <div class="absolute top-0 inset-x-0 z-20 flex items-center justify-between px-4 pt-[max(env(safe-area-inset-top),12px)] pb-2">
        <NuxtLink to="/cities" class="flex items-center gap-1 text-white/80 hover:text-white text-sm">
          <ArrowLeft class="w-5 h-5" />
        </NuxtLink>
        <div class="flex items-center gap-2 text-sm font-bold">
          <span
            class="px-2.5 py-1 rounded-full text-xs font-bold transition-all duration-300"
            :class="activeClip === 0 ? 'bg-white text-black' : 'bg-white/20 text-white/70'"
          >
            {{ matchup.a.city }}
          </span>
          <span class="text-white/40 text-xs font-black">VS</span>
          <span
            class="px-2.5 py-1 rounded-full text-xs font-bold transition-all duration-300"
            :class="activeClip === 1 ? 'bg-white text-black' : 'bg-white/20 text-white/70'"
          >
            {{ matchup.b.city }}
          </span>
        </div>
        <button class="p-1.5 text-white/80 hover:text-white" @click="toggleMute">
          <Volume2 v-if="!muted" class="w-5 h-5" />
          <VolumeX v-else class="w-5 h-5" />
        </button>
      </div>

      <!-- Right side actions -->
      <div class="absolute right-3 bottom-48 z-20 flex flex-col items-center gap-5">
        <button
          class="flex flex-col items-center gap-1"
          @click="showLeaderboard = true"
        >
          <div class="w-11 h-11 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
            <Trophy class="w-5 h-5 text-amber-400" />
          </div>
          <span class="text-[10px] text-white/70 font-medium">Ranks</span>
        </button>
      </div>

      <!-- Bottom: city info + vote / swipe hint -->
      <div class="absolute bottom-0 inset-x-0 z-20 px-4 pb-[max(env(safe-area-inset-bottom),20px)]">
        <!-- City info -->
        <div v-if="currentChampion" class="mb-4">
          <h2 class="text-2xl font-bold drop-shadow-lg">{{ currentChampion.city }}</h2>
          <p v-if="currentChampion.danceStyle" class="text-sm text-white/70 mt-0.5">{{ currentChampion.danceStyle }}</p>
          <p class="text-xs text-white/50 mt-1 line-clamp-1">{{ currentChampion.title }}</p>
        </div>

        <!-- Vote buttons (show after both clips seen) -->
        <div v-if="bothSeen && !showResult" class="flex gap-3 mb-4">
          <button
            class="flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95"
            :style="{ background: accents[0], color: '#fff' }"
            :disabled="voting"
            @click="vote(matchup!.a, matchup!.b)"
          >
            🔥 {{ matchup!.a.city }}
          </button>
          <button
            class="flex-1 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95"
            :style="{ background: accents[1], color: '#fff' }"
            :disabled="voting"
            @click="vote(matchup!.b, matchup!.a)"
          >
            🔥 {{ matchup!.b.city }}
          </button>
        </div>

        <!-- Swipe hint when on clip A -->
        <div v-else-if="activeClip === 0 && !showResult" class="flex items-center justify-center mb-4">
          <div class="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur text-sm text-white/70 animate-pulse">
            <ChevronUp class="w-4 h-4" />
            <span>Swipe up for {{ matchup!.b.city }}</span>
          </div>
        </div>

        <!-- Progress dots -->
        <div class="flex justify-center gap-2 pb-2">
          <button
            v-for="i in 2" :key="i"
            class="w-2 h-2 rounded-full transition-all duration-300"
            :class="activeClip === i - 1 ? 'bg-white w-6' : 'bg-white/30'"
            @click="activeClip === 0 && i === 2 ? showNextClip() : activeClip === 1 && i === 1 ? showPrevClip() : null"
          />
        </div>
      </div>
    </template>

    <!-- Leaderboard bottom sheet -->
    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      enter-from-class="translate-y-full"
      leave-active-class="transition-transform duration-200 ease-in"
      leave-from-class="translate-y-0"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="showLeaderboard"
        class="fixed inset-x-0 bottom-0 z-50 bg-neutral-900 rounded-t-3xl max-h-[75vh] flex flex-col"
      >
        <!-- Handle + header -->
        <div class="flex flex-col items-center pt-3 pb-2 px-4 shrink-0">
          <div class="w-10 h-1 rounded-full bg-white/20 mb-3" />
          <div class="flex items-center justify-between w-full">
            <h3 class="text-lg font-bold flex items-center gap-2">
              <Trophy class="w-5 h-5 text-amber-400" /> Top Dance Cities
            </h3>
            <button class="p-1.5 text-white/60 hover:text-white" @click="showLeaderboard = false">
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Leaderboard list -->
        <div class="overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),20px)]">
          <div v-if="!leaderboard.length" class="text-center py-8 text-white/40 text-sm">
            No votes yet this month
          </div>
          <div
            v-for="(city, i) in leaderboard" :key="city.citySlug"
            class="flex items-center gap-3 py-3 border-b border-white/5 last:border-0"
          >
            <span
              class="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0"
              :class="i === 0 ? 'bg-amber-500/20 text-amber-400' : i === 1 ? 'bg-white/10 text-white/60' : i === 2 ? 'bg-amber-700/20 text-amber-600' : 'bg-white/5 text-white/30'"
            >
              {{ i + 1 }}
            </span>
            <div class="flex-1 min-w-0">
              <div class="font-bold text-sm truncate">{{ city.city }}</div>
              <div class="text-xs text-white/40">{{ city.wins }}W · {{ city.losses }}L</div>
            </div>
            <div class="text-sm font-bold" :class="city.winRate >= 0.5 ? 'text-green-400' : 'text-white/40'">
              {{ Math.round(city.winRate * 100) }}%
            </div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Leaderboard backdrop -->
    <Transition
      enter-active-class="transition-opacity duration-300"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-200"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showLeaderboard"
        class="fixed inset-0 z-40 bg-black/50"
        @click="showLeaderboard = false"
      />
    </Transition>
  </div>
</template>

<style scoped>
@keyframes bounce-in {
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.05); }
  70% { transform: scale(0.95); }
  100% { transform: scale(1); opacity: 1; }
}
.animate-bounce-in {
  animation: bounce-in 0.5s ease-out;
}
</style>
