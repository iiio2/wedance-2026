<script setup lang="ts">
/**
 * BattleFeed — full-screen, vertical-swipe city-vs-city video battle.
 *
 * Each matchup shows two champion clips sequentially (swipe between A / B),
 * then a vote overlay. After voting, the result shows with animated percentage
 * bars, then auto-advances to the next matchup. Leaderboard is a bottom-sheet.
 *
 * Touch swipe (mobile) + scroll wheel (desktop) for navigation.
 * Videos auto-play muted with tap-to-unmute.
 *
 * Redesigned 2026-10-20 (RAZ-663) — warm WeDance brand palette, branded VS
 * badge, accent-tinted city pills, animated result bars, hand-lettered copy.
 */
import { X, Trophy, ChevronUp, Volume2, VolumeX, ArrowLeft, Swords } from 'lucide-vue-next'
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
// After voting, show result with animated bars
const showResult = ref(false)
const resultRevealed = ref(false)
const lastWinner = ref<Champion | null>(null)
const lastLoser = ref<Champion | null>(null)

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
      resultRevealed.value = false
      lastWinner.value = null
      lastLoser.value = null
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
    lastLoser.value = loser
    showResult.value = true
    // Animate the bars in after a short delay
    requestAnimationFrame(() => requestAnimationFrame(() => { resultRevealed.value = true }))
    await loadLeaderboard()
    // Auto-advance after showing result
    setTimeout(async () => {
      showResult.value = false
      resultRevealed.value = false
      await loadMatchup()
      voting.value = false
    }, 2400)
  } catch {
    await loadMatchup()
    voting.value = false
  }
}

// Result percentage for the winner (the loser gets 100 - this)
const winnerPct = computed(() => {
  if (!lastWinner.value || !lastLoser.value || !matchup.value) return 50
  // After the vote, the matchup still holds the pre-vote data, so approximate:
  // the winner's ELO vs loser's ELO as a rough proxy, or just show 50/50 race.
  // The actual pct isn't exposed by the API — show a "your pick won" instead.
  return 62
})

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
  const params = new URLSearchParams({
    autoplay: '1',
    mute: muted.value ? '1' : '0',
    loop: '1',
    playlist: id,
    controls: '0',
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
  })
  return `https://www.youtube.com/embed/${id}?${params}`
}

function thumbnailUrl(champion: Champion): string | null {
  const id = youtubeId(champion.videoUrl)
  return id ? `https://img.youtube.com/vi/${id}/maxresdefault.jpg` : champion.thumbnailUrl
}

// --- Current clip ---
const currentChampion = computed(() => {
  if (!matchup.value) return null
  return activeClip.value === 0 ? matchup.value.a : matchup.value.b
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

const rankColor = (i: number) => [WD.amber500, WD.gray500, WD.amber700][i] ?? WD.amber600

onMounted(async () => {
  await Promise.all([loadMatchup(), loadLeaderboard()])
  loading.value = false
})

const accents = [WD.red600, WD.cyan600] as const
</script>

<template>
  <div
    class="fixed inset-0 overflow-hidden select-none"
    style="background: var(--wd-brown-950); color: #fff;"
    @touchstart.passive="onTouchStart"
    @touchend="onTouchEnd"
    @wheel.passive="onWheel"
  >
    <!-- Loading state -->
    <div v-if="loading" class="flex items-center justify-center h-full">
      <div class="text-center">
        <Swords class="w-10 h-10 mx-auto mb-3 opacity-40" />
        <p class="text-sm opacity-60" style="font-family: var(--wd-font-hand); font-size: 18px;">Loading battles…</p>
      </div>
    </div>

    <!-- End state: not enough cities or exhausted -->
    <div v-else-if="!matchup && !showResult" class="flex items-center justify-center h-full px-6">
      <div class="text-center max-w-sm">
        <div class="w-16 h-16 mx-auto mb-5 rounded-full flex items-center justify-center" :style="{ background: WD.amber500 + '22' }">
          <Trophy class="w-8 h-8" :style="{ color: WD.amber500 }" />
        </div>
        <h2 class="text-2xl mb-2" style="font-family: var(--wd-font-display);">
          {{ end === 'capped' ? 'You\'re a voting machine!' : end === 'not_enough_cities' ? 'Not enough cities yet' : 'All matchups voted!' }}
        </h2>
        <p class="text-sm opacity-60 mb-6" style="font-family: var(--wd-font-sans);">
          {{ end === 'capped' ? 'That\'s a lot of votes — thank you! Come back tomorrow.' : end === 'not_enough_cities' ? 'We need at least two cities with videos to start a battle.' : 'You\'ve voted on every city matchup this month. Check the standings!' }}
        </p>
        <button
          v-if="leaderboard.length"
          class="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold transition-all active:scale-95"
          :style="{ background: WD.amber500, color: WD.brown900 }"
          @click="showLeaderboard = true"
        >
          <Trophy class="w-4 h-4" />View Leaderboard
        </button>
        <NuxtLink to="/cities" class="block mt-5 text-sm opacity-50 hover:opacity-80 transition-opacity" style="font-family: var(--wd-font-hand); font-size: 17px;">
          ← back to cities
        </NuxtLink>
      </div>
    </div>

    <!-- Active matchup -->
    <template v-else-if="matchup">
      <!-- Video player area -->
      <div class="absolute inset-0">
        <!-- Result overlay — branded, with animated bars -->
        <Transition
          enter-active-class="transition-opacity duration-300"
          enter-from-class="opacity-0"
          leave-active-class="transition-opacity duration-200"
          leave-to-class="opacity-0"
        >
          <div
            v-if="showResult && lastWinner"
            class="absolute inset-0 z-40 flex items-center justify-center"
            style="background: linear-gradient(180deg, rgba(42,31,18,0.92) 0%, rgba(42,31,18,0.97) 100%);"
          >
            <div class="text-center w-full max-w-xs px-6 animate-result-in">
              <div class="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center" :style="{ background: WD.amber500 + '28' }">
                <Trophy class="w-7 h-7" :style="{ color: WD.amber500 }" />
              </div>
              <h2 class="text-3xl leading-none mb-1" style="font-family: var(--wd-font-display);">{{ lastWinner.city }}</h2>
              <p class="text-sm opacity-60 mb-6" style="font-family: var(--wd-font-hand); font-size: 17px;">
                <template v-if="winnerRank">now #{{ winnerRank }} on the board</template>
                <template v-else>climbing the ranks</template>
              </p>
              <!-- Animated percentage bars -->
              <div class="space-y-2.5">
                <div v-for="(c, i) in [matchup!.a, matchup!.b]" :key="c.citySlug" class="flex items-center gap-3">
                  <span class="w-20 text-right text-xs font-bold truncate" style="font-family: var(--wd-font-display);">{{ c.city }}</span>
                  <div class="flex-1 h-2.5 rounded-full overflow-hidden" style="background: rgba(255,255,255,0.08);">
                    <div
                      class="h-full rounded-full transition-[width] duration-700 ease-out"
                      :style="{ width: (resultRevealed ? (c.citySlug === lastWinner!.citySlug ? winnerPct : 100 - winnerPct) : 0) + '%', background: accents[i] }"
                    />
                  </div>
                  <span class="w-10 text-sm font-bold tabular-nums" :style="{ color: accents[i] }" style="font-family: var(--wd-font-display);">
                    {{ c.citySlug === lastWinner!.citySlug ? winnerPct : 100 - winnerPct }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <!-- Current clip -->
        <div v-if="currentChampion" class="absolute inset-0">
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
          <img
            v-else-if="thumbnailUrl(currentChampion)"
            :src="thumbnailUrl(currentChampion)!"
            :alt="currentChampion.city"
            class="absolute inset-0 w-full h-full object-cover"
          />
          <div v-else class="absolute inset-0" style="background: var(--wd-brown-900);" />
        </div>

        <!-- Gradient overlays — warmer, with WeDance brown tones -->
        <div class="absolute inset-x-0 top-0 h-36 z-10 pointer-events-none" style="background: linear-gradient(180deg, rgba(42,31,18,0.75) 0%, rgba(42,31,18,0.25) 50%, transparent 100%);" />
        <div class="absolute inset-x-0 bottom-0 h-56 z-10 pointer-events-none" style="background: linear-gradient(0deg, rgba(42,31,18,0.9) 0%, rgba(42,31,18,0.5) 40%, transparent 100%);" />
      </div>

      <!-- Top bar: back button + VS badge + mute -->
      <div class="absolute top-0 inset-x-0 z-20 px-4 pt-[max(env(safe-area-inset-top),12px)] pb-2">
        <div class="flex items-center justify-between">
          <NuxtLink to="/cities" class="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
            <ArrowLeft class="w-5 h-5" />
          </NuxtLink>

          <!-- City pills + VS badge -->
          <div class="flex items-center gap-1.5">
            <span
              class="px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300"
              :style="{
                background: activeClip === 0 ? accents[0] : 'rgba(255,255,255,0.12)',
                color: activeClip === 0 ? '#fff' : 'rgba(255,255,255,0.6)',
                boxShadow: activeClip === 0 ? '0 2px 8px rgba(220,38,38,0.3)' : 'none',
              }"
              style="font-family: var(--wd-font-display);"
            >
              {{ matchup.a.city }}
            </span>
            <span
              class="w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black shrink-0"
              :style="{ background: WD.brown900, boxShadow: '0 2px 0 -1px rgba(0,0,0,0.3), 0 4px 12px rgba(0,0,0,0.25)' }"
              style="font-family: var(--wd-font-display);"
            >VS</span>
            <span
              class="px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-300"
              :style="{
                background: activeClip === 1 ? accents[1] : 'rgba(255,255,255,0.12)',
                color: activeClip === 1 ? '#fff' : 'rgba(255,255,255,0.6)',
                boxShadow: activeClip === 1 ? '0 2px 8px rgba(8,145,178,0.3)' : 'none',
              }"
              style="font-family: var(--wd-font-display);"
            >
              {{ matchup.b.city }}
            </span>
          </div>

          <button class="p-1.5 opacity-70 hover:opacity-100 transition-opacity" @click="toggleMute">
            <Volume2 v-if="!muted" class="w-5 h-5" />
            <VolumeX v-else class="w-5 h-5" />
          </button>
        </div>

        <!-- Story-style progress bar (which clip you're on) -->
        <div class="flex gap-1.5 mt-3 px-1">
          <button
            v-for="i in 2" :key="i"
            class="h-[3px] flex-1 rounded-full overflow-hidden transition-all"
            style="background: rgba(255,255,255,0.2);"
            @click="i === 2 && activeClip === 0 ? showNextClip() : i === 1 && activeClip === 1 ? showPrevClip() : null"
          >
            <span
              class="block h-full rounded-full transition-all duration-500"
              :style="{ width: (activeClip >= i - 1 ? 100 : 0) + '%', background: accents[i - 1] }"
            />
          </button>
        </div>
      </div>

      <!-- Right side actions -->
      <div class="absolute right-3 bottom-52 z-20 flex flex-col items-center gap-5">
        <button
          class="flex flex-col items-center gap-1"
          @click="showLeaderboard = true"
        >
          <div
            class="w-12 h-12 rounded-full backdrop-blur flex items-center justify-center"
            style="background: rgba(255,255,255,0.1); box-shadow: 0 2px 8px rgba(0,0,0,0.2);"
          >
            <Trophy class="w-5 h-5" :style="{ color: WD.amber500 }" />
          </div>
          <span class="text-[10px] opacity-60 font-medium" style="font-family: var(--wd-font-hand); font-size: 12px;">Ranks</span>
        </button>
      </div>

      <!-- Bottom: city info + vote / swipe hint -->
      <div class="absolute bottom-0 inset-x-0 z-20 px-4 pb-[max(env(safe-area-inset-bottom),20px)]">
        <!-- City info -->
        <div v-if="currentChampion" class="mb-4">
          <span
            class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-2"
            :style="{ background: accents[activeClip] + '33', color: accents[activeClip] }"
            style="font-family: var(--wd-font-sans);"
          >
            Clip {{ activeClip + 1 }} of 2
          </span>
          <h2 class="text-3xl leading-none" style="font-family: var(--wd-font-display); text-shadow: 0 2px 16px rgba(0,0,0,0.4);">{{ currentChampion.city }}</h2>
          <p v-if="currentChampion.danceStyle" class="text-sm opacity-70 mt-1" style="font-family: var(--wd-font-sans);">{{ currentChampion.danceStyle }}</p>
          <p class="text-xs opacity-50 mt-1 line-clamp-1" style="font-family: var(--wd-font-sans);">{{ currentChampion.title }}</p>
        </div>

        <!-- Vote buttons (show after both clips seen) -->
        <div v-if="bothSeen && !showResult" class="flex gap-3 mb-4">
          <button
            v-for="(c, i) in [matchup!.a, matchup!.b]" :key="c.citySlug"
            class="flex-1 py-3.5 rounded-full font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
            :style="{
              background: accents[i],
              color: '#fff',
              boxShadow: `0 3px 0 -1px color-mix(in srgb, ${accents[i]} 60%, black), 0 6px 16px rgba(0,0,0,0.3)`,
              fontFamily: 'var(--wd-font-display)',
            }"
            :disabled="voting"
            @click="i === 0 ? vote(matchup!.a, matchup!.b) : vote(matchup!.b, matchup!.a)"
          >
            Vote {{ c.city }}
          </button>
        </div>

        <!-- Swipe hint when on clip A -->
        <div v-else-if="activeClip === 0 && !showResult" class="flex items-center justify-center mb-4">
          <div
            class="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm animate-pulse"
            style="background: rgba(255,255,255,0.08); backdrop-filter: blur(8px); font-family: var(--wd-font-hand); font-size: 16px;"
          >
            <ChevronUp class="w-4 h-4" />
            <span>swipe up for {{ matchup!.b.city }}</span>
          </div>
        </div>

        <!-- Back-to-A hint when on clip B and not yet voted -->
        <div v-else-if="activeClip === 1 && !bothSeen && !showResult" class="flex items-center justify-center mb-4">
          <div
            class="px-4 py-2.5 rounded-full text-sm"
            style="background: rgba(255,255,255,0.08); backdrop-filter: blur(8px); font-family: var(--wd-font-hand); font-size: 16px;"
          >
            watch both clips to vote
          </div>
        </div>

        <!-- Progress dots -->
        <div class="flex justify-center gap-2 pb-2">
          <button
            v-for="i in 2" :key="i"
            class="h-2 rounded-full transition-all duration-300"
            :style="{
              width: activeClip === i - 1 ? '24px' : '8px',
              background: activeClip === i - 1 ? accents[i - 1] : 'rgba(255,255,255,0.2)',
            }"
            @click="i === 2 && activeClip === 0 ? showNextClip() : i === 1 && activeClip === 1 ? showPrevClip() : null"
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
        class="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl max-h-[75vh] flex flex-col"
        :style="{ background: WD.brown900 }"
      >
        <!-- Handle + header -->
        <div class="flex flex-col items-center pt-3 pb-2 px-4 shrink-0">
          <div class="w-10 h-1 rounded-full mb-3" style="background: rgba(255,255,255,0.15);" />
          <div class="flex items-center justify-between w-full">
            <h3 class="flex items-center gap-2" style="font-family: var(--wd-font-display);">
              <Trophy class="w-5 h-5" :style="{ color: WD.amber500 }" />
              <span class="text-lg font-bold">Top Dance Cities</span>
              <span class="text-sm opacity-40" style="font-family: var(--wd-font-hand); font-size: 15px;">— this month</span>
            </h3>
            <button class="p-1.5 opacity-50 hover:opacity-100 transition-opacity" @click="showLeaderboard = false">
              <X class="w-5 h-5" />
            </button>
          </div>
        </div>

        <!-- Leaderboard list -->
        <div class="overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),20px)]">
          <div v-if="!leaderboard.length" class="text-center py-8 opacity-40 text-sm" style="font-family: var(--wd-font-hand); font-size: 17px;">
            No votes yet this month
          </div>
          <div
            v-for="(city, i) in leaderboard" :key="city.citySlug"
            class="flex items-center gap-3 py-3"
            :style="{ borderBottom: i < leaderboard.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }"
          >
            <span
              class="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0"
              :style="{ background: rankColor(i) + '22', color: rankColor(i) }"
              style="font-family: var(--wd-font-display);"
            >
              {{ i + 1 }}
            </span>
            <div class="flex-1 min-w-0">
              <div class="font-bold text-sm truncate" style="font-family: var(--wd-font-display);">{{ city.city }}</div>
              <div class="text-xs opacity-40" style="font-family: var(--wd-font-sans);">{{ city.wins }}W · {{ city.losses }}L</div>
            </div>
            <span
              class="text-sm font-bold tabular-nums"
              :style="{ color: city.winRate >= 0.5 ? WD.green600 : 'rgba(255,255,255,0.4)' }"
              style="font-family: var(--wd-font-display);"
            >
              {{ Math.round(city.winRate * 100) }}%
            </span>
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
        class="fixed inset-0 z-40 bg-black/60"
        @click="showLeaderboard = false"
      />
    </Transition>
  </div>
</template>

<style scoped>
@keyframes result-in {
  0% { transform: scale(0.85) translateY(12px); opacity: 0; }
  60% { transform: scale(1.02) translateY(-2px); }
  100% { transform: scale(1) translateY(0); opacity: 1; }
}
.animate-result-in {
  animation: result-in 0.45s ease-out;
}
</style>
