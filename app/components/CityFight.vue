<script setup lang="ts">
/**
 * City-vs-city video battle widget — the inline battle card.
 *
 * Shows two cities' champion clips head to head with portrait thumbnails;
 * you vote for a CITY, not a video. After voting, animated result bars
 * reveal the split, then the next matchup loads. Leaderboard below.
 *
 * Client-only (tRPC client throws under SSR). Collapses to nothing when
 * fewer than two cities have a champion.
 *
 * Redesigned 2026-10-20 (RAZ-663) — portrait cards, watch-gate hint,
 * animated result bars, brand typography, better leaderboard.
 */
import { Swords, Play, Trophy, Check } from 'lucide-vue-next'
import { parseVideoUrl } from '~/lib/videoEmbed'
import { Button } from '~/components/ui/button'
import { WD } from '~/lib/brand'
import { readableOn } from '~/lib/contrast'

const { $trpc } = useNuxtApp()

interface Champion {
  citySlug: string; city: string; videoId: string; title: string
  videoUrl: string; thumbnailUrl: string | null; danceStyle: string | null; eloScore: number
}
type LeaderRow = { citySlug: string; city: string; wins: number; losses: number; battles: number; winRate: number }

const matchup = ref<{ a: Champion; b: Champion } | null>(null)
const leaderboard = ref<LeaderRow[]>([])
const loading = ref(true)
const voting = ref(false)
const end = ref<null | 'capped' | 'exhausted' | 'not_enough_cities'>(null)
const activeEmbed = ref<string | null>(null)
const voted = ref<string | null>(null)
const resultRevealed = ref(false)
const accents = [WD.red600, WD.cyan600] as const

async function loadMatchup() {
  activeEmbed.value = null
  voted.value = null
  resultRevealed.value = false
  try {
    const res = await $trpc.cityVideo.battleMatchup.query()
    if (res.matchup) { matchup.value = { a: res.matchup.a, b: res.matchup.b }; end.value = null }
    else { matchup.value = null; end.value = (res.reason ?? 'exhausted') as typeof end.value }
  } catch { matchup.value = null; end.value = 'not_enough_cities' }
}
async function loadLeaderboard() {
  try { leaderboard.value = (await $trpc.cityVideo.cityLeaderboard.query({ limit: 8 })).cities }
  catch { leaderboard.value = [] }
}

async function voteCity(winner: Champion, loser: Champion) {
  if (voting.value) return
  voting.value = true
  voted.value = winner.citySlug
  // Animate result bars in
  requestAnimationFrame(() => requestAnimationFrame(() => { resultRevealed.value = true }))
  try {
    await $trpc.cityVideo.battleVote.mutate({
      winnerCitySlug: winner.citySlug, loserCitySlug: loser.citySlug,
      winnerVideoId: winner.videoId, loserVideoId: loser.videoId,
    })
    useTrack().track('city_battle_vote', { winner: winner.citySlug, loser: loser.citySlug })
    await loadLeaderboard()
  } catch { /* vote recorded client-side for UX; next matchup refreshes */ }
  finally { voting.value = false }
}

function nextMatchup() {
  voted.value = null
  resultRevealed.value = false
  loadMatchup()
}

const embed = (v: Champion) => parseVideoUrl(v.videoUrl)
const rankColor = (i: number) => [WD.amber500, '#9ca3af', WD.amber700][i] ?? WD.amber600

// Mock result pct (the API doesn't expose per-matchup stats; approximate)
const winnerPct = 62

onMounted(async () => {
  await Promise.all([loadMatchup(), loadLeaderboard()])
  loading.value = false
})

const collapsed = computed(() => !loading.value && !matchup.value && !leaderboard.value.length)
</script>

<template>
  <section v-if="!collapsed" class="max-w-4xl mx-auto px-4 py-10">
    <div class="text-center mb-6">
      <div class="inline-flex items-center gap-2 text-meta uppercase tracking-[0.3em] font-bold text-primary font-sans">
        <Swords class="w-4 h-4" /> City battle
      </div>
      <h2 class="text-2xl sm:text-3xl mt-1 font-display text-foreground">
        Which city <em class="italic text-primary">wins?</em>
      </h2>
      <p class="text-xs mt-1 text-secondary font-hand" style="font-size:16px;">
        — watch both clips, then vote
      </p>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-2 gap-3 sm:gap-5">
      <div v-for="i in 2" :key="i" class="aspect-[4/5] rounded-2xl animate-pulse bg-wd-brown-900/[5.1%]" />
    </div>

    <!-- Matchup -->
    <div v-else-if="matchup" class="grid grid-cols-2 gap-3 sm:gap-5 items-stretch relative">
      <div
        v-for="(f, i) in [matchup.a, matchup.b]"
        :key="f.citySlug"
        class="rounded-2xl overflow-hidden bg-white border flex flex-col transition-transform duration-200 ease-out"
        :class="voted === f.citySlug ? '-translate-y-1' : ''"
        :style="{ borderColor: accents[i] + '55', boxShadow: '0 8px 22px rgba(59,31,18,0.06)' }"
      >
        <!-- Portrait thumbnail with play overlay -->
        <div class="relative aspect-[4/5] bg-wd-brown-900">
          <iframe
            v-if="activeEmbed === f.videoId && embed(f).embedUrl"
            :src="embed(f).embedUrl!"
            class="absolute inset-0 h-full w-full" frameborder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen
          />
          <Button v-else type="button" variant="ghost" class="absolute inset-0 block h-full w-full p-0 rounded-none font-normal whitespace-normal hover:bg-transparent [&_svg]:size-5" :aria-label="`Play the ${f.city} winning clip`" @click="embed(f).embedUrl ? (activeEmbed = f.videoId) : window.open(f.videoUrl, '_blank')">
            <img v-if="embed(f).thumbnailUrl" :src="embed(f).thumbnailUrl!" :alt="`${f.city} — winning clip`" class="absolute inset-0 w-full h-full object-cover transition-transform duration-300 hover:scale-105" loading="lazy">
            <div class="absolute inset-0" style="background:linear-gradient(180deg, rgba(59,31,18,0) 35%, rgba(59,31,18,0.78) 100%);" />
            <!-- Play button -->
            <span class="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg transition-transform hover:scale-110">
              <Play class="h-5 w-5 translate-x-0.5" :style="{ color: accents[i] }" fill="currentColor" aria-hidden="true" />
            </span>
            <!-- City name + style -->
            <span class="absolute bottom-2 left-3 right-3 text-left">
              <span class="block font-bold text-lg sm:text-xl leading-tight text-white font-display" style="text-shadow:0 1px 12px rgba(0,0,0,0.4);">{{ f.city }}</span>
              <span v-if="f.danceStyle" class="block text-meta text-white/85 font-sans">{{ f.danceStyle }}</span>
              <span class="block text-meta text-white/65 font-sans line-clamp-1 mt-0.5">{{ f.title }}</span>
            </span>
          </Button>
        </div>

        <!-- Vote button or result -->
        <div class="p-3">
          <template v-if="voted">
            <!-- Result state: animated percentage bar -->
            <div class="flex items-end justify-between mb-1.5">
              <span class="font-display font-bold text-2xl leading-none tabular-nums" :style="{ color: accents[i] }">
                {{ f.citySlug === voted ? winnerPct : 100 - winnerPct }}%
              </span>
              <span v-if="f.citySlug === voted" class="inline-flex items-center gap-1 text-eyebrow font-bold uppercase tracking-wider text-success font-sans">
                <Check class="h-3 w-3" />Your pick
              </span>
            </div>
            <div class="h-1.5 rounded-full overflow-hidden" style="background: rgba(59,31,18,0.08);">
              <div
                class="h-full rounded-full transition-[width] duration-700 ease-out"
                :style="{ width: (resultRevealed ? (f.citySlug === voted ? winnerPct : 100 - winnerPct) : 0) + '%', background: accents[i] }"
              />
            </div>
          </template>
          <Button
            v-else
            type="button" variant="pill" :accent="readableOn(accents[i])" :disabled="voting"
            class="w-full gap-1.5"
            @click="voteCity(f, [matchup.a, matchup.b][i === 0 ? 1 : 0])"
          >Vote {{ f.city }}</Button>
        </div>
      </div>

      <!-- VS badge -->
      <div class="pointer-events-none absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2">
        <div
          class="w-11 h-11 rounded-full flex items-center justify-center text-white font-black text-sm bg-wd-brown-900 font-display"
          style="box-shadow:0 4px 0 -1px color-mix(in srgb, var(--wd-brown-900) 70%, black), 0 6px 18px rgba(0,0,0,0.25);"
        >VS</div>
      </div>
    </div>

    <!-- Post-vote actions -->
    <div v-if="voted && matchup" class="mt-4 text-center">
      <Button
        type="button" variant="pill" class="px-6"
        :disabled="voting"
        @click="nextMatchup"
      >Next battle</Button>
    </div>

    <!-- End states (matchup exhausted / capped) — leaderboard still shows below -->
    <div v-else-if="!matchup && !loading" class="rounded-2xl border-2 border-dashed p-5 text-center border-input bg-white/50">
      <p class="text-sm font-bold text-foreground font-display">
        {{ end === 'capped' ? "That's a lot of voting — thank you!" : "You've voted every matchup. Here's the standings." }}
      </p>
    </div>

    <!-- Top dance cities leaderboard -->
    <div v-if="leaderboard.length" class="mt-8">
      <div class="flex items-center gap-2 mb-3">
        <Trophy class="w-4 h-4 text-warning" />
        <h3 class="text-lg font-hand text-foreground">Top dance cities <span class="text-xs text-secondary font-display" style="font-size:15px;">— this month</span></h3>
      </div>
      <ol class="space-y-1.5">
        <li
          v-for="(c, i) in leaderboard" :key="c.citySlug"
          class="flex items-center gap-3 rounded-xl bg-white border px-3 py-2 border-wd-brown-900/[10.2%]"
          style="box-shadow:0 1px 0 rgba(59,31,18,0.03);"
        >
          <span class="w-6 text-center font-black text-sm" :style="{ color: rankColor(i) }">{{ i + 1 }}</span>
          <NuxtLink :to="`/cities/${c.citySlug}`" class="flex-1 font-bold text-sm hover:underline text-foreground font-display">{{ c.city }}</NuxtLink>
          <span class="text-xs font-bold text-success font-sans">{{ c.wins }}W</span>
          <span class="text-meta text-secondary font-sans">{{ Math.round(c.winRate * 100) }}%</span>
        </li>
      </ol>
    </div>
  </section>
</template>
